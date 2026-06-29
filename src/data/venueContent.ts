import { assets } from "./homeContent";

export type VenuePageData = {
  slug: string;
  title: string;
  city: string;
  dateLong: string;
  venue: string;
  location: string;
  season: string;
  heroImage: string;
  intro: string;
  capacity: string;
  modality: string;
  status: string;
  generalInfo: Array<{
    label: string;
    value: string;
    description: string;
  }>;
  blocks: Array<{
    label: string;
    time: string;
    description: string;
  }>;
  genreGroups: Array<{
    title: string;
    description: string;
    items: string[];
  }>;
  registration: Array<{
    label: string;
    value: string;
  }>;
  categories: string[];
  ageDivisions: Array<{
    name: string;
    ages: string;
    music: string;
  }>;
  awards: Array<{
    title: string;
    description: string;
  }>;
  judges: Array<{
    name: string;
    specialty: string;
    bio: string;
  }>;
  tickets: Array<{
    label: string;
    value: string;
  }>;
  contact: Array<{
    label: string;
    value: string;
  }>;
};

const sharedGenres = [
  {
    title: "Aerial",
    description: "Formatos aéreos con técnica, presencia y control escénico.",
    items: ["Tela", "Aro", "Trapecio", "Cuerda", "Cintas", "Cadenas", "Espiral", "Luna", "Pole"],
  },
  {
    title: "Motion",
    description: "Disciplinas de piso evaluadas por ejecución, musicalidad y propuesta.",
    items: ["Jazz", "Hip Hop", "Contemporáneo", "Lyrical", "Ballet", "Folklore", "Reggaetón", "Open", "Acro"],
  },
];

const sharedAges = [
  { name: "Baby", ages: "4 a 6 años", music: "2:00 - 2:30 min" },
  { name: "Petite", ages: "7 a 9 años", music: "2:00 - 3:00 min" },
  { name: "Junior", ages: "10 a 12 años", music: "2:30 - 3:30 min" },
  { name: "Teen", ages: "13 a 15 años", music: "2:30 - 3:30 min" },
  { name: "Senior", ages: "16 años en adelante", music: "2:30 - 3:30 min" },
  { name: "Legacy", ages: "40 años en adelante", music: "2:30 - 3:30 min" },
];

const sharedAwards = [
  {
    title: "Medallero por puntaje + ranking",
    description: "Medallas según puntaje obtenido y lugares por ranking cuando existe competencia directa.",
  },
  {
    title: "Premios especiales",
    description: "Reconocimientos a interpretación, técnica, presencia escénica y propuesta creativa.",
  },
  {
    title: "Reconocimiento Levitate",
    description: "Distinción para participantes con evolución artística, disciplina y proyección.",
  },
];

const sharedJudges = [
  {
    name: "Camila Rivas",
    specialty: "Técnica contemporánea",
    bio: "Coreógrafa invitada enfocada en limpieza técnica, musicalidad y construcción escénica.",
  },
  {
    name: "Mateo Luján",
    specialty: "Aerial performance",
    bio: "Director aéreo con experiencia en evaluación de control, seguridad y presencia en altura.",
  },
  {
    name: "Renata Sol",
    specialty: "Jazz · Commercial",
    bio: "Coach escénica especializada en energía, proyección y lectura de grupo.",
  },
];

