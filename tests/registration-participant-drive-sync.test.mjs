import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { syncParticipantDrivePhotos } from '../worker/participant-drive-sync.js';
import { validatePreparedParticipantPhoto } from '../shared/participant-photo-watermark.js';

const marked = await validatePreparedParticipantPhoto(new Uint8Array(await readFile(new URL('./fixtures/participant-photo-prepared.jpg', import.meta.url))));
const raw = new Uint8Array(await readFile(new URL('./fixtures/participant-photo-source.png', import.meta.url)));

class D1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); }
  prepare(sql) {
    assert.doesNotMatch(sql, /^\s*(?:CREATE|ALTER|DROP|PRAGMA)\b/i);
    const prepared = this.sqlite.prepare(sql); let bindings = [];
    const query = { bind(...values) { bindings = values; return query; }, async first() { const row = prepared.get(...bindings); return row ? { ...row } : null; },
      async all() { return { results: prepared.all(...bindings).map(row => ({ ...row })) }; },
      sync() { const r = prepared.run(...bindings); return { success: true, meta: { changes: r.changes } }; }, async run() { return query.sync(); } };
    return query;
  }
  async batch(queries) { this.sqlite.exec('BEGIN'); try { const result = queries.map(query => query.sync()); this.sqlite.exec('COMMIT'); return result; }
    catch (cause) { this.sqlite.exec('ROLLBACK'); throw cause; } }
}
async function fixture(t, { hidden = false, admin = false, demo = false, photos = 1 } = {}) {
  const db = new D1(); t.after(() => db.sqlite.close());
  db.sqlite.exec(await readFile(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  db.sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES('academy-a','Academia Prueba','Responsable','a@example.test');
    INSERT INTO registration_participants(id,academy_id,full_name,curp,division,shirt_size)
      VALUES('person-a','academy-a','Alison Prueba','PRUA000000MXXAAA00','teen','s'),('person-b','academy-a','Otra Persona','PRUB000000MXXAAA00','teen','m');
    INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue)
      VALUES('dance-a','academy-a','Vuelo','aereo','tela','solo','intermedio','edomex'),('dance-b','academy-a','Otra pieza','aereo','aro','solo','intermedio','edomex');
    INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-a','person-a'),('dance-b','person-b');
    INSERT INTO participant_portal_events(id,title,season,venue,published) VALUES('edition','Levitate','Otoño','edomex',${hidden ? 0 : 1});`);
  const calls = { authorization: 0, discovery: [], reads: 0, processing: 0, uploads: [] };
  const album = { id: 'private-folder', danceId: 'dance-a', name: 'Vuelo · Alison Prueba · Academia Prueba', demo, trusted: true,
    photos: Array.from({ length: photos }, (_, i) => ({ id: `source-file-${i+1}`, revision: 'revision-1', name: `foto-${i+1}.png`, mimeType: 'image/png',
      async read() { calls.reads++; return { bytes: raw, contentType: 'image/png' }; } })) };
  const options = { db, env: { PARTICIPANT_REGISTRATION_EVENT_IDS: 'edition' }, participantId: 'person-a', eventId: 'edition', adminPreview: admin,
    assertAuthorized: async () => { calls.authorization++; },
    getDiscovery: async () => ({ async discover(context) { calls.discovery.push(context); return { albums: [album] }; } }),
    getMediaStore: async () => ({ info: { provider: 'google_drive' } }),
    processPhoto: async () => { calls.processing++; return marked; },
    uploadPreview: async input => {
      calls.uploads.push(input);
      const prepared = await validatePreparedParticipantPhoto(input.bytes);
      db.sqlite.prepare(`INSERT INTO participant_portal_assets(id,event_id,routine_id,kind,object_key,file_name,content_type,sha256,byte_size,width,height,caption)
        VALUES(?,?,?,'photo',?,'preview.jpg','image/jpeg',?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).run(input.uploadId, input.eventId, input.routineId,
        'google_drive:'+input.uploadId, prepared.sha256, prepared.bytes.length, prepared.width, prepared.height, input.caption);
      return { assetId: input.uploadId };
    } };
  const run = changes => syncParticipantDrivePhotos({ ...options, ...changes });
  const rows = table => db.sqlite.prepare('SELECT * FROM '+table).all().map(row => ({ ...row }));
  const expire = () => db.sqlite.exec("UPDATE participant_portal_drive_sync SET next_check_at=NULL,lease_token=NULL,lease_until=NULL");
  return { db, calls, options, album, run, rows, expire };
}

