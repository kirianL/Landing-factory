import fs from 'node:fs';
import path from 'node:path';
import { redactSecrets } from './config.mjs';

/**
 * Logger estructurado JSONL fuera de directorios publicables,
 * con redacción automática de tokens y secretos.
 */
export class EngineLogger {
  constructor({ stateDir, secretsToRedact = [], silent = false } = {}) {
    this.logFile = stateDir ? path.join(stateDir, 'logs', 'visual-engine.log.jsonl') : null;
    this.secretsToRedact = secretsToRedact.filter(Boolean);
    this.silent = silent;
  }

  sanitizeValue(value) {
    if (typeof value === 'string') return redactSecrets(value, this.secretsToRedact);
    if (Array.isArray(value)) return value.map((v) => this.sanitizeValue(v));
    if (value && typeof value === 'object') {
      const clean = {};
      for (const [k, v] of Object.entries(value)) {
        if (/^(apiToken|apiKey|token|authorization|secret)$/i.test(k)) {
          clean[k] = '[REDACTED]';
        } else {
          clean[k] = this.sanitizeValue(v);
        }
      }
      return clean;
    }
    return value;
  }

  log(event, payload = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      ...this.sanitizeValue(payload),
    };

    if (this.logFile) {
      fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
      fs.appendFileSync(this.logFile, `${JSON.stringify(entry)}\n`, 'utf8');
    }
    return entry;
  }
}
