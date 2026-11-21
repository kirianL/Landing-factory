---
description: "Construye o reconstruye una landing page desde screenshots en references/ coordinando los 6 especialistas y ejecutando la implementación con Gemini Hydrogen."
---

# /build-landing — Pipeline Completo de LandingFactory

Instrucciones adicionales del usuario:
$ARGUMENTS

Ejecuta estrictamente el pipeline obligatorio de **LandingFactory** siguiendo este orden:

## FASE 0 — INSPECCIÓN
1. Inspecciona la carpeta actual del proyecto.
2. Verifica si existen screenshots en `references/`.
   - **Si NO existen screenshots en `references/`**: detente inmediatamente y pide al usuario que coloque al menos una captura de referencia (por ejemplo `references/desktop.png` y opcionalmente `references/mobile.png`) antes de continuar. **Nunca inventes una referencia.**
3. Identifica assets existentes en `assets/` o `public/`, framework existente (`package.json`, `src/`, `index.html`, etc.), package manager, scripts y estado de Git.
4. No elimines ni sobrescribas archivos del usuario sin respaldo.

## REGLA DE RESILIENCIA DE SUBAGENTES (FALLBACK OBLIGATORIO)
**Jamás te quedes sin subagentes.** Antes de delegar a `opencode_2`, consulta `orchestrator_capabilities`. Si el modelo principal no existe, falla o alcanza límite de cuota, pasa automáticamente al siguiente modelo disponible en la cadena:
- **Especialistas multimodales** (`visual-analyst`, `ui-ux-designer`, `asset-researcher`, `visual-qa`):
  1. `openrouter/google/gemma-4-31b-it:free`
  2. `openrouter/google/gemma-4-26b-a4b-it:free`
  3. `openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`
  4. `openrouter/openrouter/free`
  5. Fallback final garantizado: `antigravity/gemini-3.8-flash` (o `invoke_subagent` solo lectura)
- **Planificación** (`implementation-planner`):
  1. `opencode/beam-free`
  2. `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`
  3. `openrouter/openrouter/free`
  4. Fallback final garantizado: `antigravity/gemini-3.8-flash`
- **Auditoría de código** (`code-reviewer`):
  1. `opencode/deepseek-v4.1-flash-free`
  2. `opencode/flint-40b-free`
  3. `openrouter/openrouter/free`
  4. Fallback final garantizado: `antigravity/gemini-3.8-flash`

## FASE 1 — ANÁLISIS PARALELO (Solo lectura)
Lanza en paralelo a los tres especialistas multimodales (usando la cadena multimodal en `opencode_2` o fallback):
- `@visual-analyst`: analiza todos los screenshots en `references/` y devuelve el informe para `docs/design/visual-analysis.md`.
- `@ui-ux-designer`: define sistema visual, tokens, tipografía, responsive y componentes para `docs/design/design-system.md`.
- `@asset-researcher`: cataloga cada imagen, fotografía, ilustración, icono y logotipo para `docs/design/asset-inventory.md`.

Guarda los tres informes en `docs/design/` (escritos por el coordinador/implementador, ya que los especialistas son de solo lectura).

## FASE 2 — PLANIFICACIÓN (Solo lectura)
Lanza `@implementation-planner` (`opencode/beam-free`) con los tres informes y la estructura real del proyecto para generar el plan de `docs/design/implementation-plan.md`.
**No comiences la implementación sin tener `docs/design/implementation-plan.md`.**

## FASE 3 — PREPARACIÓN DE ASSETS (Solo Gemini Hydrogen)
**Gemini Hydrogen** es el único autorizado para escribir/modificar archivos:
1. Recupera assets proporcionados por el usuario en `assets/`.
2. Genera imágenes equivalentes cuando sea necesario (usando `image-generator` / `imagegen`), respetando composición, iluminación, paleta y proporción.
3. Implementa todos los iconos UI como **SVG en código** (cero emojis, cero iconos raster).
4. Verifica proporciones y optimiza rutas antes de maquetar.

## FASE 4 — IMPLEMENTACIÓN (Solo Gemini Hydrogen)
Siguiendo `docs/design/implementation-plan.md` y la skill `design-to-code`:
Prioridad: 1. Fidelidad visual → 2. Estructura semántica → 3. Imágenes → 4. Responsive → 5. Interacciones → 6. Accesibilidad → 7. Rendimiento.
Prohibido agregar secciones no presentes en la referencia o usar screenshots completos como fondo.

## FASE 5 — RENDERIZADO REAL (Playwright)
Levanta el servidor local del proyecto y ejecuta el script de captura de LandingFactory:
`node <LandingFactory>/scripts/capture-landing.mjs --url <local-url> --out docs/design/captures`
Capturando mínimo:
- Desktop: `1440×900` (y dimensiones exactas de la referencia si difieren)
- Tablet: `768×1024`
- Mobile: `390×844`
Registra errores de consola y overflow horizontal.

## FASE 6 — COMPARACIÓN Y CORRECCIÓN VISUAL
Si existe herramienta de comparación, ejecuta `compare-screenshots.mjs` para generar diffs/métricas.
Lanza `@visual-qa` (cadena multimodal con fallback) con las capturas originales (`references/`) y las reales (`docs/design/captures/`).
Guarda el informe en `docs/design/visual-qa.md`.
Gemini Hydrogen corrige por prioridad: geometría → tamaños/posiciones → tipografía → imágenes/recortes → colores → espaciados → detalles.
Realiza al menos 2 pasadas si hay diferencias materiales (máximo 3 iteraciones por defecto salvo que el usuario pida más).

## FASE 7 — AUDITORÍA TÉCNICA
Lanza `@code-reviewer` (`opencode/deepseek-v4.1-flash-free`) en modo solo lectura sobre los archivos implementados y el log de consola.
Gemini Hydrogen corrige los hallazgos críticos/altos.

## FASE 8 — ENTREGA
Presenta al usuario:
- Resumen de arquitectura y archivos principales.
- Assets utilizados (diferenciando `original-recuperado`, `generado`, `sustituido`).
- Capturas reales y comparación responsive (`1440×900`, `768×1024`, `390×844`).
- Veredicto de fidelidad (`READY`, `READY WITH SUBSTITUTIONS`, `NOT READY`, `UNVERIFIED`) y deltas pendientes si existen.