test('automatic Drive lookup authenticates before reading participant context or making upstream calls', async t => {
  const f = await fixture(t);
  await assert.rejects(f.run({ assertAuthorized: async () => { throw Object.assign(new Error('Sign in'), { statusCode: 401 }); } }), { statusCode: 401 });
  assert.equal(f.calls.discovery.length, 0); assert.equal(f.rows('participant_portal_drive_sync').length, 0);
  await assert.rejects(f.run({ assertAuthorized: undefined }), { statusCode: 503 });
});

test('opening a hidden participant passport does not search Drive or mutate import metadata', async t => {
  const f = await fixture(t, { hidden: true });
  const result = await f.run();
  assert.equal(result.status, 'pending'); assert.equal(result.imported, 0);
  assert.equal(f.calls.discovery.length, 0); assert.equal(f.rows('participant_portal_drive_sync').length, 0);
});

test('admin passport preparation generates a protected demo draft while keeping edition, grades and QR state unchanged', async t => {
  const f = await fixture(t, { hidden: true, admin: true, demo: true });
  f.db.sqlite.exec(`INSERT INTO participant_portal_routines(id,event_id,dance_id,status,result_json,judging_json,source_event_id,source_routine_id,revision)
    VALUES('routine-a','edition','dance-a','published','{"score":20}','{"original":true}','core-event','42',7);
    INSERT INTO participant_portal_access(id,participant_id,event_id,token_hash) VALUES('original-grant','person-a','edition','original-token');`);
  const before = f.rows('participant_portal_routines'), qr = f.rows('participant_portal_access');
  const result = await f.run();
  assert.deepEqual(result, { status: 'ready', imported: 1, hasMore: false, participantId: 'person-a', eventId: 'edition' });
  assert.equal(f.calls.processing, 1); assert.equal(f.calls.reads, 1);
  assert.equal(f.rows('participant_portal_assets')[0].published, 0);
  assert.match(f.rows('participant_portal_assets')[0].caption, /demostración/);
  assert.deepEqual(f.rows('participant_portal_routines'), before);
  assert.deepEqual(f.rows('participant_portal_access'), qr);
  assert.equal(f.rows('participant_portal_events')[0].published, 0);
  assert.doesNotMatch(JSON.stringify(result), /source-file|private-folder|google_drive|googleapis/);
});

test('a published passport automatically discovers by full name and academy, approves only its trusted preview and throttles repeat reads', async t => {
  const f = await fixture(t);
  const result = await f.run();
  assert.equal(result.status, 'ready'); assert.equal(result.imported, 1);
  assert.equal(f.calls.discovery[0].participantName, 'Alison Prueba');
  assert.equal(f.calls.discovery[0].academyName, 'Academia Prueba');
  assert.deepEqual(f.calls.discovery[0].dances, [{ id: 'dance-a', title: 'Vuelo' }]);
  assert.equal(f.rows('participant_portal_assets')[0].published, 1);
  assert.equal(f.rows('participant_portal_routines')[0].photos_published, 1);
  assert.equal(f.rows('participant_portal_routines')[0].status, 'draft', 'photo import never publishes grades');
  const retry = await f.run(); assert.equal(retry.status, 'ready'); assert.equal(retry.imported, 0); assert.equal(f.calls.processing, 1); assert.equal(f.calls.discovery.length, 1);
  f.expire();
  const later = await f.run(); assert.equal(later.imported, 0); assert.equal(f.calls.processing, 1);
  assert.deepEqual(f.calls.discovery[1].knownBindings, { 'dance-a': { folderId: 'private-folder' } });
  assert.equal(f.rows('participant_portal_assets').length, 1);
});

