import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildJudgingScoreSnapshot } from '../worker/judging-score-data.js';

// Expected values were produced by compiling the native Swift sources, not by
// calling the JavaScript report code. The fixture records each source SHA-256.
// Swift is not needed to run this portable regression suite. The source fixtures
// retain grouping/order coverage. Numeric reports intentionally sum real judge
// totals instead of following the native normalized scoring configuration.
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
  assert.ok(Math.abs(actual - expected) < 1e-10, `${context}: ${actual} differs from expected ${expected}`);
}

function compareNativeGroupsAndScores(actual, expected) {
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
      });
    });
  });
}

for (const example of native.engine) {
  test(`real judge sums replace former normalization settings: ${example.name}`, () => {
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
    const expectedTotal = example.judges.reduce((sum, judge) => sum + (judge.subtotal > 0 ? Math.max(0, judge.subtotal + judge.penalty) : 0), 0);
    const maximum = example.judges.length * example.judges[0].maximumScore;
    close(reportRows(result.report.blocks[0])[0].score, expectedTotal, example.name);
    assert.equal(reportRows(result.report.blocks[0])[0].maximumScore, maximum);
    assert.equal(result.report.maximumScore, maximum);
    assert.deepEqual(result.warnings, []);
  });
}

for (const example of native.grouping) {
  test(`Dictamen retains native fixture groups and order with real scores: ${example.name}`, () => {
    const result = buildJudgingScoreSnapshot(fixture(example.routines, { report: example.configuration }), at);
    assert.equal(result.report.blocks.length, 1);
    compareNativeGroupsAndScores(result.report.blocks[0].sections, example.expected);
    assert.deepEqual(result.warnings, []);
  });
}

test('a solo category receives its score medal without an invented ranking place', () => {
  for (const [score, medal] of [[0, 'participacion'], [1, 'participacion'], [50, 'participacion'],
    [100, 'participacion'], [110, 'bronce'], [120, 'plata'], [130, 'oro'], [150, 'oro']]) {
    for (const useThresholds of [true, false]) {
      const result = buildJudgingScoreSnapshot(fixture([{ id: '1', score }], {
        report: { use_solo_placement_thresholds: useThresholds },
      }), at);
      const entry = reportRows(result.report.blocks[0])[0];
      close(entry.score, score);
      assert.equal(entry.medal, medal);
      assert.equal(entry.placement, null);
      assert.equal(entry.directCompetition, false);
      assert.equal(entry.eligibleCount, 1);
    }
  }
});

test('the announcer podium stops at third place while every competitor retains a score medal', () => {
  for (const configuredPositions of [0, 1, 2, 3, 4, 20, 100]) {
    const result = buildJudgingScoreSnapshot(fixture([
      { id: '1', score: 130 }, { id: '2', score: 120 }, { id: '3', score: 110 },
      { id: '4', score: 100 }, { id: '5', score: 90 },
    ], { report: { ranked_positions: configuredPositions } }), at);
    assert.deepEqual(reportRows(result.report.blocks[0]).map(entry => [entry.routineId, entry.placement]), [
      ['5', { rank: null, label: 'Sin lugar de podio', isFirstPlace: false, isParticipation: true }],
      ['4', { rank: null, label: 'Sin lugar de podio', isFirstPlace: false, isParticipation: true }],
      ['3', { rank: 3, label: '3.º lugar', isFirstPlace: false, isParticipation: false }],
      ['2', { rank: 2, label: '2.º lugar', isFirstPlace: false, isParticipation: false }],
      ['1', { rank: 1, label: '1.º lugar', isFirstPlace: true, isParticipation: false }],
    ]);
    assert.deepEqual(reportRows(result.report.blocks[0]).map(entry => entry.medal),
      ['participacion', 'participacion', 'bronce', 'plata', 'oro']);
    assert.ok(reportRows(result.report.blocks[0]).every(entry => entry.directCompetition && entry.eligibleCount === 5));
  }
});

