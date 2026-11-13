import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJudgingScoreSnapshot } from '../worker/judging-score-data.js';
import { releveVotingCandidates } from '../shared/releve-voting-catalog.js';
import { deriveReleveVotingResult, releveJudgingEventId, releveCompetitionPollId } from '../worker/releve-competition.js';

const finalBlockId = 'bloque-7-aerial-seniors-releve';
const awardId = 'champion_of_champions';
const firstCandidate = releveVotingCandidates.find(candidate => candidate.id === 'estrella-mistica');

function fixture(entries = [
  { id: '1', block: 'first', score: 149 },
  { id: '2', block: 'middle', score: 140 },
  { id: '3', block: finalBlockId, score: 130 },
], eventId = releveJudgingEventId) {
  const scoped = fields => ({ event_id: eventId, ...fields });
  const genres = [...new Set(entries.map(entry => entry.genre || 'Jazz'))];
  return {
    event: { id: eventId, name: 'Estado de México', competition_config: {} },
    // Deliberately unsorted: the imported program order decides the last block.
    blocks: [scoped({ block_id: finalBlockId, name: 'Bloque 7', sort_order: 7 }),
      scoped({ block_id: 'first', name: 'Bloque 1', sort_order: 1 }),
      scoped({ block_id: 'middle', name: 'Bloque 4', sort_order: 4 })],
    routines: entries.map(entry => scoped({ routine_id: entry.id, program_number: `P-${entry.id}`,
      name: entry.name || `Rutina ${entry.id}`, academy: entry.academy || `Academia ${entry.id}`,
      genre: entry.genre || 'Jazz', division: entry.division || 'Teen', level: entry.level || 'Intermedio',
      category: entry.category || 'Solo', block_id: entry.block,
      block: entry.block === finalBlockId ? 'Bloque 7' : entry.block === 'first' ? 'Bloque 1' : 'Bloque 4' })),
    judges: [scoped({ judge_id: 'j1', name: 'Juez 1', role: 'judge' })],
    templates: genres.map((genre, index) => scoped({ template_id: `t${index}`, genre, max_score: 150 })),
    criteria: genres.map((_, index) => scoped({ template_id: `t${index}`, criterion_id: 1, label: 'Evaluación', max_score: 150 })),
    scores: entries.filter(entry => entry.score !== undefined).map(entry => scoped({ routine_id: entry.id, judge_id: 'j1', criterion_id: 1, value: entry.score })),
    penalties: [], feedback: [], specialAwards: [],
  };
}

function snapshot(data, completeEvent = true) {
  return buildJudgingScoreSnapshot(data, '2026-11-13T18:00:00Z', { completeEvent });
}
const award = report => report.blocks.flatMap(block => block.specialAwards).find(item => item.id === awardId);

function releveEntry(fields = {}) {
  return { id: '232', block: finalBlockId, score: 150, genre: 'TELA', division: 'RELEVÉ', category: 'RELEVÉ',
    name: firstCandidate.choreography, academy: firstCandidate.academy, ...fields };
}