test('an error cooldown remains unavailable without retrying Drive or pretending photos are ready', async t => {
  const f = await fixture(t);
  f.options.getDiscovery = async () => ({ async discover(context) {
    f.calls.discovery.push(context);
    throw Object.assign(new Error('Private source'), { code: 'portal_photo_source_not_private' });
  } });
  const failed = await f.run(); assert.equal(failed.status, 'unavailable');
  const before = f.rows('participant_portal_drive_sync')[0];
  assert.equal(before.last_error, 'portal_photo_source_not_private');
  const retry = await f.run();
  assert.equal(retry.status, 'unavailable'); assert.equal(retry.hasMore, false); assert.equal(retry.imported, 0);
  assert.equal(f.calls.discovery.length, 1); assert.equal(f.calls.reads, 0); assert.equal(f.calls.processing, 0);
  const after = f.rows('participant_portal_drive_sync')[0];
  assert.equal(after.next_check_at, before.next_check_at); assert.equal(after.last_error, before.last_error);
});

test('an empty album cooldown stays pending without another Drive lookup', async t => {
  const f = await fixture(t, { photos: 0 });
  assert.equal((await f.run()).status, 'pending');
  const retry = await f.run();
  assert.equal(retry.status, 'pending'); assert.equal(retry.hasMore, false); assert.equal(retry.imported, 0);
  assert.equal(f.calls.discovery.length, 1); assert.equal(f.calls.reads, 0);
});

test('cooldown readiness requires an approved ready preview from a current member dance', async t => {
  for (const change of [
    "UPDATE participant_portal_assets SET published=0",
    "UPDATE participant_portal_routines SET photos_published=0",
    "UPDATE participant_portal_routines SET publication_blocked=1",
    "UPDATE participant_portal_drive_files SET status='failed'",
    "UPDATE participant_portal_drive_files SET publication_policy='held'",
    "UPDATE participant_portal_drive_files SET source_version='old-watermark:revision-1'",
    "INSERT INTO participant_portal_drive_album_settings(event_id,dance_id,publication_paused) VALUES('edition','dance-a',1)",
    "UPDATE registration_dance_participants SET dance_id='dance-b' WHERE participant_id='person-a'",
  ]) {
    const f = await fixture(t); await f.run();
    f.db.sqlite.exec(change);
    const retry = await f.run();
    assert.equal(retry.status, 'pending', change);
    assert.equal(retry.imported, 0); assert.equal(retry.hasMore, false);
    assert.equal(f.calls.discovery.length, 1); assert.equal(f.calls.processing, 1);
  }
});

test('a cooldown can report an existing private draft ready only to administrative preview', async t => {
  const f = await fixture(t, { admin: true }); await f.run();
  assert.equal(f.rows('participant_portal_assets')[0].published, 0);
  assert.equal((await f.run()).status, 'ready');
  assert.equal((await f.run({ adminPreview: false })).status, 'pending');
  assert.equal(f.calls.discovery.length, 1); assert.equal(f.calls.processing, 1);
});

test('one photo per request bounds processing and subsequent opens finish the selected two previews', async t => {
  const f = await fixture(t, { photos: 4 });
  const first = await f.run(); assert.equal(first.imported, 1); assert.equal(first.hasMore, true);
  const second = await f.run(); assert.equal(second.imported, 1); assert.equal(second.hasMore, false);
  assert.equal(f.calls.processing, 2); assert.equal(f.rows('participant_portal_assets').length, 2);
  assert.equal(f.rows('participant_portal_drive_files').length, 2);
});

