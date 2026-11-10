import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';
import { PHOTO_WATERMARK_VERSION, validatePreparedParticipantPhoto } from '../worker/participant-photo.js';

const sourceId = 'f3c2e100-1234-4567-8abc-123456789abc';
const editionId = 'block-release-test';
const adminCookie = 'levitate_registration_session=admin-session';
const preparedPhoto = new Uint8Array(await readFile(new URL('./fixtures/participant-photo-prepared.jpg', import.meta.url)));

class D1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); }
  prepare(sql) {
    assert.doesNotMatch(sql, /^\s*(CREATE|ALTER|DROP|PRAGMA)\b/i, 'requests do not migrate the database');
    const statement = this.sqlite.prepare(sql); let values = [];
    const query = { bind(...input) { values = input; return query; },
      async first() { const row = statement.get(...values); return row ? { ...row } : null; },
      async all() { return { results: statement.all(...values).map(row => ({ ...row })) }; },
      sync() { const result = statement.run(...values); return { success: true, meta: { changes: result.changes } }; },
      async run() { return query.sync(); } };
    return query;
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try { const result = statements.map(statement => statement.sync()); this.sqlite.exec('COMMIT'); return result; }
    catch (cause) { this.sqlite.exec('ROLLBACK'); throw cause; }
  }
}

function coreData() {
  const row = value => ({ event_id: sourceId, ...value });
  return {
    events: [{ id: sourceId, name: 'Levitate de prueba', event_type: 'event', is_active: true }],
    blocks: [row({ block_id: 'b1', name: 'Bloque 1', title: 'Aerial', sort_order: 0 }), row({ block_id: 'b2', name: 'Bloque 2', sort_order: 1 })],
    routines: ['r1', 'r2'].map((id, index) => row({ routine_id: id, name: index ? 'Raíz' : 'Vuelo', academy: 'Academia Prueba',
      block_id: 'b1', block: 'Bloque 1', genre: 'Aro', division: 'Teen', category: 'Solo', level: 'Inicial', sort_order: index })),
    judges: [row({ judge_id: 'j1', name: 'Jueza de prueba', role: 'judge', assigned_block_ids: [] })],
    criteria_templates: [row({ template_id: 'aerial', genre: 'DANZA AEREA', max_score: 50 })],
    criteria: [row({ template_id: 'aerial', criterion_id: 1, label: 'Técnica', max_score: 50 })],
    scores: [row({ routine_id: 'r1', judge_id: 'j1', criterion_id: 1, value: 40 }), row({ routine_id: 'r2', judge_id: 'j1', criterion_id: 1, value: 30 })],
    penalties: [], feedback: [row({ routine_id: 'r1', judge_id: 'j1', body: 'Comentario de su evaluación.' }),
      row({ routine_id: 'r2', judge_id: 'j1', body: 'COMENTARIO PRIVADO DE OTRA PERSONA' })], special_awards: [],
  };
}

