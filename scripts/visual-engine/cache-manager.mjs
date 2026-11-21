import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readJsonSafe, withFileLock, writeJsonAtomic } from './atomic-fs.mjs';
import { inspectImageBuffer } from './security-validator.mjs';

const INITIAL_INDEX = {
  schemaVersion: 1,
  entries: {},
};

const STRATEGY_VERSION = '1.0.0';

/**
 * GenerationCache — Caché determinista en .visual-engine-state/cache/
 * con verificación de existencia, integridad SHA-256, firma binaria y lock atómico.
 */
export class GenerationCache {
  constructor({ stateDir } = {}) {
    this.cacheDir = path.join(stateDir, 'cache');
    this.blobsDir = path.join(this.cacheDir, 'blobs');
    this.indexFile = path.join(this.cacheDir, 'index.json');
  }

  static computeKey({
    prompt = '',
    model = '',
    size = '',
    format = '',
    style = null,
    substyle = null,
    styleId = null,
    styleReferenceUrls = [],
    strategyVersion = STRATEGY_VERSION,
  } = {}) {
    const normalizedPrompt = String(prompt).trim().replace(/\s+/g, ' ');
    const sortedRefs = [...(styleReferenceUrls || [])].map(String).sort();
    const payload = JSON.stringify({
      normalizedPrompt,
      model,
      size,
      format,
      style: style || null,
      substyle: substyle || null,
      styleId: styleId || null,
      styleReferenceUrls: sortedRefs,
      strategyVersion,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  get(cacheKey) {
    const index = readJsonSafe(this.indexFile, INITIAL_INDEX);
    const entry = index.entries?.[cacheKey];
    if (!entry) return null;

    const blobPath = path.join(this.blobsDir, entry.blobFilename);
    if (!fs.existsSync(blobPath)) {
      this.invalidate(cacheKey);
      return null;
    }

    try {
      const buffer = fs.readFileSync(blobPath);
      const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
      if (actualHash !== entry.sha256) {
        this.invalidate(cacheKey);
        return null;
      }
      const inspected = inspectImageBuffer(buffer);
      return { ...entry, buffer, ...inspected };
    } catch {
      this.invalidate(cacheKey);
      return null;
    }
  }

  put(cacheKey, { buffer, format, mimeType, width, height, model, metadata = {} }) {
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const blobFilename = `${cacheKey.slice(0, 24)}.${format}`;
    const blobPath = path.join(this.blobsDir, blobFilename);

    return withFileLock(this.indexFile, () => {
      fs.mkdirSync(this.blobsDir, { recursive: true });
      const tmpBlob = path.join(this.blobsDir, `.tmp-${blobFilename}-${process.pid}-${Date.now()}`);
      try {
        fs.writeFileSync(tmpBlob, buffer);
        fs.renameSync(tmpBlob, blobPath);
      } finally {
        if (fs.existsSync(tmpBlob)) {
          try { fs.unlinkSync(tmpBlob); } catch {}
        }
      }

      const index = readJsonSafe(this.indexFile, INITIAL_INDEX);
      if (!index.entries) index.entries = {};
      index.entries[cacheKey] = {
        cacheKey,
        blobFilename,
        sha256,
        format,
        mimeType,
        width: width || null,
        height: height || null,
        bytes: buffer.length,
        model,
        metadata,
        createdAt: new Date().toISOString(),
      };
      writeJsonAtomic(this.indexFile, index);
      return index.entries[cacheKey];
    });
  }

  invalidate(cacheKey) {
    return withFileLock(this.indexFile, () => {
      const index = readJsonSafe(this.indexFile, INITIAL_INDEX);
      const entry = index.entries?.[cacheKey];
      if (!entry) return false;
      const blobPath = path.join(this.blobsDir, entry.blobFilename);
      if (fs.existsSync(blobPath)) {
        try { fs.unlinkSync(blobPath); } catch {}
      }
      delete index.entries[cacheKey];
      writeJsonAtomic(this.indexFile, index);
      return true;
    });
  }

  invalidateAll() {
    return withFileLock(this.indexFile, () => {
      if (fs.existsSync(this.blobsDir)) {
        fs.rmSync(this.blobsDir, { recursive: true, force: true });
      }
      writeJsonAtomic(this.indexFile, INITIAL_INDEX);
      return true;
    });
  }
}
