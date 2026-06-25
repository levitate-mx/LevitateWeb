export const navLinks = [
  { label: "Inicio", href: "/#inicio" },
  { label: "Galería", href: "/#galeria" },
];

export const assets = {
  hero: "/assets/visuals/hero-stage.jpg",
  competition: "/assets/visuals/experience-competition.jpg",
  workshops: "/assets/visuals/experience-workshops.jpg",
  community: "/assets/visuals/gallery-community.jpg",
  communityAerial: "/assets/visuals/community-aerial-hoop.jpg",
  communityAquaSilks: "/assets/visuals/community-aqua-silks.jpg",
  communityBlueSilks: "/assets/visuals/community-blue-silks.jpg",
  communityDuoSilks: "/assets/visuals/community-duo-silks.jpg",
  communityFolkStage: "/assets/visuals/community-folk-stage.jpg",
  communityFloorSpotlight: "/assets/visuals/community-floor-spotlight.jpg",
  communityKidsStage: "/assets/visuals/community-kids-stage.jpg",
  communityLyraSmoke: "/assets/visuals/community-lyra-smoke.jpg",
  communityRedHoop: "/assets/visuals/community-red-hoop.jpg",
  communityRedSilks: "/assets/visuals/community-red-silks.jpg",
  venue: "/assets/visuals/venue-stage.jpg",
};

export const megaMenuItems = [
  {
    label: "Competencia",
    href: "/#eventos",
    image: assets.competition,
    description: "Escenarios de alto nivel, bloques claros y medallero por categoría.",
  },
  {
    label: "Workshops",
    href: "/#convocatoria",
    image: assets.workshops,
    description: "Entrenamiento con artistas invitados y herramientas para crecer.",
  },
  {
    label: "Sedes",
    href: "/#eventos",
    image: assets.venue,
    description: "Próximas ciudades, fechas y experiencia completa por evento.",
  },
  {
    label: "Galería",
    href: "/#galeria",
    image: assets.community,
    description: "Momentos editoriales de comunidad, escenario y formación.",
  },
  {
    label: "Convocatoria",
    href: "/#convocatoria",
    image: assets.hero,
    description: "Inscripción y próximos pasos para academias y participantes.",
  },
];

export const experiences = [
  {
    title: "Competencia",
    description: "Escenarios de alto nivel para participantes que buscan superarse.",
    image: assets.competition,
    href: "#eventos",
    alt: "Bailarina en salto sobre un escenario oscuro de competencia.",
  },
  {
    title: "Workshops",
    description: "Entrenamiento con artistas invitados y herramientas para crecer.",
    image: assets.workshops,
    href: "#eventos",
    alt: "Clase de danza en estudio con instructor y grupo de participantes.",
  },
  {
    title: "Exhibiciones / Sedes",
    description: "Producciones que elevan cada presentación y llevan Levitate a nuevas ciudades.",
    image: assets.venue,
    href: "#eventos",
    alt: "Venue de danza preparado con iluminacion escenica.",
  },
  {
    title: "Comunidad",
    description: "Academias, familias y participantes conectando desde una misma pasión.",
    image: assets.community,
    href: "#galeria",
    alt: "Participantes y equipo compartiendo un momento backstage.",
  },
];

export const events = [
  {
    slug: "estado-de-mexico",
    date: "13 NOV",
    name: "Levitate MX",
    venue: "Teatro El Gran Recinto",
    location: "Tlalnepantla, Edo. Méx.",
    image: assets.venue,
  },
  {
    slug: "puebla",
    date: "07 JUN",
    name: "Levitate MX",
    venue: "Auditorio Daniel Forcelledo",
    location: "Puebla",
    image: assets.competition,
  },
  {
    slug: "ciudad-de-mexico",
    date: "04 OCT",
    name: "Levitate MX",
    venue: "Ciudad de México",
    location: "Ciudad de México",
    image: assets.community,
  },
];

export const whyPillars = [
  {
    title: "Plataforma de alto nivel",
    description: "Escenarios profesionales y experiencias memorables.",
  },
  {
    title: "Crecimiento real",
    description: "Formación, feedback y oportunidades para impulsar tu camino.",
  },
  {
    title: "Comunidad que eleva",
    description: "Conexiones que inspiran y acompañan tu evolución.",
  },
];

export const galleryImages = [
  {
    image: assets.community,
    alt: "Momento editorial backstage de comunidad Levitate.",
    caption: "Comunidad",
    className: "gallery-card--large",
  },
  {
    image: assets.workshops,
    alt: "Workshop de danza en estudio oscuro.",
    caption: "Formación",
    className: "gallery-card--small",
  },
  {
    image: assets.competition,
    alt: "Bailarina en competencia sobre escenario.",
    caption: "Escenario",
    className: "gallery-card--small gallery-card--offset",
  },
];
