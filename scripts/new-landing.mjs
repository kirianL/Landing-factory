#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const factoryRoot = path.resolve(__dirname, '..');
const templateDir = path.join(factoryRoot, 'templates', 'landing-project');
const defaultProjectsDir = path.join(factoryRoot, 'projects');

function printUsage() {
  console.log(`
Uso:
  npm run new-landing -- <nombre-proyecto> [--dir <ruta-destino>]

Ejemplo:
  npm run new-landing -- acme-saas
  npm run new-landing -- mi-landing --dir C:\\Users\\Kirian\\Desktop\\mi-landing
`);
}

function parseArgs(argv) {
  let projectName = null;
  let customDir = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--dir' || arg === '-d') {
      customDir = argv[++i];
    } else if (!arg.startsWith('-') && !projectName) {
      projectName = arg;
    }
  }

  return { projectName, customDir };
}

function validateName(name) {
  if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
    console.error('Error: Debes indicar un nombre de proyecto válido (solo letras, números, ".", "_" o "-").');
    printUsage();
    process.exit(1);
  }
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const { projectName, customDir } = parseArgs(process.argv.slice(2));
validateName(projectName);

if (!fs.existsSync(templateDir)) {
  console.error(`Error: No se encontró la plantilla en ${templateDir}`);
  process.exit(1);
}

const targetDir = customDir
  ? path.resolve(customDir)
  : path.join(defaultProjectsDir, projectName);

if (fs.existsSync(targetDir)) {
  console.error(`Error: El destino ya existe y no será sobrescrito: ${targetDir}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(targetDir), { recursive: true });
copyDirRecursive(templateDir, targetDir);

// Personalizar título en README.md del nuevo proyecto
const readmePath = path.join(targetDir, 'README.md');
if (fs.existsSync(readmePath)) {
  const content = fs.readFileSync(readmePath, 'utf8');
  fs.writeFileSync(
    readmePath,
    content.replace('# Proyecto LandingFactory', `# ${projectName}`),
    'utf8'
  );
}

console.log(`
Proyecto creado correctamente:
  ${targetDir}

Estructura generada:
  - references/    (coloca aquí desktop.png, mobile.png, etc.)
  - assets/        (coloca aquí logos, fotos o recursos propios)
  - docs/design/   (aquí se guardarán los análisis y planes)
  - AGENTS.md      (reglas de LandingFactory)
  - README.md

Siguientes pasos:
  1. Copia tus screenshots de referencia en: ${path.join(targetDir, 'references')}
  2. Abre la carpeta en T3 Code: ${targetDir}
  3. Selecciona el modelo Gemini 4 Hydrogen
  4. Ejecuta: /build-landing
`);
