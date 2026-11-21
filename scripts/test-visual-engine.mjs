#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadEngineConfig, redactSecrets } from './visual-engine/config.mjs';
import { BudgetExceededError, DEFAULT_LOCAL_BUDGET, ENGINE_MODES, LEDGER_STATUS, OUTCOMES } from './visual-engine/contracts.mjs';
import { CreditManager } from './visual-engine/credit-manager.mjs';
import { VisualAssetEngine } from './visual-engine/engine.mjs';
import { RecraftProvider } from './visual-engine/providers/recraft-provider.mjs';
import { StyleRegistry } from './visual-engine/style-registry.mjs';

function makeTempDir(prefix = 'lf-visual-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createMockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    return handler(url, init, calls.length);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
  };
}

test('1. Configuración por defecto: DRY_RUN, presupuesto 1000, RECRAFT_API_TOKEN canónica', () => {
  const dir = makeTempDir();
  try {
    const cfgNoToken = loadEngineConfig({ stateDir: dir }, {});
    assert.equal(cfgNoToken.mode, ENGINE_MODES.DRY_RUN);
    assert.equal(cfgNoToken.localBudgetLimit, 1000);
    assert.equal(cfgNoToken.provider, 'recraft');
    assert.equal(cfgNoToken.hasApiToken, false);
    assert.equal(cfgNoToken.enabled, false);

    const cfgWithToken = loadEngineConfig({ stateDir: dir }, {
      RECRAFT_API_TOKEN: 'rc_test_secret_token_123456',
      VISUAL_ENGINE_ENABLED: 'true',
      VISUAL_ENGINE_MODE: 'LIVE',
    });
    assert.equal(cfgWithToken.hasApiToken, true);
    assert.equal(cfgWithToken.apiToken, 'rc_test_secret_token_123456');
    assert.equal(cfgWithToken.enabled, true);
    assert.equal(cfgWithToken.mode, ENGINE_MODES.LIVE);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('2. Modo DRY_RUN simula generación sin llamar a fetch ni consumir presupuesto', async () => {
  const dir = makeTempDir();
  try {
    const mockFetch = createMockFetch(() => {
      throw new Error('fetch NO debe ejecutarse en DRY_RUN');
    });

    const engine = new VisualAssetEngine({
      stateDir: dir,
      fetchImpl: mockFetch,
      apiToken: '',
    });

    const res = await engine.generateImage({
      projectId: 'demo-landing',
      agent: 'gemini-4-hydrogen',
      prompt: 'Editorial architectural office hero image',
      model: 'recraftv4_1',
    });

    assert.equal(res.ok, true);
    assert.equal(res.mode, ENGINE_MODES.DRY_RUN);
    assert.equal(res.outcome, OUTCOMES.DRY_RUN);
    assert.equal(res.creditsUsed, 0);
    assert.equal(mockFetch.calls.length, 0);

    const summary = engine.creditManager.getSummary('demo-landing');
    assert.equal(summary.global.usedCredits, 0);
    assert.equal(summary.global.remainingLocalBudget, DEFAULT_LOCAL_BUDGET);
    assert.equal(summary.project.dryRunSimulatedCredits, 35);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('3. RecraftProvider: GET /users/me y separación saldo real vs presupuesto local', async () => {
  const dir = makeTempDir();
  try {
    const mockFetch = createMockFetch((url) => {
      assert.equal(url, 'https://external.api.recraft.ai/v1/users/me');
      return jsonResponse({ id: 'usr_1', email: 'test@example.com', name: 'Test', credits: 4500 });
    });

    const engine = new VisualAssetEngine({
      stateDir: dir,
      apiToken: 'rc_live_token_abc123',
      fetchImpl: mockFetch,
    });

    const conn = await engine.testConnection();
    assert.equal(conn.ok, true);
    assert.equal(conn.account.initialAccountCredits, 4500);
    assert.equal(conn.account.lastKnownAccountCredits, 4500);

    const summary = engine.creditManager.getSummary();
    assert.equal(summary.localBudgetLimit, 1000);
    assert.equal(summary.account.initialAccountCredits, 4500);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('4. Modo LIVE con mock: prevalece credits de Recraft sobre estimación local', async () => {
  const dir = makeTempDir();
  try {
    const mockFetch = createMockFetch((url, init) => {
      if (url.endsWith('/images/generations')) {
        const body = JSON.parse(init.body);
        assert.equal(body.model, 'recraftv4_1');
        return jsonResponse({
          created: 1700000000,
          credits: 55, // Difiere de la estimación local (40): debe prevalecer 55
          data: [{ url: 'https://external.api.recraft.ai/v1/images/mock-1.png' }],
        });
      }
      throw new Error(`Endpoint inesperado: ${url}`);
    });

    const engine = new VisualAssetEngine({
      stateDir: dir,
      mode: ENGINE_MODES.LIVE,
      enabled: true,
      apiToken: 'rc_live_token_abc123',
      fetchImpl: mockFetch,
    });

    const res = await engine.generateImage({
      projectId: 'legal-site',
      prompt: 'Law firm conference room warm light',
      model: 'recraftv4_1',
    });

    assert.equal(res.outcome, OUTCOMES.SUCCESS);
    assert.equal(res.creditsUsed, 55);
    assert.equal(res.creditsSource, 'api');

    const summary = engine.creditManager.getSummary('legal-site');
    assert.equal(summary.global.usedCredits, 55);
    assert.equal(summary.global.reservedCredits, 0);
    assert.equal(summary.global.remainingLocalBudget, 945);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('5. Errores de autenticación (401), modelo inválido, rate limit (429) y respuesta inesperada', async () => {
  const dir = makeTempDir();
  try {
    // 401 Auth error
    const provider401 = new RecraftProvider({
      apiToken: 'rc_secret_bad_token',
      fetchImpl: createMockFetch(() => jsonResponse({ message: 'Invalid token rc_secret_bad_token' }, 401)),
    });
    await assert.rejects(
      () => provider401.generate({ prompt: 'test' }),
      (err) => err.code === 'AUTH_ERROR' && !err.message.includes('rc_secret_bad_token') && err.ambiguousOutcome === false
    );

    // Modelo inválido
    const engineInvalidModel = new VisualAssetEngine({ stateDir: dir, mode: ENGINE_MODES.LIVE, enabled: true, apiToken: 'tok' });
    await assert.rejects(
      () => engineInvalidModel.generateImage({ prompt: 'test', model: 'non-existent-model' }),
      (err) => err.code === 'INVALID_MODEL'
    );

    // 429 en GET reintenta hasta maxRetries y luego falla con RATE_LIMIT
    const get429Fetch = createMockFetch(() => jsonResponse({ message: 'Too many requests' }, 429));
    const provider429 = new RecraftProvider({ apiToken: 'tok', maxRetries: 2, fetchImpl: get429Fetch });
    await assert.rejects(() => provider429.getAccountInfo(), (err) => err.code === 'RATE_LIMIT');
    assert.equal(get429Fetch.calls.length, 3);

    // Respuesta inesperada en POST -> ambiguousOutcome = true
    const providerBadJson = new RecraftProvider({
      apiToken: 'tok',
      fetchImpl: createMockFetch(() => jsonResponse('not-valid-json', 200)),
    });
    await assert.rejects(
      () => providerBadJson.generate({ prompt: 'test' }),
      (err) => err.code === 'UNEXPECTED_RESPONSE' && err.ambiguousOutcome === true
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('6. Timeout / AbortController en POST marca UNKNOWN_OUTCOME y NO reintenta automáticamente', async () => {
  const dir = makeTempDir();
  try {
    const timeoutFetch = createMockFetch((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }));

    const engine = new VisualAssetEngine({
      stateDir: dir,
      mode: ENGINE_MODES.LIVE,
      enabled: true,
      apiToken: 'rc_live_token_abc123',
      timeoutMs: 30,
      maxRetries: 2,
      fetchImpl: timeoutFetch,
    });

    await assert.rejects(
      () => engine.generateImage({ projectId: 'p1', prompt: 'Hero photo', model: 'recraftv4_1' }),
      (err) => err.code === 'TIMEOUT' && err.ambiguousOutcome === true
    );

    // Nunca debe reintentar POST ante timeout ambiguo
    assert.equal(timeoutFetch.calls.length, 1);

    const ledger = engine.creditManager.listLedger('p1');
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].status, LEDGER_STATUS.UNKNOWN_OUTCOME);

    const summary = engine.creditManager.getSummary('p1');
    assert.equal(summary.global.unknownOutcomeCredits, 35);
    assert.equal(summary.global.remainingLocalBudget, 965);

    // Reintentar exactamente la misma solicitud debe quedar bloqueado por deduplicación de UNKNOWN_OUTCOME
    await assert.rejects(
      () => engine.generateImage({ projectId: 'p1', prompt: 'Hero photo', model: 'recraftv4_1' }),
      (err) => err instanceof BudgetExceededError
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('7. CreditManager: bloqueo por presupuesto y protección contra solicitudes concurrentes', async () => {
  const dir = makeTempDir();
  try {
    const cm = new CreditManager({ stateDir: dir, localBudgetLimit: 100 });

    // 3 reservas concurrentes de 40 créditos (total 120 > 100): máximo 2 pueden aprobarse
    const results = await Promise.allSettled([
      Promise.resolve().then(() => cm.reserve({ projectId: 'c1', operation: 'gen', estimatedCredits: 40 })),
      Promise.resolve().then(() => cm.reserve({ projectId: 'c1', operation: 'gen', estimatedCredits: 40 })),
      Promise.resolve().then(() => cm.reserve({ projectId: 'c1', operation: 'gen', estimatedCredits: 40 })),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length, 2);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof BudgetExceededError);

    const summary = cm.getSummary('c1');
    assert.equal(summary.global.reservedCredits, 80);
    assert.equal(summary.global.remainingLocalBudget, 20);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('8. StyleRegistry y ensureProjectStyle reutilizan style_id por proyecto sin duplicar POST /styles', async () => {
  const dir = makeTempDir();
  try {
    const mockFetch = createMockFetch((url) => {
      if (url.endsWith('/styles')) {
        return jsonResponse({ style_id: 'sty_uuid_999', created: 1700000001, credits: 5 });
      }
      throw new Error(`Unexpected ${url}`);
    });

    const engine = new VisualAssetEngine({
      stateDir: dir,
      mode: ENGINE_MODES.LIVE,
      enabled: true,
      apiToken: 'rc_live_token_abc123',
      fetchImpl: mockFetch,
    });

    const first = await engine.ensureProjectStyle({
      projectId: 'brand-a',
      baseStyle: 'digital_illustration',
      model: 'recraftv4_1',
      referenceIdentifiers: ['ref1.png', 'ref2.png'],
    });
    assert.equal(first.reused, false);
    assert.equal(first.style.styleId, 'sty_uuid_999');
    assert.equal(mockFetch.calls.length, 1);

    // Segunda llamada con mismas referencias (incluso en distinto orden) reutiliza el style_id
    const second = await engine.ensureProjectStyle({
      projectId: 'brand-a',
      baseStyle: 'digital_illustration',
      model: 'recraftv4_1',
      referenceIdentifiers: ['ref2.png', 'ref1.png'],
    });
    assert.equal(second.reused, true);
    assert.equal(second.style.styleId, 'sty_uuid_999');
    assert.equal(mockFetch.calls.length, 1);

    // Redacción de secretos verificada
    const cleaned = redactSecrets('Authorization: Bearer rc_live_token_abc123 RECRAFT_API_TOKEN=rc_live_token_abc123', ['rc_live_token_abc123']);
    assert.ok(!cleaned.includes('rc_live_token_abc123'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
