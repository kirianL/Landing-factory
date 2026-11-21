# Auditoría Final de Estabilidad — LandingFactory

- **Fecha de auditoría**: 2026-11-20
- **Rama / Commit base**: `main` (`bd933e0 Merge pull request #1 from kirianL/feat/quality-gate`)
- **Veredicto final**: **`STABLE_WITH_WARNINGS`** (sin hallazgos críticos ni altos pendientes; 2 limitaciones reales de plataforma documentadas)

---

## 1. Archivos Inspeccionados

- **Raíz y configuración**: `AGENTS.md`, `opencode.json`, `package.json`, `README.md`, `.gitignore`
- **Documentación**: `docs/architecture.md`, `docs/workflow.md`, `docs/setup.md`
- **Subagentes (`.opencode/agents/`)**: `visual-analyst.md`, `ui-ux-designer.md`, `asset-researcher.md`, `implementation-planner.md`, `visual-qa.md`, `code-reviewer.md`
- **Comandos (`.opencode/commands/`)**: `build-landing.md`, `modify-landing.md`, `review-landing.md`, `resume-landing.md`, `publish-landing.md`
- **Scripts (`scripts/`)**: `new-landing.mjs`, `capture-landing.mjs`, `compare-screenshots.mjs`, `resolve-model-fallback.mjs`, `session-checkpoint.mjs`, `publish-landing.mjs`, `quality-gate.mjs`, `setup-global.ps1`
- **Plantilla (`templates/landing-project/`)** y junctions globales (`~\.config\opencode\agents`, `~\.config\opencode\commands`)

---

## 2. Hallazgos y Correcciones Realizadas

| ID | Severidad | Componente | Problema Detectado | Corrección Aplicada |
|---|---|---|---|---|
| F1 | **CRITICAL** | `scripts/publish-landing.mjs` | `validateProjectDir` usaba `path.resolve` sin resolver symlinks/junctions (`realpathSync`), permitiendo potencial escape fuera de `projects/`. | Añadida validación con `fs.realpathSync` sobre `FACTORY_ROOT`, `PROJECTS_ROOT` y el directorio objetivo. |
| F2 | **HIGH** | `scripts/publish-landing.mjs` | El escáner de secretos no detectaba credenciales embebidas en URLs (`https://user:pass@host`) ni archivos `.env.*` en subdirectorios. | Añadido patrón para URLs con credenciales y regla `(^\|[\\/])\.env(\..+)?$` para subdirectorios (conservando `.env.example`). |
| F3 | **HIGH** | `scripts/session-checkpoint.mjs` | Un archivo `session-checkpoint.json` corrupto lanzaba `SyntaxError` sin captura; tampoco detectaba archivos fuente modificados tras el checkpoint. | Implementado `safeReadCheckpoint` con respaldo `.corrupt-<ts>.bak` al reescribir y detección de `stale` (`modifiedAfterCheckpoint`). |
| F4 | **HIGH** | `scripts/quality-gate.mjs` | `evaluatePlaywright` no validaba JSON corrupto ni si `report.json` era anterior a modificaciones recientes en código fuente. | Añadido `try/catch` para JSON corrupto y comparación de timestamp contra `index.html`, `styles.css` y `src/`. |

---

## 3. Pruebas Ejecutadas y Evidencias

1. **Checkpoints y recuperación (`session-checkpoint.mjs`)**:
   - Lectura inexistente (`exists: false`), escritura normal (`schemaVersion: 1`), lectura de JSON corrupto (`corrupt: true`), recuperación con respaldo `.corrupt-*.bak` (`recoveredFromCorrupt: true`) y detección de archivos modificados tras el checkpoint (`stale: true`, `modifiedAfterCheckpoint: ["index.html"]`).
2. **Fallback multiagente (`resolve-model-fallback.mjs` + `delegate_task`)**:
   - Probado con catálogo vivo (`393` modelos, `22` gratuitos) y fallos reales (`Provider returned error` en Gemma 4 y `Free usage limit reached` en OpenCode free tier), rotando correctamente hacia `openrouter/nvidia/nemotron-3.5-super-vl:free` (multimodal) y `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` (código), bloqueando modelos solo-texto para Perfil A y modelos de pago.
3. **Seguridad de publicación (`publish-landing.mjs`)**:
   - Bloqueo de traversal `projects/../scripts` (`BLOCKED`).
   - Bloqueo de raíz de LandingFactory y rutas fuera de `projects/`.
   - Detección de secreto en URL (`api.js` → `BLOCKED`).
   - Exclusión de `config/.env.local`, `captures/`, `quality-gate.json`, `session-checkpoint.json` y `.bak`.
   - Sin `--confirm-push` devuelve `AWAITING_APPROVAL` con `pushExecuted: false`.
4. **Quality Gate (`quality-gate.mjs`)**:
   - Reporte válido y fresco → `READY` (`6 passed`, `1 notApplicable`).
   - Reporte desactualizado tras editar `index.html` → `BLOCKED` (`report.json desactualizado respecto a archivos fuente modificados después de la captura`).
   - `--build fail` y `not_run` → `BLOCKED` (`exit 2`).
5. **E2E `final-stability-test`**:
   - Creación con `new-landing.mjs`, captura Playwright en `1440×900`, `768×1024`, `390×844` (0 errores de consola/red, 0 overflow), comparación visual (`99.28%`), Quality Gate (`READY`), preparación de publicación (`AWAITING_APPROVAL`, sin push) y limpieza posterior del directorio temporal.

---

## 4. Limitaciones Reales y Riesgos Pendientes

1. **Fallback del coordinador en T3 Code**: T3 Code no expone un mecanismo programático para que el coordinador (`antigravity/gemini-4-hydrogen`) cambie su propio modelo activo a mitad de sesión. Ante límite/fallo del coordinador, el flujo seguro es guardar checkpoint (`session-checkpoint.mjs --write`), mostrar instrucciones de recuperación y reanudar con `/resume-landing` tras cambio manual de modelo.
2. **Cuotas de modelos gratuitos**: los proveedores gratuitos (`opencode/*-free`, `openrouter/*:free`) pueden agotar cuota en ráfagas intensivas, requiriendo esperar renovación o contar con más de un proveedor gratuito habilitado.
3. **Pruebas no ejecutadas**: no se realizó `git push` real a GitHub durante esta auditoría por restricción explícita de seguridad (el push autorizado se validó previamente contra un repositorio bare local aislado).
