# Guía de Instalación y Reutilización

## Instalación (Ya ejecutada)

1. Dependencias de Playwright instaladas en `LandingFactory/` (reutilizando Chromium ya instalado en `%LOCALAPPDATA%\ms-playwright`).
2. Skills `design-to-code` y `transitions-dev` instaladas globalmente para OpenCode (`~\.agents\skills\`) y Antigravity (`~\.gemini\config\skills\`).
3. Junctions globales configurados mediante `npm run setup-global`:
   - `~\.config\opencode\agents` → `LandingFactory\.opencode\agents`
   - `~\.config\opencode\commands` → `LandingFactory\.opencode\commands`

## Crear un Proyecto Nuevo

```powershell
cd C:\Users\Kirian\Desktop\LandingFactory
npm run new-landing -- nombre-proyecto
```

O en una ruta externa:

```powershell
npm run new-landing -- nombre-proyecto --dir C:\ruta\externa\nombre-proyecto
```

## Uso Diario

1. Ejecuta `npm run new-landing -- mi-landing`.
2. Coloca `desktop.png` (y opcionalmente `mobile.png`) en `projects/mi-landing/references/`.
3. Abre `projects/mi-landing` en **T3 Code**.
4. Selecciona **Gemini 4 Hydrogen**.
5. Escribe `/build-landing` (más cualquier instrucción específica).
6. Si una sesión se interrumpe, reanuda con `/resume-landing`.
7. Para publicar el proyecto como repositorio independiente en GitHub (tras superar Quality Gate y con autorización explícita), ejecuta `/publish-landing`.
