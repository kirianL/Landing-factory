#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REGISTRY_PATH = path.join(__dirname, 'model-registry.json');

/**
 * Multi-Provider Intelligent Model Fallback Resolver for LandingFactory
 *
 * Discovers available models across:
 *   A. OpenCode CLI (`opencode models`) + OpenRouter public API metadata
 *   B. T3 Code / Antigravity capabilities snapshot (`orchestrator_capabilities`)
 *   C. Local verifiable registry (`scripts/model-registry.json`)
 *
 * Evaluates capability profiles, delegation permissions, verified-free policy,
 * provider independence, and recent failure cooldowns.
 */

const AGENT_PROFILES = {
  'visual-analyst': {
    profile: 'A',
    profileName: 'Análisis visual y multimodal',
    primaryModel: 'openrouter/google/gemma-4-31b-it:free',
    requiresVisionByDefault: true,
    minContextLength: 32768,
    preferredCandidates: [
      'openrouter/google/gemma-4-31b-it:free',
      'opencode/nemotron-3.5-super-vl-free',
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'openrouter/nvidia/nemotron-3.5-super-vl:free',
      'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/openrouter/free',
      'antigravity/gemini-3.8-flash',
    ],
  },
  'ui-ux-designer': {
    profile: 'A',
    profileName: 'Análisis visual y multimodal',
    primaryModel: 'openrouter/google/gemma-4-31b-it:free',
    requiresVisionByDefault: true,
    minContextLength: 32768,
    preferredCandidates: [
      'openrouter/google/gemma-4-31b-it:free',
      'opencode/nemotron-3.5-super-vl-free',
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'openrouter/nvidia/nemotron-3.5-super-vl:free',
      'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/openrouter/free',
      'antigravity/gemini-3.8-flash',
    ],
  },
  'asset-researcher': {
    profile: 'A',
    profileName: 'Análisis visual y multimodal',
    primaryModel: 'openrouter/google/gemma-4-31b-it:free',
    requiresVisionByDefault: true,
    minContextLength: 32768,
    preferredCandidates: [
      'openrouter/google/gemma-4-31b-it:free',
      'opencode/nemotron-3.5-super-vl-free',
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'openrouter/nvidia/nemotron-3.5-super-vl:free',
      'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/openrouter/free',
      'antigravity/gemini-3.8-flash',
    ],
  },
  'visual-qa': {
    profile: 'A',
    profileName: 'Análisis visual y multimodal',
    primaryModel: 'openrouter/google/gemma-4-31b-it:free',
    requiresVisionByDefault: true,
    minContextLength: 32768,
    preferredCandidates: [
      'openrouter/google/gemma-4-31b-it:free',
      'opencode/nemotron-3.5-super-vl-free',
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'openrouter/nvidia/nemotron-3.5-super-vl:free',
      'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/openrouter/free',
      'antigravity/gemini-3.8-flash',
    ],
  },
  'implementation-planner': {
    profile: 'B',
    profileName: 'Planificación y razonamiento',
    primaryModel: 'opencode/beam-free',
    requiresVisionByDefault: false,
    minContextLength: 65536,
    preferredCandidates: [
      'opencode/beam-free',
      'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free',
      'opencode/deepseek-v4.1-flash-free',
      'opencode/flint-40b-free',
      'openrouter/google/gemma-4-31b-it:free',
      'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/openrouter/free',
      'antigravity/gemini-3.8-flash',
    ],
  },
  'code-reviewer': {
    profile: 'C',
    profileName: 'Revisión técnica y código',
    primaryModel: 'opencode/deepseek-v4.1-flash-free',
    requiresVisionByDefault: false,
    minContextLength: 65536,
    preferredCandidates: [
      'opencode/deepseek-v4.1-flash-free',
      'opencode/flint-40b-free',
      'opencode/beam-free',
      'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free',
      'openrouter/google/gemma-4-31b-it:free',
      'openrouter/openrouter/free',
      'antigravity/gemini-3.8-flash',
    ],
  },
};

const COOLDOWN_MS = {
  transient: 2 * 60 * 1000,
  rate_limit: 5 * 60 * 1000,
  quota_exhausted: 30 * 60 * 1000,
  unavailable: 15 * 60 * 1000,
  capability: 60 * 60 * 1000,
  permission_denied: 60 * 60 * 1000,
};

const VALID_ERROR_TYPES = new Set([
  'none',
  'transient',
  'rate_limit',
  'quota_exhausted',
  'unavailable',
  'capability',
  'permission_denied',
  'auth',
  'unknown',
]);

