---
description: "Recupera una ejecución interrumpida de LandingFactory leyendo el checkpoint en docs/design/session-checkpoint.json sin repetir fases ya completadas."
---

# /resume-landing — Recuperación de Sesión Interrumpida

Instrucciones adicionales del usuario:
$ARGUMENTS

Ejecuta el flujo de recuperación sobre el proyecto actual:
1. Lee `docs/design/session-checkpoint.json` usando `node <LandingFactory>/scripts/session-checkpoint.mjs --read` (si existe).
2. Inspecciona `git status` y los entregables existentes en `docs/design/` (`visual-analysis.md`, `design-system.md`, `asset-inventory.md`, `implementation-plan.md`, `visual-qa.md`, `captures/report.json`, `model-fallback-log.md`).
3. Reconstruye el estado exacto sin descartar trabajo previo ni repetir fases ya completadas.
4. Continúa desde la fase pendiente aplicando el protocolo de fallback (6 pasos) y cerrando con `quality-gate.mjs` antes de declarar `READY`.
