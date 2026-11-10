import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import sharp from 'sharp';
import worker from '../worker/index.js';
import { handleParticipantPortal } from '../worker/participant-portal.js';
import { validatePreparedParticipantPhoto } from '../shared/participant-photo-watermark.js';

const endpoint = '/api/registration/admin/participant-portal';
const adminCookie = 'levitate_registration_session=admin-session';
const editionId = 'automatic-photos-test';
const rawSource = new Uint8Array(await sharp({ create: { width: 512, height: 320, channels: 3, background: '#606060' } }).png().toBuffer());
const archivalSource = new Uint8Array(await readFile(new URL('../public/assets/visuals/community-blue-silks.jpg', import.meta.url)));

class D1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.queries = []; }
  prepare(sql) {
    this.queries.push(sql);
    assert.doesNotMatch(sql, /^\s*(CREATE|ALTER|DROP|PRAGMA)\b/i, 'HTTP handlers must not alter schema');
    const statement = this.sqlite.prepare(sql); let values = [];
    const prepared = { bind(...input) { values = input; return prepared; },
      async first() { const result = statement.get(...values); return result ? { ...result } : null; },
      async all() { return { results: statement.all(...values).map(row => ({ ...row })) }; },
      sync() { const result = statement.run(...values); return { success: true, meta: { changes: result.changes } }; },
      async run() { return prepared.sync(); } };
    return prepared;
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try { const result = statements.map(statement => statement.sync()); this.sqlite.exec('COMMIT'); return result; }
    catch (cause) { this.sqlite.exec('ROLLBACK'); throw cause; }
  }
}

// This fixture performs real raster compositing for the subset of the native
// Images binding used by the production processor; no pre-marked JPEG is fed in.
function imagesBinding(state) {
  class Handle {
    constructor(stream) { this.source = new Response(stream).arrayBuffer().then(value => Buffer.from(value)); this.transforms = []; this.layers = []; }
    transform(options) { this.transforms.push(options); return this; }
    draw(handle, options) { this.layers.push({ handle, options }); return this; }
    async pixels() {
      let image = sharp(await this.source).rotate();
      for (const options of this.transforms) {
        if (options.width || options.height) image = image.resize({ width: options.width, height: options.height, fit: 'inside', withoutEnlargement: options.fit === 'scale-down' });
        if (options.blur) image = image.blur(options.blur);
      }
      return image.png().toBuffer();
    }
    async output(options) {
      state.generations++;
      const layers = await Promise.all(this.layers.map(async ({ handle, options: drawing }) => ({ input: await handle.pixels(), tile: drawing.repeat === true, blend: 'over' })));
      const bytes = await sharp(await this.pixels()).composite(layers).jpeg({ quality: options.quality }).toBuffer();
      await state.onProcess?.();
      return { response: () => new Response(bytes, { headers: { 'content-type': options.format } }) };
    }
  }
  return { input(stream) { return new Handle(stream); }, async info(stream) {
    const bytes = Buffer.from(await new Response(stream).arrayBuffer()), info = await sharp(bytes).metadata();
    return { width: info.width, height: info.height, format: info.format, fileSize: bytes.length };
  } };
}

