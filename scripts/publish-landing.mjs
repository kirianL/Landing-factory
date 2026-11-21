#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FACTORY_ROOT = path.resolve(__dirname, '..');
const PROJECTS_ROOT = path.join(FACTORY_ROOT, 'projects');

const MANDATORY_GITIGNORE_RULES = [
  'node_modules/',
  '.next/',
  'dist/',
  'build/',
  '.env',
  '.env.*',
  '!.env.example',
  '*.log',
  '.opencode/',
  'docs/design/captures/',
  'docs/design/model-fallback-log.md',
  'docs/design/session-checkpoint.json',
  'docs/design/quality-gate*.json',
  'docs/design/compare-report.json',
];

const INTERNAL_EXCLUDE_PATTERNS = [
  /(^|[\\/])\.opencode([\\/]|$)/,
  /^docs[\\/]design[\\/]captures([\\/]|$)/,
  /^docs[\\/]design[\\/]model-fallback-log\.md$/,
  /^docs[\\/]design[\\/]session-checkpoint\.json(\.corrupt-.*\.bak)?$/,
  /^docs[\\/]design[\\/]quality-gate.*\.json$/,
  /^docs[\\/]design[\\/]compare-report\.json$/,
  /resolve-model-fallback\.mjs$/,
  /quality-gate\.mjs$/,
  /(^|[\\/])\.env(\..+)?$/,
  /\.log$/,
];

const SECRET_PATTERNS = [
  { name: 'OpenAI/OpenRouter-style key', regex: /\bsk-(?:or-v1-)?[a-zA-Z0-9_-]{20,}\b/g },
  { name: 'GitHub classic token', regex: /\bghp_[a-zA-Z0-9]{20,}\b/g },
  { name: 'GitHub fine-grained token', regex: /\bgithub_pat_[a-zA-Z0-9_]{20,}\b/g },
  { name: 'AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Google API key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'Private Key block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { name: 'URL with embedded credentials', regex: /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^/\s:@]+:[^/\s@]+@[^\s/]+/gi },
];

function parseArgs(argv) {
  const opts = {
    project: process.cwd(),
    repoName: null,
    owner: null,
    visibility: 'private',
    remoteUrl: null,
    build: 'not_run',        // pass | fail | na | not_run
    qualityGate: 'not_run',  // pass | warn | fail | not_run | path-to-json
    prepare: false,
    push: false,
    confirmPush: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') opts.project = argv[++i];
    else if (a === '--repo') opts.repoName = argv[++i];
    else if (a === '--owner') opts.owner = argv[++i];
    else if (a === '--visibility') opts.visibility = argv[++i] || 'private';
    else if (a === '--remote-url') opts.remoteUrl = argv[++i];
    else if (a === '--build') opts.build = (argv[++i] || 'not_run').toLowerCase();
    else if (a === '--quality-gate') opts.qualityGate = argv[++i] || 'not_run';
    else if (a === '--prepare') opts.prepare = true;
    else if (a === '--push') opts.push = true;
    else if (a === '--confirm-push') opts.confirmPush = true;
    else if (a === '--help' || a === '-h') {
      console.log(`
Uso:
  node publish-landing.mjs --project <projects/nombre> [opciones]

Opciones:
  --project, -p <ruta>      Ruta del proyecto dentro de projects/
  --repo <nombre>           Nombre del repositorio remoto
  --owner <usuario/org>     Cuenta u organización en GitHub
  --visibility <priv|pub>   private (default) | public
  --remote-url <url>        URL remota explícita (ej. https://github.com/org/repo.git)
  --build <estado>          pass | fail | na | not_run
  --quality-gate <val>      pass | warn | fail | not_run | <ruta-a-quality-gate.json>
  --prepare                 Crea/actualiza .gitignore, inicializa Git si falta y prepara staging seguro
  --push                    Solicita push remoto (requiere --confirm-push y Quality Gate aprobado)
  --confirm-push            Autorización explícita del usuario para ejecutar git push
`);
      process.exit(0);
    }
  }
  return opts;
}

