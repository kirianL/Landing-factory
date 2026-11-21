/**
 * Contratos y constantes compartidas del Visual Asset Engine.
 */

export const ENGINE_MODES = Object.freeze({
  DRY_RUN: 'DRY_RUN',
  LIVE: 'LIVE',
});

export const OUTCOMES = Object.freeze({
  SUCCESS: 'SUCCESS',
  DRY_RUN: 'DRY_RUN',
  FAILED: 'FAILED',
  UNKNOWN_OUTCOME: 'UNKNOWN_OUTCOME',
  CANCELLED_LOCAL: 'CANCELLED_LOCAL',
});

export const LEDGER_STATUS = Object.freeze({
  RESERVED: 'RESERVED',
  RECONCILED: 'RECONCILED',
  RELEASED: 'RELEASED',
  UNKNOWN_OUTCOME: 'UNKNOWN_OUTCOME',
  DRY_RUN: 'DRY_RUN',
});

export const DEFAULT_LOCAL_BUDGET = 1000;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RETRIES = 2;

export class VisualEngineError extends Error {
  constructor(message, { code = 'VISUAL_ENGINE_ERROR', status = null, retryable = false, ambiguousOutcome = false, cause = null } = {}) {
    super(message);
    this.name = 'VisualEngineError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.ambiguousOutcome = ambiguousOutcome;
    if (cause) this.cause = cause;
  }
}

export class BudgetExceededError extends VisualEngineError {
  constructor(message, details = {}) {
    super(message, { code: 'BUDGET_EXCEEDED', retryable: false, ambiguousOutcome: false });
    this.name = 'BudgetExceededError';
    this.details = details;
  }
}
