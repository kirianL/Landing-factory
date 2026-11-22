# Plan de Implementación — Wakanda Project (`docs/design/implementation-plan.md`)

> **Generado por:** `implementation-planner` (solo lectura)
> **Stack:** Vite + React 18 + TypeScript + CSS con tokens (`tokens.css` + `global.css`)

## 1. Estructura de archivos

```text
projects/WakandaProject/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── index.html
├── public/
│   ├── favicon.svg
│   └── images/
│       ├── logo/
│       │   ├── wakanda-logo-dark.png    (← assets/WAKANDAPROJECT_RGB-01.png)
│       │   └── wakanda-logo-light.png   (← assets/WAKANDAPROJECT_RGB-02.png)
│       ├── textures/
│       │   ├── texture-warm-01.png      (← assets/fondos -01.png)
│       │   └── texture-earth-02.png     (← assets/fondos -02.png)
│       └── gallery/
│           └── 01.jpg … 14.jpg          (← assets/Wakanda pics/1.jpg … 14.jpg)
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── content.ts
    ├── styles/
    │   ├── tokens.css
    │   └── global.css
    └── components/
        ├── Icons.tsx
        ├── Navbar.tsx
        ├── Hero.tsx
        ├── PillarsSection.tsx
        ├── ValuesSection.tsx
        ├── ProcessSection.tsx
        ├── WorkshopsSection.tsx
        ├── GallerySection.tsx
        ├── TestimonialsSection.tsx
        ├── ContactSection.tsx
        └── Footer.tsx
```

## 2. Secciones y reglas editoriales

- **Sentence case obligatorio** en todos los títulos, subtítulos, botones, etiquetas, menús y listas (solo mayúscula inicial en la primera palabra, salvo nombres propios reales como `Wakanda Project`).
- **Cero emojis** en UI; **100% iconos SVG inline** en `Icons.tsx`.
- **Copy oficial recuperado**:
  - Descripción: *"Es un proyecto de danza enfocado en el desarrollo artístico, cultural y personal de niños y niñas, utilizando ritmos afro y urbanos como medio de expresión, disciplina y trabajo en equipo. Buscamos crear un espacio seguro donde la danza sea una herramienta de identidad, confianza y comunidad."*
  - Misión: *"Enseñar danza de manera creativa y formativa, potenciando la disciplina, el liderazgo y la expresión corporal en la niñez."*
  - Visión: *"Formar una comunidad infantil que crezca con valores, identidad cultural y amor por la danza."*
  - Cita: *"Un niño inculcado en su cultura, nunca olvidará sus raíces."*

## 3. Criterios de aceptación

- `npm run typecheck` y `npm run build` sin errores.
- Playwright en `1440×900`, `768×1024`, `390×844` sin overflow horizontal ni errores de consola/red.
- Revisión visual (`visual-qa`) y auditoría técnica (`code-reviewer`) + `quality-gate.mjs` en estado `READY`.
