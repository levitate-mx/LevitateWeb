import assert from 'node:assert/strict';
import test from 'node:test';
import { selectJudgingTemplate } from '../worker/judging-template.js';
import { validateJudgeRows } from '../worker/judge-workspace.js';
import { buildJudgingScoreSnapshot } from '../worker/judging-score-data.js';
import { deriveReleveVotingResult, releveJudgingEventId as eventId } from '../worker/releve-competition.js';
import { releveVotingCandidates } from '../shared/releve-voting-catalog.js';
const blockId = 'bloque-7-aerial-seniors-releve';
const labels = ['Técnica y control', 'Composición coreográfica', 'Musicalidad', 'Interpretación artística', 'Presencia escénica'];
const scoped = row => ({ event_id: eventId, ...row });
const rubric = scoped({ template_id: 'releve', genre: 'RELEVÉ', title: 'HOJA DE JUECEO RELEVÉ', max_score: 15,
  applies_to: { divisions: ['RELEVÉ'], primary_categories: ['TELA', 'ARO', 'TRAPECIO'] } });
const ordinary = ['TELA', 'ARO', 'TRAPECIO'].map(genre => scoped({ template_id: genre.toLowerCase(), genre, max_score: 70, applies_to: { primary_categories: [genre] } }));
const criteria = labels.map((label, index) => scoped({ template_id: 'releve', criterion_id: index + 1, section: 'RELEVÉ', label, max_score: 3, sort_order: index + 1 }));
const identities = { 'estrella-mistica': '232', 'queen-of-cosmic-fever': '233', damar: '234', mariana: '235', hazel: '236' };
const routines = releveVotingCandidates.map(candidate => scoped({ routine_id: identities[candidate.id], name: candidate.choreography,
  academy: candidate.academy, division: 'RELEVÉ', genre: candidate.id === 'damar' ? 'ARO' : candidate.id === 'mariana' ? 'TRAPECIO' : 'TELA', block_id: blockId }));
const judges = ['daniel-herrera', 'renata-pinal', 'ana-karen-rojas'].map(judge_id => scoped({ judge_id, name: judge_id, role: 'judge', assigned_block_ids: [blockId] }));
const score = (routine, criterion, value = 3) => scoped({ routine_id: routine.routine_id, block_id: blockId, judge_id: judges[0].judge_id, criterion_id: criterion, value });
const scope = { eventId, judgeId: judges[0].judge_id, blocks: [], assigned: [blockId] };

test('the five Relevé routines select their five-point rubric independently of apparatus and template order', () => {
  for (const templates of [[...ordinary, rubric], [rubric, ...ordinary]]) for (const routine of routines) {
    assert.equal(selectJudgingTemplate(routine, templates).template_id, 'releve');
    const normal = { ...routine, division: 'SENIOR' };
    assert.equal(selectJudgingTemplate(normal, templates).template_id, normal.genre.toLowerCase());
  }
});

test('Relevé accepts only integer scores 1–3 for its five criteria, preserving ordinary zero-score handling', () => {
  for (const value of [1, 2, 3]) {
    const clean = validateJudgeRows('scores', [score(routines[0], 1, value)], scope, routines, [...ordinary, rubric], criteria);
    assert.equal(clean[0].value, value);
  }
  for (const value of [0, -1, 4, 2.5]) assert.throws(() => validateJudgeRows('scores', [score(routines[0], 1, value)], scope, routines, [...ordinary, rubric], criteria), { code: 'judge_invalid_score' });
  assert.throws(() => validateJudgeRows('scores', [score(routines[0], 6)], scope, routines, [...ordinary, rubric], criteria), { code: 'judge_invalid_score' });
  const normal = { ...routines[0], routine_id: 'ordinary', division: 'SENIOR' };
  const normalCriterion = scoped({ template_id: 'tela', criterion_id: 1, max_score: 5 });
  assert.equal(validateJudgeRows('scores', [score(normal, 1, 0)], scope, [normal], [...ordinary, rubric], [...criteria, normalCriterion])[0].value, 0);
});

test('all Relevé report and participant sheets use the five labels and preserve the audience bonus normalization', () => {
  const scores = routines.flatMap(routine => judges.flatMap(judge => criteria.map(criterion => ({ ...score(routine, criterion.criterion_id), judge_id: judge.judge_id }))));
  const source = { event: { id: eventId, name: 'Relevé' }, blocks: [scoped({ block_id: blockId, name: 'Bloque 7' })], routines, judges,
    templates: [...ordinary, rubric], criteria, scores, penalties: [], feedback: [], specialAwards: [],
    releveVoting: deriveReleveVotingResult([{ id: 'edomex-2026-otono-releve', event_id: 'edomex-2026-otono', status: 'closed', revision: 2,
      opened_at: '2026-11-15 18:00:00', closed_at: '2026-11-15 18:15:00', candidate_id: 'hazel', votes: 2 }]) };
  const result = buildJudgingScoreSnapshot(source);
  for (const routine of result.rows) {
    assert.equal(routine.status, 'complete');
    for (const judge of routine.judges) {
      assert.equal(judge.maximumScore, 15);
      assert.deepEqual(judge.criteria.map(criterion => criterion.label), labels);
      assert.ok(judge.criteria.every(criterion => criterion.maximumScore === 3));
    }
  }
  const rows = result.report.blocks.flatMap(block => block.sections.flatMap(section => section.categories.flatMap(category => category.rows)));
  assert.equal(rows.find(row => row.routineId === '236').score, 155);
  assert.ok(rows.filter(row => row.routineId !== '236').every(row => row.score === 150));
  source.scores[0].value = 0;
  assert.notEqual(buildJudgingScoreSnapshot(source).rows.find(row => row.id === '232').status, 'complete');
});
