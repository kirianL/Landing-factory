---
description: "Modifica una landing page existente analizando alcance, seleccionando especialistas condicionalmente, planificando, implementando con Gemini Hydrogen y verificando con Playwright."
---

# /modify-landing — Pipeline de Modificación Segura de LandingFactory

Instrucciones adicionales del usuario:
$ARGUMENTS

Ejecuta estrictamente el flujo obligatorio de modificación sobre una landing page existente, protegiendo el trabajo previo y aplicando el sistema inteligente de fallback en los subagentes.

## FASE 0 — INSPECCIÓN DEL PROYECTO Y PROTECCIÓN GIT

Antes de crear, editar o eliminar cualquier archivo:
1. Identifica la raíz del proyecto actual y lee su `AGENTS.md` (si existe).
2. Inspecciona `package.json`, framework, sistema de estilos, componentes, rutas, assets (`assets/`, `public/`) y documentación previa en `docs/design/` (`visual-analysis.md`, `design-system.md`, `asset-inventory.md`, `implementation-plan.md`, `visual-qa.md`).
3. Identifica exactamente qué archivos, secciones y funcionalidades se ven afectados por la solicitud. No asumas un stack sin verificarlo.
4. Verifica si Git está disponible e inspecciona `git status`.
   - **Prohibido**: descartar cambios sin commit, ejecutar `git reset --hard`, ejecutar `git clean`, sobrescribir cambios previos del usuario sin respaldo, o crear commits/despliegues automáticos.

## FASE 1 — CLASIFICACIÓN DE LA SOLICITUD

Clasifica la solicitud en uno de estos niveles para dimensionar el análisis:
- **Nivel 1 (Cambios pequeños)**: textos, colores puntuales, enlaces, botones, sustitución simple de imágenes, espaciados o ajustes menores de componentes.
- **Nivel 2 (Cambios intermedios)**: rediseño de secciones, nuevos componentes, cambios de distribución/layout, formularios, mejoras responsive o cambios de navegación.
- **Nivel 3 (Cambios estructurales)**: rediseño integral, nueva identidad visual, reorganización de arquitectura, cambios importantes de funcionalidades o refactorizaciones amplias.

## FASE 2 — SELECCIÓN INTELIGENTE DE SUBAGENTES (Solo lectura)

**No lances los 6 especialistas automáticamente.** Selecciona únicamente los necesarios según el tipo de cambio:

| Tipo de solicitud | Especialistas a consultar |
|---|---|
| Textos, enlaces o cambios mínimos | Ninguno, salvo necesidad |
| Cambios visuales | `visual-analyst` + `ui-ux-designer` |
| Sustitución o búsqueda de imágenes | `asset-researcher` + `visual-analyst` |
| Nueva sección | `ui-ux-designer` + `implementation-planner` |
| Cambios responsive | `visual-analyst` + `visual-qa` |
| Errores técnicos / rendimiento / A11y | `code-reviewer` |
| Rediseño integral | Los 6 especialistas |

### Reglas de delegación y fallback inteligente
1. Lanza los análisis independientes en paralelo cuando sea posible, pasando únicamente el contexto concreto de la solicitud y los archivos afectados.
2. Todos los especialistas trabajan en modo **solo lectura** (`edit: deny`, `write: deny`): devuelven hallazgos y recomendaciones; nunca editan archivos.
3. **Resiliencia y Orquestación Automática del Fallback (6 pasos)**:
   - Protocolo determinista ante cualquier fallo de delegación:
     1. Detectar y clasificar el fallo (`transient`, `rate_limit`, `quota_exhausted`, `unavailable`, `capability`, `permission_denied`, `auth`).
     2. Ejecutar `node <LandingFactory>/scripts/resolve-model-fallback.mjs --agent <especialista> --error-type <tipo> --failed-model <modelo> --exclude <modelos-fallidos> --state-file docs/design/model-health-state.json --log-file docs/design/model-fallback-log.md`.
     3. Leer `selectedModel`, `executionTarget` (`providerInstanceId`, `model`, `executionMethod`) y `action` de la salida JSON.
     4. Volver a delegar `delegate_task` usando `executionTarget.providerInstanceId` y `executionTarget.model` (si `action` es `USE_FALLBACK` o `RETRY_PRIMARY`).
     5. Confirmar que el subagente respondió correctamente sin alterar los modelos base de `.opencode/agents/`.
     6. Registrar el resultado final en `docs/design/model-fallback-log.md`.
   - Perfiles de capacidad:
     - **Perfil A (Visual / Multimodal)**: `visual-analyst`, `ui-ux-designer`, `asset-researcher`, `visual-qa`. Si la tarea requiere analizar imágenes/capturas, el sustituto **debe** admitir visión; nunca sustituyas por un modelo solo-texto.
     - **Perfil B (Planificación)**: `implementation-planner`.
     - **Perfil C (Revisión técnica)**: `code-reviewer`.
   - **Política de reintentos**: 1 reintento en primer error transitorio; al segundo error (o límite de cuota / indisponibilidad / incompatibilidad) pasa inmediatamente al siguiente modelo gratuito compatible. Ante error de autenticación, detente e informa al usuario.
   - **Restricción económica**: solo modelos gratuitos verificados en el catálogo real. Nunca escales automáticamente a modelos de pago. Si no existe alternativa gratuita compatible en `opencode_2`, usa `antigravity/gemini-3.8-flash` (solo lectura) si está autorizado como último recurso, o detén únicamente esa subtarea e informa al usuario.
   - Registra todo evento de fallback en `docs/design/model-fallback-log.md` (sin secretos ni claves).

