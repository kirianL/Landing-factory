#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const opts = {
    ref: null,
    impl: null,
    diff: null,
    overlay: null,
    threshold: 18,
    zones: 3,
    targetSimilarity: 85,
    viewport: 'desktop',
    out: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--ref') opts.ref = path.resolve(argv[++i]);
    else if (arg === '--impl') opts.impl = path.resolve(argv[++i]);
    else if (arg === '--diff') opts.diff = path.resolve(argv[++i]);
    else if (arg === '--overlay') opts.overlay = path.resolve(argv[++i]);
    else if (arg === '--threshold') opts.threshold = Number(argv[++i]);
    else if (arg === '--zones') opts.zones = Math.max(1, Number(argv[++i] || 3));
    else if (arg === '--target-similarity') opts.targetSimilarity = Number(argv[++i] || 85);
    else if (arg === '--viewport') opts.viewport = argv[++i] || 'desktop';
    else if (arg === '--out') opts.out = path.resolve(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Uso:
  node compare-screenshots.mjs --ref <ref.png> --impl <impl.png> [--diff diff.png] [--overlay overlay.png] [--threshold 18] [--zones 3] [--target-similarity 85] [--viewport desktop] [--out report.json]
`);
      process.exit(0);
    }
  }

  if (!opts.ref || !opts.impl) {
    console.error('Error: Debes especificar --ref y --impl');
    process.exit(1);
  }
  return opts;
}

function toDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const b64 = fs.readFileSync(filePath).toString('base64');
  return `data:${mime};base64,${b64}`;
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const refUrl = toDataUrl(opts.ref);
  const implUrl = toDataUrl(opts.impl);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(async ({ refUrl, implUrl, threshold, wantDiff, wantOverlay, zones }) => {
      const loadImg = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

      const [refImg, implImg] = await Promise.all([loadImg(refUrl), loadImg(implUrl)]);
      const width = Math.max(refImg.width, implImg.width);
      const height = Math.max(refImg.height, implImg.height);

      const getPixels = (img) => {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, width, height);
      };

      const refData = getPixels(refImg);
      const implData = getPixels(implImg);
      const totalPixels = width * height;

      let diffPixels = 0;
      let sumAbs = 0;
      let sumSq = 0;

      const zoneCount = Math.max(1, zones);
      const zoneStats = Array.from({ length: zoneCount }, (_, idx) => ({
        zone: idx + 1,
        label: zoneCount === 3 ? (idx === 0 ? 'top-hero' : idx === 1 ? 'middle-content' : 'bottom-footer') : `band-${idx + 1}`,
        totalPixels: 0,
        diffPixels: 0,
      }));

      const diffCanvas = wantDiff ? document.createElement('canvas') : null;
      let diffCtx = null;
      let diffImgData = null;
      if (diffCanvas) {
        diffCanvas.width = width;
        diffCanvas.height = height;
        diffCtx = diffCanvas.getContext('2d');
        diffImgData = diffCtx.createImageData(width, height);
      }

      for (let i = 0; i < refData.data.length; i += 4) {
        const pixelIndex = i / 4;
        const y = Math.floor(pixelIndex / width);
        const zoneIdx = Math.min(zoneCount - 1, Math.floor((y / height) * zoneCount));
        zoneStats[zoneIdx].totalPixels++;

        const dr = Math.abs(refData.data[i] - implData.data[i]);
        const dg = Math.abs(refData.data[i + 1] - implData.data[i + 1]);
        const db = Math.abs(refData.data[i + 2] - implData.data[i + 2]);
        const maxDiff = Math.max(dr, dg, db);
        const avgDiff = (dr + dg + db) / 3;
        sumAbs += avgDiff;
        sumSq += avgDiff * avgDiff;

        const isDiff = maxDiff > threshold;
        if (isDiff) {
          diffPixels++;
          zoneStats[zoneIdx].diffPixels++;
        }

        if (diffImgData) {
          if (isDiff) {
            diffImgData.data[i] = 255;
            diffImgData.data[i + 1] = 48;
            diffImgData.data[i + 2] = 48;
            diffImgData.data[i + 3] = 255;
          } else {
            diffImgData.data[i] = Math.round(implData.data[i] * 0.35);
            diffImgData.data[i + 1] = Math.round(implData.data[i + 1] * 0.35);
            diffImgData.data[i + 2] = Math.round(implData.data[i + 2] * 0.35);
            diffImgData.data[i + 3] = 255;
          }
        }
      }

      let diffDataUrl = null;
      if (diffCtx && diffImgData) {
        diffCtx.putImageData(diffImgData, 0, 0);
        diffDataUrl = diffCanvas.toDataURL('image/png');
      }

      let overlayDataUrl = null;
      if (wantOverlay) {
        const oc = document.createElement('canvas');
        oc.width = width;
        oc.height = height;
        const octx = oc.getContext('2d');
        octx.drawImage(refImg, 0, 0);
        octx.globalAlpha = 0.5;
        octx.drawImage(implImg, 0, 0);
        overlayDataUrl = oc.toDataURL('image/png');
      }

      const mae = sumAbs / totalPixels;
      const rmse = Math.sqrt(sumSq / totalPixels);

      const diffPercent = Number(((diffPixels / totalPixels) * 100).toFixed(2));
      const similarityPercent = Number((100 - diffPercent).toFixed(2));
      const sections = zoneStats.map((z) => {
        const zDiff = z.totalPixels ? (z.diffPixels / z.totalPixels) * 100 : 0;
        return {
          zone: z.zone,
          label: z.label,
          similarityPercent: Number((100 - zDiff).toFixed(2)),
          diffPercent: Number(zDiff.toFixed(2)),
        };
      });

      return {
        refDimensions: { width: refImg.width, height: refImg.height },
        implDimensions: { width: implImg.width, height: implImg.height },
        comparedDimensions: { width, height },
        totalPixels,
        diffPixels,
        diffPercent,
        similarityPercent,
        sections,
        mae: Number(mae.toFixed(2)),
        rmse: Number(rmse.toFixed(2)),
        diffDataUrl,
        overlayDataUrl,
      };
    }, {
      refUrl,
      implUrl,
      threshold: opts.threshold,
      wantDiff: Boolean(opts.diff),
      wantOverlay: Boolean(opts.overlay),
      zones: opts.zones,
    });

    if (opts.diff && result.diffDataUrl) {
      fs.mkdirSync(path.dirname(opts.diff), { recursive: true });
      fs.writeFileSync(opts.diff, Buffer.from(result.diffDataUrl.split(',')[1], 'base64'));
    }
    if (opts.overlay && result.overlayDataUrl) {
      fs.mkdirSync(path.dirname(opts.overlay), { recursive: true });
      fs.writeFileSync(opts.overlay, Buffer.from(result.overlayDataUrl.split(',')[1], 'base64'));
    }

    const { diffDataUrl, overlayDataUrl, ...rawSummary } = result;
    const summary = {
      viewport: opts.viewport,
      targetSimilarity: opts.targetSimilarity,
      meetsTarget: rawSummary.similarityPercent >= opts.targetSimilarity,
      ...rawSummary,
    };
    if (opts.out) {
      fs.mkdirSync(path.dirname(opts.out), { recursive: true });
      fs.writeFileSync(opts.out, JSON.stringify(summary, null, 2), 'utf8');
    }
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