test('each category retains an independent top-three podium and ascending score order inside its block', () => {
  const result = buildJudgingScoreSnapshot(fixture([
    { id: '1', score: 80, division: 'Teen' }, { id: '2', score: 90, division: 'Teen' },
    { id: '3', score: 100, division: 'Teen' }, { id: '4', score: 110, division: 'Teen' },
    { id: '5', score: 110, division: 'Baby' }, { id: '6', score: 120, division: 'Baby' },
    { id: '7', score: 130, division: 'Baby' }, { id: '8', score: 140, division: 'Baby' },
  ]), at);
  const categories = result.report.blocks[0].sections[0].categories;
  assert.equal(categories.length, 2);
  for (const category of categories) {
    assert.deepEqual(category.rows.map(entry => entry.placement.rank), [null, 3, 2, 1]);
    assert.equal(category.rows[0].placement.label, 'Sin lugar de podio');
    assert.deepEqual(category.rows.map(entry => entry.score), [...category.rows.map(entry => entry.score)].sort((a, b) => a - b));
  }
});

test('equal scores share competition ranks while ranks outside the top three have no podium place', () => {
  const result = buildJudgingScoreSnapshot(fixture([
    { id: '2', score: 130 }, { id: '1', score: 130 }, { id: '4', score: 120 },
    { id: '3', score: 120 }, { id: '5', score: 100 },
  ]), at);
  assert.deepEqual(reportRows(result.report.blocks[0]).map(entry => [entry.routineId, entry.placement.rank, entry.placement.label]), [
    ['5', null, 'Sin lugar de podio'], ['3', 3, '3.º lugar'], ['4', 3, '3.º lugar'], ['1', 1, '1.º lugar'], ['2', 1, '1.º lugar'],
  ]);
  assert.deepEqual(reportRows(result.report.blocks[0]).map(entry => entry.medal), ['participacion', 'plata', 'plata', 'oro', 'oro']);
});

test('a direct-competition winner can earn any medal and never upgrades the score medal by place', () => {
  for (const [score, medal] of [[90, 'participacion'], [110, 'bronce'], [120, 'plata'], [140, 'oro']]) {
    const result = buildJudgingScoreSnapshot(fixture([{ id: '1', score }, { id: '2', score: score - 1 }]), at);
    const winner = reportRows(result.report.blocks[0]).find(entry => entry.routineId === '1');
    assert.equal(winner.placement.rank, 1);
    assert.equal(winner.medal, medal);
    assert.equal(winner.directCompetition, true);
  }
});

test('medal thresholds follow the effective score scale without rounding across a boundary', () => {
  for (const maximum of [100, 150, 210]) {
    for (const [ratio, medal, below] of [[181 / 210, 'oro', 'plata'], [161 / 210, 'plata', 'bronce'], [141 / 210, 'bronce', 'participacion']]) {
      for (const [score, expected] of [[maximum * ratio, medal], [maximum * ratio - 1e-7, below]]) {
        const result = buildJudgingScoreSnapshot(fixture([{ id: '1', score }], { maximum }), at);
        const entry = reportRows(result.report.blocks[0])[0];
        assert.equal(entry.medal, expected, `${score}/${maximum}`);
        assert.equal(entry.placement, null);
      }
    }
  }
});

test('no-note pending routines receive no invented places while explicitly recorded zero scores remain eligible', () => {
  const data = fixture([{ id: '1' }, { id: '2', score: 0 }]);
  let result = buildJudgingScoreSnapshot(data, at);
  const entries = new Map(reportRows(result.report.blocks[0]).map(entry => [entry.routineId, entry]));
  assert.equal(result.rows.find(entry => entry.id === '1').status, 'pending');
  assert.equal(entries.get('1').score, 0);
  assert.equal(entries.get('1').placement, null);
  assert.equal(entries.get('1').medal, null);
  assert.equal(result.rows.find(entry => entry.id === '2').status, 'complete');
  assert.equal(entries.get('2').score, 0);
  assert.equal(entries.get('2').placement.rank, 1);
  assert.equal(entries.get('2').medal, 'participacion');
  data.scores = [];
  result = buildJudgingScoreSnapshot(data, at);
  assert.ok(reportRows(result.report.blocks[0]).every(entry => entry.score === 0 && entry.placement === null && entry.medal === null));
});

