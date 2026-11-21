import { StyleRegistry } from './style-registry.mjs';

/**
 * GenerationStrategy — Decide cómo producir cada recurso del plan:
 *  - REUSE_LOCAL
 *  - USE_CODE_SVG_OR_CSS
 *  - GENERATE_WITH_STYLE_ID
 *  - GENERATE_WITH_REFERENCES
 *  - GENERATE_INDEPENDENT
 *  - SKIP
 */
export class GenerationStrategy {
  constructor({ modelSelector, styleRegistry } = {}) {
    this.modelSelector = modelSelector;
    this.styleRegistry = styleRegistry;
  }

  decideForAsset({
    config,
    projectId,
    assetPlan,
    creativeDirection,
    references = [],
    remainingBudget,
  }) {
    if (assetPlan.decision === 'REUSE_EXISTING') {
      return {
        strategy: 'REUSE_LOCAL',
        shouldGenerate: false,
        estimatedCredits: 0,
        reason: `Reutilizar recurso existente en ${assetPlan.existingAssetPath}`,
      };
    }

    if (assetPlan.decision === 'USE_SVG_OR_CSS') {
      return {
        strategy: 'USE_CODE_SVG_OR_CSS',
        shouldGenerate: false,
        estimatedCredits: 0,
        reason: assetPlan.purpose,
      };
    }

    if (assetPlan.decision === 'SKIP' || !assetPlan.needsVisual) {
      return {
        strategy: 'SKIP',
        shouldGenerate: false,
        estimatedCredits: 0,
        reason: assetPlan.purpose || 'No aporta valor visual necesario',
      };
    }

    const hasReferences = references.length > 0;
    const refIdentifiers = references.map((r) => (typeof r === 'string' ? r : (r.id || r.url || r.path || 'ref')));
    const refUrls = references
      .map((r) => (typeof r === 'string' ? r : r.url))
      .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u));

    const projectStyles = this.styleRegistry ? this.styleRegistry.listProjectStyles(projectId) : [];
    const refKey = StyleRegistry.computeReferenceKey({
      baseStyle: creativeDirection.visualIdentity,
      model: '',
      referenceIdentifiers: refIdentifiers,
    });
    const reusableStyle = projectStyles.find((s) => s.referenceKey === refKey) || projectStyles[0] || null;

    // Seleccionar modelo intentando primero soportar style_id o referencias si existen
    let selection = this.modelSelector.selectModel({
      config,
      assetPlan,
      requiresStyleId: Boolean(reusableStyle),
      requiresStyleReferences: !reusableStyle && refUrls.length > 0,
      remainingBudget,
    });

    // Si falló únicamente por incompatibilidad de style_reference_urls, degradar a generación independiente con nota explícita
    let fallbackFromRefs = false;
    if (!selection.selected && !selection.budgetBlocked && refUrls.length > 0) {
      selection = this.modelSelector.selectModel({
        config,
        assetPlan,
        requiresStyleId: false,
        requiresStyleReferences: false,
        remainingBudget,
      });
      fallbackFromRefs = selection.selected;
    }

    if (!selection.selected) {
      return {
        strategy: 'SKIP',
        shouldGenerate: false,
        estimatedCredits: selection.estimatedCredits || 0,
        budgetBlocked: Boolean(selection.budgetBlocked),
        reason: selection.reason,
      };
    }

    if (reusableStyle) {
      return {
        strategy: 'GENERATE_WITH_STYLE_ID',
        shouldGenerate: true,
        styleId: reusableStyle.styleId,
        modelSelection: selection,
        estimatedCredits: selection.estimatedCredits,
        reason: `Reutiliza style_id=${reusableStyle.styleId} del proyecto con ${selection.modelId}`,
      };
    }

    if (hasReferences && refUrls.length > 0 && !fallbackFromRefs) {
      return {
        strategy: 'GENERATE_WITH_REFERENCES',
        shouldGenerate: true,
        styleReferenceUrls: refUrls.slice(0, 10),
        modelSelection: selection,
        estimatedCredits: selection.estimatedCredits,
        reason: `Usa referencias de estilo (${refUrls.length}) con ${selection.modelId}`,
      };
    }

    return {
      strategy: 'GENERATE_INDEPENDENT',
      shouldGenerate: true,
      modelSelection: selection,
      estimatedCredits: selection.estimatedCredits,
      reason: fallbackFromRefs
        ? `Modelo incompatible con style_reference_urls; generación independiente guiada por brief creativo (${selection.modelId})`
        : `Generación independiente con ${selection.modelId}`,
    };
  }
}
