# LandingFactory — Instrucciones Maestras de Orquestación

Este entorno forma parte de **LandingFactory**, una fábrica reutilizable para reconstruir landing pages a partir de screenshots con máxima fidelidad visual.

## Regla de Oro de Roles

1. **Gemini 4 Hydrogen (`antigravity/gemini-4-hydrogen`)** es el **IMPLEMENTADOR PRINCIPAL Y ÚNICO**:
   - Es el único agente autorizado a crear, editar o eliminar archivos de proyecto, instalar dependencias, generar/integrar imágenes, levantar servidores, ejecutar Playwright y corregir código.
2. **Los 6 Especialistas (OpenCode `opencode_2`)** trabajan **EXCLUSIVAMENTE en modo solo lectura**:
   - `visual-analyst` → `opencode/nemotron-3.5-super-vl-free` (multimodal gratuito) → entregable `docs/design/visual-analysis.md`
   - `ui-ux-designer` → `opencode/nemotron-3.5-super-vl-free` (multimodal gratuito) → entregable `docs/design/design-system.md`
   - `asset-researcher` → `opencode/nemotron-3.5-super-vl-free` (multimodal gratuito) → entregable `docs/design/asset-inventory.md`
   - `implementation-planner` → `opencode/beam-free` (planificación gratuita) → entregable `docs/design/implementation-plan.md`
   - `visual-qa` → `opencode/nemotron-3.5-super-vl-free` (multimodal gratuito) → entregable `docs/design/visual-qa.md`
   - `code-reviewer` → `opencode/deepseek-v4.1-flash-free` (código gratuita) → auditoría técnica
   - Ninguno de los 6 especialistas puede modificar archivos del proyecto; devuelven sus informes estructurados y el coordinador los persiste en `docs/design/`.

## Skills Activas

- `design-to-code` (instalada globalmente para OpenCode y Antigravity)
- `transitions-dev` (para animaciones y transiciones cuando la referencia lo justifique)

## Reglas de Fidelidad Innegociables

- La referencia en `references/` es la fuente de verdad. Si no hay screenshots en `references/`, **detente y pídelos al usuario**.
- **Prohibido**: rediseñar libremente, inventar secciones, usar emojis en la UI, usar iconos raster en lugar de SVG, usar fotos aleatorias o usar un screenshot completo como fondo.
- **Obligatorio**: distinguir siempre entre datos `observed`, `inferred` y `substituted`; verificar con Playwright en `1440×900`, `768×1024` y `390×844` antes de declarar fidelidad.
- **Presupuesto**: usar únicamente modelos gratuitos en los 6 especialistas y evitar re-ejecutar especialistas innecesariamente (límite por defecto: 3 rondas visuales).
