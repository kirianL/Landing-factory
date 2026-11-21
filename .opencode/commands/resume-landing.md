---
description: "Recupera una ejecución interrumpida de LandingFactory leyendo el checkpoint en docs/design/session-checkpoint.json sin repetir fases ya completadas."
---

# /resume-landing — Recuperación de Sesión Interrumpida

Instrucciones adicionales del usuario:
$ARGUMENTS

Ejecuta el flujo de recuperación sobre el proyecto actual:
1. Lee `docs/design/session-checkpoint.json` usando `node <LandingFactory>/scripts/session-checkpoint.mjs --read` (si existe).
2. Inspecciona `git status`, los entregables existentes en `docs/design/` (`visual-analysis.md`, `design-system.md`, `asset-inventory.md`, `implementation-plan.md`, `visual-qa.md`, `captures/report.json`, `model-fallback-log.md`) y el estado de **Visual Asset Engine** (`getProjectRecoveryState` en `.visual-engine-state/`: plan visual, dirección creativa, estilos, manifiesto de assets, créditos y operaciones `UNKNOWN_OUTCOME`).
3. Reconstruye el estado exacto sin descartar trabajo previo ni repetir fases o generaciones ya completadas; mantén bloqueado cualquier reenvío idéntico en `UNKNOWN_OUTCOME` hasta su reconciliación.
4. Continúa desde la fase pendiente aplicando el protocolo de fallback multiproveedor (`resolve-model-fallback.mjs` con `--state-file docs/design/model-health-state.json`) y cerrando con `quality-gate.mjs` antes de declarar `READY`.
