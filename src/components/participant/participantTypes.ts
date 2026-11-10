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

export interface ParticipantJudgingPdfDescriptor {
  eventTitle: string;
  routine: {
    id: string;
    title: string;
    academy: string;
    genre: string;
    category: string;
    division: string;
    level: string;
    block: string;
  };
  judges: {
    id: string;
    name: string;
    status: "pending" | "partial" | "complete";
    criteria: { id: number; label: string; section: string; value: number | null; maximumScore: number }[];
    penalty: number;
    feedback: string;
    sheetMaximumScore?: number;
  }[];
  preview: boolean;
}

export interface ParticipantDiplomaGenerator {
  name: string;
  academy: string;
  eventTitle: string;
  season?: string;
  venue?: string;
  dateLabel?: string;
  preview: boolean;
  templateUrl: "/assets/participant-recognition-template.pdf";
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
    source?: "jueceocore";
    sourceStatus?: "available" | "unavailable" | "unlinked" | "pending";
    pdf?: ParticipantJudgingPdfDescriptor;
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
  diploma: { status: "pending" | "available"; assetId: string | null; url: string | null; generator?: ParticipantDiplomaGenerator } | null;
  routines: ParticipantRoutine[];
}

export interface ParticipantAdminPreviewData extends ParticipantPortalData {
  adminPreview: true;
}
