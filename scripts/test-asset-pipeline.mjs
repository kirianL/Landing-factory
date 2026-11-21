#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AssetComposer } from './visual-engine/asset-composer.mjs';
import { GenerationCache } from './visual-engine/cache-manager.mjs';
import { loadEngineConfig } from './visual-engine/config.mjs';
import { ENGINE_MODES } from './visual-engine/contracts.mjs';
import { VisualAssetEngine } from './visual-engine/engine.mjs';
import { ImageOptimizer } from './visual-engine/optimizer.mjs';
import { GenerationPipeline } from './visual-engine/pipeline.mjs';
import {
  inspectImageBuffer,
  resolveSafeOutputPath,
  secureDownloadImage,
  validateDownloadUrl,
} from './visual-engine/security-validator.mjs';
import { writeBufferAtomic } from './visual-engine/atomic-fs.mjs';

function makeTempDir(prefix = 'lf-pipe-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Construye un PNG mínimo válido 16x16 con cabecera IHDR real
function makeValidPng(width = 16, height = 16) {
  const buf = Buffer.alloc(32, 0);
  // Signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  // IHDR length = 13
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

test('1. AssetComposer compone solicitudes respetando modelo, style_id y límite de prompt', () => {
  const dir = makeTempDir();
  try {
    const config = loadEngineConfig({ stateDir: dir }, {});
    const composer = new AssetComposer();

    // Prompt largo con recraftv3 (límite 1000) -> trunca limpiamente
    const longPrompt = 'word '.repeat(300);
    const composed = composer.composeRequest({
      config,
      projectId: 'p1',
      assetItem: {
        assetId: 'hero-main',
        sectionId: 'hero',
        shouldGenerate: true,
        strategy: 'GENERATE_WITH_STYLE_ID',
        model: 'recraftv3',
        dimensions: '1365x1024',
        styleId: 'sty_123',
        styleReferenceUrls: ['https://example.com/ref.png'], // recraftv3 no soporta style_reference_urls
        estimatedCredits: 40,
        brief: { prompt: longPrompt },
      },
    });

    assert.equal(composed.request.model, 'recraftv3');
    assert.ok(composed.request.prompt.length <= 1000);
    assert.equal(composed.request.styleId, 'sty_123');
    assert.equal(composed.request.styleReferenceUrls, undefined);
    assert.equal(composed.targetFilename, 'hero-main.png');
    assert.equal(composed.traceability.promptTruncated, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('2, 3, 4, 5, 6. Descarga segura: allowlist, firma binaria, MIME incorrecto, corruptos y límite de tamaño', async () => {
  const validPng = makeValidPng(640, 480);

  // Allowlist rechaza host externo o HTTP
  assert.throws(() => validateDownloadUrl('http://external.api.recraft.ai/img.png'), /Protocolo no permitido/);
  assert.throws(() => validateDownloadUrl('https://evil.example.com/img.png'), /fuera de allowlist/);

  // Descarga válida desde img.recraft.ai (CDN oficial de Recraft) con inspección real de dimensiones
  const okRes = await secureDownloadImage('https://img.recraft.ai/v1/images/ok.png', {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/png', 'content-length': String(validPng.length) }),
      async arrayBuffer() { return validPng; },
    }),
  });
  assert.equal(okRes.format, 'png');
  assert.equal(okRes.width, 640);
  assert.equal(okRes.height, 480);

  // MIME incorrecto (text/html)
  await assert.rejects(
    () => secureDownloadImage('https://external.api.recraft.ai/v1/images/bad.png', {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        async arrayBuffer() { return Buffer.from('<html></html>'); },
      }),
    }),
    (err) => err.code === 'INVALID_MIME_TYPE'
  );

  // Content-Type dice image/png pero el binario es basura corrupta
  await assert.rejects(
    () => secureDownloadImage('https://external.api.recraft.ai/v1/images/corrupt.png', {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        async arrayBuffer() { return Buffer.from('not-a-real-png-binary'); },
      }),
    }),
    (err) => err.code === 'INVALID_BINARY_SIGNATURE'
  );

  // SVG con <script> rechazado por seguridad
  assert.throws(
    () => inspectImageBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')),
    (err) => err.code === 'UNSAFE_SVG'
  );

  // Límite de tamaño
  await assert.rejects(
    () => secureDownloadImage('https://external.api.recraft.ai/v1/images/huge.png', {
      maxBytes: 10,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png', 'content-length': '32' }),
        async arrayBuffer() { return validPng; },
      }),
    }),
    (err) => err.code === 'FILE_TOO_LARGE'
  );
});

