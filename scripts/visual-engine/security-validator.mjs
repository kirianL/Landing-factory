import path from 'node:path';
import { VisualEngineError } from './contracts.mjs';

export const DEFAULT_ALLOWED_HOSTS = [
  'external.api.recraft.ai',
  'api.recraft.ai',
  'img.recraft.ai',
];

export const DEFAULT_MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024; // 15 MiB

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

/**
 * Verifica que la URL pertenezca a la allowlist HTTPS (nunca HTTP ni hosts privados).
 */
export function validateDownloadUrl(rawUrl, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new VisualEngineError(`URL de descarga inválida: ${rawUrl}`, { code: 'INVALID_DOWNLOAD_URL' });
  }

  if (parsed.protocol !== 'https:') {
    throw new VisualEngineError(`Protocolo no permitido en descarga (${parsed.protocol}); solo HTTPS`, {
      code: 'UNSAFE_DOWNLOAD_PROTOCOL',
    });
  }

  if (parsed.port && parsed.port !== '443') {
    throw new VisualEngineError(`Puerto no permitido en descarga (${parsed.port}); solo 443`, {
      code: 'UNSAFE_DOWNLOAD_PORT',
    });
  }

  if (parsed.username || parsed.password) {
    throw new VisualEngineError('Credenciales embebidas no permitidas en URL de descarga', {
      code: 'UNSAFE_DOWNLOAD_CREDENTIALS',
    });
  }

  const host = parsed.hostname.toLowerCase();
  const allowed = allowedHosts.some((h) => host === h.toLowerCase());
  if (!allowed) {
    throw new VisualEngineError(`Host de descarga fuera de allowlist: ${host}`, {
      code: 'UNTRUSTED_DOWNLOAD_HOST',
    });
  }

  return parsed.toString();
}

/**
 * Previene path traversal garantizando que la ruta final viva dentro de baseDir.
 */
export function resolveSafeOutputPath(baseDir, filename) {
  const raw = String(filename || '');
  if (!raw || raw.includes('/') || raw.includes('\\') || raw.includes('..')) {
    throw new VisualEngineError(`Intento de path traversal detectado: ${filename}`, {
      code: 'PATH_TRAVERSAL_BLOCKED',
    });
  }
  const safeName = path.basename(raw);
  if (!safeName || safeName === '.' || safeName === '..' || !/^[a-zA-Z0-9._-]+$/.test(safeName)) {
    throw new VisualEngineError(`Nombre de archivo inseguro o inválido: ${filename}`, {
      code: 'UNSAFE_FILENAME',
    });
  }
  const ext = path.extname(safeName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new VisualEngineError(`Extensión de archivo no permitida: ${ext}`, {
      code: 'INVALID_EXTENSION',
    });
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, safeName);
  const rel = path.relative(resolvedBase, resolvedTarget);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new VisualEngineError(`Intento de path traversal detectado: ${filename}`, {
      code: 'PATH_TRAVERSAL_BLOCKED',
    });
  }
  return resolvedTarget;
}

/**
 * Inspecciona la firma binaria real (magic bytes) y extrae dimensiones sin confiar en Content-Type.
 */
