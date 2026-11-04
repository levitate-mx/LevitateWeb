import accessPolicy from "../shared/ticket-access.json" with { type: "json" };

// Operational entrances are independent of the immutable blocks sold on orders.
export const accessSessions = accessPolicy.sessions;
const sessionsById = new Map(accessSessions.map((session) => [session.id, session]));

export function resolveAccessSession(id) {
  const value = String(id || "").trim();
  return sessionsById.get(accessPolicy.aliases[value] || value) || null;
}

export function getAccessCoverage(originalCoverage) {
  const coverage = new Set(Array.isArray(originalCoverage) ? originalCoverage : []);
  // Filtering the canonical list gives a stable, unique result even when a
  // merged source occurs twice or the input already contains operational IDs.
  return accessSessions.filter((session) => coverage.has(session.id)
    || session.sourceBlockIds.some((id) => coverage.has(id))).map((session) => session.id);
}

export function getAccessSessionsForEvent(catalog, eventId) {
  return (eventId || catalog?.eventId) === accessPolicy.eventId
    ? accessSessions
    : catalog?.blocks || [];
}

export function isSplitAccessSession(session) {
  return session?.id === "bloque-4a" || session?.id === "bloque-4b";
}

export function isAmbiguousAccessSession(id) {
  return accessPolicy.ambiguousSessionIds.includes(String(id || "").trim());
}
