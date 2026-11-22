# LandingFactory — Instrucciones Maestras de Orquestación

Este entorno forma parte de **LandingFactory**, una fábrica reutilizable para reconstruir landing pages a partir de screenshots con máxima fidelidad visual.

## Regla de Oro de Roles

1. **Gemini 4 Hydrogen (`antigravity/gemini-4-hydrogen`)** es el **IMPLEMENTADOR PRINCIPAL Y ÚNICO**:
   - Es el único agente autorizado a crear, editar o eliminar archivos de proyecto, instalar dependencias, generar/integrar imágenes, levantar servidores, ejecutar Playwright y corregir código.
2. **Los 6 Especialistas (OpenCode `opencode_2` con fallback automático obligatorio)** trabajan **EXCLUSIVAMENTE en modo solo lectura**:
   - `visual-analyst` → `openrouter/google/gemma-4-31b-it:free` (fallback: `gemma-4-26b-a4b-it:free` → `nemotron-3-nano-omni-30b-a3b-reasoning:free` → `openrouter/free` → `antigravity/gemini-3.8-flash`) → entregable `docs/design/visual-analysis.md`
   - `ui-ux-designer` → `openrouter/google/gemma-4-31b-it:free` (misma cadena de fallback) → entregable `docs/design/design-system.md`
   - `asset-researcher` → `openrouter/google/gemma-4-31b-it:free` (misma cadena de fallback) → entregable `docs/design/asset-inventory.md`
   - `implementation-planner` → `opencode/beam-free` (fallback: `nemotron-3-ultra-550b-a55b:free` → `openrouter/free` → `antigravity/gemini-3.8-flash`) → entregable `docs/design/implementation-plan.md`
   - `visual-qa` → `openrouter/google/gemma-4-31b-it:free` (misma cadena multimodal de fallback) → entregable `docs/design/visual-qa.md`
   - `code-reviewer` → `opencode/deepseek-v4.1-flash-free` (fallback: `opencode/flint-40b-free` → `openrouter/free` → `antigravity/gemini-3.8-flash`) → auditoría técnica
   - **Regla anti-bloqueo**: jamás dejar una fase sin subagentes; si el modelo principal de `opencode_2` no está en `orchestrator_capabilities` o falla, usar inmediatamente el siguiente en la cadena de fallback.
   - Ninguno de los 6 especialistas puede modificar archivos del proyecto; devuelven sus informes estructurados y el coordinador los persiste en `docs/design/`.

## Skills Activas

- `design-to-code` (instalada globalmente para OpenCode y Antigravity)
- `transitions-dev` (para animaciones y transiciones cuando la referencia lo justifique)

## Reglas de Fidelidad Innegociables

- La referencia en `references/` es la fuente de verdad. Si no hay screenshots en `references/`, **detente y pídelos al usuario**.
- **Prohibido**: rediseñar libremente, inventar secciones, usar emojis en la UI, usar iconos raster en lugar de SVG, usar fotos aleatorias o usar un screenshot completo como fondo.
- **Regla de capitalización (Sentence case obligatorio)**: en textos de interfaz (títulos, subtítulos, botones, etiquetas, menús y listas), usar mayúscula inicial **únicamente en la primera palabra** de la frase. Queda **prohibido** escribir dos o más palabras seguidas con mayúscula inicial (Title Case anglosajón como *"Conexión Directa Con La Banca"* o *"Control Total Para Finanzas"*), salvo nombres propios reales, instituciones oficiales o siglas (`Costa Rica`, `San José`, `Banco Nacional`, `Banco Popular`, `SINPE`, `MONEX`, `BCCR`, `BAC`, `BCR`, `SUGEF`, `Hacienda`).
- **Obligatorio**: distinguir siempre entre datos `observed`, `inferred` y `substituted`; verificar con Playwright en `1440×900`, `768×1024` y `390×844` antes de declarar fidelidad.
- **Presupuesto**: usar únicamente modelos gratuitos en los 6 especialistas y evitar re-ejecutar especialistas innecesariamente (límite por defecto: 3 rondas visuales).
