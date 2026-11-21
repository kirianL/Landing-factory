#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

/**
 * LandingFactory Quality Gate
 *
 * Evaluates build, Playwright responsive/console/network checks, visual QA,
 * technical code review, and basic accessibility before allowing a landing
 * page to be declared complete. Never marks unexecuted checks as PASS.
 */

function parseArgs(argv) {
  const opts = {
    capturesReport: path.resolve('docs/design/captures/report.json'),
    visualQaFile: path.resolve('docs/design/visual-qa.md'),
    compareReport: null,
    build: 'not_run',      // pass | fail | na | not_run
    a11y: 'not_run',       // pass | fail | na | not_run
    visualQa: 'auto',      // auto | pass | fail | na | not_run
    codeReview: 'not_run', // pass | fail | na | not_run
    out: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--captures-report') opts.capturesReport = path.resolve(argv[++i]);
    else if (arg === '--visual-qa-file') opts.visualQaFile = path.resolve(argv[++i]);
    else if (arg === '--compare-report') opts.compareReport = path.resolve(argv[++i]);
    else if (arg === '--build') opts.build = (argv[++i] || 'not_run').toLowerCase();
    else if (arg === '--a11y') opts.a11y = (argv[++i] || 'not_run').toLowerCase();
    else if (arg === '--visual-qa') opts.visualQa = (argv[++i] || 'auto').toLowerCase();
    else if (arg === '--code-review') opts.codeReview = (argv[++i] || 'not_run').toLowerCase();
    else if (arg === '--out') opts.out = path.resolve(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Uso:
  node quality-gate.mjs [opciones]

Opciones:
  --captures-report <path>  Ruta a report.json de Playwright (default: docs/design/captures/report.json)
  --visual-qa-file <path>   Ruta a docs/design/visual-qa.md
  --compare-report <path>   Ruta opcional a JSON de compare-screenshots.mjs
  --build <estado>          pass | fail | na | not_run
  --a11y <estado>           pass | fail | na | not_run
  --visual-qa <estado>      auto | pass | fail | na | not_run
  --code-review <estado>    pass | fail | na | not_run
  --out <path>              Guardar resultado JSON del Quality Gate
`);
      process.exit(0);
    }
  }
  return opts;
}

function resolveVisualQaStatus(opts) {
  if (opts.visualQa !== 'auto') return { status: opts.visualQa, evidence: `flag:${opts.visualQa}` };
  if (!fs.existsSync(opts.visualQaFile)) {
    return { status: 'not_run', evidence: 'visual-qa.md no encontrado' };
  }
  const content = fs.readFileSync(opts.visualQaFile, 'utf8');
  if (/Veredicto.*:\s*PASS\b/i.test(content) || /\*\*Veredicto.*PASS\*\*/i.test(content)) {
    return { status: 'pass', evidence: opts.visualQaFile };
  }
  if (/NEEDS_FIXES|FAIL/i.test(content)) {
    return { status: 'fail', evidence: opts.visualQaFile };
  }
  return { status: 'not_run', evidence: 'Veredicto no concluyente en visual-qa.md' };
}

function getLatestSourceMtime(projectDir) {
  if (!projectDir || !fs.existsSync(projectDir)) return 0;
  let latest = 0;
  const targets = ['index.html', 'styles.css', 'src'];
  for (const t of targets) {
    const full = path.join(projectDir, t);
    if (!fs.existsSync(full)) continue;
    const st = fs.statSync(full);
    if (st.isFile()) {
      latest = Math.max(latest, st.mtimeMs);
    } else if (st.isDirectory()) {
      for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
        if (entry.isFile()) {
          latest = Math.max(latest, fs.statSync(path.join(full, entry.name)).mtimeMs);
        }
      }
    }
  }
  return latest;
}

function evaluatePlaywright(reportPath, sourceDir) {
  if (!fs.existsSync(reportPath)) {
    return {
      responsive: { status: 'not_run', detail: 'report.json no encontrado' },
      consoleNetwork: { status: 'not_run', detail: 'report.json no encontrado' },
    };
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (err) {
    return {
      responsive: { status: 'fail', detail: `report.json corrupto: ${err.message}` },
      consoleNetwork: { status: 'fail', detail: `report.json corrupto: ${err.message}` },
    };
  }

  const capturedAtMs = data?.capturedAt ? Date.parse(data.capturedAt) : fs.statSync(reportPath).mtimeMs;
  const latestSrcMs = getLatestSourceMtime(sourceDir);
  if (latestSrcMs > capturedAtMs + 1000) {
    return {
      responsive: { status: 'fail', detail: 'report.json desactualizado respecto a archivos fuente modificados después de la captura' },
      consoleNetwork: { status: 'fail', detail: 'report.json desactualizado respecto a archivos fuente modificados' },
    };
  }
  const results = Array.isArray(data?.results) ? data.results : [];
  const requiredSizes = ['1440x900', '768x1024', '390x844'];
  const capturedSizes = results.map((r) => `${r.viewport?.width}x${r.viewport?.height}`);
  const missingSizes = requiredSizes.filter((s) => !capturedSizes.includes(s));

  const overflowViewports = results
    .filter((r) => r.metrics?.hasHorizontalOverflow)
    .map((r) => `${r.viewport?.name}(${r.viewport?.width}x${r.viewport?.height})`);

  const totalConsole = results.reduce((acc, r) => acc + (r.consoleErrors?.length || 0), 0);
  const totalPage = results.reduce((acc, r) => acc + (r.pageErrors?.length || 0), 0);
  const totalFailedReq = results.reduce((acc, r) => acc + (r.failedRequests?.length || 0), 0);

  const responsiveOk = missingSizes.length === 0 && overflowViewports.length === 0;
  const consoleOk = totalConsole === 0 && totalPage === 0 && totalFailedReq === 0;

  return {
    responsive: {
      status: responsiveOk ? 'pass' : 'fail',
      detail: responsiveOk
        ? `3/3 viewports (${requiredSizes.join(', ')}) sin overflow horizontal`
        : `Faltantes: [${missingSizes.join(', ')}]; Overflow: [${overflowViewports.join(', ')}]`,
    },
    consoleNetwork: {
      status: consoleOk ? 'pass' : 'fail',
      detail: `consoleErrors=${totalConsole}, pageErrors=${totalPage}, failedRequests=${totalFailedReq}`,
    },
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const inferredProjectDir = path.resolve(path.dirname(opts.capturesReport), '..', '..', '..');
  const pw = evaluatePlaywright(opts.capturesReport, inferredProjectDir);
  const vqa = resolveVisualQaStatus(opts);

  const checks = [
    { id: 'build', label: 'Build y compilación', status: opts.build, evidence: `flag:${opts.build}` },
    { id: 'responsive', label: 'Responsive sin overflow (1440/768/390)', status: pw.responsive.status, evidence: pw.responsive.detail },
    { id: 'console_network', label: 'Sin errores críticos de consola o red', status: pw.consoleNetwork.status, evidence: pw.consoleNetwork.detail },
    { id: 'visual_qa', label: 'Revisión visual aprobada', status: vqa.status, evidence: vqa.evidence },
    { id: 'code_review', label: 'Revisión técnica aprobada', status: opts.codeReview, evidence: `flag:${opts.codeReview}` },
    { id: 'a11y', label: 'Accesibilidad básica verificada', status: opts.a11y, evidence: `flag:${opts.a11y}` },
  ];

  if (opts.compareReport && fs.existsSync(opts.compareReport)) {
    const cmp = JSON.parse(fs.readFileSync(opts.compareReport, 'utf8'));
    const similarityOk = cmp.meetsTarget !== false;
    checks.push({
      id: 'visual_similarity',
      label: 'Similitud visual contra referencia',
      status: similarityOk ? 'pass' : 'warning',
      evidence: `similarity=${cmp.similarityPercent}%, target=${cmp.targetSimilarity ?? 'N/A'}%`,
    });
  }

  const blockers = [];
  const warnings = [];
  const passed = [];
  const notApplicable = [];

  for (const c of checks) {
    if (c.status === 'pass') {
      passed.push(c);
    } else if (c.status === 'na') {
      notApplicable.push(c);
    } else if (c.status === 'warning') {
      warnings.push(c);
    } else {
      // fail or not_run are both blocking: never declare PASS on unexecuted checks
      blockers.push({
        ...c,
        reason: c.status === 'not_run' ? 'Comprobación no ejecutada (prohibido declarar PASS)' : 'Comprobación fallida',
      });
    }
  }

  const verdict = blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'READY_WITH_WARNINGS' : 'READY';
  const summary = {
    verdict,
    checkedAt: new Date().toISOString(),
    counts: {
      passed: passed.length,
      warnings: warnings.length,
      blockers: blockers.length,
      notApplicable: notApplicable.length,
    },
    blockers,
    warnings,
    passed,
    notApplicable,
  };

  if (opts.out) {
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.writeFileSync(opts.out, JSON.stringify(summary, null, 2), 'utf8');
  }

  console.log(JSON.stringify(summary, null, 2));
  if (verdict === 'BLOCKED') process.exitCode = 2;
}

main();
