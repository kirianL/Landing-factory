# Auditoría Técnica E2E — Sistema de Fallback Multiproveedor de LandingFactory

**Fecha**: 2026-11-21  
**Alcance**: Auditoría independiente de descubrimiento, integración con `delegate_task`, matriz de 15 escenarios, estado de salud (`model-health-state.json`) y seguridad/costes.  
**Restricción aplicada**: Auditoría en modo solo diagnóstico; no se modificaron scripts, agentes, permisos ni proyectos de clientes.

---

## 1. Resumen Ejecutivo

**Veredicto Final**: **`READY_WITH_WARNINGS`**

El sistema multiproveedor ([scripts/resolve-model-fallback.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/resolve-model-fallback.mjs) + [scripts/model-registry.json](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/model-registry.json)) distingue correctamente modelos descubiertos, compatibilidad por perfil (`A`, `B`, `C`), política estricta de gratuidad (`strict` por defecto, sin asumir gratuidad en `unknown` ni `included_in_session`), independencia de proveedor y transmisión de `executionTarget` hacia `delegate_task`.

No obstante, la auditoría detectó **2 defectos funcionales en `resolve-model-fallback.mjs`** (recuperación tras expiración de cooldown y omisión del chequeo `isLiveInOpenCode` cuando se pasa `--t3-capabilities`), **1 riesgo de condición de carrera** en escrituras concurrentes de `model-health-state.json`, y **agotamiento real de cuota** en las cuentas gratuitas de `opencode_2` (`opencode/*-free` y `openrouter/*:free`) durante las delegaciones reales.

---

## 2. Arquitectura Inspeccionada

