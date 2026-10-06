export const releveHotPresaleStartsAt = Date.parse("2026-10-06T06:00:00.000Z");
export const releveHotPresaleEndsAt = Date.parse("2026-10-08T16:00:00.000Z");
export const releveHotPresalePrice = "$700 MXN";
export const relevePresalePrice = "$1,000 MXN";

export function isReleveHotPresaleActive(now = Date.now()) {
  return now >= releveHotPresaleStartsAt && now < releveHotPresaleEndsAt;
}
