import fs from 'node:fs';
import path from 'node:path';

/**
 * Primitivas de archivo atómico y lockfile compatibles con Windows,
 * siguiendo el mismo patrón verificado de scripts/resolve-model-fallback.mjs.
 */

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Busy-wait corto para backoff de lock/rename sin dependencias nativas
  }
}

export function acquireLock(lockPath, timeoutMs = 2500, staleMs = 15_000) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: Date.now() }), 'utf8');
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err && err.code === 'EEXIST') {
        try {
          const stat = fs.statSync(lockPath);
          if (Date.now() - stat.mtimeMs > staleMs) {
            fs.unlinkSync(lockPath);
            continue;
          }
        } catch {
          continue;
        }
        sleepSync(10);
        continue;
      }
      return false;
    }
  }
  return false;
}

export function releaseLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // Ignorar si ya fue liberado
  }
}

export function readJsonSafe(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) return structuredClone(fallbackValue);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return structuredClone(fallbackValue);
    return parsed;
  } catch {
    return structuredClone(fallbackValue);
  }
}

export function writeBufferAtomic(filePath, buffer) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.tmp-${path.basename(filePath)}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.bin`);
  try {
    fs.writeFileSync(tmpPath, buffer);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.renameSync(tmpPath, filePath);
        return;
      } catch (err) {
        if ((err?.code === 'EBUSY' || err?.code === 'EPERM') && attempt < 4) {
          sleepSync(15);
          continue;
        }
        throw err;
      }
    }
  } finally {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Mejor esfuerzo
      }
    }
  }
}

export function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.tmp-${path.basename(filePath)}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`);
  try {
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, serialized, 'utf8');
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.renameSync(tmpPath, filePath);
        return;
      } catch (err) {
        if ((err?.code === 'EBUSY' || err?.code === 'EPERM') && attempt < 4) {
          sleepSync(15);
          continue;
        }
        throw err;
      }
    }
  } finally {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // Mejor esfuerzo
      }
    }
  }
}

/**
 * Ejecuta una actualización read-modify-write protegida por lockfile.
 */
export function withFileLock(filePath, fn) {
  const lockPath = `${filePath}.lock`;
  const locked = acquireLock(lockPath);
  if (!locked) {
    throw new Error(`No se pudo adquirir lock para ${filePath} dentro del tiempo límite`);
  }
  try {
    return fn();
  } finally {
    releaseLock(lockPath);
  }
}