function parseArgs(argv) {
  const opts = {
    agent: null,
    requiresVision: null,
    exclude: [],
    failedModel: null,
    failedProvider: null,
    usedProviders: [],
    errorType: 'none',
    errorMessage: null,
    classifyOnly: false,
    attempt: 1,
    offline: false,
    simulateCatalog: null,
    registryPath: DEFAULT_REGISTRY_PATH,
    t3CapabilitiesPath: null,
    stateFile: null,
    freePolicy: 'strict', // strict | allow-included | any
    logFile: null,
    executionResult: 'pending',
    listAll: false,
    discover: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--agent' || arg === '-a') opts.agent = argv[++i];
    else if (arg === '--requires-vision') opts.requiresVision = argv[++i] === 'true';
    else if (arg === '--exclude') {
      opts.exclude = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg === '--failed-model') opts.failedModel = argv[++i] || null;
    else if (arg === '--failed-provider') opts.failedProvider = argv[++i] || null;
    else if (arg === '--used-providers') {
      opts.usedProviders = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg === '--error-type') opts.errorType = argv[++i] || 'none';
    else if (arg === '--error-message') opts.errorMessage = argv[++i] || '';
    else if (arg === '--classify-error') opts.classifyOnly = true;
    else if (arg === '--attempt') opts.attempt = Number(argv[++i] || '1');
    else if (arg === '--offline') opts.offline = true;
    else if (arg === '--simulate-catalog') opts.simulateCatalog = path.resolve(argv[++i]);
    else if (arg === '--registry') opts.registryPath = path.resolve(argv[++i]);
    else if (arg === '--t3-capabilities') opts.t3CapabilitiesPath = path.resolve(argv[++i]);
    else if (arg === '--state-file') opts.stateFile = path.resolve(argv[++i]);
    else if (arg === '--free-policy') opts.freePolicy = argv[++i] || 'strict';
    else if (arg === '--log-file') opts.logFile = path.resolve(argv[++i]);
    else if (arg === '--result') opts.executionResult = argv[++i] || 'pending';
    else if (arg === '--list-free') opts.listAll = true;
    else if (arg === '--discover') opts.discover = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Uso:
  node resolve-model-fallback.mjs --agent <nombre> [opciones]

Opciones:
  --agent, -a <nombre>         Especialista: visual-analyst, ui-ux-designer, asset-researcher, implementation-planner, visual-qa, code-reviewer
  --requires-vision <bool>     Fuerza requisito multimodal (true/false). Por defecto según perfil del agente.
  --exclude <m1,m2>            Modelos a excluir por fallo en esta ejecución.
  --failed-model <id>          Modelo concreto que falló (si difiere del principal).
  --failed-provider <prov>     Proveedor que falló (prioriza independencia de proveedor).
  --used-providers <p1,p2>     Proveedores ya asignados en paralelo (mejora diversidad).
  --error-type <tipo>          none | transient | rate_limit | quota_exhausted | unavailable | capability | permission_denied | auth | unknown
  --error-message <texto>      Mensaje de error crudo para clasificación automática opcional (si --error-type es none/unknown).
  --classify-error             Clasifica --error-message y devuelve JSON sin seleccionar modelo.
  --attempt <n>                Número de intento actual sobre el modelo principal (default: 1)
  --free-policy <politica>     strict (default, solo verified_free) | allow-included (permite Antigravity incluido) | any
  --registry <ruta>            Registro local JSON (default: scripts/model-registry.json)
  --t3-capabilities <json>     Snapshot JSON de orchestrator_capabilities para validar permisos reales de T3 Code.
  --state-file <json>          Archivo de estado/cooldown de fallos recientes (ej. docs/design/model-health-state.json).
  --offline                    No consultar API pública de OpenRouter; usar catálogo local + registro.
  --simulate-catalog <json>    Archivo JSON con catálogo simulado para pruebas controladas.
  --log-file <ruta>            Archivo Markdown donde registrar el evento (ej. docs/design/model-fallback-log.md).
  --result <estado>            Estado de resultado para el log.
  --list-free                  Lista todos los modelos gratuitos verificados y sus capacidades.
  --discover                   Muestra el diagnóstico completo de descubrimiento multiproveedor.
`);
}

function inferProviderFromId(modelId) {
  if (!modelId) return 'unknown';
  if (modelId.startsWith('openrouter/')) return 'openrouter';
  if (modelId.startsWith('opencode/')) return 'opencode';
  if (modelId.startsWith('antigravity/')) return 'antigravity';
  if (modelId.startsWith('google/')) return 'google';
  return modelId.split('/')[0] || 'unknown';
}

function loadRegistry(registryPath) {
  if (!registryPath || !fs.existsSync(registryPath)) {
    return { providers: {}, models: new Map() };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const models = new Map();
    for (const item of raw.models || []) {
      if (item?.id) models.set(item.id, item);
    }
    return { providers: raw.providers || {}, models };
  } catch {
    return { providers: {}, models: new Map() };
  }
}

function loadT3Capabilities(t3Path) {
  if (!t3Path || !fs.existsSync(t3Path)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(t3Path, 'utf8'));
    const providers = new Map();
    for (const p of raw.providers || []) {
      providers.set(p.providerInstanceId, p);
    }
    return { raw, providers };
  } catch {
    return null;
  }
}

function getOpenCodeModels() {
  try {
    const cmd = process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
    const output = execFileSync(cmd, ['models'], {
      encoding: 'utf8',
      timeout: 20000,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes('/'));
  } catch {
    return [];
  }
}

async function fetchOpenRouterMetadata(timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return new Map();
    const payload = await res.json();
    const map = new Map();
    for (const item of payload?.data || []) {
      const promptRaw = item?.pricing?.prompt;
      const completionRaw = item?.pricing?.completion;
      const hasPrice = promptRaw !== undefined && completionRaw !== undefined;
      const promptPrice = Number(promptRaw);
      const completionPrice = Number(completionRaw);

      let freeStatus = 'unknown';
      if (hasPrice && !Number.isNaN(promptPrice) && !Number.isNaN(completionPrice)) {
        freeStatus = promptPrice === 0 && completionPrice === 0 ? 'verified_free' : 'paid';
      }

      const inputModalities = Array.isArray(item?.architecture?.input_modalities)
        ? item.architecture.input_modalities
        : ['text'];
      const outputModalities = Array.isArray(item?.architecture?.output_modalities)
        ? item.architecture.output_modalities
        : ['text'];

      map.set(`openrouter/${item.id}`, {
        id: `openrouter/${item.id}`,
        provider: 'openrouter',
        providerInstanceId: 'opencode_2',
        executionMethod: 'delegate_task',
        inputModalities,
        outputModalities,
        supportsVision: inputModalities.includes('image'),
        contextLength: Number(item?.context_length || 0),
        freeStatus,
        isFree: freeStatus === 'verified_free',
        source: 'openrouter-api',
      });
    }
    return map;
  } catch {
    return new Map();
  } finally {
    clearTimeout(timer);
  }
}

function mergeCandidateMetadata(id, { orMeta, registryModel, t3Caps, isLiveInOpenCode, simulatedItem }) {
  if (simulatedItem) {
    const freeStatus =
      simulatedItem.freeStatus ||
      (simulatedItem.isFree === true ? 'verified_free' : simulatedItem.isFree === false ? 'paid' : 'unknown');
    const inputModalities = simulatedItem.inputModalities || (simulatedItem.supportsVision ? ['text', 'image'] : ['text']);
    return {
      id,
      provider: simulatedItem.provider || inferProviderFromId(id),
      providerInstanceId: simulatedItem.providerInstanceId || (id.startsWith('antigravity/') ? 'antigravity' : 'opencode_2'),
      executionMethod: simulatedItem.executionMethod || 'delegate_task',
      profiles: simulatedItem.profiles || ['A', 'B', 'C'],
      inputModalities,
      outputModalities: simulatedItem.outputModalities || ['text'],
      supportsVision: Boolean(simulatedItem.supportsVision || inputModalities.includes('image')),
      visionOnly: Boolean(simulatedItem.visionOnly),
      contextLength: Number(simulatedItem.contextLength || 32768),
      freeStatus,
      isFree: freeStatus === 'verified_free',
      priority: Number(simulatedItem.priority ?? 50),
      delegatable: simulatedItem.delegatable !== false,
      knownConstraints: simulatedItem.knownConstraints || [],
      source: 'simulated',
    };
  }

  const provider = registryModel?.provider || orMeta?.provider || inferProviderFromId(id);
  const providerInstanceId =
    registryModel?.providerInstanceId ||
    orMeta?.providerInstanceId ||
    (provider === 'antigravity' ? 'antigravity' : 'opencode_2');

  let delegatable = registryModel?.delegatable ?? true;
  const constraints = [...(registryModel?.knownConstraints || [])];

  // OpenCode/OpenRouter routes always require presence in `opencode models`, even when t3Caps is provided.
  if ((provider === 'openrouter' || provider === 'opencode') && isLiveInOpenCode === false) {
    delegatable = false;
    constraints.push('No presente en `opencode models`');
  }

  if (t3Caps) {
    const pInfo = t3Caps.providers.get(providerInstanceId);
    if (!pInfo) {
      delegatable = false;
      constraints.push(`providerInstanceId '${providerInstanceId}' no reportado en orchestrator_capabilities`);
    } else if (!pInfo.canRunChildTask) {
      delegatable = false;
      constraints.push(...(pInfo.constraints || [`${providerInstanceId} no permite delegate_task`]));
    } else if (provider === 'antigravity') {
      const bareId = id.replace(/^antigravity\//, '');
      const listed = (pInfo.models || []).some((m) => m.id === bareId);
      if (!listed && !(pInfo.omittedModels > 0)) {
        delegatable = false;
        constraints.push(`Modelo ${bareId} no encontrado en antigravity`);
      }
    }
  }

  // Never assume free by name alone when price is unknown
  const freeStatus = orMeta?.freeStatus && orMeta.freeStatus !== 'unknown'
    ? orMeta.freeStatus
    : registryModel?.freeStatus || 'unknown';

  const inputModalities = orMeta?.inputModalities || registryModel?.inputModalities || ['text'];
  const supportsVision = Boolean(
    orMeta?.supportsVision ?? registryModel?.inputModalities?.includes('image') ?? false
  );

  const sources = [];
  if (isLiveInOpenCode) sources.push('opencode-cli');
  if (orMeta) sources.push('openrouter-api');
  if (registryModel) sources.push('local-registry');
  if (t3Caps && provider === 'antigravity') sources.push('t3-capabilities');

  return {
    id,
    provider,
    providerInstanceId,
    executionMethod: registryModel?.executionMethod || orMeta?.executionMethod || 'delegate_task',
    profiles: registryModel?.profiles || (supportsVision ? ['A', 'B', 'C'] : ['B', 'C']),
    inputModalities,
    outputModalities: orMeta?.outputModalities || registryModel?.outputModalities || ['text'],
    supportsVision,
    visionOnly: Boolean(registryModel?.visionOnly),
    contextLength: Number(orMeta?.contextLength || registryModel?.contextLength || 0),
    freeStatus,
    isFree: freeStatus === 'verified_free',
    priority: Number(registryModel?.priority ?? 50),
    delegatable,
    knownConstraints: constraints,
    source: sources.join('+') || 'unverified',
  };
}

async function buildCatalog(opts, registry, t3Caps) {
  if (opts.simulateCatalog) {
    const raw = JSON.parse(fs.readFileSync(opts.simulateCatalog, 'utf8'));
    const models = Array.isArray(raw) ? raw : raw.models || [];
    return models.map((m) =>
      typeof m === 'string'
        ? mergeCandidateMetadata(m, {
            orMeta: null,
            registryModel: registry.models.get(m),
            t3Caps,
            isLiveInOpenCode: true,
            simulatedItem: null,
          })
        : mergeCandidateMetadata(m.id, {
            orMeta: null,
            registryModel: registry.models.get(m.id),
            t3Caps,
            isLiveInOpenCode: true,
            simulatedItem: m,
          })
    );
  }

  const liveModels = getOpenCodeModels();
  const liveSet = new Set(liveModels);
  const orMeta = opts.offline ? new Map() : await fetchOpenRouterMetadata();

  const allIds = new Set([...liveModels, ...registry.models.keys()]);
  if (t3Caps) {
    const ag = t3Caps.providers.get('antigravity');
    if (ag?.models) {
      for (const m of ag.models) {
        allIds.add(`antigravity/${m.id}`);
      }
    }
  }

  const catalog = [];
  for (const id of allIds) {
    catalog.push(
      mergeCandidateMetadata(id, {
        orMeta: orMeta.get(id) || null,
        registryModel: registry.models.get(id) || null,
        t3Caps,
        isLiveInOpenCode: liveSet.has(id),
        simulatedItem: null,
      })
    );
  }
  return catalog;
}

function cleanupAbandonedTempFiles(dir, baseName, maxAgeMs = 60_000) {
  try {
    const prefix = `.tmp-${baseName}-`;
    const now = Date.now();
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.startsWith(prefix) || !entry.endsWith('.json')) continue;
      const fullPath = path.join(dir, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
        }
      } catch {
        // Ignore concurrent removal
      }
    }
  } catch {
    // Ignore directory read errors
  }
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Short busy-wait for cross-process lock/rename backoff without native deps
  }
}

function acquireLock(lockPath, timeoutMs = 2000, staleMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, `${process.pid}:${Date.now()}`);
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err?.code === 'EEXIST') {
        try {
          const stat = fs.statSync(lockPath);
          if (Date.now() - stat.mtimeMs > staleMs) {
            fs.unlinkSync(lockPath);
            continue;
          }
        } catch {
          // Lock disappeared; retry immediately
          continue;
        }
        sleepSync(15);
        continue;
      }
      return false;
    }
  }
  return false;
}

function releaseLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // Already released
  }
}

function mergeHealthStates(baseState, incomingState) {
  const merged = {
    models: { ...(baseState?.models || {}) },
    providers: { ...(baseState?.providers || {}) },
  };
  for (const [id, entry] of Object.entries(incomingState?.models || {})) {
    const prev = merged.models[id];
    if (!prev || (entry.lastFailedAt || '') >= (prev.lastFailedAt || '')) {
      merged.models[id] = {
        ...entry,
        failures: Math.max(Number(entry.failures || 0), Number(prev?.failures || 0)),
      };
    }
  }
  for (const [prov, entry] of Object.entries(incomingState?.providers || {})) {
    const prev = merged.providers[prov];
    if (!prev || (entry.lastFailedAt || '') >= (prev.lastFailedAt || '')) {
      merged.providers[prov] = {
        ...entry,
        failures: Math.max(Number(entry.failures || 0), Number(prev?.failures || 0)),
      };
    }
  }
  return merged;
}

function loadState(stateFile) {
  if (!stateFile || !fs.existsSync(stateFile)) {
    return { models: {}, providers: {} };
  }
  cleanupAbandonedTempFiles(path.dirname(stateFile), path.basename(stateFile));
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (!parsed || typeof parsed !== 'object') {
      return { models: {}, providers: {} };
    }
    return {
      models: parsed.models && typeof parsed.models === 'object' ? parsed.models : {},
      providers: parsed.providers && typeof parsed.providers === 'object' ? parsed.providers : {},
    };
  } catch {
    return { models: {}, providers: {} };
  }
}

function saveState(stateFile, state, { mergeLatest = true } = {}) {
  if (!stateFile) return;
  const dir = path.dirname(stateFile);
  const base = path.basename(stateFile);
  fs.mkdirSync(dir, { recursive: true });
  cleanupAbandonedTempFiles(dir, base);

  const lockPath = `${stateFile}.lock`;
  const locked = acquireLock(lockPath);
  const tmpPath = path.join(
    dir,
    `.tmp-${base}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
  );

  try {
    const finalState = mergeLatest ? mergeHealthStates(loadState(stateFile), state) : state;
    const serialized = JSON.stringify(finalState, null, 2);
    // Validate JSON round-trip before replacing previous state
    JSON.parse(serialized);
    fs.writeFileSync(tmpPath, serialized, 'utf8');

    // Atomic replace with short Windows EBUSY/EPERM retry
    let replaced = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.renameSync(tmpPath, stateFile);
        replaced = true;
        break;
      } catch (err) {
        if ((err?.code === 'EPERM' || err?.code === 'EBUSY') && attempt < 4) {
          sleepSync(20);
          continue;
        }
        throw err;
      }
    }
    if (!replaced) {
      throw new Error(`No se pudo reemplazar ${stateFile}`);
    }
  } finally {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup failure
      }
    }
    if (locked) releaseLock(lockPath);
  }
}

