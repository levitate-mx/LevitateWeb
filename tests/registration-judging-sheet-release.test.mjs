import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { buildJudgingScoreSnapshot } from '../worker/judging-score-data.js';
import { analyzeJudgingSheetRelease, getJudgingSheetRelease, releaseJudgingSheets, judgingSheetsAreReleased,
  getReleasedJudgingSheetJudgeIds } from '../worker/judging-sheet-release.js';
import { handleJudgingAdmin, readAdminSnapshot } from '../worker/judging-admin.js';
import { getJudgingSheets } from '../worker/judging-reader.js';
import { releveJudgingEventId } from '../worker/releve-competition.js';

const defaultEventId = '11111111-2222-4333-8444-555555555555';
const admin = { user: { id: 'admin', role: 'admin', name: 'Admin' } };

function fixture(t, eventId = defaultEventId) {
  const sqlite = new DatabaseSync(':memory:'); t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES('a','Academia','Contacto','a@example.test');
    INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role) VALUES('admin','a','Admin','admin','admin@example.test','test-only-unused','admin');`);
  const db = { prepare(sql) {
    const statement = sqlite.prepare(sql); let args = [];
    const query = { bind(...values) { args = values; return query; }, async first() { return statement.get(...args) || null; },
      async all() { return { results: statement.all(...args) }; }, async run() { return { success: true, meta: statement.run(...args) }; } };
    return query;
  } };
  const row = fields => ({ event_id: eventId, ...fields });
  const input = {
    event: { id: eventId, name: 'Evento', event_type: 'event', competition_config: {} },
    blocks: [row({ block_id: 'b1', name: 'Bloque 1', sort_order: 1 }), row({ block_id: 'b2', name: 'Bloque 2', sort_order: 2 })],
    routines: [1, 2, 3].map(index => row({ routine_id: String(index), block_id: index < 3 ? 'b1' : 'b2', block: index < 3 ? 'Bloque 1' : 'Bloque 2',
      name: `Rutina ${index}`, academy: 'Academia', genre: 'Ballet', division: 'Teen', category: 'Solo', level: 'Intermedio' })),
    judges: ['Eva Carrillo', 'Daniel Montalvo', 'Jorge Díaz'].map((name, index) => row({ judge_id: `j${index}`, name, role: 'judge', assigned_block_ids: ['b1', 'b2'] })),
    templates: [row({ template_id: 'ballet', genre: 'Ballet', max_score: 10 })],
    criteria: [row({ template_id: 'ballet', criterion_id: 1, label: 'Técnica', max_score: 10 })],
    scores: [1, 2, 3].flatMap(index => [0, 1, 2].map(judge => row({ routine_id: String(index), judge_id: `j${judge}`, criterion_id: 1, value: 5 + index }))),
    penalties: [], feedback: [], specialAwards: [],
  };
  const snapshot = () => ({ ...buildJudgingScoreSnapshot(input), resultScope: { complete: true, eventId, blockIds: ['b1', 'b2'] } });
  const options = () => ({ db, sourceEventId: eventId, blockId: 'b1', snapshot: snapshot(), routineIds: ['1', '2'] });
  const allows = (id = '1', data = snapshot()) => judgingSheetsAreReleased({ db, sourceEventId: eventId, sourceRoutineId: id, snapshot: data });
  const judgeIds = (id = '1', data = snapshot()) => getReleasedJudgingSheetJudgeIds({ db, sourceEventId: eventId, sourceRoutineId: id, snapshot: data });
  const tables = () => ({ events: [input.event], blocks: input.blocks, routines: input.routines, judges: input.judges,
    criteria_templates: input.templates, criteria: input.criteria, scores: input.scores, penalties: input.penalties,
    feedback: input.feedback, special_awards: [], routine_favorites: [], routine_favorite_votes: [] });
  const fetcher = async value => {
    const url = new URL(value), table = url.pathname.split('/').at(-1);
    let rows = tables()[table] || [];
    for (const field of ['id', 'event_id', 'routine_id']) {
      const filter = url.searchParams.get(field);
      if (filter?.startsWith('eq.')) rows = rows.filter(row => row[field] === filter.slice(3));
      if (filter?.startsWith('in.(')) rows = rows.filter(row => filter.slice(4, -1).split(',').includes(row[field]));
    }
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000);
    return Response.json(rows.slice(offset, offset + limit));
  };
  const env = { DB: db, JUDGING_SUPABASE_URL: 'https://fixture.supabase.co', JUDGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', JUDGING_LEVITATE_EVENT_IDS: eventId };
  const request = (method = 'GET', body = {}, query = `&blockId=b1`) => new Request(`https://levitate.mx/api/registration/admin/judging/workspace/sheet-release?eventId=${eventId}${query}`,
    { method, headers: { origin: 'https://levitate.mx', 'content-type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
  return { sqlite, db, input, snapshot, options, allows, judgeIds, env, fetcher, request };
}

test('reading a complete block never releases sheets; only an explicit release enables that block', async t => {
  const f = fixture(t);
  assert.equal((await getJudgingSheetRelease(f.options())).state, 'ready');
  assert.equal(await f.allows(), false);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM registration_judging_sheet_releases').get().n, 0);
  const result = await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  assert.equal(result.state, 'released'); assert.equal(result.released, true);
  assert.equal(result.complete, true); assert.equal(result.canRelease, false);
  assert.equal(result.availableSheets, 6); assert.equal(result.releasedSheets, 6);
  assert.equal(result.availableRoutines, 2); assert.equal(result.releasedRoutines, 2);
  assert.equal(await f.allows('1'), true); assert.equal(await f.allows('2'), true); assert.equal(await f.allows('3'), false);
  const saved = f.sqlite.prepare('SELECT * FROM registration_judging_sheet_releases').get();
  assert.equal(saved.released_by, 'admin'); assert.ok(saved.released_at); assert.equal(saved.fingerprint.length, 64);
  assert.equal(JSON.parse(saved.manifest_json).sheets.length, 6);
});

test('a block with one completed judge sheet can be released without publishing pending judges or other routines', async t => {
  const f = fixture(t); f.input.scores = f.input.scores.filter(row => row.routine_id === '1' && row.judge_id === 'j0');
  const ready = await getJudgingSheetRelease(f.options());
  assert.equal(ready.state, 'ready'); assert.equal(ready.complete, false); assert.equal(ready.canRelease, true);
  assert.equal(ready.routines, 2); assert.equal(ready.availableRoutines, 1); assert.equal(ready.availableSheets, 1);
  assert.equal(ready.releasedSheets, 0); assert.equal(await f.allows(), false);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM registration_judging_sheet_releases').get().n, 0);
  const released = await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  assert.equal(released.complete, false); assert.equal(released.canRelease, false); assert.equal(released.state, 'released');
  assert.equal(released.releasedSheets, 1); assert.equal(released.releasedRoutines, 1);
  assert.deepEqual(await f.judgeIds(), ['j0']); assert.equal(await f.allows('2'), false);
});

test('empty blocks, ambiguous routine sets and own-routine-only reads cannot publish sheets', async t => {
  const f = fixture(t); const original = f.input.scores; f.input.scores = [];
  await assert.rejects(() => releaseJudgingSheets({ ...f.options(), actorId: 'admin' }), error => error.code === 'judging_sheet_release_incomplete');
  assert.equal((await getJudgingSheetRelease(f.options())).state, 'pending');
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM registration_judging_sheet_releases').get().n, 0);
  f.input.scores = original;
  await assert.rejects(() => releaseJudgingSheets({ ...f.options(), routineIds: ['1'], actorId: 'admin' }), error => error.code === 'judging_sheet_release_incomplete');
  await assert.rejects(() => releaseJudgingSheets({ ...f.options(), routineIds: ['1', '1'], actorId: 'admin' }), error => error.code === 'judging_sheet_release_incomplete');
  await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  const ownOnly = f.snapshot(); ownOnly.rows = ownOnly.rows.filter(row => row.id === '1');
  assert.equal(await f.allows('1', ownOnly), false);
  const uncertified = f.snapshot(); delete uncertified.resultScope;
  assert.equal(await f.allows('1', uncertified), false);
});

test('edited sheets require a fresh manual release while audience votes and awards do not affect sheets', async t => {
  const f = fixture(t); await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  const awardsOnly = f.snapshot(); awardsOnly.report.blocks[0].specialAwards = [{ id: 'manual', displayValue: 'Cambio' }];
  assert.equal(await f.allows('1', awardsOnly), true);
  const displayOnly = f.snapshot();
  displayOnly.report.maximumScore = 210;
  for (const block of displayOnly.report.blocks) for (const section of block.sections) for (const category of section.categories) {
    for (const entry of category.rows) { entry.score = 19; entry.maximumScore = 210; }
  }
  assert.equal(await f.allows('1', displayOnly), true, 'report formatting and scoring scales never change the authorization of unchanged jury sheets');
  f.input.feedback.push({ event_id: f.input.event.id, routine_id: '1', judge_id: 'j0', body: 'Corrección del juez' });
  f.input.scores.find(row => row.routine_id === '1').value = 9;
  assert.equal((await getJudgingSheetRelease(f.options())).state, 'changed');
  assert.deepEqual(await f.judgeIds(), ['j1', 'j2']);
  assert.deepEqual(await f.judgeIds('2'), ['j0', 'j1', 'j2']);
  await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  assert.equal(await f.allows(), true);
});

test('new scores from another judge or routine retain approved sheets and need another explicit click', async t => {
  const f = fixture(t); const original = f.input.scores;
  f.input.scores = original.filter(row => row.routine_id === '1' && row.judge_id === 'j0');
  await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  f.input.scores.push(...original.filter(row => row.routine_id === '1' && row.judge_id === 'j1'));
  assert.deepEqual(await f.judgeIds(), ['j0']);
  const changed = await getJudgingSheetRelease(f.options());
  assert.equal(changed.state, 'changed'); assert.equal(changed.canRelease, true);
  assert.equal(changed.availableSheets, 2); assert.equal(changed.releasedSheets, 1);
  f.input.scores.push(...original.filter(row => row.routine_id === '2' && row.judge_id === 'j0'));
  assert.deepEqual(await f.judgeIds(), ['j0']); assert.deepEqual(await f.judgeIds('2'), []);
  await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  assert.deepEqual(await f.judgeIds(), ['j0', 'j1']); assert.deepEqual(await f.judgeIds('2'), ['j0']);
  const saved = f.sqlite.prepare('SELECT manifest_json FROM registration_judging_sheet_releases').get();
  assert.equal(JSON.parse(saved.manifest_json).sheets.length, 3);
});

test('partial criteria, invalid notes and zero-recorded sheets never become available; completed zero sheets do', async t => {
  const f = fixture(t); f.input.criteria.push({ ...f.input.criteria[0], criterion_id: 2, label: 'Musicalidad' });
  f.input.scores = f.input.scores.filter(row => row.routine_id === '1' && row.judge_id === 'j0');
  assert.equal((await getJudgingSheetRelease(f.options())).availableSheets, 0);
  await assert.rejects(() => releaseJudgingSheets({ ...f.options(), actorId: 'admin' }), error => error.code === 'judging_sheet_release_incomplete');
  f.input.scores[0].value = 0;
  f.input.scores.push({ ...f.input.scores[0], criterion_id: 2, value: 11 });
  assert.equal((await getJudgingSheetRelease(f.options())).availableSheets, 0);
  f.input.scores[1].value = 0;
  assert.equal((await getJudgingSheetRelease(f.options())).availableSheets, 1);
  await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  assert.deepEqual(await f.judgeIds(), ['j0']);
});

test('changed feedback or penalties withdraw only that sheet; routine metadata and jury identities require a new click', async t => {
  const f = fixture(t); await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  f.input.feedback.push({ event_id: f.input.event.id, routine_id: '1', judge_id: 'j0', body: 'Feedback actualizado' });
  assert.deepEqual(await f.judgeIds(), ['j1', 'j2']);
  f.input.penalties.push({ event_id: f.input.event.id, routine_id: '1', judge_id: 'j1', value: -1 });
  assert.deepEqual(await f.judgeIds(), ['j2']);
  assert.deepEqual(await f.judgeIds('2'), ['j0', 'j1', 'j2']);
  f.input.routines[0].name = 'Nuevo título';
  assert.deepEqual(await f.judgeIds(), []);
  await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  f.input.judges[2].name = 'Jorge Díaz de León';
  assert.deepEqual(await f.judgeIds(), []); assert.deepEqual(await f.judgeIds('2'), []);
});

test('legacy full-block releases work only for their unchanged complete snapshot and upgrade on a new click', async t => {
  const f = fixture(t);
  const analysis = await analyzeJudgingSheetRelease(f.options());
  f.sqlite.prepare('INSERT INTO registration_judging_sheet_releases(source_event_id,block_id,fingerprint,released_by,operation_nonce) VALUES(?,?,?,?,?)')
    .run(f.input.event.id, 'b1', analysis.fingerprint, 'admin', 'legacy');
  assert.deepEqual(await f.judgeIds(), ['j0', 'j1', 'j2']);
  assert.equal((await getJudgingSheetRelease(f.options())).canRelease, false);
  f.input.scores.find(row => row.routine_id === '2' && row.judge_id === 'j0').value = 8;
  assert.deepEqual(await f.judgeIds(), []);
  assert.equal((await getJudgingSheetRelease(f.options())).canRelease, true);
  assert.equal(f.sqlite.prepare('SELECT manifest_json FROM registration_judging_sheet_releases').get().manifest_json, null);
  await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  assert.deepEqual(await f.judgeIds(), ['j0', 'j1', 'j2']);
  assert.equal(JSON.parse(f.sqlite.prepare('SELECT manifest_json FROM registration_judging_sheet_releases').get().manifest_json).version, 1);
});

test('malformed manifests and uncertified or ambiguous source reads cannot authorize sheets', async t => {
  const f = fixture(t); await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  const saved = JSON.parse(f.sqlite.prepare('SELECT manifest_json FROM registration_judging_sheet_releases').get().manifest_json);
  for (const manifest of [
    { ...saved, version: 2 },
    { ...saved, routineIds: ['1', '1'] },
    { ...saved, routineIds: ['missing'] },
    { ...saved, sheets: [...saved.sheets, saved.sheets[0]] },
    { ...saved, sheets: [{ ...saved.sheets[0], fingerprint: 'invalid' }] },
    { ...saved, sheets: [{ ...saved.sheets[0], routineId: 'other-routine' }] },
  ]) {
    f.sqlite.prepare('UPDATE registration_judging_sheet_releases SET manifest_json=?').run(JSON.stringify(manifest));
    assert.deepEqual(await f.judgeIds(), []);
  }
  f.sqlite.prepare('UPDATE registration_judging_sheet_releases SET manifest_json=?').run(JSON.stringify(saved));
  const wrongEvent = f.snapshot(); wrongEvent.resultScope.eventId = 'other-event';
  const wrongBlock = f.snapshot(); wrongBlock.resultScope.blockIds = ['b2'];
  const incompleteScope = f.snapshot(); incompleteScope.resultScope.complete = false;
  const duplicateRoutine = f.snapshot(); duplicateRoutine.rows.push(duplicateRoutine.rows[0]);
  const duplicateJudge = f.snapshot(); duplicateJudge.rows[0].judges[1].id = 'j0';
  const invalidJudge = f.snapshot(); invalidJudge.rows[0].judges[0].criteria[0].value = 100;
  for (const snapshot of [wrongEvent, wrongBlock, incompleteScope, duplicateRoutine, duplicateJudge]) {
    assert.deepEqual(await f.judgeIds('1', snapshot), []);
  }
  assert.deepEqual(await f.judgeIds('1', invalidJudge), ['j1', 'j2']);
});

test('a manifest with a mismatched record fingerprint fails closed until an explicit release repairs it', async t => {
  const f = fixture(t); await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  f.sqlite.prepare('UPDATE registration_judging_sheet_releases SET fingerprint=?').run('0'.repeat(64));
  assert.deepEqual(await f.judgeIds(), []);
  const changed = await getJudgingSheetRelease(f.options());
  assert.equal(changed.state, 'changed'); assert.equal(changed.canRelease, true); assert.equal(changed.releasedSheets, 0);
  await releaseJudgingSheets({ ...f.options(), actorId: 'admin' });
  assert.deepEqual(await f.judgeIds(), ['j0', 'j1', 'j2']);
});

test('the authenticated endpoint accepts a partially evaluated block and never releases newly arrived sheets on GET', async t => {
  const f = fixture(t); const original = f.input.scores;
  f.input.scores = original.filter(row => row.routine_id === '1' && row.judge_id === 'j0');
  const initial = await handleJudgingAdmin(f.request(), f.env, admin, { fetcher: f.fetcher });
  const ready = await initial.json();
  assert.equal(ready.complete, false); assert.equal(ready.canRelease, true); assert.equal(ready.availableSheets, 1);
  const post = await handleJudgingAdmin(f.request('POST', { block_id: 'b1' }), f.env, admin, { fetcher: f.fetcher });
  const released = await post.json();
  assert.equal(post.status, 200); assert.equal(released.state, 'released'); assert.equal(released.releasedSheets, 1);
  const before = f.sqlite.prepare('SELECT manifest_json,operation_nonce FROM registration_judging_sheet_releases').get();
  f.input.scores.push(...original.filter(row => row.routine_id === '2' && row.judge_id === 'j1'));
  const status = await handleJudgingAdmin(f.request(), f.env, admin, { fetcher: f.fetcher });
  const changed = await status.json();
  assert.equal(changed.state, 'changed'); assert.equal(changed.canRelease, true);
  assert.equal(changed.availableSheets, 2); assert.equal(changed.releasedSheets, 1);
  assert.deepEqual(await f.judgeIds(), ['j0']); assert.deepEqual(await f.judgeIds('2'), []);
  assert.deepEqual(f.sqlite.prepare('SELECT manifest_json,operation_nonce FROM registration_judging_sheet_releases').get(), before);
});

test('Estado de México manual release and participant source reads agree on the fixed jury even when all six judges lack block assignments', async t => {
  const f = fixture(t, releveJudgingEventId);
  f.input.judges.forEach(judge => { judge.assigned_block_ids = []; });
  for (const [index, name] of ['Daniel Herrera', 'Renata Pinal', 'Ana Karen Rojas'].entries()) {
    f.input.judges.push({ event_id: releveJudgingEventId, judge_id: `aerial-${index}`, name, role: 'judge', assigned_block_ids: [] });
  }
  const adminBundle = await readAdminSnapshot(f.env, releveJudgingEventId, { fetcher: f.fetcher });
  assert.equal(adminBundle.snapshot.rows[0].expectedJudges, 3);
  assert.equal(adminBundle.snapshot.rows[0].status, 'complete');
  await releaseJudgingSheets({ db: f.db, sourceEventId: releveJudgingEventId, blockId: 'b1',
    snapshot: adminBundle.snapshot, routineIds: ['1', '2'], actorId: 'admin' });
  const participantSnapshot = await getJudgingSheets(f.env, releveJudgingEventId, {
    routineIds: ['1'], trustedEventId: releveJudgingEventId, fetcher: f.fetcher,
  });
  assert.equal(participantSnapshot.rows[0].expectedJudges, 3);
  assert.deepEqual(participantSnapshot.rows[0].judges.map(judge => judge.name), ['Eva Carrillo', 'Daniel Montalvo', 'Jorge Díaz']);
  assert.equal(await judgingSheetsAreReleased({ db: f.db, sourceEventId: releveJudgingEventId,
    sourceRoutineId: '1', snapshot: participantSnapshot }), true);
});

test('the workspace exposes a read-only status and authenticated click-only release endpoint', async t => {
  const f = fixture(t);
  const get = await handleJudgingAdmin(f.request(), f.env, admin, { fetcher: f.fetcher });
  assert.equal(get.status, 200); assert.equal((await get.json()).state, 'ready');
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM registration_judging_sheet_releases').get().n, 0);
  await assert.rejects(() => handleJudgingAdmin(f.request('POST', { block_id: 'b1' }), f.env,
    { user: { id: 'judge', role: 'judge' } }, { fetcher: f.fetcher }), error => error.statusCode === 403);
  const post = await handleJudgingAdmin(f.request('POST', { block_id: 'b1' }), f.env, admin, { fetcher: f.fetcher });
  assert.equal(post.status, 200); assert.equal((await post.json()).state, 'released');
  const status = await handleJudgingAdmin(f.request(), f.env, admin, { fetcher: f.fetcher });
  assert.equal((await status.json()).state, 'released');
  assert.equal(await f.allows(), true);
  const judgingAdmin = { user: { id: 'admin', role: 'judging_admin', name: 'Admin de jueceo' } };
  const judgingStatus = await handleJudgingAdmin(f.request(), f.env, judgingAdmin, { fetcher: f.fetcher });
  assert.equal((await judgingStatus.json()).state, 'released');
  const judgingPost = await handleJudgingAdmin(f.request('POST', { block_id: 'b2' }), f.env, judgingAdmin, { fetcher: f.fetcher });
  assert.equal((await judgingPost.json()).state, 'released');
  await assert.rejects(() => handleJudgingAdmin(f.request(), f.env, { user: { id: 'viewer', role: 'judging_viewer' } },
    { fetcher: f.fetcher }), error => error.statusCode === 403);
  const crossOrigin = f.request('POST', { block_id: 'b2' }); crossOrigin.headers.set('origin', 'https://untrusted.test');
  await assert.rejects(() => handleJudgingAdmin(crossOrigin, f.env, admin, { fetcher: f.fetcher }), error => error.statusCode === 403);
});
