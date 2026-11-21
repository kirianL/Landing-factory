import crypto from 'node:crypto';
import path from 'node:path';
import { readJsonSafe, withFileLock, writeJsonAtomic } from './atomic-fs.mjs';

const INITIAL_STYLES = {
  schemaVersion: 1,
  projects: {},
};

/**
 * Registro de estilos por proyecto para reutilizar style_id y evitar crear
 * estilos duplicados en cada generación.
 */
export class StyleRegistry {
  constructor({ stateDir } = {}) {
    this.stylesFile = path.join(stateDir, 'styles-registry.json');
  }

  static computeReferenceKey({ baseStyle = '', model = '', referenceIdentifiers = [] } = {}) {
    const normalized = [...referenceIdentifiers].map(String).sort();
    const payload = JSON.stringify({ baseStyle, model, references: normalized });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }

  findReusableStyle(projectId, referenceKey) {
    const state = readJsonSafe(this.stylesFile, INITIAL_STYLES);
    const list = state.projects?.[projectId] || [];
    return list.find((item) => item.referenceKey === referenceKey) || null;
  }

  listProjectStyles(projectId) {
    const state = readJsonSafe(this.stylesFile, INITIAL_STYLES);
    return state.projects?.[projectId] || [];
  }

  saveStyle({ projectId = 'default', styleId, baseStyle = null, model = null, referenceKey, creditsUsed = null }) {
    if (!styleId) throw new Error('styleId es obligatorio para registrar un estilo');

    return withFileLock(this.stylesFile, () => {
      const state = readJsonSafe(this.stylesFile, INITIAL_STYLES);
      if (!state.projects) state.projects = {};
      if (!Array.isArray(state.projects[projectId])) state.projects[projectId] = [];

      const existingIdx = state.projects[projectId].findIndex((s) => s.styleId === styleId);
      const record = {
        projectId,
        styleId,
        baseStyle,
        model,
        referenceKey,
        creditsUsed,
        updatedAt: new Date().toISOString(),
        createdAt: existingIdx >= 0 ? state.projects[projectId][existingIdx].createdAt : new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        state.projects[projectId][existingIdx] = record;
      } else {
        state.projects[projectId].push(record);
      }

      writeJsonAtomic(this.stylesFile, state);
      return record;
    });
  }
}