function recordFailureInState(state, modelId, provider, errorType, nowMs) {
  if (!modelId || errorType === 'none') return;
  const cooldown = COOLDOWN_MS[errorType] || COOLDOWN_MS.transient;
  const prev = state.models[modelId] || { failures: 0 };
  state.models[modelId] = {
    failures: prev.failures + 1,
    lastErrorType: errorType,
    lastFailedAt: new Date(nowMs).toISOString(),
    cooldownUntil: nowMs + cooldown,
  };
  if (provider && (errorType === 'rate_limit' || errorType === 'quota_exhausted' || errorType === 'permission_denied')) {
    const prevProv = state.providers[provider] || { failures: 0 };
    state.providers[provider] = {
      failures: prevProv.failures + 1,
      lastErrorType: errorType,
      lastFailedAt: new Date(nowMs).toISOString(),
      cooldownUntil: nowMs + Math.min(cooldown, 10 * 60 * 1000),
    };
  }
}

function passesFreePolicy(meta, freePolicy) {
  if (freePolicy === 'any') return meta.freeStatus !== 'unknown' || meta.provider === 'antigravity';
  if (freePolicy === 'allow-included') {
    return meta.freeStatus === 'verified_free' || meta.freeStatus === 'included_in_session';
  }
  return meta.freeStatus === 'verified_free';
}

