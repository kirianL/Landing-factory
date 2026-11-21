# Arquitectura de LandingFactory

## Visión General

**LandingFactory** separa estrictamente el **análisis y auditoría** (ejecutados por 6 subagentes gratuitos en modo solo lectura vía OpenCode) de la **implementación y corrección** (ejecutadas exclusivamente por **Gemini 4 Hydrogen** en T3 Code).

## Capas del Sistema

1. **T3 Code (Interfaz y Ejecución Principal)**:
   - El usuario abre cualquier carpeta de proyecto en T3 Code con **Gemini 4 Hydrogen** (`antigravity/gemini-4-hydrogen`).
   - Gemini 4 Hydrogen es el único agente con permisos de escritura, comandos, servidores, Playwright y generación de assets.
2. **OpenCode v2.3.2 (Orquestación de Subagentes y Comandos)**:
   - Agentes globales en `C:\Users\Kirian\.config\opencode\agents\` (enlazados mediante junction a `LandingFactory/.opencode/agents/`).
   - Comandos globales `/build-landing` y `/review-landing` en `C:\Users\Kirian\.config\opencode\commands\` (enlazados a `LandingFactory/.opencode/commands/`).
   - En T3 Code, el proveedor `opencode_2` permite delegar directamente a modelos gratuitos de OpenCode mediante `delegate_task`.
3. **Skills Compartidas**:
   - `design-to-code` (`Atharvsinh-codez/skills`) instalada globalmente en `~\.agents\skills\design-to-code` (OpenCode) y `~\.gemini\config\skills\design-to-code` (Antigravity).
   - `transitions-dev` (`Atharvsinh-codez/obsidianui`) instalada globalmente en ambas rutas.
4. **Validación Real con Playwright**:
   - `scripts/capture-landing.mjs`: capturas deterministas (`1440×900`, `768×1024`, `390×844`), detección de overflow horizontal y captura de errores de consola/red.
   - `scripts/compare-screenshots.mjs`: comparación píxel a píxel, MAE/RMSE, mapa de diferencias (`diff.png`) y superposición al 50% (`overlay.png`).

## Asignación Real de Modelos

| Rol | Proveedor / Runtime | ID Real del Modelo | Permisos |
|---|---|---|---|
| Implementador Único | `antigravity` (T3 Code) | `gemini-4-hydrogen` | Lectura/Escritura/Comandos |
| `visual-analyst` | `opencode` / `opencode_2` | `opencode/nemotron-3.5-super-vl-free` | Solo lectura |
| `ui-ux-designer` | `opencode` / `opencode_2` | `opencode/nemotron-3.5-super-vl-free` | Solo lectura |
| `asset-researcher` | `opencode` / `opencode_2` | `opencode/nemotron-3.5-super-vl-free` | Solo lectura |
| `implementation-planner` | `opencode` / `opencode_2` | `opencode/beam-free` | Solo lectura |
| `visual-qa` | `opencode` / `opencode_2` | `opencode/nemotron-3.5-super-vl-free` | Solo lectura |
| `code-reviewer` | `opencode` / `opencode_2` | `opencode/deepseek-v4.1-flash-free` | Solo lectura |

## Limitación Técnica Documentada

- En OpenCode CLI independiente (`opencode` v2.3.2), el modelo `google/gemini-4-hydrogen` existe en el catálogo pero requiere credenciales directas de Google/OpenRouter si se ejecuta fuera de T3 Code. Dentro de **T3 Code**, **Gemini 4 Hydrogen** (`antigravity`) actúa como coordinador/implementador y delega a `opencode_2` (OpenCode) sin costos adicionales en los subagentes.
