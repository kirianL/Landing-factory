import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readJsonSafe, writeBufferAtomic, writeJsonAtomic } from './atomic-fs.mjs';
import { AssetComposer } from './asset-composer.mjs';
import { GenerationCache } from './cache-manager.mjs';
import { ENGINE_MODES } from './contracts.mjs';
import { ImageOptimizer } from './optimizer.mjs';
import {
  DEFAULT_ALLOWED_HOSTS,
  DEFAULT_MAX_DOWNLOAD_BYTES,
  inspectImageBuffer,
  resolveSafeOutputPath,
  secureDownloadImage,
} from './security-validator.mjs';

/**
 * GenerationPipeline — Convierte un plan visual de FASE 3 en recursos finales
 * validados, optimizados, cacheados y con trazabilidad completa.
 * Soporta errores parciales y concurrencia acotada.
 */
export class GenerationPipeline {
  constructor({
    engine,
    composer = null,
    cache = null,
    optimizer = null,
    fetchImpl = null,
    allowedHosts = DEFAULT_ALLOWED_HOSTS,
    maxDownloadBytes = DEFAULT_MAX_DOWNLOAD_BYTES,
    concurrency = 2,
  } = {}) {
    this.engine = engine;
    this.composer = composer || new AssetComposer();
    this.cache = cache || new GenerationCache({ stateDir: engine.config.stateDir });
    this.optimizer = optimizer || new ImageOptimizer();
    this.fetchImpl = fetchImpl || engine.provider?.fetch || globalThis.fetch;
    this.allowedHosts = allowedHosts;
    this.maxDownloadBytes = maxDownloadBytes;
    this.concurrency = Math.max(1, Number(concurrency) || 2);
  }

  async _processSingleAsset(item, { projectId, publicImagesDir, useCache = true }) {
    if (!item.shouldGenerate) {
      return {
        assetId: item.assetId,
        sectionId: item.sectionId,
        status: item.strategy === 'REUSE_LOCAL' ? 'REUSED_LOCAL' : item.strategy,
        publicPath: item.existingAssetPath || null,
        creditsUsed: 0,
        fromCache: false,
        reason: item.reason,
      };
    }

    const composed = this.composer.composeRequest({
      config: this.engine.config,
      projectId,
      assetItem: item,
    });

    const isDryRun = this.engine.config.mode === ENGINE_MODES.DRY_RUN;
    const targetExt = composed.targetFilename.endsWith('.svg') ? 'svg' : 'png';
    const cacheKey = GenerationCache.computeKey({
      prompt: composed.request.prompt,
      model: composed.request.model,
      size: composed.request.size,
      format: targetExt,
      styleId: composed.request.styleId,
      styleReferenceUrls: composed.request.styleReferenceUrls,
    });

    // En modo LIVE, consultar caché determinista antes de consumir créditos
    if (!isDryRun && useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        const outFilename = `${path.parse(composed.targetFilename).name}.${cached.format}`;
        const destPath = resolveSafeOutputPath(publicImagesDir, outFilename);
        writeBufferAtomic(destPath, cached.buffer);

        this.engine.logger.log('pipeline.cache_hit', {
          projectId,
          assetId: item.assetId,
          cacheKey,
          outFilename,
        });

        return {
          assetId: item.assetId,
          sectionId: item.sectionId,
          status: 'CACHE_HIT',
          model: composed.request.model,
          estimatedCredits: composed.request.estimatedCredits,
          creditsUsed: 0,
          fromCache: true,
          cacheKey,
          sha256: cached.sha256,
          format: cached.format,
          width: cached.width,
          height: cached.height,
          bytes: cached.bytes,
          publicPath: `/images/${outFilename}`,
          filePath: destPath,
          traceability: composed.traceability,
        };
      }
    }

    // Ejecutar generación vía VisualAssetEngine (DRY_RUN o LIVE con CreditManager)
    const genResult = await this.engine.generateImage(composed.request);

    if (isDryRun) {
      const simOutName = `${path.parse(composed.targetFilename).name}.${targetExt}`;
      return {
        assetId: item.assetId,
        sectionId: item.sectionId,
        status: 'DRY_RUN_SIMULATED',
        generationId: genResult.generationId,
        model: genResult.model,
        estimatedCredits: composed.request.estimatedCredits,
        creditsUsed: 0,
        fromCache: false,
        cacheKey,
        publicPath: `/images/${simOutName}`,
        simulatedUrl: genResult.images?.[0]?.url || null,
        traceability: composed.traceability,
      };
    }

    // Modo LIVE: descargar o decodificar b64Json, validar, optimizar, cachear y guardar
    const firstImg = genResult.images?.[0];
    let downloaded;
    if (firstImg?.b64Json) {
      const rawBuf = Buffer.from(firstImg.b64Json, 'base64');
      if (rawBuf.length > this.maxDownloadBytes) {
        throw new Error(`Imagen base64 excede límite de ${this.maxDownloadBytes} bytes`);
      }
      const inspected = inspectImageBuffer(rawBuf);
      downloaded = { buffer: rawBuf, bytes: rawBuf.length, ...inspected };
    } else if (firstImg?.url) {
      downloaded = await secureDownloadImage(firstImg.url, {
        fetchImpl: this.fetchImpl,
        allowedHosts: this.allowedHosts,
        maxBytes: this.maxDownloadBytes,
        timeoutMs: this.engine.config.timeoutMs,
        expectedFormat: targetExt === 'svg' ? 'svg' : 'any',
      });
    } else {
      throw new Error('Respuesta de generación sin url ni b64Json');
    }

