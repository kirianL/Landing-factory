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

## Sistema Inteligente de Fallback Multiproveedor (`scripts/resolve-model-fallback.mjs` + `scripts/model-registry.json`)

Para evitar bloqueos por indisponibilidad, límites de uso, cuotas agotadas o retirada de modelos gratuitos en los 6 especialistas de solo lectura, LandingFactory incluye un selector dinámico multiproveedor basado en tres fuentes:

1. **Fuente A — OpenCode / OpenRouter**: catálogo real (`opencode models`) + metadatos públicos de OpenRouter (`https://openrouter.ai/api/v1/models`) para precios, `input_modalities` y `context_length`.
2. **Fuente B — T3 Code / Antigravity (`orchestrator_capabilities`)**: consulta de instancias activas y permisos reales de delegación (`canRunChildTask`, `canRunCrossProviderChildTask`, `constraints`).
   - *Limitación verificada*: `orchestrator_capabilities` expone qué `providerInstanceId` está habilitado (`opencode_2` y `antigravity` activos; `opencode`, `codex`, `claudeAgent`, etc. deshabilitados), pero no expone precios ni modalidades de visión; por ello se complementa con el registro local.
3. **Fuente C — Registro Local Verificable (`scripts/model-registry.json`)**: define por modelo `provider`, `providerInstanceId`, `executionMethod`, `profiles`, `inputModalities`, `outputModalities`, `contextLength`, `freeStatus` (`verified_free` | `included_in_session` | `paid` | `unknown`), `priority`, `delegatable` y `knownConstraints`. Nunca asume gratuidad por nombre cuando el precio es `unknown`.

### Perfiles, Selección y Recuperación
1. **Perfiles de capacidad**:
   - **Perfil A (Visual / Multimodal)**: `visual-analyst`, `ui-ux-designer`, `asset-researcher`, `visual-qa`. Exige soporte de visión/imágenes (`inputModalities` con `image`) y contexto suficiente; nunca degrada a modelos solo-texto.
   - **Perfil B (Planificación y Razonamiento)**: `implementation-planner`. Prioriza razonamiento, arquitectura y contexto amplio (`>= 65536`).
   - **Perfil C (Revisión Técnica y Código)**: `code-reviewer`. Prioriza análisis de código, errores y seguridad; nunca usa modelos exclusivamente visuales.
2. **Motor de selección inteligente**:
   - Evalúa compatibilidad de perfil, permisos de delegación (`delegatable`, verificando `isLiveInOpenCode` incluso cuando se pasa `--t3-capabilities`), política de gratuidad (`--free-policy strict` por defecto; `allow-included` solo si se autoriza fallback incluido de sesión como `antigravity/gemini-3.8-flash`), historial reciente de fallos/cooldown (`--state-file` con escritura atómica vía archivo temporal y lockfile, recuperando prioridad normal al expirar el cooldown sin borrar historial) e **independencia respecto al proveedor que falló** (`--failed-provider`, `--used-providers`).
   - Incluye clasificador opcional de mensajes de error (`--error-message`, `--classify-error`) que distingue límites diarios/cuota (`quota_exhausted`) de `rate_limit`, `auth`, `permission_denied`, `capability`, `unavailable`, `transient` y `unknown` sin exponer credenciales en logs.
3. **Clasificación de errores y políticas**:
   - `transient`: 1 reintento en intento 1; al 2.º fallo entra en cooldown y activa fallback.
   - `rate_limit` / `quota_exhausted` / `unavailable` / `capability`: cooldown inmediato sobre el modelo (y penalización temporal al proveedor en `rate_limit`/`quota_exhausted`), seleccionando prioritariamente un proveedor independiente.
   - `permission_denied`: descarta el `providerInstanceId` denegado y busca otro autorizado o detiene con `STOP_PERMISSION_DENIED`.
   - `auth`: detención inmediata (`STOP_AUTH_REQUIRED`) sin reintentos ni escalado a modelos de pago.
4. **Observabilidad**:
   - Registra cada evento en `docs/design/model-fallback-log.md` (sin guardar claves ni tokens) y persiste cooldowns opcionalmente en `docs/design/model-health-state.json`.
