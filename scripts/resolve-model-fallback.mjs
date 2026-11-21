#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Smart Model Fallback Resolver for LandingFactory
 *
 * Discovers real available models from OpenCode CLI (`opencode models`) and
 * optionally enriches OpenRouter metadata (pricing, input modalities, context)
 * from the public OpenRouter models endpoint without requiring paid credits.
 */

const AGENT_PROFILES = {
  'visual-analyst': {
    profile: 'A',
    profileName: 'Análisis visual y multimodal',
    primaryModel: 'openrouter/google/gemma-4-31b-it:free',
    requiresVisionByDefault: true,
    preferredCandidates: [
      'openrouter/google/gemma-4-31b-it:free',
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'opencode/nemotron-3.5-super-vl-free',
      'openrouter/nvidia/nemotron-3.5-super-vl:free',
      'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/openrouter/free',
    ],
  },
  'ui-ux-designer': {
    profile: 'A',
    profileName: 'Análisis visual y multimodal',
    primaryModel: 'openrouter/google/gemma-4-31b-it:free',
    requiresVisionByDefault: true,
    preferredCandidates: [
      'openrouter/google/gemma-4-31b-it:free',
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'opencode/nemotron-3.5-super-vl-free',
      'openrouter/nvidia/nemotron-3.5-super-vl:free',
      'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/openrouter/free',
    ],
  },
  'asset-researcher': {
    profile: 'A',
    profileName: 'Análisis visual y multimodal',
    primaryModel: 'openrouter/google/gemma-4-31b-it:free',
    requiresVisionByDefault: true,
    preferredCandidates: [
      'openrouter/google/gemma-4-31b-it:free',
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'opencode/nemotron-3.5-super-vl-free',
      'openrouter/nvidia/nemotron-3.5-super-vl:free',
      'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/openrouter/free',
    ],
  },
  'visual-qa': {
    profile: 'A',
    profileName: 'Análisis visual y multimodal',
    primaryModel: 'openrouter/google/gemma-4-31b-it:free',
    requiresVisionByDefault: true,
    preferredCandidates: [
      'openrouter/google/gemma-4-31b-it:free',
      'openrouter/google/gemma-4-26b-a4b-it:free',
      'opencode/nemotron-3.5-super-vl-free',
      'openrouter/nvidia/nemotron-3.5-super-vl:free',
      'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/openrouter/free',
    ],
  },
  'implementation-planner': {
    profile: 'B',
    profileName: 'Planificación y razonamiento',
    primaryModel: 'opencode/beam-free',
    requiresVisionByDefault: false,
    preferredCandidates: [
      'opencode/beam-free',
      'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free',
      'opencode/deepseek-v4.1-flash-free',
      'opencode/flint-40b-free',
      'openrouter/google/gemma-4-31b-it:free',
      'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/openrouter/free',
    ],
  },
  'code-reviewer': {
    profile: 'C',
    profileName: 'Revisión técnica y código',
    primaryModel: 'opencode/deepseek-v4.1-flash-free',
    requiresVisionByDefault: false,
    preferredCandidates: [
      'opencode/deepseek-v4.1-flash-free',
      'opencode/flint-40b-free',
      'opencode/beam-free',
      'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free',
      'openrouter/google/gemma-4-31b-it:free',
      'openrouter/openrouter/free',
    ],
  },
};

// Known metadata for OpenCode-hosted free models (cannot be queried from OpenRouter API)
const OPENCODE_MODEL_METADATA = {
  'opencode/beam-free': { isFree: true, supportsVision: false, contextLength: 131072, tier: 'high' },
  'opencode/deepseek-v4.1-flash-free': { isFree: true, supportsVision: false, contextLength: 131072, tier: 'high' },
  'opencode/flint-40b-free': { isFree: true, supportsVision: false, contextLength: 131072, tier: 'medium' },
  'opencode/nemotron-3.5-super-vl-free': { isFree: true, supportsVision: true, contextLength: 131072, tier: 'high' },
  'opencode/nemotron-3.5-lightning-free': { isFree: true, supportsVision: false, contextLength: 131072, tier: 'medium' },
  'opencode/hy4-flash-free': { isFree: true, supportsVision: false, contextLength: 65536, tier: 'medium' },
  'opencode/iceman-free': { isFree: true, supportsVision: false, contextLength: 65536, tier: 'medium' },
  'opencode/longcat-2.5-free': { isFree: true, supportsVision: false, contextLength: 65536, tier: 'medium' },
  'opencode/mimo-v2.6-flash-free': { isFree: true, supportsVision: false, contextLength: 65536, tier: 'medium' },
  'opencode/tidepool-alpha-free': { isFree: true, supportsVision: false, contextLength: 65536, tier: 'low' },
};