test('photo sync fills two global slots from available member dances and uses group size only to resolve extra choices', async t => {
  for (const [soloCount, groupCount, expected] of [
    [0, 1, ['dance-b']],
    [0, 2, ['dance-b', 'dance-b']],
    [1, 1, ['dance-a', 'dance-b']],
    [1, 3, ['dance-a', 'dance-b']],
    [3, 3, ['dance-a', 'dance-a']],
  ]) {
    const f = await fixture(t, { photos: 3 });
    f.db.sqlite.exec("INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-b','person-a')");
    const duet = { ...f.album, id: 'duet-folder', danceId: 'dance-b',
      photos: f.album.photos.slice(0, groupCount).map((photo, index) => ({ ...photo, id: `duet-file-${index + 1}` })) };
    f.album.photos = f.album.photos.slice(0, soloCount);
    f.options.getDiscovery = async () => ({ async discover(context) {
      f.calls.discovery.push(context);
      return { albums: [duet, f.album] };
    } });
    const first = await f.run();
    assert.deepEqual(f.calls.discovery[0].dances, [{ id: 'dance-a', title: 'Vuelo' }, { id: 'dance-b', title: 'Otra pieza' }]);
    assert.equal(f.calls.discovery[0].maxPhotos, 2);
    assert.equal(first.imported, 1); assert.equal(first.hasMore, expected.length > 1);
    if (first.hasMore) {
      const second = await f.run(); assert.equal(second.imported, 1); assert.equal(second.hasMore, false);
    }
    assert.equal(f.calls.reads, expected.length); assert.equal(f.calls.processing, expected.length);
    assert.deepEqual(f.rows('participant_portal_drive_files').map(file => file.dance_id), expected);
    const retry = await f.run(); assert.equal(retry.imported, 0); assert.equal(retry.status, 'ready');
    assert.equal(f.calls.discovery.length, expected.length);
  }
});

test('concurrent openings share the participant lease and process one source only', async t => {
  const f = await fixture(t);
  let proceed;
  const original = f.options.processPhoto;
  const waiting = new Promise(resolve => { proceed = resolve; });
  const first = f.run({ processPhoto: async (...args) => { await waiting; return original(...args); } });
  while (!f.calls.reads) await new Promise(resolve => setImmediate(resolve));
  const second = await f.run(); assert.equal(second.status, 'checking'); assert.equal(second.imported, 0); assert.equal(second.hasMore, true);
  proceed(); await first;
  assert.equal(f.calls.processing, 1); assert.equal(f.rows('participant_portal_assets').length, 1);
});

test('participants sharing one dance also share the source-file lease', async t => {
  const f = await fixture(t);
  f.db.sqlite.exec(`DELETE FROM registration_dance_participants WHERE dance_id='dance-b' AND participant_id='person-b';
    INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-a','person-b')`);
  let proceed;
  const waiting = new Promise(resolve => { proceed = resolve; });
  const first = f.run({ processPhoto: async () => { await waiting; return marked; } });
  while (!f.calls.reads) await new Promise(resolve => setImmediate(resolve));
  const second = await f.run({ participantId: 'person-b' });
  assert.equal(second.status, 'checking'); assert.equal(second.imported, 0);
  assert.equal(second.hasMore, true);
  proceed(); await first;
  assert.equal(f.rows('participant_portal_assets').length, 1);
});

test('a revoked grant or removed membership during processing cannot upload or approve a photo', async t => {
  for (const revoked of [true, false]) {
    const f = await fixture(t);
    let invalid = false;
    const result = f.run({ assertAuthorized: async () => { if (invalid && revoked) throw Object.assign(new Error('Revoked'), { statusCode: 401 }); },
      processPhoto: async () => { invalid = true; if (!revoked) f.db.sqlite.exec("DELETE FROM registration_dance_participants WHERE participant_id='person-a'"); return marked; } });
    if (revoked) await assert.rejects(result, { statusCode: 401 });
    else assert.equal((await result).status, 'unavailable');
    assert.equal(f.calls.uploads.length, 0); assert.equal(f.rows('participant_portal_assets').length, 0);
    assert.equal(f.rows('participant_portal_drive_files')[0].status, 'failed');
  }
});

test('untrusted folders, demo folders for public sessions and unrelated dances cannot import', async t => {
  for (const changes of [{ trusted: false }, { demo: true }, { danceId: 'dance-b' }]) {
    const f = await fixture(t); Object.assign(f.album, changes);
    const result = await f.run();
    assert.equal(result.imported, 0); assert.equal(f.calls.reads, 0); assert.equal(f.calls.processing, 0);
    assert.equal(f.rows('participant_portal_assets').length, 0);
  }
});

test('future editions cannot inherit dances from another edition in the same venue', async t => {
  const f = await fixture(t);
  f.options.env.PARTICIPANT_REGISTRATION_EVENT_IDS = 'another-edition';
  const result = await f.run(); assert.equal(result.status, 'pending'); assert.equal(f.calls.discovery.length, 0);
  assert.equal(f.rows('participant_portal_drive_sync').length, 0);
});

