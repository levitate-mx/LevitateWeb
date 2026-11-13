// Compact display labels only. The source categories and grouping IDs keep
// their complete age ranges for judging, ranking and publication checks.
export function compactJudgingCategoryTitle(value) {
  if (typeof value !== "string") return "";
  return value.replace(
    /\b(BABY|PETITE|JUNIOR|TEEN|SENIOR|LEGACY)\b\s*(?::\s*|\(\s*)?(?:HASTA\s+(?:LOS\s+)?)?\+?\d+(?:\s*(?:A|[-–])\s*\d+)?\s*A[ÑN]OS(?:\s*(?:EN\s+ADELANTE|\+))?\s*\)?/giu,
    "$1 ",
  ).replace(/\s+/g, " ").trim();
}
