# Informe de Análisis Visual — WakandaProject

**Ruta destino:** `docs/design/visual-analysis.md`  
**Rol:** `visual-analyst` (solo lectura)  
**Proyecto:** WakandaProject — landing cultural/artística afrodescendiente y juvenil, en español, enfoque híbrido  
**Fuente de verdad:** `projects/WakandaProject/references/` (4 imágenes) + marca y copy oficial en `projects/WakandaProject/assets/`

## 1. Alcance y método

| # | Archivo | Referencia | Secciones clave observadas |
|---|---|---|---|
| 1 | `50688775391_s_whatsapp_net-3A0E58949924B4D5B391.jpg` | AgriRestore | Diagrama circular de iconos (7 nodos + centro), grid 2×2 de tarjetas + tarjeta alta con foto, collage fotográfico asimétrico, formulario de contacto sobre fondo sólido |
| 2 | `50688775391_s_whatsapp_net-3A0E8A48FFD1D05A4832.jpg` | Tour Georgia | Bordes de papel rasgado, testimonios estilo "sobre" con recorte superior poligonal y foto circular, cierre ilustrado, iconos sociales |
| 3 | `50688775391_s_whatsapp_net-3A3FC93ED301B7F0070D.jpg` | Doc Mo Farm | Hero con collage geométrico, sobre nosotros, 3 tarjetas de valores, misión, actividades horizontales, galería de espacios, testimonio destacado, noticias/eventos, mapa, footer |
| 4 | `50688775391_s_whatsapp_net-3A8AB417C62C4443A49E.jpg` | Our Process | 4 tarjetas verticales numeradas 01–04 con fotografía duotono y texto blanco superpuesto + banda de aliados |

## 2. Arquitectura híbrida propuesta (orden de secciones)

1. **Header / Navbar** (`Doc Mo Farm` [observed] + logo `WAKANDAPROJECT_RGB-01.png` [inferred]): barra superior limpia con navegación, enlace a secciones y CTA principal.
2. **Hero geométrico** (`Doc Mo Farm` [observed] + patrón `fondos -01.png` y collage de `Wakanda pics/` [inferred]): titular de impacto, descripción oficial de WakandaProject, CTA principal + composición geométrica de fotos reales.
3. **Quiénes somos + Diagrama circular de pilares** (`AgriRestore` + `Doc Mo Farm` [observed]): diagrama radial con 6 nodos conectados alrededor del centro + bloque editorial con Misión y Visión oficiales.
4. **Valores fundamentales (3 tarjetas)** (`Doc Mo Farm` [observed]): 3 tarjetas (Identidad cultural, Disciplina artística, Comunidad segura) con iconos SVG inline.
5. **Nuestra metodología / Proceso (01–04)** (`Our Process` [observed]): 4 tarjetas verticales numeradas `01` a `04` sobre fondo oscuro (`#1A0D04`) con fotografías de `Wakanda pics/1.jpg`–`4.jpg` con tratamiento duotono cálido naranja/tierra y texto blanco superpuesto.
6. **Talleres y actividades** (`Doc Mo Farm` [observed]): 4 tarjetas horizontales de programas/ritmos (Danza afro, Ritmos urbanos, Expresión corporal, Presentaciones culturales).
7. **Galería en acción (collage asimétrico)** (`AgriRestore` [observed]): mosaico de fotografías reales de `Wakanda pics/` con bordes redondeados.
8. **Voces de la comunidad (testimonios estilo sobre)** (`Tour Georgia` [observed]): 3 tarjetas con recorte poligonal superior tipo sobre, retrato circular y cita de familias/jóvenes.
9. **Contacto e inscripción** (`AgriRestore` + `Doc Mo Farm` [observed]): sección sobre fondo sólido cálido/oscuro con formulario de 2 columnas (nombre, correo, asunto/programa, mensaje) + información de contacto y redes sociales SVG.
10. **Footer** (`Doc Mo Farm` [observed]): fondo oscuro (`fondos -02.png` / `#2A1205`) con logo negativo `WAKANDAPROJECT_RGB-02.png`, mapa de sitio, contacto y derechos.

## 3. Comportamiento responsive obligatorio

| Sección | Desktop (`1440×900`) | Tablet (`768×1024`) | Mobile (`390×844`) |
|---|---|---|---|
| Navbar | Enlaces horizontales + CTA | Enlaces compactos / hamburguesa | Menú hamburguesa |
| Hero | 2 columnas (texto + collage) | Apilado o 2 columnas ajustadas | 1 columna |
| Diagrama circular | 2 columnas (diagrama + texto) | Apilado centrado | Nodos en grid 2×3 + texto |
| Proceso 01–04 | 4 columnas | Grid 2×2 | 1 columna |
| Galería collage | Grid asimétrico 3 columnas | 2 columnas | 1–2 columnas |
| Testimonios sobres | 3 columnas | 2+1 o carrusel | 1 columna |
| Formulario contacto | 2 columnas | 2 columnas | 1 columna |
