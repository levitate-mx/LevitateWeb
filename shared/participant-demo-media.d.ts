export interface ParticipantDemoMediaDefinition {
  readonly slot: "foto-1" | "foto-2";
  readonly publicPath: string;
  readonly sourcePath: string;
  readonly storageKey: string;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
}

export const participantDemoMediaDefinitions: readonly ParticipantDemoMediaDefinition[];
export function getParticipantDemoMediaByPath(pathname: string): ParticipantDemoMediaDefinition | null;
export function getParticipantDemoMediaBySlot(slot: string): ParticipantDemoMediaDefinition | null;