function parseArgs(argv) {
  const opts = {
    agent: null,
    requiresVision: null,
    exclude: [],
    errorType: 'none',
    attempt: 1,
    offline: false,
    simulateCatalog: null,
    logFile: null,
    executionResult: 'pending',
    listAll: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--agent' || arg === '-a') opts.agent = argv[++i];
    else if (arg === '--requires-vision') opts.requiresVision = argv[++i] === 'true';
    else if (arg === '--exclude') {
      opts.exclude = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    } else if (arg === '--error-type') opts.errorType = argv[++i] || 'none';
    else if (arg === '--attempt') opts.attempt = Number(argv[++i] || '1');
    else if (arg === '--offline') opts.offline = true;
    else if (arg === '--simulate-catalog') opts.simulateCatalog = path.resolve(argv[++i]);
    else if (arg === '--log-file') opts.logFile = path.resolve(argv[++i]);
    else if (arg === '--result') opts.executionResult = argv[++i] || 'pending';
    else if (arg === '--list-free') opts.listAll = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Uso:
  node resolve-model-fallback.mjs --agent <nombre> [opciones]

Opciones:
  --agent, -a <nombre>       Especialista: visual-analyst, ui-ux-designer, asset-researcher, implementation-planner, visual-qa, code-reviewer
  --requires-vision <bool>   Fuerza requisito multimodal (true/false). Por defecto según perfil del agente.
  --exclude <m1,m2>          Modelos a excluir por fallo en esta ejecución.
  --error-type <tipo>        none | transient | rate_limit | unavailable | capability | auth
  --attempt <n>              Número de intento actual sobre el modelo principal (default: 1)
  --offline                  No consultar API pública de OpenRouter; usar solo catálogo local de OpenCode.
  --simulate-catalog <json>  Archivo JSON con catálogo simulado para pruebas controladas.
  --log-file <ruta>          Archivo Markdown donde registrar el evento (ej. docs/design/model-fallback-log.md).
  --result <estado>          Estado de resultado para el log (ej. selected, fallback_success, blocked).
  --list-free                Lista todos los modelos gratuitos detectados y sus capacidades.
`);
      process.exit(0);
    }
  }

  return opts;
}

function getOpenCodeModels() {
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
      const promptPrice = Number(item?.pricing?.prompt ?? NaN);
      const completionPrice = Number(item?.pricing?.completion ?? NaN);
      const isFree = promptPrice === 0 && completionPrice === 0;
      const inputModalities = item?.architecture?.input_modalities || [];
      const supportsVision =
        Array.isArray(inputModalities) && inputModalities.includes('image');
      map.set(`openrouter/${item.id}`, {
        id: `openrouter/${item.id}`,
        isFree,
        supportsVision,
        contextLength: item?.context_length || 0,
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

function inferLocalMetadata(modelId) {
  if (OPENCODE_MODEL_METADATA[modelId]) {
    return { id: modelId, ...OPENCODE_MODEL_METADATA[modelId], source: 'opencode-known' };
  }
  const lower = modelId.toLowerCase();
  const isOpenCodeFree = modelId.startsWith('opencode/') && lower.endsWith('-free');
  const isOpenRouterFree = modelId.startsWith('openrouter/') && lower.endsWith(':free');
  const isFree = isOpenCodeFree || isOpenRouterFree || modelId === 'openrouter/openrouter/free';
  const supportsVision =
    lower.includes('-vl') ||
    lower.includes('omni') ||
    lower.includes('gemma-4-') ||
    lower.includes('vision');
  return {
    id: modelId,
    isFree,
    supportsVision,
    contextLength: 32768,
    source: 'heuristic-local',
  };
}

async function buildCatalog(opts) {
  if (opts.simulateCatalog) {
    const raw = JSON.parse(fs.readFileSync(opts.simulateCatalog, 'utf8'));
    const models = Array.isArray(raw) ? raw : raw.models || [];
    return models.map((m) =>
      typeof m === 'string'
        ? inferLocalMetadata(m)
        : {
            id: m.id,
            isFree: Boolean(m.isFree),
            supportsVision: Boolean(m.supportsVision),
            contextLength: Number(m.contextLength || 32768),
            source: 'simulated',
          }
    );
  }

  const liveModels = getOpenCodeModels();
  const orMeta = opts.offline ? new Map() : await fetchOpenRouterMetadata();

  return liveModels.map((id) => {
    if (orMeta.has(id)) return orMeta.get(id);
    return inferLocalMetadata(id);
  });
}

function sanitizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/sk-[a-zA-Z0-9_-]{10,}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]');
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
    `- **Requiere visión**: ${entry.requiresVision ? 'Sí' : 'No'}`,
    `- **Candidatos evaluados**: ${entry.evaluated.map((c) => `\`${c.id}\` (${c.reason})`).join(', ') || 'Ninguno'}`,
    `- **Acción**: \`${entry.action}\``,
    `- **Modelo seleccionado**: ${entry.selectedModel ? `\`${entry.selectedModel}\`` : 'Ninguno (tarea detenida)'}`,
    `- **Motivo**: ${sanitizeText(entry.reason)}`,
    `- **Resultado**: ${sanitizeText(entry.executionResult)}`,
    '',
  ].join('\n');

  fs.writeFileSync(logPath, (exists ? fs.readFileSync(logPath, 'utf8') : header) + block, 'utf8');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const catalog = await buildCatalog(opts);

  if (opts.listAll) {
    const freeModels = catalog.filter((m) => m.isFree);
    console.log(JSON.stringify({ totalCatalog: catalog.length, freeCount: freeModels.length, freeModels }, null, 2));
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

  // Auth error: do not retry or cycle providers silently
  if (opts.errorType === 'auth') {
    const result = {
      agent: opts.agent,
      profile: profile.profile,
      primaryModel: profile.primaryModel,
      requiresVision,
      action: 'STOP_AUTH_REQUIRED',
      selectedModel: null,
      reason: 'Error de autenticación/credenciales del proveedor. Requiere intervención del usuario; no se reintenta ni se cambia a modelos de pago.',
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

  // Transient error on first attempt: retry primary once if available & compatible
  if (opts.errorType === 'transient' && opts.attempt === 1 && !excludeSet.has(profile.primaryModel)) {
    const primaryMeta = catalogMap.get(profile.primaryModel);
    if (primaryMeta && primaryMeta.isFree && (!requiresVision || primaryMeta.supportsVision)) {
      const result = {
        agent: opts.agent,
        profile: profile.profile,
        primaryModel: profile.primaryModel,
        requiresVision,
        action: 'RETRY_PRIMARY',
        selectedModel: profile.primaryModel,
        reason: 'Primer error transitorio sobre el modelo principal: se autoriza 1 reintento controlado antes de activar fallback.',
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

  // If primary failed (>=2 transient or rate_limit/unavailable/capability), exclude primary automatically
  if (opts.errorType !== 'none') {
    excludeSet.add(profile.primaryModel);
  }

  // Build ordered candidate list: preferred candidates first, then dynamic free catalog
  const orderedIds = [...profile.preferredCandidates];
  for (const item of catalog) {
    if (item.isFree && !orderedIds.includes(item.id)) {
      orderedIds.push(item.id);
    }
  }

  const evaluated = [];
  let selected = null;

  for (const id of orderedIds) {
    if (excludeSet.has(id)) {
      evaluated.push({ id, reason: 'excluido-por-fallo' });
      continue;
    }
    const meta = catalogMap.get(id);
    if (!meta) {
      evaluated.push({ id, reason: 'no-disponible-en-catalogo' });
      continue;
    }
    if (!meta.isFree) {
      evaluated.push({ id, reason: 'descartado-no-gratuito' });
      continue;
    }
    if (requiresVision && !meta.supportsVision) {
      evaluated.push({ id, reason: 'descartado-sin-soporte-vision' });
      continue;
    }
    evaluated.push({ id, reason: `compatible-gratuito (${meta.source})` });
    selected = meta;
    break;
  }

  const action = !selected
    ? 'STOP_NO_COMPATIBLE_FREE_MODEL'
    : selected.id === profile.primaryModel
      ? 'USE_PRIMARY'
      : 'USE_FALLBACK';

  const reason = !selected
    ? 'No existe ningún modelo gratuito compatible en el catálogo actual (se prohíbe escalar a modelos de pago).'
    : action === 'USE_PRIMARY'
      ? 'Modelo principal disponible, gratuito y compatible.'
      : `Fallback activado desde ${profile.primaryModel} hacia ${selected.id} (${selected.source}).`;

  const result = {
    agent: opts.agent,
    profile: profile.profile,
    primaryModel: profile.primaryModel,
    requiresVision,
    action,
    selectedModel: selected ? selected.id : null,
    selectedMetadata: selected || null,
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
