type WorkshopClass = {
  title: string;
  coach: string;
};

type WorkshopSlot = {
  start: string;
  end: string;
} & (
  | { shared: WorkshopClass; classes?: never }
  | { shared?: never; classes: [WorkshopClass, WorkshopClass] }
);

type WorkshopTrack = {
  id: string;
  title: string;
  venue: string;
  groups: [{ label: string; ages: string }, { label: string; ages: string }];
  slots: WorkshopSlot[];
};

const flex = { title: "Flex", coach: "Ana Karen Rojas" };
const jazz = { title: "Contemporary Jazz", coach: "Daniel Montalvo" };
const musical = { title: "Comedia musical", coach: "Jorge Díaz de León" };

export const edoMexWorkshops: {
  date: string;
  dateLabel: string;
  footnote: string;
  tracks: WorkshopTrack[];
} = {
  date: "2026-11-13",
  dateLabel: "Viernes 13 de noviembre de 2026",
  footnote: "La inscripción incluye acceso a 3 workshops de la elección del participante.",
  tracks: [
    {
      id: "aerial",
      title: "Aerial",
      venue: "Centro Cultural Futurama",
      groups: [
        { label: "Grupo A", ages: "Hasta 12 años" },
        { label: "Grupo B", ages: "Mayores de 12 años" },
      ],
      slots: [
        { start: "09:00", end: "10:00", shared: flex },
        {
          start: "10:30", end: "12:00",
          classes: [
            { title: "Tela", coach: "Daniel Herrera" },
            { title: "Trapecio", coach: "Renata Pinal" },
          ],
        },
        {
          start: "12:30", end: "14:00",
          classes: [
            { title: "Aro", coach: "Renata Pinal" },
            { title: "Cuna", coach: "Daniel Herrera" },
          ],
        },
      ],
    },
    {
      id: "motion",
      title: "Motion",
      venue: "City Express Plus Mundo E by Marriott",
      groups: [
        { label: "Grupo C", ages: "Hasta 12 años" },
        { label: "Grupo D", ages: "Mayores de 12 años" },
      ],
      slots: [
        { start: "15:00", end: "16:00", shared: flex },
        { start: "16:15", end: "17:45", classes: [jazz, musical] },
        { start: "18:00", end: "19:30", classes: [musical, jazz] },
      ],
    },
  ],
};

export function formatWorkshopTime(time: string) {
  const [hour, minutes] = time.split(":");
  const hourNumber = Number(hour);
  return `${hourNumber % 12 || 12}:${minutes} ${hourNumber < 12 ? "a. m." : "p. m."}`;
}

export const edoMexConfirmedWorkshops = Array.from(
  new Map(edoMexWorkshops.tracks.flatMap((track) => track.slots.flatMap((slot) => (
    slot.shared ? [slot.shared] : slot.classes
  ))).map((workshop) => [workshop.title, workshop])).values(),
);