function checkCapability(meta, profile, requiresVision) {
  if (requiresVision && !meta.supportsVision) {
    return { ok: false, reason: 'descartado-sin-soporte-vision' };
  }
  if (profile.profile === 'C' && meta.visionOnly) {
    return { ok: false, reason: 'descartado-modelo-solo-visual' };
  }
  if (meta.contextLength > 0 && meta.contextLength < (profile.minContextLength || 32768)) {
    return { ok: false, reason: `descartado-contexto-insuficiente (${meta.contextLength})` };
  }
  if (Array.isArray(meta.profiles) && !meta.profiles.includes(profile.profile)) {
    return { ok: false, reason: `descartado-fuera-de-perfil-${profile.profile}` };
  }
  return { ok: true };
}

function scoreCandidate(meta, { profile, failedProvider, usedProviders, state, nowMs }) {
  let score = 1000;

  // 1. Preferred candidate order in profile
  const prefIdx = profile.preferredCandidates.indexOf(meta.id);
  score -= prefIdx >= 0 ? prefIdx * 20 : 200;

  // 2. Registry priority
  score -= Math.min(meta.priority ?? 50, 100);

  // 3. Verified free strongly beats session-included
  if (meta.freeStatus === 'verified_free') score += 120;
  else if (meta.freeStatus === 'included_in_session') score -= 150;

  // 4. Provider independence from failed provider
  if (failedProvider && meta.provider === failedProvider) {
    score -= 180;
  } else if (failedProvider && meta.provider !== failedProvider) {
    score += 90;
  }

  // 5. Provider diversity across parallel sibling agents
  if (usedProviders.includes(meta.provider)) {
    score -= 60;
  }

  // 6. Active cooldown / recent failure penalty (expired cooldowns recover normal priority)
  const modelHealth = state.models[meta.id];
  const modelCooldownActive =
    typeof modelHealth?.cooldownUntil === 'number' &&
    Number.isFinite(modelHealth.cooldownUntil) &&
    modelHealth.cooldownUntil > nowMs;
  if (modelCooldownActive && modelHealth?.failures) {
    score -= modelHealth.failures * 35;
  }
  const provHealth = state.providers[meta.provider];
  if (
    typeof provHealth?.cooldownUntil === 'number' &&
    Number.isFinite(provHealth.cooldownUntil) &&
    provHealth.cooldownUntil > nowMs
  ) {
    score -= 140;
  }

  return score;
}

