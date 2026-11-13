import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { buildJudgingScoreSnapshot } from '../worker/judging-score-data.js';
import {
  getBlockPublication, saveBlockPublicationMode, closeParticipantBlock, reopenParticipantBlock,
  createBlockPublicationGate, blockAllowsRoutine,
} from '../worker/participant-block-publication.js';

const schema = await readFile(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/registration_participant_block_publication.sql', import.meta.url), 'utf8');
const completionMigration = await readFile(new URL('../db/registration_participant_block_completion.sql', import.meta.url), 'utf8');
const eventId = 'edomex-publication-test', sourceId = '11111111-2222-4333-8444-555555555555';
const otherSourceId = '99999999-2222-4333-8444-555555555555';

class D1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.queries = []; this.beforeBatch = null; this.failBatchAt = null; }
  prepare(sql) {
    assert.doesNotMatch(sql, /^\s*(CREATE|DROP|ALTER|PRAGMA)\b/i, 'HTTP operations must not create the schema');
    this.queries.push(sql);
    const statement = this.sqlite.prepare(sql); let args = [];
    const query = {
      bind(...values) { assert.ok(values.length <= 100); args = values; return query; },
      async first() { const row = statement.get(...args); return row ? { ...row } : null; },
      async all() { return { results: statement.all(...args).map(row => ({ ...row })) }; },
      sync() { const result = statement.run(...args); return { success: true, meta: { changes: result.changes } }; },
      async run() { return query.sync(); },
    };
    return query;
  }
  async batch(statements) {
    const before = this.beforeBatch; this.beforeBatch = null;
    if (before) await before();
    this.sqlite.exec('BEGIN');
    try {
      const result = [];
      for (const [index, statement] of statements.entries()) {
        if (index === this.failBatchAt) throw new Error('Simulated atomic failure');
        result.push(statement.sync());
      }
      this.sqlite.exec('COMMIT'); return result;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}

async function fixture(t, { linked = true } = {}) {
  const db = new D1(); t.after(() => db.sqlite.close());
  db.sqlite.exec(schema); db.sqlite.exec(migration); db.sqlite.exec('PRAGMA foreign_keys=ON');
  db.sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES('academy','Academia','Responsable','test@example.test');
    INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,email_confirmed_at)
      VALUES('admin','academy','Administrador','admin','admin@example.test','unused-test-hash','admin',datetime('now'));
    INSERT INTO participant_portal_events(id,title,season,venue,published) VALUES('${eventId}','Edición de prueba','Otoño','edomex',0);
    INSERT INTO registration_participants(id,academy_id,full_name,curp,division,shirt_size)
      VALUES('person','academy','Persona de prueba','TEST-PRIVATE-IDENTITY','junior','s');
    INSERT INTO participant_portal_access(id,participant_id,event_id,token_hash) VALUES('existing-qr','person','${eventId}','unchanged-existing-hash');`);
  for (let index = 1; index <= 3; index++) {
    db.sqlite.prepare(`INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue)
      VALUES(?,'academy',?,'aereo','tela','solo','intermedio','edomex')`).run(`dance-${index}`, `Coreografía ${index}`);
    db.sqlite.prepare(`INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id,photos_published)
      VALUES(?,?,?, ?,?,?)`).run(`portal-${index}`, eventId, `dance-${index}`, sourceId, String(index), index === 1 ? 1 : 0);
  }
  db.sqlite.exec(`INSERT INTO participant_portal_assets(id,event_id,routine_id,kind,object_key,file_name,content_type,sha256,byte_size,published)
    VALUES('photo','${eventId}','portal-1','photo','unchanged-photo','photo.jpg','image/jpeg','unchanged-photo-hash',100,1)`);
  if (linked) db.sqlite.prepare('INSERT INTO participant_portal_judging_sources(event_id,source_event_id,enabled) VALUES(?,?,1)').run(eventId, sourceId);
  const row = value => ({ event_id: sourceId, ...value });
  const input = {
    event: { id: sourceId, name: 'Jueceo de prueba', source_name: 'Programa', is_active: false, competition_config: {} },
    blocks: [row({ block_id: 'block-1', name: 'Bloque 1', title: '', sort_order: 1, is_active: false }), row({ block_id: 'block-2', name: 'Bloque 2', title: '', sort_order: 2, is_active: false })],
    routines: [1, 2, 3].map(index => row({ routine_id: String(index), block_id: index <= 2 ? 'block-1' : 'block-2', block: index <= 2 ? 'Bloque 1' : 'Bloque 2',
      name: `Coreografía ${index}`, academy: 'Academia', genre: 'TELA', division: 'Junior', category: 'Solo', level: 'Intermedio', sort_order: index })),
    judges: [1, 2].map(index => row({ judge_id: `judge-${index}`, name: `Juez ${index}`, role: 'judge', assigned_block_ids: ['block-1', 'block-2'] })),
    templates: [row({ template_id: 'tela', genre: 'TELA', title: 'Tela', max_score: 10 })],
    criteria: [row({ template_id: 'tela', criterion_id: 1, label: 'Técnica', section: '', max_score: 10, sort_order: 1 })],
    scores: [1, 2, 3].flatMap(index => [1, 2].map(judge => row({ routine_id: String(index), judge_id: `judge-${judge}`, criterion_id: 1, value: index + 4 }))),
    penalties: [], feedback: [], specialAwards: [],
  };
  const snapshot = () => ({ ...buildJudgingScoreSnapshot(input), resultScope: { complete: true, eventId: sourceId, blockIds: input.blocks.map(block => block.block_id) },
    publicationContext: { competitionConfig: structuredClone(input.event.competition_config) } });
  const calls = [];
  const providers = {
    getDirectory: async (...args) => { calls.push(['directory', ...args]); return { event: { id: sourceId }, blocks: input.blocks.map(block => ({ id: block.block_id, name: block.name,
      routineIds: input.routines.filter(routine => routine.block_id === block.block_id).map(routine => routine.routine_id) })) }; },
    getSnapshot: async (...args) => { calls.push(['snapshot', ...args]); return snapshot(); },
  };
  const view = (blockId = 'block-1', overrides = {}) => getBlockPublication({ db, eventId, blockId, ...providers, ...overrides });
  const mode = value => saveBlockPublicationMode({ db, input: { eventId, mode: value }, actorId: 'admin' });
  const close = (input = {}, overrides = {}) => closeParticipantBlock({ db, input: { eventId, blockId: 'block-1', ...input }, actorId: 'admin', ...providers, ...overrides });
  const reopen = (blockId = 'block-1') => reopenParticipantBlock({ db, input: { eventId, blockId }, actorId: 'admin' });
  const rows = table => db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(row => ({ ...row }));
  const allows = (routine = {}, current = snapshot()) => blockAllowsRoutine({ db, eventId, sourceEventId: sourceId, sourceRoutineId: '1', danceId: 'dance-1', snapshot: current, ...routine });
  return { db, input, snapshot, calls, providers, view, mode, close, reopen, rows, allows };
}

test('a block release matches full-event and scoped reads with different global maxima', async t => {
  const f = await fixture(t);
  await f.mode('block_close');
  const current = f.snapshot();
  for (const block of current.report.blocks) for (const section of block.sections) for (const category of section.categories) {
    for (const entry of category.rows) entry.maximumScore = 20;
  }
  current.report.maximumScore = 210;
  await f.close({}, { getSnapshot: async () => current });
  const scoped = structuredClone(current);
  scoped.report.maximumScore = 20;
  scoped.rows = scoped.rows.filter(row => row.blockId === 'block-1');
  scoped.report.blocks = scoped.report.blocks.filter(block => block.id === 'block-1');
  scoped.resultScope.blockIds = ['block-1'];
  assert.equal(await f.allows({}, scoped), true);
  const invalid = structuredClone(scoped);
  invalid.report.blocks[0].sections[0].categories[0].rows[0].maximumScore = null;
  assert.equal(await f.allows({}, invalid), false, 'an explicitly unknown routine scale cannot inherit the event maximum');
});

test('legacy editions default to individual mode and can opt in before linking the programme', async t => {
  const f = await fixture(t, { linked: false });
  assert.deepEqual(await f.view(), { mode: 'individual', sourceEventId: '', blocks: [], selectedBlock: null });
  assert.equal(await f.allows(), true);
  const before = [f.rows('participant_portal_events'), f.rows('participant_portal_access'), f.rows('participant_portal_assets')];
  assert.deepEqual(await f.mode('block_close'), { mode: 'block_close', sourceEventId: '' });
  assert.deepEqual(await f.view(), { mode: 'block_close', sourceEventId: '', blocks: [], selectedBlock: null });
  assert.equal(await f.allows(), false);
  assert.equal(f.calls.length, 0);
  assert.deepEqual([f.rows('participant_portal_events'), f.rows('participant_portal_access'), f.rows('participant_portal_assets')], before);
  await assert.rejects(() => f.close(), error => error.code === 'portal_block_unlinked');
  await assert.rejects(() => f.mode('automatic-from-client'), error => error.code === 'portal_invalid_publication');
});

test('automatic completion adds columns without rebuilding the original mode CHECK or existing data', t => {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const oldSchema = schema.replace(/^  automatic_completion INTEGER[^\n]+\n/gm, '').replace(/^  publication_blocked INTEGER[^\n]+\n/gm, '');
  db.exec(oldSchema);
  db.exec(`INSERT INTO participant_portal_events(id,title,season,venue) VALUES('old-event','Evento anterior','Otoño','edomex');
    INSERT INTO participant_portal_publication_settings(event_id,mode,operation_nonce) VALUES('old-event','block_close','existing-operation')`);
  db.exec(completionMigration);
  assert.deepEqual({ ...db.prepare('SELECT event_id,mode,operation_nonce,automatic_completion FROM participant_portal_publication_settings').get() },
    { event_id: 'old-event', mode: 'block_close', operation_nonce: 'existing-operation', automatic_completion: 0 });
  assert.ok(db.prepare('PRAGMA table_info(participant_portal_routines)').all().some(row => row.name === 'publication_blocked' && row.dflt_value === '0'));
  assert.throws(() => db.prepare("UPDATE participant_portal_publication_settings SET mode='block_complete'").run(), /CHECK/);
  db.prepare('UPDATE participant_portal_publication_settings SET automatic_completion=1').run();
  assert.equal(db.prepare('SELECT automatic_completion FROM participant_portal_publication_settings').get().automatic_completion, 1);
});

test('automatic mode persists additively and reads completed blocks without writing publication records', async t => {
  const f = await fixture(t); await f.mode('block_complete');
  const setting = f.rows('participant_portal_publication_settings')[0];
  assert.equal(setting.mode, 'block_close'); assert.equal(setting.automatic_completion, 1);
  assert.equal(JSON.parse(f.rows('participant_portal_publication_history')[0].details_json).mode, 'block_complete');
  const protectedTables = ['participant_portal_events', 'participant_portal_access', 'participant_portal_routines', 'participant_portal_assets', 'participant_portal_publication_settings', 'participant_portal_publication_history', 'participant_portal_block_publications'];
  const before = protectedTables.map(table => f.rows(table)); f.db.queries.length = 0;
  const view = await f.view();
  assert.equal(view.mode, 'block_complete'); assert.equal(view.selectedBlock.state, 'ready');
  assert.equal(view.selectedBlock.complete, true); assert.equal(view.selectedBlock.closedAt, null);
  assert.equal(await f.allows(), true);
  assert.deepEqual(protectedTables.map(table => f.rows(table)), before);
  assert.ok(f.db.queries.every(sql => /^\s*SELECT\b/i.test(sql)), 'passport/admin GET workflows never mutate the database');
  assert.ok(f.db.queries.every(sql => !sql.includes('participant_portal_block_publications')), 'automatic mode ignores manual release history');
  assert.ok(f.rows('participant_portal_routines').every(row => row.status === 'draft' && row.publication_blocked === 0));
  await assert.rejects(() => f.close(), error => error.code === 'portal_block_mode_required');
  await assert.rejects(() => f.reopen(), error => error.code === 'portal_block_mode_required');
});

test('an incomplete peer holds the entire automatic block until all its expected judges finish', async t => {
  const f = await fixture(t); await f.mode('block_complete');
  const missing = f.input.scores.find(row => row.routine_id === '2' && row.judge_id === 'judge-2');
  f.input.scores = f.input.scores.filter(row => row !== missing);
  const view = await f.view(); assert.equal(view.selectedBlock.state, 'open'); assert.equal(view.selectedBlock.complete, false);
  assert.equal(view.selectedBlock.completedRoutines, 1); assert.equal(view.selectedBlock.totalRoutines, 2);
  assert.equal(await f.allows(), false, 'a complete individual sheet is not released before its peers');
  f.input.scores.push(missing);
  assert.equal((await f.view()).selectedBlock.state, 'ready'); assert.equal(await f.allows(), true);
  f.input.scores = f.input.scores.filter(row => row.routine_id !== '3');
  assert.equal(await f.allows(), true, 'another incomplete block does not hold this completed block');
  assert.equal(await f.allows({ sourceRoutineId: '3', danceId: 'dance-3' }), false);
  assert.equal(f.rows('participant_portal_block_publications').length, 0);
});

test('zero is a valid submitted score and later complete corrections update automatic publication on consultation', async t => {
  const f = await fixture(t); await f.mode('block_complete');
  for (const score of f.input.scores) score.value = 0;
  const before = await f.view(); assert.equal(before.selectedBlock.state, 'ready'); assert.equal(await f.allows(), true);
  f.input.scores[0].value = 8;
  const corrected = await f.view(); assert.equal(corrected.selectedBlock.state, 'ready');
  assert.notEqual(corrected.selectedBlock.fingerprint, before.selectedBlock.fingerprint); assert.equal(await f.allows(), true);
  f.input.scores.splice(0, 1); assert.equal(await f.allows(), false, 'a removed score returns the entire block to pending');
  assert.equal(f.rows('participant_portal_block_publications').length, 0);
  assert.deepEqual(f.rows('participant_portal_publication_history').map(row => row.action), ['mode']);
});

test('old manual closure state and fingerprints have no effect on automatic completion', async t => {
  const f = await fixture(t); await f.mode('block_close'); await f.close(); await f.reopen(); await f.mode('block_complete');
  f.input.scores[0].value = 9;
  const gate = await createBlockPublicationGate({ db: f.db, eventId });
  assert.equal(await gate.allowsRoutine({ sourceEventId: sourceId, sourceRoutineId: '1', danceId: 'dance-1', snapshot: f.snapshot() }), true);
  assert.equal((await f.view()).selectedBlock.state, 'ready');
  f.db.sqlite.prepare("UPDATE participant_portal_block_publications SET state='open',fingerprint='obsolete',operation_nonce='unrelated-history'").run();
  assert.equal(await gate.confirm(), true, 'unrelated manual history does not govern automatic release');
  await f.mode('individual');
  assert.equal(f.rows('participant_portal_publication_settings')[0].automatic_completion, 0);
});

test('automatic mode respects a manual withdrawal without blocking other complete participants in the block', async t => {
  const f = await fixture(t); await f.mode('block_complete');
  const fingerprint = (await f.view()).selectedBlock.fingerprint;
  assert.equal(await f.allows(), true);
  f.db.sqlite.prepare("UPDATE participant_portal_routines SET publication_blocked=1 WHERE id='portal-1'").run();
  assert.equal(await f.allows(), false);
  assert.equal(await f.allows({ sourceRoutineId: '2', danceId: 'dance-2' }), true);
  const view = await f.view(); assert.equal(view.selectedBlock.state, 'ready');
  assert.equal(view.selectedBlock.fingerprint, fingerprint, 'individual visibility overrides are separate from grade integrity');
  f.db.sqlite.prepare("UPDATE participant_portal_routines SET publication_blocked=0 WHERE id='portal-1'").run();
  assert.equal(await f.allows(), true);
});

test('automatic final confirmation detects flag, source, association and manual-withdrawal races', async t => {
  const changes = [
    f => f.db.sqlite.prepare('UPDATE participant_portal_publication_settings SET automatic_completion=0 WHERE event_id=?').run(eventId),
    f => f.db.sqlite.prepare('UPDATE participant_portal_judging_sources SET enabled=0 WHERE event_id=?').run(eventId),
    f => f.db.sqlite.prepare("UPDATE participant_portal_routines SET source_routine_id='99' WHERE id='portal-2'").run(),
    f => f.db.sqlite.prepare("UPDATE participant_portal_routines SET publication_blocked=1 WHERE id='portal-1'").run(),
  ];
  for (const [index, change] of changes.entries()) await t.test(`automatic race ${index}`, async t => {
    const f = await fixture(t); await f.mode('block_complete');
    const gate = await createBlockPublicationGate({ db: f.db, eventId });
    assert.equal(await gate.allowsRoutine({ sourceEventId: sourceId, sourceRoutineId: '1', danceId: 'dance-1', snapshot: f.snapshot() }), true);
    change(f); assert.equal(await gate.confirm(), false);
  });
});

test('a complete mapped block closes atomically without publishing the edition, photos, QR or other blocks', async t => {
  const f = await fixture(t); await f.mode('block_close');
  f.db.sqlite.prepare("UPDATE participant_portal_routines SET publication_blocked=1 WHERE id='portal-1'").run();
  const before = [f.rows('participant_portal_events'), f.rows('participant_portal_access'), f.rows('participant_portal_assets')];
  const view = await f.view(); assert.equal(view.selectedBlock.complete, true); assert.equal(view.selectedBlock.state, 'open');
  assert.equal(view.selectedBlock.completedRoutines, 2); assert.equal(view.selectedBlock.totalRoutines, 2);
  assert.match(view.selectedBlock.fingerprint, /^[0-9a-f]{64}$/);
  const result = await f.close({ fingerprint: view.selectedBlock.fingerprint, sourceEventId: otherSourceId });
  assert.equal(result.selectedBlock.state, 'closed'); assert.ok(result.selectedBlock.closedAt);
  assert.deepEqual(f.rows('participant_portal_routines').map(row => [row.status, row.photos_published]), [['published', 1], ['published', 0], ['draft', 0]]);
  assert.ok(f.rows('participant_portal_routines').every(row => row.publication_blocked === 0), 'an explicit manual block close republishes its withdrawn entries');
  assert.deepEqual([f.rows('participant_portal_events'), f.rows('participant_portal_access'), f.rows('participant_portal_assets')], before);
  assert.deepEqual(f.rows('participant_portal_publication_history').map(row => [row.action, row.actor_id]), [['mode', 'admin'], ['close', 'admin']]);
  assert.equal(await f.allows(), true); assert.equal(await f.allows({ sourceRoutineId: '2', danceId: 'dance-2' }), true);
  assert.equal(await f.allows({ sourceRoutineId: '3', danceId: 'dance-3' }), false);
  assert.equal(await f.allows({ sourceEventId: otherSourceId }), false); assert.equal(await f.allows({ danceId: 'dance-2' }), false);
  for (const [kind, id, options] of f.calls) { assert.equal(id, sourceId); assert.equal(options.trustedEventId, sourceId); if (kind === 'snapshot') assert.deepEqual(options.routineIds, ['1']); }
});

test('incomplete evaluations, invalid official results and uncertified scope cannot close a block', async t => {
  const mutations = [
    snapshot => { snapshot.rows[0].status = 'partial'; },
    snapshot => { snapshot.rows[0].completedJudges = 1; },
    snapshot => { snapshot.rows[0].judges[0].criteria[0].value = 11; },
    snapshot => { snapshot.rows[0].judges[0].penalty = 1; },
    snapshot => { snapshot.rows[0].judges[0].total = null; },
    snapshot => { snapshot.report.blocks[0].sections[0].categories[0].rows[0].score = 151; },
    snapshot => { snapshot.resultScope.complete = false; },
    snapshot => { snapshot.resultScope.blockIds = ['block-2']; },
    snapshot => { snapshot.rows.pop(); snapshot.rows.pop(); },
    snapshot => { delete snapshot.publicationContext; },
    snapshot => { snapshot.publicationContext = Object.create({ competitionConfig: {} }); },
    snapshot => { snapshot.publicationContext.competitionConfig = new Date(); },
    snapshot => { snapshot.event.id = otherSourceId; },
  ];
  for (const [index, mutate] of mutations.entries()) await t.test(`invalid snapshot ${index}`, async t => {
    const f = await fixture(t); await f.mode('block_close'); const snapshot = f.snapshot(); mutate(snapshot);
    await assert.rejects(() => f.close({}, { getSnapshot: async () => snapshot }), error => error.code === 'portal_block_incomplete');
    assert.equal(f.rows('participant_portal_block_publications').length, 0);
    assert.ok(f.rows('participant_portal_routines').every(row => row.status === 'draft'));
    assert.deepEqual(f.rows('participant_portal_publication_history').map(row => row.action), ['mode']);
  });
});

test('empty, ambiguously mapped and foreign-venue blocks remain unpublished', async t => {
  const f = await fixture(t); await f.mode('block_close');
  f.input.blocks.push({ event_id: sourceId, block_id: 'empty', name: 'Vacío' });
  assert.equal((await f.view('empty')).selectedBlock.complete, false);
  await assert.rejects(() => f.close({ blockId: 'empty' }), error => error.code === 'portal_block_incomplete');
  f.db.sqlite.prepare("UPDATE registration_dances SET venue='puebla' WHERE id='dance-2'").run();
  assert.equal((await f.view()).selectedBlock.complete, false);
  await assert.rejects(() => f.close(), error => error.code === 'portal_block_incomplete');
  f.db.sqlite.prepare("UPDATE registration_dances SET venue='edomex' WHERE id='dance-2'").run();
  f.db.sqlite.prepare("UPDATE participant_portal_routines SET source_routine_id='99' WHERE id='portal-2'").run();
  await assert.rejects(() => f.close(), error => error.code === 'portal_block_incomplete');
  assert.equal(f.rows('participant_portal_block_publications').length, 0);
});

test('stale fingerprints cannot publish a newly changed evaluation', async t => {
  const f = await fixture(t); await f.mode('block_close'); const previous = (await f.view()).selectedBlock.fingerprint;
  f.input.scores[0].value = 7;
  await assert.rejects(() => f.close({ fingerprint: previous }), error => error.code === 'portal_block_changed' && error.statusCode === 409);
  assert.equal(f.rows('participant_portal_block_publications').length, 0);
});

test('closed releases fail closed when scores, feedback, roster, criteria or configuration change', async t => {
  const mutations = [
    input => { input.scores[0].value += 1; },
    input => { input.feedback.push({ event_id: sourceId, routine_id: '1', judge_id: 'judge-1', body: 'Corrección' }); },
    input => { input.judges[0].name = 'Nombre corregido'; },
    input => { input.criteria[0].label = 'Técnica actualizada'; },
    input => { input.event.competition_config = { scoring: { aggregation: 'average' } }; },
  ];
  for (const [index, mutate] of mutations.entries()) await t.test(`changed source ${index}`, async t => {
    const f = await fixture(t); await f.mode('block_close'); await f.close(); assert.equal(await f.allows(), true);
    mutate(f.input);
    assert.equal((await f.view()).selectedBlock.state, 'changed');
    assert.equal(await f.allows(), false);
  });
});

test('polling time, activation and upstream ordering do not invalidate the same closed block', async t => {
  const f = await fixture(t); await f.mode('block_close'); await f.close();
  f.input.event.is_active = true; f.input.blocks[0].is_active = true;
  f.input.judges.reverse(); f.input.scores.reverse();
  const snapshot = f.snapshot(); snapshot.fetchedAt = '2099-01-01T00:00:00.000Z';
  assert.equal(await f.allows({}, snapshot), true);
  assert.equal((await f.view()).selectedBlock.state, 'closed');
});

test('moving a routine invalidates its former block and reopening that block does not hide its new closed block', async t => {
  const f = await fixture(t); await f.mode('block_close'); await f.close();
  f.input.routines[1].block_id = 'block-2'; f.input.routines[1].block = 'Bloque 2';
  assert.equal((await f.view()).selectedBlock.state, 'changed'); assert.equal(await f.allows(), false);
  assert.equal(await f.allows({ sourceRoutineId: '2', danceId: 'dance-2' }), false);
  await f.close({ blockId: 'block-2' });
  assert.equal(await f.allows({ sourceRoutineId: '2', danceId: 'dance-2' }), true);
  const before = f.rows('participant_portal_routines'); await f.reopen('block-1');
  assert.deepEqual(f.rows('participant_portal_routines'), before);
  assert.equal(await f.allows({ sourceRoutineId: '2', danceId: 'dance-2' }), true);
});

test('a changed registration association or disabled source never inherits an old release', async t => {
  const f = await fixture(t); await f.mode('block_close'); await f.close();
  f.db.sqlite.prepare("UPDATE participant_portal_routines SET source_routine_id='99' WHERE id='portal-2'").run();
  assert.equal(await f.allows(), false); assert.equal((await f.view()).selectedBlock.state, 'changed');
  f.db.sqlite.prepare("UPDATE participant_portal_judging_sources SET enabled=0 WHERE event_id=?").run(eventId);
  f.calls.length = 0; assert.equal(await f.allows(), false); assert.equal((await f.view()).sourceEventId, ''); assert.equal(f.calls.length, 0);
});

test('reopening is audited and takes effect on the next request without consulting Core', async t => {
  const f = await fixture(t); await f.mode('block_close'); await f.close(); assert.equal(await f.allows(), true);
  f.calls.length = 0; const opened = await f.reopen();
  assert.equal(opened.selectedBlock.state, 'open'); assert.equal(opened.selectedBlock.closedAt, null);
  assert.equal(f.calls.length, 0); assert.equal(await f.allows(), false);
  assert.deepEqual(f.rows('participant_portal_publication_history').map(row => row.action), ['mode', 'close', 'reopen']);
});

test('one request-local gate reads D1 once and reuses block fingerprints for many owned routines', async t => {
  const f = await fixture(t); await f.mode('block_close'); await f.close(); f.db.queries.length = 0;
  const gate = await createBlockPublicationGate({ db: f.db, eventId }); const snapshot = f.snapshot();
  const queryCount = f.db.queries.length; assert.equal(queryCount, 3);
  for (let index = 0; index < 50; index++) assert.equal(await gate.allowsRoutine({ sourceEventId: sourceId, sourceRoutineId: '1', danceId: 'dance-1', snapshot }), true);
  assert.equal(f.db.queries.length, queryCount + 1, 'only one fresh authorization check for the entire block');
});

test('a reopen, policy edit or relink during an upstream read wins over the preloaded gate', async t => {
  const changes = [
    async f => f.reopen(),
    async f => f.mode('individual'),
    async f => f.db.sqlite.prepare('UPDATE participant_portal_judging_sources SET source_event_id=? WHERE event_id=?').run(otherSourceId, eventId),
    async f => f.db.sqlite.prepare("UPDATE participant_portal_routines SET source_routine_id='99' WHERE id='portal-2'").run(),
  ];
  for (const [index, change] of changes.entries()) await t.test(`read race ${index}`, async t => {
    const f = await fixture(t); await f.mode('block_close'); await f.close();
    const gate = await createBlockPublicationGate({ db: f.db, eventId });
    const snapshot = f.snapshot(); await change(f);
    assert.equal(await gate.allowsRoutine({ sourceEventId: sourceId, sourceRoutineId: '1', danceId: 'dance-1', snapshot }), false);
  });
});

test('final confirmation is fresh after an allowed block and a later Drive/body await', async t => {
  const changes = [
    async f => f.reopen(),
    async f => f.mode('individual'),
    async f => f.db.sqlite.prepare('UPDATE participant_portal_judging_sources SET enabled=0 WHERE event_id=?').run(eventId),
    async f => f.db.sqlite.prepare("UPDATE participant_portal_routines SET source_routine_id='99' WHERE id='portal-2'").run(),
    async f => f.db.sqlite.prepare("UPDATE participant_portal_block_publications SET manifest_json='[]' WHERE event_id=?").run(eventId),
    async f => f.close({ blockId: 'block-2' }),
  ];
  for (const [index, change] of changes.entries()) await t.test(`final response race ${index}`, async t => {
    const f = await fixture(t); await f.mode('block_close'); await f.close();
    const gate = await createBlockPublicationGate({ db: f.db, eventId });
    assert.equal(await gate.allowsRoutine({ sourceEventId: sourceId, sourceRoutineId: '1', danceId: 'dance-1', snapshot: f.snapshot() }), true);
    assert.equal(await gate.confirm(), true);
    await change(f);
    assert.equal(await gate.confirm(), false, 'a final response must not reuse the earlier cached authorization');
  });
});

test('a policy activation during a legacy individual response is detected by final confirmation', async t => {
  const f = await fixture(t);
  const gate = await createBlockPublicationGate({ db: f.db, eventId });
  assert.equal(gate.mode, 'individual'); assert.equal(await gate.allowsRoutine(), true); assert.equal(await gate.confirm(), true);
  await f.mode('block_close');
  assert.equal(await gate.confirm(), false);
});

test('fifty blocks use bounded D1 reads in manual and automatic modes', async t => {
  const f = await fixture(t); await f.mode('block_close');
  const row = value => ({ event_id: sourceId, ...value });
  f.input.blocks = Array.from({ length: 50 }, (_, index) => row({ block_id: `block-${index + 1}`, name: `Bloque ${index + 1}`, sort_order: index, is_active: false }));
  f.input.routines = Array.from({ length: 50 }, (_, index) => row({ routine_id: String(index + 1), block_id: `block-${index + 1}`, block: `Bloque ${index + 1}`,
    name: `Coreografía ${index + 1}`, academy: 'Academia', genre: 'TELA', division: 'Junior', category: 'Solo', level: 'Intermedio', sort_order: index }));
  f.input.scores = Array.from({ length: 50 }, (_, index) => [1, 2].map(judge => row({ routine_id: String(index + 1), judge_id: `judge-${judge}`, criterion_id: 1, value: 5 }))).flat();
  for (let index = 4; index <= 50; index++) {
    f.db.sqlite.prepare(`INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue)
      VALUES(?,'academy',?,'aereo','tela','solo','intermedio','edomex')`).run(`dance-${index}`, `Coreografía ${index}`);
    f.db.sqlite.prepare('INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id) VALUES(?,?,?,?,?)')
      .run(`portal-${index}`, eventId, `dance-${index}`, sourceId, String(index));
  }
  for (let index = 1; index <= 50; index++) await f.close({ blockId: `block-${index}` });
  f.db.queries.length = 0;
  const gate = await createBlockPublicationGate({ db: f.db, eventId }), snapshot = f.snapshot();
  assert.equal(f.db.queries.length, 3);
  for (let index = 1; index <= 50; index++) assert.equal(await gate.allowsRoutine({ sourceEventId: sourceId, sourceRoutineId: String(index), danceId: `dance-${index}`, snapshot }), true);
  assert.equal(f.db.queries.length, 4, 'one shared freshness query covers all fifty blocks');
  assert.equal(await gate.confirm(), true); assert.equal(f.db.queries.length, 5);
  await f.mode('block_complete'); f.db.queries.length = 0;
  const automaticGate = await createBlockPublicationGate({ db: f.db, eventId });
  assert.equal(f.db.queries.length, 2, 'automatic mode needs no manual closure reads');
  for (let index = 1; index <= 50; index++) assert.equal(await automaticGate.allowsRoutine({ sourceEventId: sourceId, sourceRoutineId: String(index), danceId: `dance-${index}`, snapshot }), true);
  assert.equal(f.db.queries.length, 3);
  assert.equal(await automaticGate.confirm(), true); assert.equal(f.db.queries.length, 4);
  assert.ok(f.db.queries.every(sql => /^\s*SELECT\b/i.test(sql)));
});

test('binding, mode and mapping races leave the attempted close completely without mutations', async t => {
  const races = [
    db => db.sqlite.prepare('UPDATE participant_portal_judging_sources SET enabled=0 WHERE event_id=?').run(eventId),
    db => db.sqlite.prepare("UPDATE participant_portal_publication_settings SET operation_nonce='other-operation' WHERE event_id=?").run(eventId),
    db => db.sqlite.prepare("UPDATE participant_portal_routines SET source_routine_id='99' WHERE id='portal-2'").run(),
  ];
  for (const [index, race] of races.entries()) await t.test(`race ${index}`, async t => {
    const f = await fixture(t); await f.mode('block_close'); f.db.beforeBatch = () => race(f.db);
    await assert.rejects(() => f.close(), error => error.code === 'portal_block_changed');
    assert.equal(f.rows('participant_portal_block_publications').length, 0);
    assert.ok(f.rows('participant_portal_routines').every(row => row.status === 'draft'));
    assert.deepEqual(f.rows('participant_portal_publication_history').map(row => row.action), ['mode']);
  });
});

test('an intervening reopen wins over an older close request', async t => {
  const f = await fixture(t); await f.mode('block_close'); await f.close();
  f.db.beforeBatch = () => f.db.sqlite.prepare("UPDATE participant_portal_block_publications SET state='open',operation_nonce='concurrent-reopen',closed_at=NULL,fingerprint=NULL").run();
  await assert.rejects(() => f.close(), error => error.code === 'portal_block_changed');
  assert.equal(f.rows('participant_portal_block_publications')[0].operation_nonce, 'concurrent-reopen');
  assert.deepEqual(f.rows('participant_portal_publication_history').map(row => row.action), ['mode', 'close']);
});

test('a failed atomic batch rolls back its publication, routine changes and history', async t => {
  const f = await fixture(t); await f.mode('block_close'); f.db.failBatchAt = 1;
  await assert.rejects(() => f.close(), error => error.code === 'portal_block_changed');
  assert.equal(f.rows('participant_portal_block_publications').length, 0);
  assert.ok(f.rows('participant_portal_routines').every(row => row.status === 'draft'));
  assert.deepEqual(f.rows('participant_portal_publication_history').map(row => row.action), ['mode']);
});
