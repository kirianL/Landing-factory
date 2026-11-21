import crypto from 'node:crypto';
import path from 'node:path';
import { readJsonSafe, withFileLock, writeJsonAtomic } from './atomic-fs.mjs';
import {
  BudgetExceededError,
  DEFAULT_LOCAL_BUDGET,
  ENGINE_MODES,
  LEDGER_STATUS,
} from './contracts.mjs';

const INITIAL_STATE = {
  schemaVersion: 1,
  localBudgetLimit: DEFAULT_LOCAL_BUDGET,
  account: {
    initialAccountCredits: null,
    lastKnownAccountCredits: null,
    lastSyncedAt: null,
    userId: null,
  },
  projects: {},
  ledger: [],
};

/**
 * CreditManager — Autoridad única para autorizar, reservar, conciliar y auditar
 * el consumo de créditos en LandingFactory.
 *
 * Separa estrictamente el presupuesto local de LandingFactory (1,000 por defecto)
 * del saldo real de la cuenta Recraft obtenido vía GET /users/me.
 */
export class CreditManager {
  constructor({ stateDir, localBudgetLimit = DEFAULT_LOCAL_BUDGET, logger = null } = {}) {
    this.stateFile = path.join(stateDir, 'credit-state.json');
    this.localBudgetLimit = localBudgetLimit;
    this.logger = logger;
  }

  _load() {
    const state = readJsonSafe(this.stateFile, INITIAL_STATE);
    if (!state.localBudgetLimit && state.localBudgetLimit !== 0) {
      state.localBudgetLimit = this.localBudgetLimit;
    }
    if (!state.account) state.account = structuredClone(INITIAL_STATE.account);
    if (!state.projects) state.projects = {};
    if (!Array.isArray(state.ledger)) state.ledger = [];
    return state;
  }

  _ensureProject(state, projectId) {
    const key = projectId || 'default';
    if (!state.projects[key]) {
      state.projects[key] = {
        usedCredits: 0,
        reservedCredits: 0,
        unknownOutcomeCredits: 0,
        dryRunSimulatedCredits: 0,
        operationsCount: 0,
      };
    }
    return state.projects[key];
  }

  _computeGlobalTotals(state) {
    let usedCredits = 0;
    let reservedCredits = 0;
    let unknownOutcomeCredits = 0;
    for (const p of Object.values(state.projects || {})) {
      usedCredits += p.usedCredits || 0;
      reservedCredits += p.reservedCredits || 0;
      unknownOutcomeCredits += p.unknownOutcomeCredits || 0;
    }
    return { usedCredits, reservedCredits, unknownOutcomeCredits };
  }

  /**
   * Registra el saldo real obtenido de GET /users/me sin mezclarlo con el presupuesto local.
   */
  recordAccountBalance(accountInfo) {
    if (!accountInfo || typeof accountInfo.credits !== 'number') {
      throw new Error('Respuesta de GET /users/me inválida: falta el campo numérico credits');
    }

    return withFileLock(this.stateFile, () => {
      const state = this._load();
      if (state.account.initialAccountCredits === null) {
        state.account.initialAccountCredits = accountInfo.credits;
      }
      state.account.lastKnownAccountCredits = accountInfo.credits;
      state.account.lastSyncedAt = new Date().toISOString();
      state.account.userId = accountInfo.id || state.account.userId;
      writeJsonAtomic(this.stateFile, state);
      return structuredClone(state.account);
    });
  }

  /**
   * Consulta el resumen actual del presupuesto local y el saldo real registrado.
   */
  getSummary(projectId = null) {
    const state = this._load();
    const limit = this.localBudgetLimit ?? state.localBudgetLimit ?? DEFAULT_LOCAL_BUDGET;
    const totals = this._computeGlobalTotals(state);
    const committed = totals.usedCredits + totals.reservedCredits + totals.unknownOutcomeCredits;
    const remainingLocalBudget = Math.max(0, limit - committed);

    return {
      localBudgetLimit: limit,
      global: {
        ...totals,
        committedCredits: committed,
        remainingLocalBudget,
      },
      project: projectId ? (state.projects[projectId] || this._ensureProject({ projects: {} }, projectId)) : null,
      account: structuredClone(state.account),
    };
  }

