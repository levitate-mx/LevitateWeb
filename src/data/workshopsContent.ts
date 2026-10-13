import workshopEvent from "../../shared/workshops-event.json";

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

export const edoMexWorkshops: {
  date: string;
  dateLabel: string;
  footnote: string;
  tracks: WorkshopTrack[];
} = {
  date: workshopEvent.date,
  dateLabel: workshopEvent.dateLabel,
  footnote: workshopEvent.footnote,
  tracks: workshopEvent.tracks.map((track) => ({
    ...track,
    groups: [track.groups[0], track.groups[1]],
    slots: track.slots.map((slot) => slot.shared
      ? { start: slot.start, end: slot.end, shared: slot.shared }
      : { start: slot.start, end: slot.end, classes: [slot.classes![0], slot.classes![1]] }),
  })),
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