- [scripts/resolve-model-fallback.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/resolve-model-fallback.mjs): Motor de descubrimiento, scoring y selección.
- [scripts/model-registry.json](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/model-registry.json): Registro local verificable de proveedores (`openrouter`, `opencode`, `antigravity`) y 17 modelos.
- [docs/architecture.md](file:///C:/Users/Kirian/Desktop/LandingFactory/docs/architecture.md) y [docs/workflow.md](file:///C:/Users/Kirian/Desktop/LandingFactory/docs/workflow.md): Documentación de arquitectura y protocolo de 6 pasos.
- Comandos: [build-landing.md](file:///C:/Users/Kirian/Desktop/LandingFactory/.opencode/commands/build-landing.md), [modify-landing.md](file:///C:/Users/Kirian/Desktop/LandingFactory/.opencode/commands/modify-landing.md), [review-landing.md](file:///C:/Users/Kirian/Desktop/LandingFactory/.opencode/commands/review-landing.md) y [resume-landing.md](file:///C:/Users/Kirian/Desktop/LandingFactory/.opencode/commands/resume-landing.md).

### Distinción de los 5 niveles en el sistema
1. **Modelo descubierto**: `buildCatalog()` une `opencode models` (393 modelos), API pública de OpenRouter, `model-registry.json` y snapshot opcional `--t3-capabilities`.
2. **Proveedor disponible**: Validado mediante `orchestrator_capabilities` (solo `opencode_2` y `antigravity` tienen `canRunChildTask: true`; `opencode`, `codex`, `claudeAgent`, `cursor`, `grok`, `fx`, `kiro`, `muse`, `pi` están deshabilitados).
3. **Compatible con el perfil**: `checkCapability()` valida visión (`supportsVision`), `contextLength` mínimo (`32768` Perfil A, `65536` Perfiles B/C), `profiles` y exclusión de `visionOnly` en Perfil C.
4. **Delegable según capacidades reales de T3**: **PARCIALMENTE CUMPLIDO (Hallazgo #2)**. Sin `--t3-capabilities`, rechaza modelos `openrouter`/`opencode` ausentes de `opencode models`, pero si se pasa `--t3-capabilities`, la rama `else if` omite verificar `isLiveInOpenCode`.
5. **Ejecutado exitosamente**: Verificado únicamente tras la respuesta real de `delegate_task` (no por código de salida `0` del script).

---

## 3. Pruebas Ejecutadas

- **Pruebas reales (`delegate_task` en solo lectura)**:
  1. Invocación real sobre `opencode_2` con `opencode/deepseek-v4.1-flash-free` (`code-reviewer` primario).
  2. Resolución real de fallback con `resolve-model-fallback.mjs --error-type quota_exhausted` y segunda invocación real sobre `opencode_2` con `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`.
- **Pruebas aisladas simuladas y de estado**:
  - Ejecutadas en directorio temporal aislado (`%LOCALAPPDATA%/.../lf-e2e-audit-d9c2f46f`) sin tocar proyectos reales ni `.opencode/agents/`.

---

## 4. Resultado Individual de Cada Escenario (Matriz de Pruebas)

| # | Escenario | Tipo | Estado | Evidencia / Resultado Observado |
|---|---|---|---|---|
| 1 | Modelo principal disponible | Simulada + CLI real | **PASS** | Seleccionó `openrouter/google/gemma-4-31b-it:free` (`USE_PRIMARY`) y `opencode/deepseek-v4.1-flash-free` en CLI real. |
| 2 | Rate limit | Simulada | **PASS** | `visual-analyst` cambió a proveedor independiente `opencode/nemotron-3.5-super-vl-free`. |
| 3 | Quota exhausted | Simulada + Real | **PASS** | Aplicó TTL de 30 min en `state-quota.json` y seleccionó fallback independiente (`opencode/nemotron-3.5-super-vl-free` / `nemotron-3-ultra-550b-a55b:free`). |
| 4 | Permission denied | Simulada | **PASS** | Excluyó `opencode_2` y cambió a `antigravity/gemini-3.8-flash` (`providerInstanceId: antigravity`) bajo `allow-included`. |
| 5 | Auth | Simulada | **PASS** | Devolvió `STOP_AUTH_REQUIRED` y `selectedModel: null` sin reintentos. |
| 6 | Modelo incompatible | Simulada | **PASS** | Excluyó solo-texto en `visual-analyst` (`descartado-sin-soporte-vision`) y eligió alternativa válida; excluyó `visionOnly` en `code-reviewer`. |
| 7 | Modelo inexistente | Simulada + CLI real | **PASS** | Catálogo vacío devolvió `STOP_NO_COMPATIBLE_FREE_MODEL`. *Nota*: con `--t3-capabilities` activo, un modelo ficticio en `model-registry.json` sí pasó como delegable (ver Hallazgo #2). |
| 8 | Sin modelos gratuitos | Simulada | **PASS** | Con solo `paid` y `unknown`, devolvió `STOP_NO_COMPATIBLE_FREE_MODEL` sin usar modelos de pago. |
| 9 | Modelo incluido en sesión | Simulada | **PASS** | Rechazado bajo `--free-policy strict` (`STOP_NO_COMPATIBLE_FREE_MODEL`); permitido bajo `--free-policy allow-included` (`antigravity/gemini-3.8-flash`). |
| 10 | Proveedor alternativo deshabilitado | Simulada (`t3-disabled.json`) | **PASS** | Con `antigravity` marcado `canRunChildTask: false`, rechazó la delegación (`STOP_NO_COMPATIBLE_FREE_MODEL`). |
| 11 | Recuperación del cooldown | Simulada | **FAIL** | Con `cooldownUntil` expirado (`Date.now() - 1000`), `visual-analyst` **no** recuperó `gemma-4-31b-it:free` y siguió eligiendo `nemotron-3.5-super-vl-free` por penalización permanente de `failures` (ver Hallazgo #1). |
| 12 | Reinicio del sistema | Simulada | **PASS** | Nueva invocación leyendo `state-quota.json` respetó el cooldown persistido y mantuvo el fallback. |
| 13 | Estado JSON corrupto | Simulada | **PASS** | Con `{ invalid json !!!`, `loadState()` se recuperó sin excepción y seleccionó el modelo principal. |
| 14 | Dos subagentes paralelos | Simulada | **PASS** | Con `--used-providers openrouter`, `code-reviewer` eligió `opencode/deepseek-v4.1-flash-free` (`opencode`), distribuyendo proveedores. |
| 15 | Fallo del fallback | Simulada + Real | **PASS** | En catálogo estricto sin candidatos compatibles detiene con `STOP_NO_COMPATIBLE_FREE_MODEL`; en delegación real fallida reportó el error sin declarar éxito. |

---

## 5. Evidencia de Delegaciones Reales (`delegate_task`)

1. **Intento 1 — Target primario de `code-reviewer`**:
   - **Target enviado**: `providerInstanceId: "opencode_2"`, `model: "opencode/deepseek-v4.1-flash-free"`, `role: "review"`.
   - **Task ID**: `node:delegated-task:command%3Amcp%3A5abfbde5-03f9-41b6-964e-73dafc405e92%3Adelegate-task%3Alf-e2e-audit-ping-01`
   - **Resultado real**: `[failed]` — `"Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models."`
   - **Clasificación**: `quota_exhausted`.

2. **Intento 2 — Target de fallback calculado por `resolve-model-fallback.mjs`**:
   - **Resolución**: `{"action":"USE_FALLBACK","selectedModel":"openrouter/nvidia/nemotron-3-ultra-550b-a55b:free","executionTarget":{"providerInstanceId":"opencode_2","model":"openrouter/nvidia/nemotron-3-ultra-550b-a55b:free","executionMethod":"delegate_task"}}`
   - **Task ID**: `node:delegated-task:command%3Amcp%3A5abfbde5-03f9-41b6-964e-73dafc405e92%3Adelegate-task%3Alf-e2e-audit-fallback-02`
   - **Resultado real**: `[failed]` — `"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day: https://openrouter.ai/settings/credits"`
   - **Clasificación**: `rate_limit` / `quota_exhausted`.

**Conclusión de integración**: `executionTarget.providerInstanceId` y `executionTarget.model` se transmiten correctamente a `delegate_task`, los errores reales del proveedor se propagan sin falsos positivos, pero en el entorno actual las cuotas gratuitas de `opencode_2` (tanto OpenCode como OpenRouter) están agotadas.

---

## 6. Diferencias entre Pruebas Simuladas y Reales

- Las pruebas simuladas validan la lógica determinista de filtrado, scoring, políticas de gratuidad, persistencia de estado y sanitización de logs en condiciones controladas.
- Las pruebas reales demostraron que un modelo puede figurar como `verified_free` y `delegatable: true` en catálogo y aun así fallar en tiempo de ejecución por cuota de cuenta (`Free usage limit reached` / `free-models-per-day`).
- La clasificación de errores reales en texto libre devueltos por `delegate_task` depende actualmente del coordinador (LLM) siguiendo el protocolo de 6 pasos, no de un parser automático en código.

---

## 7. Problemas Encontrados

1. **[ALTO] Fallo de recuperación tras expirar cooldown (Escenario 11)**:
   - En [scripts/resolve-model-fallback.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/resolve-model-fallback.mjs), `scoreCandidate()` resta `modelHealth.failures * 35` incluso cuando `cooldownUntil <= nowMs`. Un solo fallo histórico deja al modelo principal por debajo del fallback indefinidamente al no existir decaimiento ni reseteo tras expirar el cooldown.
2. **[MEDIO] Omisión de `isLiveInOpenCode` cuando se pasa `--t3-capabilities`**:
   - En `mergeCandidateMetadata()`, la rama `if (t3Caps)` solo valida `pInfo.canRunChildTask`, saltándose el `else if` que comprobaba `isLiveInOpenCode === false`. Un modelo inexistente en `opencode models` presente en `model-registry.json` puede marcarse como `delegatable: true`.
3. **[MEDIO] Escritura no atómica en `model-health-state.json`**:
   - `loadState()` + `saveState()` usa `fs.writeFileSync()` directo sin lock ni escritura temporal + `rename()`. En la prueba de 10 procesos concurrentes el JSON no se corrompió (`parseOk: true`, `10/10` registros), pero bajo alta contención existe riesgo de pérdida de actualizaciones (*lost updates*).
4. **[INFO] Auditoría de estado de salud y seguridad**:
   - TTLs por error (`2m`, `5m`, `15m`, `30m`, `60m`): **PASS**.
   - Timestamps inválidos (`"not-a-date"`, `"NaN"`): **PASS** (no lanza excepción).
   - No bloqueo total de proveedor ante fallo de un modelo: **PASS** (el fallback al mismo proveedor `openrouter/google/gemma-4-26b-a4b-it:free` siguió funcionando cuando no había proveedor independiente).
   - Sanitización de secretos en logs (`Bearer [REDACTED]`, `[REDACTED_KEY]`): **PASS**.

---

## 8. Riesgos Pendientes

- **Agotamiento simultáneo de cuotas gratuitas en `opencode_2`**: En este entorno, tanto `opencode/*-free` como `openrouter/*:free` están bloqueados por cuota diaria/cuenta; si no se autoriza `--free-policy allow-included` (`antigravity/gemini-3.8-flash`), los subagentes quedarán detenidos con `STOP_NO_COMPATIBLE_FREE_MODEL`.
- **Dependencia de `orchestrator_capabilities` manual**: El CLI Node no puede consultar MCP directamente; si el coordinador no pasa `--t3-capabilities`, `antigravity/*` depende de la configuración estática en `model-registry.json`.

---

## 9. Recomendaciones Priorizadas

1. **Prioridad Alta — Corregir recuperación post-cooldown**: En `scoreCandidate()`, ignorar o decaer `modelHealth.failures` cuando `cooldownUntil <= nowMs` (o añadir `--record-success` para limpiar `failures` al completarse una delegación).
2. **Prioridad Media — Separar validación T3 de validación OpenCode CLI**: En `mergeCandidateMetadata()`, verificar siempre `isLiveInOpenCode === false` para `opencode`/`openrouter` independientemente de si `t3Caps` está presente.
3. **Prioridad Media — Escritura atómica en `saveState()`**: Escribir a un archivo temporal en el mismo directorio y usar `fs.renameSync()`, o incorporar fusión en disco antes de guardar para evitar *lost updates*.
4. **Prioridad Baja — Helper de clasificación de errores**: Añadir una función o flag `--error-message "<texto>"` en `resolve-model-fallback.mjs` para clasificar determinísticamente mensajes reales como `"Free usage limit reached"` → `quota_exhausted` y `"free-models-per-day"` → `rate_limit`.

---

*Esperando tu autorización antes de implementar cualquiera de estas correcciones.*
