import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { releveVotingCandidates } from '../shared/releve-voting-catalog.js';
import { buildJudgingScoreSnapshot } from '../worker/judging-score-data.js';
import { projectParticipantResult } from '../worker/participant-results.js';
import { getJudgingScores, getJudgingSheets } from '../worker/judging-reader.js';
import { readAdminSnapshot } from '../worker/judging-admin.js';
import { getBlockPublication } from '../worker/participant-block-publication.js';
import { deriveReleveVotingResult, readReleveVotingResult, releveJudgingEventId as eventId, releveCompetitionPollId as pollId } from '../worker/releve-competition.js';

const blockId = 'bloque-7-aerial-seniors-releve', edition = 'edomex-2026-otono';
const identities = { 'estrella-mistica': '232', 'queen-of-cosmic-fever': '233', damar: '234', mariana: '235', hazel: '236' };
const scoped = row => ({ event_id: eventId, ...row });
function source() {
  return {
    event: { id: eventId, name: 'Evento definitivo', is_active: true },
    blocks: [scoped({ block_id: blockId, name: 'BLOQUE 7: AERIAL SENIORS + RELEVÉ' })],
    routines: releveVotingCandidates.map((candidate, index) => scoped({ routine_id: identities[candidate.id], program_number: String(234 + index),
      name: candidate.choreography, academy: candidate.academy, division: 'RELEVÉ', level: 'NO APLICA', category: 'RELEVÉ',
      genre: candidate.id === 'damar' ? 'ARO' : candidate.id === 'mariana' ? 'TRAPECIO' : 'TELA', block_id: blockId, block: 'BLOQUE 7: AERIAL SENIORS + RELEVÉ' })),
    judges: [scoped({ judge_id: 'j1', name: 'Daniel Herrera', role: 'judge' })],
    templates: [scoped({ template_id: 'releve', genre: 'Relevé', max_score: 50, applies_to: { divisions: ['RELEVÉ'] } })],
    criteria: [scoped({ template_id: 'releve', criterion_id: 1, label: 'Técnica', section: 'Evaluación', max_score: 50 })],
    scores: Object.values(identities).map(routine_id => scoped({ routine_id, judge_id: 'j1', criterion_id: 1, value: 50 })),
    penalties: [], feedback: [], specialAwards: [],
  };
}
function pollRows(votes = { 'estrella-mistica': 3, hazel: 1 }, state = {}) {
  const poll = { id: pollId, event_id: edition, status: 'closed', revision: 2, opened_at: '2026-11-15 18:00:00', closed_at: '2026-11-15 18:15:00', ...state };
  return Object.keys(votes).length ? Object.entries(votes).map(([candidate_id, votes]) => ({ ...poll, candidate_id, votes })) : [{ ...poll, candidate_id: null, votes: 0 }];
}
const standings = snapshot => snapshot.report.blocks.flatMap(block => block.sections.flatMap(section => section.categories.flatMap(category => category.rows)));
function snapshot(voting, data = source()) {
  const result = buildJudgingScoreSnapshot({ ...data, releveVoting: voting });
  return { ...result, resultScope: { eventId, complete: true, blockIds: [blockId] }, publicationContext: { competitionConfig: {} } };
}
function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  const queries = [];
  const db = { prepare(sql) {
    queries.push(sql); const statement = sqlite.prepare(sql); let args = [];
    const bound = { bind(...values) { args = values; return bound; }, async all() { return { results: statement.all(...args) }; },
      async first() { return statement.get(...args) || null; }, async run() { return { success: true, meta: statement.run(...args) }; } };
    return bound;
  } };
  sqlite.prepare('INSERT INTO participant_portal_events(id,title,venue,season,published) VALUES(?,?,?,?,0)').run(edition, 'Evento', 'edomex', '2026');
  return { sqlite, db, queries };
}

test('the closed audience winner gets exactly five points after normalization, including 150 + 5 = 155', () => {
  const data = source(), before = structuredClone(data);
  const result = snapshot(deriveReleveVotingResult(pollRows()), data);
  const rows = standings(result), winner = rows.find(row => row.routineId === '232');
  assert.equal(winner.juryScore, 150); assert.equal(winner.score, 155); assert.equal(winner.maximumScore, 155);
  assert.deepEqual(winner.audience, { candidateId: 'estrella-mistica', votes: 3, bonus: 5, ready: true, status: 'closed' });
  assert.equal(winner.placement.rank, 1);
  assert.ok(rows.filter(row => row !== winner).every(row => row.score === 150 && row.audience.bonus === 0));
  assert.equal(result.report.maximumScore, 150, 'the normal competition scale stays unchanged');
  assert.equal(result.report.blocks[0].sections.length, 1, 'all five Relevé candidates share one podium across apparatuses');
  assert.equal(result.report.blocks[0].sections[0].categories[0].rows.length, 5);
  assert.deepEqual(data, before, 'jury scores are never edited to implement the bonus');
  assert.deepEqual(standings(snapshot(deriveReleveVotingResult(pollRows()), data)), rows, 'refreshing never adds the bonus twice');
  const projected = projectParticipantResult({ snapshot: result, routineId: '232' });
  assert.equal(projected.status, 'published'); assert.equal(projected.score, 155); assert.equal(projected.maxScore, 155); assert.equal(projected.place, 1);
  assert.doesNotMatch(JSON.stringify(projected), /votes|candidate|hazel|voter|jury|hash/i);
});