## FASE 3 — PLANIFICACIÓN

Elabora un plan antes de modificar código que incluya:
1. Descripción del cambio.
2. Componentes y archivos afectados.
3. Dependencias relacionadas.
4. Riesgos de regresión.
5. Impacto visual y funcional.
6. Pruebas necesarias.
7. Orden de implementación.

Reglas por nivel:
- **Nivel 1**: plan breve y ejecución directa.
- **Nivel 2**: plan concreto documentado antes de editar.
- **Nivel 3**: **presenta el plan completo al usuario y espera aprobación explícita antes de modificar archivos.**
- Si faltan datos esenciales o hay ambigüedad que altere materialmente el resultado, haz una pregunta concreta antes de implementar.

## FASE 4 — IMPLEMENTACIÓN (Solo Gemini 4 Hydrogen)

**Gemini 4 Hydrogen** es el único agente autorizado a editar archivos, instalar dependencias o ejecutar comandos:
- Modifica únicamente lo necesario; preserva componentes, funcionalidades y el sistema de diseño existente (salvo que el usuario pida cambiarlo).
- **Integración incremental con Visual Asset Engine**:
  - Cambios de texto, espaciado o colores no deben disparar regeneración de imágenes existentes.
  - Si la modificación afecta recursos visuales, identifica exactamente qué asset(s) cambian, conserva los restantes intactos, reutiliza caché (`GenerationCache`) y `style_id` del proyecto cuando corresponda, y actualiza las referencias en los componentes afectados.
- Mantén consistencia visual, responsive y accesibilidad (`SVG` para iconos, cero emojis, sin `object-fit` deformado, sin dependencias innecesarias).
- No generes contenido ficticio del cliente ni imágenes arbitrarias; no realices refactorizaciones fuera del alcance ni elimines archivos/funcionalidades sin autorización.

## FASE 5 — VERIFICACIÓN TÉCNICA Y VISUAL

Después de implementar:
1. Ejecuta las verificaciones disponibles del proyecto (`build`, `typecheck`, `lint`, `test`, según corresponda).
2. Levanta el servidor local y ejecuta Playwright con:
   `node <LandingFactory>/scripts/capture-landing.mjs --url <local-url> --out docs/design/captures`
   verificando `1440×900`, `768×1024` y `390×844`.
3. Revisa errores de consola, errores de red (`status >= 400`), desbordamiento horizontal e interacciones afectadas.
4. Lanza `@visual-qa` si el cambio tiene impacto visual significativo, y `@code-reviewer` si tiene impacto técnico, funcional o estructural (aplicando el sistema de fallback si hace falta).
5. **Cierre obligatorio del ciclo de auditoría tras correcciones**:
   - **Hallazgo crítico/técnico** → repetir `@code-reviewer` después de corregir.
   - **Hallazgo visual** → repetir `@visual-qa` y re-capturar Playwright después de corregir (máximo 3 rondas visuales).
   - **Cambio estructural (Nivel 3)** → repetir ambos (`@visual-qa` y `@code-reviewer`).
   - **Cambio trivial (Nivel 1)** → verificar únicamente las pruebas afectadas.
6. **LandingFactory Quality Gate**:
   Ejecuta `node <LandingFactory>/scripts/quality-gate.mjs` (indicando `--build`, `--a11y`, `--code-review` y `--compare-report` si aplica).
   Distingue explícitamente entre `blockers`, `warnings` y `notApplicable`. **Nunca declares `PASS` o `READY` si un chequeo aplicable no se ejecutó o está en `BLOCKED`.**

## FASE 6 — ENTREGA

Presenta un resumen estructurado distinguiendo claramente lo completado de lo pendiente:
- Cambios realizados y archivos principales modificados.
- Subagentes consultados, modelos utilizados y fallbacks activados (si aplica).
- Pruebas ejecutadas y resultados de Playwright (`1440×900`, `768×1024`, `390×844`, consola, red, overflow).
- Problemas encontrados y aspectos pendientes o que requieren aprobación.