export const venuePages: VenuePageData[] = [
  {
    slug: "silo-dallas",
    title: "Silo Dallas",
    city: "Dallas",
    dateLong: "21 de junio de 2026",
    venue: "Silo Dallas",
    location: "Dallas, TX, USA",
    season: "Temporada Otoño 2026",
    heroImage: assets.venue,
    intro:
      "Una sede internacional con formato de competencia, exhibición y formación para academias que buscan vivir Levitate desde una producción de alto nivel.",
    capacity: "Cupo limitado",
    modality: "Aerial + Motion",
    status: "Inscripciones abiertas",
    generalInfo: [
      {
        label: "Fecha",
        value: "21 de junio de 2026",
        description: "Jornada completa con bloques de mañana, tarde y cierre escénico.",
      },
      {
        label: "Estatus",
        value: "Inscripciones abiertas",
        description: "Registro activo para academias y participantes hasta completar el cupo de sede.",
      },
    ],
    blocks: [
      {
        label: "Check-in técnico",
        time: "09:00 - 12:30",
        description: "Registro de academias, revisión de música, calentamiento y llamado para Aerial inicial.",
      },
      {
        label: "Competencia",
        time: "13:30 - 17:00",
        description: "Rondas Motion y Aerial por categoría, división y formato de participación.",
      },
      {
        label: "Cierre escénico",
        time: "18:00 - 21:00",
        description: "Exhibiciones invitadas, reconocimientos especiales, premiación y fotografía de sede.",
      },
    ],
    genreGroups: sharedGenres,
    registration: [
      { label: "Solo", value: "$120 USD" },
      { label: "Dúo / Trío", value: "$95 USD p/p" },
      { label: "Grupo", value: "$65 USD p/p" },
      { label: "Workshop", value: "$45 USD" },
    ],
    categories: ["Solista", "Dúo", "Trío", "Grupo", "Academia", "Exhibición", "Open"],
    ageDivisions: sharedAges,
    awards: sharedAwards,
    judges: sharedJudges,
    tickets: [
      { label: "Preventa", value: "$35 USD" },
      { label: "General", value: "$45 USD" },
      { label: "VIP Pass", value: "$80 USD" },
    ],
    contact: [
      { label: "Correo", value: "dallas@levitatemx.com" },
      { label: "WhatsApp", value: "+1 (214) 000 2026" },
      { label: "Instagram", value: "@levitatemx" },
    ],
  },
  {
    slug: "monterrey",
    title: "Monterrey",
    city: "Monterrey",
    dateLong: "16 de agosto de 2026",
    venue: "Auditorio Levitate Norte",
    location: "Monterrey, NL",
    season: "Temporada Otoño 2026",
    heroImage: assets.competition,
    intro:
      "La sede norte reúne competencia, workshops y bloques escénicos pensados para academias con participantes de todos los niveles.",
    capacity: "Cupo medio",
    modality: "Motion + Aerial",
    status: "Pre-registro activo",
    generalInfo: [
      {
        label: "Fecha",
        value: "16 de agosto de 2026",
        description: "Competencia por bloques con espacios de formación y cierre de comunidad.",
      },
      {
        label: "Estatus",
        value: "Pre-registro activo",
        description: "Reserva temprana para academias antes de abrir la convocatoria general.",
      },
    ],
    blocks: [
      {
        label: "Apertura",
        time: "08:30 - 12:00",
        description: "Registro, calentamiento y primeras categorías baby, petite y junior.",
      },
      {
        label: "Competencia central",
        time: "13:00 - 16:30",
        description: "Teen, senior, grupos de academia y evaluación por panel de jueces.",
      },
      {
        label: "Premiación",
        time: "17:30 - 20:30",
        description: "Showcase aéreo, medallero por puntaje, ranking por bloque y reconocimientos especiales.",
      },
    ],
    genreGroups: sharedGenres,
    registration: [
      { label: "Solo", value: "$1,350 MXN" },
      { label: "Dúo / Trío", value: "$1,050 MXN p/p" },
      { label: "Grupo", value: "$780 MXN p/p" },
      { label: "Workshop", value: "$650 MXN" },
    ],
    categories: ["Solista", "Dúo", "Trío", "Grupo", "Producción", "Exhibición", "Open"],
    ageDivisions: sharedAges,
    awards: sharedAwards,
    judges: sharedJudges,
    tickets: [
      { label: "Preventa", value: "$250 MXN" },
      { label: "General", value: "$350 MXN" },
      { label: "Full day pass", value: "$650 MXN" },
    ],
    contact: [
      { label: "Correo", value: "monterrey@levitatemx.com" },
      { label: "WhatsApp", value: "+52 81 0000 2026" },
      { label: "Instagram", value: "@levitatemx" },
    ],
  },
  {
    slug: "ciudad-de-mexico",
    title: "Ciudad de México",
    city: "CDMX",
    dateLong: "04 de octubre de 2026",
    venue: "Foro Levitate Central",
    location: "Ciudad de México",
    season: "Temporada Otoño 2026",
    heroImage: assets.community,
    intro:
      "Una edición de cierre con bloques de competencia, premiación, boletos por experiencia y una jornada diseñada para participantes, familias y academias.",
    capacity: "Alta demanda",
    modality: "Competencia + Showcase",
    status: "Convocatoria próxima",
    generalInfo: [
      {
        label: "Fecha",
        value: "04 de octubre de 2026",
        description: "Edición de cierre con competencia, exhibiciones y premiación general.",
      },
      {
        label: "Estatus",
        value: "Convocatoria próxima",
        description: "Publicaremos apertura de inscripciones, costos finales y cupos disponibles.",
      },
    ],
    blocks: [
      {
        label: "Registro y apertura",
        time: "09:00 - 12:00",
        description: "Check-in general, revisión de música y primeras rondas Motion.",
      },
      {
        label: "Rondas principales",
        time: "13:00 - 17:00",
        description: "Aerial, grupos y producciones con evaluación técnica, artística y escénica.",
      },
      {
        label: "Final de sede",
        time: "18:00 - 21:30",
        description: "Premios especiales, medallero por puntaje, ranking por bloque y showcase de cierre.",
      },
    ],
    genreGroups: sharedGenres,
    registration: [
      { label: "Solo", value: "$1,500 MXN" },
      { label: "Dúo / Trío", value: "$1,150 MXN p/p" },
      { label: "Grupo", value: "$850 MXN p/p" },
      { label: "Workshop", value: "$700 MXN" },
    ],
    categories: ["Solista", "Dúo", "Trío", "Grupo", "Academia", "Showcase", "Open"],
    ageDivisions: sharedAges,
    awards: sharedAwards,
    judges: sharedJudges,
    tickets: [
      { label: "Preventa", value: "$300 MXN" },
      { label: "General", value: "$450 MXN" },
      { label: "Experience pass", value: "$750 MXN" },
    ],
    contact: [
      { label: "Correo", value: "cdmx@levitatemx.com" },
      { label: "WhatsApp", value: "+52 55 0000 2026" },
      { label: "Instagram", value: "@levitatemx" },
    ],
  },
];

export function getVenueBySlug(slug: string) {
  return venuePages.find((venue) => venue.slug === slug);
}
