export const REGISTRATION_COLUMN_ALIASES: {
  registrationDanceID: string[]; registrationEventID: string[]; registrationToken: string[];
};
export class RegistrationLinkError extends Error { status: number; constructor(message: string, status?: number); }
export interface RegistrationRoutineMetadata {
  registrationMetadataPresent?: boolean; registrationDanceID?: string; registrationEventID?: string; registrationToken?: string;
}
export interface RegistrationLink { token: string; registrationEventId: string; routines: { danceId: string; sourceRoutineId: string }[]; }
export function registrationMetadataForRow(row: unknown[], columns: Partial<Record<keyof typeof REGISTRATION_COLUMN_ALIASES, number>>): RegistrationRoutineMetadata;
export function collectRegistrationLink(routines: ({ id: string } & RegistrationRoutineMetadata)[], options?: { replaceEvent?: boolean; forceReplace?: boolean }): RegistrationLink | null;
export function assertRegistrationTokenPrivate(value: unknown, token: string): void;
export function postRegistrationLink(link: RegistrationLink, sourceEventId: string, options?: { fetcher?: typeof fetch; timeoutMs?: number }): Promise<true>;
