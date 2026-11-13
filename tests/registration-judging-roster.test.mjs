import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJudgingScoreSnapshot } from '../worker/judging-score-data.js';

const eventId = 'levitate-roster-test';
const at = '2026-11-11T18:00:00.000Z';
const row = fields => ({ event_id: eventId, ...fields });
const motion = ['Eva Carrillo', 'Daniel Montalvo', 'Jorge Díaz'];
const aerial = ['Daniel Herrera', 'Renata Pinal', 'Ana Karen Rojas'];
function fixture({ genre = 'JAZZ', title = 'Bloque de competencia', ownScore = 8, otherScore = 2 } = {}) {
  const area = genre === 'JAZZ' ? 'motion' : 'aerial';
  const judges = [...motion, ...aerial].map((name, index) => row({
    judge_id: `j${index + 1}`, name, role: 'judge', sort_order: index,
    // Deliberately stale/empty assignments must not defeat the confirmed roster.
    assigned_block_ids: index % 2 ? [] : ['another-block'],
  }));
  return {
    event: { id: eventId, name: 'Levitate Estado de México' },
    blocks: [row({ block_id: 'opaque-block-id', name: title, title })],
    routines: [row({ routine_id: 'r1', name: 'Coreografía', academy: 'Academia',
      genre, division: 'Teen', category: 'Solo', level: 'Intermedio', block_id: 'opaque-block-id', block: title })],
    judges,
    templates: [row({ template_id: 'template', genre, max_score: 10 })],
    criteria: [row({ template_id: 'template', criterion_id: 1, label: 'Técnica', max_score: 10 })],
    scores: judges.map((judge, index) => row({ routine_id: 'r1', judge_id: judge.judge_id,
      criterion_id: 1, value: (area === 'motion' ? index < 3 : index >= 3) ? ownScore : otherScore })),
    penalties: [], feedback: [], specialAwards: [],
  };
}
const snapshot = input => buildJudgingScoreSnapshot(input, at, { judgeRoster: 'levitate' });
const officialScore = result => result.report.blocks[0].sections[0].categories[0].rows[0].score;

for (const [genre, expectedNames] of [['JAZZ', motion], ['ARO', aerial], ['TELA', aerial], ['OPEN: CUNA', aerial]]) {
  test(`the confirmed ${genre} jury is the only jury displayed and used for official scores and completion`, () => {
    const input = fixture({ genre });
    const before = structuredClone(input);
    const result = snapshot(input);
    const value = result.rows[0];
    assert.deepEqual(value.judges.map(judge => judge.name), expectedNames);
    assert.equal(value.expectedJudges, 3);
    assert.equal(value.completedJudges, 3);
    assert.equal(value.recordedScores, 3);
    assert.equal(value.status, 'complete');
    assert.equal(officialScore(result), 24, 'only the three confirmed jury totals contribute to the real sum');
    assert.equal(result.report.blocks[0].sections[0].categories[0].rows[0].maximumScore, 30);
    assert.equal(result.report.maximumScore, 30);
    assert.deepEqual(input, before, 'the original judging data remains untouched');
  });
}

test('unrelated scores, penalties and feedback cannot affect a report or make an authorized sheet ambiguous', () => {
  const input = fixture();
  input.scores.push(row({ routine_id: 'r1', judge_id: 'j4', criterion_id: 1, value: 999 }));
  input.penalties.push(row({ routine_id: 'r1', judge_id: 'j4', value: 5 }), row({ routine_id: 'r1', judge_id: 'j4', value: -999 }));
  input.feedback.push(row({ routine_id: 'r1', judge_id: 'j4', body: 'Foreign jury comment' }));
  const result = snapshot(input);
  assert.equal(result.rows[0].status, 'complete');
  assert.equal(result.rows[0].recordedScores, 3);
  assert.equal(officialScore(result), 24);
  assert.equal(result.report.maximumScore, 30);
  assert.doesNotMatch(JSON.stringify(result.rows), /Foreign jury comment|Daniel Herrera/);
});