function validateProjectDir(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return { ok: false, reason: `El directorio no existe: ${resolved}` };
  }
  const realResolved = fs.realpathSync(resolved);
  const realFactoryRoot = fs.realpathSync(FACTORY_ROOT);
  const realProjectsRoot = fs.existsSync(PROJECTS_ROOT) ? fs.realpathSync(PROJECTS_ROOT) : PROJECTS_ROOT;

  if (realResolved.toLowerCase() === realFactoryRoot.toLowerCase()) {
    return { ok: false, reason: 'Bloqueado: no se puede ejecutar /publish-landing sobre la raíz de LandingFactory.' };
  }
  const rel = path.relative(realProjectsRoot, realResolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.includes(path.sep)) {
    return {
      ok: false,
      reason: `Bloqueado: el proyecto debe estar directamente dentro de ${realProjectsRoot}\\<nombre-proyecto>. Recibido: ${realResolved}`,
    };
  }
  return { ok: true, resolved: realResolved, projectName: rel };
}

function walkFiles(dir, baseDir = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === '.next') {
      continue;
    }
    const full = path.join(dir, entry.name);
    const rel = path.relative(baseDir, full);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, baseDir));
    } else {
      results.push({ full, rel });
    }
  }
  return results;
}

function isExcludedInternal(relPath) {
  if (path.basename(relPath) === '.env.example') return false;
  return INTERNAL_EXCLUDE_PATTERNS.some((rx) => rx.test(relPath));
}

function scanSecrets(files) {
  const findings = [];
  for (const f of files) {
    if (isExcludedInternal(f.rel)) continue;
    const ext = path.extname(f.rel).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.avif', '.ico', '.woff2', '.woff', '.ttf', '.pdf'].includes(ext)) {
      continue;
    }
    let content = '';
    try {
      content = fs.readFileSync(f.full, 'utf8');
    } catch {
      continue;
    }
    for (const pat of SECRET_PATTERNS) {
      pat.regex.lastIndex = 0;
      if (pat.regex.test(content)) {
        findings.push({ file: f.rel, rule: pat.name });
      }
    }
  }
  return findings;
}

