# LandingFactory

> Fábrica reutilizable para construir, modificar, auditar y publicar landing pages a partir de screenshots con alta fidelidad visual, coordinando **Gemini 4 Hydrogen** (implementador único), **6 especialistas gratuitos en OpenCode** (solo lectura) y **Playwright** (verificación real en navegador).

---

## ¿Cómo funciona?

LandingFactory separa estrictamente el **análisis** de la **implementación**:

1. **6 Especialistas en solo lectura (`OpenCode`)**: analizan tus capturas de referencia, definen tokens y arquitectura, revisan el resultado visual y auditan el código sin poder editar archivos.
2. **Implementador único (`Gemini 4 Hydrogen` en T3 Code)**: es el único agente autorizado para crear o modificar código, generar assets, levantar servidores y ejecutar Playwright.
3. **Resiliencia automática (Fallback inteligente)**: si un modelo gratuito falla o agota su cuota, `resolve-model-fallback.mjs` busca otro modelo gratuito compatible en el catálogo real (sin escalar nunca a modelos de pago).
4. **Quality Gate obligatorio**: ninguna landing se da por terminada sin superar build, responsive (`1440×900`, `768×1024`, `390×844`), consola/red limpias, revisión visual, revisión técnica y accesibilidad básica.

---

## Inicio Rápido

```powershell
# 1. Crear un nuevo proyecto dentro de projects/
npm run new-landing -- mi-landing

# 2. Colocar tus capturas de referencia
#    projects/mi-landing/references/desktop.png  (obligatorio)
#    projects/mi-landing/references/mobile.png   (opcional)
```

3. Abre `projects/mi-landing` en **T3 Code** con **Gemini 4 Hydrogen**.
4. Ejecuta `/build-landing` para construirla desde cero.

---

## Comandos Disponibles

| Comando | ¿Cuándo usarlo? |
|---|---|
| `/build-landing` | Construir una landing page desde cero usando las capturas en `references/`. |
| `/modify-landing` | Aplicar cambios puntuales, nuevas secciones o rediseños sobre una landing existente (con selección condicional de especialistas). |
| `/review-landing` | Auditar visual y técnicamente una landing existente sin modificar ningún archivo. |
| `/resume-landing` | Reanudar una sesión interrumpida leyendo `docs/design/session-checkpoint.json`. |
| `/publish-landing` | Preparar y publicar un proyecto de `projects/` como repositorio GitHub independiente (excluye archivos internos de LandingFactory, audita secretos y exige Quality Gate + confirmación explícita). |

---

## Scripts de Utilidad

| Script | Función |
|---|---|
| `npm run new-landing -- <nombre>` | Crea un proyecto nuevo desde `templates/landing-project/`. |
| `npm run capture -- --url <url>` | Captura `1440×900`, `768×1024` y `390×844` con Playwright y detecta overflow/errores. |
| `npm run compare -- --ref <a.png> --impl <b.png>` | Calcula similitud visual global y por secciones (`--zones 3`). |
| `npm run resolve-model -- --agent <nombre>` | Selecciona el mejor modelo gratuito compatible ante fallos. |
| `npm run quality-gate` | Evalúa si la landing está `READY`, `READY_WITH_WARNINGS` o `BLOCKED`. |
| `npm run checkpoint -- --read` | Consulta o guarda el checkpoint de la sesión actual. |
| `npm run publish-landing -- --project projects/<nombre>` | Audita, genera `.gitignore` y prepara la publicación independiente en GitHub. |

---

## Estructura del Repositorio

```text
LandingFactory/
├── .opencode/
│   ├── agents/       # 6 especialistas en modo solo lectura
│   └── commands/     # /build-landing, /modify-landing, /review-landing, /resume-landing, /publish-landing
├── docs/             # Arquitectura, flujo, guía de uso y auditorías
├── projects/         # Proyectos generados (cada uno publicable de forma independiente)
├── scripts/          # Playwright, comparación visual, fallback, checkpoint, quality gate y publicación
└── templates/        # Plantilla base para nuevos proyectos
```

---

## Documentación Detallada

- [Arquitectura del Sistema](docs/architecture.md)
- [Pipeline y Fases de Ejecución](docs/workflow.md)
- [Instalación y Uso Diario](docs/setup.md)
- [Auditoría de Estabilidad](docs/audits/final-stability-audit.md)
