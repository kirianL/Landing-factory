import crypto from 'node:crypto';
import path from 'node:path';
import { readJsonSafe, writeJsonAtomic } from './atomic-fs.mjs';
import { getModelSpec, loadEngineConfig } from './config.mjs';
import { ENGINE_MODES, OUTCOMES, VisualEngineError } from './contracts.mjs';
import { CreditManager } from './credit-manager.mjs';
import { EngineLogger } from './logger.mjs';
import { RecraftProvider } from './providers/recraft-provider.mjs';
import { StyleRegistry } from './style-registry.mjs';
import { VisualPlanner } from './visual-planner.mjs';
import { CreativeDirector } from './creative-director.mjs';
import { ModelSelector } from './model-selector.mjs';
import { GenerationStrategy } from './strategy.mjs';
import { GenerationPipeline } from './pipeline.mjs';

/**
 * VisualAssetEngine — Fachada modular de generación visual de LandingFactory.
 */
export class VisualAssetEngine {
  constructor(overrides = {}) {
    this.config = loadEngineConfig(overrides);
    this.logger = new EngineLogger({
      stateDir: this.config.stateDir,
      secretsToRedact: [this.config.apiToken],
    });
    this.creditManager = new CreditManager({
      stateDir: this.config.stateDir,
      localBudgetLimit: this.config.localBudgetLimit,
      logger: this.logger,
    });
    this.styleRegistry = new StyleRegistry({
      stateDir: this.config.stateDir,
    });
    this.visualPlanner = new VisualPlanner();
    this.creativeDirector = new CreativeDirector();
    this.modelSelector = new ModelSelector();
    this.strategy = new GenerationStrategy({
      modelSelector: this.modelSelector,
      styleRegistry: this.styleRegistry,
    });
    this.pipeline = new GenerationPipeline({
      engine: this,
      fetchImpl: overrides.fetchImpl,
    });
    this.provider = overrides.providerInstance || this._createProvider(overrides);
  }

  _createProvider(overrides = {}) {
    if (this.config.provider === 'recraft') {
      return new RecraftProvider({
        apiToken: this.config.apiToken,
        baseUrl: this.config.baseUrl,
        timeoutMs: this.config.timeoutMs,
        maxRetries: this.config.maxRetries,
        fetchImpl: overrides.fetchImpl || globalThis.fetch,
      });
    }
    throw new VisualEngineError(`Proveedor visual no soportado: ${this.config.provider}`, {
      code: 'UNSUPPORTED_PROVIDER',
    });
  }

  getStatus(projectId = null) {
    const providerValidation = this.provider.validateConfig();
    return {
      enabled: this.config.enabled,
      mode: this.config.mode,
      provider: this.provider.getName(),
      hasApiToken: this.config.hasApiToken,
      providerReady: providerValidation.ok,
      providerIssues: providerValidation.issues,
      stateDir: this.config.stateDir,
      credits: this.creditManager.getSummary(projectId),
    };
  }

  listAvailableModels() {
    const providerCfg = this.config.modelsConfig?.providers?.[this.config.provider];
    if (!providerCfg?.models) return [];
    return Object.entries(providerCfg.models).map(([id, spec]) => ({
      id,
      isDefault: id === providerCfg.defaultModel,
      ...spec,
    }));
  }

  /**
   * Planifica las necesidades visuales, dirección creativa, estrategia y modelos
   * para una landing page sin consumir créditos ni ejecutar llamadas LIVE.
   */
  planLandingVisuals(projectContext = {}) {
    const projectId = projectContext.projectId || 'default';
    const providerValidation = this.provider.validateConfig();
    const creditSummary = this.creditManager.getSummary(projectId);
    let simulatedRemainingBudget = creditSummary.global.remainingLocalBudget;

    const rawPlan = this.visualPlanner.plan(projectContext);
    const creativeDirection = this.creativeDirector.buildCreativeDirection(projectContext);
    const references = Array.isArray(projectContext.references) ? projectContext.references : [];

    const assets = rawPlan.items.map((item) => {
      const strategyDecision = this.strategy.decideForAsset({
        config: this.config,
        projectId,
        assetPlan: item,
        creativeDirection,
        references,
        remainingBudget: simulatedRemainingBudget,
      });

      if (strategyDecision.shouldGenerate) {
        simulatedRemainingBudget = Math.max(0, simulatedRemainingBudget - (strategyDecision.estimatedCredits || 0));
      }

      const brief = strategyDecision.shouldGenerate
        ? this.creativeDirector.composeAssetBrief({ assetPlan: item, creativeDirection })
        : null;

      return {
        ...item,
        strategy: strategyDecision.strategy,
        shouldGenerate: strategyDecision.shouldGenerate,
        model: strategyDecision.modelSelection?.modelId || null,
        estimatedCredits: strategyDecision.estimatedCredits || 0,
        styleId: strategyDecision.styleId || null,
        styleReferenceUrls: strategyDecision.styleReferenceUrls || null,
        budgetBlocked: Boolean(strategyDecision.budgetBlocked),
        reason: strategyDecision.reason,
        brief,
      };
    });

    const totalEstimatedCredits = assets.reduce((acc, a) => acc + (a.shouldGenerate ? a.estimatedCredits : 0), 0);

    const planResult = {
      projectId,
      mode: this.config.mode,
      provider: this.provider.getName(),
      providerAvailable: providerValidation.ok,
      providerIssues: providerValidation.issues,
      executionReady: this.config.enabled && providerValidation.ok,
      budget: {
        localBudgetLimit: creditSummary.localBudgetLimit,
        remainingBeforePlan: creditSummary.global.remainingLocalBudget,
        totalEstimatedCredits,
        remainingAfterPlan: simulatedRemainingBudget,
      },
      summary: rawPlan.summary,
      creativeDirection,
      assets,
    };

    const planPath = path.join(this.config.stateDir, 'plans', `${projectId}-plan.json`);
    writeJsonAtomic(planPath, planResult);

    this.logger.log('visual_plan.created', {
      projectId,
      totalSections: rawPlan.summary.totalSections,
      toGenerateCount: assets.filter((a) => a.shouldGenerate).length,
      totalEstimatedCredits,
      providerAvailable: providerValidation.ok,
    });

    return planResult;
  }

