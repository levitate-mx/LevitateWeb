import type { ParticipantPortalData, ParticipantRoutine } from "./participantTypes";

const pending: ParticipantRoutine["result"] = {
  status: "pending",
  score: null,
  maxScore: null,
  medal: null,
  directCompetition: false,
  eligibleCount: 0,
  place: null,
};

const archivalPhotos = [
  { url: "/assets/media-shop-aerial-yellow-silks.jpg", caption: "Imagen de archivo de Levitate MX · Vista de ejemplo. No corresponde a esta participante." },
  { url: "/assets/participant-demo-photo-blurred.jpg", caption: "Imagen de archivo de Levitate MX · Ejemplo de vista previa desenfocada. No corresponde a esta participante." },
].map((photo, index) => ({
  id: `archivo-${index}`,
  previewUrl: photo.url,
  width: 800,
  height: 1000,
  caption: photo.caption,
}));

export const previewParticipantData: ParticipantPortalData = {
  participant: { id: "ejemplo", name: "Mariana López Torres", academy: "Academia de ejemplo" },
  events: [
    {
      id: "otono-2026",
      title: "Levitate MX",
      season: "Otoño 2026",
      venue: "Gran Recinto · Tlalnepantla, Estado de México",
      startsAt: "2026-11-14",
    },
  ],
  selectedEventId: "otono-2026",
  diploma: { status: "available", assetId: null, url: "/assets/participant-demo-diploma.pdf" },
  routines: [
    {
      id: "vuelo",
      title: "El instante de volar",
      genre: "Aerial",
      subgenre: "Aro",
      category: "Solo",
      division: "Juvenil",
      level: "Intermedio",
      eventId: "otono-2026",
      result: {
        status: "published",
        score: 142.5,
        maxScore: 150,
        medal: "oro",
        directCompetition: true,
        eligibleCount: 4,
        place: 1,
      },
      judging: {
        status: "available",
        judges: [142, 143, 142.5].map((score, index) => ({
          name: `Jurado de ejemplo ${index + 1}`,
          score,
          maxScore: 150,
          criteria: [
            { label: "Técnica", score: 48, maxScore: 50 },
            { label: "Interpretación", score: 47, maxScore: 50 },
            { label: "Composición", score: score - 95, maxScore: 50 },
          ],
          feedback:
            "Comentario ilustrativo para mostrar la lectura de la hoja de jueceo. Los resultados reales aparecerán después de su publicación.",
        })),
      },
      photos: { status: "available", items: archivalPhotos, count: archivalPhotos.length },
    },
    {
      id: "raiz",
      title: "De raíz",
      genre: "Aerial",
      subgenre: "Telas",
      category: "Solo",
      division: "Juvenil",
      level: "Intermedio",
      eventId: "otono-2026",
      result: {
        status: "published",
        score: 131.25,
        maxScore: 150,
        medal: "plata",
        directCompetition: false,
        eligibleCount: 1,
        place: null,
      },
      judging: { status: "pending", judges: [] },
      photos: { status: "pending", items: [], count: 0 },
    },
    {
      id: "eco",
      title: "Lo que queda en el aire",
      genre: "Motion",
      subgenre: "Contemporáneo",
      category: "Dúo",
      division: "Juvenil",
      level: "Intermedio",
      eventId: "otono-2026",
      result: pending,
      judging: { status: "pending", judges: [] },
      photos: { status: "pending", items: [], count: 0 },
    },
  ],
};
