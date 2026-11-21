#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AGENT_PROFILES,
  classifyErrorMessage,
  loadState,
  saveState,
  mergeCandidateMetadata,
  scoreCandidate,
  sanitizeText,
} from './resolve-model-fallback.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, 'resolve-model-fallback.mjs');

function makeTempDir(prefix = 'lf-fallback-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(dir, name, data) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}

function runCli(args) {
  const stdout = execFileSync('node', [SCRIPT_PATH, ...args], { encoding: 'utf8' });
  return JSON.parse(stdout);
}

function createBaseCatalog(dir) {
  return writeJson(dir, 'cat-base.json', [
    { id: 'openrouter/google/gemma-4-31b-it:free', provider: 'openrouter', providerInstanceId: 'opencode_2', profiles: ['A', 'B', 'C'], inputModalities: ['text', 'image'], supportsVision: true, contextLength: 131072, freeStatus: 'verified_free' },
    { id: 'opencode/nemotron-3.5-super-vl-free', provider: 'opencode', providerInstanceId: 'opencode_2', profiles: ['A'], inputModalities: ['text', 'image'], supportsVision: true, contextLength: 131072, freeStatus: 'verified_free' },
    { id: 'opencode/beam-free', provider: 'opencode', providerInstanceId: 'opencode_2', profiles: ['B', 'C'], inputModalities: ['text'], supportsVision: false, contextLength: 131072, freeStatus: 'verified_free' },
    { id: 'opencode/deepseek-v4.1-flash-free', provider: 'opencode', providerInstanceId: 'opencode_2', profiles: ['B', 'C'], inputModalities: ['text'], supportsVision: false, contextLength: 131072, freeStatus: 'verified_free' },
    { id: 'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free', provider: 'openrouter', providerInstanceId: 'opencode_2', profiles: ['B', 'C'], inputModalities: ['text'], supportsVision: false, contextLength: 131072, freeStatus: 'verified_free' },
    { id: 'antigravity/gemini-3.8-flash', provider: 'antigravity', providerInstanceId: 'antigravity', profiles: ['A', 'B', 'C'], inputModalities: ['text', 'image'], supportsVision: true, contextLength: 1000000, freeStatus: 'included_in_session' },
    { id: 'openrouter/paid/gpt-pro', provider: 'openrouter', providerInstanceId: 'opencode_2', profiles: ['A', 'B', 'C'], inputModalities: ['text', 'image'], supportsVision: true, contextLength: 131072, freeStatus: 'paid' },
    { id: 'openrouter/unknown/mystery', provider: 'openrouter', providerInstanceId: 'opencode_2', profiles: ['A', 'B', 'C'], inputModalities: ['text', 'image'], supportsVision: true, contextLength: 131072, freeStatus: 'unknown' },
  ]);
}

// --- FASE 2: Recuperación post-cooldown ---
test('Fase 2: modelo en cooldown activo permanece excluido y al expirar recupera prioridad normal conservando historial', () => {
  const dir = makeTempDir();
  try {
    const cat = createBaseCatalog(dir);
    const now = Date.now();
    const stateActive = writeJson(dir, 'state-active.json', {
      models: {
        'openrouter/google/gemma-4-31b-it:free': {
          failures: 3,
          lastErrorType: 'quota_exhausted',
          lastFailedAt: new Date(now - 60_000).toISOString(),
          cooldownUntil: now + 300_000,
        },
      },
      providers: {},
    });

    const duringCooldown = runCli(['--agent', 'visual-analyst', '--state-file', stateActive, '--simulate-catalog', cat]);
    assert.equal(duringCooldown.selectedModel, 'opencode/nemotron-3.5-super-vl-free');

    // Cooldown expired, 5 historical failures preserved
    const stateExpired = writeJson(dir, 'state-expired.json', {
      models: {
        'openrouter/google/gemma-4-31b-it:free': {
          failures: 5,
          lastErrorType: 'quota_exhausted',
          lastFailedAt: new Date(now - 3_600_000).toISOString(),
          cooldownUntil: now - 1000,
        },
      },
      providers: {},
    });

    const afterCooldown = runCli(['--agent', 'visual-analyst', '--state-file', stateExpired, '--simulate-catalog', cat]);
    assert.equal(afterCooldown.action, 'USE_PRIMARY');
    assert.equal(afterCooldown.selectedModel, 'openrouter/google/gemma-4-31b-it:free');

    // History is preserved after recovery
    const persisted = loadState(stateExpired);
    assert.equal(persisted.models['openrouter/google/gemma-4-31b-it:free'].failures, 5);

    // No artificial boost over higher-priority candidate; independent provider penalty still applies
    const scorePrimary = scoreCandidate(
      { id: 'openrouter/google/gemma-4-31b-it:free', provider: 'openrouter', priority: 10, freeStatus: 'verified_free' },
      { profile: AGENT_PROFILES['visual-analyst'], failedProvider: 'openrouter', usedProviders: [], state: persisted, nowMs: now }
    );
    const scoreFallback = scoreCandidate(
      { id: 'opencode/nemotron-3.5-super-vl-free', provider: 'opencode', priority: 15, freeStatus: 'verified_free' },
      { profile: AGENT_PROFILES['visual-analyst'], failedProvider: 'openrouter', usedProviders: [], state: persisted, nowMs: now }
    );
    assert.ok(scoreFallback > scorePrimary, 'Independent provider penalty must still apply when failedProvider matches');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- FASE 3: Validación conjunta T3 y OpenCode ---
test('Fase 3: mergeCandidateMetadata valida conjuntamente OpenCode CLI y T3 capabilities', () => {
  const t3Caps = {
    providers: new Map([
      ['opencode_2', { providerInstanceId: 'opencode_2', canRunChildTask: true, models: [] }],
      ['antigravity', { providerInstanceId: 'antigravity', canRunChildTask: true, models: [{ id: 'gemini-3.8-flash' }] }],
      ['opencode', { providerInstanceId: 'opencode', canRunChildTask: false, constraints: ['Provider instance is disabled.'] }],
    ]),
  };

  // 1. Registered & live in OpenCode
  const live = mergeCandidateMetadata('openrouter/google/gemma-4-31b-it:free', {
    orMeta: null,
    registryModel: { provider: 'openrouter', providerInstanceId: 'opencode_2', freeStatus: 'verified_free', delegatable: true },
    t3Caps,
    isLiveInOpenCode: true,
    simulatedItem: null,
  });
  assert.equal(live.delegatable, true);

  // 2. Registered but absent from OpenCode (without T3)
  const missingNoT3 = mergeCandidateMetadata('openrouter/fake/missing:free', {
    orMeta: null,
    registryModel: { provider: 'openrouter', providerInstanceId: 'opencode_2', freeStatus: 'verified_free', delegatable: true },
    t3Caps: null,
    isLiveInOpenCode: false,
    simulatedItem: null,
  });
  assert.equal(missingNoT3.delegatable, false);

  // 3. Absent from OpenCode WITH T3 snapshot (must remain non-delegatable!)
  const missingWithT3 = mergeCandidateMetadata('openrouter/fake/missing:free', {
    orMeta: null,
    registryModel: { provider: 'openrouter', providerInstanceId: 'opencode_2', freeStatus: 'verified_free', delegatable: true },
    t3Caps,
    isLiveInOpenCode: false,
    simulatedItem: null,
  });
  assert.equal(missingWithT3.delegatable, false);

  // 4. Antigravity authorized independently of OpenCode
  const agOk = mergeCandidateMetadata('antigravity/gemini-3.8-flash', {
    orMeta: null,
    registryModel: { provider: 'antigravity', providerInstanceId: 'antigravity', freeStatus: 'included_in_session', delegatable: true },
    t3Caps,
    isLiveInOpenCode: false,
    simulatedItem: null,
  });
  assert.equal(agOk.delegatable, true);

  // 5. Disabled provider instance
  const disabled = mergeCandidateMetadata('opencode/beam-free', {
    orMeta: null,
    registryModel: { provider: 'opencode', providerInstanceId: 'opencode', freeStatus: 'verified_free', delegatable: true },
    t3Caps,
    isLiveInOpenCode: true,
    simulatedItem: null,
  });
  assert.equal(disabled.delegatable, false);

  // 6. Contradictory metadata: OpenRouter API says paid while local registry said verified_free
  const contradicted = mergeCandidateMetadata('openrouter/some/model:free', {
    orMeta: { freeStatus: 'paid', supportsVision: false, contextLength: 32768 },
    registryModel: { provider: 'openrouter', providerInstanceId: 'opencode_2', freeStatus: 'verified_free', delegatable: true },
    t3Caps,
    isLiveInOpenCode: true,
    simulatedItem: null,
  });
  assert.equal(contradicted.freeStatus, 'paid');
  assert.equal(contradicted.isFree, false);
});

// --- FASE 4: Escritura atómica del estado ---
test('Fase 4: escritura atómica, recuperación JSON corrupto, limpieza de .tmp y escrituras concurrentes', async () => {
  const dir = makeTempDir();
  try {
    const stateFile = path.join(dir, 'model-health-state.json');

    // 1. Normal write
    saveState(stateFile, { models: { 'm1': { failures: 1, lastFailedAt: '2026-11-21T00:00:00.000Z', cooldownUntil: 123 } }, providers: {} });
    assert.equal(loadState(stateFile).models.m1.failures, 1);

    // 2. Preserves previous valid state if write fails (simulate unserializable BigInt)
    assert.throws(() => {
      saveState(stateFile, { models: { bad: BigInt(1) }, providers: {} }, { mergeLatest: false });
    });
    assert.equal(loadState(stateFile).models.m1.failures, 1);

    // 3. Abandoned temp file cleanup (>60s old)
    const oldTmp = path.join(dir, '.tmp-model-health-state.json-999-old.json');
    fs.writeFileSync(oldTmp, '{"stale":true}', 'utf8');
    const past = new Date(Date.now() - 120_000);
    fs.utimesSync(oldTmp, past, past);
    loadState(stateFile);
    assert.equal(fs.existsSync(oldTmp), false);

    // 4. Corrupt JSON recovery
    const corruptFile = path.join(dir, 'corrupt.json');
    fs.writeFileSync(corruptFile, '{bad json', 'utf8');
    assert.deepEqual(loadState(corruptFile), { models: {}, providers: {} });

    // 5. Two concurrent CLI writes preserve both updates
    const cat = createBaseCatalog(dir);
    const concFile = path.join(dir, 'concurrent.json');
    await Promise.all([
      new Promise((resolve, reject) => {
        const c = spawn('node', [SCRIPT_PATH, '--agent', 'visual-analyst', '--error-type', 'rate_limit', '--failed-model', 'openrouter/google/gemma-4-31b-it:free', '--state-file', concFile, '--simulate-catalog', cat], { stdio: 'ignore' });
        c.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
      }),
      new Promise((resolve, reject) => {
        const c = spawn('node', [SCRIPT_PATH, '--agent', 'code-reviewer', '--error-type', 'quota_exhausted', '--failed-model', 'opencode/deepseek-v4.1-flash-free', '--state-file', concFile, '--simulate-catalog', cat], { stdio: 'ignore' });
        c.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
      }),
    ]);
    const merged = loadState(concFile);
    assert.ok(merged.models['openrouter/google/gemma-4-31b-it:free'], 'First concurrent update must persist');
    assert.ok(merged.models['opencode/deepseek-v4.1-flash-free'], 'Second concurrent update must persist');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- FASE 5: Clasificador opcional de errores ---
test('Fase 5: clasificador de errores con mensajes reales anonimizados y prioridad explícita', () => {
  // Real anonymized OpenCode quota error
  assert.equal(
    classifyErrorMessage('Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models.').errorType,
    'quota_exhausted'
  );
  // Real anonymized OpenRouter daily free limit error (contains "Rate limit exceeded" + "free-models-per-day" + "Add 10 credits")
  assert.equal(
    classifyErrorMessage('Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day.').errorType,
    'quota_exhausted'
  );
  assert.equal(classifyErrorMessage('HTTP 429 Too Many Requests: requests per minute exceeded').errorType, 'rate_limit');
  assert.equal(classifyErrorMessage('HTTP 403 Permission denied: canRunChildTask is false').errorType, 'permission_denied');
  assert.equal(classifyErrorMessage('HTTP 401 Unauthorized: invalid API key').errorType, 'auth');
  assert.equal(classifyErrorMessage('503 Service unavailable: model not found').errorType, 'unavailable');
  assert.equal(classifyErrorMessage('Request timed out after 15000ms (ECONNRESET)').errorType, 'transient');
  assert.equal(classifyErrorMessage('This model does not support image input').errorType, 'capability');
  // Must NOT classify generic "limit" as rate_limit
  assert.equal(classifyErrorMessage('Output reached character limit in summary').errorType, 'unknown');
  // Explicit error type overrides inference
  assert.equal(classifyErrorMessage('Request timed out', 'quota_exhausted').errorType, 'quota_exhausted');
  // Secret redaction
  const clean = sanitizeText('Bearer tok_abc.123 sk-1234567890abcdef api_key=mysecret');
  assert.ok(!clean.includes('tok_abc') && !clean.includes('1234567890abcdef') && !clean.includes('mysecret'));
});

// --- FASE 6: Regresión de los 15 escenarios de auditoría ---
test('Fase 6: regresión completa de escenarios E2E simulados', () => {
  const dir = makeTempDir();
  try {
    const cat = createBaseCatalog(dir);

    assert.equal(runCli(['--agent', 'visual-analyst', '--simulate-catalog', cat]).selectedModel, 'openrouter/google/gemma-4-31b-it:free');
    assert.equal(runCli(['--agent', 'visual-analyst', '--error-type', 'rate_limit', '--simulate-catalog', cat]).selectedModel, 'opencode/nemotron-3.5-super-vl-free');
    assert.equal(runCli(['--agent', 'code-reviewer', '--error-type', 'permission_denied', '--failed-model', 'opencode/deepseek-v4.1-flash-free', '--free-policy', 'allow-included', '--simulate-catalog', cat]).selectedModel, 'antigravity/gemini-3.8-flash');
    assert.equal(runCli(['--agent', 'visual-analyst', '--error-type', 'auth', '--simulate-catalog', cat]).action, 'STOP_AUTH_REQUIRED');

    const emptyCat = writeJson(dir, 'empty.json', []);
    assert.equal(runCli(['--agent', 'visual-analyst', '--simulate-catalog', emptyCat]).action, 'STOP_NO_COMPATIBLE_FREE_MODEL');

    const paidOnlyCat = writeJson(dir, 'paid.json', [
      { id: 'openrouter/paid/gpt-pro', provider: 'openrouter', providerInstanceId: 'opencode_2', profiles: ['A'], inputModalities: ['text', 'image'], supportsVision: true, contextLength: 131072, freeStatus: 'paid' },
      { id: 'openrouter/unknown/mystery', provider: 'openrouter', providerInstanceId: 'opencode_2', profiles: ['A'], inputModalities: ['text', 'image'], supportsVision: true, contextLength: 131072, freeStatus: 'unknown' },
    ]);
    assert.equal(runCli(['--agent', 'visual-analyst', '--simulate-catalog', paidOnlyCat]).action, 'STOP_NO_COMPATIBLE_FREE_MODEL');

    const includedOnlyCat = writeJson(dir, 'included.json', [
      { id: 'antigravity/gemini-3.8-flash', provider: 'antigravity', providerInstanceId: 'antigravity', profiles: ['A'], inputModalities: ['text', 'image'], supportsVision: true, contextLength: 1000000, freeStatus: 'included_in_session' },
    ]);
    assert.equal(runCli(['--agent', 'visual-analyst', '--free-policy', 'strict', '--simulate-catalog', includedOnlyCat]).action, 'STOP_NO_COMPATIBLE_FREE_MODEL');
    assert.equal(runCli(['--agent', 'visual-analyst', '--free-policy', 'allow-included', '--simulate-catalog', includedOnlyCat]).selectedModel, 'antigravity/gemini-3.8-flash');

    // Parallel diversity
    const p1 = runCli(['--agent', 'visual-analyst', '--simulate-catalog', cat]);
    const p2 = runCli(['--agent', 'code-reviewer', '--used-providers', p1.selectedMetadata.provider, '--simulate-catalog', cat]);
    assert.notEqual(p1.selectedMetadata.provider, p2.selectedMetadata.provider);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