  /**
   * Recupera el estado visual guardado para /resume-landing (plan, manifiesto, estilos y créditos).
   */
  getProjectRecoveryState(projectId = 'default') {
    const planPath = path.join(this.config.stateDir, 'plans', `${projectId}-plan.json`);
    const manifestPath = path.join(this.config.stateDir, 'manifests', `${projectId}-assets.json`);
    return {
      projectId,
      plan: readJsonSafe(planPath, null),
      manifest: readJsonSafe(manifestPath, null),
      styles: this.styleRegistry.listProjectStyles(projectId),
      credits: this.creditManager.getSummary(projectId),
    };
  }

  /**
   * Ejecuta un plan visual a través del Asset Pipeline (descarga, validación, optimización, caché y guardado).
   */
  async executeVisualPlan(plan, options = {}) {
    return this.pipeline.execute(plan, options);
  }

  /**
   * Consulta GET /users/me para verificar conexión y sincronizar saldo real de Recraft.
   * Es de solo lectura y no consume créditos.
   */
  async testConnection({ signal = null } = {}) {
    const accountInfo = await this.provider.getAccountInfo({ signal });
    const accountState = this.creditManager.recordAccountBalance(accountInfo);
    this.logger.log('provider.connection_verified', {
      provider: this.provider.getName(),
      accountCredits: accountInfo.credits,
    });
    return {
      ok: true,
      provider: this.provider.getName(),
      account: accountState,
    };
  }

  /**
   * Obtiene o crea un estilo reutilizable para el proyecto.
   * En DRY_RUN devuelve una simulación sin consumir créditos.
   */
  async ensureProjectStyle({ projectId = 'default', baseStyle = null, model = null, referenceIdentifiers = [], files = [], signal = null } = {}) {
    const referenceKey = StyleRegistry.computeReferenceKey({
      baseStyle: baseStyle || '',
      model: model || '',
      referenceIdentifiers,
    });

    const existing = this.styleRegistry.findReusableStyle(projectId, referenceKey);
    if (existing) {
      this.logger.log('style.reused', { projectId, styleId: existing.styleId, referenceKey });
      return { reused: true, mode: this.config.mode, style: existing };
    }

    const estimatedCredits = this.config.modelsConfig?.providers?.[this.config.provider]?.styleCreationEstimatedCredits ?? 5;

    if (this.config.mode === ENGINE_MODES.DRY_RUN) {
      const simId = `dry_style_${referenceKey}`;
      this.creditManager.recordDryRun({
        projectId,
        operation: 'create_style',
        estimatedCredits,
        model: model || 'style',
        generationId: simId,
      });
      return {
        reused: false,
        mode: ENGINE_MODES.DRY_RUN,
        style: {
          projectId,
          styleId: simId,
          baseStyle,
          model,
          referenceKey,
          creditsUsed: 0,
          simulated: true,
        },
      };
    }

    if (!this.config.enabled) {
      throw new VisualEngineError('Visual Asset Engine está deshabilitado (VISUAL_ENGINE_ENABLED=false) para llamadas LIVE', {
        code: 'ENGINE_DISABLED',
      });
    }

    const reservation = this.creditManager.reserve({
      projectId,
      operation: 'create_style',
      estimatedCredits,
      model: model || 'style',
    });

    try {
      const res = await this.provider.createStyle({ style: baseStyle, files }, { signal });
      this.creditManager.reconcile({
        reservationId: reservation.reservationId,
        outcome: 'SUCCESS',
        apiCredits: res.credits,
      });
      const saved = this.styleRegistry.saveStyle({
        projectId,
        styleId: res.styleId,
        baseStyle,
        model,
        referenceKey,
        creditsUsed: res.credits ?? estimatedCredits,
      });
      return { reused: false, mode: ENGINE_MODES.LIVE, style: saved, creditsUsed: res.credits };
    } catch (err) {
      const isAmbiguous = Boolean(err?.ambiguousOutcome);
      this.creditManager.reconcile({
        reservationId: reservation.reservationId,
        outcome: isAmbiguous ? 'UNKNOWN_OUTCOME' : 'FAILED',
        note: err.message,
      });
      throw err;
    }
  }

