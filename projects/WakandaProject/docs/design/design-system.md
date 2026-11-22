# Wakanda Project — Sistema de Diseño (`docs/design/design-system.md`)

> **Generado por:** `ui-ux-designer` (solo lectura) + verificación del coordinador.
> **Enfoque:** diseño híbrido creativo (estructura base tipo Doc Mo Farm + tarjetas 01–04 tipo Our Process + diagrama circular y collage tipo AgriRestore + testimonios tipo sobre/recorte de Tour Georgia).
> **Paleta:** marca oficial de **Wakanda Project** (marrón tierra oscuro, naranja vibrante, dorado/ámbar, crema cálido).
> **Regla tipográfica/editorial:** sentence case estricto en toda la UI (solo primera palabra en mayúscula, salvo nombres propios como `Wakanda Project`).

## 1. Tokens CSS (`:root`)

```css
:root {
  /* Primitivos de marca (extraídos de assets/) */
  --color-brown-dark: #3B1D0A;     /* Marrón tierra oscuro — texto primario, logo, footer */
  --color-brown-mid:  #5A2D0C;     /* Marrón tierra medio — superficies oscuras, bordes */
  --color-brown-soft: #8A5A3B;     /* Marrón cálido suave — texto secundario */
  --color-orange:     #D95B00;     /* Naranja vibrante (AA sobre crema/blanco con texto blanco >= 4.5:1 en botones grandes o #C24D00) */
  --color-orange-cta: #C24D00;     /* Naranja accesible para botones con texto blanco (contraste 4.6:1+) */
  --color-orange-dim: #9E3D00;     /* Hover de botón primario */
  --color-amber:      #F59E0B;     /* Dorado / ámbar — acentos, detalles, highlights */
  --color-amber-soft: #FEF3C7;     /* Ámbar suave — fondos de tarjetas destacadas */
  --color-cream:      #FAF6EE;     /* Crema cálido — fondo principal de página */
  --color-cream-alt:  #F3ECE0;     /* Crema alterno — secciones secundarias */
  --color-surface:    #FFFFFF;     /* Blanco cálido — tarjetas limpias */
  --color-ink-dark:   #1A0D04;     /* Fondo oscuro para bloque Proceso 01–04 y footer */
  --color-white:      #FFFFFF;

  /* Semánticos */
  --color-bg-page:    var(--color-cream);
  --color-bg-alt:     var(--color-cream-alt);
  --color-bg-dark:    var(--color-ink-dark);
  --color-text:       var(--color-brown-dark);
  --color-text-muted: #5C4435;
  --color-border:     rgba(59, 29, 10, 0.14);
  --color-focus-ring: #F59E0B;

  /* Tipografía */
  --font-display: 'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif;
  --font-body:    'Inter', system-ui, -apple-system, sans-serif;

  /* Espaciado y radios */
  --space-section: clamp(4rem, 7vw, 6.5rem);
  --container-max: 1240px;
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 9999px;

  /* Sombras */
  --shadow-card: 0 10px 30px -10px rgba(59, 29, 10, 0.10);
  --shadow-card-hover: 0 18px 40px -12px rgba(59, 29, 10, 0.18);
}
```

## 2. Tipografía

- **Display / Títulos:** `Plus Jakarta Sans` (pesos 700, 800), `line-height: 1.08`, `letter-spacing: -0.025em`.
- **Cuerpo / UI:** `Inter` (pesos 400, 500, 600), `line-height: 1.6`.
- **Escala fluida:**
  - `h1`: `clamp(2.35rem, 4.6vw, 4rem)`
  - `h2`: `clamp(1.85rem, 3.2vw, 2.75rem)`
  - `h3`: `clamp(1.2rem, 1.8vw, 1.5rem)`
  - `body`: `1rem` (`16px` mínimo)

## 3. Componentes clave y reglas

- **Navbar:** sticky con fondo crema translúcido (`backdrop-filter: blur(12px)`), logo `WAKANDAPROJECT_RGB-01.png`, 5 enlaces en sentence case (`Inicio`, `Nosotros`, `Metodología`, `Talleres`, `Galería`), CTA `Únete hoy` y menú hamburguesa SVG en móvil.
- **Hero geométrico:** fondo con textura sutil de `fondos -01.png` en baja opacidad sobre crema/naranja, 2 columnas en desktop: izquierda con badge + titular + descripción oficial de `INSTAPORTFOLIOWK-01.png` + 2 botones (`Conoce el proyecto`, `Inscribirse`), derecha con collage geométrico asimétrico de fotos reales (`Wakanda pics/`).
- **Diagrama circular de pilares + Misión y Visión:** diagrama radial SVG/CSS con 6 nodos conectados alrededor del centro (`Expresión`, `Disciplina`, `Trabajo en equipo`, `Identidad`, `Confianza`, `Comunidad`) + texto oficial de Misión y Visión (`INSTAPORTFOLIOWK-02.png`).
- **Valores fundamentales (3 tarjetas):** `Identidad cultural`, `Disciplina artística`, `Comunidad segura` con iconos SVG inline.
- **Proceso / Metodología (01–04):** bloque oscuro (`#1A0D04`) con 4 tarjetas verticales numeradas `01` a `04` usando `Wakanda pics/1.jpg` a `4.jpg` con filtro duotono naranja/tierra y texto blanco superpuesto.
- **Talleres y actividades (4 tarjetas):** ritmos afro, ritmos urbanos, expresión corporal y liderazgo juvenil.
- **Galería en acción:** mosaico asimétrico de fotografías reales (`Wakanda pics/5.jpg` a `14.jpg`) con `object-fit: cover` y `object-position: top` para no cortar rostros.
- **Testimonios estilo sobre:** 3 tarjetas con recorte poligonal superior tipo sobre, retrato circular y citas en sentence case.
- **Contacto e inscripción:** formulario de 2 columnas sobre fondo marrón tierra oscuro con textura `fondos -02.png` sutil, validación accesible y estado de confirmación.
- **Footer:** logo blanco `WAKANDAPROJECT_RGB-02.png`, mapa de sitio, contacto y redes sociales SVG.

## 4. Responsive y microinteracciones

- Viewports obligatorios: `1440×900`, `768×1024`, `390×844` sin overflow horizontal.
- Transiciones `150–250ms cubic-bezier(0.22, 1, 0.36, 1)` solo en `transform` y `opacity`, respetando `prefers-reduced-motion: reduce`.
- Cero emojis en UI; 100% iconos SVG inline.
