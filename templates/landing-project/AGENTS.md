# Instrucciones del Proyecto — LandingFactory

Este proyecto hereda la infraestructura global de **LandingFactory** (`~/.config/opencode/` y `~/.agents/skills/`).

## Roles

- **Implementador único**: Gemini 4 Hydrogen (`antigravity/gemini-4-hydrogen`). Ningún otro agente puede crear, modificar o eliminar archivos del proyecto.
- **Especialistas (solo lectura)**:
  - `visual-analyst` (`opencode/nemotron-3.5-super-vl-free`) → `docs/design/visual-analysis.md`
  - `ui-ux-designer` (`opencode/nemotron-3.5-super-vl-free`) → `docs/design/design-system.md`
  - `asset-researcher` (`opencode/nemotron-3.5-super-vl-free`) → `docs/design/asset-inventory.md`
  - `implementation-planner` (`opencode/beam-free`) → `docs/design/implementation-plan.md`
  - `visual-qa` (`opencode/nemotron-3.5-super-vl-free`) → `docs/design/visual-qa.md`
  - `code-reviewer` (`opencode/deepseek-v4.1-flash-free`) → auditoría técnica

## Reglas de Fidelidad

- Fuente de verdad: `references/`. Si `references/` está vacío, detente y solicita screenshots al usuario.
- No inventar secciones, no usar emojis en UI, usar SVG para toda iconografía, no usar screenshots completos como fondo.
- Validar siempre con Playwright (`1440×900`, `768×1024`, `390×844`) antes de declarar completado.