test('7 y 8. Protección contra path traversal y escrituras atómicas', () => {
  const dir = makeTempDir();
  try {
    assert.throws(() => resolveSafeOutputPath(dir, '../../secret.png'), { code: 'PATH_TRAVERSAL_BLOCKED' });
    assert.throws(() => resolveSafeOutputPath(dir, 'bad.exe'), { code: 'INVALID_EXTENSION' });

    const safe = resolveSafeOutputPath(dir, 'hero-main.png');
    assert.equal(safe, path.join(path.resolve(dir), 'hero-main.png'));

    const png = makeValidPng(100, 100);
    writeBufferAtomic(safe, png);
    assert.deepEqual(fs.readFileSync(safe), png);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('9. ImageOptimizer: passthrough validado sin sharp y soporte desacoplado con sharp mock', async () => {
  const png = makeValidPng(200, 100);

  // Sin sharp
  const optNoSharp = new ImageOptimizer({ sharpLoader: async () => null });
  const r1 = await optNoSharp.optimize(png);
  assert.equal(r1.optimized, false);
  assert.equal(r1.strategy, 'passthrough_validated');
  assert.equal(r1.width, 200);

  // Con sharp simulado que devuelve WebP
  const webpStub = Buffer.alloc(32, 0);
  webpStub.write('RIFF', 0, 'ascii');
  webpStub.write('WEBP', 8, 'ascii');
  webpStub.write('VP8X', 12, 'ascii');
  webpStub.writeUIntLE(199, 24, 3);
  webpStub.writeUIntLE(99, 27, 3);

  const mockSharp = () => ({
    resize() { return this; },
    webp() { return this; },
    async toBuffer() { return webpStub; },
  });

  const optWithSharp = new ImageOptimizer({ sharpLoader: async () => mockSharp });
  const r2 = await optWithSharp.optimize(png, { targetWidth: 200, targetHeight: 100 });
  assert.equal(r2.optimized, true);
  assert.equal(r2.format, 'webp');
  assert.equal(r2.strategy, 'sharp_webp');
});

test('10. GenerationCache: deduplicación, detección de archivo corrupto e invalidación', () => {
  const dir = makeTempDir();
  try {
    const cache = new GenerationCache({ stateDir: dir });
    const png = makeValidPng(32, 32);

    const k1 = GenerationCache.computeKey({
      prompt: '  Clean   studio   hero  ',
      model: 'recraftv4_1',
      size: '1024x1024',
      format: 'png',
    });
    const k2 = GenerationCache.computeKey({
      prompt: 'Clean studio hero',
      model: 'recraftv4_1',
      size: '1024x1024',
      format: 'png',
    });
    assert.equal(k1, k2);

    cache.put(k1, { buffer: png, format: 'png', mimeType: 'image/png', width: 32, height: 32, model: 'recraftv4_1' });
    const hit = cache.get(k1);
    assert.ok(hit);
    assert.equal(hit.width, 32);

    // Corromper blob en disco -> caché debe detectarlo e invalidar
    const blobPath = path.join(dir, 'cache', 'blobs', hit.blobFilename);
    fs.writeFileSync(blobPath, Buffer.from('corrupted-bytes'));
    const afterCorrupt = cache.get(k1);
    assert.equal(afterCorrupt, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('11, 12, 13, 14, 15. Pipeline completo (LIVE mock): concurrencia, errores parciales, cache hit, reutilización, presupuesto y FASE 2/3', async () => {
  const dir = makeTempDir();
  const projDir = path.join(dir, 'landing-demo');
  try {
    const pngHero = makeValidPng(1365, 1024);
    let postCalls = 0;

    const mockFetch = async (url, init = {}) => {
      if (url.endsWith('/images/generations')) {
        postCalls += 1;
        const body = JSON.parse(init.body);
        if (body.prompt.includes('FAIL_THIS_SECTION')) {
          return {
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            async text() { return JSON.stringify({ message: 'Simulated partial failure' }); },
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          async text() {
            return JSON.stringify({
              created: 1700000000,
              credits: 40,
              data: [{ url: 'https://external.api.recraft.ai/v1/images/hero-gen.png' }],
            });
          },
        };
      }
      if (url === 'https://external.api.recraft.ai/v1/images/hero-gen.png') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/png', 'content-length': String(pngHero.length) }),
          async arrayBuffer() { return pngHero; },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const engine = new VisualAssetEngine({
      stateDir: path.join(dir, 'state'),
      mode: ENGINE_MODES.LIVE,
      enabled: true,
      apiToken: 'rc_mock_token_123456',
      localBudgetLimit: 1000,
      fetchImpl: mockFetch,
    });

    const plan = engine.planLandingVisuals({
      projectId: 'landing-demo',
      sections: [
        { id: 'hero', type: 'hero', subjectHint: 'Architectural office' },
        { id: 'services', type: 'services', subjectHint: 'FAIL_THIS_SECTION' },
        { id: 'about', type: 'about' },
        { id: 'faq', type: 'faq' },
      ],
      existingAssets: [{ sectionId: 'about', path: '/images/existing-team.webp' }],
    });

    const pipeline = new GenerationPipeline({
      engine,
      fetchImpl: mockFetch,
      optimizer: new ImageOptimizer({ sharpLoader: async () => null }),
      concurrency: 2,
    });

    const m1 = await pipeline.execute(plan, { projectDir: projDir, useCache: true });

    // Error parcial en services no impide que hero se guarde ni que about se reutilice
    assert.equal(m1.summary.generated, 1);
    assert.equal(m1.summary.failed, 1);
    assert.equal(m1.summary.reusedLocal, 1);
    assert.equal(m1.summary.totalCreditsUsed, 40);
    assert.ok(fs.existsSync(path.join(projDir, 'public', 'images', 'hero-visual.png')));

    // Segunda ejecución sobre hero idéntico debe hacer CACHE_HIT sin volver a llamar a POST /images/generations para hero
    const callsBeforeSecond = postCalls;
    const planHeroOnly = engine.planLandingVisuals({
      projectId: 'landing-demo',
      sections: [{ id: 'hero', type: 'hero', subjectHint: 'Architectural office' }],
    });
    const m2 = await pipeline.execute(planHeroOnly, { projectDir: projDir, useCache: true });
    assert.equal(m2.summary.cacheHits, 1);
    assert.equal(m2.summary.totalCreditsUsed, 0);
    assert.equal(postCalls, callsBeforeSecond);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('16. FASE 8.1: Seguridad CDN img.recraft.ai (subdominios, puertos, redirects, dimensiones inválidas) y pipeline offline completo', async () => {
  const dir = makeTempDir();
  const projDir = path.join(dir, 'cdn-remediation-proj');
  try {
    const validPng = makeValidPng(1024, 1024);

    // Subdominio no autorizado y puerto inesperado bloqueados
    assert.throws(() => validateDownloadUrl('https://sub.img.recraft.ai/a.png'), { code: 'UNTRUSTED_DOWNLOAD_HOST' });
    assert.throws(() => validateDownloadUrl('https://img.recraft.ai.evil.com/a.png'), { code: 'UNTRUSTED_DOWNLOAD_HOST' });
    assert.throws(() => validateDownloadUrl('https://img.recraft.ai:8443/a.png'), { code: 'UNSAFE_DOWNLOAD_PORT' });
    assert.throws(() => validateDownloadUrl('https://user:pass@img.recraft.ai/a.png'), { code: 'UNSAFE_DOWNLOAD_CREDENTIALS' });

    // PNG con dimensiones 0x0 inválidas -> CORRUPT_IMAGE
    const zeroDimPng = makeValidPng(0, 0);
    assert.throws(() => inspectImageBuffer(zeroDimPng), { code: 'CORRUPT_IMAGE' });

    // Redirección permitida dentro de allowlist (img.recraft.ai -> external.api.recraft.ai) sin encabezados sensibles
    let redirectHeadersSeen = [];
    const okRedirect = await secureDownloadImage('https://img.recraft.ai/start.png', {
      fetchImpl: async (url, init = {}) => {
        redirectHeadersSeen.push(init.headers || null);
        if (url === 'https://img.recraft.ai/start.png') {
          return {
            ok: false,
            status: 302,
            headers: new Headers({ location: 'https://external.api.recraft.ai/final.png' }),
            async arrayBuffer() { return Buffer.alloc(0); },
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/png', 'content-length': String(validPng.length) }),
          async arrayBuffer() { return validPng; },
        };
      },
    });
    assert.equal(okRedirect.format, 'png');
    assert.deepEqual(redirectHeadersSeen, [null, null]);

    // Cadena de redirecciones > maxRedirects -> TOO_MANY_REDIRECTS
    await assert.rejects(
      () => secureDownloadImage('https://img.recraft.ai/loop.png', {
        maxRedirects: 2,
        fetchImpl: async () => ({
          ok: false,
          status: 302,
          headers: new Headers({ location: 'https://img.recraft.ai/loop.png' }),
          async arrayBuffer() { return Buffer.alloc(0); },
        }),
      }),
      (err) => err.code === 'TOO_MANY_REDIRECTS'
    );

    // Recorrido offline integral: respuesta simulada con URL img.recraft.ai -> SecurityValidator -> SHA-256 -> caché -> asset final
    const mockFetch = async (url) => {
      if (url.endsWith('/images/generations')) {
        return {
          ok: true,
          status: 200,
          async text() {
            return JSON.stringify({
              created: 1700000000,
              credits: 7,
              data: [{ url: 'https://img.recraft.ai/generated/smoke-1024.png' }],
            });
          },
        };
      }
      if (url === 'https://img.recraft.ai/generated/smoke-1024.png') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/png', 'content-length': String(validPng.length) }),
          async arrayBuffer() { return validPng; },
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const engine = new VisualAssetEngine({
      stateDir: path.join(dir, 'state'),
      mode: ENGINE_MODES.LIVE,
      enabled: true,
      apiToken: 'rc_mock_offline_token_1234',
      fetchImpl: mockFetch,
    });
    const plan = engine.planLandingVisuals({
      projectId: 'cdn-remediation-proj',
      sections: [{ id: 'hero', type: 'hero', subjectHint: 'Minimalist studio' }],
    });
    const pipeline = new GenerationPipeline({
      engine,
      fetchImpl: mockFetch,
      optimizer: new ImageOptimizer({ sharpLoader: async () => null }),
    });
    const manifest = await pipeline.execute(plan, { projectDir: projDir, useCache: true });
    assert.equal(manifest.summary.generated, 1);
    const asset = manifest.results[0];
    assert.equal(asset.status, 'GENERATED');
    assert.ok(fs.existsSync(asset.filePath));
    assert.ok(engine.pipeline.cache.get(asset.cacheKey));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
