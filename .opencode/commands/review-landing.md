---
description: "Ejecuta una revisión visual (Playwright + visual-qa) y técnica (code-reviewer) sobre una landing page ya implementada sin reconstruir desde cero."
---

# /review-landing — Auditoría Visual y Técnica

Instrucciones adicionales del usuario:
$ARGUMENTS

Ejecuta una revisión completa sobre el proyecto actual sin reiniciar la implementación desde cero:

1. **Inspección rápida**: identifica el servidor dev/preview del proyecto, las referencias en `references/` y los archivos implementados.
2. **Captura real con Playwright**:
   - Inicia el servidor local del proyecto si no está corriendo.
   - Ejecuta `capture-landing.mjs` en `1440×900`, `768×1024` y `390×844` guardando en `docs/design/captures/`.
   - Si hay referencias en `references/`, ejecuta `compare-screenshots.mjs` para obtener diferencias de píxeles/overlay.
3. **Auditoría paralela (Solo lectura — con fallback multiproveedor obligatorio si un modelo falla o agota cuota)**:
   - Lanza `@visual-qa` (priorizando proveedor independiente si falla OpenRouter: `openrouter/google/gemma-4-31b-it:free` → `opencode/nemotron-3.5-super-vl-free` → `openrouter/google/gemma-4-26b-a4b-it:free` → `openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` → `openrouter/openrouter/free` → último recurso `--free-policy allow-included`: `antigravity/gemini-3.8-flash`) comparando `references/` vs `docs/design/captures/`.
   - Lanza `@code-reviewer` (`opencode/deepseek-v4.1-flash-free` → `opencode/flint-40b-free` → `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` → `openrouter/openrouter/free` → último recurso `--free-policy allow-included`: `antigravity/gemini-3.8-flash`) revisando calidad, A11y, SEO, rendimiento, consola y responsive. Usar `resolve-model-fallback.mjs --used-providers <prov>` para mantener diversidad de proveedores en paralelo.
4. **Consolidación y Quality Gate**:
   - Guarda el resultado visual en `docs/design/visual-qa.md` y presenta ambos informes priorizados al usuario.
   - Si se aplican correcciones, cierra el ciclo repitiendo el revisor correspondiente (`@visual-qa` para hallazgos visuales, `@code-reviewer` para hallazgos técnicos críticos) y ejecuta `node <LandingFactory>/scripts/quality-gate.mjs` para emitir el veredicto (`READY`, `READY_WITH_WARNINGS` o `BLOCKED`).
