#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const opts = {
    url: null,
    out: path.resolve('docs/design/captures'),
    viewports: [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 390, height: 844 },
    ],
    reducedMotion: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url' || arg === '-u') {
      opts.url = argv[++i];
    } else if (arg === '--out' || arg === '-o') {
      opts.out = path.resolve(argv[++i]);
    } else if (arg === '--reduced-motion') {
      opts.reducedMotion = true;
    } else if (arg === '--viewports' || arg === '-v') {
      const raw = argv[++i] || '';
      opts.viewports = raw.split(',').filter(Boolean).map((entry) => {
        const [name, dims] = entry.includes(':') ? entry.split(':') : [entry, entry];
        const [w, h] = dims.toLowerCase().split('x').map(Number);
        if (!w || !h) {
          throw new Error(`Viewport inválido: ${entry}. Usa formato nombre:ANCHO x ALTO (ej. custom:1280x720)`);
        }
        return { name, width: w, height: h };
      });
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Uso:
  node capture-landing.mjs --url <http://localhost:3000> [--out docs/design/captures] [--viewports desktop:1440x900,tablet:768x1024,mobile:390x844] [--reduced-motion]
`);
      process.exit(0);
    }
  }

  if (!opts.url) {
    console.error('Error: Debes especificar --url <url>');
    process.exit(1);
  }
  return opts;
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.out, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const vp of opts.viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference',
      });
      const page = await context.newPage();

      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });
      page.on('response', (res) => {
        if (res.status() >= 400) {
          failedRequests.push({ url: res.url(), status: res.status() });
        }
      });

      await page.goto(opts.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          scrollHeight: doc.scrollHeight,
          hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth,
          title: document.title,
        };
      });

      const viewportFile = path.join(opts.out, `${vp.name}-${vp.width}x${vp.height}-viewport.png`);
      const fullFile = path.join(opts.out, `${vp.name}-${vp.width}x${vp.height}-full.png`);

      await page.screenshot({ path: viewportFile, fullPage: false });
      await page.screenshot({ path: fullFile, fullPage: true });

      results.push({
        viewport: vp,
        viewportScreenshot: viewportFile,
        fullPageScreenshot: fullFile,
        metrics,
        consoleErrors,
        pageErrors,
        failedRequests,
      });

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const reportPath = path.join(opts.out, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ url: opts.url, capturedAt: new Date().toISOString(), results }, null, 2), 'utf8');

  console.log(JSON.stringify({ reportPath, summary: results.map(r => ({
    name: r.viewport.name,
    size: `${r.viewport.width}x${r.viewport.height}`,
    scrollHeight: r.metrics.scrollHeight,
    horizontalOverflow: r.metrics.hasHorizontalOverflow,
    consoleErrors: r.consoleErrors.length,
    pageErrors: r.pageErrors.length,
    failedRequests: r.failedRequests.length,
  })) }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