test('criterion weights remain in judge totals but evaluator weights never multiply the final real sum', () => {
  const data = fixture([{ id: '1', score: 40 }], { maximum: 100,
    scoring: { criterion_weights: { tecnica: 2 }, evaluator_weights: { 'Juez 1': 2, 'Juez 2': 1 } },
    judges: [{ judge_id: 'j1', name: 'Juez 1', role: 'judge' }, { judge_id: 'j2', name: 'Juez 2', role: 'judge' }],
  });
  data.scores.push(row({ routine_id: '1', judge_id: 'j2', criterion_id: 1, value: 80 }));
  const result = buildJudgingScoreSnapshot(data, at);
  assert.equal(result.rows[0].judges[0].criteria[0].value, 40);
  assert.equal(result.rows[0].judges[0].subtotal, 80);
  assert.equal(result.rows[0].judges[0].maximumScore, 200);
  close(reportRows(result.report.blocks[0])[0].score, 240);
  assert.equal(reportRows(result.report.blocks[0])[0].maximumScore, 400);
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

test('legitimate incomplete sheets expose the recorded sum while retaining their incomplete state', () => {
  const data = fixture([{ id: '1', score: 90 }], { maximum: 100,
    judges: [{ judge_id: 'j1', name: 'Juez 1', role: 'judge' }, { judge_id: 'j2', name: 'Juez 2', role: 'judge' }] });
  const result = buildJudgingScoreSnapshot(data, at);
  assert.equal(result.rows[0].status, 'partial');
  close(reportRows(result.report.blocks[0])[0].score, 90, 'a pending judge adds no points and never divides the recorded total');
  assert.equal(reportRows(result.report.blocks[0])[0].maximumScore, 200);
  assert.equal(reportRows(result.report.blocks[0])[0].placement, null, 'a partial result does not invent direct competition');
  assert.equal(reportRows(result.report.blocks[0])[0].medal, 'participacion', 'a valid partial result retains its medal against the whole jury maximum');
  assert.equal(result.report.blocks[0].counts.scored, 1);
  data.scores = [];
  const pending = buildJudgingScoreSnapshot(data, at);
  assert.equal(pending.rows[0].status, 'pending');
  assert.equal(reportRows(pending.report.blocks[0])[0].score, 0);
  assert.equal(reportRows(pending.report.blocks[0])[0].placement, null);
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
    assert.equal(invalid.medal, null, corrupt);
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
    { id: 'award_1', title: 'Vestuario', displayValue: 'Vuelo', isAssigned: true, routineId: '1' },
    { id: 'award_4', title: 'Porra', displayValue: 'Academia invitada', isAssigned: true, routineId: null },
  ]);
  assert.ok(result.report.blocks[1].specialAwards.every(award => !award.isAssigned));
  assert.doesNotMatch(result.report.blocks[0].specialAwards[0].displayValue, /#1/);
  assert.doesNotMatch(JSON.stringify(result.report), /No debe aparecer|Oculto/);
  data.specialAwards.find(award => award.event_id === eventId && award.award === 'award_4').manual_value = 'Academia 25';
  assert.equal(buildJudgingScoreSnapshot(data, at).report.blocks[0].specialAwards.find(award => award.id === 'award_4').displayValue,
    'Academia 25', 'intentional numbers in a manual award label remain intact');
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

test('the screenshot totals 19 and 43 remain the real sum with a 210-point jury maximum and penalties counted once', () => {
  for (const scoring of [{}, { aggregation: 'average', official_missing_score_policy: 'ignore',
    include_penalties: false, drop_highest_count: 1, evaluator_weights: { 'Juez 1': 4 } }]) {
    const data = fixture([{ id: '1', score: 19 }, { id: '2', score: 45 }], { maximum: 70, scoring,
      judges: [1, 2, 3].map(index => ({ judge_id: `j${index}`, name: `Juez ${index}`, role: 'judge' })) });
    data.penalties = [row({ routine_id: '2', judge_id: 'j1', value: -2 })];
    const result = buildJudgingScoreSnapshot(data, at);
    const entries = new Map(reportRows(result.report.blocks[0]).map(entry => [entry.routineId, entry]));
    assert.equal(result.rows[1].judges[0].subtotal, 45);
    assert.equal(result.rows[1].judges[0].total, 43);
    assert.equal(entries.get('1').score, 19);
    assert.equal(entries.get('2').score, 43);
    assert.equal(entries.get('1').maximumScore, 210);
    assert.equal(entries.get('2').maximumScore, 210);
    assert.equal(result.report.maximumScore, 210);
    assert.equal(result.rows[0].status, 'partial');
  }
});

test('a complete three-judge jury awards the exact 181/161/141 medal thresholds on the real 210-point scale', () => {
  const totals = [[61, 60, 60], [54, 54, 53], [47, 47, 47], [46, 47, 47]];
  const data = fixture(totals.map((scores, index) => ({ id: String(index + 1), score: scores[0] })), {
    maximum: 70, judges: [1, 2, 3].map(index => ({ judge_id: `j${index}`, name: `Juez ${index}`, role: 'judge' })),
  });
  totals.forEach((scores, index) => scores.slice(1).forEach((value, judge) =>
    data.scores.push(row({ routine_id: String(index + 1), judge_id: `j${judge + 2}`, criterion_id: 1, value }))));
  const result = buildJudgingScoreSnapshot(data, at);
  const entries = new Map(reportRows(result.report.blocks[0]).map(entry => [entry.routineId, entry]));
  assert.deepEqual(['1', '2', '3', '4'].map(id => [entries.get(id).score, entries.get(id).medal]),
    [[181, 'oro'], [161, 'plata'], [141, 'bronce'], [140, 'participacion']]);
  assert.ok([...entries.values()].every(entry => entry.maximumScore === 210));
  assert.equal(entries.get('1').placement.rank, 1);
  assert.equal(entries.get('4').placement.rank, null);
});

test('each standing retains its real maximum in a mixed-scale event and unknown scales stay null', () => {
  const data = fixture([{ id: '1', score: 19, genre: 'Jazz' }, { id: '2', score: 14, genre: 'Aro' }], {
    maximum: 70, judges: [1, 2, 3].map(index => ({ judge_id: `j${index}`, name: `Juez ${index}`, role: 'judge' })),
  });
  data.templates[1].max_score = 15; data.criteria[1].max_score = 15;
  let result = buildJudgingScoreSnapshot(data, at);
  let entries = new Map(reportRows(result.report.blocks[0]).map(entry => [entry.routineId, entry]));
  assert.equal(entries.get('1').maximumScore, 210); assert.equal(entries.get('2').maximumScore, 45);
  assert.equal(result.report.maximumScore, 210);
  data.routines[1].genre = 'Unknown template';
  result = buildJudgingScoreSnapshot(data, at);
  entries = new Map(reportRows(result.report.blocks[0]).map(entry => [entry.routineId, entry]));
  assert.equal(entries.get('2').maximumScore, null); assert.equal(entries.get('2').score, null);
  assert.equal(entries.get('2').medal, null);
  assert.equal(buildJudgingScoreSnapshot(fixture([]), at).report.maximumScore, 1, 'an empty event has only a non-publishable fallback');
});
