export type ParticipantDiplomaOptions = {
  name: string;
  academy?: string;
  eventTitle: string;
  season?: string;
  venue?: string;
  dateLabel?: string;
  entryUrl?: string;
  logoBytes?: Uint8Array | ArrayBuffer;
  templateBytes?: Uint8Array | ArrayBuffer;
  unicodeFontBytes?: Uint8Array | ArrayBuffer;
  preview?: boolean;
};
export function generateParticipantDiploma(options: ParticipantDiplomaOptions): Promise<Uint8Array>;
export function generateParticipantQrSvg(entryUrl: string): Promise<string>;
