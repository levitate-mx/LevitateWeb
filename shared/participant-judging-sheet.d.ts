export interface ParticipantJudgingCriterion {
  id: string | number;
  label: string;
  section?: string;
  value: number | null;
  maximumScore: number | null;
}
export interface ParticipantJudgingJudge {
  id?: string;
  name: string;
  status?: string;
  criteria: ParticipantJudgingCriterion[];
  penalty?: number | null;
  feedback?: string;
  sheetMaximumScore?: number | null;
}
export interface ParticipantJudgingSheetSummary {
  complete: boolean;
  subtotal: number | null;
  total: number | null;
  penalty: number | null;
  maximumScore: number | null;
}
export function summarizeParticipantJudgingSheet(judge: ParticipantJudgingJudge): ParticipantJudgingSheetSummary;
export function generateParticipantJudgingPdf(options: {
  eventTitle: string;
  routine: {
    id?: string | number;
    title: string;
    academy?: string;
    genre?: string;
    category?: string;
    division?: string;
    level?: string;
    block?: string;
  };
  judges: ParticipantJudgingJudge[];
  logoBytes?: Uint8Array | ArrayBuffer;
  preview?: boolean;
}): Promise<Uint8Array>;