function ensureGitignore(projectDir, writeChanges) {
  const giPath = path.join(projectDir, '.gitignore');
  const existed = fs.existsSync(giPath);
  const existingContent = existed ? fs.readFileSync(giPath, 'utf8') : '';
  const existingLines = new Set(existingContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  const missingRules = MANDATORY_GITIGNORE_RULES.filter((r) => !existingLines.has(r));

  if (writeChanges && (!existed || missingRules.length > 0)) {
    const prefix = existingContent && !existingContent.endsWith('\n') ? `${existingContent}\n` : existingContent;
    const blockHeader = existed ? '\n# LandingFactory publish exclusions\n' : '# Landing dependencies, build & secrets\n';
    const nextContent = `${prefix}${missingRules.length ? blockHeader + missingRules.join('\n') + '\n' : ''}`;
    fs.writeFileSync(giPath, nextContent, 'utf8');
  }

  return { existed, missingRulesAdded: missingRules, path: giPath };
}

function resolveQualityGate(qgArg) {
  if (qgArg === 'pass' || qgArg === 'warn') return { ok: true, verdict: qgArg === 'pass' ? 'READY' : 'READY_WITH_WARNINGS' };
  if (qgArg === 'fail' || qgArg === 'not_run') return { ok: false, verdict: qgArg === 'fail' ? 'BLOCKED' : 'NOT_RUN' };
  const resolved = path.resolve(qgArg);
  if (!fs.existsSync(resolved)) return { ok: false, verdict: 'NOT_FOUND' };
  const json = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const ok = json.verdict === 'READY' || json.verdict === 'READY_WITH_WARNINGS';
  return { ok, verdict: json.verdict || 'UNKNOWN', reportPath: resolved };
}

function runGit(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dirCheck = validateProjectDir(opts.project);
  if (!dirCheck.ok) {
    console.log(JSON.stringify({ status: 'BLOCKED', stage: 'directory_validation', reason: dirCheck.reason }, null, 2));
    process.exitCode = 2;
    return;
  }

  const projectDir = dirCheck.resolved;
  const allFiles = walkFiles(projectDir);
  const excludedFiles = allFiles.filter((f) => isExcludedInternal(f.rel)).map((f) => f.rel);
  const includedFiles = allFiles.filter((f) => !isExcludedInternal(f.rel)).map((f) => f.rel);

  const secretFindings = scanSecrets(allFiles);
  const giInfo = ensureGitignore(projectDir, opts.prepare);
  const qg = resolveQualityGate(opts.qualityGate);
  const buildOk = opts.build === 'pass' || opts.build === 'na';

  const hasGit = fs.existsSync(path.join(projectDir, '.git'));
  let gitStatusBefore = [];
  let existingRemotes = [];
  if (hasGit) {
    const st = runGit(projectDir, ['status', '--porcelain']);
    gitStatusBefore = st ? st.split(/\r?\n/) : [];
    const rem = runGit(projectDir, ['remote', '-v']);
    existingRemotes = rem ? rem.split(/\r?\n/) : [];
  }

  const blockers = [];
  if (secretFindings.length > 0) {
    blockers.push(`Secretos detectados en ${secretFindings.length} archivo(s): ${secretFindings.map((s) => `${s.file} (${s.rule})`).join(', ')}`);
  }
  if (!buildOk) blockers.push(`Build no aprobado (${opts.build})`);
  if (!qg.ok) blockers.push(`Quality Gate no aprobado (${qg.verdict})`);

  if (opts.prepare && secretFindings.length === 0) {
    if (!hasGit) {
      runGit(projectDir, ['init']);
    }
    // Selective safe staging: add only non-excluded files + .gitignore
    const toStage = [...new Set([...includedFiles, '.gitignore'])].filter((rel) => fs.existsSync(path.join(projectDir, rel)));
    if (toStage.length > 0) {
      runGit(projectDir, ['add', '--', ...toStage]);
    }
  }

  let status = 'PREPARED';
  let pushExecuted = false;
  let pushNote = 'No se ejecutó git push.';

  if (blockers.length > 0) {
    status = 'BLOCKED';
    if (opts.push) pushNote = 'Push bloqueado por fallos de validación/seguridad.';
  } else if (opts.push && !opts.confirmPush) {
    status = 'AWAITING_APPROVAL';
    pushNote = 'Falta autorización explícita (--confirm-push) para ejecutar git push.';
  } else if (opts.push && opts.confirmPush) {
    const remoteTarget = opts.remoteUrl || (existingRemotes.length > 0 ? 'origin' : null);
    if (!remoteTarget) {
      status = 'AWAITING_APPROVAL';
      pushNote = 'No hay remoto configurado; especifica --remote-url o crea el repositorio remoto primero.';
    } else {
      if (opts.remoteUrl && existingRemotes.length === 0) {
        runGit(projectDir, ['remote', 'add', 'origin', opts.remoteUrl]);
      }
      const staged = runGit(projectDir, ['diff', '--cached', '--name-only']);
      if (staged) {
        runGit(projectDir, ['commit', '-m', `feat: publish ${dirCheck.projectName} standalone landing`]);
      }
      runGit(projectDir, ['push', '-u', 'origin', 'HEAD']);
      pushExecuted = true;
      status = 'PUBLISHED';
      pushNote = 'Push ejecutado correctamente en el repositorio remoto.';
    }
  } else {
    status = opts.prepare ? 'AWAITING_APPROVAL' : 'PREPARED';
  }

  const report = {
    status,
    project: dirCheck.projectName,
    localPath: projectDir,
    remote: opts.remoteUrl || (existingRemotes[0] || (opts.owner && opts.repoName ? `https://github.com/${opts.owner}/${opts.repoName}.git` : 'Pendiente de configurar')),
    visibility: opts.visibility,
    pushExecuted,
    pushNote,
    build: opts.build,
    qualityGate: qg,
    secretAudit: {
      clean: secretFindings.length === 0,
      findings: secretFindings,
    },
    gitignore: giInfo,
    git: {
      hadGit: hasGit,
      uncommittedBefore: gitStatusBefore.length,
      existingRemotes,
    },
    filesIncludedCount: includedFiles.length,
    filesExcludedCount: excludedFiles.length,
    excludedFiles,
    blockers,
  };

  console.log(JSON.stringify(report, null, 2));
  if (status === 'BLOCKED') process.exitCode = 2;
}

main();
