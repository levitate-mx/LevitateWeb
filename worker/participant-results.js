const finite = value => typeof value === "number" && Number.isFinite(value);
const text = value => typeof value === "string" ? value.trim() : "";
const eventKey = value => /^[0-9a-f-]{36}$/i.test(text(value)) ? text(value).toLowerCase() : text(value);

export function pendingParticipantResult() {
  return { status: "pending", score: null, maxScore: null, medal: null,
    directCompetition: false, eligibleCount: 0, place: null };
}

/** The native CompetitionPlacement.solo score tiers, represented by the portal's
 * medal labels. They are independent of the position among other competitors.
 * iOS AppModels.swift uses 181/210, 161/210 and 141/210 of the effective maximum.
 */
export function participantMedalForScore(score, maximumScore) {
  if (!finite(score) || !finite(maximumScore) || maximumScore <= 0 || score < 0 || score > maximumScore) return null;
  if (score >= maximumScore * (181 / 210)) return "oro";
  if (score >= maximumScore * (161 / 210)) return "plata";
  if (score >= maximumScore * (141 / 210)) return "bronce";
  return "participacion";
}

function completeRoutine(row) {
  if (row?.status !== "complete" || !Number.isInteger(row.expectedJudges) || row.expectedJudges < 1
    || row.completedJudges !== row.expectedJudges || !Array.isArray(row.judges)
    || row.judges.length !== row.expectedJudges) return false;
  const judgeIds = new Set();
  let recorded = 0;
  for (const judge of row.judges) {
    const judgeId = text(judge?.id);
    if (!judgeId || judgeIds.has(judgeId) || judge.status !== "complete"
      || !finite(judge.subtotal) || judge.subtotal < 0 || !finite(judge.total) || judge.total < 0
      || !finite(judge.maximumScore) || judge.maximumScore <= 0 || !finite(judge.penalty)
      || judge.penalty < -100 || judge.penalty > 0 || !Array.isArray(judge.criteria) || !judge.criteria.length) return false;
    judgeIds.add(judgeId);
    const criteria = new Set();
    for (const criterion of judge.criteria) {
      if (!Number.isInteger(criterion?.id) || criterion.id < 0 || criteria.has(criterion.id)
        || !finite(criterion.value) || !finite(criterion.maximumScore) || criterion.maximumScore < 0
        || criterion.value < 0 || criterion.value > criterion.maximumScore) return false;
      criteria.add(criterion.id); recorded += 1;
    }
  }
  return row.recordedScores === recorded;
}

/** Project one already-authorized routine's result from a complete block
 * snapshot. The reader must attest resultScope after reading all routines and
 * scores in each block, not from an own-routines-only judging-sheet snapshot.
 * Authentication, participant membership and edition release belong to caller.
 */
export function projectParticipantResult({ snapshot, routineId } = {}) {
  const pending = pendingParticipantResult();
  const id = text(routineId), eventId = eventKey(snapshot?.event?.id), scope = snapshot?.resultScope;
  if (!id || !eventId || scope?.complete !== true || eventKey(scope.eventId) !== eventId
    || !Array.isArray(scope.blockIds) || !scope.blockIds.length || !Array.isArray(snapshot.rows)
    || !Array.isArray(snapshot.report?.blocks)) return pending;
  const maximum = snapshot.report.maximumScore;
  if (!finite(maximum) || maximum <= 0) return pending;
  const ownRows = snapshot.rows.filter(row => row?.id === id);
  if (ownRows.length !== 1 || !completeRoutine(ownRows[0])) return pending;
  const matches = [];
  for (const block of snapshot.report.blocks) for (const section of Array.isArray(block?.sections) ? block.sections : []) {
    for (const category of Array.isArray(section?.categories) ? section.categories : []) {
      if (!Array.isArray(category?.rows)) continue;
      for (const standing of category.rows) if (standing?.routineId === id) matches.push({ block, category, standing });
    }
  }
  if (matches.length !== 1) return pending;
  const { block, category, standing } = matches[0];
  if (standing.audience?.ready === false) return pending;
  const effectiveMaximum = standing.maximumScore ?? maximum;
  if (!finite(effectiveMaximum) || effectiveMaximum <= 0) return pending;
  if (!text(block.id) || !scope.blockIds.includes(block.id) || text(ownRows[0].blockId) !== text(block.id)) return pending;
  const medal = participantMedalForScore(standing.score, effectiveMaximum);
  if (!medal || !category.rows.length) return pending;
  const categoryIds = new Set();
  let categoryComplete = true;
  for (const entry of category.rows) {
    const peerId = text(entry?.routineId);
    if (!peerId || categoryIds.has(peerId)) return pending;
    categoryIds.add(peerId);
    const peers = snapshot.rows.filter(row => row?.id === peerId);
    if (peers.length !== 1 || text(peers[0].blockId) !== text(block.id)) return pending;
    const peerMaximum = entry.maximumScore ?? maximum;
    if (!completeRoutine(peers[0]) || entry.audience?.ready === false || !finite(peerMaximum) || peerMaximum <= 0
      || !finite(entry.score) || entry.score < 0 || entry.score > peerMaximum) categoryComplete = false;
  }
  const eligibleCount = category.rows.length;
  const directCompetition = eligibleCount >= 2;
  let place = null;
  // The source report already resolves equal totals with competition ranks
  // (1,1,3), and top-three only. A numeric score from incomplete peers must not
  // establish a final position. A zero total has no native podium position.
  if (directCompetition && categoryComplete && standing.score > 0) {
    const rank = standing.placement?.rank;
    if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 3 || rank > eligibleCount)) return pending;
    if (rank === null && standing.placement?.isParticipation !== true) return pending;
    place = rank;
  }
  return { status: "published", score: standing.score, maxScore: effectiveMaximum, medal,
    directCompetition, eligibleCount, place };
}
