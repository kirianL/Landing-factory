import { BaseVisualProvider } from './base-provider.mjs';
import { redactSecrets } from '../config.mjs';
import { VisualEngineError } from '../contracts.mjs';

/**
 * Adaptador oficial de Recraft API (https://external.api.recraft.ai/v1).
 * Solo utiliza endpoints oficiales confirmados:
 *  - GET  /users/me
 *  - POST /images/generations
 *  - POST /styles
 *  - GET  /styles
 *  - POST /images/imageToImage
 */
export class RecraftProvider extends BaseVisualProvider {
  constructor({ apiToken, baseUrl = 'https://external.api.recraft.ai/v1', timeoutMs = 30_000, maxRetries = 2, fetchImpl = globalThis.fetch } = {}) {
    super();
    this.apiToken = (apiToken || '').trim();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.fetch = fetchImpl;
  }

  getName() {
    return 'recraft';
  }

  validateConfig() {
    const issues = [];
    if (!this.apiToken) {
      issues.push('Falta RECRAFT_API_TOKEN en el entorno');
    }
    if (typeof this.fetch !== 'function') {
      issues.push('fetch no está disponible en el runtime actual');
    }
    return { ok: issues.length === 0, issues };
  }

  _buildAbortSignal(externalSignal) {
    const controller = new AbortController();
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(`Timeout tras ${this.timeoutMs}ms`));
    }, this.timeoutMs);

    const onExternalAbort = () => {
      controller.abort(externalSignal.reason || new Error('Operación cancelada localmente por AbortController'));
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        onExternalAbort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    return {
      signal: controller.signal,
      wasTimedOut: () => timedOut,
      cleanup: () => {
        clearTimeout(timer);
        if (externalSignal) {
          externalSignal.removeEventListener('abort', onExternalAbort);
        }
      },
    };
  }

  _sanitizeErrorMessage(msg) {
    return redactSecrets(String(msg || 'Error desconocido'), [this.apiToken]);
  }

  async _request(method, endpoint, { jsonBody = null, formData = null, signal = null, idempotent = false } = {}) {
    const validation = this.validateConfig();
    if (!validation.ok) {
      throw new VisualEngineError(validation.issues.join('; '), {
        code: 'AUTH_CONFIG_MISSING',
        retryable: false,
        ambiguousOutcome: false,
      });
    }

    const url = `${this.baseUrl}${endpoint}`;
    const attempts = idempotent ? this.maxRetries + 1 : 1;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const abortWrap = this._buildAbortSignal(signal);
      const headers = {
        Authorization: `Bearer ${this.apiToken}`,
      };
      let body;
      if (jsonBody !== null) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(jsonBody);
      } else if (formData !== null) {
        body = formData;
      }

      try {
        const res = await this.fetch(url, {
          method,
          headers,
          body,
          signal: abortWrap.signal,
        });

        const rawText = await res.text();
        let data = null;
        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          data = { rawText };
        }

        if (!res.ok) {
          const detail = this._sanitizeErrorMessage(data?.message || data?.error?.message || rawText || res.statusText);
          const status = res.status;

          // Errores HTTP explícitos: sabemos que la petición fue rechazada antes de generar
          if (status === 401 || status === 403) {
            throw new VisualEngineError(`Autenticación rechazada por Recraft (${status}): ${detail}`, {
              code: 'AUTH_ERROR',
              status,
              retryable: false,
              ambiguousOutcome: false,
            });
          }
          if (status === 400 || status === 422) {
            throw new VisualEngineError(`Solicitud inválida en Recraft (${status}): ${detail}`, {
              code: 'INVALID_REQUEST',
              status,
              retryable: false,
              ambiguousOutcome: false,
            });
          }
          if (status === 429) {
            if (idempotent && attempt < attempts) continue;
            throw new VisualEngineError(`Rate limit en Recraft (429): ${detail}`, {
              code: 'RATE_LIMIT',
              status,
              retryable: idempotent,
              ambiguousOutcome: false,
            });
          }
          if (status >= 500) {
            if (idempotent && attempt < attempts) continue;
            throw new VisualEngineError(`Error del servidor Recraft (${status}): ${detail}`, {
              code: 'PROVIDER_SERVER_ERROR',
              status,
              retryable: idempotent,
              ambiguousOutcome: false,
            });
          }
          throw new VisualEngineError(`Error HTTP inesperado de Recraft (${status}): ${detail}`, {
            code: 'HTTP_ERROR',
            status,
            retryable: false,
            ambiguousOutcome: false,
          });
        }

        if (!data || typeof data !== 'object' || data.rawText !== undefined) {
          throw new VisualEngineError('Respuesta inesperada de Recraft: JSON inválido o vacío', {
            code: 'UNEXPECTED_RESPONSE',
            status: res.status,
            retryable: false,
            // En POST, si el servidor respondió 200 pero el cuerpo no se pudo parsear, el cobro pudo ocurrir
            ambiguousOutcome: !idempotent,
          });
        }

        return data;
      } catch (err) {
        if (err instanceof VisualEngineError) {
          throw err;
        }

        const isAbort = err?.name === 'AbortError' || abortWrap.wasTimedOut() || signal?.aborted;
        const msg = this._sanitizeErrorMessage(err?.message || String(err));

        if (idempotent && attempt < attempts && !signal?.aborted) {
          continue;
        }

        // En POST, un timeout, abort o caída de red después de enviar puede haberse procesado en servidor
        const ambiguous = !idempotent;
        throw new VisualEngineError(
          isAbort
            ? `Operación cancelada/timeout localmente (${abortWrap.wasTimedOut() ? 'timeout' : 'abort'}): ${msg}`
            : `Error de red al comunicarse con Recraft: ${msg}`,
          {
            code: abortWrap.wasTimedOut() ? 'TIMEOUT' : isAbort ? 'ABORTED_LOCAL' : 'NETWORK_ERROR',
            retryable: idempotent,
            ambiguousOutcome: ambiguous,
            cause: err,
          }
        );
      } finally {
        abortWrap.cleanup();
      }
    }
  }

  /**
   * GET /users/me — Obtiene cuenta y saldo real (credits).
   */
  async getAccountInfo({ signal = null } = {}) {
    const data = await this._request('GET', '/users/me', { signal, idempotent: true });
    if (typeof data.credits !== 'number') {
      throw new VisualEngineError('Respuesta inesperada en GET /users/me: falta campo credits', {
        code: 'UNEXPECTED_RESPONSE',
        ambiguousOutcome: false,
      });
    }
    return {
      id: data.id || null,
      email: data.email || null,
      name: data.name || null,
      credits: data.credits,
    };
  }

  /**
   * POST /images/generations — Genera imágenes raster o SVG.
   */
  async generate(params, { signal = null } = {}) {
    if (!params?.prompt || typeof params.prompt !== 'string') {
      throw new VisualEngineError('El campo prompt es obligatorio para generar imágenes', {
        code: 'INVALID_REQUEST',
        ambiguousOutcome: false,
      });
    }

    const payload = {
      prompt: params.prompt,
    };
    if (params.model) payload.model = params.model;
    if (params.size) payload.size = params.size;
    if (params.n) payload.n = params.n;
    if (params.responseFormat) payload.response_format = params.responseFormat;
    if (params.style) payload.style = params.style;
    if (params.substyle) payload.substyle = params.substyle;
    if (params.styleId) {
      payload.style_id = params.styleId;
    } else if (Array.isArray(params.styleReferenceUrls) && params.styleReferenceUrls.length > 0) {
      payload.style_reference_urls = params.styleReferenceUrls;
    }

    const data = await this._request('POST', '/images/generations', {
      jsonBody: payload,
      signal,
      idempotent: false,
    });

    if (!Array.isArray(data.data) || data.data.length === 0) {
      throw new VisualEngineError('Respuesta inesperada en POST /images/generations: falta arreglo data', {
        code: 'UNEXPECTED_RESPONSE',
        ambiguousOutcome: true,
      });
    }

    return {
      created: data.created || null,
      credits: typeof data.credits === 'number' ? data.credits : null,
      images: data.data.map((item) => ({
        url: item.url || null,
        b64Json: item.b64_json || null,
      })),
    };
  }

  /**
   * POST /styles — Crea un estilo reutilizable a partir de referencias.
   */
  async createStyle({ style, files = [], formData = null } = {}, { signal = null } = {}) {
    let bodyForm = formData;
    if (!bodyForm) {
      bodyForm = new FormData();
      if (style) bodyForm.append('style', style);
      for (const f of files) {
        if (f?.blob && f?.name) {
          bodyForm.append('file', f.blob, f.name);
        }
      }
    }

    const data = await this._request('POST', '/styles', {
      formData: bodyForm,
      signal,
      idempotent: false,
    });

    const styleId = data.style_id || data.id;
    if (!styleId) {
      throw new VisualEngineError('Respuesta inesperada en POST /styles: falta style_id/id', {
        code: 'UNEXPECTED_RESPONSE',
        ambiguousOutcome: true,
      });
    }

    return {
      styleId,
      created: data.created || null,
      credits: typeof data.credits === 'number' ? data.credits : null,
    };
  }

  /**
   * GET /styles — Lista estilos disponibles de la cuenta.
   */
  async listStyles({ signal = null } = {}) {
    const data = await this._request('GET', '/styles', { signal, idempotent: true });
    return Array.isArray(data) ? data : (data.styles || data.data || []);
  }

  /**
   * POST /images/imageToImage — Transforma una imagen existente con un prompt.
   */
  async imageToImage({ formData } = {}, { signal = null } = {}) {
    if (!formData) {
      throw new VisualEngineError('formData es obligatorio para POST /images/imageToImage', {
        code: 'INVALID_REQUEST',
        ambiguousOutcome: false,
      });
    }

    const data = await this._request('POST', '/images/imageToImage', {
      formData,
      signal,
      idempotent: false,
    });

    if (!Array.isArray(data.data) || data.data.length === 0) {
      throw new VisualEngineError('Respuesta inesperada en POST /images/imageToImage: falta arreglo data', {
        code: 'UNEXPECTED_RESPONSE',
        ambiguousOutcome: true,
      });
    }

    return {
      created: data.created || null,
      credits: typeof data.credits === 'number' ? data.credits : null,
      images: data.data.map((item) => ({
        url: item.url || null,
        b64Json: item.b64_json || null,
      })),
    };
  }
}
