export type PassportStation = {
  slug: string;
  order: number;
  title: string;
  shortTitle: string;
  description: string;
  stampLabel: string;
  highlights: string[];
};

export type PassportEvent = {
  slug: string;
  title: string;
  city: string;
  date: string;
  passportName: string;
  claimPath: string;
  stations: PassportStation[];
};

export const passportPilotEvent: PassportEvent = {
  slug: "levitate-cdmx-2026",
  title: "Levitate CDMX 2026",
  city: "Ciudad de México",
  date: "Piloto Pasaporte Colibrí",
  passportName: "Pasaporte Colibrí",
  claimPath: "/passport/claim?token=demo-colibri",
  stations: [
    {
      slug: "bienvenida",
      order: 1,
      title: "Bienvenida",
      shortTitle: "Bienvenida",
      description: "Horario, mapa del venue y reglas rápidas para empezar el recorrido con claridad.",
      stampLabel: "Primer aleteo",
      highlights: ["Mapa del evento", "Horarios clave", "Reglas rápidas"],
    },
    {
      slug: "backstage",
      order: 2,
      title: "Backstage",
      shortTitle: "Backstage",
      description: "Checklist de salida a escenario para que cada participante llegue lista y en calma.",
      stampLabel: "Listo para escena",
      highlights: ["Vestuario", "Música", "Orden de salida"],
    },
    {
      slug: "photo-spot",
      order: 3,
      title: "Photo Spot",
      shortTitle: "Photo Spot",
      description: "Acceso a galería, compra de fotos y reel del evento desde una estación visual.",
      stampLabel: "Momento capturado",
      highlights: ["Galería", "Paquetes foto/video", "Reel del evento"],
    },
    {
      slug: "sponsor-zone",
      order: 4,
      title: "Sponsor Zone",
      shortTitle: "Sponsors",
      description: "Cupones, beneficios y experiencias de marcas aliadas para asistentes y academias.",
      stampLabel: "Beneficio desbloqueado",
      highlights: ["Cupones", "Beneficios", "Aliados"],
    },
    {
      slug: "feedback",
      order: 5,
      title: "Feedback",
      shortTitle: "Feedback",
      description: "Encuesta breve post-presentación para cerrar el vuelo con aprendizaje y escucha.",
      stampLabel: "Vuelo completo",
      highlights: ["Encuesta rápida", "Comentarios", "Certificado"],
    },
  ],
};

export const passportEvents = [passportPilotEvent];

export function getPassportEventBySlug(slug: string) {
  return passportEvents.find((event) => event.slug === slug);
}

export function getPassportStationBySlug(eventSlug: string, stationSlug: string) {
  const event = getPassportEventBySlug(eventSlug);
  const station = event?.stations.find((item) => item.slug === stationSlug);
  return event && station ? { event, station } : null;
}

export function getPassportStationPath(eventSlug: string, stationSlug: string) {
  return `/e/${eventSlug}/station/${stationSlug}`;
}
