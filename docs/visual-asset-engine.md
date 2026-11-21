# Visual Asset Engine — Arquitectura, Operación y Release Candidate

> Documentación técnica y operativa del módulo **Visual Asset Engine** en **LandingFactory** (integración oficial con **Recraft API**).

---

## 1. Arquitectura General y Responsabilidades

**Visual Asset Engine** (`scripts/visual-engine/`) es un módulo ESM independiente para Node.js 22+ que desacopla la planificación, dirección creativa, control de presupuesto, generación, validación, optimización y caché de recursos visuales respecto del resto de LandingFactory.

- **Implementador único**: **Gemini 4 Hydrogen** (`antigravity/gemini-4-hydrogen`).
- **Especialistas OpenCode**: permanecen estrictamente en modo **solo lectura** (`edit: deny`, `write: deny`).

### Módulos y Contratos

| Módulo | Responsabilidad |
|---|---|
| [contracts.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/contracts.mjs) | Constantes (`ENGINE_MODES`, `OUTCOMES`, `LEDGER_STATUS`, `DEFAULT_LOCAL_BUDGET = 1000`) y errores (`VisualEngineError`, `BudgetExceededError`). |
| [config.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/config.mjs) | Lectura de variables de entorno, carga de `models-config.json` y redacción de secretos (`redactSecrets`). |
| [models-config.json](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/models-config.json) | Catálogo configurable de modelos, capacidades, límites de prompt y estimaciones de reserva. |
| [providers/base-provider.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/providers/base-provider.mjs) | Interfaz `BaseVisualProvider` que desacopla LandingFactory de cualquier proveedor concreto. |
| [providers/recraft-provider.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/providers/recraft-provider.mjs) | Adaptador oficial `https://external.api.recraft.ai/v1`: `GET /users/me`, `POST /images/generations`, `POST /styles`, `GET /styles`, `POST /images/imageToImage`. Usa `AbortController` para timeout/cancelación local; nunca reintenta `POST` tras resultado ambiguo. |
| [credit-manager.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/credit-manager.mjs) | Autoridad única de presupuesto (`1000` por defecto), separado del saldo real (`GET /users/me`). Reserva previa bajo lock atómico, conciliación donde `credits` de Recraft prevalece y registro `UNKNOWN_OUTCOME` sin reintento duplicado. |
| [style-registry.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/style-registry.mjs) | Persiste y reutiliza `style_id` por proyecto para evitar crear estilos duplicados. |
| [visual-planner.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/visual-planner.mjs) | Analiza secciones y decide `GENERATE`, `REUSE_EXISTING`, `USE_SVG_OR_CSS` (obligatorio para iconos UI) o `SKIP` (evita imágenes innecesarias en `faq`, `pricing`, etc.). |
| [creative-director.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/creative-director.mjs) | Define dirección creativa coherente por proyecto, variaciones originales desde referencias y política flexible de texto en imagen. |
| [model-selector.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/model-selector.mjs) | Selecciona modelo según tipo (raster/vector), calidad, compatibilidad con estilos/referencias y presupuesto restante. |
| [strategy.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/strategy.mjs) | Resuelve la estrategia por recurso (`REUSE_LOCAL`, `USE_CODE_SVG_OR_CSS`, `GENERATE_WITH_STYLE_ID`, `GENERATE_WITH_REFERENCES`, `GENERATE_INDEPENDENT`, `SKIP`). |
| [asset-composer.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/asset-composer.mjs) | Traduce el plan de FASE 3 en solicitudes válidas para el proveedor respetando `maxPromptLength` y capacidades del modelo. |
| [security-validator.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/security-validator.mjs) | Allowlist HTTPS, validación salto a salto de redirecciones (`redirect: 'manual'`, máx. 3), magic bytes + dimensiones reales, sanitización estricta de SVG, límite de 15 MiB y bloqueo de path traversal. |
| [optimizer.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/optimizer.mjs) | Capa desacoplada: usa `sharp` de forma opcional si está instalado (conversión a WebP `q=85`), o passthrough validado sin dependencias nativas. |
| [cache-manager.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/cache-manager.mjs) | Caché SHA-256 determinista en `.visual-engine-state/cache/` con verificación de integridad y corrupción. |
| [pipeline.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/pipeline.mjs) | Ejecuta el flujo completo con concurrencia acotada, tolerancia a fallos parciales, reanudación (`resumeFromPrevious`) y manifiestos de trazabilidad. |
| [atomic-fs.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/atomic-fs.mjs) | Lockfile y escrituras JSON/binarias atómicas compatibles con Windows (`EBUSY`/`EPERM` retry). |
| [logger.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/logger.mjs) | Logging JSONL estructurado en `.visual-engine-state/logs/` con redacción de secretos. |
| [engine.mjs](file:///C:/Users/Kirian/Desktop/LandingFactory/scripts/visual-engine/engine.mjs) | Fachada `VisualAssetEngine` (`getStatus`, `listAvailableModels`, `testConnection`, `ensureProjectStyle`, `generateImage`, `planLandingVisuals`, `executeVisualPlan`, `getProjectRecoveryState`). |

---

## 2. Guía de Configuración y Variables de Entorno

| Variable | Predeterminado | Descripción |
|---|---|---|
| `RECRAFT_API_TOKEN` | `""` (vacío) | Variable canónica de autenticación Bearer contra Recraft API. Nunca debe guardarse en código ni en archivos versionados. |
| `VISUAL_ENGINE_PROVIDER` | `recraft` | Proveedor activo del motor visual. |
| `VISUAL_ENGINE_ENABLED` | `false` | Habilita o deshabilita operaciones `LIVE`. Debe ser `true` (junto con `VISUAL_ENGINE_MODE=LIVE`) para permitir llamadas de generación reales. |
| `VISUAL_ENGINE_MODE` | `DRY_RUN` | `DRY_RUN` simula sin red ni consumo; `LIVE` ejecuta solicitudes reales solo si `VISUAL_ENGINE_ENABLED=true` y existe `RECRAFT_API_TOKEN`. |
| `VISUAL_ENGINE_BUDGET` | `1000` | Presupuesto local máximo interno de LandingFactory (en unidades de crédito). No representa el límite de la cuenta Recraft. |

### Seguridad y Control `DRY_RUN` vs `LIVE`
- **Doble compuerta**: `LIVE` solo se activa cuando **ambas** variables (`VISUAL_ENGINE_MODE=LIVE` y `VISUAL_ENGINE_ENABLED=true`) están activas y `RECRAFT_API_TOKEN` está configurada. La CLI no expone ningún flag `--live`.
- **Volver a `DRY_RUN`** en PowerShell:
  ```powershell
  $env:VISUAL_ENGINE_MODE="DRY_RUN"
  $env:VISUAL_ENGINE_ENABLED="false"
  ```
- **Errores de autenticación o conectividad**:
  - `AUTH_ERROR` (`401`/`403`): verificar que `RECRAFT_API_TOKEN` esté definida en la sesión actual sin espacios ni comillas extra; no se reintenta.
  - `RATE_LIMIT` (`429`) o red en `GET`: reintenta hasta `maxRetries` (2 por defecto). En `POST`, nunca reintenta tras resultado ambiguo.

---

## 3. Catálogo de Modelos Verificados (`models-config.json`)

> **Nota**: Los valores `estimatedCredits` son estimaciones locales para reserva previa (sujetas a cambios por Recraft). En modo `LIVE`, el campo `credits` devuelto por la API prevalece siempre como fuente de verdad.

| ID Modelo | Tipo | Estilos / `style_id` | `style_reference_urls` | `imageToImage` | Límite Prompt | Estimación (unidades) | Notas |
|---|---|---|---|---|---|---|---|
| `recraftv4_1_flash_v2` | Raster | No | No | No | 10,000 | 7 | Ultra-económico para generación raster independiente. |
| `recraftv4_1` | Raster (default) | Sí | Sí | Sí | 10,000 | 35 | Equilibrado; admite estilos y referencias. |
| `recraftv4` | Raster | Sí | Sí | Sí | 10,000 | 40 | Familia V4 estándar. |
| `recraftv4_pro` | Raster 2K | Sí | Sí | Sí | 10,000 | 250 | Reservado para piezas clave (ej. Hero) cuando el presupuesto lo permite. |
| `recraftv4_vector` | Vector SVG | Sí | Sí | No | 10,000 | 80 | Salida SVG nativa. |
| `recraftv4_styles` | Raster | Sí (`requiresStyleReference: true`) | Sí | No | 10,000 | 40 | Exige `style_id` o `style_reference_urls`; excluido automáticamente si no hay referencias. |
| `recraftv3` | Raster | Sí | No | Sí | 1,000 | 40 | No admite `style_reference_urls`. |
| `recraftv3_vector` | Vector SVG | Sí | No | No | 1,000 | 80 | No admite `style_reference_urls`. |

---

## 4. Guía Operativa CLI, Recuperación y Publicación

CLI principal: `node scripts/visual-engine.mjs <comando> [--project <id>] [--prompt <texto>] [--model <id>] [--size <WxH>] [--help]`

| Comando | Red | Comportamiento |
|---|---|---|
| `status` | No (offline) | Muestra modo (`DRY_RUN`/`LIVE`), estado del token (`hasApiToken` booleano), ruta `stateDir` y resumen de presupuesto. |
| `models` | No (offline) | Lista los modelos configurados en `models-config.json` y sus capacidades. |
| `usage` | No (offline) | Muestra el resumen de presupuesto y el ledger de operaciones del proyecto (`--project`). |
| `plan` | No (offline) | Ejecuta `planLandingVisuals` en `DRY_RUN` mostrando secciones omitidas, reutilizadas, modelo elegido y estimación. |
| `run-plan` | Offline en `DRY_RUN` / HTTP en `LIVE` | Ejecuta `GenerationPipeline` sobre el plan y guarda el manifiesto en `.visual-engine-state/manifests/<project>-assets.json`. |
| `generate` | Offline en `DRY_RUN` / HTTP en `LIVE` | Genera un recurso puntual pasando por `CreditManager`. |
| `test-connection` | Sí (`GET /users/me`) | Consulta cuenta y saldo real (`credits`) en Recraft sin consumir créditos. |

### Integración, Recuperación y Publicación Segura
- **`/build-landing`**: en Fase 3 planifica con `VisualPlanner` + `CreativeDirector` + `GenerationStrategy`, genera/reutiliza solo lo necesario en `public/images/` y referencia las rutas reales en los componentes.
- **`/modify-landing`**: cambios de texto/espaciado/color no regeneran imágenes; cambios visuales regeneran solo los assets afectados reutilizando caché y `style_id`.
- **`/resume-landing`**: `getProjectRecoveryState(projectId)` recupera plan, manifiesto, estilos y créditos. `executeVisualPlan(..., { resumeFromPrevious: true })` omite assets ya completados en disco. Si existe **`UNKNOWN_OUTCOME`** (timeout o pérdida de respuesta tras enviar un `POST`), el sistema bloquea el reenvío idéntico (`UNKNOWN_OUTCOME_BLOCKED`) hasta inspección/reconciliación manual contra `GET /users/me` para evitar cobros duplicados.
- **`publish-landing.mjs`**: excluye `.visual-engine-state/`, `docs/design/visual-*`, caché y logs; detecta `RECRAFT_API_TOKEN`/`RECRAFT_API_KEY` y tokens `rc_*` en `SECRET_PATTERNS`; y conserva intactos los recursos finales en `public/images/`.

### Testing
Ejecución de todas las suites automatizadas (sin red ni consumo real):
```powershell
node --test scripts/test-visual-engine.mjs
node --test scripts/test-visual-intelligence.mjs
node --test scripts/test-asset-pipeline.mjs
node --test scripts/test-integration-e2e.mjs
node --test scripts/test-model-fallback.mjs
```

---

## 5. Procedimiento Preparado para la Primera Generación Controlada `LIVE`

> **Advertencia**: Este procedimiento está documentado y listo, pero **no debe ejecutarse sin autorización explícita**.

1. **Validar token sin exponerlo**:
   ```powershell
   if ($env:RECRAFT_API_TOKEN) { "RECRAFT_API_TOKEN=CONFIGURADA" } else { throw "Falta RECRAFT_API_TOKEN" }
   ```
2. **Verificar conectividad y saldo real (`GET /users/me`, 0 créditos consumidos)**:
   ```powershell
   node scripts/visual-engine.mjs test-connection
   ```
   Confirmar que `account.initialAccountCredits` es suficiente.
3. **Activar `LIVE` con presupuesto local temporal acotado** (`50` unidades como **límite interno local** de LandingFactory, independiente del saldo real de Recraft) y ejecutar una sola generación con el modelo más económico (`recraftv4_1_flash_v2`, estimación ~`7` unidades):
   - **Modelo**: `recraftv4_1_flash_v2`
   - **Parámetros**: `size: "1024x1024"`, `response_format: "url"`, `n: 1`
   - **Prompt**: `"Minimalist architectural studio desk with soft natural daylight, warm walnut surface, clean negative space"`
   - **Directorio de salida (cuando se ejecute vía pipeline de proyecto)**: `<proyecto>/public/images/` (y estado interno en `.visual-engine-state/`).
   ```powershell
   $env:VISUAL_ENGINE_ENABLED="true"
   $env:VISUAL_ENGINE_MODE="LIVE"
   $env:VISUAL_ENGINE_BUDGET="50"
   node scripts/visual-engine.mjs generate --project live-smoke-test --model recraftv4_1_flash_v2 --size 1024x1024 --prompt "Minimalist architectural studio desk with soft natural daylight, warm walnut surface, clean negative space"
   ```
4. **Conciliación y validación**:
   ```powershell
   node scripts/visual-engine.mjs usage --project live-smoke-test
   ```
   Verificar que `creditsSource === "api"`, que `actualCredits` coincide con el `credits` devuelto por Recraft y que la imagen descargada superó la validación de allowlist, magic bytes y dimensiones.
5. **Restaurar `DRY_RUN` inmediatamente**:
   ```powershell
   $env:VISUAL_ENGINE_MODE="DRY_RUN"
   $env:VISUAL_ENGINE_ENABLED="false"
   Remove-Item Env:VISUAL_ENGINE_BUDGET -ErrorAction SilentlyContinue
   ```
6. **Recuperación ante error ambiguo (`UNKNOWN_OUTCOME`)**:
   Si ocurriera un timeout/corte tras enviar el `POST`, **no reintentar la generación**. Consultar `node scripts/visual-engine.mjs test-connection` y `usage --project live-smoke-test` para comparar el saldo real antes de tomar cualquier acción.