test('initial closure, open voting, missing counts and unresolved ties never establish a final result', () => {
  for (const [voting, expected] of [[deriveReleveVotingResult([]), 'not_started'],
    [deriveReleveVotingResult(pollRows({}, { opened_at: null, closed_at: null })), 'not_started'],
    [deriveReleveVotingResult(pollRows(undefined, { status: 'open' })), 'open'],
    [deriveReleveVotingResult(pollRows({ 'estrella-mistica': 3, hazel: 3 })), 'tie_pending'], [null, 'unavailable']]) {
    const result = snapshot(voting);
    for (const row of standings(result)) {
      assert.equal(row.audience.status, expected); assert.equal(row.audience.ready, false);
      assert.equal(row.audience.bonus, 0); assert.equal(row.score, row.juryScore); assert.equal(row.placement, null);
      assert.equal(projectParticipantResult({ snapshot: result, routineId: row.routineId }).status, 'pending');
    }
    assert.equal(result.warnings.length, 1);
  }
});

test('a completed poll with no ballots has no favorite and awards no bonus', () => {
  const voting = deriveReleveVotingResult(pollRows({}));
  assert.equal(voting.ready, true); assert.equal(voting.totalVotes, 0);
  assert.ok(voting.candidates.every(row => row.votes === 0 && row.bonus === 0));
  assert.ok(standings(snapshot(voting)).every(row => row.score === 150 && row.audience.ready));
});

test('unknown candidates, invalid totals and mismatched snapshots do not silently become zero votes', () => {
  for (const rows of [pollRows({ unknown: 2 }), pollRows({ hazel: -1 }), pollRows({ hazel: NaN }), pollRows({ hazel: '3' }),
    pollRows({ hazel: 2 }, { event_id: 'other-edition' }), [...pollRows(), ...pollRows()], pollRows(undefined, { status: 'bad' })]) {
    assert.equal(deriveReleveVotingResult(rows).status, 'unavailable');
  }
  const otherPoll = { ...deriveReleveVotingResult(pollRows()), pollId: 'other-poll' };
  assert.ok(standings(snapshot(otherPoll)).every(row => !row.audience.ready && row.audience.bonus === 0));
});

test('the bonus is scoped to stable routine IDs in the definitive event; ambiguous identities stay pending', () => {
  const voting = deriveReleveVotingResult(pollRows());
  for (const field of ['name', 'academy', 'block_id', 'division']) {
    const data = source(); data.routines[0][field] = 'Different';
    const own = standings(snapshot(voting, data)).find(row => row.routineId === '232');
    assert.equal(own.audience.ready, false); assert.equal(own.audience.bonus, 0);
  }
  const data = source(), foreign = '11111111-2222-4333-8444-555555555555';
  data.event.id = foreign;
  for (const table of ['blocks', 'routines', 'judges', 'templates', 'criteria', 'scores']) for (const row of data[table]) row.event_id = foreign;
  assert.ok(standings(snapshot(voting, data)).every(row => !row.audience && row.score === 150));
  const incomplete = source(); incomplete.scores = [];
  assert.ok(standings(snapshot(voting, incomplete)).every(row => row.placement === null), 'a public favorite cannot win without a jury sheet');
});

