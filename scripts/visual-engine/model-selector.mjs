/**
 * ModelSelector — Selecciona el modelo óptimo leyendo exclusivamente
 * el catálogo configurable de config.modelsConfig (sin duplicar precios ni nombres).
 */

export class ModelSelector {
  /**
   * Selecciona el modelo más adecuado según tipo de recurso, calidad,
   * necesidad de referencias de estilo y presupuesto restante.
   */
  selectModel({ config, assetPlan, requiresStyleReferences = false, requiresStyleId = false, requiresImageToImage = false, remainingBudget = Infinity }) {
    const providerCfg = config?.modelsConfig?.providers?.[config.provider];
    if (!providerCfg?.models) {
      return {
        selected: false,
        reason: `No hay catálogo de modelos configurado para proveedor '${config?.provider}'`,
        modelId: null,
        estimatedCredits: 0,
      };
    }

    const wantsVector = assetPlan.assetType === 'vector_graphic';
    const qualityTier = assetPlan.qualityTier || 'standard';

    const candidates = Object.entries(providerCfg.models).map(([id, spec]) => ({
      id,
      ...spec,
    }));

    // 1. Filtrar por capacidades obligatorias
    const compatible = candidates.filter((m) => {
      if (wantsVector && !m.supportsVector) return false;
      if (!wantsVector && m.supportsVector) return false;
      if (requiresStyleId && !m.supportsStyles) return false;
      if (requiresStyleReferences && !m.supportsStyleReferences) return false;
      if (m.requiresStyleReference && !requiresStyleId && !requiresStyleReferences) return false;
      if (requiresImageToImage && !m.supportsImageToImage) return false;
      return true;
    });

    if (compatible.length === 0) {
      return {
        selected: false,
        reason: 'Ningún modelo configurado cumple con las capacidades requeridas (vector/referencias/imageToImage)',
        modelId: null,
        estimatedCredits: 0,
        incompatibleDetails: { wantsVector, requiresStyleId, requiresStyleReferences, requiresImageToImage },
      };
    }

    // 2. Filtrar por presupuesto restante
    const affordable = compatible.filter((m) => (m.estimatedCredits ?? 0) <= remainingBudget);
    if (affordable.length === 0) {
      const minCost = Math.min(...compatible.map((m) => m.estimatedCredits ?? Infinity));
      return {
        selected: false,
        reason: `Presupuesto insuficiente: mínimo requerido=${minCost}, disponible=${remainingBudget}`,
        modelId: null,
        estimatedCredits: minCost,
        budgetBlocked: true,
      };
    }

    // 3. Ordenar según calidad requerida priorizando economía cuando baste
    const ranked = [...affordable].sort((a, b) => {
      const costA = a.estimatedCredits ?? 999;
      const costB = b.estimatedCredits ?? 999;

      if (qualityTier === 'high') {
        // Para calidad alta (ej. Hero), preferir calidad estándar/pro si entra en presupuesto, evitando flash si hay mejor opción
        const scoreA = a.id.includes('pro') ? 3 : a.id.includes('flash') ? 1 : 2;
        const scoreB = b.id.includes('pro') ? 3 : b.id.includes('flash') ? 1 : 2;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return costA - costB;
      }

      if (qualityTier === 'economic') {
        return costA - costB;
      }

      // 'standard': equilibrado (preferir recraftv4_1 / v4 sobre pro costoso, o flash si es más económico)
      const isProA = a.id.includes('pro') ? 1 : 0;
      const isProB = b.id.includes('pro') ? 1 : 0;
      if (isProA !== isProB) return isProA - isProB;
      return costA - costB;
    });

    const chosen = ranked[0];
    return {
      selected: true,
      modelId: chosen.id,
      displayName: chosen.displayName,
      type: chosen.type,
      estimatedCredits: chosen.estimatedCredits,
      supportsStyleReferences: Boolean(chosen.supportsStyleReferences),
      supportsStyles: Boolean(chosen.supportsStyles),
      reason: `Seleccionado ${chosen.id} (tier=${qualityTier}, est=${chosen.estimatedCredits} créditos, restante=${remainingBudget})`,
    };
  }
}
