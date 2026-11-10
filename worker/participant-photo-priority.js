export const PHOTO_PREVIEW_LIMIT = 2;

// Callers keep the existing title and ID order to break ties in group size.
export function preferredPhotoDance(dances) {
  let preferred;
  for (const dance of dances) {
    if (!preferred || dance.participant_count < preferred.participant_count) preferred = dance;
  }
  return preferred;
}