function classifyErrorMessage(message, explicitErrorType = 'none') {
  if (explicitErrorType && explicitErrorType !== 'none' && explicitErrorType !== 'unknown') {
    return { errorType: explicitErrorType, source: 'explicit', confidence: 'high' };
  }
  if (!message || typeof message !== 'string') {
    return { errorType: 'unknown', source: 'empty', confidence: 'low' };
  }
  const lower = message.toLowerCase();

  // 1. Auth errors (highest priority, never retry silently)
  if (
    /\b401\b/.test(lower) ||
    /unauthorized(?! to delegate)|invalid api key|authentication failed|invalid credentials|api key (is )?(missing|required|invalid)|not authenticated|login required/.test(lower)
  ) {
    return { errorType: 'auth', source: 'inferred', confidence: 'high' };
  }

  // 2. Permission / delegation errors
  if (
    /\b403\b/.test(lower) ||
    /permission denied|forbidden|not allowed|canrunchildtask|provider instance is disabled|unauthorized to delegate|access denied/.test(lower)
  ) {
    return { errorType: 'permission_denied', source: 'inferred', confidence: 'high' };
  }

  // 3. Quota exhausted (must be checked before generic rate_limit so daily/credit limits aren't misclassified)
  if (
    /free usage limit reached|free-models-per-day|insufficient credits|quota exceeded|quota exhausted|credit balance|add \d+ credits|billing|monthly limit|daily limit|usage limit reached/.test(lower)
  ) {
    return { errorType: 'quota_exhausted', source: 'inferred', confidence: 'high' };
  }

  // 4. Rate limit (explicit RPM/TPM/429/rate-limit signals; never match generic word "limit" alone)
  if (
    /\b429\b/.test(lower) ||
    /rate[ _-]?limit|too many requests|requests per (minute|second)|tokens per minute|\brpm\b|\btpm\b|throttl/.test(lower)
  ) {
    return { errorType: 'rate_limit', source: 'inferred', confidence: 'high' };
  }

  // 5. Capability mismatch
  if (
    /does not support image|vision (is )?not supported|multimodal (is )?not supported|context length exceeded|maximum context length|unsupported modality|tool use (is )?not supported/.test(lower)
  ) {
    return { errorType: 'capability', source: 'inferred', confidence: 'high' };
  }

  // 6. Model / service unavailable
  if (
    /\b503\b/.test(lower) ||
    /model not found|model unavailable|no such model|service unavailable|provider offline|deprecated|model does not exist/.test(lower)
  ) {
    return { errorType: 'unavailable', source: 'inferred', confidence: 'high' };
  }

  // 7. Transient network / gateway errors
  if (
    /\b(502|504)\b/.test(lower) ||
    /timeout|timed out|econnreset|econnrefused|etimedout|socket hang up|bad gateway|gateway timeout|temporary|network error|fetch failed/.test(lower)
  ) {
    return { errorType: 'transient', source: 'inferred', confidence: 'medium' };
  }

  return { errorType: 'unknown', source: 'inferred', confidence: 'low' };
}

function sanitizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/sk-[a-zA-Z0-9_-]{10,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[^\s'",;]+['"]?/gi, '$1=[REDACTED]');
}

function appendLog(logPath, entry) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const exists = fs.existsSync(logPath);
  const header = exists
    ? ''
    : `# Registro de Fallback de Modelos — LandingFactory\n\nEste archivo registra activaciones de fallback y decisiones de selección de modelos gratuitos (sin credenciales ni secretos).\n\n`;

  const block = [
    `## ${entry.timestamp} — \`${entry.agent}\` (Perfil ${entry.profile})`,
    `- **Modelo principal**: \`${entry.primaryModel}\``,
    `- **Error / Disparador**: \`${sanitizeText(entry.errorType)}\` (intento ${entry.attempt})`,
    `- **Política de gratuidad**: \`${entry.freePolicy}\``,
    `- **Requiere visión**: ${entry.requiresVision ? 'Sí' : 'No'}`,
    `- **Candidatos evaluados**: ${entry.evaluated.map((c) => `\`${c.id}\` (${c.reason})`).join(', ') || 'Ninguno'}`,
    `- **Acción**: \`${entry.action}\``,
    `- **Modelo seleccionado**: ${entry.selectedModel ? `\`${entry.selectedModel}\`` : 'Ninguno (tarea detenida)'}`,
    `- **Target de ejecución**: ${entry.executionTarget ? `\`${entry.executionTarget.providerInstanceId}\` / \`${entry.executionTarget.model}\` (${entry.executionTarget.executionMethod})` : 'N/A'}`,
    `- **Motivo**: ${sanitizeText(entry.reason)}`,
    `- **Resultado**: ${sanitizeText(entry.executionResult)}`,
    '',
  ].join('\n');

  fs.writeFileSync(logPath, (exists ? fs.readFileSync(logPath, 'utf8') : header) + block, 'utf8');
}

function buildExecutionTarget(meta) {
  if (!meta) return null;
  const bareModel =
    meta.provider === 'antigravity' ? meta.id.replace(/^antigravity\//, '') : meta.id;
  return {
    providerInstanceId: meta.providerInstanceId,
    model: bareModel,
    executionMethod: meta.executionMethod,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!VALID_ERROR_TYPES.has(opts.errorType)) {
    console.error(`Error: --error-type inválido "${opts.errorType}". Válidos: ${[...VALID_ERROR_TYPES].join(', ')}`);
    process.exit(1);
  }

  if (opts.errorMessage !== null && (opts.errorType === 'none' || opts.errorType === 'unknown')) {
    const classified = classifyErrorMessage(opts.errorMessage, opts.errorType);
    opts.errorType = classified.errorType;
    if (opts.classifyOnly) {
      console.log(JSON.stringify(classified, null, 2));
      return;
    }
  } else if (opts.classifyOnly) {
    console.log(JSON.stringify(classifyErrorMessage(opts.errorMessage || '', opts.errorType), null, 2));
    return;
  }

  const registry = loadRegistry(opts.registryPath);
  const t3Caps = loadT3Capabilities(opts.t3CapabilitiesPath);
  const catalog = await buildCatalog(opts, registry, t3Caps);
  const state = loadState(opts.stateFile);
  const nowMs = Date.now();

  if (opts.discover) {
    const byProvider = {};
    for (const m of catalog) {
      byProvider[m.provider] = (byProvider[m.provider] || 0) + 1;
    }
    console.log(
      JSON.stringify(
        {
          totalCatalog: catalog.length,
          byProvider,
          verifiedFreeCount: catalog.filter((m) => m.freeStatus === 'verified_free').length,
          includedInSessionCount: catalog.filter((m) => m.freeStatus === 'included_in_session').length,
          t3CapabilitiesLoaded: Boolean(t3Caps),
          registryLoaded: registry.models.size > 0,
        },
        null,
        2
      )
    );
    return;
  }

  if (opts.listAll) {
    const freeModels = catalog.filter((m) => m.freeStatus === 'verified_free');
    console.log(
      JSON.stringify({ totalCatalog: catalog.length, freeCount: freeModels.length, freeModels }, null, 2)
    );
    return;
  }

  const profile = AGENT_PROFILES[opts.agent];
  if (!profile) {
    console.error(`Error: Agente desconocido "${opts.agent}". Válidos: ${Object.keys(AGENT_PROFILES).join(', ')}`);
    process.exit(1);
  }

  const requiresVision = opts.requiresVision ?? profile.requiresVisionByDefault;
  const excludeSet = new Set(opts.exclude);
  const catalogMap = new Map(catalog.map((m) => [m.id, m]));
  const failedModel = opts.failedModel || (opts.errorType !== 'none' ? profile.primaryModel : null);
  const failedProvider = opts.failedProvider || (failedModel ? inferProviderFromId(failedModel) : null);

  if (opts.errorType === 'auth') {
    const result = {
      agent: opts.agent,
      profile: profile.profile,
      primaryModel: profile.primaryModel,
      requiresVision,
      freePolicy: opts.freePolicy,
      action: 'STOP_AUTH_REQUIRED',
      selectedModel: null,
      executionTarget: null,
      reason:
        'Error de autenticación/credenciales del proveedor. Requiere intervención del usuario; no se reintenta ni se cambia a modelos de pago.',
      evaluated: [],
    };
    if (opts.logFile) {
      appendLog(opts.logFile, {
        ...result,
        timestamp: new Date().toISOString(),
        errorType: opts.errorType,
        attempt: opts.attempt,
        executionResult: opts.executionResult,
      });
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // First transient error: allow 1 controlled retry on primary
  if (opts.errorType === 'transient' && opts.attempt === 1 && !excludeSet.has(profile.primaryModel)) {
    const primaryMeta = catalogMap.get(profile.primaryModel);
    if (
      primaryMeta &&
      primaryMeta.delegatable &&
      passesFreePolicy(primaryMeta, opts.freePolicy) &&
      checkCapability(primaryMeta, profile, requiresVision).ok
    ) {
      const result = {
        agent: opts.agent,
        profile: profile.profile,
        primaryModel: profile.primaryModel,
        requiresVision,
        freePolicy: opts.freePolicy,
        action: 'RETRY_PRIMARY',
        selectedModel: profile.primaryModel,
        selectedMetadata: primaryMeta,
        executionTarget: buildExecutionTarget(primaryMeta),
        reason:
          'Primer error transitorio sobre el modelo principal: se autoriza 1 reintento controlado antes de activar fallback.',
        evaluated: [{ id: profile.primaryModel, reason: 'disponible-reintento-1' }],
      };
      if (opts.logFile) {
        appendLog(opts.logFile, {
          ...result,
          timestamp: new Date().toISOString(),
          errorType: opts.errorType,
          attempt: opts.attempt,
          executionResult: opts.executionResult,
        });
      }
      console.log(JSON.stringify(result, null, 2));
      return;
    }
  }

  if (opts.errorType !== 'none' && failedModel) {
    excludeSet.add(failedModel);
    recordFailureInState(state, failedModel, failedProvider, opts.errorType, nowMs);
    saveState(opts.stateFile, state);
  }

  const orderedIds = [...profile.preferredCandidates];
  for (const item of catalog) {
    if (!orderedIds.includes(item.id)) orderedIds.push(item.id);
  }

  const evaluated = [];
  const viable = [];

  for (const id of orderedIds) {
    if (excludeSet.has(id)) {
      evaluated.push({ id, reason: 'excluido-por-fallo' });
      continue;
    }
    const modelHealth = state.models[id];
    if (modelHealth?.cooldownUntil && modelHealth.cooldownUntil > nowMs) {
      evaluated.push({ id, reason: `en-cooldown (${modelHealth.lastErrorType})` });
      continue;
    }
    const meta = catalogMap.get(id);
    if (!meta) {
      evaluated.push({ id, reason: 'no-disponible-en-catalogo' });
      continue;
    }
    if (!meta.delegatable) {
      evaluated.push({ id, reason: `sin-permiso-delegacion (${meta.knownConstraints.join('; ') || 'disabled'})` });
      continue;
    }
    if (opts.errorType === 'permission_denied' && failedModel) {
      const failedMeta = catalogMap.get(failedModel);
      if (failedMeta && meta.providerInstanceId === failedMeta.providerInstanceId) {
        evaluated.push({ id, reason: `descartado-mismo-providerInstanceId-denegado (${meta.providerInstanceId})` });
        continue;
      }
    }
    if (!passesFreePolicy(meta, opts.freePolicy)) {
      evaluated.push({ id, reason: `descartado-politica-gratuidad (${meta.freeStatus})` });
      continue;
    }
    const cap = checkCapability(meta, profile, requiresVision);
    if (!cap.ok) {
      evaluated.push({ id, reason: cap.reason });
      continue;
    }

    const score = scoreCandidate(meta, {
      profile,
      failedProvider,
      usedProviders: opts.usedProviders,
      state,
      nowMs,
    });
    evaluated.push({ id, reason: `compatible (${meta.freeStatus}, ${meta.provider}, score=${score})` });
    viable.push({ meta, score });
  }

  viable.sort((a, b) => b.score - a.score);
  const selected = viable[0]?.meta || null;

  const action = !selected
    ? opts.errorType === 'permission_denied'
      ? 'STOP_PERMISSION_DENIED'
      : 'STOP_NO_COMPATIBLE_FREE_MODEL'
    : selected.id === profile.primaryModel
      ? 'USE_PRIMARY'
      : 'USE_FALLBACK';

  const reason = !selected
    ? opts.errorType === 'permission_denied'
      ? 'Permiso de delegación denegado y sin otro providerInstanceId compatible.'
      : `No existe ningún modelo compatible bajo la política '${opts.freePolicy}' (se prohíbe escalar a modelos de pago).`
    : action === 'USE_PRIMARY'
      ? 'Modelo principal disponible, compatible y verificado.'
      : `Fallback inteligente desde ${failedModel || profile.primaryModel} hacia ${selected.id} (proveedor ${selected.provider}, ${selected.freeStatus}, via ${selected.providerInstanceId}).`;

  const result = {
    agent: opts.agent,
    profile: profile.profile,
    primaryModel: profile.primaryModel,
    requiresVision,
    freePolicy: opts.freePolicy,
    action,
    selectedModel: selected ? selected.id : null,
    selectedMetadata: selected || null,
    executionTarget: buildExecutionTarget(selected),
    reason,
    evaluated,
  };

  if (opts.logFile) {
    appendLog(opts.logFile, {
      ...result,
      timestamp: new Date().toISOString(),
      errorType: opts.errorType,
      attempt: opts.attempt,
      executionResult: opts.executionResult,
    });
  }

  console.log(JSON.stringify(result, null, 2));
}

export {
  AGENT_PROFILES,
  COOLDOWN_MS,
  classifyErrorMessage,
  loadState,
  saveState,
  mergeCandidateMetadata,
  scoreCandidate,
  sanitizeText,
};

const isCliEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