export function inspectImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    throw new VisualEngineError('Buffer de imagen vacío o truncado', { code: 'CORRUPT_IMAGE' });
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A + IHDR
  if (
    buffer.length >= 24
    && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    && buffer.toString('ascii', 12, 16) === 'IHDR'
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width <= 0 || height <= 0) {
      throw new VisualEngineError('PNG corrupto: dimensiones inválidas en IHDR', { code: 'CORRUPT_IMAGE' });
    }
    return { format: 'png', mimeType: 'image/png', width, height };
  }

  // JPEG: FF D8 FF ... SOF0 (C0) o SOF2 (C2)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    let offset = 2;
    let width = null;
    let height = null;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        if (offset + 9 <= buffer.length) {
          height = buffer.readUInt16BE(offset + 5);
          width = buffer.readUInt16BE(offset + 7);
        }
        break;
      }
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const segLen = buffer.readUInt16BE(offset + 2);
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
    return { format: 'jpeg', mimeType: 'image/jpeg', width, height };
  }

  // WebP: RIFF....WEBP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    let width = null;
    let height = null;
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buffer.length >= 30) {
      width = 1 + buffer.readUIntLE(24, 3);
      height = 1 + buffer.readUIntLE(27, 3);
    } else if (chunk === 'VP8 ' && buffer.length >= 30) {
      width = buffer.readUInt16LE(26) & 0x3fff;
      height = buffer.readUInt16LE(28) & 0x3fff;
    } else if (chunk === 'VP8L' && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }
    return { format: 'webp', mimeType: 'image/webp', width, height };
  }

  // SVG: texto con <svg y sin scripts inline, foreignObject ni URIs peligrosas
  const headText = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf8').trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(headText)) {
    const fullText = buffer.toString('utf8');
    if (/<script[\s>]|<foreignObject[\s>]|<iframe[\s>]|<object[\s>]|<embed[\s>]|on[a-z]+\s*=|javascript:|data:text\/html/i.test(fullText)) {
      throw new VisualEngineError('SVG rechazado por contener elementos o manejadores inseguros', {
        code: 'UNSAFE_SVG',
      });
    }
    const wMatch = fullText.match(/\bwidth\s*=\s*["'](\d+(?:\.\d+)?)/i);
    const hMatch = fullText.match(/\bheight\s*=\s*["'](\d+(?:\.\d+)?)/i);
    return {
      format: 'svg',
      mimeType: 'image/svg+xml',
      width: wMatch ? Math.round(Number(wMatch[1])) : null,
      height: hMatch ? Math.round(Number(hMatch[1])) : null,
    };
  }

  throw new VisualEngineError('Firma binaria no reconocida o archivo corrupto', { code: 'INVALID_BINARY_SIGNATURE' });
}

/**
 * Descarga segura de una URL en allowlist validando tamaño, MIME declarado vs binario real.
 */
export async function secureDownloadImage(
  url,
  {
    fetchImpl = globalThis.fetch,
    allowedHosts = DEFAULT_ALLOWED_HOSTS,
    maxBytes = DEFAULT_MAX_DOWNLOAD_BYTES,
    timeoutMs = 30_000,
    expectedFormat = null,
    maxRedirects = 3,
  } = {}
) {
  let currentUrl = validateDownloadUrl(url, allowedHosts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Timeout de descarga')), timeoutMs);

  try {
    let res = null;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      res = await fetchImpl(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers?.get?.('location');
        if (!location) {
          throw new VisualEngineError(`Redirección HTTP (${res.status}) sin cabecera Location`, {
            code: 'INVALID_REDIRECT',
          });
        }
        if (hop === maxRedirects) {
          throw new VisualEngineError(`Demasiadas redirecciones (> ${maxRedirects}) durante descarga`, {
            code: 'TOO_MANY_REDIRECTS',
          });
        }
        const resolvedNext = new URL(location, currentUrl).toString();
        currentUrl = validateDownloadUrl(resolvedNext, allowedHosts);
        continue;
      }
      break;
    }

    if (!res.ok) {
      throw new VisualEngineError(`Error al descargar recurso (${res.status})`, {
        code: 'DOWNLOAD_FAILED',
        status: res.status,
      });
    }

    const declaredMime = (res.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
    if (declaredMime && !declaredMime.startsWith('image/')) {
      throw new VisualEngineError(`Content-Type declarado no es imagen: ${declaredMime}`, {
        code: 'INVALID_MIME_TYPE',
      });
    }

    const contentLen = Number(res.headers?.get?.('content-length') || 0);
    if (contentLen > maxBytes) {
      throw new VisualEngineError(`Archivo excede límite de tamaño (${contentLen} > ${maxBytes} bytes)`, {
        code: 'FILE_TOO_LARGE',
      });
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    if (buffer.length > maxBytes) {
      throw new VisualEngineError(`Descarga excede límite de tamaño (${buffer.length} > ${maxBytes} bytes)`, {
        code: 'FILE_TOO_LARGE',
      });
    }

    const inspected = inspectImageBuffer(buffer);
    if (expectedFormat && expectedFormat !== 'any' && inspected.format !== expectedFormat) {
      // Permitir equivalencia raster si no se exigía svg estricto
      if (expectedFormat === 'svg' && inspected.format !== 'svg') {
        throw new VisualEngineError(`Se esperaba SVG pero se recibió ${inspected.format}`, {
          code: 'FORMAT_MISMATCH',
        });
      }
    }

    return {
      buffer,
      bytes: buffer.length,
      declaredMime: declaredMime || null,
      ...inspected,
    };
  } finally {
    clearTimeout(timer);
  }
}
