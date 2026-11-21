/**
 * VisualPlanner — Analiza el contexto y secciones de una landing page
 * para determinar qué recursos visuales son necesarios, cuáles deben
 * resolverse con código/SVG y cuáles deben omitirse.
 */

const SECTION_RULES = {
  hero: {
    defaultNeed: true,
    decision: 'GENERATE',
    purpose: 'Composición visual principal que ancla la propuesta de valor above-the-fold',
    assetType: 'conceptual_photo',
    aspectRatio: '16:9',
    dimensions: '1365x1024',
    priority: 'critical',
    qualityTier: 'high',
  },
  about: {
    defaultNeed: true,
    decision: 'GENERATE',
    purpose: 'Imagen contextual que humaniza o da credibilidad a la marca/equipo',
    assetType: 'editorial_composition',
    aspectRatio: '4:3',
    dimensions: '1365x1024',
    priority: 'high',
    qualityTier: 'standard',
  },
  services: {
    defaultNeed: true,
    decision: 'GENERATE',
    purpose: 'Recurso visual específico para ilustrar el servicio o producto principal',
    assetType: 'product_image',
    aspectRatio: '4:3',
    dimensions: '1024x1024',
    priority: 'medium',
    qualityTier: 'standard',
  },
  features: {
    defaultNeed: false,
    decision: 'USE_SVG_OR_CSS',
    purpose: 'Tarjetas de características resueltas con iconografía SVG y layout tipográfico',
    assetType: 'vector_graphic',
    aspectRatio: '1:1',
    dimensions: '1024x1024',
    priority: 'low',
    qualityTier: 'economic',
  },
  benefits: {
    defaultNeed: false,
    decision: 'USE_SVG_OR_CSS',
    purpose: 'Beneficios comunicados con jerarquía tipográfica e iconos SVG',
    assetType: 'vector_graphic',
    aspectRatio: '1:1',
    dimensions: '1024x1024',
    priority: 'low',
    qualityTier: 'economic',
  },
  testimonials: {
    defaultNeed: false,
    decision: 'SKIP',
    purpose: 'Prueba social textual; no generar retratos sintéticos salvo solicitud explícita',
    assetType: 'conceptual_photo',
    aspectRatio: '1:1',
    dimensions: '1024x1024',
    priority: 'low',
    qualityTier: 'economic',
  },
  pricing: {
    defaultNeed: false,
    decision: 'SKIP',
    purpose: 'Tabla comparativa estructural; las imágenes distraen de la conversión',
    assetType: 'abstract_background',
    aspectRatio: '16:9',
    dimensions: '1024x1024',
    priority: 'low',
    qualityTier: 'economic',
  },
  faq: {
    defaultNeed: false,
    decision: 'SKIP',
    purpose: 'Acordeón textual; no requiere recursos gráficos generados',
    assetType: 'abstract_background',
    aspectRatio: '16:9',
    dimensions: '1024x1024',
    priority: 'low',
    qualityTier: 'economic',
  },
  cta: {
    defaultNeed: false,
    decision: 'SKIP',
    purpose: 'Llamado a la acción; solo generar fondo/recurso si aporta valor visual explícito',
    assetType: 'abstract_background',
    aspectRatio: '16:9',
    dimensions: '1365x1024',
    priority: 'low',
    qualityTier: 'economic',
  },
  footer: {
    defaultNeed: false,
    decision: 'USE_SVG_OR_CSS',
    purpose: 'Pie de página estructural con enlaces y logotipo SVG',
    assetType: 'vector_graphic',
    aspectRatio: '1:1',
    dimensions: '1024x1024',
    priority: 'low',
    qualityTier: 'economic',
  },
  icons: {
    defaultNeed: false,
    decision: 'USE_SVG_OR_CSS',
    purpose: 'Regla LandingFactory: toda iconografía UI debe ser SVG nativo en código',
    assetType: 'vector_graphic',
    aspectRatio: '1:1',
    dimensions: '1024x1024',
    priority: 'low',
    qualityTier: 'economic',
  },
};

export class VisualPlanner {
  /**
   * Analiza el contexto de la landing y produce un plan estructurado por sección.
   */
  plan(context = {}) {
    const projectId = context.projectId || 'default';
    const sections = Array.isArray(context.sections) && context.sections.length > 0
      ? context.sections
      : [{ id: 'hero', type: 'hero' }];

    const existingAssets = Array.isArray(context.existingAssets) ? context.existingAssets : [];
    const items = [];

    for (const rawSection of sections) {
      const section = typeof rawSection === 'string'
        ? { id: rawSection, type: rawSection }
        : rawSection;

      const type = String(section.type || section.id || 'custom').toLowerCase();
      const rule = SECTION_RULES[type] || {
        defaultNeed: Boolean(section.requiresVisual),
        decision: section.requiresVisual ? 'GENERATE' : 'SKIP',
        purpose: section.purpose || 'Sección de contenido',
        assetType: section.assetType || 'conceptual_photo',
        aspectRatio: section.aspectRatio || '4:3',
        dimensions: section.dimensions || '1024x1024',
        priority: section.priority || 'medium',
        qualityTier: section.qualityTier || 'standard',
      };

      const matchingExisting = existingAssets.find(
        (a) => (a.sectionId && a.sectionId === section.id) || (a.id && section.assetId && a.id === section.assetId)
      );

      // Si es icono UI, siempre forzar SVG en código (nunca raster generado)
      const isUiIcon = type === 'icons' || section.isUiIcon === true;
      let needsVisual = isUiIcon ? false : (section.requiresVisual ?? rule.defaultNeed);
      let decision = isUiIcon ? 'USE_SVG_OR_CSS' : (section.requiresVisual === true ? 'GENERATE' : rule.decision);

      if (matchingExisting && !section.forceRegenerate) {
        needsVisual = true;
        decision = 'REUSE_EXISTING';
      } else if (!needsVisual && decision === 'GENERATE') {
        decision = 'SKIP';
      }

      items.push({
        assetId: section.assetId || `${section.id || type}-visual`,
        sectionId: section.id || type,
        sectionType: type,
        needsVisual,
        decision,
        purpose: section.purpose || rule.purpose,
        assetType: section.assetType || rule.assetType,
        aspectRatio: section.aspectRatio || rule.aspectRatio,
        dimensions: section.dimensions || rule.dimensions,
        priority: section.priority || rule.priority,
        qualityTier: section.qualityTier || rule.qualityTier,
        existingAssetPath: matchingExisting?.path || null,
        allowTextInImage: Boolean(section.allowTextInImage),
        textIntent: section.textIntent || 'none',
        subjectHint: section.subjectHint || null,
      });
    }

    const toGenerateCount = items.filter((i) => i.decision === 'GENERATE').length;
    const reusedCount = items.filter((i) => i.decision === 'REUSE_EXISTING').length;
    const omittedCount = items.filter((i) => i.decision === 'SKIP' || i.decision === 'USE_SVG_OR_CSS').length;

    return {
      projectId,
      analyzedAt: new Date().toISOString(),
      summary: {
        totalSections: items.length,
        toGenerateCount,
        reusedCount,
        omittedCount,
      },
      items,
    };
  }
}