test('the automatic champion uses the highest general score across all blocks and appears just before Mejor porra in the final block', () => {
  const result = snapshot(fixture());
  const final = result.report.blocks.find(block => block.id === finalBlockId);
  assert.deepEqual(result.report.blocks.map(block => block.id), ['first', 'middle', finalBlockId]);
  assert.equal(result.report.blocks.flatMap(block => block.specialAwards).filter(item => item.id === awardId).length, 1);
  assert.equal(final.specialAwards.at(-2).id, awardId);
  assert.equal(final.specialAwards.at(-1).id, 'award_4');
  assert.equal(award(result.report).routineId, '1');
  assert.equal(award(result.report).isAssigned, true);
  assert.match(award(result.report).displayValue, /Rutina 1.*Academia 1.*149 puntos/);
  assert.doesNotMatch(award(result.report).displayValue, /P-1|#1/);
  assert.ok(result.report.blocks.filter(block => block.id !== finalBlockId).every(block => !block.specialAwards.some(item => item.id === awardId)));
});

test('Relevé has an explicit separate section after ordinary genres, including labels that sort later alphabetically', () => {
  const result = snapshot(fixture([
    { id: '1', block: finalBlockId, score: 145, genre: 'Zumba' },
    { id: '2', block: finalBlockId, score: 140, genre: 'Tela' },
    releveEntry(),
  ]));
  const sections = result.report.blocks.find(block => block.id === finalBlockId).sections;
  assert.deepEqual(sections.map(section => section.kind), ['competition', 'competition', 'releve']);
  assert.equal(sections.at(-1).label, 'RELEVÉ');
  assert.deepEqual(sections.at(-1).categories.flatMap(category => category.rows.map(row => row.routineId)), ['232']);
  assert.ok(sections.slice(0, -1).every(section => section.categories.every(category => category.rows.every(row => row.routineId !== '232'))));
});

test('Relevé final 155 points and its public bonus never compete for the general champion', () => {
  const data = fixture([{ id: '1', block: 'first', score: 149 }, { id: '3', block: finalBlockId, score: 130 }, releveEntry()]);
  data.releveVoting = deriveReleveVotingResult([{ id: releveCompetitionPollId, event_id: 'edomex-2026-otono', status: 'closed',
    revision: 2, opened_at: '2026-11-15T18:00:00Z', closed_at: '2026-11-15T18:15:00Z', candidate_id: 'estrella-mistica', votes: 5 }]);
  const result = snapshot(data);
  const releve = result.report.blocks.find(block => block.id === finalBlockId).sections.at(-1).categories[0].rows[0];
  assert.equal(releve.score, 155);
  assert.equal(award(result.report).routineId, '1');
  assert.match(award(result.report).displayValue, /149 puntos/);
  assert.deepEqual(result.report.blocks.find(block => block.id === finalBlockId).topScore, { routineId: '3', score: 130 },
    'the general block award excludes the separate Relevé podium');
});

test('a Relevé-only block has no generic top-score award', () => {
  const data = fixture([releveEntry()]);
  data.releveVoting = deriveReleveVotingResult([{ id: releveCompetitionPollId, event_id: 'edomex-2026-otono', status: 'closed',
    revision: 2, opened_at: '2026-11-15T18:00:00Z', closed_at: '2026-11-15T18:15:00Z', candidate_id: 'estrella-mistica', votes: 5 }]);
  const finalBlock = snapshot(data).report.blocks.find(block => block.id === finalBlockId);
  assert.equal(finalBlock.sections[0].categories[0].rows[0].score, 155);
  assert.equal(finalBlock.topScore, null);
});

test('pending or malformed Relevé entries stay separate and cannot block the complete general champion', () => {
  for (const fields of [{ score: undefined }, { score: 151 }, { name: 'Identidad Relevé sin verificar' }]) {
    const result = snapshot(fixture([{ id: '1', block: 'first', score: 149 }, releveEntry(fields)]));
    assert.equal(award(result.report).isAssigned, true);
    assert.equal(award(result.report).routineId, '1');
    assert.equal(result.report.blocks.find(block => block.id === finalBlockId).sections.at(-1).kind, 'releve');
  }
  for (const field of ['division', 'category', 'genre']) {
    const entry = { id: '9', block: finalBlockId, score: undefined, [field]: 'relevé' };
    const result = snapshot(fixture([{ id: '1', block: 'first', score: 149 }, entry]));
    assert.equal(award(result.report).routineId, '1', `Relevé classification by ${field}`);
    assert.equal(result.report.blocks.find(block => block.id === finalBlockId).sections.at(-1).kind, 'releve');
  }
});

test('a general result must be complete and valid before a global champion can be announced', () => {
  for (const score of [undefined, 151, -1, NaN]) {
    const result = snapshot(fixture([{ id: '1', block: 'first', score: 149 }, { id: '2', block: finalBlockId, score }]));
    assert.equal(award(result.report).isAssigned, false, String(score));
    assert.equal(award(result.report).routineId, null);
    assert.match(award(result.report).displayValue, /Pendiente/);
  }
  const partial = fixture();
  partial.judges.push({ event_id: releveJudgingEventId, judge_id: 'j2', name: 'Juez 2', role: 'judge' });
  assert.equal(award(snapshot(partial).report).isAssigned, false);
});

test('equal maxima retain all co-champions rather than selecting one routine arbitrarily', () => {
  const result = snapshot(fixture([{ id: '2', block: 'first', score: 149 }, { id: '1', block: finalBlockId, score: 149 }]));
  const champion = award(result.report);
  assert.equal(champion.isAssigned, true);
  assert.equal(champion.routineId, null);
  assert.match(champion.displayValue, /^Empate: .*Rutina 1.*Rutina 2.*149 puntos/);
});

test('block-limited and unrelated-event snapshots never announce a global Estado de México champion', () => {
  const data = fixture();
  assert.equal(award(snapshot(data, false).report), undefined);
  assert.equal(award(buildJudgingScoreSnapshot(data).report), undefined);
  assert.equal(award(snapshot(fixture(undefined, '11111111-2222-4333-8444-555555555555')).report), undefined);
  const droppedRoutine = fixture(); droppedRoutine.routines.push({ ...droppedRoutine.routines[0] });
  assert.equal(award(snapshot(droppedRoutine).report), undefined, 'dropped routine identities invalidate event completeness');
});

test('an orphan row cannot redirect the award from the last configured block', () => {
  const data = fixture();
  data.routines.push({ ...data.routines[0], routine_id: '9', block_id: 'orphan', block: 'Bloque sin configurar' });
  data.scores.push({ ...data.scores[0], routine_id: '9', value: 130 });
  const result = snapshot(data);
  assert.ok(result.report.blocks.find(block => block.id === finalBlockId).specialAwards.some(item => item.id === awardId));
  assert.ok(!result.report.blocks.find(block => block.id === 'orphan').specialAwards.some(item => item.id === awardId));
});

test('a stale manual champion assignment cannot replace the automatically calculated event winner', () => {
  const data = fixture();
  data.event.competition_config.special_awards = [{ category: awardId, title: 'Ganador manual' }, { category: 'bestPorra', title: 'Mejor porra' }];
  data.specialAwards.push({ event_id: releveJudgingEventId, block_id: 'first', award: awardId, routine_id: '3', manual_value: 'Ganador equivocado' });
  const result = snapshot(data);
  assert.equal(result.report.blocks.flatMap(block => block.specialAwards).filter(item => item.id === awardId).length, 1);
  assert.equal(award(result.report).routineId, '1');
  assert.match(award(result.report).displayValue, /Rutina 1/);
  assert.doesNotMatch(award(result.report).displayValue, /Ganador equivocado/);
});

test('every block announces music, costume and choreographic idea in fixed order with porra last', () => {
  for (const eventId of [releveJudgingEventId, '11111111-2222-4333-8444-555555555555']) {
    for (const ids of [['award_4', 'award_2', 'award_1', 'award_3'], ['award_2', 'award_4', 'award_3', 'award_1'],
      ['award_9', 'award_3', 'award_4', 'award_2']]) {
      const data = fixture(undefined, eventId);
      data.event.competition_config.special_awards = ids.map(category => ({ category, title: category === 'award_4' ? 'Mejor porra' : category }));
      const result = snapshot(data);
      for (const block of result.report.blocks) {
        const priority = { award_2: 0, award_1: 1, award_3: 2 };
        const ordinary = ids.filter(id => id !== 'award_4').sort((left, right) => (priority[left] ?? 3) - (priority[right] ?? 3));
        const expected = eventId === releveJudgingEventId && block.id === finalBlockId
          ? [...ordinary, awardId, 'award_4'] : [...ordinary, 'award_4'];
        assert.deepEqual(block.specialAwards.map(award => award.id), expected, `${eventId}/${block.id}/${ids}`);
      }
    }
  }
});

test('porra aliases normalize and deduplicate before applying the final-award order', () => {
  for (const category of ['porra', 'bestPorra', 'Mejor Porra', 'Espíritu de equipo', 'premio4', 'specialaward4', 'slot4', 'award_4']) {
    const data = fixture();
    data.event.competition_config.specialAwards = [
      { category, title: 'Mejor porra' },
      { category: 'bestMusic', title: 'Mejor música' },
      { category: 'mejorPorra', title: 'Porra duplicada' },
      { category: 'award_1', title: 'Mejor vestuario' },
    ];
    data.specialAwards = [{ event_id: releveJudgingEventId, block_id: finalBlockId, award: category, manual_value: 'Academia Porra' }];
    const result = snapshot(data);
    for (const block of result.report.blocks) {
      assert.equal(block.specialAwards.filter(award => award.id === 'award_4').length, 1, category);
      assert.equal(block.specialAwards.at(-1).id, 'award_4', category);
      assert.deepEqual(block.specialAwards.slice(0, 2).map(award => award.id), ['award_2', 'award_1']);
      assert.equal(block.specialAwards.at(-1).title, 'Mejor porra');
    }
    const final = result.report.blocks.find(block => block.id === finalBlockId);
    assert.equal(final.specialAwards.at(-2).id, awardId);
    assert.equal(final.specialAwards.at(-1).displayValue, 'Academia Porra', category);
  }
});

test('an omitted or disabled porra is never invented by the ceremony ordering', () => {
  for (const slots of [[], [{ category: 'award_1', title: 'Mejor vestuario' }],
    [{ category: 'porra', title: 'Mejor porra', is_enabled: false }, { category: 'award_2', title: 'Mejor música' }],
    [{ category: 'bestPorra', title: 'Mejor porra', isEnabled: false }, { category: 'award_3', title: 'Mejor idea' }]]) {
    const data = fixture();
    data.event.competition_config.special_awards = slots;
    const result = snapshot(data);
    assert.ok(result.report.blocks.every(block => block.specialAwards.every(award => award.id !== 'award_4')));
    const final = result.report.blocks.find(block => block.id === finalBlockId);
    assert.equal(final.specialAwards.at(-1).id, awardId);
  }
});

test('the public favorite uses the verified closed poll winner without presentation numbers', () => {
  const data = fixture([{ id: '1', block: 'first', score: 149 }, releveEntry()]);
  data.releveVoting = deriveReleveVotingResult([{ id: releveCompetitionPollId, event_id: 'edomex-2026-otono', status: 'closed',
    revision: 2, opened_at: '2026-11-15T18:00:00Z', closed_at: '2026-11-15T18:15:00Z', candidate_id: 'estrella-mistica', votes: 5 }]);
  const report = snapshot(data).report;
  assert.equal(report.blocks.find(block => block.id === 'first').releveAudienceFavorite, undefined);
  const favorite = report.blocks.find(block => block.id === finalBlockId).releveAudienceFavorite;
  assert.deepEqual(favorite, { status: 'ready', winner: {
    routineId: '232', name: firstCandidate.choreography, academy: firstCandidate.academy, votes: 5,
  } });
  assert.doesNotMatch(JSON.stringify(favorite), /programNumber|P-232|#232/);
});

test('open, tied, empty and unverifiable public polls never invent an audience favorite', () => {
  const poll = { id: releveCompetitionPollId, event_id: 'edomex-2026-otono', status: 'closed', revision: 2,
    opened_at: '2026-11-15T18:00:00Z', closed_at: '2026-11-15T18:15:00Z' };
  for (const [rows, status] of [
    [[{ ...poll, status: 'open', candidate_id: 'estrella-mistica', votes: 5 }], 'pending'],
    [[{ ...poll, candidate_id: 'estrella-mistica', votes: 5 }, { ...poll, candidate_id: 'hazel', votes: 5 }], 'tie'],
    [[{ ...poll, candidate_id: null, votes: 0 }], 'none'],
    [[], 'pending'],
  ]) {
    const data = fixture([releveEntry()]); data.releveVoting = deriveReleveVotingResult(rows);
    assert.deepEqual(snapshot(data).report.blocks.find(block => block.id === finalBlockId).releveAudienceFavorite, { status, winner: null });
  }
  const invalid = fixture([releveEntry({ name: 'Unverified identity' })]);
  invalid.releveVoting = deriveReleveVotingResult([{ ...poll, candidate_id: 'estrella-mistica', votes: 5 }]);
  assert.deepEqual(snapshot(invalid).report.blocks.find(block => block.id === finalBlockId).releveAudienceFavorite,
    { status: 'pending', winner: null });
});

test('champion announcement rounds only its display while retaining the precise winning score', () => {
  const result = snapshot(fixture([{ id: '1', block: 'first', score: 149.1 }, { id: '2', block: finalBlockId, score: 149.4 }]));
  const champion = award(result.report);
  assert.equal(champion.routineId, '2');
  assert.match(champion.displayValue, /149 puntos$/);
  assert.doesNotMatch(champion.displayValue, /149[.,][14]|P-2|#2/);
});

test('the champion uses complete real 210-point general totals and excludes the separate 50-point Relevé result', () => {
  const data = fixture([{ id: '1', block: 'first', score: 70 }, { id: '2', block: finalBlockId, score: 69 }, releveEntry({ score: 15 })]);
  data.judges = [1, 2, 3].map(index => ({ event_id: releveJudgingEventId, judge_id: `j${index}`, name: `Juez ${index}`, role: 'judge' }));
  data.templates.forEach(template => { template.max_score = template.genre === 'TELA' ? 15 : 70; });
  data.criteria.forEach(criterion => { criterion.max_score = criterion.template_id === 't1' ? 15 : 70; });
  for (const routine of data.routines) for (const judge_id of ['j2', 'j3']) {
    const value = routine.routine_id === '232' ? 15 : routine.routine_id === '1' ? 70 : 69;
    data.scores.push({ event_id: releveJudgingEventId, routine_id: routine.routine_id, judge_id, criterion_id: 1, value });
  }
  data.releveVoting = deriveReleveVotingResult([{ id: releveCompetitionPollId, event_id: 'edomex-2026-otono', status: 'closed',
    revision: 2, opened_at: '2026-11-15T18:00:00Z', closed_at: '2026-11-15T18:15:00Z', candidate_id: 'estrella-mistica', votes: 5 }]);
  const result = snapshot(data);
  assert.equal(award(result.report).routineId, '1'); assert.match(award(result.report).displayValue, /210 puntos$/);
  assert.equal(result.report.maximumScore, 210);
  const final = result.report.blocks.find(block => block.id === finalBlockId);
  const releve = final.sections.find(section => section.kind === 'releve').categories[0].rows[0];
  assert.equal(releve.juryScore, 45); assert.equal(releve.score, 50); assert.equal(releve.maximumScore, 50);
  assert.equal(final.topScore.score, 207);
});
