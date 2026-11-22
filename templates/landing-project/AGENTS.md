# Instrucciones del Proyecto — LandingFactory

Este proyecto hereda la infraestructura global de **LandingFactory** (`~/.config/opencode/` y `~/.agents/skills/`).

## Roles

- **Implementador único**: Gemini 4 Hydrogen (`antigravity/gemini-4-hydrogen`). Ningún otro agente puede crear, modificar o eliminar archivos del proyecto.
- **Especialistas (solo lectura, con fallback obligatorio si un modelo falla o no existe)**:
  - `visual-analyst` (`openrouter/google/gemma-4-31b-it:free` → `gemma-4-26b-a4b-it:free` → `openrouter/free` → `antigravity/gemini-3.8-flash`) → `docs/design/visual-analysis.md`
  - `ui-ux-designer` (`openrouter/google/gemma-4-31b-it:free` → `gemma-4-26b-a4b-it:free` → `openrouter/free` → `antigravity/gemini-3.8-flash`) → `docs/design/design-system.md`
  - `asset-researcher` (`openrouter/google/gemma-4-31b-it:free` → `gemma-4-26b-a4b-it:free` → `openrouter/free` → `antigravity/gemini-3.8-flash`) → `docs/design/asset-inventory.md`
  - `implementation-planner` (`opencode/beam-free` → `nemotron-3-ultra-550b-a55b:free` → `openrouter/free` → `antigravity/gemini-3.8-flash`) → `docs/design/implementation-plan.md`
  - `visual-qa` (`openrouter/google/gemma-4-31b-it:free` → `gemma-4-26b-a4b-it:free` → `openrouter/free` → `antigravity/gemini-3.8-flash`) → `docs/design/visual-qa.md`
  - `code-reviewer` (`opencode/deepseek-v4.1-flash-free` → `opencode/flint-40b-free` → `openrouter/free` → `antigravity/gemini-3.8-flash`) → auditoría técnica

## Reglas de Fidelidad

- Fuente de verdad: `references/`. Si `references/` está vacío, detente y solicita screenshots al usuario.
- No inventar secciones, no usar emojis en UI, usar SVG para toda iconografía, no usar screenshots completos como fondo.
- Validar siempre con Playwright (`1440×900`, `768×1024`, `390×844`) antes de declarar completado.

## Reglas Estrictas de Diseño (Anti-AI Slop)

1. **Cero clichés SaaS**: prohibido usar kickers/subtítulos en mayúsculas encima de títulos, `border-l-4` de colores en tarjetas o iconos encerrados en cajas con fondos pastel.
2. **Cero efectos "Tech" genéricos**: sin degradados morados/azules, sin manchas de luz neón (glows) de fondo y sin puntos decorativos pulsantes.
3. **Layout editorial**: evitar `grid-cols-3` de tarjetas idénticas y el exceso de bordes o `shadow-md`; priorizar espacio en blanco y líneas divisoras sutiles (`1px`).
4. **Tipografía con carácter**: alto contraste entre títulos grandes (`tracking-tight`) y cuerpo de texto limpio, respetando Sentence case.
5. **Copywriting humano**: prohibido usar *"potencia"*, *"eleva"*, *"revoluciona"* o *"sin fisuras"*, y prohibido usar listas con el formato `**Concepto:** explicación`.
