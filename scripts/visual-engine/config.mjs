import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_LOCAL_BUDGET,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  ENGINE_MODES,
} from './contracts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACTORY_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_MODELS_CONFIG_PATH = path.join(__dirname, 'models-config.json');
const DEFAULT_STATE_DIR = path.join(FACTORY_ROOT, '.visual-engine-state');

/**
 * Redacta credenciales y tokens antes de escribir logs o propagar errores.
 */
export function redactSecrets(text, extraTokens = []) {
  if (typeof text !== 'string') return text;
  let out = text
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
    .replace(/(RECRAFT_API_TOKEN|RECRAFT_API_KEY|api[_-]?key|token)\s*[:=]\s*['"]?[^\s'",;]+['"]?/gi, '$1=[REDACTED]');

  for (const tok of extraTokens) {
    if (typeof tok === 'string' && tok.length >= 6) {
      out = out.split(tok).join('[REDACTED]');
    }
  }
  return out;
}

export function loadModelsConfig(configPath = DEFAULT_MODELS_CONFIG_PATH) {
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Resuelve la configuración del Visual Asset Engine desde env + overrides explícitos.
 * Conserva DRY_RUN y presupuesto local 1000 por defecto.
 */
export function loadEngineConfig(overrides = {}, env = process.env) {
  const modelsConfig = overrides.modelsConfig || loadModelsConfig(overrides.modelsConfigPath || DEFAULT_MODELS_CONFIG_PATH);
  const provider = (overrides.provider || env.VISUAL_ENGINE_PROVIDER || 'recraft').toLowerCase();
  const rawMode = (overrides.mode || env.VISUAL_ENGINE_MODE || ENGINE_MODES.DRY_RUN).toUpperCase();
  const mode = rawMode === ENGINE_MODES.LIVE ? ENGINE_MODES.LIVE : ENGINE_MODES.DRY_RUN;

  const enabledEnv = env.VISUAL_ENGINE_ENABLED;
  const enabled = overrides.enabled !== undefined
    ? Boolean(overrides.enabled)
    : enabledEnv !== undefined
      ? /^(1|true|yes)$/i.test(String(enabledEnv).trim())
      : false;

  // Variable canónica RECRAFT_API_TOKEN (fallback opcional a RECRAFT_API_KEY solo si no existe la canónica)
  const apiToken = overrides.apiToken !== undefined
    ? overrides.apiToken
    : (env.RECRAFT_API_TOKEN || env.RECRAFT_API_KEY || '').trim();

  const providerCfg = modelsConfig?.providers?.[provider] || {};
  const baseUrl = (overrides.baseUrl || env.RECRAFT_BASE_URL || providerCfg.baseUrl || 'https://external.api.recraft.ai/v1').replace(/\/+$/, '');

  const parsedBudget = Number(overrides.localBudgetLimit ?? env.VISUAL_ENGINE_BUDGET ?? DEFAULT_LOCAL_BUDGET);
  const localBudgetLimit = Number.isFinite(parsedBudget) && parsedBudget >= 0 ? parsedBudget : DEFAULT_LOCAL_BUDGET;

  const parsedTimeout = Number(overrides.timeoutMs ?? env.VISUAL_ENGINE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS;

  const parsedRetries = Number(overrides.maxRetries ?? env.VISUAL_ENGINE_MAX_RETRIES ?? DEFAULT_MAX_RETRIES);
  const maxRetries = Number.isFinite(parsedRetries) && parsedRetries >= 0 ? Math.min(parsedRetries, 5) : DEFAULT_MAX_RETRIES;

  const stateDir = path.resolve(overrides.stateDir || env.VISUAL_ENGINE_STATE_DIR || DEFAULT_STATE_DIR);

  return {
    enabled,
    provider,
    mode,
    apiToken,
    hasApiToken: Boolean(apiToken),
    baseUrl,
    timeoutMs,
    maxRetries,
    localBudgetLimit,
    stateDir,
    modelsConfig,
  };
}

export function getModelSpec(config, modelId) {
  const providerCfg = config?.modelsConfig?.providers?.[config.provider];
  if (!providerCfg?.models) return null;
  const id = modelId || providerCfg.defaultModel;
  const spec = providerCfg.models[id];
  if (!spec) return null;
  return { id, ...spec };
}
