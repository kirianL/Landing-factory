import { getModelSpec } from './config.mjs';
import { VisualEngineError } from './contracts.mjs';

/**
 * AssetComposer — Transforma los items del plan de FASE 3 en solicitudes
 * compatibles con el proveedor visual, respetando capacidades del modelo
 * y preservando trazabilidad completa sin duplicar CreditManager ni Provider.
 */
export class AssetComposer {
  composeRequest({ config, projectId, assetItem, responseFormat = 'url' } = {}) {
    if (!assetItem || !assetItem.shouldGenerate) {
      throw new VisualEngineError(`El recurso '${assetItem?.assetId || 'unknown'}' no requiere generación`, {
        code: 'COMPOSE_SKIPPED',
      });
    }

    const modelSpec = getModelSpec(config, assetItem.model);
    if (!modelSpec) {
      throw new VisualEngineError(`Modelo desconocido en AssetComposer: ${assetItem.model}`, {
        code: 'INVALID_MODEL',
      });
    }

    const rawPrompt = assetItem.brief?.prompt || assetItem.prompt || '';
    const maxLen = modelSpec.maxPromptLength || 10000;
    const prompt = rawPrompt.length > maxLen
      ? rawPrompt.slice(0, maxLen).replace(/\s+\S*$/, '').trim()
      : rawPrompt.trim();

    if (!prompt) {
      throw new VisualEngineError(`Prompt vacío para el recurso '${assetItem.assetId}'`, {
        code: 'INVALID_REQUEST',
      });
    }

    const request = {
      projectId: projectId || 'default',
      agent: 'asset-composer',
      assetId: assetItem.assetId,
      sectionId: assetItem.sectionId,
      prompt,
      model: modelSpec.id,
      size: assetItem.dimensions || modelSpec.defaultSize || '1024x1024',
      responseFormat,
      n: 1,
      estimatedCredits: assetItem.estimatedCredits ?? modelSpec.estimatedCredits,
    };

    if (assetItem.styleId && modelSpec.supportsStyles) {
      request.styleId = assetItem.styleId;
    } else if (
      Array.isArray(assetItem.styleReferenceUrls)
      && assetItem.styleReferenceUrls.length > 0
      && modelSpec.supportsStyleReferences
    ) {
      request.styleReferenceUrls = assetItem.styleReferenceUrls.slice(0, 10);
    }

    const extension = modelSpec.supportsVector ? 'svg' : 'png';
    const safeAssetBase = String(assetItem.assetId || 'asset')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'asset';

    return {
      request,
      targetFilename: `${safeAssetBase}.${extension}`,
      traceability: {
        assetId: assetItem.assetId,
        sectionId: assetItem.sectionId,
        strategy: assetItem.strategy,
        model: modelSpec.id,
        promptTruncated: rawPrompt.length > maxLen,
        styleId: request.styleId || null,
        estimatedCredits: request.estimatedCredits,
      },
    };
  }
}
