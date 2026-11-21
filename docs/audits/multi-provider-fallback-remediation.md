# Informe de Remediación — Fallback Multiproveedor de LandingFactory

**Fecha**: 2026-11-21  
**Auditoría de referencia**: [docs/audits/multi-provider-fallback-e2e-audit.md](file:///C:/Users/Kirian/Desktop/LandingFactory/docs/audits/multi-provider-fallback-e2e-audit.md)  
**Estado**: **REMEDIACIÓN COMPLETADA Y VERIFICADA**

---

## 1. Resumen de Hallazgos Remediados

| # | Hallazgo Original | Causa Raíz | Solución Implementada | Veredicto |
|---|---|---|---|---|
| 1 | Fallo de recuperación tras expirar cooldown (Escenario 11) | `scoreCandidate()` restaba `modelHealth.failures * 35` incluso cuando `cooldownUntil <= nowMs`, penalizando indefinidamente al modelo principal. | Solo se aplica la penalización de `failures` mientras el cooldown del modelo está activo (`cooldownUntil > nowMs`). Se conserva `failures` en `model-health-state.json` para auditoría y se mantienen penalizaciones independientes (`failedProvider`, `usedProviders`, cooldown de proveedor). | **PASS** |
| 2 | Omisión de `isLiveInOpenCode` al usar `--t3-capabilities` | `mergeCandidateMetadata()` usaba `if (t3Caps) { ... } else if (isLiveInOpenCode === false)`, saltando la comprobación de `opencode models` cuando se pasaba snapshot T3. | Se desacopló la verificación de `isLiveInOpenCode === false` para `openrouter`/`opencode` de la rama `if (t3Caps)`, manteniendo la independencia de `antigravity`. | **PASS** |
| 3 | Escritura no atómica en `model-health-state.json` | `saveState()` sobrescribía directamente con `fs.writeFileSync()` sin lock ni archivo temporal. | Implementado `acquireLock()` (`.lock` con `wx` y limpieza de locks obsoletos), fusión `mergeHealthStates()` sobre el estado más reciente en disco, validación JSON previa, escritura a `.tmp-*` en el mismo directorio, reemplazo atómico `fs.renameSync()` con reintentos para `EBUSY`/`EPERM` en Windows y limpieza de `.tmp-*` abandonados. | **PASS** |
| 4 | Clasificación manual de errores de texto libre | Los errores reales de `delegate_task` (`Free usage limit reached`, `free-models-per-day`) requerían clasificación manual. | Añadida función exportada `classifyErrorMessage()` y flags `--error-message` / `--classify-error` que priorizan señales explícitas, separan `quota_exhausted` de `rate_limit`, devuelven `unknown` si falta evidencia y respetan `--error-type` explícito sin exponer credenciales en logs. | **PASS** |

---

## 2. Archivos Modificados y Creados

- [scripts/resolve-model-fallback.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/resolve-model-fallback.mjs): Correcciones en `scoreCandidate()`, `mergeCandidateMetadata()`, `loadState()`, `saveState()`, `sanitizeText()`, `classifyErrorMessage()`, flags CLI y exports.
- [scripts/test-model-fallback.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/test-model-fallback.mjs): **Creado**. Suite automatizada con `node:test` para las 4 remediaciones y la regresión de escenarios E2E.
- [docs/architecture.md](file:///C:/Users/Kirian/Desktop/LandingFactory/docs/architecture.md): Documentada la validación conjunta, recuperación post-cooldown, escritura atómica y clasificador opcional.
- [docs/workflow.md](file:///C:/Users/Kirian/Desktop/LandingFactory/docs/workflow.md): Actualizado el Paso 1 del protocolo con `--error-message` y `unknown`.

---

## 3. Pruebas Ejecutadas y Resultados

Ejecutado mediante `node --test scripts/test-model-fallback.mjs` (5/5 suites aprobadas, 0 fallos):

| Suite / Prueba | Tipo | Resultado |
|---|---|---|
| **Fase 2 — Recuperación post-cooldown**: cooldown activo excluye; cooldown expirado con 5 fallos previos recupera al modelo principal; historial `failures: 5` conservado; penalización independiente `failedProvider` sigue activa. | Simulada (aislada en `os.tmpdir()`) | **PASS** |
| **Fase 3 — Validación conjunta T3 + OpenCode**: modelo live en OpenCode (`true`), ausente sin T3 (`false`), ausente con T3 (`false`), Antigravity autorizado (`true`), instancia deshabilitada (`false`), metadatos contradictorios OpenRouter `paid` vs registro (`paid`). | Unitaria | **PASS** |
| **Fase 4 — Escritura atómica del estado**: escritura normal, fallo de serialización preserva estado previo, limpieza de `.tmp-*` >60s, recuperación JSON corrupto, 2 escrituras concurrentes en Windows conservan ambas actualizaciones. | Simulada (Windows, procesos paralelos) | **PASS** |
| **Fase 5 — Clasificador opcional de errores**: mensajes reales anonimizados de OpenCode (`quota_exhausted`) y OpenRouter (`quota_exhausted`), `rate_limit`, `permission_denied`, `auth`, `unavailable`, `transient`, `capability`, `"limit"` genérico (`unknown`), prioridad de `--error-type` explícito y sanitización de tokens/claves. | Unitaria | **PASS** |
| **Fase 6 — Regresión de escenarios E2E**: `--free-policy strict` (default), `--free-policy allow-included`, `auth`, catálogo vacío, `paid`/`unknown` rechazados y diversidad de proveedores en paralelo. | Simulada (aislada en `os.tmpdir()`) | **PASS** |

---

## 4. Diferencia entre Pruebas Simuladas y Reales, y Limitaciones Pendientes

- **Pruebas simuladas vs reales**: Todas las pruebas de esta fase de remediación fueron unitarias o simuladas en directorios temporales aislados (`node --test`) para no consumir cuotas reales ni provocar errores innecesarios en `opencode_2`. No se re-ejecutaron delegaciones reales `delegate_task` en esta fase (en la auditoría previa quedó demostrado que `opencode_2` tenía sus cuotas gratuitas agotadas).
- **Limitación de concurrencia documentada**: El lockfile (`.lock` con `O_EXCL`/`wx`) protege adecuadamente escrituras concurrentes locales de procesos Node en el mismo host Windows, pero no garantiza exclusión mutua entre hosts distintos sobre sistemas de archivos en red sin soporte POSIX lock (no aplica al uso local de LandingFactory).
