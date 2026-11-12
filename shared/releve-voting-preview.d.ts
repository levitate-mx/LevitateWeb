export type RelevePreviewDivision = "motion" | "aerial";

export interface RelevePreviewCandidate {
  readonly id: string;
  readonly division: RelevePreviewDivision;
  readonly teacherName: string;
  readonly academyName: string;
  readonly choreographyTitle: string;
  readonly entryNumber: number;
}

export interface ReleveVotingPreviewPayload {
  readonly mode: "preview";
  readonly publicVotingEnabled: false;
  readonly title: string;
  readonly description: string;
  readonly candidates: readonly RelevePreviewCandidate[];
  readonly fetchedAt: string;
}

export function getReleveVotingPreview(): ReleveVotingPreviewPayload;