async function fixture(t, { published = true, demo = false, seeded = true } = {}) {
  const db = new D1(); t.after(() => db.sqlite.close());
  db.sqlite.exec(await readFile(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  db.sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES('academy','Academia Prueba','Responsable','test@example.test');
    INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,email_confirmed_at)
      VALUES('admin','academy','Admin','admin','admin@example.test','unused','admin',datetime('now')),
        ('academy-user','academy','Academia','academy','academy@example.test','unused','academy',datetime('now'));
    INSERT INTO registration_participants(id,academy_id,full_name,curp,division,shirt_size)
      VALUES('person-a','academy','Alison Prueba','PRUA000000MXXAAA00','teen','s'),('person-b','academy','Otra Persona','PRUB000000MXXAAA00','teen','m');
    INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue)
      VALUES('dance-a','academy','Beyond the strings','aereo','tela','solo','intermedio','edomex'),('dance-b','academy','Otra rutina','aereo','aro','solo','intermedio','edomex');
    INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-a','person-a'),('dance-b','person-b');`);
  const digest = async text => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).toString('hex');
  for (const actor of ['admin', 'academy-user']) db.sqlite.prepare("INSERT INTO registration_sessions(id,user_id,session_token_hash,expires_at) VALUES(?,?,?,datetime('now','+1 day'))")
    .run(actor, actor, await digest(actor + '-session'));
  db.sqlite.prepare('INSERT INTO participant_portal_events(id,title,season,venue,published) VALUES(?,?,?,?,?)')
    .run(editionId, 'Levitate de prueba', 'Otoño 2026', 'edomex', published ? 1 : 0);
  const state = { contexts: [], prepared: [], generations: 0, mediaStoreCalls: 0, sourceReads: 0, seeded, demo, objects: new Map() };
  const storage = { info: { provider: 'google_drive', ready: true }, async put(key, bytes, options) {
    const objectKey = `google_drive:private_generated_${state.objects.size + 1}`;
    state.objects.set(objectKey, { bytes: new Uint8Array(bytes), options });
    await state.onStore?.(); return { objectKey };
  }, async get(key) { const file = state.objects.get(key); return file ? { body: file.bytes, size: file.bytes.length, customMetadata: file.options.customMetadata } : null; },
  async delete() { throw new Error('Private Drive drafts must remain recoverable'); } };
  const discovery = { async discover(context) {
    state.contexts.push(context);
    if (!state.seeded || (state.demo && !context.adminPreview)) return { albums: [] };
    return { albums: context.dances.map(dance => ({ id: 'private_source_album', danceId: dance.id, name: 'Private source album', demo: state.demo, trusted: true,
      photos: [{ id: `private-source-${dance.id}`, revision: 'source-version-1', name: 'Original-photo.png', mimeType: 'image/png', width: 512, height: 320,
        async read() { state.sourceReads++; await state.onSource?.(); return { bytes: rawSource, contentType: 'image/png' }; } }] })) };
  }, async prepareDemoSource(input) {
    state.prepared.push(input); state.seeded = true;
    return { folderId: 'private_source_album', folderName: 'Beyond the strings · Alison Prueba · Academia Prueba · DEMO',
      folderUrl: 'https://drive.google.com/drive/folders/private_source_album', sourceId: 'private-source-dance-a' };
  } };
  const env = { DB: db, IMAGES: imagesBinding(state), PARTICIPANT_REGISTRATION_EVENT_IDS: editionId, PARTICIPANT_MEDIA_DRIVE_ACCOUNT_EMAIL: 'photos@example.test',
    ASSETS: { async fetch(request) { assert.equal(new URL(request.url).pathname, '/assets/visuals/community-blue-silks.jpg'); return new Response(archivalSource, { headers: { 'content-type': 'image/jpeg' } }); } } };
  const options = { getPhotoDiscovery: async () => discovery, getMediaStore: async () => { state.mediaStoreCalls++; return storage; },
    // Use the actual registration middleware through a read-only Worker request
    // instead of replacing authentication with a hardcoded successful guard.
    requireAdmin: async request => {
      const check = await worker.fetch(new Request('https://levitate.test' + endpoint, { headers: { cookie: request.headers.get('cookie') || '' } }), env);
      if (!check.ok) {
        const failure = await check.json(); throw Object.assign(new Error(failure.error.message), { code: failure.error.code, statusCode: check.status });
      }
      return { session: { user: { id: 'admin' } } };
    } };
  async function call(path, { body, cookie, expected = 200, native = false, origin } = {}) {
    const request = new Request('https://levitate.test' + path, { method: body !== undefined ? 'POST' : 'GET',
      headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const response = native ? await worker.fetch(request, env) : await handleParticipantPortal(request, env, options);
    const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : new Uint8Array(await response.arrayBuffer());
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
    return { data, response };
  }
  const admin = (body, expected = 200) => call(endpoint, { body, cookie: adminCookie, expected });
  const access = async (participantId = 'person-a') => {
    const grant = await call(endpoint, { body: { action: 'access.create', eventId: editionId, participantId }, cookie: adminCookie, native: true });
    const exchanged = await call('/api/participant/access/exchange', { body: { token: grant.data.token }, native: true });
    return { cookie: exchanged.response.headers.get('set-cookie').split(';')[0], grant: grant.data };
  };
  const sync = (cookie, extra = {}, expected = 200) => call('/api/participant/photos/sync', { cookie, body: { eventId: editionId, ...extra }, expected });
  const adminSync = () => admin({ action: 'photo.sync', participantId: 'person-a', eventId: editionId });
  const revoke = () => db.sqlite.prepare("UPDATE participant_portal_access SET active=0 WHERE participant_id='person-a'").run();
  return { db, env, state, storage, call, admin, access, sync, adminSync, revoke };
}

test('automatic photo routes require real admin or personal sessions and reject foreign identities before discovery', async t => {
  const f = await fixture(t);
  for (const action of ['photo.sync', 'photo.source.demo.prepare']) {
    const body = { action, eventId: editionId, participantId: 'person-a', danceId: 'dance-a' };
    await f.call(endpoint, { body, expected: 401, native: true });
    await f.call(endpoint, { body, cookie: 'levitate_registration_session=academy-user-session', expected: 403, native: true });
  }
  await f.call('/api/participant/photos/sync', { body: {}, expected: 401, native: true });
  const { cookie } = await f.access();
  await f.sync(cookie, { participantId: 'person-b' }, 404);
  await f.sync(cookie, { eventId: 'other-event' }, 404);
  await f.call('/api/participant/photos/sync', { cookie, body: { eventId: editionId }, origin: 'https://attacker.test', expected: 403 });
  assert.equal(f.state.contexts.length, 0); assert.equal(f.state.generations, 0);
});

test('a personal passport generates and stores a real marked JPEG for only its own database membership', async t => {
  const f = await fixture(t), { cookie } = await f.access(), other = await f.access('person-b');
  const response = await f.sync(cookie);
  assert.equal(response.data.imported, 1); assert.equal(response.data.participantId, 'person-a');
  const scope = f.state.contexts[0];
  assert.deepEqual(scope.dances, [{ id: 'dance-a', title: 'Beyond the strings' }]);
  assert.equal(scope.participantName, 'Alison Prueba'); assert.equal(scope.academyName, 'Academia Prueba'); assert.equal(scope.adminPreview, false);
  assert.equal(f.state.generations, 1); assert.equal(f.state.objects.size, 1);
  assert.equal(f.state.mediaStoreCalls, 1, 'generation reuses the request-scoped private store');
  const asset = f.db.sqlite.prepare('SELECT * FROM participant_portal_assets').get();
  const stored = f.state.objects.get(asset.object_key);
  const prepared = await validatePreparedParticipantPhoto(stored.bytes);
  assert.equal(prepared.sha256, asset.sha256); assert.notDeepEqual(stored.bytes, rawSource);
  const { data } = await sharp(stored.bytes).raw().toBuffer({ resolveWithObject: true });
  assert.ok(Math.max(...data.subarray(0, 100000)) - Math.min(...data.subarray(0, 100000)) > 35, 'watermark changes the flat source pixels');
  assert.doesNotMatch(JSON.stringify(response.data), /google_drive|googleapis|private-source|Original-photo/);
  assert.equal((await f.call('/api/participant/me', { cookie: other.cookie })).data.routines[0].photos.count, 0);
  await f.call('/api/participant/assets/' + asset.id, { cookie: other.cookie, expected: 404 });
});

test('generated assets continue to obey routine, block and edition publication gates', async t => {
  const f = await fixture(t), { cookie } = await f.access();
  await f.sync(cookie);
  const routine = f.db.sqlite.prepare('SELECT * FROM participant_portal_routines').get();
  const asset = f.db.sqlite.prepare('SELECT * FROM participant_portal_assets').get();
  assert.equal((await f.call('/api/participant/me', { cookie })).data.routines[0].photos.count, 0, 'new draft routine stays hidden');
  await f.admin({ action: 'routine.publish', routineId: routine.id });
  assert.equal((await f.call('/api/participant/me', { cookie })).data.routines[0].photos.count, 1);
  const image = await f.call('/api/participant/assets/' + asset.id, { cookie });
  assert.equal(image.response.headers.get('content-type'), 'image/jpeg');
  assert.equal(image.response.headers.get('cache-control'), 'private, no-store');
  f.db.sqlite.prepare("INSERT INTO participant_portal_publication_settings(event_id,mode,operation_nonce) VALUES(?,'block_close','test-operation')").run(editionId);
  assert.equal((await f.call('/api/participant/me', { cookie })).data.routines[0].photos.count, 0, 'uncleared block keeps generated assets pending');
  await f.call('/api/participant/assets/' + asset.id, { cookie, expected: 404 });
  f.db.sqlite.prepare("UPDATE participant_portal_publication_settings SET mode='individual' WHERE event_id=?").run(editionId);
  f.db.sqlite.prepare('UPDATE participant_portal_events SET published=0 WHERE id=?').run(editionId);
  assert.equal((await f.call('/api/participant/me', { cookie })).data.routines[0].photos.count, 0);
  await f.call('/api/participant/assets/' + asset.id, { cookie, expected: 404 });
});

test('opening an admin passport for a hidden edition generates only draft demo previews without altering QR or results', async t => {
  const f = await fixture(t, { published: false, demo: true });
  const { cookie } = await f.access();
  const grants = f.db.sqlite.prepare('SELECT * FROM participant_portal_access').all();
  const response = await f.adminSync(); assert.equal(response.data.imported, 1);
  const asset = f.db.sqlite.prepare('SELECT * FROM participant_portal_assets').get();
  const routine = f.db.sqlite.prepare('SELECT * FROM participant_portal_routines').get();
  assert.equal(asset.published, 0); assert.equal(routine.status, 'draft'); assert.equal(routine.photos_published, 0);
  assert.equal(routine.source_event_id, null); assert.equal(routine.result_json, null);
  assert.match(asset.caption, /demostración/);
  assert.equal(f.db.sqlite.prepare('SELECT published FROM participant_portal_events').get().published, 0);
  assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM participant_portal_access').all(), grants);
  const preview = await f.call(`${endpoint}?preview=1&eventId=${editionId}&participantId=person-a`, { cookie: adminCookie });
  assert.equal(preview.data.routines[0].photos.count, 1);
  await f.call(preview.data.routines[0].photos.items[0].previewUrl, { cookie: adminCookie });
  await f.call('/api/participant/assets/' + asset.id, { cookie, expected: 404 });
});

test('revoking the participant during Drive, processing or storage prevents a successful sync or published asset', async t => {
  for (const stage of ['onSource', 'onProcess', 'onStore']) await t.test(stage, async subtest => {
    const f = await fixture(subtest), { cookie } = await f.access();
    f.state[stage] = f.revoke;
    const response = await f.sync(cookie, {}, 401);
    assert.doesNotMatch(JSON.stringify(response.data), /google_drive|googleapis|private-source|previewUrl|bytes/);
    assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM participant_portal_assets WHERE published=1').get().n, 0);
    await f.call('/api/participant/me', { cookie, expected: 401 });
    if (stage === 'onSource') assert.equal(f.state.generations, 0);
    if (stage !== 'onStore') assert.equal(f.state.objects.size, 0);
  });
});

test('reopening and checking after cache expiry reuse the generated preview without another transformation', async t => {
  const f = await fixture(t), { cookie } = await f.access();
  await f.sync(cookie);
  const originalAsset = f.db.sqlite.prepare('SELECT id FROM participant_portal_assets').get().id;
  assert.equal((await f.sync(cookie)).data.imported, 0);
  f.db.sqlite.prepare('UPDATE participant_portal_drive_sync SET next_check_at=NULL').run();
  assert.equal((await f.sync(cookie)).data.imported, 0);
  assert.equal(f.state.generations, 1); assert.equal(f.state.sourceReads, 1); assert.equal(f.state.objects.size, 1);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM participant_portal_assets').get().n, 1);
  assert.equal(f.db.sqlite.prepare('SELECT id FROM participant_portal_assets').get().id, originalAsset);
});

test('source preparation seeds the fixed unmarked archival photo but defers processing until passport sync', async t => {
  const f = await fixture(t, { published: false, demo: true, seeded: false });
  const response = await f.admin({ action: 'photo.source.demo.prepare', eventId: editionId, participantId: 'person-a', danceId: 'dance-a', sourcePath: '/private/photo.jpg' });
  assert.equal(response.data.imported, 0); assert.equal(f.state.prepared.length, 1);
  const input = f.state.prepared[0];
  assert.equal(input.participantName, 'Alison Prueba'); assert.equal(input.academyName, 'Academia Prueba');
  assert.equal(input.danceId, 'dance-a'); assert.equal(input.eventId, editionId); assert.deepEqual(input.bytes, archivalSource);
  assert.equal(f.state.generations, 0); assert.equal(f.state.objects.size, 0);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM participant_portal_assets').get().n, 0);
  const later = await f.adminSync(); assert.equal(later.data.imported, 1); assert.equal(f.state.generations, 1);
});