test('the database reads poll state and counts atomically and closed/reopened polls invalidate the previous bonus', async t => {
  const f = database(t);
  assert.equal((await readReleveVotingResult(f.db, eventId)).status, 'not_started');
  const previousQueries = f.queries.length;
  assert.equal(await readReleveVotingResult(f.db, 'other-event'), null); assert.equal(f.queries.length, previousQueries);
  f.sqlite.prepare(`INSERT INTO releve_voting_polls(id,event_id,status,revision,created_by,updated_by,opened_at,closed_at) VALUES(?,?,'closed',2,'admin','admin',datetime('now'),datetime('now'))`).run(pollId, edition);
  f.sqlite.prepare(`INSERT INTO releve_voting_ballots(id,poll_id,voter_hash,candidate_id,session_hash) VALUES('vote',?,'device-hash','hazel','private-session')`).run(pollId);
  const closed = await readReleveVotingResult(f.db, eventId);
  assert.equal(closed.candidates.find(row => row.id === 'hazel').bonus, 5);
  assert.doesNotMatch(JSON.stringify(closed), /device-hash|private-session/);
  assert.equal(f.queries.at(-1).includes('LEFT JOIN releve_voting_ballots'), true);
  f.sqlite.exec("UPDATE releve_voting_polls SET status='open',revision=3");
  const reopened = await readReleveVotingResult(f.db, eventId);
  assert.equal(reopened.ready, false); assert.ok(reopened.candidates.every(row => row.bonus === 0));
  assert.equal((await readReleveVotingResult({ prepare() { throw Error('PRIVATE STORAGE ERROR'); } }, eventId)).status, 'unavailable');
});

test('both admin readers and the participant reader include the same trusted audience result', async t => {
  const f = database(t), data = source();
  f.sqlite.prepare(`INSERT INTO releve_voting_polls(id,event_id,status,revision,created_by,updated_by,opened_at,closed_at) VALUES(?,?,'closed',2,'admin','admin',datetime('now'),datetime('now'))`).run(pollId, edition);
  f.sqlite.prepare(`INSERT INTO releve_voting_ballots(id,poll_id,voter_hash,candidate_id,session_hash) VALUES('vote',?,'device-hash','mariana','private-session')`).run(pollId);
  const env = { DB: f.db, JUDGING_SUPABASE_URL: 'https://judgingfixture.supabase.co', JUDGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', JUDGING_LEVITATE_EVENT_IDS: eventId };
  const fetcher = async input => {
    const url = new URL(input), table = url.pathname.split('/').at(-1);
    const rows = table === 'events' ? [data.event] : data[table === 'criteria_templates' ? 'templates' : table === 'special_awards' ? 'specialAwards' : table] || [];
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000);
    return Response.json(rows.slice(offset, offset + limit));
  };
  const publicAdmin = await getJudgingScores(env, eventId, { fetcher });
  const workspaceAdmin = await readAdminSnapshot(env, eventId, { fetcher });
  const participant = await getJudgingSheets(env, eventId, { routineIds: ['235'], fetcher });
  for (const result of [publicAdmin, workspaceAdmin.snapshot, participant]) {
    const winner = standings(result).find(row => row.routineId === '235');
    assert.equal(winner.audience.votes, 1); assert.equal(winner.audience.bonus, 5); assert.equal(winner.audience.ready, true);
  }
});

test('automatic publication waits for poll closure and unresolved ties, and accepts a legitimate 155-point result', async t => {
  const f = database(t), data = source();
  f.sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES('a','Academia','Contacto','fixture@example.invalid');`);
  f.sqlite.exec(`INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,email_confirmed_at) VALUES('admin','a','Admin','admin','admin@example.invalid','fixture-only-unused','admin',datetime('now'));`);
  f.sqlite.prepare('INSERT INTO participant_portal_judging_sources(event_id,source_event_id,enabled) VALUES(?,?,1)').run(edition, eventId);
  f.sqlite.prepare("INSERT INTO participant_portal_publication_settings(event_id,mode,automatic_completion,operation_nonce,updated_by) VALUES(?,'block_close',1,'fixture','admin')").run(edition);
  for (const routine of data.routines) {
    f.sqlite.prepare("INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue) VALUES(?,'a',?,'aereo','tela','solo','intermedio','edomex')").run(routine.routine_id, routine.name);
    f.sqlite.prepare('INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id) VALUES(?,?,?,?,?)').run('portal-' + routine.routine_id, edition, routine.routine_id, eventId, routine.routine_id);
  }
  for (const [voting, complete] of [[deriveReleveVotingResult(pollRows(undefined, { status: 'open' })), false],
    [deriveReleveVotingResult(pollRows({ hazel: 1, mariana: 1 })), false], [deriveReleveVotingResult(pollRows()), true]]) {
    const result = await getBlockPublication({ db: f.db, eventId: edition, blockId,
      getDirectory: async () => ({ event: { id: eventId }, blocks: [{ id: blockId, name: 'Relevé', routineIds: data.routines.map(row => row.routine_id) }] }),
      getSnapshot: async () => snapshot(voting, data) });
    assert.equal(result.selectedBlock.complete, complete);
    assert.equal(result.selectedBlock.state, complete ? 'ready' : 'open');
  }
});
