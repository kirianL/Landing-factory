# LandingFactory

Infraestructura reutilizable para reconstruir landing pages a partir de screenshots con máxima fidelidad visual, coordinando **OpenCode** (6 especialistas gratuitos en modo solo lectura), **Gemini 4 Hydrogen** (implementador único en T3 Code) y **Playwright** (captura y comparación real).

## Flujo Rápido

```text
CREAR CARPETA → AÑADIR SCREENSHOTS → ABRIR EN T3 CODE → EJECUTAR /build-landing → OBTENER LANDING PAGE
```

1. Crear proyecto:
   ```powershell
   npm run new-landing -- mi-landing
   ```
2. Añadir capturas en `projects/mi-landing/references/desktop.png` (y `mobile.png` opcional).
3. Abrir `projects/mi-landing` en **T3 Code** con **Gemini 4 Hydrogen**.
4. Ejecutar `/build-landing` (para crear desde cero), `/modify-landing` (para modificar una landing existente) o `/review-landing` (para auditar sin modificar).

## Comandos Disponibles

| Comando | Función |
|---|---|
| `/build-landing` | Crear o reconstruir una landing page desde screenshots en `references/`. |
| `/modify-landing` | Modificar una landing page existente con selección condicional de especialistas y verificación Playwright. |
| `/review-landing` | Auditar visual y técnicamente una landing existente sin reconstruirla. |

## Documentación

- [Arquitectura](docs/architecture.md)
- [Pipeline y Fases](docs/workflow.md)
- [Instalación y Uso](docs/setup.md)