test('a missing relevant sheet stays pending even when all judges from the other area finished', () => {
  const input = fixture();
  input.scores = input.scores.filter(score => score.judge_id !== 'j3');
  const result = snapshot(input);
  assert.equal(result.rows[0].expectedJudges, 3);
  assert.equal(result.rows[0].completedJudges, 2);
  assert.equal(result.rows[0].recordedScores, 2);
  assert.equal(result.rows[0].status, 'partial');
  assert.equal(officialScore(result), 16, 'the missing official judge contributes zero, not an unrelated judge');
  assert.equal(result.report.blocks[0].sections[0].categories[0].rows[0].maximumScore, 30);
});

test('jury identities accept accents, casing, spaces and the published full name of Jorge Díaz de León', () => {
  const input = fixture();
  input.judges[0].name = '  EVA CARRILO  ';
  input.judges[1].name = 'Daniel Montalvo';
  input.judges[2].name = 'JORGE DÍAZ DE LEÓN';
  const result = snapshot(input);
  assert.deepEqual(result.rows[0].judges.map(judge => judge.id), ['j1', 'j2', 'j3']);
  assert.equal(result.rows[0].status, 'complete');
});

test('a required judge absent from the event does not shrink the expected jury and release a completed result', () => {
  const input = fixture();
  input.judges = input.judges.filter(judge => judge.judge_id !== 'j3');
  input.scores = input.scores.filter(score => score.judge_id !== 'j3');
  const result = snapshot(input);
  assert.equal(result.rows[0].expectedJudges, 3);
  assert.equal(result.rows[0].status, 'unavailable');
  assert.equal(officialScore(result), null);
  assert.ok(result.warnings.length > 0);
});

test('two judge IDs resolving to the same required person are ambiguous rather than counted twice', () => {
  const input = fixture();
  input.judges.push(row({ judge_id: 'j7', name: 'JORGE DÍAZ DE LEÓN', role: 'judge' }));
  input.scores.push(row({ routine_id: 'r1', judge_id: 'j7', criterion_id: 1, value: 10 }));
  const result = snapshot(input);
  assert.equal(result.rows[0].expectedJudges, 3);
  assert.equal(result.rows[0].status, 'unavailable');
  assert.equal(officialScore(result), null);
  assert.ok(result.rows[0].judges.length < 4);
  assert.ok(result.warnings.length > 0);
});

for (const role of ['admin', undefined]) {
  test(`a required judge identity must have an explicit judge role rather than ${role}`, () => {
    const input = fixture();
    input.judges[0].role = role;
    const result = snapshot(input);
    assert.equal(result.rows[0].status, 'unavailable');
    assert.equal(result.rows[0].expectedJudges, 3);
    assert.ok(result.rows[0].judges.every(judge => judge.id !== 'j1'));
    assert.equal(officialScore(result), null);
  });
}

test('a routine with an unknown discipline may use the explicit area in its block title', () => {
  const input = fixture({ genre: 'CUSTOM', title: 'Bloque Aerial' });
  const result = snapshot(input);
  assert.deepEqual(result.rows[0].judges.map(judge => judge.name), aerial);
  assert.equal(result.rows[0].status, 'complete');
});

test('an unknown discipline and numeric-only block never falls back to displaying all six judges', () => {
  const input = fixture({ genre: 'CUSTOM', title: 'Bloque 1' });
  const result = snapshot(input);
  assert.equal(result.rows[0].status, 'unavailable');
  assert.deepEqual(result.rows[0].judges, []);
  assert.equal(officialScore(result), null);
  assert.ok(result.warnings.length > 0);
});

test('the default jury selection remains unchanged without the admin roster option while the report uses its real sum', () => {
  const input = fixture();
  for (const judge of input.judges) judge.assigned_block_ids = [];
  const result = buildJudgingScoreSnapshot(input, at);
  assert.equal(result.rows[0].expectedJudges, 6);
  assert.equal(result.rows[0].completedJudges, 6);
  assert.equal(result.rows[0].status, 'complete');
  assert.equal(officialScore(result), 30, 'three 8-point totals and three 2-point totals are added without rescaling');
  assert.equal(result.report.blocks[0].sections[0].categories[0].rows[0].maximumScore, 60);
  assert.equal(result.report.maximumScore, 60);
});
