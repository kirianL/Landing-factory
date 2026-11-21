#!/usr/bin/env node
import { VisualAssetEngine } from './visual-engine/engine.mjs';

function parseArgs(argv) {
  const [command = 'status', ...rest] = argv;
  const opts = { command, project: 'default', prompt: null, model: null, size: null };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--project' || a === '-p') opts.project = rest[++i] || 'default';
    else if (a === '--prompt') opts.prompt = rest[++i] || null;
    else if (a === '--model') opts.model = rest[++i] || null;
    else if (a === '--size') opts.size = rest[++i] || null;
    else if (a === '--help' || a === '-h') opts.command = 'help';
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.command === 'help') {
    console.log(`
Uso:
  node scripts/visual-engine.mjs <comando> [opciones]

Comandos:
  status            Muestra estado del motor, proveedor y presupuesto (default)
  models            Lista los modelos configurados y su estimación de créditos
  usage             Muestra resumen de créditos y ledger del proyecto
  plan              Genera un plan visual completo en DRY_RUN (sin consumir créditos)
  run-plan          Ejecuta el Asset Pipeline completo sobre un plan en DRY_RUN
  test-connection   Consulta GET /users/me (solo lectura) para verificar token y saldo real
  generate          Ejecuta una generación (DRY_RUN por defecto salvo configuración LIVE)

Opciones:
  --project <id>    Identificador de proyecto (default: default)
  --prompt <texto>  Prompt para generate
  --model <id>      Modelo de Recraft
  --size <WxH>      Dimensiones (ej. 1024x1024)
`);
    return;
  }

  const engine = new VisualAssetEngine();

  if (opts.command === 'status') {
    console.log(JSON.stringify(engine.getStatus(opts.project), null, 2));
    return;
  }
  if (opts.command === 'models') {
    console.log(JSON.stringify(engine.listAvailableModels(), null, 2));
    return;
  }
  if (opts.command === 'usage') {
    console.log(JSON.stringify({
      summary: engine.creditManager.getSummary(opts.project),
      ledger: engine.creditManager.listLedger(opts.project),
    }, null, 2));
    return;
  }
  if (opts.command === 'plan') {
    const res = engine.planLandingVisuals({
      projectId: opts.project,
      businessType: 'SaaS B2B',
      sections: ['hero', 'features', 'services', 'pricing', 'faq', 'cta', 'footer'],
    });
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  if (opts.command === 'run-plan') {
    const plan = engine.planLandingVisuals({
      projectId: opts.project,
      businessType: 'SaaS B2B',
      sections: ['hero', 'features', 'services', 'pricing', 'faq', 'cta', 'footer'],
    });
    const manifest = await engine.executeVisualPlan(plan);
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  if (opts.command === 'test-connection') {
    const res = await engine.testConnection();
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  if (opts.command === 'generate') {
    const res = await engine.generateImage({
      projectId: opts.project,
      agent: 'cli',
      prompt: opts.prompt || 'Minimalist architectural studio interior, soft natural daylight',
      model: opts.model || undefined,
      size: opts.size || undefined,
    });
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  console.error(`Comando desconocido: ${opts.command}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, code: err.code || 'ERROR', error: err.message }, null, 2));
  process.exitCode = 1;
});
