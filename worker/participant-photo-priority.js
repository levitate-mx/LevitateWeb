export const PHOTO_PREVIEW_LIMIT = 2;

const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const danceId = dance => dance.registration_dance_id ?? dance.id;

export function prioritizedPhotoDances(dances) {
  return [...dances].sort((left, right) => left.participant_count - right.participant_count
    || compare(String(left.title || ''), String(right.title || ''))
    || compare(String(danceId(left)), String(danceId(right))));
}

export function preferredPhotoDance(dances) { return prioritizedPhotoDances(dances)[0]; }

// The two previews belong to the passport as a whole. A larger choreography
// fills an empty slot; smaller choreographies win only when choices exceed two.
export function selectParticipantPhotoAssets(dances, assets) {
  const rank = new Map(prioritizedPhotoDances(dances).map((dance, index) => [danceId(dance), index]));
  const seen = new Set();
  return assets.filter(asset => rank.has(asset.danceId ?? asset.dance_id))
    .sort((left, right) => rank.get(left.danceId ?? left.dance_id) - rank.get(right.danceId ?? right.dance_id)
      || compare(String(right.created_at || ''), String(left.created_at || ''))
      || compare(String(right.id), String(left.id)))
    .filter(asset => !seen.has(asset.id) && seen.add(asset.id)).slice(0, PHOTO_PREVIEW_LIMIT);
}
