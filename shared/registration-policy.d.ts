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
  acquisitionsClosedVenues: string[];
  acquisitionsMessage: string;
  temporaryOpening: TemporaryRegistrationOpening | null;
  temporaryOpeningActive: boolean;
  nextChangeAt: string | null;
  serverTime: string;
};

export function resolveRegistrationPolicy(
  basePausedVenues: string[],
  now?: number,
  opening?: TemporaryRegistrationOpening | null,
  acquisitionsClosedVenues?: string[],
): RegistrationPolicy;
