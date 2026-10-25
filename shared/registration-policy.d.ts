export type TemporaryRegistrationOpening = {
  venue: string;
  startsAt: string;
  endsAt: string;
  message: string;
};

export type RegistrationPolicy = {
  basePausedVenues: string[];
  pausedVenues: string[];
  message: string;
  temporaryOpening: TemporaryRegistrationOpening | null;
  temporaryOpeningActive: boolean;
  nextChangeAt: string | null;
  serverTime: string;
};

export function resolveRegistrationPolicy(
  basePausedVenues: string[],
  now?: number,
  opening?: TemporaryRegistrationOpening | null,
): RegistrationPolicy;