  /**
   * Genera una imagen pasando obligatoriamente por CreditManager.
   */
  async generateImage(request, { signal = null } = {}) {
    const start = Date.now();
    const projectId = request?.projectId || 'default';
    const generationId = `gen_${crypto.randomUUID()}`;
    const modelSpec = getModelSpec(this.config, request?.model);

    if (!modelSpec) {
      throw new VisualEngineError(`Modelo inválido o no registrado para ${this.config.provider}: ${request?.model}`, {
        code: 'INVALID_MODEL',
      });
    }

    if (!request?.prompt || typeof request.prompt !== 'string' || !request.prompt.trim()) {
      throw new VisualEngineError('El prompt es obligatorio para generar una imagen', {
        code: 'INVALID_REQUEST',
      });
    }

    const n = Number(request.n || 1);
    const estimatedCredits = Number(request.estimatedCredits ?? (modelSpec.estimatedCredits * n));

    this.logger.log('generation.requested', {
      generationId,
      projectId,
      agent: request.agent || 'unknown',
      model: modelSpec.id,
      mode: this.config.mode,
      estimatedCredits,
    });

    if (this.config.mode === ENGINE_MODES.DRY_RUN) {
      this.creditManager.recordDryRun({
        projectId,
        operation: 'image_generation',
        estimatedCredits,
        model: modelSpec.id,
        generationId,
      });
      return {
        ok: true,
        mode: ENGINE_MODES.DRY_RUN,
        outcome: OUTCOMES.DRY_RUN,
        generationId,
        provider: this.provider.getName(),
        model: modelSpec.id,
        creditsUsed: 0,
        estimatedCredits,
        creditsSource: 'dry_run',
        images: [
          {
            url: `dry-run://${projectId}/${generationId}.${modelSpec.supportsVector ? 'svg' : 'png'}`,
            simulated: true,
          },
        ],
        durationMs: Date.now() - start,
      };
    }

    if (!this.config.enabled) {
      throw new VisualEngineError('Visual Asset Engine está deshabilitado (VISUAL_ENGINE_ENABLED=false) para llamadas LIVE', {
        code: 'ENGINE_DISABLED',
      });
    }

    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        projectId,
        prompt: request.prompt,
        model: modelSpec.id,
        size: request.size || modelSpec.defaultSize,
        styleId: request.styleId || null,
        style: request.style || null,
      }))
      .digest('hex')
      .slice(0, 16);

    const reservation = this.creditManager.reserve({
      projectId,
      operation: 'image_generation',
      estimatedCredits,
      model: modelSpec.id,
      generationId,
      requestHash,
    });

    try {
      const res = await this.provider.generate(
        {
          prompt: request.prompt,
          model: modelSpec.id,
          size: request.size || modelSpec.defaultSize,
          style: request.style,
          substyle: request.substyle,
          styleId: request.styleId,
          styleReferenceUrls: request.styleReferenceUrls,
          responseFormat: request.responseFormat,
          n,
        },
        { signal }
      );

      const reconciled = this.creditManager.reconcile({
        reservationId: reservation.reservationId,
        outcome: 'SUCCESS',
        apiCredits: res.credits,
      });

      this.logger.log('generation.completed', {
        generationId,
        projectId,
        model: modelSpec.id,
        creditsUsed: reconciled.actualCredits,
        creditsSource: reconciled.creditsSource,
        durationMs: Date.now() - start,
      });

      return {
        ok: true,
        mode: ENGINE_MODES.LIVE,
        outcome: OUTCOMES.SUCCESS,
        generationId,
        provider: this.provider.getName(),
        model: modelSpec.id,
        creditsUsed: reconciled.actualCredits,
        creditsSource: reconciled.creditsSource,
        images: res.images,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const isAmbiguous = Boolean(err?.ambiguousOutcome);
      const outcome = isAmbiguous ? OUTCOMES.UNKNOWN_OUTCOME : OUTCOMES.FAILED;

      this.creditManager.reconcile({
        reservationId: reservation.reservationId,
        outcome: isAmbiguous ? 'UNKNOWN_OUTCOME' : 'FAILED',
        note: err.message,
      });

      this.logger.log('generation.failed', {
        generationId,
        projectId,
        model: modelSpec.id,
        outcome,
        code: err.code || 'ERROR',
        durationMs: Date.now() - start,
      });

      throw err;
    }
  }
}
