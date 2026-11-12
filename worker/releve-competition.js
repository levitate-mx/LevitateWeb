import { releveVotingCandidates } from '../shared/releve-voting-catalog.js';

// These are source routine IDs, not the editable numbers printed in the program.
export const releveJudgingEventId = 'a62f724b-9d66-47ea-8dee-d54294783130';
export const releveCompetitionPollId = 'edomex-2026-otono-releve';
export const releveBonusPoints = 5;
export const releveTiePolicy = 'pending';
const editionId = 'edomex-2026-otono';
const blockId = 'bloque-7-aerial-seniors-releve';
const routineIds = { 'estrella-mistica': '232', 'queen-of-cosmic-fever': '233', damar: '234', mariana: '235', hazel: '236' };
const normalize = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');

export function releveCandidateForRoutine(eventId, row) {
  if (eventId !== releveJudgingEventId || row.blockId !== blockId || normalize(row.division) !== 'RELEVE') return null;
  return releveVotingCandidates.find(candidate => routineIds[candidate.id] === row.id
    && normalize(candidate.choreography) === normalize(row.name)
    && normalize(candidate.academy) === normalize(row.academy)) || null;
}

export function deriveReleveVotingResult(rows) {
  const tiePolicy = releveTiePolicy;
  const pending = status => ({ pollId: releveCompetitionPollId, eventId: releveJudgingEventId,
    status, ready: false, totalVotes: 0, tiePolicy,
    candidates: status === 'not_started' ? releveVotingCandidates.map(candidate => ({ id: candidate.id,
      routineId: routineIds[candidate.id], votes: 0, bonus: 0 })) : [] });
  if (!Array.isArray(rows) || !rows.length) return pending('not_started');
  const poll = rows[0];
  if (poll.id !== releveCompetitionPollId || poll.event_id !== editionId
    || !['open', 'closed'].includes(poll.status)) return pending('unavailable');
  const counts = new Map();
  for (const row of rows) {
    if (row.id !== poll.id || row.status !== poll.status || row.revision !== poll.revision
      || row.event_id !== editionId || !Number.isSafeInteger(row.votes) || row.votes < 0
      || (row.candidate_id !== null && (!releveVotingCandidates.some(c => c.id === row.candidate_id) || counts.has(row.candidate_id)))) return pending('unavailable');
    if (row.candidate_id !== null) counts.set(row.candidate_id, row.votes);
  }
  const totalVotes = [...counts.values()].reduce((sum, votes) => sum + votes, 0);
  if (!Number.isSafeInteger(totalVotes)) return pending('unavailable');
  const most = Math.max(0, ...counts.values());
  const leaders = [...counts].filter(([, votes]) => most > 0 && votes === most).map(([id]) => id);
  const status = poll.status === 'open' ? 'open' : !poll.opened_at || !poll.closed_at ? 'not_started'
    : leaders.length > 1 ? 'tie_pending' : 'closed';
  const ready = status === 'closed';
  return { pollId: poll.id, eventId: releveJudgingEventId, status, ready, totalVotes, revision: poll.revision, tiePolicy,
    candidates: releveVotingCandidates.map(candidate => ({ id: candidate.id, routineId: routineIds[candidate.id],
      votes: counts.get(candidate.id) || 0, bonus: ready && leaders.includes(candidate.id) ? releveBonusPoints : 0 })) };
}

export async function readReleveVotingResult(db, eventId) {
  if (eventId !== releveJudgingEventId) return null;
  try {
    // Poll state and totals come from a single database snapshot, including a
    // close or reopen racing this read. Individual device ballots never leave D1.
    const { results } = await db.prepare(`SELECT p.id,p.event_id,p.status,p.revision,p.opened_at,p.closed_at,
      b.candidate_id,COUNT(b.id) AS votes FROM releve_voting_polls p
      LEFT JOIN releve_voting_ballots b ON b.poll_id=p.id WHERE p.id=? AND p.event_id=?
      GROUP BY p.id,b.candidate_id`).bind(releveCompetitionPollId, editionId).all();
    return deriveReleveVotingResult(results);
  } catch {
    return { pollId: releveCompetitionPollId, eventId, status: 'unavailable', ready: false, totalVotes: 0, candidates: [], tiePolicy: releveTiePolicy };
  }
}

export function releveStanding(eventId, row, juryScore, voting, warn) {
  const candidate = releveCandidateForRoutine(eventId, row);
  if (eventId !== releveJudgingEventId || (!Object.values(routineIds).includes(row.id) && normalize(row.division) !== 'RELEVE')) return null;
  const valid = voting?.eventId === eventId && voting.pollId === releveCompetitionPollId;
  const result = valid && candidate ? voting.candidates?.find(item => item.id === candidate.id && item.routineId === row.id) : null;
  const ready = Boolean(valid && voting.ready === true && voting.status === 'closed' && result);
  if (!ready) warn('El dictamen de Relevé está pendiente del cierre de la votación del público y de resolver cualquier empate.');
  const bonus = ready && result.bonus === releveBonusPoints ? releveBonusPoints : 0;
  return { juryScore, score: juryScore === null ? null : juryScore + bonus, maximumScore: 150 + releveBonusPoints,
    audience: { candidateId: candidate?.id ?? null, votes: result?.votes ?? null, bonus, ready,
      status: valid && candidate ? voting.status : 'unavailable' } };
}
