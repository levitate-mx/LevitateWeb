// Static demonstration data only. This module never reads registrations,
// publishes a ballot, records a vote, or connects to external services.
const candidates = Object.freeze([
  ...[1, 2, 3].map((number) => Object.freeze({
    id: `preview-motion-${number}`,
    division: "motion",
    teacherName: `Maestro de ejemplo Motion ${number}`,
    academyName: `Academia de ejemplo Motion ${number}`,
    choreographyTitle: `Coreografía de ejemplo Motion ${number}`,
    entryNumber: number,
  })),
  ...[1, 2, 3].map((number) => Object.freeze({
    id: `preview-aerial-${number}`,
    division: "aerial",
    teacherName: `Maestro de ejemplo Aerial ${number}`,
    academyName: `Academia de ejemplo Aerial ${number}`,
    choreographyTitle: `Coreografía de ejemplo Aerial ${number}`,
    entryNumber: number + 3,
  })),
]);

const preview = Object.freeze({
  mode: "preview",
  publicVotingEnabled: false,
  title: "Relevé · El público elige",
  description: "Vista previa para administración con candidatos de ejemplo. Esta prueba no está publicada y no recibe votos reales.",
  candidates,
});

export function getReleveVotingPreview() {
  return Object.freeze({ ...preview, fetchedAt: new Date().toISOString() });
}
