# Pipeline de Ejecución (/build-landing y /review-landing)

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

## Flujo de `/review-landing`

Ejecuta directamente las Fases 5, 6 y 7 sobre un proyecto ya implementado para auditar fidelidad visual y calidad técnica sin reconstruir desde cero.
