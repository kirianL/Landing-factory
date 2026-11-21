# Pipeline de Ejecución (`/build-landing`, `/modify-landing` y `/review-landing`)

| Comando | Función |
|---|---|
| `/build-landing` | Crear o reconstruir una landing page desde cero a partir de `references/`. |
| `/modify-landing` | Modificar una landing page existente de forma controlada y verificada. |
| `/review-landing` | Auditar visual y técnicamente una landing sin modificarla. |
| `/resume-landing` | Reanudar una sesión interrumpida leyendo `docs/design/session-checkpoint.json`. |
| `/publish-landing` | Preparar y publicar un proyecto de `projects/` en GitHub de forma independiente. |

## Fases de `/build-landing`

0. **Fase 0 — Inspección**: Verifica `references/` (si está vacío, se detiene y pide capturas), detecta `assets/`, framework y git.
1. **Fase 1 — Análisis Paralelo**: `visual-analyst`, `ui-ux-designer` y `asset-researcher` analizan los screenshots en paralelo y generan sus informes (`docs/design/visual-analysis.md`, `design-system.md`, `asset-inventory.md`).
2. **Fase 2 — Planificación**: `implementation-planner` consolida los tres informes en `docs/design/implementation-plan.md`.
3. **Fase 3 — Preparación de Assets**: Gemini Hydrogen recupera assets locales, genera los faltantes respetando composición/iluminación y prepara SVGs para iconos.
4. **Fase 4 — Implementación**: Gemini Hydrogen implementa de macro a micro siguiendo `design-to-code`.
5. **Fase 5 — Renderizado**: Levanta el servidor local y ejecuta `capture-landing.mjs` en `1440×900`, `768×1024` y `390×844`.
6. **Fase 6 — Comparación**: Ejecuta `compare-screenshots.mjs` + `visual-qa`. Gemini Hydrogen corrige en orden de prioridad (mínimo 2 pasadas si hay discrepancias, máximo 3 por defecto).
7. **Fase 7 — Auditoría**: `code-reviewer` audita código, A11y, SEO, rendimiento y consola. Gemini Hydrogen corrige lo relevante.
8. **Fase 8 — Entrega**: Resumen de arquitectura, assets, capturas y veredicto (`READY`, `READY WITH SUBSTITUTIONS`, `NOT READY`, `UNVERIFIED`).

## Flujo de `/modify-landing`

0. **Fase 0 — Inspección y protección Git**: Detecta stack, archivos afectados, historial en `docs/design/` y revisa `git status` (sin descartar cambios ni hacer resets destructivos).
1. **Fase 1 — Clasificación**: Nivel 1 (pequeños), Nivel 2 (intermedios) o Nivel 3 (estructurales).
2. **Fase 2 — Selección condicional de subagentes**: Solo consulta los especialistas necesarios según el tipo de cambio, aplicando el sistema inteligente de fallback si un modelo principal falla.
3. **Fase 3 — Planificación**: Plan breve (Nivel 1), plan concreto (Nivel 2) o plan sujeto a aprobación explícita del usuario (Nivel 3).
4. **Fase 4 — Implementación**: Solo Gemini 4 Hydrogen modifica archivos dentro del alcance solicitado.
5. **Fase 5 — Verificación**: Pruebas del proyecto + Playwright (`1440×900`, `768×1024`, `390×844`, consola, red, overflow) + `@visual-qa` / `@code-reviewer` según impacto (máximo 3 rondas visuales).
6. **Fase 6 — Entrega**: Resumen de cambios, modelos/fallbacks utilizados, pruebas y pendientes.

## Flujo de `/review-landing`

Ejecuta directamente las Fases 5, 6 y 7 sobre un proyecto ya implementado para auditar fidelidad visual y calidad técnica sin reconstruir desde cero.

## Flujo de Fallback Inteligente de Modelos (6 Pasos)

1. Detectar y clasificar el fallo (`transient`, `rate_limit`, `quota_exhausted`, `unavailable`, `capability`, `permission_denied`, `auth`).
2. Ejecutar `node scripts/resolve-model-fallback.mjs --agent <nombre> --error-type <tipo> --failed-model <modelo> --exclude <fallidos> --state-file docs/design/model-health-state.json --log-file docs/design/model-fallback-log.md`. (Para autorizar último recurso incluido de sesión en Antigravity cuando no queden gratuitos verificados, añadir `--free-policy allow-included`).
3. Leer `selectedModel`, `executionTarget` (`providerInstanceId`, `model`, `executionMethod`) y `action` del JSON devuelto.
4. Volver a delegar `delegate_task` usando `executionTarget.providerInstanceId` y `executionTarget.model` (o detener si `action` es `STOP_*`).
5. Confirmar que el subagente respondió correctamente sin modificar los modelos principales configurados en `.opencode/agents/`.
6. Registrar el resultado en `docs/design/model-fallback-log.md` sin exponer claves ni tokens.

## Recuperación de Sesión (`/resume-landing`) y Publicación (`/publish-landing`)

- **Checkpoints (`scripts/session-checkpoint.mjs`)**: guarda el progreso de fase en `docs/design/session-checkpoint.json` para que `/resume-landing` retome sin repetir trabajo completado.
- **Publicación independiente (`scripts/publish-landing.mjs`)**: valida que el proyecto viva en `projects/<nombre>`, excluye infraestructura interna de LandingFactory vía `.gitignore` y staging selectivo, audita secretos, exige `quality-gate` aprobado y nunca ejecuta `git push` sin autorización explícita (`--confirm-push`).

## LandingFactory Quality Gate y Cierre de Auditoría

- **Regla de re-auditoría tras correcciones**: hallazgo crítico → repetir `@code-reviewer`; hallazgo visual → repetir `@visual-qa`; cambio estructural → repetir ambos; cambio trivial → verificar solo las pruebas afectadas.
- **Similitud visual por sección**: `compare-screenshots.mjs --zones 3 --target-similarity 85 --out docs/design/compare-report.json`.
- **Quality Gate (`scripts/quality-gate.mjs`)**: valida compilación/build, responsive sin overflow (`1440×900`, `768×1024`, `390×844`), consola/red limpias, revisión visual, revisión técnica y accesibilidad básica, separando `blockers`, `warnings` y `notApplicable`. Nunca declara `PASS` una prueba no ejecutada.