test('ambiguous participant names require an existing folder binding and ambiguous albums fail closed', async t => {
  const f = await fixture(t);
  f.db.sqlite.exec("UPDATE registration_participants SET full_name='ALÍSON   PRUEBA' WHERE id='person-b'");
  const result = await f.run(); assert.equal(result.status, 'pending'); assert.equal(f.calls.discovery.length, 0);
  assert.equal(f.rows('participant_portal_drive_sync')[0].last_error, 'ambiguous_participant');
  const unique = await fixture(t);
  unique.options.getDiscovery = async () => ({ async discover() { return { albums: [unique.album, { ...unique.album, id: 'another-folder' }] }; } });
  const ambiguous = await unique.run(); assert.equal(ambiguous.status, 'unavailable'); assert.equal(unique.calls.processing, 0);
});

test('dance-scoped hierarchy permits identical participant names while database membership still limits the discovered dances', async t => {
  const f = await fixture(t);
  f.db.sqlite.exec("UPDATE registration_participants SET full_name='ALÍSON   PRUEBA' WHERE id='person-b'");
  const legacy = f.options.getDiscovery;
  f.options.getDiscovery = async () => ({ ...await legacy(), identityScope: 'dance' });
  const result = await f.run();
  assert.equal(result.imported, 1); assert.equal(f.calls.discovery.length, 1);
  assert.deepEqual(f.calls.discovery[0].dances, [{ id: 'dance-a', title: 'Vuelo' }]);
  assert.equal(f.rows('participant_portal_assets').length, 1);
  assert.equal(f.rows('participant_portal_drive_files')[0].dance_id, 'dance-a');
  f.expire();
  const outsider = await f.run({ participantId: 'person-b' });
  assert.equal(outsider.imported, 0);
  assert.deepEqual(f.calls.discovery[1].dances, [{ id: 'dance-b', title: 'Otra pieza' }]);
  assert.equal(f.rows('participant_portal_assets').length, 1);
});

test('a manually paused routine keeps its publication block and all existing score fields', async t => {
  const f = await fixture(t);
  f.db.sqlite.exec(`INSERT INTO participant_portal_routines(id,event_id,dance_id,status,result_json,judging_json,photos_published,publication_blocked,revision)
    VALUES('routine-a','edition','dance-a','draft','{"original":123}','{"original":456}',0,1,8)`);
  const original = f.rows('participant_portal_routines');
  const result = await f.run(); assert.equal(result.imported, 1);
  assert.deepEqual(f.rows('participant_portal_routines'), original);
});

test('a bad source is cooled down so it does not prevent processing another valid preview', async t => {
  const f = await fixture(t, { photos: 2 });
  f.album.photos[0].read = async () => { throw Object.assign(new Error('Private upstream error'), { code: 'source_not_available' }); };
  const first = await f.run(); assert.equal(first.status, 'unavailable');
  f.expire();
  const next = await f.run(); assert.equal(next.imported, 1); assert.equal(next.hasMore, false);
  assert.equal(f.rows('participant_portal_drive_files').filter(row => row.status === 'ready').length, 1);
  assert.equal(f.calls.processing, 1);
});

test('revocation while the immutable Drive upload completes leaves its asset as an unapproved private draft', async t => {
  const f = await fixture(t);
  let invalid = false;
  const upload = f.options.uploadPreview;
  await assert.rejects(f.run({
    assertAuthorized: async () => { if (invalid) throw Object.assign(new Error('Revoked'), { statusCode: 401 }); },
    uploadPreview: async input => { const saved = await upload(input); invalid = true; return saved; },
  }), { statusCode: 401 });
  assert.equal(f.rows('participant_portal_assets').length, 1);
  assert.equal(f.rows('participant_portal_assets')[0].published, 0);
  assert.equal(f.rows('participant_portal_routines')[0].photos_published, 0);
  assert.equal(f.rows('participant_portal_drive_files')[0].status, 'failed');
});

