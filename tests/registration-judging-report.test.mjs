import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildJudgingScoreSnapshot } from '../worker/judging-score-data.js';

// Expected values were produced by compiling the native Swift sources, not by
// calling the JavaScript report code. The fixture records each source SHA-256.
// Swift is not needed to run this portable regression suite.
const native = JSON.parse(await readFile(new URL('./fixtures/judging-report-native-contract.json', import.meta.url), 'utf8'));
const eventId = 'report-fixture-event';
const at = '2026-11-02T18:00:00.000Z';
const row = fields => ({ event_id: eventId, ...fields });

function fixture(routines = [{ id: '1', score: 120 }], { scoring = {}, report = {}, maximum = 150, judges = null } = {}) {
  const blockNames = [...new Set(routines.map(item => item.block ?? 'Bloque 1'))];
  const blockIds = new Map(blockNames.map((name, index) => [name, `block-${index + 1}`]));
  const genres = [...new Set(routines.map(item => item.genre ?? 'Jazz'))];
  const data = {
    event: { id: eventId, name: 'Levitate de prueba', competition_config: { scoring, result_report: report } },
    blocks: blockNames.map((name, index) => row({ block_id: blockIds.get(name), name, title: name, sort_order: index, is_active: index === 0 })),
    routines: routines.map((item, index) => row({ routine_id: item.id, name: item.name ?? `Pieza ${item.id}`, academy: item.academy ?? '',
      genre: item.genre ?? 'Jazz', division: item.division ?? 'Teen', level: item.level ?? 'Intermedio', category: item.category ?? 'Solo',
      state: item.state ?? '', block_id: blockIds.get(item.block ?? 'Bloque 1'), block: item.block ?? 'Bloque 1', sort_order: index })),
    judges: (judges ?? [{ judge_id: 'j1', name: 'Juez 1', role: 'judge' }]).map(item => row(item)),
    templates: genres.map((genre, index) => row({ template_id: `template-${index}`, genre, max_score: maximum, sort_order: index })),
    criteria: genres.map((_genre, index) => row({ template_id: `template-${index}`, criterion_id: 1, label: 'Técnica', section: 'Evaluación', max_score: maximum })),
    scores: routines.filter(item => item.score !== undefined).map(item => row({ routine_id: item.id, judge_id: 'j1', criterion_id: 1, value: item.score })),
    penalties: [], feedback: [], specialAwards: [],
  };
  return data;
}

function reportRows(block) {
  return block.sections.flatMap(section => section.categories.flatMap(category => category.rows));
}

function close(actual, expected, context = '') {
  assert.equal(typeof actual, 'number', context);
  assert.ok(Math.abs(actual - expected) < 1e-10, `${context}: ${actual} differs from native Swift ${expected}`);
}

function compareSections(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((section, index) => {
    const wanted = expected[index];
    assert.equal(section.label, wanted.label);
    assert.equal(section.categories.length, wanted.categories.length);
    section.categories.forEach((category, categoryIndex) => {
      const wantedCategory = wanted.categories[categoryIndex];
      assert.equal(category.title, wantedCategory.title);
      assert.deepEqual(category.rows.map(item => item.routineId), wantedCategory.rows.map(item => item.routineId));
      category.rows.forEach((item, rowIndex) => {
        const wantedRow = wantedCategory.rows[rowIndex];
        close(item.score, wantedRow.score, item.routineId);
        assert.equal(item.placement.rank, wantedRow.rank);
        assert.equal(item.placement.label, wantedRow.label);
        assert.equal(item.placement.isFirstPlace, wantedRow.rank === 1);
        assert.equal(item.placement.isParticipation, wantedRow.rank === null);
      });
    });
  });
}

for (const example of native.engine) {
  test(`official score matches compiled Swift: ${example.name}`, () => {
    const evaluatorWeights = Object.fromEntries(example.judges.map((judge, index) => [`Juez ${index + 1}`, judge.weight]));
    const data = fixture([{ id: '1' }], {
      maximum: example.judges[0].maximumScore,
      scoring: { ...example.configuration, evaluator_weights: evaluatorWeights },
      judges: example.judges.map((_judge, index) => ({ judge_id: `j${index + 1}`, name: `Juez ${index + 1}`, role: 'judge' })),
    });
    data.scores = example.judges.flatMap((judge, index) => judge.subtotal > 0
      ? [row({ routine_id: '1', judge_id: `j${index + 1}`, criterion_id: 1, value: judge.subtotal })] : []);
    data.penalties = example.judges.map((judge, index) => row({ routine_id: '1', judge_id: `j${index + 1}`, value: judge.penalty }));
    const result = buildJudgingScoreSnapshot(data, at);
    close(reportRows(result.report.blocks[0])[0].score, example.expected.score, example.name);
    assert.equal(result.report.maximumScore, 150);
    assert.deepEqual(result.warnings, []);
  });
}

