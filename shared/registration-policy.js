import defaults from "./registration-policy.json" with { type: "json" };

// The historical pause controls creation of new choreographies. The separate
// acquisition closure controls venue-specific public purchases and payment
// mutations without hiding historical records or media purchases.
// A temporary opening is an exception to the base pause, with an exclusive end.
export function resolveRegistrationPolicy(
  basePausedVenues,
  now = Date.now(),
  opening = defaults.temporaryOpening,
  acquisitionsClosedVenues = defaults.acquisitionsClosedVenues,
) {
  const base = [...new Set(basePausedVenues)];
  const closed = [...new Set(acquisitionsClosedVenues || [])];
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
    acquisitionsClosedVenues: closed,
    acquisitionsMessage: defaults.acquisitionsMessage,
    temporaryOpening,
    temporaryOpeningActive,
    nextChangeAt: eligible && now < start ? opening.startsAt : temporaryOpeningActive ? opening.endsAt : null,
    serverTime: new Date(now).toISOString(),
  };
}
