/** Score medals apply to every routine, independently of direct competition.
 * These native tiers use 181/210, 161/210 and 141/210 of the effective maximum.
 */
export function competitionMedalForScore(score, maximumScore) {
  if (typeof score !== "number" || !Number.isFinite(score)
    || typeof maximumScore !== "number" || !Number.isFinite(maximumScore)
    || maximumScore <= 0 || score < 0 || score > maximumScore) return null;
  if (score >= maximumScore * (181 / 210)) return "oro";
  if (score >= maximumScore * (161 / 210)) return "plata";
  if (score >= maximumScore * (141 / 210)) return "bronce";
  return "participacion";
}
