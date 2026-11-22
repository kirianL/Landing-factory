# Inventario de Assets — WakandaProject (`docs/design/asset-inventory.md`)

> **Generado por:** especialista `asset-researcher` (modo solo lectura) + verificación visual del coordinador.
> **Fuente:** `projects/WakandaProject/assets/`.
> **Nivel de confianza:** dimensiones/peso/modo = **observado**; rol asignado = **inferido** / **observado tras inspección**.

## 1. Resumen ejecutivo

| Concepto | Cantidad |
|---|---|
| Total de archivos de imagen catalogados | 31 |
| PNG | 17 |
| JPG | 14 |
| SVG | 0 (no hay iconografía vectorial en `assets/`) |
| Favicon / icono de marca | 0 (se generará en código SVG) |

## 2. Tabla de assets locales recuperables (`REUSE_LOCAL`)

| # | Asset (ruta relativa) | Dimensiones | Ratio | Modo | Rol asignado |
|---|---|---|---|---|---|
| 1 | `assets/WAKANDAPROJECT_RGB-01.png` | 667×667 | 1.00 | RGBA | Logo principal marrón oscuro (navbar sobre fondo claro) [observado] |
| 2 | `assets/WAKANDAPROJECT_RGB-02.png` | 667×667 | 1.00 | RGBA | Logo blanco negativo (navbar transparente / footer oscuro) [observado] |
| 3 | `assets/WAKANDAPROJECT_RGB-03.png` | 667×667 | 1.00 | RGBA | Tarjeta de marca / avatar institucional sobre patrón marrón [observado] |
| 4–13 | `assets/WAKANDAPROJECT_RGB-04.png` … `14.png` (sin 07) | 667×667 | 1.00 | RGBA | Variantes de marca / isotipo (a verificar visualmente) |
| 14 | `assets/INSTAPORTFOLIOWK-01.png` | 5625×4500 | 1.25 (5:4) | RGB | Hero / Portafolio destacado |
| 15 | `assets/INSTAPORTFOLIOWK-02.png` | 5625×4500 | 1.25 (5:4) | RGB | Galería / Portafolio |
| 16 | `assets/INSTAPORTFOLIOWK-08.png` | 5625×4500 | 1.25 (5:4) | RGB | Galería / Portafolio |
| 17 | `assets/fondos -01.png` | 2481×3508 | 0.707 | RGBA | Textura orgánica naranja/dorado (fondo de secciones cálidas / hero) [observado] |
| 18 | `assets/fondos -02.png` | 2481×3508 | 0.707 | RGBA | Textura orgánica marrón tierra oscuro (secciones oscuras / footer) [observado] |
| 19–22 | `assets/Wakanda pics/1.jpg` … `4.jpg` | ~878×1152 a 1365×1791 | 3:4 | RGB | Tarjetas 01–04 de proceso / retratos principales [observado] |
| 23–32 | `assets/Wakanda pics/5.jpg` … `14.jpg` | ~1562×2049 a 3071×4096 | 3:4 | RGB | Galería mosaico, collage hero, actividades y testimonios [observado] |

## 3. Iconografía en código (`USE_CODE_SVG_OR_CSS`)

- Cero emojis y cero iconos raster para UI.
- Menú hamburguesa, flechas de navegación, iconos de pilares culturales (diagrama circular), valores, contacto, redes sociales y favicon se implementan como SVG inline con `currentColor`.
