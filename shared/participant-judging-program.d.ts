export interface ParticipantJudgingProgramLink {
  danceId: string;
  sourceRoutineId: string;
}
export function parseParticipantJudgingProgram(html: string): ParticipantJudgingProgramLink[];