test('an expired/replaced file lease cannot upload a preview after processing', async t => {
  const f = await fixture(t);
  const result = await f.run({ processPhoto: async () => {
    f.db.sqlite.exec("UPDATE participant_portal_drive_files SET lease_token='new-owner',lease_until=datetime('now','+120 seconds')");
    return marked;
  } });
  assert.equal(result.status, 'unavailable'); assert.equal(f.calls.uploads.length, 0);
  assert.equal(f.rows('participant_portal_drive_files')[0].lease_token, 'new-owner', 'old request does not clear the newer lease');
});

test('an older watermark protocol does not make a newly required preview look already prepared', async t => {
  const f = await fixture(t);
  f.db.sqlite.exec("INSERT INTO participant_portal_routines(id,event_id,dance_id) VALUES('routine-a','edition','dance-a')");
  await f.options.uploadPreview({ eventId: 'edition', routineId: 'routine-a', uploadId: 'old-watermark-photo', bytes: marked.bytes, caption: 'Legacy preview' });
  f.db.sqlite.exec(`INSERT INTO participant_portal_drive_files(event_id,dance_id,source_file_id,source_version,source_folder_id,asset_id,status)
    VALUES('edition','dance-a','source-file-1','legacy-v1:revision-1','private-folder','old-watermark-photo','ready')`);
  const result = await f.run(); assert.equal(result.imported, 1); assert.equal(f.calls.processing, 1);
  assert.equal(f.rows('participant_portal_assets').length, 2, 'previous recoverable preview is retained');
  assert.equal(f.rows('participant_portal_drive_files').length, 2);
  assert.notEqual(f.rows('participant_portal_drive_files').at(-1).asset_id, 'old-watermark-photo');
});

test('a real preview prepared internally is approved on a later published participant visit without regenerating it', async t => {
  const f = await fixture(t, { hidden: true, admin: true });
  await f.run();
  assert.equal(f.rows('participant_portal_assets')[0].published, 0);
  assert.equal(f.rows('participant_portal_drive_files')[0].publication_policy, 'draft');
  f.db.sqlite.exec("UPDATE participant_portal_events SET published=1 WHERE id='edition'"); f.expire();
  const result = await f.run({ adminPreview: false });
  assert.equal(result.status, 'ready'); assert.equal(result.imported, 0);
  assert.equal(f.calls.processing, 1); assert.equal(f.calls.uploads.length, 1);
  assert.equal(f.rows('participant_portal_assets')[0].published, 1);
  assert.equal(f.rows('participant_portal_routines')[0].photos_published, 1);
  assert.equal(f.rows('participant_portal_routines')[0].status, 'draft');
  assert.equal(f.rows('participant_portal_drive_files')[0].publication_policy, 'automatic');
});

test('a manually hidden automatic asset is never reapproved by a later visit', async t => {
  for (const policy of ['automatic','held']) {
    const f = await fixture(t); await f.run();
    f.db.sqlite.exec(`UPDATE participant_portal_assets SET published=0;
      UPDATE participant_portal_drive_files SET publication_policy='${policy}'`); f.expire();
    const result = await f.run(); assert.equal(result.imported, 0);
    assert.equal(f.rows('participant_portal_assets')[0].published, 0);
    assert.equal(f.calls.processing, 1);
  }
});

test('manual gallery withdrawal keeps newly discovered photos as drafts and resuming promotes them once', async t => {
  const f = await fixture(t); await f.run();
  f.db.sqlite.exec(`UPDATE participant_portal_routines SET photos_published=0;
    INSERT INTO participant_portal_drive_album_settings(event_id,dance_id,publication_paused) VALUES('edition','dance-a',1)`);
  f.album.photos.push({ ...f.album.photos[0], id: 'second-source-file' }); f.expire();
  const result = await f.run(); assert.equal(result.imported, 1);
  assert.equal(f.rows('participant_portal_routines')[0].photos_published, 0);
  const imported = f.rows('participant_portal_drive_files').find(file => file.source_file_id === 'second-source-file');
  assert.equal(imported.publication_policy, 'draft');
  assert.equal(f.rows('participant_portal_assets').find(asset => asset.id === imported.asset_id).published, 0);
  f.db.sqlite.exec('UPDATE participant_portal_drive_album_settings SET publication_paused=0'); f.expire();
  const resumed = await f.run(); assert.equal(resumed.imported, 0); assert.equal(f.calls.processing, 2);
  assert.equal(f.rows('participant_portal_assets').find(asset => asset.id === imported.asset_id).published, 1);
  assert.equal(f.rows('participant_portal_routines')[0].photos_published, 1);
});

