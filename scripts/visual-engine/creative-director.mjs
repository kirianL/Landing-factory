/**
 * CreativeDirector — Define la dirección artística por proyecto para asegurar
 * coherencia visual, evitar resultados genéricos y producir variaciones
 * originales a partir de referencias sin copiar composiciones literalmente.
 */

const INDUSTRY_PRESETS = {
  legal: {
    lighting: 'warm architectural daylight with subtle directional shadows',
    materials: 'walnut wood, brushed brass, matte stone, linen',
    realismLevel: 'high-craft editorial photography',
    mood: 'authoritative, calm, trustworthy',
  },
  saas: {
    lighting: 'clean studio softbox lighting with crisp rim highlights',
    materials: 'frosted glass, anodized aluminum, smooth matte surfaces',
    realismLevel: 'refined minimal studio aesthetic',
    mood: 'focused, modern, precise',
  },
  fintech: {
    lighting: 'balanced cool-to-neutral architectural light with high contrast clarity',
    materials: 'slate, brushed steel, subtle geometric glass',
    realismLevel: 'editorial architectural photography',
    mood: 'transparent, confident, structured',
  },
  default: {
    lighting: 'natural directional studio lighting with soft tonal transitions',
    materials: 'authentic tactile surfaces appropriate to the brand',
    realismLevel: 'authentic editorial craft',
    mood: 'coherent, intentional, uncluttered',
  },
};

export class CreativeDirector {
  /**
   * Construye la guía creativa unificada del proyecto.
   */
  buildCreativeDirection(context = {}) {
    const industryKey = String(context.industry || context.businessType || 'default').toLowerCase();
    const preset = Object.entries(INDUSTRY_PRESETS).find(([k]) => industryKey.includes(k))?.[1] || INDUSTRY_PRESETS.default;

    const palette = context.palette || {};
    const references = Array.isArray(context.references) ? context.references : [];

    return {
      projectId: context.projectId || 'default',
      brandName: context.brandName || context.projectId || 'Brand',
      industry: context.industry || context.businessType || 'general',
      audience: context.audience || 'decision makers',
      conversionGoal: context.conversionGoal || 'lead generation',
      visualIdentity: context.visualIdentity || 'minimalist editorial',
      palette: {
        canvas: palette.canvas || '#FAF9F6',
        surface: palette.surface || '#F2EFE9',
        primary: palette.primary || '#1A1A1A',
        accent: palette.accent || '#8C6D46',
      },
      lighting: context.lighting || preset.lighting,
      materialsAndTextures: context.materials || preset.materials,
      realismLevel: context.realismLevel || preset.realismLevel,
      mood: context.mood || preset.mood,
      compositionRules: {
        negativeSpace: 'preserve clean negative space for UI typography overlay or breathing room',
        framing: 'intentional asymmetrical or rule-of-thirds focal anchor',
        antiGenericGuard: 'avoid stock clichés, plastic skin, oversaturated neon, or cluttered backgrounds',
      },
      referenceGuidance: {
        hasReferences: references.length > 0,
        referenceCount: references.length,
        mode: references.length > 0 ? 'original_variation_preserving_style_language' : 'from_scratch',
        directive: references.length > 0
          ? 'Extract color harmony, lighting temperature, and surface language from references; compose an original scene without copying exact layout or third-party brand marks.'
          : 'Create an original composition anchored in the project visual identity.',
      },
    };
  }

  /**
   * Construye el prompt especializado y la política tipográfica para un recurso específico.
   */
  composeAssetBrief({ assetPlan, creativeDirection }) {
    const isPhotoOrBackground = ['conceptual_photo', 'editorial_composition', 'product_image', 'abstract_background'].includes(assetPlan.assetType);

    // Regla de precisión tipográfica:
    // No prohibir texto universalmente; evitar texto artificial en fotos/fondos/editorial,
    // permitirlo solo cuando el concepto gráfico/ilustrativo lo justifique.
    let typographyRule = 'exact UI copy, headlines, CTAs, and logos must be rendered in HTML/SVG code';
    let textDirective = '';
    if (assetPlan.allowTextInImage && assetPlan.textIntent === 'artistic') {
      textDirective = 'Integrated artistic typography is permitted only as part of the graphic illustration concept.';
    } else if (isPhotoOrBackground) {
      textDirective = 'Keep the scene free of artificial signs, watermarks, or overlaid UI text so HTML typography remains crisp.';
    }

    const subject = assetPlan.subjectHint
      || `${assetPlan.sectionType} visual for ${creativeDirection.brandName} (${creativeDirection.industry})`;

    const promptParts = [
      `${subject}.`,
      `Style & realism: ${creativeDirection.realismLevel}, ${creativeDirection.mood}.`,
      `Composition & framing: ${creativeDirection.compositionRules.framing}; ${creativeDirection.compositionRules.negativeSpace}.`,
      `Lighting & materials: ${creativeDirection.lighting}; textures of ${creativeDirection.materialsAndTextures}.`,
      `Color treatment: harmonize with canvas ${creativeDirection.palette.canvas}, primary ${creativeDirection.palette.primary}, accent ${creativeDirection.palette.accent}.`,
      creativeDirection.referenceGuidance.hasReferences
        ? 'Original composition inspired by the reference visual language, avoiding literal duplication.'
        : null,
      textDirective || null,
      `Avoid: ${creativeDirection.compositionRules.antiGenericGuard}.`,
    ].filter(Boolean);

    return {
      assetId: assetPlan.assetId,
      sectionId: assetPlan.sectionId,
      prompt: promptParts.join(' '),
      creativeNotes: {
        realismLevel: creativeDirection.realismLevel,
        lighting: creativeDirection.lighting,
        negativeSpace: creativeDirection.compositionRules.negativeSpace,
        referenceDirective: creativeDirection.referenceGuidance.directive,
        typographyRule,
      },
    };
  }
}
