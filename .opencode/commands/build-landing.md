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

## REGLA DE RESILIENCIA DE SUBAGENTES (FALLBACK MULTIPROVEEDOR OBLIGATORIO)
**Jamás te quedes sin subagentes.** Antes de delegar, consulta `orchestrator_capabilities` para confirmar qué `providerInstanceId` tiene `canRunChildTask: true` (`opencode_2` y `antigravity`). Si el modelo principal falla, alcanza cuota o carece de permisos, ejecuta el selector inteligente (`scripts/resolve-model-fallback.mjs`) con `--error-type <transient|rate_limit|quota_exhausted|unavailable|capability|permission_denied|auth>` y `--state-file docs/design/model-health-state.json`, priorizando proveedores independientes y gratuitos verificados (`--free-policy strict`, o `allow-included` solo como último recurso en `antigravity/gemini-3.8-flash` solo lectura):
- **Especialistas multimodales** (`visual-analyst`, `ui-ux-designer`, `asset-researcher`, `visual-qa`):
  1. `openrouter/google/gemma-4-31b-it:free` (`opencode_2`)
  2. `opencode/nemotron-3.5-super-vl-free` (`opencode_2`, proveedor independiente)
  3. `openrouter/google/gemma-4-26b-a4b-it:free` (`opencode_2`)
  4. `openrouter/nvidia/nemotron-3.5-super-vl:free` (`opencode_2`)
  5. `openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` (`opencode_2`)
  6. `openrouter/openrouter/free` (`opencode_2`)
  7. Último recurso incluido de sesión (`--free-policy allow-included`): `antigravity/gemini-3.8-flash` (`antigravity`, solo lectura)
- **Planificación** (`implementation-planner`):
  1. `opencode/beam-free` (`opencode_2`)
  2. `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` (`opencode_2`, proveedor independiente)
  3. `opencode/deepseek-v4.1-flash-free` (`opencode_2`)
  4. `openrouter/openrouter/free` (`opencode_2`)
  5. Último recurso incluido de sesión (`--free-policy allow-included`): `antigravity/gemini-3.8-flash` (`antigravity`, solo lectura)
- **Auditoría de código** (`code-reviewer`):
  1. `opencode/deepseek-v4.1-flash-free` (`opencode_2`)
  2. `opencode/flint-40b-free` (`opencode_2`)
  3. `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` (`opencode_2`, proveedor independiente)
  4. `openrouter/openrouter/free` (`opencode_2`)
  5. Último recurso incluido de sesión (`--free-policy allow-included`): `antigravity/gemini-3.8-flash` (`antigravity`, solo lectura)

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
2. Ejecuta la planificación y generación controlada con **Visual Asset Engine** (`scripts/visual-engine/engine.mjs` / `node <LandingFactory>/scripts/visual-engine.mjs`):
   - Ejecuta `VisualPlanner` + `CreativeDirector` + `GenerationStrategy` respetando `REUSE_LOCAL`, `USE_CODE_SVG_OR_CSS` y `SKIP` (no generar imágenes innecesarias para todas las secciones).
   - Ejecuta `GenerationPipeline` (`DRY_RUN` por defecto; `LIVE` solo con autorización explícita y presupuesto aprobado en `CreditManager`) guardando los assets finales en `public/images/`.
3. Implementa todos los iconos UI como **SVG en código** (cero emojis, cero iconos raster).
4. Verifica proporciones, rutas relativas e incorpora cada asset generado en los componentes correspondientes de la landing.

## FASE 4 — IMPLEMENTACIÓN (Solo Gemini Hydrogen)
Siguiendo `docs/design/implementation-plan.md` y la skill `design-to-code`:
Prioridad: 1. Fidelidad visual → 2. Estructura semántica → 3. Imágenes → 4. Responsive → 5. Interacciones → 6. Accesibilidad → 7. Rendimiento.
Prohibido agregar secciones no presentes en la referencia o usar screenshots completos como fondo.
Cumple estrictamente las **Reglas Anti-AI Slop** de `AGENTS.md`:
- Cero clichés SaaS (sin kickers en mayúsculas sobre títulos, sin `border-l-4` de colores, sin iconos en cajas con fondos pastel).
- Cero efectos "Tech" genéricos (sin degradados morados/azules, sin glows de fondo, sin puntos pulsantes).
- Layout editorial (evita `grid-cols-3` de tarjetas idénticas y el exceso de bordes/`shadow-md`; usa espacio en blanco y divisores sutiles de `1px`) y tipografía con alto contraste (`tracking-tight` en títulos grandes + cuerpo limpio, en Sentence case).
- Copywriting humano (sin *"potencia"*, *"eleva"*, *"revoluciona"*, *"sin fisuras"*, ni listas `**Concepto:** explicación`).

## FASE 5 — RENDERIZADO REAL (Playwright)
Levanta el servidor local del proyecto y ejecuta el script de captura de LandingFactory:
`node <LandingFactory>/scripts/capture-landing.mjs --url <local-url> --out docs/design/captures`
Capturando mínimo:
- Desktop: `1440×900` (y dimensiones exactas de la referencia si difieren)
- Tablet: `768×1024`
- Mobile: `390×844`
Registra errores de consola y overflow horizontal.

## FASE 6 — COMPARACIÓN Y CORRECCIÓN VISUAL
Si existe herramienta de comparación, ejecuta `compare-screenshots.mjs --zones 3 --target-similarity 85 --out docs/design/compare-report.json` para medir similitud visual por sección y viewport.
Lanza `@visual-qa` (cadena multimodal con fallback) con las capturas originales (`references/`) y las reales (`docs/design/captures/`).
Guarda el informe en `docs/design/visual-qa.md`.
Gemini Hydrogen corrige por prioridad: geometría → tamaños/posiciones → tipografía → imágenes/recortes → colores → espaciados → detalles.
Realiza al menos 2 pasadas si hay diferencias materiales (máximo 3 iteraciones por defecto salvo que el usuario pida más) y repite `@visual-qa` tras corregir hallazgos visuales.

## FASE 7 — AUDITORÍA TÉCNICA Y QUALITY GATE
Lanza `@code-reviewer` (`opencode/deepseek-v4.1-flash-free` con protocolo de fallback de 6 pasos) en modo solo lectura sobre los archivos implementados y el log de consola.
Si `@code-reviewer` reporta hallazgos críticos/altos, Gemini Hydrogen los corrige y **repite `@code-reviewer`** para cerrar el ciclo.
Antes de entregar, ejecuta `node <LandingFactory>/scripts/quality-gate.mjs --build <pass|fail|na> --a11y <pass|fail|na> --code-review <pass|fail|na> --compare-report docs/design/compare-report.json`. Nunca declares `READY` si el Quality Gate devuelve `BLOCKED` o si faltan pruebas por ejecutar.

## FASE 8 — ENTREGA
Presenta al usuario:
- Resumen de arquitectura y archivos principales.
- Assets utilizados (diferenciando `original-recuperado`, `generado`, `sustituido`).
- Capturas reales y comparación responsive (`1440×900`, `768×1024`, `390×844`).
- Veredicto de fidelidad (`READY`, `READY WITH SUBSTITUTIONS`, `NOT READY`, `UNVERIFIED`) y deltas pendientes si existen.