    const optimized = await this.optimizer.optimize(downloaded.buffer, {
      format: downloaded.format,
    });

    const finalFilename = `${path.parse(composed.targetFilename).name}.${optimized.format}`;
    const finalPath = resolveSafeOutputPath(publicImagesDir, finalFilename);
    writeBufferAtomic(finalPath, optimized.buffer);

    const sha256 = crypto.createHash('sha256').update(optimized.buffer).digest('hex');

    if (useCache) {
      this.cache.put(cacheKey, {
        buffer: optimized.buffer,
        format: optimized.format,
        mimeType: optimized.mimeType,
        width: optimized.width,
        height: optimized.height,
        model: genResult.model,
        metadata: { projectId, assetId: item.assetId, sectionId: item.sectionId },
      });
    }

    return {
      assetId: item.assetId,
      sectionId: item.sectionId,
      status: 'GENERATED',
      generationId: genResult.generationId,
      model: genResult.model,
      estimatedCredits: composed.request.estimatedCredits,
      creditsUsed: genResult.creditsUsed,
      creditsSource: genResult.creditsSource,
      fromCache: false,
      cacheKey,
      sha256,
      format: optimized.format,
      width: optimized.width,
      height: optimized.height,
      bytes: optimized.bytes,
      optimized: optimized.optimized,
      optimizerStrategy: optimized.strategy,
      publicPath: `/images/${finalFilename}`,
      filePath: finalPath,
      traceability: composed.traceability,
    };
  }

  /**
   * Ejecuta el pipeline sobre todos los recursos del plan con concurrencia acotada
   * y tolerancia a fallos parciales.
   */
  async execute(plan, { projectDir = null, useCache = true, resumeFromPrevious = false, retryFailed = true } = {}) {
    const projectId = plan.projectId || 'default';
    const baseProjectDir = projectDir ? path.resolve(projectDir) : path.join(this.engine.config.stateDir, 'dry-run-output', projectId);
    const publicImagesDir = path.join(baseProjectDir, 'public', 'images');
    const manifestPath = path.join(this.engine.config.stateDir, 'manifests', `${projectId}-assets.json`);
    const prevManifest = resumeFromPrevious ? readJsonSafe(manifestPath, null) : null;
    const prevByAssetId = new Map((prevManifest?.results || []).map((r) => [r.assetId, r]));

    const results = new Array(plan.assets.length);
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= plan.assets.length) break;
        const item = plan.assets[idx];

        const prev = prevByAssetId.get(item.assetId);
        if (prev) {
          // No repetir generaciones ya completadas si su archivo sigue en disco
          if ((prev.status === 'GENERATED' || prev.status === 'CACHE_HIT') && prev.filePath && fs.existsSync(prev.filePath)) {
            results[idx] = { ...prev, resumed: true };
            continue;
          }
          // Nunca reenviar operaciones en UNKNOWN_OUTCOME hasta su reconciliación manual
          if (prev.errorCode === 'TIMEOUT' || prev.errorCode === 'ABORTED_LOCAL' || prev.errorCode === 'NETWORK_ERROR' || prev.status === 'UNKNOWN_OUTCOME') {
            results[idx] = {
              ...prev,
              status: 'UNKNOWN_OUTCOME_BLOCKED',
              resumed: true,
              reason: 'Bloqueado en reanudación por operación previa con resultado desconocido (UNKNOWN_OUTCOME)',
            };
            continue;
          }
          // Si falló previamente y retryFailed es false, conservar estado FAILED
          if (prev.status === 'FAILED' && !retryFailed) {
            results[idx] = { ...prev, resumed: true };
            continue;
          }
        }

        try {
          results[idx] = await this._processSingleAsset(item, {
            projectId,
            publicImagesDir,
            useCache,
          });
        } catch (err) {
          this.engine.logger.log('pipeline.asset_failed', {
            projectId,
            assetId: item.assetId,
            code: err.code || 'PIPELINE_ERROR',
            error: err.message,
          });
          results[idx] = {
            assetId: item.assetId,
            sectionId: item.sectionId,
            status: err.ambiguousOutcome ? 'UNKNOWN_OUTCOME' : 'FAILED',
            errorCode: err.code || 'PIPELINE_ERROR',
            error: err.message,
            creditsUsed: 0,
            fromCache: false,
          };
        }
      }
    };

    const workers = Array.from({ length: Math.min(this.concurrency, Math.max(1, plan.assets.length)) }, () => worker());
    await Promise.all(workers);

    const manifest = {
      projectId,
      mode: this.engine.config.mode,
      executedAt: new Date().toISOString(),
      summary: {
        total: results.length,
        generated: results.filter((r) => r.status === 'GENERATED').length,
        dryRunSimulated: results.filter((r) => r.status === 'DRY_RUN_SIMULATED').length,
        cacheHits: results.filter((r) => r.status === 'CACHE_HIT').length,
        reusedLocal: results.filter((r) => r.status === 'REUSED_LOCAL').length,
        unknownOutcome: results.filter((r) => r.status === 'UNKNOWN_OUTCOME' || r.status === 'UNKNOWN_OUTCOME_BLOCKED').length,
        failed: results.filter((r) => r.status === 'FAILED').length,
        totalCreditsUsed: results.reduce((acc, r) => acc + (r.creditsUsed || 0), 0),
      },
      results,
    };

    writeJsonAtomic(manifestPath, manifest);

    return manifest;
  }
}