  /**
   * Registra una simulación DRY_RUN sin afectar el presupuesto real.
   */
  recordDryRun({ projectId = 'default', operation, estimatedCredits = 0, model, generationId }) {
    return withFileLock(this.stateFile, () => {
      const state = this._load();
      const proj = this._ensureProject(state, projectId);
      proj.dryRunSimulatedCredits += Number(estimatedCredits) || 0;
      proj.operationsCount += 1;

      const entry = {
        reservationId: `dry_${crypto.randomUUID()}`,
        generationId: generationId || null,
        projectId,
        operation,
        model: model || null,
        mode: ENGINE_MODES.DRY_RUN,
        status: LEDGER_STATUS.DRY_RUN,
        estimatedCredits: Number(estimatedCredits) || 0,
        actualCredits: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.ledger.push(entry);
      writeJsonAtomic(this.stateFile, state);
      this.logger?.log('credit.dry_run', entry);
      return entry;
    });
  }

  /**
   * Reserva consumo estimado antes de ejecutar una llamada LIVE.
   * Bloquea inmediatamente si supera el presupuesto local máximo.
   */
  reserve({ projectId = 'default', operation, estimatedCredits, model, generationId, requestHash = null }) {
    const estimate = Number(estimatedCredits);
    if (!Number.isFinite(estimate) || estimate <= 0) {
      throw new BudgetExceededError('estimatedCredits debe ser un número positivo para autorizar una llamada LIVE');
    }

    return withFileLock(this.stateFile, () => {
      const state = this._load();
      const limit = this.localBudgetLimit ?? state.localBudgetLimit ?? DEFAULT_LOCAL_BUDGET;
      state.localBudgetLimit = limit;

      // Evitar duplicación si ya existe una reserva activa o UNKNOWN_OUTCOME con el mismo requestHash
      if (requestHash) {
        const duplicate = state.ledger.find(
          (e) => e.requestHash === requestHash && (e.status === LEDGER_STATUS.RESERVED || e.status === LEDGER_STATUS.UNKNOWN_OUTCOME)
        );
        if (duplicate) {
          throw new BudgetExceededError(
            `Operación bloqueada: existe una solicitud previa en estado ${duplicate.status} para el mismo requestHash`,
            { duplicateReservationId: duplicate.reservationId, status: duplicate.status }
          );
        }
      }

      const totals = this._computeGlobalTotals(state);
      const committed = totals.usedCredits + totals.reservedCredits + totals.unknownOutcomeCredits;

      if (committed + estimate > limit) {
        this.logger?.log('credit.blocked', { projectId, operation, estimate, committed, limit });
        throw new BudgetExceededError(
          `Presupuesto local excedido: comprometido=${committed}, estimado=${estimate}, límite=${limit}`,
          { committed, estimate, limit, remaining: Math.max(0, limit - committed) }
        );
      }

      const proj = this._ensureProject(state, projectId);
      proj.reservedCredits += estimate;
      proj.operationsCount += 1;

      const reservation = {
        reservationId: `res_${crypto.randomUUID()}`,
        generationId: generationId || null,
        requestHash,
        projectId,
        operation,
        model: model || null,
        mode: ENGINE_MODES.LIVE,
        status: LEDGER_STATUS.RESERVED,
        estimatedCredits: estimate,
        actualCredits: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      state.ledger.push(reservation);
      writeJsonAtomic(this.stateFile, state);
      this.logger?.log('credit.reserved', reservation);
      return reservation;
    });
  }

  /**
   * Concilia una reserva previa.
   * Si Recraft devolvió 'credits', ese valor real prevalece siempre sobre la estimación.
   * Si outcome es 'UNKNOWN_OUTCOME', conserva el monto reservado como comprometido y nunca lo libera como si no se hubiera cobrado.
   */
  reconcile({ reservationId, outcome, apiCredits = null, note = null }) {
    return withFileLock(this.stateFile, () => {
      const state = this._load();
      const entry = state.ledger.find((e) => e.reservationId === reservationId);
      if (!entry) {
        throw new Error(`Reserva no encontrada: ${reservationId}`);
      }
      if (entry.status !== LEDGER_STATUS.RESERVED) {
        return entry;
      }

      const proj = this._ensureProject(state, entry.projectId);
      const reservedAmt = entry.estimatedCredits || 0;
      proj.reservedCredits = Math.max(0, proj.reservedCredits - reservedAmt);

      if (outcome === 'SUCCESS') {
        // El campo credits de Recraft prevalece sobre la estimación local
        const realCredits = typeof apiCredits === 'number' && Number.isFinite(apiCredits) && apiCredits >= 0
          ? apiCredits
          : reservedAmt;
        proj.usedCredits += realCredits;
        if (state.account.lastKnownAccountCredits !== null && typeof apiCredits === 'number') {
          state.account.lastKnownAccountCredits = Math.max(0, state.account.lastKnownAccountCredits - realCredits);
        }
        entry.status = LEDGER_STATUS.RECONCILED;
        entry.actualCredits = realCredits;
        entry.creditsSource = typeof apiCredits === 'number' ? 'api' : 'estimated_fallback';
      } else if (outcome === 'UNKNOWN_OUTCOME') {
        // Resultado ambiguo tras enviar POST: mantener comprometido y prohibir reintento automático
        proj.unknownOutcomeCredits += reservedAmt;
        entry.status = LEDGER_STATUS.UNKNOWN_OUTCOME;
        entry.actualCredits = null;
        entry.creditsSource = 'unknown';
      } else {
        // Fallo confirmado sin procesamiento (ej. 400/401/403): liberar reserva
        entry.status = LEDGER_STATUS.RELEASED;
        entry.actualCredits = 0;
        entry.creditsSource = 'released';
      }

      if (note) entry.note = note;
      entry.updatedAt = new Date().toISOString();
      writeJsonAtomic(this.stateFile, state);
      this.logger?.log('credit.reconciled', entry);
      return entry;
    });
  }

  listLedger(projectId = null) {
    const state = this._load();
    if (!projectId) return state.ledger;
    return state.ledger.filter((e) => e.projectId === projectId);
  }
}
