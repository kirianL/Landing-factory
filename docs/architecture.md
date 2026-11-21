# Arquitectura de LandingFactory

## Visión General

**LandingFactory** separa estrictamente el **análisis y auditoría** (ejecutados por 6 subagentes gratuitos en modo solo lectura vía OpenCode) de la **implementación y corrección** (ejecutadas exclusivamente por **Gemini 4 Hydrogen** en T3 Code).

## Capas del Sistema

1. **T3 Code (Interfaz y Ejecución Principal)**:
   - El usuario abre cualquier carpeta de proyecto en T3 Code con **Gemini 4 Hydrogen** (`antigravity/gemini-4-hydrogen`).
   - Gemini 4 Hydrogen es el único agente con permisos de escritura, comandos, servidores, Playwright y generación de assets.
2. **OpenCode v2.3.2 (Orquestación de Subagentes y Comandos)**:
   - Agentes globales en `C:\Users\Kirian\.config\opencode\agents\` (enlazados mediante junction a `LandingFactory/.opencode/agents/`).
   - Comandos globales `/build-landing`, `/modify-landing`, `/review-landing`, `/resume-landing` y `/publish-landing` en `C:\Users\Kirian\.config\opencode\commands\` (enlazados a `LandingFactory/.opencode/commands/`).
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

## Sistema Inteligente de Fallback (`scripts/resolve-model-fallback.mjs`)

Para evitar bloqueos por indisponibilidad, límites de uso o retirada de modelos gratuitos en los 6 especialistas de solo lectura, LandingFactory incluye un selector dinámico basado en el catálogo real (`opencode models` + metadatos públicos de OpenRouter):

1. **Perfiles de capacidad**:
   - **Perfil A (Visual / Multimodal)**: `visual-analyst`, `ui-ux-designer`, `asset-researcher`, `visual-qa`. Exige soporte de visión/imágenes (`input_modalities` con `image`); nunca degrada silenciosamente a modelos solo-texto cuando la tarea requiere analizar capturas.
   - **Perfil B (Planificación y Razonamiento)**: `implementation-planner`. Prioriza razonamiento, arquitectura y contexto amplio.
   - **Perfil C (Revisión Técnica y Código)**: `code-reviewer`. Prioriza análisis de código, errores y seguridad.
2. **Política de reintentos y recuperación**:
   - Primer error `transient`: 1 reintento sobre el modelo principal.
   - Segundo error `transient` o errores `rate_limit`, `unavailable`, `capability`: exclusión temporal en la ejecución y selección inmediata del siguiente candidato gratuito compatible.
   - Error `auth`: detención sin reintentos para intervención del usuario.
   - Prevención de ciclos mediante conjunto de modelos excluidos (`--exclude`).
3. **Restricciones económicas y observabilidad**:
   - Verifica gratuidad real (precio `0` en prompt/completion o modelos `-free` de OpenCode) y prohíbe escalar automáticamente a modelos de pago.
   - Registra cada evento de fallback en `docs/design/model-fallback-log.md` sin guardar claves ni tokens.
4. **Limitaciones**:
   - En OpenCode CLI sin red hacia `openrouter.ai`, los metadatos de precio/modalidad de OpenRouter se evalúan con heurísticas locales hasta restablecer conexión.
   - Si ningún modelo gratuito compatible está disponible en `opencode_2`, el flujo detiene únicamente la subtarea afectada (o recurre a `antigravity/gemini-3.8-flash` en modo solo lectura si el flujo lo autoriza).
