import defaults from "./registration-policy.json" with { type: "json" };

// This policy controls creation of new choreographies only. Participants,
// academies, existing choreographies and all payment flows remain available.
// A temporary opening is an exception to the base pause, with an exclusive end.
export function resolveRegistrationPolicy(basePausedVenues, now = Date.now(), opening = defaults.temporaryOpening) {
  const base = [...new Set(basePausedVenues)];
  const start = Date.parse(opening?.startsAt);
  const end = Date.parse(opening?.endsAt);
  const eligible = opening && base.includes(opening.venue)
    && Number.isFinite(start) && Number.isFinite(end) && start < end;
  const temporaryOpening = eligible ? {
    venue: opening.venue, startsAt: opening.startsAt, endsAt: opening.endsAt, message: opening.message,
  } : null;
  const temporaryOpeningActive = Boolean(eligible && now >= start && now < end);
  return {
    basePausedVenues: base,
    pausedVenues: base.filter((venue) => !temporaryOpeningActive || venue !== opening.venue),
    message: temporaryOpeningActive ? opening.message : defaults.message,
    temporaryOpening,
    temporaryOpeningActive,
    nextChangeAt: eligible && now < start ? opening.startsAt : temporaryOpeningActive ? opening.endsAt : null,
    serverTime: new Date(now).toISOString(),
  };
}
