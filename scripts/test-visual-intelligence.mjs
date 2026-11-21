#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { VisualAssetEngine } from './visual-engine/engine.mjs';
import { VisualPlanner } from './visual-engine/visual-planner.mjs';
import { CreativeDirector } from './visual-engine/creative-director.mjs';
import { ModelSelector } from './visual-engine/model-selector.mjs';
import { loadEngineConfig } from './visual-engine/config.mjs';

function makeTempDir(prefix = 'lf-vi-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('1. VisualPlanner identifica recursos necesarios e innecesarios (evita FAQ, pricing, iconos UI)', () => {
  const planner = new VisualPlanner();
  const plan = planner.plan({
    projectId: 'acme-saas',
    sections: [
      { id: 'hero', type: 'hero' },
      { id: 'features', type: 'features' },
      { id: 'icons', type: 'icons' },
      { id: 'pricing', type: 'pricing' },
      { id: 'faq', type: 'faq' },
      { id: 'about', type: 'about' },
      { id: 'cta', type: 'cta' },
    ],
    existingAssets: [{ sectionId: 'about', path: 'public/images/team.webp' }],
  });

  const byId = Object.fromEntries(plan.items.map((i) => [i.sectionId, i]));
  assert.equal(byId.hero.decision, 'GENERATE');
  assert.equal(byId.about.decision, 'REUSE_EXISTING');
  assert.equal(byId.features.decision, 'USE_SVG_OR_CSS');
  assert.equal(byId.icons.decision, 'USE_SVG_OR_CSS');
  assert.equal(byId.pricing.decision, 'SKIP');
  assert.equal(byId.faq.decision, 'SKIP');
  assert.equal(byId.cta.decision, 'SKIP');
  assert.equal(plan.summary.toGenerateCount, 1);
  assert.equal(plan.summary.reusedCount, 1);
  assert.equal(plan.summary.omittedCount, 5);
});