test('gallery pause recorded before the first source photo prevents automatic publication until resumed', async t => {
  const f = await fixture(t);
  f.db.sqlite.exec("INSERT INTO participant_portal_drive_album_settings(event_id,dance_id,publication_paused) VALUES('edition','dance-a',1)");
  const result = await f.run(); assert.equal(result.imported, 1);
  assert.equal(f.rows('participant_portal_assets')[0].published, 0);
  assert.equal(f.rows('participant_portal_drive_files')[0].publication_policy, 'draft');
  assert.equal(f.rows('participant_portal_routines')[0].photos_published, 0);
  f.db.sqlite.exec('UPDATE participant_portal_drive_album_settings SET publication_paused=0'); f.expire();
  const resumed = await f.run(); assert.equal(resumed.imported, 0);
  assert.equal(f.rows('participant_portal_assets')[0].published, 1); assert.equal(f.calls.processing, 1);
});

test('hiding one automatic photo does not block other newly discovered photos', async t => {
  const f = await fixture(t); await f.run();
  const hidden = f.rows('participant_portal_assets')[0].id;
  f.db.sqlite.exec("UPDATE participant_portal_assets SET published=0; UPDATE participant_portal_drive_files SET publication_policy='held'");
  f.album.photos.push({ ...f.album.photos[0], id: 'new-independent-file' }); f.expire();
  const result = await f.run(); assert.equal(result.imported, 1);
  assert.equal(f.rows('participant_portal_assets').find(asset => asset.id === hidden).published, 0);
  const other = f.rows('participant_portal_assets').find(asset => asset.id !== hidden);
  assert.equal(other.published, 1);
  assert.equal(f.rows('participant_portal_drive_files').find(file => file.asset_id === hidden).publication_policy, 'held');
  assert.equal(f.rows('participant_portal_drive_files').find(file => file.asset_id === other.id).publication_policy, 'automatic');
});

test('a gallery paused while upload finishes retains the generated copy as an unapproved draft', async t => {
  const f = await fixture(t);
  const upload = f.options.uploadPreview;
  const result = await f.run({ uploadPreview: async input => {
    const saved = await upload(input);
    f.db.sqlite.exec("INSERT INTO participant_portal_drive_album_settings(event_id,dance_id,publication_paused) VALUES('edition','dance-a',1)");
    return saved;
  } });
  assert.equal(result.imported, 1);
  assert.equal(f.rows('participant_portal_assets')[0].published, 0);
  assert.equal(f.rows('participant_portal_drive_files')[0].publication_policy, 'draft');
  assert.equal(f.rows('participant_portal_routines')[0].photos_published, 0);
});

test('membership withdrawal or edition hiding during upload cannot approve the completed copy', async t => {
  for (const change of ["DELETE FROM registration_dance_participants WHERE participant_id='person-a'", "UPDATE participant_portal_events SET published=0 WHERE id='edition'"]) {
    const f = await fixture(t);
    const upload = f.options.uploadPreview;
    const result = await f.run({ uploadPreview: async input => { const saved = await upload(input); f.db.sqlite.exec(change); return saved; } });
    assert.equal(result.status, 'unavailable'); assert.equal(f.rows('participant_portal_assets')[0].published, 0);
    assert.equal(f.rows('participant_portal_routines')[0].photos_published, 0);
    assert.equal(f.rows('participant_portal_drive_files')[0].status, 'failed');
  }
});

test('ambiguous albums cannot promote a previously prepared admin draft', async t => {
  const f = await fixture(t, { admin: true }); await f.run(); f.expire();
  const result = await f.run({ adminPreview: false, getDiscovery: async () => ({ async discover() {
    return { albums: [f.album, { ...f.album, id: 'conflicting-folder' }] };
  } }) });
  assert.equal(result.status, 'unavailable'); assert.equal(f.rows('participant_portal_assets')[0].published, 0);
  assert.equal(f.rows('participant_portal_drive_files')[0].publication_policy, 'draft');
});