for (const example of native.grouping) {
  test(`Dictamen groups, order and placements match compiled Swift: ${example.name}`, () => {
    const result = buildJudgingScoreSnapshot(fixture(example.routines, { report: example.configuration }), at);
    assert.equal(result.report.blocks.length, 1);
    compareSections(result.report.blocks[0].sections, example.expected);
    assert.deepEqual(result.warnings, []);
  });
}

test('criterion and evaluator weighting compose before official normalization without altering the raw judge sheet', () => {
  const data = fixture([{ id: '1', score: 40 }], { maximum: 100,
    scoring: { criterion_weights: { tecnica: 2 }, evaluator_weights: { 'Juez 1': 2, 'Juez 2': 1 } },
    judges: [{ judge_id: 'j1', name: 'Juez 1', role: 'judge' }, { judge_id: 'j2', name: 'Juez 2', role: 'judge' }],
  });
  data.scores.push(row({ routine_id: '1', judge_id: 'j2', criterion_id: 1, value: 80 }));
  const result = buildJudgingScoreSnapshot(data, at);
  assert.equal(result.rows[0].judges[0].criteria[0].value, 40);
  assert.equal(result.rows[0].judges[0].subtotal, 80);
  assert.equal(result.rows[0].judges[0].maximumScore, 200);
  close(reportRows(result.report.blocks[0])[0].score, 80);
  data.event.competition_config.scoring.criterion_weights = { '1': 0 };
  const zeroWeighted = buildJudgingScoreSnapshot(data, at);
  assert.equal(zeroWeighted.rows[0].judges[0].maximumScore, 100, 'native falls back to the template maximum if all criterion weights are zero');
  assert.equal(reportRows(zeroWeighted.report.blocks[0])[0].score, 0);
});

test('Dictamen tie positions use its native entry-number order rather than the separate configured live-ranking tiebreakers', () => {
  const data = fixture([{ id: '2', score: 120 }, { id: '1', score: 120 }], {
    scoring: { tie_breakers: [{ kind: 'entry_number', direction: 'descending' }] },
  });
  const result = buildJudgingScoreSnapshot(data, at);
  assert.deepEqual(reportRows(result.report.blocks[0]).map(item => [item.routineId, item.placement.rank]), [['1', 1], ['2', 1]]);
});

test('legitimate incomplete sheets produce the native official score while retaining their incomplete state', () => {
  const data = fixture([{ id: '1', score: 90 }], { maximum: 100,
    judges: [{ judge_id: 'j1', name: 'Juez 1', role: 'judge' }, { judge_id: 'j2', name: 'Juez 2', role: 'judge' }] });
  const result = buildJudgingScoreSnapshot(data, at);
  assert.equal(result.rows[0].status, 'partial');
  close(reportRows(result.report.blocks[0])[0].score, 67.5, 'one missing judge contributes zero to the official denominator');
  assert.equal(result.report.blocks[0].counts.scored, 1);
  data.scores = [];
  const pending = buildJudgingScoreSnapshot(data, at);
  assert.equal(pending.rows[0].status, 'pending');
  assert.equal(reportRows(pending.report.blocks[0])[0].score, 0);
  assert.equal(pending.report.blocks[0].counts.scored, 0);
});

test('blocks rank independently and retain empty blocks, while active metadata and top-score visibility remain explicit', () => {
  const data = fixture([
    { id: '1', score: 125, block: 'Bloque 1' }, { id: '2', score: 110, block: 'Bloque 1' },
    { id: '3', score: 130, block: 'Bloque 2' }, { id: '4', score: 120, block: 'Bloque 2' },
  ]);
  data.blocks.push(row({ block_id: 'empty', name: 'Bloque vacío', title: 'Sin programa', is_active: false, sort_order: 2 }));
  let result = buildJudgingScoreSnapshot(data, at);
  assert.equal(result.report.blocks.length, 3);
  const first = result.report.blocks.find(block => block.name === 'Bloque 1');
  const second = result.report.blocks.find(block => block.name === 'Bloque 2');
  assert.deepEqual(reportRows(first).map(item => [item.routineId, item.placement.rank]), [['2', 2], ['1', 1]]);
  assert.deepEqual(reportRows(second).map(item => [item.routineId, item.placement.rank]), [['4', 2], ['3', 1]]);
  assert.deepEqual(first.topScore, { routineId: '1', score: 125 });
  assert.equal(first.isActive, true);
  const empty = result.report.blocks.find(block => block.id === 'empty');
  assert.deepEqual(empty.sections, []);
  assert.deepEqual(empty.counts, { disciplines: 0, categories: 0, scored: 0, total: 0 });
  assert.equal(empty.topScore, null);
  data.event.competition_config.result_report.show_top_score = false;
  result = buildJudgingScoreSnapshot(data, at);
  assert.ok(result.report.blocks.every(block => block.topScore === null));
});