async function digest(value) { return Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex'); }

async function fixture(t, { partial = false, published = true, mode = 'block_close', photosPublished = true } = {}) {
  const db = new D1(); t.after(() => db.sqlite.close());
  for (const file of ['registration_d1_schema.sql', 'registration_participant_portal.sql', 'registration_participant_block_publication.sql']) {
    db.sqlite.exec(await readFile(new URL(`../db/${file}`, import.meta.url), 'utf8'));
  }
  db.sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES('academy','Academia Prueba','Responsable','test@example.test');
    INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,email_confirmed_at)
      VALUES('admin','academy','Admin','admin','admin@example.test','unused','admin',datetime('now')),
        ('academy-user','academy','Academia','academy','academy@example.test','unused','academy',datetime('now'));
    INSERT INTO registration_participants(id,academy_id,full_name,curp,division,shirt_size)
      VALUES('person-a','academy','Participante Uno','PRUA000000MXXAAA00','teen','s'),('person-b','academy','Participante Dos','PRUB000000MXXAAA00','teen','m');
    INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue)
      VALUES('dance-a','academy','Vuelo','aereo','tela','solo','principiante','edomex'),('dance-b','academy','Raíz','aereo','aro','solo','principiante','edomex');
    INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-a','person-a'),('dance-b','person-b');`);
  for (const actor of ['admin', 'academy-user']) {
    db.sqlite.prepare("INSERT INTO registration_sessions(id,user_id,session_token_hash,expires_at) VALUES(?,?,?,datetime('now','+1 day'))")
      .run(actor, actor, await digest(`${actor}-session`));
  }
  const core = coreData(), upstreamCalls = [];
  if (partial) core.scores = core.scores.filter(row => row.routine_id !== 'r2');
  const sourceFingerprint = () => JSON.stringify(core);
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input), table = url.pathname.split('/').at(-1);
    upstreamCalls.push({ url, options });
    assert.equal(url.origin, 'https://judgingfixture.supabase.co');
    assert.equal(options.method, 'GET', 'the release workflow never edits JueceoCore');
    assert.equal(options.body, undefined);
    let rows = core[table] || [];
    for (const field of ['id', 'event_id', 'routine_id']) {
      const filter = url.searchParams.get(field);
      if (filter?.startsWith('eq.')) rows = rows.filter(row => row[field] === filter.slice(3));
      else if (filter?.startsWith('in.(')) rows = rows.filter(row => filter.slice(4, -1).split(',').includes(row[field]));
    }
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000);
    return Response.json(rows.slice(offset, offset + limit));
  });
  const objects = new Map();
  let pendingStorageRead = null;
  const bucket = { async get(key) {
    const object = objects.get(key);
    if (pendingStorageRead) {
      const pending = pendingStorageRead; pendingStorageRead = null;
      pending.enter(); await pending.wait;
    }
    return object ? { ...object, size: object.body.length } : null;
  } };
  const delayNextStorageRead = () => {
    assert.equal(pendingStorageRead, null);
    let enter, release;
    const entered = new Promise(resolve => { enter = resolve; });
    const wait = new Promise(resolve => { release = resolve; });
    pendingStorageRead = { enter, wait };
    return { entered, release };
  };
  const env = { DB: db, PARTICIPANT_MEDIA: bucket, PARTICIPANT_REGISTRATION_EVENT_IDS: editionId,
    JUDGING_SUPABASE_URL: 'https://judgingfixture.supabase.co', JUDGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_key', JUDGING_LEVITATE_EVENT_IDS: sourceId };
  async function request(path, { method = 'GET', body, cookie, expected = 200 } = {}) {
    const response = await worker.fetch(new Request(`https://levitate.test${path}`, { method,
      headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
    const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : new Uint8Array(await response.arrayBuffer());
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
    return { data, headers: response.headers };
  }
  const admin = (body, expected = 200) => request('/api/registration/admin/participant-portal', { method: 'POST', body, cookie: adminCookie, expected });
  await admin({ action: 'event.upsert', event: { id: editionId, title: 'Levitate de prueba', season: 'Otoño 2026', venue: 'edomex', published } });
  db.sqlite.prepare('INSERT INTO participant_portal_judging_sources(event_id,source_event_id,enabled,updated_by) VALUES(?,?,1,?)').run(editionId, sourceId, 'admin');
  for (const [id, dance, source] of [['portal-a', 'dance-a', 'r1'], ['portal-b', 'dance-b', 'r2']]) {
    db.sqlite.prepare('INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id,photos_published) VALUES(?,?,?,?,?,?)')
      .run(id, editionId, dance, sourceId, source, photosPublished ? 1 : 0);
  }
  const photo = await validatePreparedParticipantPhoto(preparedPhoto);
  for (const [id, routine, approved] of [['approved-photo', 'portal-a', 1], ['draft-photo', 'portal-a', 0], ['other-photo', 'portal-b', 1]]) {
    const key = `photos/${id}`;
    objects.set(key, { body: preparedPhoto, customMetadata: { watermarkVersion: PHOTO_WATERMARK_VERSION } });
    db.sqlite.prepare(`INSERT INTO participant_portal_assets(id,event_id,routine_id,kind,object_key,file_name,content_type,sha256,byte_size,width,height,published)
      VALUES(?,?,?,'photo',?,?,'image/jpeg',?,?,?,?,?)`)
      .run(id, editionId, routine, key, `${id}.jpg`, photo.sha256, preparedPhoto.length, photo.width, photo.height, approved);
  }
  const pdf = new TextEncoder().encode('%PDF-1.4\nSynthetic approved sheet'); objects.set('sheets/approved', { body: pdf });
  db.sqlite.prepare(`INSERT INTO participant_portal_assets(id,event_id,routine_id,kind,object_key,file_name,content_type,sha256,byte_size,published)
    VALUES('approved-sheet',?,'portal-a','judge_sheet','sheets/approved','approved.pdf','application/pdf','synthetic',?,1)`).run(editionId, pdf.length);
  await admin({ action: 'publication.mode.save', eventId: editionId, mode });
  const grant = (await admin({ action: 'access.create', eventId: editionId, participantId: 'person-a' })).data;
  const exchange = await request('/api/participant/access/exchange', { method: 'POST', body: { token: grant.token } });
  const cookie = exchange.headers.get('set-cookie').split(';')[0];
  const me = () => request('/api/participant/me', { cookie });
  const review = () => request(`/api/registration/admin/participant-portal?publication=1&eventId=${editionId}&blockId=b1`, { cookie: adminCookie });
  const close = async () => {
    const { data } = await review();
    return admin({ action: 'block.close', eventId: editionId, blockId: 'b1', fingerprint: data.selectedBlock.fingerprint });
  };
  const asset = (id, expected = 200) => request(`/api/participant/assets/${id}`, { cookie, expected });
  return { db, core, upstreamCalls, sourceFingerprint, request, admin, me, review, close, asset, cookie, delayNextStorageRead };
}

function assertHidden(data) {
  assert.equal(data.routines[0].result.status, 'pending');
  assert.equal(data.routines[0].judging.status, 'pending');
  assert.deepEqual(data.routines[0].judging.judges, []);
  assert.deepEqual(data.routines[0].photos.items, []);
  assert.doesNotMatch(JSON.stringify(data), /Comentario de su evaluación|COMENTARIO PRIVADO|approved-photo|approved-sheet/);
}

test('closing an incomplete block fails without publishing routines, files, the edition or scores', async t => {
  const f = await fixture(t, { partial: true }); const before = f.sourceFingerprint();
  const review = (await f.review()).data;
  assert.equal(review.selectedBlock.complete, false);
  assert.equal(review.selectedBlock.completedRoutines, 1);
  await f.admin({ action: 'block.close', eventId: editionId, blockId: 'b1', fingerprint: review.selectedBlock.fingerprint }, 409);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM participant_portal_routines WHERE status='published'").get().n, 0);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM participant_portal_block_publications').get().n, 0);
  assertHidden((await f.me()).data);
  await f.asset('approved-photo', 404); await f.asset('approved-sheet', 404);
  assert.equal(f.sourceFingerprint(), before);
});

test('one closure releases the complete official result and sheet with approved owned photos only', async t => {
  const f = await fixture(t); const before = f.sourceFingerprint();
  assertHidden((await f.me()).data);
  await f.asset('approved-photo', 404);
  await f.close();
  const { data, headers } = await f.me(), own = data.routines[0];
  assert.equal(own.result.status, 'published'); assert.equal(own.result.score, 120); assert.equal(own.result.place, 1);
  assert.equal(own.judging.status, 'available'); assert.equal(own.judging.pdf.routine.id, 'r1');
  assert.equal(own.judging.judges[0].feedback, 'Comentario de su evaluación.');
  assert.deepEqual(own.photos.items.map(photo => photo.id), ['approved-photo']);
  assert.doesNotMatch(JSON.stringify(data), /COMENTARIO PRIVADO|draft-photo|other-photo/);
  assert.equal(headers.get('cache-control'), 'private, no-store');
  const photo = await f.asset('approved-photo'); assert.equal(photo.data.length, preparedPhoto.length);
  await f.asset('approved-sheet'); await f.asset('draft-photo', 404); await f.asset('other-photo', 404);
  assert.equal(f.db.sqlite.prepare("SELECT published FROM participant_portal_assets WHERE id='draft-photo'").get().published, 0);
  assert.equal(f.sourceFingerprint(), before);
});

test('reopening retracts the result and both direct file routes while preserving all data and QR grants', async t => {
  const f = await fixture(t); await f.close();
  const grants = f.db.sqlite.prepare('SELECT * FROM participant_portal_access ORDER BY id').all();
  const assets = f.db.sqlite.prepare('SELECT * FROM participant_portal_assets ORDER BY id').all();
  const before = f.sourceFingerprint();
  await f.admin({ action: 'block.reopen', eventId: editionId, blockId: 'b1' });
  assertHidden((await f.me()).data);
  await f.asset('approved-photo', 404); await f.asset('approved-sheet', 404);
  assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM participant_portal_access ORDER BY id').all(), grants);
  assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM participant_portal_assets ORDER BY id').all(), assets);
  assert.equal(f.sourceFingerprint(), before);
  await f.close(); assert.equal((await f.me()).data.routines[0].judging.status, 'available');
});

test('a grade changed after closure withdraws the whole block until a fresh review is closed', async t => {
  const f = await fixture(t); await f.close();
  f.core.scores[1].value = 45;
  assertHidden((await f.me()).data);
  await f.asset('approved-photo', 404); await f.asset('approved-sheet', 404);
  assert.equal((await f.review()).data.selectedBlock.state, 'changed');
  await f.close();
  const own = (await f.me()).data.routines[0]; assert.equal(own.result.place, 2); assert.equal(own.judging.status, 'available');
});

test('hidden editions and galleries disabled by their operator remain hidden after closing', async t => {
  const f = await fixture(t, { published: false, photosPublished: false }); await f.close();
  assert.equal(f.db.sqlite.prepare('SELECT published FROM participant_portal_events WHERE id=?').get(editionId).published, 0);
  assertHidden((await f.me()).data);
  await f.asset('approved-photo', 404); await f.asset('approved-sheet', 404);
  const preview = await f.request(`/api/registration/admin/participant-portal?preview=1&eventId=${editionId}&participantId=person-a`, { cookie: adminCookie });
  assert.equal(preview.data.adminPreview, true); assert.equal(preview.data.routines[0].judging.status, 'available');
  await f.admin({ action: 'event.upsert', event: { id: editionId, title: 'Levitate de prueba', season: 'Otoño 2026', venue: 'edomex', published: true } });
  const own = (await f.me()).data.routines[0]; assert.equal(own.judging.status, 'available'); assert.deepEqual(own.photos.items, []);
  await f.asset('approved-photo', 404);
});

test('individual publication preserves its previous completion rules and the new controls still require an admin', async t => {
  const f = await fixture(t, { partial: true, mode: 'individual' });
  f.db.sqlite.prepare("UPDATE participant_portal_routines SET status='published'").run();
  const own = (await f.me()).data.routines[0];
  assert.equal(own.result.status, 'published'); assert.equal(own.result.place, null);
  assert.equal(own.judging.status, 'available'); assert.equal(own.photos.items.length, 1);
  await f.asset('approved-photo');
  await f.request(`/api/registration/admin/participant-portal?publication=1&eventId=${editionId}`, { expected: 401 });
  await f.request('/api/registration/admin/participant-portal', { method: 'POST', cookie: 'levitate_registration_session=academy-user-session',
    body: { action: 'block.close', eventId: editionId, blockId: 'b1' }, expected: 403 });
});

const withdrawals = {
  'reopening the block': f => f.admin({ action: 'block.reopen', eventId: editionId, blockId: 'b1' }),
  'withdrawing file approval': (f, assetId) => f.admin({ action: 'asset.publish', assetId, published: false }),
  'hiding the edition': f => f.admin({ action: 'event.upsert', event: {
    id: editionId, title: 'Levitate de prueba', season: 'Otoño 2026', venue: 'edomex', published: false,
  } }),
  'unpublishing the routine': f => f.admin({ action: 'routine.unpublish', routineId: 'portal-a' }),
};
for (const assetId of ['approved-photo', 'approved-sheet']) {
  for (const [label, withdraw] of Object.entries(withdrawals)) {
    test(`${label} while storage is reading ${assetId} returns no private file bytes`, { timeout: 5000 }, async t => {
      const f = await fixture(t); await f.close();
      const pending = f.delayNextStorageRead();
      const download = f.asset(assetId, 404);
      await pending.entered;
      try { await withdraw(f, assetId); }
      finally { pending.release(); }
      const response = await download;
      assert.match(response.headers.get('content-type'), /application\/json/);
      assert.equal(response.data.error.code, 'portal_asset_not_found');
      assert.equal(response.data instanceof Uint8Array, false);
      assert.doesNotMatch(JSON.stringify(response.data), /Synthetic approved sheet|sha256|base64|object_key/);
    });
  }
}

test('an individual routine withdrawal overrides its already-closed block without removing records', async t => {
  const f = await fixture(t); await f.close();
  assert.equal((await f.me()).data.routines[0].judging.status, 'available');
  const counts = f.db.sqlite.prepare(`SELECT
    (SELECT count(*) FROM participant_portal_routines) AS routines,
    (SELECT count(*) FROM participant_portal_assets) AS assets,
    (SELECT count(*) FROM participant_portal_access) AS accesses`).get();
  await f.admin({ action: 'routine.unpublish', routineId: 'portal-a' });
  assertHidden((await f.me()).data);
  await f.asset('approved-photo', 404); await f.asset('approved-sheet', 404);
  assert.deepEqual(f.db.sqlite.prepare(`SELECT
    (SELECT count(*) FROM participant_portal_routines) AS routines,
    (SELECT count(*) FROM participant_portal_assets) AS assets,
    (SELECT count(*) FROM participant_portal_access) AS accesses`).get(), counts);
  assert.equal((await f.review()).data.selectedBlock.state, 'closed', 'withdrawing one presentation preserves the audited block closure');
});
