import type { ParticipantRoutine } from './participantTypes';

// This summary uses only the sheets already authorized in the participant
// response. Block publication still owns medals, audience bonuses and places.
export function participantReleasedScore(routine: ParticipantRoutine | undefined): { score: number; maxScore: number } | null {
  const judging = routine?.judging, pdf = judging?.pdf;
  if (routine?.result.status !== 'pending' || judging?.source !== 'jueceocore'
    || judging.status !== 'available' || !pdf || pdf.preview !== false
    || !judging.judges.length || pdf.judges.length !== judging.judges.length) return null;
  let total = 0, maximum = 0;
  const ids = new Set<string>();
  for (const [index, judge] of judging.judges.entries()) {
    const sheet = pdf.judges[index];
    if (!sheet.id || ids.has(sheet.id) || sheet.status !== 'complete' || sheet.name !== judge.name
      || typeof judge.score !== 'number' || !Number.isFinite(judge.score) || judge.score < 0
      || typeof judge.maxScore !== 'number' || !Number.isFinite(judge.maxScore)
      || judge.maxScore <= 0 || judge.score > judge.maxScore) return null;
    ids.add(sheet.id);
    // The supplied score already includes its judge's penalties.
    total += judge.score;
    maximum += judge.maxScore;
  }
  return Number.isFinite(total) && Number.isFinite(maximum) ? { score: total, maxScore: maximum } : null;
}