test('2 y 3. Generación de planes visuales válidos y coherencia de dirección creativa', () => {
  const dir = makeTempDir();
  try {
    const engine = new VisualAssetEngine({
      stateDir: dir,
      fetchImpl: () => { throw new Error('No debe hacer llamadas de red en planificación'); },
    });

    const result = engine.planLandingVisuals({
      projectId: 'legal-firm',
      brandName: 'MP Legal',
      industry: 'legal corporate',
      audience: 'general counsel',
      palette: { canvas: '#F8F6F2', primary: '#1E242B', accent: '#9A7B4F' },
      sections: [
        { id: 'hero', type: 'hero', subjectHint: 'Boardroom architectural view' },
        { id: 'services', type: 'services', subjectHint: 'Corporate contract review desk' },
        { id: 'faq', type: 'faq' },
      ],
    });

    assert.equal(result.mode, 'DRY_RUN');
    assert.equal(result.creativeDirection.palette.accent, '#9A7B4F');

    const hero = result.assets.find((a) => a.sectionId === 'hero');
    const services = result.assets.find((a) => a.sectionId === 'services');
    assert.equal(hero.shouldGenerate, true);
    assert.equal(services.shouldGenerate, true);
    assert.ok(hero.brief.prompt.includes('#9A7B4F'));
    assert.ok(services.brief.prompt.includes('#9A7B4F'));
    assert.ok(hero.brief.prompt.includes('free of artificial signs'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('4. Variaciones originales desde referencias y regla flexible de texto en imagen', () => {
  const cd = new CreativeDirector();
  const direction = cd.buildCreativeDirection({
    projectId: 'studio-x',
    industry: 'saas',
    references: [{ id: 'ref-1', url: 'https://example.com/ref1.png' }],
  });

  assert.equal(direction.referenceGuidance.hasReferences, true);
  assert.equal(direction.referenceGuidance.mode, 'original_variation_preserving_style_language');

  // Gráfico con tipografía artística permitida vs foto sin texto artificial
  const artisticGraphic = cd.composeAssetBrief({
    assetPlan: {
      assetId: 'badge-art',
      sectionId: 'services',
      sectionType: 'services',
      assetType: 'illustration',
      allowTextInImage: true,
      textIntent: 'artistic',
    },
    creativeDirection: direction,
  });
  assert.ok(artisticGraphic.prompt.includes('Original composition inspired by the reference'));
  assert.ok(artisticGraphic.prompt.includes('Integrated artistic typography is permitted'));
});

test('5, 6 y 7. ModelSelector: vector vs raster, economía, presupuesto e incompatibilidad con referencias', () => {
  const dir = makeTempDir();
  try {
    const config = loadEngineConfig({ stateDir: dir }, {});
    const selector = new ModelSelector();

    // Recurso vectorial -> elige modelo vector
    const vec = selector.selectModel({
      config,
      assetPlan: { assetType: 'vector_graphic', qualityTier: 'standard' },
      remainingBudget: 1000,
    });
    assert.equal(vec.selected, true);
    assert.equal(vec.type, 'vector');

    // Recurso económico -> prioriza modelo más barato (recraftv4_1_flash_v2 = 7)
    const eco = selector.selectModel({
      config,
      assetPlan: { assetType: 'conceptual_photo', qualityTier: 'economic' },
      remainingBudget: 1000,
    });
    assert.equal(eco.selected, true);
    assert.equal(eco.modelId, 'recraftv4_1_flash_v2');

    // Restricción de presupuesto: con 25 créditos restantes, no elige pro (250) ni v4_1 (35), baja a flash_v2 (7)
    const lowBudget = selector.selectModel({
      config,
      assetPlan: { assetType: 'conceptual_photo', qualityTier: 'high' },
      remainingBudget: 25,
    });
    assert.equal(lowBudget.selected, true);
    assert.equal(lowBudget.modelId, 'recraftv4_1_flash_v2');

    // Presupuesto insuficiente (5 < 20) -> bloqueado limpiamente
    const noBudget = selector.selectModel({
      config,
      assetPlan: { assetType: 'conceptual_photo', qualityTier: 'standard' },
      remainingBudget: 5,
    });
    assert.equal(noBudget.selected, false);
    assert.equal(noBudget.budgetBlocked, true);

    // Con referencias de estilo -> no debe elegir recraftv4_1_flash_v2 (no soporta estilos), debe elegir recraftv4_1 (35)
    const withRefs = selector.selectModel({
      config,
      assetPlan: { assetType: 'conceptual_photo', qualityTier: 'economic' },
      requiresStyleReferences: true,
      remainingBudget: 1000,
    });
    assert.equal(withRefs.selected, true);
    assert.equal(withRefs.modelId, 'recraftv4_1');

    // Sin referencias -> no debe elegir recraftv4_styles (que exige style_reference_urls/style_id)
    const stylesOnlyCfg = structuredClone(config);
    stylesOnlyCfg.modelsConfig.providers.recraft.models = {
      recraftv4_styles: config.modelsConfig.providers.recraft.models.recraftv4_styles,
    };
    const noRefForStyles = selector.selectModel({
      config: stylesOnlyCfg,
      assetPlan: { assetType: 'conceptual_photo', qualityTier: 'standard' },
      requiresStyleReferences: false,
      requiresStyleId: false,
      remainingBudget: 1000,
    });
    assert.equal(noRefForStyles.selected, false);

    // Modelo incompatible con style_reference_urls en config personalizada solo con recraftv3
    const v3OnlyConfig = structuredClone(config);
    v3OnlyConfig.modelsConfig.providers.recraft.models = {
      recraftv3: config.modelsConfig.providers.recraft.models.recraftv3,
    };
    const incompatible = selector.selectModel({
      config: v3OnlyConfig,
      assetPlan: { assetType: 'conceptual_photo', qualityTier: 'standard' },
      requiresStyleReferences: true,
      remainingBudget: 1000,
    });
    assert.equal(incompatible.selected, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('8 y 9. Funciona en planificación DRY_RUN sin proveedor disponible y reutiliza style_id de FASE 2 sin duplicar lógica', () => {
  const dir = makeTempDir();
  try {
    const engine = new VisualAssetEngine({ stateDir: dir, apiToken: '' });

    // Pre-registrar un style_id en StyleRegistry de FASE 2
    engine.styleRegistry.saveStyle({
      projectId: 'proj-styles',
      styleId: 'sty_existing_123',
      baseStyle: 'minimalist editorial',
      model: 'recraftv4_1',
      referenceKey: 'k1',
    });

    const plan = engine.planLandingVisuals({
      projectId: 'proj-styles',
      sections: [{ id: 'hero', type: 'hero' }],
      references: [{ id: 'r1', url: 'https://example.com/r1.png' }],
    });

    assert.equal(plan.providerAvailable, false);
    assert.equal(plan.executionReady, false);
    const hero = plan.assets[0];
    assert.equal(hero.strategy, 'GENERATE_WITH_STYLE_ID');
    assert.equal(hero.styleId, 'sty_existing_123');
    // Verifica que no consumió créditos reales
    assert.equal(engine.creditManager.getSummary('proj-styles').global.usedCredits, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
