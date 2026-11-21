#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ENGINE_MODES, LEDGER_STATUS } from './visual-engine/contracts.mjs';
import { VisualAssetEngine } from './visual-engine/engine.mjs';
import { ImageOptimizer } from './visual-engine/optimizer.mjs';
import { GenerationPipeline } from './visual-engine/pipeline.mjs';
import { inspectImageBuffer, secureDownloadImage } from './visual-engine/security-validator.mjs';
import {
  ensureGitignore,
  isExcludedInternal,
  MANDATORY_GITIGNORE_RULES,
  scanSecrets,
} from './publish-landing.mjs';

function makeTempDir(prefix = 'lf-e2e-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeValidPng(width = 1365, height = 1024) {
  const buf = Buffer.alloc(32, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

test('E2E 1 y 2: /build-landing en DRY_RUN (con recursos simulados y sin necesidad de imágenes)', async () => {
  const dir = makeTempDir();
  const projDir = path.join(dir, 'temp-landing');
  try {
    const engine = new VisualAssetEngine({
      stateDir: path.join(dir, 'state'),
      fetchImpl: () => { throw new Error('No debe llamar red en DRY_RUN'); },
    });

    // 1. Con secciones que requieren visuales (simulado)
    const planWithVisuals = engine.planLandingVisuals({
      projectId: 'temp-landing',
      businessType: 'fintech',
      sections: [
        { id: 'hero', type: 'hero' },
        { id: 'pricing', type: 'pricing' },
        { id: 'faq', type: 'faq' },
      ],
    });
    const manifest1 = await engine.executeVisualPlan(planWithVisuals, { projectDir: projDir });
    assert.equal(manifest1.mode, ENGINE_MODES.DRY_RUN);
    assert.equal(manifest1.summary.dryRunSimulated, 1);
    assert.equal(manifest1.summary.totalCreditsUsed, 0);
    // Archivos simulados NO se escriben como imágenes reales en public/images/
    assert.equal(fs.existsSync(path.join(projDir, 'public', 'images', 'hero-visual.png')), false);

    // 2. Landing puramente estructural sin necesidad de generar imágenes
    const planNoImages = engine.planLandingVisuals({
      projectId: 'temp-landing-text',
      sections: ['features', 'pricing', 'faq', 'icons', 'footer'],
    });
    const manifest2 = await engine.executeVisualPlan(planNoImages, { projectDir: projDir });
    assert.equal(manifest2.summary.dryRunSimulated, 0);
    assert.equal(manifest2.summary.generated, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('E2E 3, 4, 5, 6: /modify-landing incremental (solo texto vs 1 recurso), reutilización y caché', async () => {
  const dir = makeTempDir();
  const projDir = path.join(dir, 'landing-mod');
  try {
    const pngHero = makeValidPng(1365, 1024);
    const pngSvc = makeValidPng(1024, 1024);
    let genCalls = 0;

    const mockFetch = async (url, init = {}) => {
      if (url.endsWith('/images/generations')) {
        genCalls += 1;
        const body = JSON.parse(init.body);
        const imgName = body.prompt.includes('Hero v2') ? 'hero2.png' : 'hero1.png';
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              created: 1700000000,
              credits: 35,
              data: [{ url: `https://external.api.recraft.ai/v1/images/${imgName}` }],
            });
          },
        };
      }
      if (url.startsWith('https://external.api.recraft.ai/v1/images/')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/png', 'content-length': String(pngHero.length) }),
          async arrayBuffer() { return url.endsWith('hero2.png') ? pngHero : pngSvc; },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const engine = new VisualAssetEngine({
      stateDir: path.join(dir, 'state'),
      mode: ENGINE_MODES.LIVE,
      enabled: true,
      apiToken: 'rc_mock_e2e_token_987654',
      fetchImpl: mockFetch,
    });
    engine.pipeline = new GenerationPipeline({
      engine,
      fetchImpl: mockFetch,
      optimizer: new ImageOptimizer({ sharpLoader: async () => null }),
    });

    // Build inicial: hero generado, about reutilizado
    fs.mkdirSync(path.join(projDir, 'public', 'images'), { recursive: true });
    fs.writeFileSync(path.join(projDir, 'public', 'images', 'team.png'), pngSvc);

    const buildPlan = engine.planLandingVisuals({
      projectId: 'landing-mod',
      sections: [
        { id: 'hero', type: 'hero', subjectHint: 'Hero v1' },
        { id: 'about', type: 'about' },
      ],
      existingAssets: [{ sectionId: 'about', path: '/images/team.png' }],
    });
    const buildManifest = await engine.executeVisualPlan(buildPlan, { projectDir: projDir });
    assert.equal(buildManifest.summary.generated, 1);
    assert.equal(buildManifest.summary.reusedLocal, 1);
    const callsAfterBuild = genCalls;

    // 3. /modify-landing solo texto: reutiliza existingAssets, 0 generaciones
    const modifyTextPlan = engine.planLandingVisuals({
      projectId: 'landing-mod',
      sections: [
        { id: 'hero', type: 'hero' },
        { id: 'about', type: 'about' },
      ],
      existingAssets: [
        { sectionId: 'hero', path: '/images/hero-visual.png' },
        { sectionId: 'about', path: '/images/team.png' },
      ],
    });
    const modifyTextManifest = await engine.executeVisualPlan(modifyTextPlan, { projectDir: projDir });
    assert.equal(modifyTextManifest.summary.reusedLocal, 2);
    assert.equal(modifyTextManifest.summary.generated, 0);
    assert.equal(genCalls, callsAfterBuild);

    // 4. /modify-landing cambiando solo hero (forceRegenerate: true), about sigue intacto
    const modifyHeroPlan = engine.planLandingVisuals({
      projectId: 'landing-mod',
      sections: [
        { id: 'hero', type: 'hero', subjectHint: 'Hero v2', forceRegenerate: true },
        { id: 'about', type: 'about' },
      ],
      existingAssets: [
        { sectionId: 'hero', path: '/images/hero-visual.png' },
        { sectionId: 'about', path: '/images/team.png' },
      ],
    });
    const modifyHeroManifest = await engine.executeVisualPlan(modifyHeroPlan, { projectDir: projDir });
    assert.equal(modifyHeroManifest.summary.generated, 1);
    assert.equal(modifyHeroManifest.summary.reusedLocal, 1);

    // 6. Repetir Hero v2 usa caché (0 créditos)
    const repeatHeroPlan = engine.planLandingVisuals({
      projectId: 'landing-mod',
      sections: [{ id: 'hero', type: 'hero', subjectHint: 'Hero v2' }],
    });
    const repeatManifest = await engine.executeVisualPlan(repeatHeroPlan, { projectDir: projDir });
    assert.equal(repeatManifest.summary.cacheHits, 1);
    assert.equal(repeatManifest.summary.totalCreditsUsed, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('E2E 7 y 8: /resume-landing recupera estado, omite completados y bloquea UNKNOWN_OUTCOME', async () => {
  const dir = makeTempDir();
  const projDir = path.join(dir, 'landing-resume');
  try {
    const png = makeValidPng(1024, 1024);
    let modeBehavior = 'fail_services_timeout';

    const mockFetch = async (url, init = {}) => {
      if (url.endsWith('/images/generations')) {
        const body = JSON.parse(init.body);
        if (body.prompt.includes('ServicesTimeout') && modeBehavior === 'fail_services_timeout') {
          return new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
              const e = new Error('Timeout');
              e.name = 'AbortError';
              reject(e);
            });
          });
        }
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              created: 1700000000,
              credits: 20,
              data: [{ url: 'https://external.api.recraft.ai/v1/images/ok.png' }],
            });
          },
        };
      }
      if (url === 'https://external.api.recraft.ai/v1/images/ok.png') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/png', 'content-length': String(png.length) }),
          async arrayBuffer() { return png; },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const engine = new VisualAssetEngine({
      stateDir: path.join(dir, 'state'),
      mode: ENGINE_MODES.LIVE,
      enabled: true,
      apiToken: 'rc_mock_resume_token_1234',
      timeoutMs: 30,
      fetchImpl: mockFetch,
    });
    engine.pipeline = new GenerationPipeline({
      engine,
      fetchImpl: mockFetch,
      optimizer: new ImageOptimizer({ sharpLoader: async () => null }),
      concurrency: 1,
    });

    const plan = engine.planLandingVisuals({
      projectId: 'landing-resume',
      sections: [
        { id: 'hero', type: 'hero', subjectHint: 'HeroOk' },
        { id: 'services', type: 'services', subjectHint: 'ServicesTimeout' },
      ],
    });

    const firstRun = await engine.executeVisualPlan(plan, { projectDir: projDir, useCache: false });
    assert.equal(firstRun.summary.generated, 1);
    assert.equal(firstRun.summary.unknownOutcome, 1);

    // Recuperar estado con getProjectRecoveryState (/resume-landing)
    const recovered = engine.getProjectRecoveryState('landing-resume');
    assert.ok(recovered.plan);
    assert.ok(recovered.manifest);
    assert.equal(recovered.credits.global.unknownOutcomeCredits, 7);

    // Reanudar: hero completado se omite (resumed: true), services en UNKNOWN_OUTCOME queda bloqueado sin reenvío
    modeBehavior = 'would_succeed_if_called';
    const resumedRun = await engine.executeVisualPlan(recovered.plan, {
      projectDir: projDir,
      useCache: false,
      resumeFromPrevious: true,
    });
    const heroRes = resumedRun.results.find((r) => r.assetId === 'hero-visual');
    const svcRes = resumedRun.results.find((r) => r.assetId === 'services-visual');
    assert.equal(heroRes.resumed, true);
    assert.equal(heroRes.status, 'GENERATED');
    assert.equal(svcRes.status, 'UNKNOWN_OUTCOME_BLOCKED');
    assert.equal(engine.creditManager.getSummary('landing-resume').global.usedCredits, 20);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('E2E 9, 10, 11: publish-landing excluye internos, conserva public/images y detecta RECRAFT_API_TOKEN', () => {
  const dir = makeTempDir();
  try {
    // 9 y 10: exclusión de internos vs conservación de imágenes legítimas
    assert.equal(isExcludedInternal('.visual-engine-state/credit-state.json'), true);
    assert.equal(isExcludedInternal('docs/design/visual-credit-state.json'), true);
    assert.equal(isExcludedInternal('docs/design/visual-engine-log.jsonl'), true);
    assert.equal(isExcludedInternal('docs/design/visual-plan.json'), true);
    assert.equal(isExcludedInternal('public/images/hero-visual.png'), false);
    assert.equal(isExcludedInternal('src/App.tsx'), false);
    assert.ok(MANDATORY_GITIGNORE_RULES.includes('.visual-engine-state/'));

    const gi = ensureGitignore(dir, true);
    assert.equal(fs.existsSync(gi.path), true);

    // 11: detección de RECRAFT_API_TOKEN como secreto
    const leakyFile = path.join(dir, 'src', 'config.ts');
    fs.mkdirSync(path.dirname(leakyFile), { recursive: true });
    fs.writeFileSync(leakyFile, 'export const token = "RECRAFT_API_TOKEN=rc_live_secret_token_999999";', 'utf8');
    const findings = scanSecrets([{ full: leakyFile, rel: 'src/config.ts' }]);
    assert.ok(findings.length >= 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('E2E 12: seguridad en redirecciones de descarga y sanitización SVG estricta', async () => {
  // Redirect hacia host fuera de allowlist debe ser bloqueado
  await assert.rejects(
    () => secureDownloadImage('https://external.api.recraft.ai/v1/images/start.png', {
      fetchImpl: async () => ({
        ok: false,
        status: 302,
        headers: new Headers({ location: 'https://untrusted-attacker.example.com/payload.png' }),
        async arrayBuffer() { return Buffer.alloc(0); },
      }),
    }),
    (err) => err.code === 'UNTRUSTED_DOWNLOAD_HOST'
  );

  // SVG con foreignObject o javascript: rechazado
  assert.throws(
    () => inspectImageBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject></foreignObject></svg>')),
    (err) => err.code === 'UNSAFE_SVG'
  );
  assert.throws(
    () => inspectImageBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)">x</a></svg>')),
    (err) => err.code === 'UNSAFE_SVG'
  );
});
