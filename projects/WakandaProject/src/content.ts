export const SITE_CONTENT = {
  brand: {
    name: 'Wakanda Project',
    tagline: 'Danza, cultura y comunidad infantil',
    // [observed] Texto oficial recuperado de assets/INSTAPORTFOLIOWK-01.png
    officialDescription:
      'Es un proyecto de danza enfocado en el desarrollo artístico, cultural y personal de niños y niñas, utilizando ritmos afro y urbanos como medio de expresión, disciplina y trabajo en equipo. Buscamos crear un espacio seguro donde la danza sea una herramienta de identidad, confianza y comunidad.',
    // [observed] Misión y Visión recuperadas de assets/INSTAPORTFOLIOWK-02.png
    missionTitle: 'Misión',
    missionText:
      'Enseñar danza de manera creativa y formativa, potenciando la disciplina, el liderazgo y la expresión corporal en la niñez.',
    visionTitle: 'Visión',
    visionText:
      'Formar una comunidad infantil que crezca con valores, identidad cultural y amor por la danza.',
    // [observed] Cita recuperada de assets/INSTAPORTFOLIOWK-08.png
    quoteText: '«Un niño inculcado en su cultura, nunca olvidará sus raíces.»',
    quoteAuthor: 'Wakanda Project',
  },
  nav: {
    links: [
      { label: 'Inicio', href: '#inicio' },
      { label: 'Nosotros', href: '#nosotros' },
      { label: 'Metodología', href: '#metodologia' },
      { label: 'Talleres', href: '#talleres' },
      { label: 'Galería', href: '#galeria' },
    ],
    ctaLabel: 'Únete hoy',
    ctaHref: '#contacto',
  },
  hero: {
    eyebrow: 'Proyecto cultural y artístico juvenil',
    titleLead: 'Donde la danza fortalece la ',
    titleHighlight: 'identidad y la comunidad',
    primaryCta: 'Inscribirse al proyecto',
    secondaryCta: 'Conoce nuestra historia',
    badgeTitle: 'Ritmos afro y urbanos',
    badgeText: 'Espacio seguro para niños, niñas y jóvenes',
    metrics: [
      { value: '100%', label: 'Enfoque formativo y cultural' },
      { value: 'Afro + urbano', label: 'Expresión corporal y técnica' },
      { value: 'Comunidad', label: 'Disciplina y trabajo en equipo' },
    ],
  },
  pillars: {
    eyebrow: 'Quiénes somos',
    title: 'Seis pilares que guían cada ensayo',
    centerLabel: 'Wakanda Project',
    nodes: [
      { id: 'expresion', label: 'Expresión' },
      { id: 'disciplina', label: 'Disciplina' },
      { id: 'equipo', label: 'Trabajo en equipo' },
      { id: 'identidad', label: 'Identidad' },
      { id: 'confianza', label: 'Confianza' },
      { id: 'comunidad', label: 'Comunidad' },
    ],
  },
  values: {
    eyebrow: 'Nuestros valores',
    title: 'Formación integral dentro y fuera del escenario',
    lead: 'Cada coreografía nace de un proceso que cuida la autoestima, el respeto mutuo y el orgullo por nuestras raíces.',
    items: [
      {
        id: 'identidad',
        variant: 'brown' as const,
        title: 'Identidad cultural',
        description:
          'Celebramos el legado afrodescendiente mediante música, vestuario tradicional y memoria colectiva en cada presentación.',
      },
      {
        id: 'disciplina',
        variant: 'orange' as const,
        title: 'Disciplina artística',
        description:
          'Fomentamos la constancia, la coordinación y el compromiso personal para que cada estudiante alcance su máximo potencial.',
      },
      {
        id: 'comunidad',
        variant: 'light' as const,
        title: 'Comunidad segura',
        description:
          'Construimos un entorno de acompañamiento respetuoso donde las familias, docentes y jóvenes crecen juntos.',
      },
    ],
  },
  process: {
    eyebrow: 'Nuestra metodología',
    title: 'Cuatro etapas del proceso formativo',
    lead: 'Un recorrido progresivo diseñado para acompañar a niños, niñas y jóvenes desde sus primeros pasos hasta el escenario.',
    steps: [
      {
        number: '01',
        title: 'Descubrir',
        description:
          'Acercamiento lúdico al ritmo, la escucha musical y el reconocimiento de las raíces afro y urbanas.',
        image: '/images/gallery/01.jpg',
        alt: 'Niña participante de Wakanda Project con vestuario tradicional colorido',
      },
      {
        number: '02',
        title: 'Practicar',
        description:
          'Desarrollo de técnica corporal, coordinación, postura y trabajo en equipo en ensayos guiados.',
        image: '/images/gallery/02.jpg',
        alt: 'Joven bailarina sonriente con atuendo tradicional en evento cultural',
      },
      {
        number: '03',
        title: 'Crear',
        description:
          'Montaje de coreografías colectivas donde cada integrante aporta su voz, energía y liderazgo.',
        image: '/images/gallery/03.jpg',
        alt: 'Participante infantil de Wakanda Project lista para desfile cultural',
      },
      {
        number: '04',
        title: 'Compartir',
        description:
          'Presentaciones comunitarias, festivales y encuentros que fortalecen la confianza frente al público.',
        image: '/images/gallery/04.jpg',
        alt: 'Presentación artística infantil de Wakanda Project',
      },
    ],
  },
  workshops: {
    eyebrow: 'Talleres y actividades',
    title: 'Espacios para aprender en movimiento',
    lead: 'Programas diseñados por edades e intereses para impulsar el talento artístico en un ambiente cercano.',
    items: [
      {
        tag: 'Raíces',
        title: 'Danza afrodescendiente',
        description:
          'Exploración de movimientos tradicionales, percusión corporal e historia cultural en cada clase.',
        image: '/images/gallery/06.jpg',
        alt: 'Jóvenes bailando coreografía afro en escenario',
      },
      {
        tag: 'Fusión',
        title: 'Ritmos urbanos',
        description:
          'Dinámicas modernas de coordinación, musicalidad y estilo libre adaptadas a niñez y juventud.',
        image: '/images/gallery/07.jpg',
        alt: 'Grupo de danza ejecutando salto coreográfico en escenario',
      },
      {
        tag: 'Formación',
        title: 'Expresión y liderazgo',
        description:
          'Ejercicios de confianza escénica, comunicación y trabajo colaborativo entre pares.',
        image: '/images/gallery/05.jpg',
        alt: 'Integrante de Wakanda Project en sesión artística',
      },
      {
        tag: 'Comunidad',
        title: 'Festivales y comparsas',
        description:
          'Participación en desfiles cívicos, celebraciones culturales y presentaciones abiertas al público.',
        image: '/images/gallery/08.jpg',
        alt: 'Niñas participantes en actividad comunitaria de danza',
      },
    ],
  },
  gallery: {
    eyebrow: 'Galería en acción',
    title: 'Momentos que reflejan nuestra energía',
    lead: 'Retratos y escenas reales de ensayos, desfiles y presentaciones de Wakanda Project.',
    items: [
      { src: '/images/gallery/09.jpg', alt: 'Presentación cultural de Wakanda Project', tall: true },
      { src: '/images/gallery/10.jpg', alt: 'Coreografía grupal de jóvenes bailarines', tall: false },
      { src: '/images/gallery/11.jpg', alt: 'Vestuario tradicional en celebración cultural', tall: false },
      { src: '/images/gallery/12.jpg', alt: 'Ensayo de expresión corporal', tall: false },
      { src: '/images/gallery/13.jpg', alt: 'Encuentro artístico comunitario', tall: false },
      { src: '/images/gallery/14.jpg', alt: 'Cierre de presentación de Wakanda Project', tall: false },
    ],
  },
  testimonials: {
    eyebrow: 'Voces de la comunidad',
    title: 'Historias que nacen en cada ensayo',
    lead: 'Familias y participantes comparten cómo la danza ha fortalecido su confianza y sentido de pertenencia.',
    items: [
      {
        name: 'Camila',
        role: 'Participante juvenil',
        quote:
          '«Aquí aprendí a bailar sin miedo y a sentirme orgullosa de mi historia junto a mis compañeras.»',
        image: '/images/gallery/02.jpg',
      },
      {
        name: 'Valeria',
        role: 'Madre de familia',
        quote:
          '«Wakanda Project es un espacio seguro donde mi hija ha desarrollado disciplina, alegría y grandes amistades.»',
        image: '/images/gallery/01.jpg',
      },
      {
        name: 'Mateo',
        role: 'Estudiante de taller',
        quote:
          '«Cada ensayo nos enseña a apoyarnos como equipo y a disfrutar cada paso sobre el escenario.»',
        image: '/images/gallery/06.jpg',
      },
    ],
  },
  contact: {
    eyebrow: 'Contacto e inscripción',
    title: '¿Quieres ser parte de Wakanda Project?',
    lead: 'Escríbenos para conocer horarios de ensayos, cupos para niños y niñas o alianzas culturales.',
    details: [
      'Clases formativas para niñez y juventud',
      'Ritmos afro, urbanos y expresión corporal',
      'Atención directa a familias y aliados culturales',
    ],
    form: {
      nameLabel: 'Nombre completo',
      namePlaceholder: 'Ingresa tu nombre',
      emailLabel: 'Correo electrónico',
      emailPlaceholder: 'correo@ejemplo.com',
      topicLabel: 'Interés principal',
      topics: ['Inscripción a talleres', 'Alianza cultural', 'Presentaciones y eventos'],
      messageLabel: 'Mensaje',
      messagePlaceholder: 'Cuéntanos en qué podemos ayudarte',
      submitLabel: 'Enviar mensaje',
      successMessage: 'Gracias por escribirnos. Nos pondremos en contacto muy pronto.',
    },
  },
  footer: {
    description:
      'Proyecto de danza infantil y juvenil enfocado en la identidad cultural, la disciplina y la comunidad.',
    copyright: '© 2026 Wakanda Project. Todos los derechos reservados.',
  },
};
