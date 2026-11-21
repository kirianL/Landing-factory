---
description: "Prepara y publica una landing de projects/<nombre> como repositorio GitHub independiente, excluyendo la infraestructura interna de LandingFactory, auditando secretos y exigiendo Quality Gate y autorización explícita."
---

# /publish-landing — Publicación Independiente en GitHub

Instrucciones adicionales del usuario:
$ARGUMENTS

Ejecuta estrictamente este flujo para preparar o publicar una landing como repositorio independiente sin alterar el proyecto original ni exponer la infraestructura interna de LandingFactory:

## FASE 0 — VALIDACIÓN ESTRICTA DE DIRECTORIO
1. Identifica el proyecto objetivo y verifica que pertenece **estrictamente** a `projects/<nombre-proyecto>` dentro de LandingFactory.
2. **Bloqueo obligatorio**: rechaza inmediatamente la ejecución si:
   - El directorio actual es la raíz de LandingFactory.
   - La ruta está fuera de `projects/`.
   - La ruta es ambigua o inexistente.
3. No operes sobre otros proyectos. Si falla la validación, detente sin modificar archivos.

## FASE 1 — AUDITORÍA DE ARCHIVOS, `.gitignore` Y SECRETOS
1. Ejecuta en modo inspección:
   `node <LandingFactory>/scripts/publish-landing.mjs --project <ruta-proyecto>`
2. Verifica que se excluyen archivos internos de LandingFactory (`.opencode/`, `docs/design/captures/`, `docs/design/model-fallback-log.md`, `docs/design/session-checkpoint.json`, `docs/design/quality-gate*.json`, `docs/design/compare-report.json`, scripts del orquestador, logs y `.env*` conservando `.env.example`).
3. **No elimines ni muevas archivos del proyecto original.** Usa `.gitignore` y staging selectivo.
4. Si se detectan credenciales o secretos reales, **bloquea** la publicación (`BLOCKED`) hasta que el usuario los retire.

## FASE 2 — VALIDACIÓN DE CALIDAD (OBLIGATORIA)
1. Ejecuta instalación/build del proyecto según su stack.
2. Ejecuta `npm run quality-gate` (`node <LandingFactory>/scripts/quality-gate.mjs`).
3. **Regla innegociable**: `not_run`, `BLOCKED` o `FAIL` impiden el `push`. Se permite preparar localmente (`PREPARED`), pero nunca publicar sin superar Quality Gate.

## FASE 3 — PREPARACIÓN SEGURA DE GIT
- Si no hay `.git`: inicializa Git dentro del proyecto, genera/completa `.gitignore` adecuado y realiza staging selectivo con `--prepare` (sin `git reset --hard`, sin `git clean -fd`, sin reescribir historial).
- Si ya hay `.git`: inspecciona `git status` y `git remote -v`; conserva cambios existentes y no sobrescribas el remoto ni hagas commits sobre cambios ajenos sin autorización.

## FASE 4 — REPOSITORIO REMOTO Y AUTORIZACIÓN EXPLÍCITA
1. Confirma con el usuario: nombre del repositorio, cuenta/organización propietaria, visibilidad (`private` por defecto o `public`) y URL remota. Si `gh` CLI está autenticado, puedes crear el remoto; si no, entrega los comandos manuales sin solicitar ni guardar tokens personales.
2. **Antes del primer `push`**, presenta al usuario el resumen completo (`AWAITING_APPROVAL`):
   - Ruta local, repositorio remoto, visibilidad, cantidad de archivos incluidos, resumen de excluidos, auditoría de secretos, resultado del build y resultado del Quality Gate.
3. **Nunca ejecutes `git push` sin confirmación explícita del usuario.** Una solicitud genérica de preparación no autoriza el push.

## FASE 5 — ENTREGA
Reporta el estado exacto: `PREPARED` | `AWAITING_APPROVAL` | `PUBLISHED` | `BLOCKED`, junto con URL de GitHub (si existe), estado del push, build, Quality Gate, auditoría de seguridad y conteo de archivos incluidos/excluidos.