test('invalid score or penalty data never receives a computed final score or a placement', () => {
  for (const corrupt of ['score', 'penalty', 'template']) {
    const data = fixture([{ id: '1', score: 120 }, { id: '2', score: 110 }, { id: '3', score: 100 }]);
    if (corrupt === 'score') data.scores.find(item => item.routine_id === '3').value = 151;
    if (corrupt === 'penalty') data.penalties.push(row({ routine_id: '3', judge_id: 'j1', value: 1 }));
    if (corrupt === 'template') data.routines.find(item => item.routine_id === '3').genre = 'Unknown genre';
    const result = buildJudgingScoreSnapshot(data, at);
    const entries = reportRows(result.report.blocks[0]);
    const invalid = entries.find(item => item.routineId === '3');
    assert.equal(invalid.score, null, corrupt);
    assert.equal(invalid.placement, null, corrupt);
    assert.equal(entries.find(item => item.routineId === '1').placement.rank, 1);
    assert.equal(entries.find(item => item.routineId === '2').placement.rank, 2, 'invalid data does not consume a rank');
    assert.equal(result.report.blocks[0].topScore.routineId, '1');
    assert.ok(result.warnings.length);
  }
});

test('special awards honor the selected event and block, configured titles, manual values and visibility', () => {
  const data = fixture([{ id: '1', score: 120, name: 'Vuelo', block: 'Bloque 1' }, { id: '2', score: 100, block: 'Bloque 2' }], {
    report: { title: 'Dictamen personalizado', subtitle: 'Final por bloque' },
  });
  data.event.competition_config.special_awards = [
    { category: 'award_1', title: 'Vestuario' }, { category: 'award_4', title: 'Porra' },
    { category: 'award_2', title: 'Oculto', is_enabled: false },
  ];
  data.specialAwards = [
    row({ block_id: 'block-1', award: 'award_1', routine_id: '1', manual_value: '' }),
    row({ block_id: 'block-1', award: 'award_4', routine_id: null, manual_value: 'Academia invitada' }),
    { event_id: 'foreign-event', block_id: 'block-1', award: 'award_1', routine_id: '2', manual_value: 'No debe aparecer' },
  ];
  let result = buildJudgingScoreSnapshot(data, at);
  assert.equal(result.report.title, 'Dictamen personalizado');
  assert.equal(result.report.subtitle, 'Final por bloque');
  assert.deepEqual(result.report.blocks[0].specialAwards, [
    { id: 'award_1', title: 'Vestuario', displayValue: '#1 Vuelo', isAssigned: true, routineId: '1' },
    { id: 'award_4', title: 'Porra', displayValue: 'Academia invitada', isAssigned: true, routineId: null },
  ]);
  assert.ok(result.report.blocks[1].specialAwards.every(award => !award.isAssigned));
  assert.doesNotMatch(JSON.stringify(result.report), /No debe aparecer|Oculto/);
  data.event.competition_config.result_report.showSpecialAwards = false;
  result = buildJudgingScoreSnapshot(data, at);
  assert.ok(result.report.blocks.every(block => block.specialAwards.length === 0));
});

test('report derivation preserves source registrations, order and private boundaries', () => {
  const data = fixture([{ id: '2', score: 90 }, { id: '1', score: 120 }]);
  data.event.private_key = 'PRIVATE-EVENT-KEY';
  data.judges[0].access_code = 'PRIVATE-JUDGE-CODE';
  const before = structuredClone(data);
  const result = buildJudgingScoreSnapshot(data, at);
  assert.deepEqual(data, before);
  assert.equal(result.fetchedAt, at);
  assert.deepEqual(result.rows.map(item => item.id), ['2', '1'], 'the raw sheet order remains separate from report display order');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-EVENT-KEY|PRIVATE-JUDGE-CODE|NaN|Infinity/);
});
