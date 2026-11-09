export type ParticipantMedal = "oro" | "plata" | "bronce" | "participacion";

export interface ParticipantPhoto {
  id: string;
  previewUrl: string;
  downloadUrl?: string | null;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
}

export interface ParticipantJudge {
  name: string;
  score: number | null;
  maxScore: number | null;
  criteria: { label: string; score: number | null; maxScore: number | null }[];
  feedback: string | null;
}

export interface ParticipantRoutine {
  id: string;
  title: string;
  genre: string;
  subgenre: string | null;
  category: string;
  division: string;
  level: string;
  eventId: string;
  result: {
    status: "pending" | "published";
    score: number | null;
    maxScore: number | null;
    medal: ParticipantMedal | null;
    directCompetition: boolean;
    eligibleCount: number;
    place: 1 | 2 | 3 | null;
  };
  judging: {
    status: "pending" | "available";
    judges: ParticipantJudge[];
    assetId?: string | null;
    url?: string | null;
  };
  photos: {
    status: "pending" | "available";
    items: ParticipantPhoto[];
    count: number;
  };
}

export interface ParticipantPortalData {
  participant: { id: string; name: string; academy: string };
  events: { id: string; title: string; season: string; venue: string; startsAt: string | null }[];
  selectedEventId: string;
  diploma: { status: "pending" | "available"; assetId: string | null; url: string | null } | null;
  routines: ParticipantRoutine[];
}

export interface ParticipantAdminPreviewData extends ParticipantPortalData {
  adminPreview: true;
}
