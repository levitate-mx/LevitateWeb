export type ParticipantDiplomaRecipientField = {
  size: number;
  lines: string[];
  baselines: number[];
};
export function layoutParticipantDiplomaRecipient(input: {
  name: string;
  academy?: string;
  measureName: (value: string, size: number) => number;
  measureAcademy: (value: string, size: number) => number;
}): { name: ParticipantDiplomaRecipientField; academy: ParticipantDiplomaRecipientField };
