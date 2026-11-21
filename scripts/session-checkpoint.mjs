#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

/**
 * Session Checkpoint helper for LandingFactory (/resume-landing).
 * Persists lightweight orchestration state in docs/design/session-checkpoint.json
 * with corrupt-JSON recovery and artifact/source staleness detection.
 */

const SCHEMA_VERSION = 1;

function parseArgs(argv) {
  const opts = {
    action: 'read', // read | write
    file: path.resolve('docs/design/session-checkpoint.json'),
    projectDir: null,
    command: null,
    phase: null,
    status: 'in_progress',
    nextStep: null,
    note: null,
    completedSteps: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') opts.action = 'write';
    else if (a === '--read') opts.action = 'read';
    else if (a === '--file') opts.file = path.resolve(argv[++i]);
    else if (a === '--project-dir') opts.projectDir = path.resolve(argv[++i]);
    else if (a === '--command') opts.command = argv[++i];
    else if (a === '--phase') opts.phase = argv[++i];
    else if (a === '--status') opts.status = argv[++i];
    else if (a === '--next-step') opts.nextStep = argv[++i];
    else if (a === '--note') opts.note = argv[++i];
    else if (a === '--completed') opts.completedSteps = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return opts;
}

function safeReadCheckpoint(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, corrupt: false, data: null };
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { exists: true, corrupt: true, error: 'El checkpoint no es un objeto JSON válido', data: null };
    }
    // Migrate legacy v0 checkpoints transparently
    if (!parsed.schemaVersion) parsed.schemaVersion = SCHEMA_VERSION;
    return { exists: true, corrupt: false, data: parsed };
  } catch (err) {
    return { exists: true, corrupt: true, error: err.message, data: null };
  }
}

function findNewerProjectFiles(projectDir, checkpointIso) {
  if (!projectDir || !fs.existsSync(projectDir) || !checkpointIso) return [];
  const cpTime = Date.parse(checkpointIso);
  if (Number.isNaN(cpTime)) return [];
  const newer = [];
  const candidates = ['index.html', 'styles.css', 'package.json', 'src'];
  for (const name of candidates) {
    const full = path.join(projectDir, name);
    if (!fs.existsSync(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isFile() && stat.mtimeMs > cpTime + 1000) {
      newer.push(name);
    } else if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
        if (entry.isFile()) {
          const es = fs.statSync(path.join(full, entry.name));
          if (es.mtimeMs > cpTime + 1000) newer.push(path.join(name, entry.name));
        }
      }
    }
  }
  return newer;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const readRes = safeReadCheckpoint(opts.file);

  if (opts.action === 'read') {
    if (!readRes.exists) {
      console.log(JSON.stringify({ exists: false, corrupt: false, file: opts.file }, null, 2));
      return;
    }
    if (readRes.corrupt) {
      console.log(JSON.stringify({
        exists: true,
        corrupt: true,
        file: opts.file,
        error: readRes.error,
        recoveryAdvice: 'Checkpoint corrupto: inspeccionar docs/design/ y git status antes de sobrescribir o reanudar desde FASE 0.',
      }, null, 2));
      process.exitCode = 2;
      return;
    }
    const projectDir = opts.projectDir || path.resolve(path.dirname(opts.file), '..', '..');
    const modifiedAfterCheckpoint = findNewerProjectFiles(projectDir, readRes.data.updatedAt);
    console.log(JSON.stringify({
      exists: true,
      corrupt: false,
      file: opts.file,
      stale: modifiedAfterCheckpoint.length > 0,
      modifiedAfterCheckpoint,
      checkpoint: readRes.data,
    }, null, 2));
    return;
  }

  // Write mode: backup corrupt checkpoint instead of silently losing evidence
  if (readRes.corrupt) {
    const backupPath = `${opts.file}.corrupt-${Date.now()}.bak`;
    fs.copyFileSync(opts.file, backupPath);
  }

  const existing = readRes.data || {};
  const next = {
    schemaVersion: SCHEMA_VERSION,
    command: opts.command || existing.command || 'unknown',
    phase: opts.phase || existing.phase || 'FASE 0',
    status: opts.status || 'in_progress',
    completedSteps: opts.completedSteps || existing.completedSteps || [],
    nextStep: opts.nextStep !== null ? opts.nextStep : (existing.nextStep || null),
    note: opts.note !== null ? opts.note : (existing.note || null),
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(opts.file), { recursive: true });
  fs.writeFileSync(opts.file, JSON.stringify(next, null, 2), 'utf8');
  console.log(JSON.stringify({ saved: true, recoveredFromCorrupt: readRes.corrupt, file: opts.file, checkpoint: next }, null, 2));
}

main();
