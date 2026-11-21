import { inspectImageBuffer } from './security-validator.mjs';

/**
 * ImageOptimizer — Capa desacoplada de optimización.
 *
 * Evaluación de Sharp:
 *  - Sharp es compatible con Node.js 22 en Windows x64 mediante binarios N-API precompilados,
 *    pero añade ~30-40 MB nativos en node_modules.
 *  - Como Recraft ya genera dimensiones objetivo y SVG vectorial nativo, LandingFactory
 *    mantiene Sharp como dependencia opcional: si está instalado, convierte raster a WebP
 *    (q=85) para reducir peso LCP; si no está instalado, ejecuta validación binaria pura
 *    sin degradar ni bloquear el pipeline.
 */
export class ImageOptimizer {
  constructor({ sharpLoader = null, targetFormat = 'webp', quality = 85 } = {}) {
    this.sharpLoader = sharpLoader || (() => import('sharp').then((m) => m.default || m).catch(() => null));
    this.targetFormat = targetFormat;
    this.quality = quality;
  }

  async optimize(buffer, { format, targetWidth = null, targetHeight = null } = {}) {
    const inspected = inspectImageBuffer(buffer);
    const actualFormat = format || inspected.format;

    if (actualFormat === 'svg') {
      return {
        buffer,
        format: 'svg',
        mimeType: 'image/svg+xml',
        width: inspected.width,
        height: inspected.height,
        bytes: buffer.length,
        optimized: false,
        strategy: 'svg_passthrough',
      };
    }

    const sharp = await this.sharpLoader();
    if (!sharp) {
      return {
        buffer,
        format: inspected.format,
        mimeType: inspected.mimeType,
        width: inspected.width,
        height: inspected.height,
        bytes: buffer.length,
        optimized: false,
        strategy: 'passthrough_validated',
      };
    }

    let pipeline = sharp(buffer);
    if (targetWidth && targetHeight) {
      pipeline = pipeline.resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    if (this.targetFormat === 'webp') {
      pipeline = pipeline.webp({ quality: this.quality });
    } else if (this.targetFormat === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9 });
    }

    const outBuffer = await pipeline.toBuffer();
    const outInfo = inspectImageBuffer(outBuffer);

    return {
      buffer: outBuffer,
      format: outInfo.format,
      mimeType: outInfo.mimeType,
      width: outInfo.width,
      height: outInfo.height,
      bytes: outBuffer.length,
      optimized: true,
      strategy: `sharp_${outInfo.format}`,
    };
  }
}
