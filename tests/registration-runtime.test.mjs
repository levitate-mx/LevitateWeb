import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';
import { prepareRegistrationSchema } from '../scripts/lib/registration-schema.mjs';
import ticketEvent from '../shared/ticket-event.json' with { type: 'json' };

const scannerAccessIds = ['bloque-1', 'bloque-2-3', 'bloque-4a', 'bloque-4b', 'bloque-5', 'bloque-6', 'bloque-7'];

// A real SQLite database catches missing columns, constraints, joins, and writes;
// this adapter only supplies D1's async result shape. No network/database service
// is contacted by these tests.
class LocalD1 {
  constructor(databasePath = ':memory:') {
    this.sqlite = new DatabaseSync(databasePath);
    // D1 defaults, uploaded_at and commit guards all share the campaign clock.
    this.clockSqlite = new DatabaseSync(':memory:');
    this.sqlite.function('datetime', { varargs: true }, (...inputs) => {
      const values = inputs.length ? [...inputs] : ['now'];
      if (values[0] === 'now') values[0] = new Date(Date.now()).toISOString();
      return this.clockSqlite.prepare(`SELECT strftime('%Y-%m-%d %H:%M:%S', ${values.map(() => '?').join(', ')}) AS value`)
        .get(...values).value;
    });
    // Use the same simulated campaign time in JavaScript and the database commit guard.
    this.sqlite.function('levitate_test_unixepoch_now', () => Math.floor(Date.now() / 1000));
    this.batchQueue = Promise.resolve();
    this.runtimeQueries = [];
    this.allowAcademyVenueProbe = false;
    this.allowLegacySchemaPreparation = false;
  }

  prepare(sql) {
    this.runtimeQueries.push(sql);
    if (this.failQuery?.test(sql)) {
      this.failQuery = null;
      throw new Error('Injected query failure');
    }
    if (!this.allowLegacySchemaPreparation) {
      assert.doesNotMatch(sql, /^\s*(?:CREATE|ALTER|DROP)\b/i, 'request attempted schema preparation');
    }
    if (!this.allowLegacySchemaPreparation && /\bPRAGMA\s+table_info\b/i.test(sql)) {
      assert.ok(this.allowAcademyVenueProbe && /^\s*PRAGMA table_info\(registration_academies\)\s*$/i.test(sql),
        'only new-academy legacy venue compatibility may inspect schema');
    }
    const statement = this.sqlite.prepare(sql.replaceAll("unixepoch('now')", 'levitate_test_unixepoch_now()'));
    let values = [];
    const execute = {
      bind(...nextValues) { values = nextValues; return execute; },
      async first(column) {
        const row = statement.get(...values);
        return row ? (column ? row[column] : { ...row }) : null;
      },
      async all() { return { success: true, results: statement.all(...values).map(row => ({ ...row })) }; },
      runSync: () => {
        this.beforeRun?.(sql);
        const result = statement.run(...values);
        return { success: true, results: [], meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
      },
      async run() { return execute.runSync(); },
    };
    return execute;
  }

  batch(statements) {
    const result = this.batchQueue.then(async () => {
      this.beforeBatch?.();
      this.sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const [index, statement] of statements.entries()) {
          if (this.failBatchAt === index) {
            this.failBatchAt = null;
            throw new Error('Injected atomic batch failure');
          }
          results.push(statement.runSync());
        }
        this.sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        this.sqlite.exec('ROLLBACK');
        throw error;
      }
    });
    this.batchQueue = result.catch(() => {});
    return result;
  }
}

async function fixture(t, { includeStudentSchema = false, workerUnderTest = worker, databasePath } = {}) {
  // Keep existing checkout expectations stable after the dated ticket campaign ends.
  t.mock.method(Date, 'now', () => Date.parse('2026-10-20T12:00:00Z'));
  const db = new LocalD1(databasePath);
  t.after(() => { db.sqlite.close(); db.clockSqlite.close(); });
  const schemaPath = !includeStudentSchema && process.env.REGISTRATION_TEST_SCHEMA_PATH
    ? process.env.REGISTRATION_TEST_SCHEMA_PATH
    : new URL('../db/registration_d1_schema.sql', import.meta.url);
  db.sqlite.exec(await readFile(schemaPath, 'utf8'));
  await prepareRegistrationSchema({
    async read(statements) { return statements.map(sql => db.sqlite.prepare(sql).all().map(row => ({ ...row }))); },
    async write(statements) { for (const sql of statements) db.sqlite.exec(sql); },
  }, { apply: true });
  const env = { DB: db };
  return {
    db,
    env,
    async request(path, { method = 'GET', cookie, headers = {}, body, status = 200 } = {}) {
      const response = await workerUnderTest.fetch(new Request(`http://localhost/api/registration${path}`, {
        method,
        headers: { ...headers, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }), env);
      const json = await response.json();
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(json)}`);
      return { json, headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] };
    },
  };
}

async function seedAcademy(f, suffix, { role = 'academy', originType = 'mexico' } = {}) {
  const academyId = `academy-${suffix}`;
  const userId = `user-${suffix}`;
  const token = `test-session-${suffix}`;
  f.db.sqlite.prepare(`INSERT INTO registration_academies
    (id, name, contact_name, email, phone, origin_type, origin_state, origin_country)
    VALUES (?, 'Independiente', ?, ?, '5555555555', ?, ?, ?)`)
    .run(academyId, `Responsable ${suffix}`, `${suffix}@example.test`, originType,
      originType === 'mexico' ? 'guanajuato' : null, originType === 'mexico' ? 'México' : 'Argentina');
  f.db.sqlite.prepare(`INSERT INTO registration_users
    (id, academy_id, name, username, email, password_hash, role, email_confirmed_at)
    VALUES (?, ?, ?, ?, ?, 'unused-fixture-hash', ?, datetime('now'))`)
    .run(userId, academyId, `Responsable ${suffix}`, suffix, `${suffix}@example.test`, role);
  const tokenHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  // Seeded sessions must remain valid while campaign tests travel across dates.
  f.db.sqlite.prepare(`INSERT INTO registration_sessions (id, user_id, session_token_hash, expires_at)
    VALUES (?, ?, ?, '2099-01-01 00:00:00')`).run(`session-${suffix}`, userId, tokenHash);
  return { academyId, userId, cookie: `levitate_registration_session=${token}` };
}

const curpA = 'AAAA100101MDFBBB01';
const curpB = 'BBBB100101MDFBBB01';
const phone = { buyerPhoneCountryCode: '+52', buyerPhoneNumber: '5555555555' };
const proof = { fileName: 'comprobante.png', contentType: 'image/png', dataUrl: 'data:image/png;base64,AQID', fileSize: 3 };

test('Relevé voting preview is private to admins and cannot record votes or change registration data', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'releve-preview-academy');
  const admin = await seedAcademy(f, 'releve-preview-admin', { role: 'admin' });
  const path = '/admin/releve-voting/preview';
  const initialChanges = f.db.sqlite.prepare('SELECT total_changes() AS count').get().count;
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('a private prototype must not contact a voting or external service'); });

  for (const [cookie, status] of [[undefined, 401], [academy.cookie, 403]]) {
    const response = await worker.fetch(new Request(`http://localhost/api/registration${path}`, {
      headers: cookie ? { cookie } : {},
    }), f.env);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const body = await response.json();
    assert.equal(body.candidates, undefined, 'no candidate fixture is returned before administrator authorization');
  }
  const queryStart = f.db.runtimeQueries.length;
  const response = await worker.fetch(new Request(`http://localhost/api/registration${path}`, {
    headers: { cookie: admin.cookie },
  }), f.env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('vary'), /Cookie/i);
  const preview = await response.json();
  assert.equal(preview.mode, 'preview');
  assert.equal(preview.publicVotingEnabled, false);
  assert.equal(preview.candidates.length, 6);
  assert.equal(preview.candidates.filter(candidate => candidate.division === 'motion').length, 3);
  assert.equal(preview.candidates.filter(candidate => candidate.division === 'aerial').length, 3);
  assert.ok(f.db.runtimeQueries.slice(queryStart).every(sql => !/^\s*(?:INSERT|UPDATE|DELETE)\b/i.test(sql)), 'even session last-seen timestamps stay untouched');

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    await f.request(path, { method, cookie: admin.cookie, body: { candidateId: preview.candidates[0].id }, status: 405 });
  }
  for (const publicPath of ['/releve-voting/preview', '/releve-voting/vote', '/admin/releve-voting/vote']) {
    await f.request(publicPath, { cookie: admin.cookie, status: 404 });
    await f.request(publicPath, { method: 'POST', body: { candidateId: preview.candidates[0].id }, status: 404 });
  }
  assert.equal(f.db.sqlite.prepare('SELECT total_changes() AS count').get().count, initialChanges,
    'preview reads and attempted votes must not alter any registration, payment or session data');
});

test('judging admin routes authenticate before upstream reads and never write to the registration database', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'judging-academy');
  const admin = await seedAcademy(f, 'judging-admin', { role: 'admin' });
  const eventId = 'f3c2e100-1234-4567-8abc-123456789abc';
  Object.assign(f.env, {
    JUDGING_SUPABASE_URL: 'https://judgingfixture.supabase.co',
    JUDGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_key',
    JUDGING_LEVITATE_EVENT_IDS: eventId,
  });
  const data = {
    events: [{ id: eventId, name: 'Evento local de prueba', is_active: true, event_type: 'event' },
      { id: 'f3c2e100-1234-4567-8abc-987654321abc', name: 'Prisma Aurora Sandbox', is_active: true, event_type: 'event' }],
    blocks: [{ event_id: eventId, block_id: 'b1', name: 'Bloque 1' }],
    routines: [{ event_id: eventId, routine_id: 'r1', name: 'Pieza de prueba', genre: 'Jazz', block_id: 'b1' }],
    judges: ['Eva Carrillo', 'Daniel Montalvo', 'Jorge Díaz'].map((name, index) => ({ event_id: eventId, judge_id: `j${index + 1}`, name, role: 'judge' })),
    criteria_templates: [{ event_id: eventId, template_id: 'jazz', genre: 'Jazz' }],
    criteria: [{ event_id: eventId, template_id: 'jazz', criterion_id: 1, label: 'Técnica', section: 'Arte', max_score: 10 }],
    scores: ['j1', 'j2', 'j3'].map(judge_id => ({ event_id: eventId, routine_id: 'r1', judge_id, criterion_id: 1, value: 8 })),
    penalties: [], feedback: [], special_awards: [],
  };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, f.env.JUDGING_SUPABASE_URL, 'tests must never contact a real remote service');
    assert.equal(options.method, 'GET');
    calls.push(url);
    const table = url.pathname.split('/').at(-1);
    const offset = Number(url.searchParams.get('offset'));
    assert.ok(Object.hasOwn(data, table));
    const rows = table === 'events' && url.searchParams.get('id')?.startsWith('eq.')
      ? data.events.filter(row => `eq.${row.id}` === url.searchParams.get('id')) : data[table];
    return Response.json(rows.slice(offset, offset + 1000));
  });
  const paths = ['/admin/judging/events', `/admin/judging/scores?eventId=${eventId}`];
  const initialChanges = f.db.sqlite.prepare('SELECT total_changes() AS count').get().count;
  for (const path of paths) {
    for (const [cookie, status] of [[undefined, 401], [academy.cookie, 403]]) {
      const before = calls.length;
      await f.request(path, { cookie, status });
      assert.equal(calls.length, before, 'unauthorized access must not fetch judging data');
    }
    const beforePost = calls.length;
    await f.request(path, { method: 'POST', cookie: admin.cookie, body: {}, status: 405 });
    assert.equal(calls.length, beforePost, 'read-only routes must not forward writes');
    const queryStart = f.db.runtimeQueries.length;
    const response = await worker.fetch(new Request(`http://localhost/api/registration${path}`, {
      headers: { cookie: admin.cookie },
    }), f.env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const result = await response.json();
    if (path.endsWith('/events')) {
      assert.equal(result.events[0].id, eventId);
      assert.equal(result.events.length, 1, 'the API must not expose another competition even if upstream ignores its filter');
      assert.doesNotMatch(JSON.stringify(result), /Prisma|Aurora|Sandbox/);
      assert.equal(calls.at(-1).searchParams.get('id'), `in.(${eventId})`);
    }
    else {
      assert.equal(result.event.id, eventId);
      assert.equal(result.rows[0].judges[0].total, 8);
      assert.equal(result.report.maximumScore, 30);
      assert.equal(result.report.blocks.length, 1);
      assert.equal(result.report.blocks[0].id, 'b1');
      assert.equal(result.report.blocks[0].sections[0].categories[0].rows[0].score, 24);
    }
    assert.doesNotMatch(JSON.stringify(result), /sb_publishable_|supabase\.co/);
    assert.ok(f.db.runtimeQueries.slice(queryStart).every(sql => !/^\s*(?:INSERT|UPDATE|DELETE)\b/i.test(sql)),
      'judging reads must not update sessions, registrations, orders or payments');
  }
  const beforeForeignEvent = calls.length;
  await f.request('/admin/judging/scores?eventId=f3c2e100-1234-4567-8abc-987654321abc', { cookie: admin.cookie, status: 404 });
  assert.equal(calls.length, beforeForeignEvent, 'direct URL access cannot fetch a valid event outside the explicit Levitate scope');
  assert.equal(f.db.sqlite.prepare('SELECT total_changes() AS count').get().count, initialChanges,
    'the real SQLite database confirms that all judging API probes were read-only');
});

test('judging API missing configuration and upstream failures stay explicit, private and safe to display', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'judging-errors-admin', { role: 'admin' });
  let calls = 0;
  const privateMessage = 'PRIVATE-JUDGING-KEY https://judgingfixture.supabase.co';
  t.mock.method(globalThis, 'fetch', async () => { calls += 1; throw new Error(privateMessage); });
  const missing = await worker.fetch(new Request('http://localhost/api/registration/admin/judging/events', {
    headers: { cookie: admin.cookie },
  }), f.env);
  assert.equal(missing.status, 503);
  assert.equal(missing.headers.get('cache-control'), 'private, no-store');
  assert.equal((await missing.json()).error.code, 'judging_not_configured');
  assert.equal(calls, 0);
  Object.assign(f.env, {
    JUDGING_SUPABASE_URL: 'https://judgingfixture.supabase.co',
    JUDGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_key',
    JUDGING_LEVITATE_EVENT_IDS: 'invalid-event-scope',
  });
  const invalidScope = await worker.fetch(new Request('http://localhost/api/registration/admin/judging/events', {
    headers: { cookie: admin.cookie },
  }), f.env);
  assert.equal(invalidScope.status, 503);
  assert.equal(invalidScope.headers.get('cache-control'), 'private, no-store');
  assert.equal((await invalidScope.json()).error.code, 'judging_not_configured');
  assert.equal(calls, 0, 'malformed scope must fail closed before an upstream read');
  f.env.JUDGING_LEVITATE_EVENT_IDS = 'f3c2e100-1234-4567-8abc-123456789abc';
  const queryStart = f.db.runtimeQueries.length;
  const unavailable = await worker.fetch(new Request('http://localhost/api/registration/admin/judging/events', {
    headers: { cookie: admin.cookie },
  }), f.env);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('cache-control'), 'private, no-store');
  const body = await unavailable.json();
  assert.equal(body.error.code, 'judging_unavailable');
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE-JUDGING-KEY|supabase\.co|sb_publishable_/);
  assert.equal(calls, 1);
  assert.ok(f.db.runtimeQueries.slice(queryStart).every(sql => !/^\s*(?:INSERT|UPDATE|DELETE)\b/i.test(sql)));
});

test('media Drive routes authenticate before reading configuration or contacting Google', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'media-drive-academy');
  const admin = await seedAcademy(f, 'media-drive-auth-admin', { role: 'admin' });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Must not contact Google'); });
  const start = f.db.runtimeQueries.length;
  for (const [path, method, body] of [
    ['/admin/media-drive/connection', 'GET', undefined],
    ['/admin/media-drive/folder', 'POST', { folder: 'folder_123456789' }],
  ]) {
    const anonymous = await f.request(path, { method, body, status: 401 });
    assert.equal(anonymous.headers.get('cache-control'), 'private, no-store');
    assert.equal(anonymous.headers.get('vary'), 'Cookie');
    await f.request(path, { method, body, cookie: academy.cookie, status: 403 });
    await f.request(path + '?adminToken=pretend-token', { method, body, status: 401 });
  }
  assert.equal(calls, 0);
  assert.ok(f.db.runtimeQueries.slice(start).every(sql => !/registration_media_drive_settings/.test(sql)));
  const empty = await f.request('/admin/media-drive/connection', { cookie: admin.cookie });
  assert.equal(empty.json.connection.status, 'missing_configuration');
  assert.equal(empty.json.connection.validated, false);
  assert.equal(empty.json.connection.folder, null);
  assert.equal(calls, 0);
});

function configureMediaDriveFixture(f) {
  Object.assign(f.env, {
    GOOGLE_DRIVE_OAUTH_CLIENT_ID: 'private-drive-client-id',
    GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: 'private-drive-client-secret',
    GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: 'private-drive-refresh-token',
    REGISTRATION_MUSIC_DRIVE_FOLDER_ID: 'existing_music_folder',
  });
}

function configurePhotoDriveFixture(f) {
  Object.assign(f.env, {
    PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID: 'private-photo-client-id',
    PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_SECRET: 'private-photo-client-secret',
    PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN: 'private-photo-refresh-token',
    PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL: 'ati.levitatemx@gmail.com',
  });
}

function mockMediaDrive(t, { folderResponse, tokenStatus = 200, accountEmail = 'evento@example.test' } = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ url, options });
    if (url.href === 'https://oauth2.googleapis.com/token') {
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'manual');
      assert.equal(options.body.get('grant_type'), 'refresh_token');
      return Response.json(tokenStatus === 200 ? { access_token: 'private-drive-access-token' }
        : { error: 'invalid_grant', error_description: 'private-provider-detail' }, { status: tokenStatus });
    }
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.authorization, 'Bearer private-drive-access-token');
    assert.equal(options.redirect, 'manual');
    if (url.pathname === '/drive/v3/about') return Response.json({
      user: { displayName: 'Cuenta del evento', emailAddress: accountEmail }, storageQuota: { usage: '1000' },
    });
    if (url.pathname.startsWith('/drive/v3/files/')) {
      assert.equal(url.searchParams.get('supportsAllDrives'), 'true');
      return Response.json(folderResponse || { id: url.pathname.split('/').at(-1), name: 'Fotos y videos',
        mimeType: 'application/vnd.google-apps.folder', trashed: false,
        capabilities: { canListChildren: true, canAddChildren: false } });
    }
    throw new Error('Unexpected upstream URL');
  });
  return calls;
}

test('dedicated photo Drive diagnostics use Ati authorization without changing the music credentials', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'photo-drive-dedicated', { role: 'admin' });
  configureMediaDriveFixture(f);
  configurePhotoDriveFixture(f);
  const before = { ...f.env };
  const calls = mockMediaDrive(t, { accountEmail: 'ati.levitatemx@gmail.com' });
  const start = f.db.runtimeQueries.length;
  const { json, headers } = await f.request('/admin/media-drive/connection', { cookie: admin.cookie });
  assert.equal(json.connection.status, 'connected');
  assert.equal(json.connection.validated, true);
  assert.equal(json.connection.account.emailAddress, 'ati.levitatemx@gmail.com');
  assert.equal(json.connection.folder, null);
  assert.equal(calls.length, 2);
  const token = calls.find(call => call.url.href === 'https://oauth2.googleapis.com/token');
  assert.equal(token.options.body.get('client_id'), 'private-photo-client-id');
  assert.equal(token.options.body.get('client_secret'), 'private-photo-client-secret');
  assert.equal(token.options.body.get('refresh_token'), 'private-photo-refresh-token');
  assert.deepEqual(f.env, before, 'photo diagnostics must not replace or mutate any music configuration');
  assert.ok(f.db.runtimeQueries.slice(start).every(sql => /^\s*SELECT/.test(sql)));
  assert.equal(headers.get('cache-control'), 'private, no-store');
  assert.equal(headers.get('vary'), 'Cookie');
  assert.doesNotMatch(JSON.stringify(json), /private-photo-|private-drive-|existing_music_folder|refreshToken|clientSecret|Bearer/);
});

test('a partial photo Drive connection fails closed instead of using valid music authorization', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'photo-drive-partial', { role: 'admin' });
  configureMediaDriveFixture(f);
  configurePhotoDriveFixture(f);
  delete f.env.PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN;
  f.db.sqlite.prepare(`INSERT INTO registration_media_drive_settings(key,folder_id,folder_name)
    VALUES ('photo_video','previous_photo_folder','Existing photos')`).run();
  const before = f.db.sqlite.prepare('SELECT * FROM registration_media_drive_settings').get();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('No authorization may be contacted'); });
  const { json } = await f.request('/admin/media-drive/connection', { cookie: admin.cookie });
  assert.equal(json.connection.status, 'missing_configuration');
  assert.equal(json.connection.validated, false);
  await f.request('/admin/media-drive/folder', { method: 'POST', cookie: admin.cookie,
    body: { folder: 'new_photo_video_folder' }, status: 400 });
  assert.equal(calls, 0, 'a partial Ati connection must never refresh the working music token');
  assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM registration_media_drive_settings').get(), before);
  assert.equal(f.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN, 'private-drive-refresh-token');
  assert.doesNotMatch(JSON.stringify(json), /private-photo-|private-drive-|refreshToken|clientSecret/);
});

test('dedicated photo Drive refuses the wrong Google account without replacing the linked folder', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'photo-drive-wrong-account', { role: 'admin' });
  configureMediaDriveFixture(f);
  configurePhotoDriveFixture(f);
  f.db.sqlite.prepare(`INSERT INTO registration_media_drive_settings(key,folder_id,folder_name)
    VALUES ('photo_video','previous_photo_folder','Existing photos')`).run();
  const before = f.db.sqlite.prepare('SELECT * FROM registration_media_drive_settings').get();
  const calls = mockMediaDrive(t, { accountEmail: 'musica.levitate@gmail.com' });
  const { json, headers } = await f.request('/admin/media-drive/folder', { method: 'POST', cookie: admin.cookie,
    body: { folder: 'new_photo_video_folder' }, status: 503 });
  assert.equal(json.error.code, 'portal_storage_wrong_account');
  assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM registration_media_drive_settings').get(), before);
  assert.equal(calls[0].options.body.get('refresh_token'), 'private-photo-refresh-token');
  assert.ok(calls.filter(call => call.url.hostname === 'www.googleapis.com').every(call => call.options.method === 'GET'));
  assert.equal(headers.get('cache-control'), 'private, no-store');
  assert.equal(headers.get('vary'), 'Cookie');
  assert.doesNotMatch(JSON.stringify(json), /private-photo-|private-drive-|refreshToken|clientSecret/);
});

test('configured Ati photo routes deny anonymous, academy, judge and judging-admin access before Google or folder reads', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'photo-drive-denied-academy');
  const judge = await seedAcademy(f, 'photo-drive-denied-judge');
  const judgingAdmin = await seedAcademy(f, 'photo-drive-denied-judging-admin');
  f.db.sqlite.prepare('UPDATE registration_users SET is_judge=1 WHERE id=?').run(judge.userId);
  f.db.sqlite.prepare('UPDATE registration_users SET is_judging_admin=1 WHERE id=?').run(judgingAdmin.userId);
  configureMediaDriveFixture(f);
  configurePhotoDriveFixture(f);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Must authorize before Google'); });
  const start = f.db.runtimeQueries.length;
  for (const [cookie, status] of [[undefined, 401], [academy.cookie, 403], [judge.cookie, 403], [judgingAdmin.cookie, 403]]) {
    for (const [path, method, body] of [
      ['/admin/media-drive/connection', 'GET', undefined],
      ['/admin/media-drive/folder', 'POST', { folder: 'new_photo_video_folder' }],
    ]) {
      await f.request(path, { cookie, status, method, body });
    }
  }
  assert.equal(calls, 0);
  assert.ok(f.db.runtimeQueries.slice(start).every(sql => !/registration_media_drive_settings/.test(sql)));
});

test('media Drive validates existing authorization and keeps the music folder separate', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'media-drive-check', { role: 'admin' });
  configureMediaDriveFixture(f);
  const calls = mockMediaDrive(t);
  const start = f.db.runtimeQueries.length;
  const { json, headers } = await f.request('/admin/media-drive/connection', { cookie: admin.cookie });
  assert.equal(json.connection.status, 'connected');
  assert.equal(json.connection.validated, true);
  assert.equal(json.connection.folder, null, 'photo/video must not inherit the music folder');
  assert.equal(json.connection.account.emailAddress, 'evento@example.test');
  assert.equal(json.connection.storage.limitBytes, null);
  assert.equal(calls.length, 2);
  assert.doesNotMatch(JSON.stringify(json), /private-drive-|existing_music_folder|clientSecret|refreshToken|Bearer|privateKey/);
  assert.equal(headers.get('cache-control'), 'private, no-store');
  assert.ok(f.db.runtimeQueries.slice(start).every(sql => /^\s*SELECT/.test(sql)), 'checking Drive cannot write session timestamps or configuration');
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM registration_media_drive_settings').get().n, 0);
});

test('media Drive links only verified folders and preserves the last setting on errors', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'media-drive-link', { role: 'admin' });
  configureMediaDriveFixture(f);
  const calls = mockMediaDrive(t);
  const { json } = await f.request('/admin/media-drive/folder', { method: 'POST', cookie: admin.cookie,
    headers: { origin: 'http://localhost' }, body: { folder: 'https://drive.google.com/drive/u/0/folders/photo_video_folder?usp=sharing' } });
  assert.equal(json.connection.folder.status, 'ready');
  assert.equal(json.connection.folder.canAddChildren, false, 'read-only folder access is sufficient to connect previews');
  const stored = f.db.sqlite.prepare('SELECT * FROM registration_media_drive_settings').get();
  assert.equal(stored.folder_id, 'photo_video_folder');
  assert.equal(stored.updated_by, admin.userId);
  assert.equal(f.env.REGISTRATION_MUSIC_DRIVE_FOLDER_ID, 'existing_music_folder');
  const { json: checked } = await f.request('/admin/media-drive/connection', { cookie: admin.cookie });
  assert.equal(checked.connection.folder.id, stored.folder_id);
  const requestCount = calls.length;
  for (const folder of ['https://example.test/drive/folders/steal_credentials', 'root', '  ', 'https://drive.google.com.evil.test/drive/folders/folder_fake']) {
    await f.request('/admin/media-drive/folder', { method: 'POST', cookie: admin.cookie, body: { folder }, status: 400 });
  }
  assert.equal(calls.length, requestCount, 'invalid folder inputs never receive credentials');
  await f.request('/admin/media-drive/folder', { method: 'POST', cookie: admin.cookie,
    headers: { origin: 'https://other.example.test' }, body: { folder: 'photo_video_folder' }, status: 403 });
  assert.equal(calls.length, requestCount);
  assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM registration_media_drive_settings').get(), stored);
  assert.ok(calls.filter(call => call.url.hostname === 'www.googleapis.com').every(call => call.options.method === 'GET'));
});

test('media Drive does not persist inaccessible files or expose provider authentication errors', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'media-drive-invalid', { role: 'admin' });
  configureMediaDriveFixture(f);
  const fixtureFetch = mockMediaDrive(t, { folderResponse: { id: 'photo_video_folder', name: 'Not a folder',
    mimeType: 'image/jpeg', trashed: false, capabilities: { canListChildren: true, canAddChildren: true } } });
  const invalid = await f.request('/admin/media-drive/folder', { method: 'POST', cookie: admin.cookie,
    body: { folder: 'photo_video_folder' }, status: 400 });
  assert.equal(invalid.json.error.code, 'media_drive_folder_not_validated');
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM registration_media_drive_settings').get().n, 0);
  assert.equal(fixtureFetch.length, 3);
  t.mock.method(console, 'warn', () => {});
  mockMediaDrive(t, { tokenStatus: 400 });
  const { json } = await f.request('/admin/media-drive/connection', { cookie: admin.cookie });
  assert.equal(json.connection.status, 'error');
  assert.equal(json.connection.validated, false);
  assert.doesNotMatch(JSON.stringify(json), /private-drive-|private-provider-detail|invalid_grant|refreshToken|clientSecret/);
});

test('media Drive never follows token redirects or logs provider response bodies', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'media-drive-redirect', { role: 'admin' });
  configureMediaDriveFixture(f);
  const logs = [];
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(String(url), 'https://oauth2.googleapis.com/token');
    assert.equal(options.redirect, 'manual');
    return new Response('private-drive-refresh-token private-provider-detail', {
      status: 307, headers: { location: 'https://untrusted.example.test/collect' },
    });
  });
  const { json } = await f.request('/admin/media-drive/connection', { cookie: admin.cookie });
  assert.equal(json.connection.status, 'error');
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify({ json, logs }), /private-drive-|private-provider-detail|untrusted\.example/);
});

test('photo/video folder configuration cannot change the existing music upload destination', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'media-drive-music');
  const { dance } = await createDance(f, academy);
  configureMediaDriveFixture(f);
  configurePhotoDriveFixture(f);
  f.db.sqlite.prepare(`INSERT INTO registration_media_drive_settings(key,folder_id,folder_name)
    VALUES ('photo_video','new_photo_video_folder','Fotos y videos')`).run();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options = {}) => {
    const url = new URL(String(input));
    calls.push(url.href);
    if (url.href === 'https://oauth2.googleapis.com/token') {
      assert.equal(options.body.get('client_id'), 'private-drive-client-id');
      assert.equal(options.body.get('client_secret'), 'private-drive-client-secret');
      assert.equal(options.body.get('refresh_token'), 'private-drive-refresh-token');
      assert.equal(options.redirect, 'manual');
      return Response.json({ access_token: 'private-drive-access-token' });
    }
    if (options.method === 'POST' && url.pathname === '/upload/drive/v3/files') {
      assert.equal(options.headers.authorization, 'Bearer private-drive-access-token');
      assert.deepEqual(JSON.parse(options.body).parents, ['existing_music_folder']);
      return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=fixture' } });
    }
    if (options.method === 'PUT' && url.searchParams.get('upload_id') === 'fixture') {
      return Response.json({ id: 'fixture-private-music-file', webViewLink: 'https://drive.google.com/file/d/fixture-private-music-file/view' });
    }
    throw new Error('Unexpected music upstream URL');
  });
  const { json } = await f.request('/music', { method: 'POST', cookie: academy.cookie,
    body: { danceId: dance.id, fileName: 'vuelo.mp3', contentType: 'audio/mpeg',
      dataUrl: 'data:audio/mpeg;base64,AQID', fileSize: 3, durationSeconds: 180 } });
  assert.equal(json.musicUpload.storageProvider, 'google_drive');
  assert.equal(calls.length, 3);
  assert.equal(f.db.sqlite.prepare('SELECT drive_file_id FROM registration_music_uploads WHERE dance_id = ?').get(dance.id).drive_file_id, 'fixture-private-music-file');
  assert.equal(f.db.sqlite.prepare("SELECT folder_id FROM registration_media_drive_settings WHERE key='photo_video'").get().folder_id, 'new_photo_video_folder');
  assert.equal(f.env.PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN, 'private-photo-refresh-token');
  assert.doesNotMatch(JSON.stringify(json), /private-drive-|fixture-private-music-file|drive\.google\.com/);
});

async function createPaidTicketOrder(f, admin, items) {
  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201,
    body: { curp: curpA, buyerName: 'Titular de boletos', buyerEmail: 'boletos@example.test', ...phone, items } });
  await f.request('/shop/order/proof', { method: 'POST', status: 201,
    body: { orderId: order.id, accessToken: order.accessToken, ...proof } });
  const { json: { order: paid } } = await f.request('/admin/inscription-order/status', {
    method: 'POST', cookie: admin.cookie,
    body: { id: order.id, orderType: 'shop', status: 'paid', paidAmount: order.amount },
  });
  return paid;
}

async function activateTicketScanner(f, admin, deviceName = 'Puerta de prueba') {
  const { json: pairing } = await f.request('/admin/scanner/pairing-code', {
    method: 'POST', cookie: admin.cookie, status: 201,
  });
  const { json: activation } = await f.request('/scanner/activate', { method: 'POST', status: 201,
    body: { pairingPayload: pairing.pairingPayload, deviceName } });
  return { ...activation, headers: { authorization: `Scanner ${activation.deviceToken}` } };
}

async function createDance(f, academy, curp = curpA) {
  const options = { method: 'POST', cookie: academy.cookie, status: 201 };
  const { json: { participant } } = await f.request('/participants', {
    ...options, body: { fullName: `Participante ${curp}`, curp, birthDate: '2010-01-01', age: 16, division: 'teen', shirtSize: 'm' },
  });
  const { json: { choreographer } } = await f.request('/choreographers', {
    ...options, body: { fullName: 'Coreógrafa de prueba', email: 'coreografa@example.test', phone: '5555555555', shirtSize: 's' },
  });
  const { json: { dance } } = await f.request('/dances', {
    ...options, body: { title: 'Vuelo de prueba', genre: 'aereo', subgenre: 'open_otro', subgenreDetail: 'Aparato propio', level: 'principiante',
      category: 'solo', venue: 'edomex', choreographerIds: [choreographer.id], participantIds: [participant.id] },
  });
  return { participant, choreographer, dance };
}

async function createAerialPricingDances(f, academy, categories) {
  const record = await createDance(f, academy);
  const participantIds = [record.participant.id];
  for (const curp of [curpB, 'CCCC100101MDFBBB01']) {
    const { json: { participant } } = await f.request('/participants', {
      method: 'POST', cookie: academy.cookie, status: 201,
      body: { fullName: `Participante ${curp}`, curp, birthDate: '2010-01-01', age: 16, division: 'teen', shirtSize: 'm' },
    });
    participantIds.push(participant.id);
  }
  for (const [index, [category, participantCount]] of categories.entries()) {
    await f.request('/dances', {
      method: 'POST', cookie: academy.cookie, status: 201,
      body: { title: `Coreografía ${index + 1}`, genre: 'aereo', subgenre: 'aro', level: 'intermedio', category,
        venue: 'edomex', choreographerIds: [record.choreographer.id], participantIds: participantIds.slice(0, participantCount) },
    });
  }
}

test('domestic Aerial prices match each category in presale and normal periods without changing discount positions', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'aerial-prices');
  await createAerialPricingDances(f, academy, [
    ['solo', 1], ['dupla_1_aparato', 2], ['duo_2_aparatos', 2], ['terna_1_aparato', 3], ['trio_3_aparatos', 3],
  ]);
  let now;
  t.mock.method(Date, 'now', () => now);
  for (const [date, solo, duo, trio] of [
    ['2026-09-17T12:00:00Z', 1500, 1300, 950],
    ['2026-10-14T12:00:00Z', 1750, 1400, 1200],
  ]) {
    now = Date.parse(date);
    const { json: lookup } = await f.request('/inscription/lookup', {
      method: 'POST', cookie: academy.cookie, body: { curp: curpA },
    });
    assert.equal(lookup.currency, 'MXN');
    assert.deepEqual(Object.fromEntries(lookup.lines.map(line => [line.category, line.baseAmount])), {
      solo, dupla_1_aparato: duo, duo_2_aparatos: duo, terna_1_aparato: trio, trio_3_aparatos: trio,
    }, date);
    assert.deepEqual(lookup.lines.map(line => line.baseAmount), [solo, solo, duo, duo, trio, trio]);
    assert.deepEqual(lookup.lines.map(line => line.discountRate), [0, 0.5, 0, 0.5, 0, 0.5]);
  }
});

test('Hot Presale discounts only Relevé registration lines by 30 percent during the CDMX window', async t => {
  const f = await fixture(t);
  const releveAcademy = await seedAcademy(f, 'hot-releve');
  const releveRecord = await createDance(f, releveAcademy, curpA);
  f.db.sqlite.prepare('UPDATE registration_dances SET is_releve = 1 WHERE id = ?')
    .run(releveRecord.dance.id);

  const standardAcademy = await seedAcademy(f, 'hot-standard');
  await createDance(f, standardAcademy, curpB);

  let now;
  t.mock.method(Date, 'now', () => now);
  for (const [date, relevePrice, standardPrice] of [
    ['2026-10-07T18:00:00Z', 700, 1500],
    ['2026-10-14T18:00:00Z', 1000, 1750],
    ['2026-10-26T05:59:59Z', 1000, 1750],
    ['2026-10-26T06:00:00Z', 1500, 1750],
  ]) {
    now = Date.parse(date);
    const { json: releveLookup } = await f.request('/inscription/lookup', {
      method: 'POST', cookie: releveAcademy.cookie, body: { curp: curpA },
    });
    const { json: standardLookup } = await f.request('/inscription/lookup', {
      method: 'POST', cookie: standardAcademy.cookie, body: { curp: curpB },
    });
    assert.equal(releveLookup.lines[0].baseAmount, relevePrice, date);
    assert.equal(releveLookup.lines[0].amount, relevePrice, date);
    assert.equal(standardLookup.lines[0].baseAmount, standardPrice, 'only Relevé gets the extension');
  }
});

test('a historical Maestro Relevé mark does not reclassify a standard choreography', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'legacy-releve-teacher');
  const record = await createDance(f, academy, curpA);
  f.db.sqlite.prepare('UPDATE registration_choreographers SET is_releve_teacher = 1 WHERE id = ?')
    .run(record.choreographer.id);

  const { json: lookup } = await f.request('/inscription/lookup', {
    method: 'POST', cookie: academy.cookie, body: { curp: curpA },
  });

  assert.equal(lookup.lines[0].category, 'solo');
  assert.equal(lookup.lines[0].division, 'teen');
  assert.equal(lookup.lines[0].baseAmount, 1750);
});

test('two solos, a dupla and a trio total 4025 in presale for lookup and the generated payment order', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'aerial-total');
  await createAerialPricingDances(f, academy, [['solo', 1], ['dupla_1_aparato', 2], ['trio_3_aparatos', 3]]);
  t.mock.method(Date, 'now', () => Date.parse('2026-09-17T12:00:00Z'));
  const { json: lookup } = await f.request('/inscription/lookup', {
    method: 'POST', cookie: academy.cookie, body: { curp: curpA },
  });
  assert.deepEqual(lookup.lines.map(line => line.amount), [1500, 750, 1300, 475]);
  assert.equal(lookup.subtotal, 4025);
  const { json: { order } } = await f.request('/inscription/order', {
    method: 'POST', cookie: academy.cookie, body: { curp: curpA, ...phone }, status: 201,
  });
  assert.equal(order.amount, 4025);
  assert.equal(f.db.sqlite.prepare('SELECT amount FROM registration_inscription_orders WHERE id = ?').get(order.id).amount, 4025);
});

test('academy registration, verification, login, reset and logout work with prepared schema', async t => {
  const f = await fixture(t);
  f.db.allowAcademyVenueProbe = true;
  const emailCalls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'test-only-token' });
    assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    emailCalls.push(JSON.parse(options.body));
    return Response.json({ id: `email-${emailCalls.length}` });
  });
  Object.assign(f.env, { GMAIL_OAUTH_CLIENT_ID: 'test', GMAIL_OAUTH_CLIENT_SECRET: 'test',
    GMAIL_OAUTH_REFRESH_TOKEN: 'test', GMAIL_SENDER_EMAIL: 'registro@example.test' });
  const body = { name: 'Persona de prueba', username: 'academia-prueba', email: 'academia@example.test', password: 'ClaveDePrueba123!',
    academy: 'Independiente', phone: '5555555555', academyState: 'guanajuato' };
  const registration = await f.request('/auth/register', { method: 'POST', body, status: 201 });
  assert.equal(registration.json.status, 'pending_email_verification');
  assert.equal(registration.json.confirmationEmail.sent, true);
  assert.equal(emailCalls.length, 1);
  assert.equal(registration.cookie, undefined);
  await f.request('/auth/login', { method: 'POST', body, status: 403 });
  await f.request('/auth/register', { method: 'POST', body, status: 409 });
  await f.request('/auth/verify-email', { method: 'POST', body: { token: 'not-valid' }, status: 400 });
  const verificationUrl = new URL(registration.json.debugVerificationUrl);
  const token = verificationUrl.searchParams.get('token');
  assert.ok(token);
  const verified = await f.request('/auth/verify-email', { method: 'POST', body: { token } });
  assert.equal(verified.json.academy.name, 'Independiente');
  assert.equal(verified.json.academy.originState, 'guanajuato');
  assert.ok(verified.json.user.emailConfirmedAt);
  await f.request('/auth/verify-email', { method: 'POST', body: { token }, status: 400 });
  const loggedIn = await f.request('/auth/login', { method: 'POST', body: { username: body.email, password: body.password } });
  assert.equal(loggedIn.json.academy.id, verified.json.academy.id);
  await f.request('/auth/login', { method: 'POST', body: { username: body.username, password: 'wrong' }, status: 401 });
  const reset = await f.request('/auth/forgot-password', { method: 'POST', body: { identifier: body.email } });
  assert.equal(emailCalls.length, 2);
  const resetToken = new URL(reset.json.debugResetUrl).searchParams.get('resetToken');
  const resetResult = await f.request('/auth/reset-password', { method: 'POST', body: { token: resetToken, password: 'NuevaClave123!' } });
  await f.request('/me', { cookie: loggedIn.cookie, status: 401 });
  await f.request('/auth/login', { method: 'POST', body: { username: body.username, password: body.password }, status: 401 });
  await f.request('/auth/login', { method: 'POST', body: { username: body.username, password: 'NuevaClave123!' } });
  await f.request('/auth/logout', { method: 'POST', cookie: resetResult.cookie });
  await f.request('/me', { cookie: resetResult.cookie, status: 401 });
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_academies').get().total, 1);
});

test('same-name academies stay isolated across bootstrap, participants, dances, orders and admin', async t => {
  const f = await fixture(t);
  const a = await seedAcademy(f, 'a');
  const b = await seedAcademy(f, 'b');
  const admin = await seedAcademy(f, 'admin', { role: 'admin' });
  const record = await createDance(f, a);
  const other = await createDance(f, b, curpB);
  f.db.sqlite.prepare("UPDATE registration_sessions SET last_seen_at = '2020-01-01 00:00:00'").run();
  assert.equal(record.dance.subgenreDetail, 'Aparato propio');
  for (const [academy, participant] of [[a, record.participant], [b, other.participant]]) {
    const { json } = await f.request('/bootstrap', { cookie: academy.cookie });
    assert.equal(json.academy.id, academy.academyId);
    assert.deepEqual(json.participants.map(item => item.id), [participant.id]);
    assert.equal(json.dances.length, 1);
    assert.equal(json.choreographers.length, 1);
  }
  assert.notEqual(f.db.sqlite.prepare('SELECT last_seen_at FROM registration_sessions WHERE user_id = ?').get(a.userId).last_seen_at,
    '2020-01-01 00:00:00', 'session activity updates remain enabled');
  const countsBefore = f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_dances').get().total;
  await f.request('/dances', { method: 'POST', cookie: b.cookie, status: 404,
    body: { title: 'Not allowed', genre: 'motion', subgenre: 'jazz', category: 'solo', venue: 'edomex',
      choreographerIds: [other.choreographer.id], participantIds: [record.participant.id] } });
  await f.request('/inscription/lookup', { method: 'POST', cookie: b.cookie, body: { curp: curpA }, status: 403 });
  await f.request('/admin/participants', { cookie: a.cookie, status: 403 });
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_dances').get().total, countsBefore);
  const { json: participants } = await f.request('/admin/participants', { cookie: admin.cookie });
  assert.equal(participants.academies.length, 2);
  assert.deepEqual(new Set(participants.participants.map(item => item.academyId)), new Set([a.academyId, b.academyId]));
  const { json: program } = await f.request('/admin/program', { cookie: admin.cookie });
  assert.deepEqual(new Set(program.dances.map(item => item.academyId)), new Set([a.academyId, b.academyId]));
  assert.deepEqual(new Set(program.dances.map(item => item.academyOriginState)), new Set(['guanajuato']));
  assert.deepEqual(new Set(program.dances.map(item => item.academyOriginType)), new Set(['mexico']));
  assert.deepEqual(new Set(program.dances.map(item => item.academyOriginCountry)), new Set(['México']));
  await f.request('/dances', { method: 'DELETE', cookie: a.cookie, body: { id: record.dance.id } });
  await f.request('/participants', { method: 'DELETE', cookie: a.cookie, body: { id: record.participant.id } });
  await f.request('/choreographers', { method: 'DELETE', cookie: a.cookie, body: { id: record.choreographer.id } });
  const { json: remaining } = await f.request('/bootstrap', { cookie: b.cookie });
  assert.equal(remaining.dances[0].id, other.dance.id);
});

test('linked participants cannot be deleted by their academy or an admin', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'protected-participant');
  const admin = await seedAcademy(f, 'protected-participant-admin', { role: 'admin' });
  const record = await createDance(f, academy);

  for (const request of [
    { path: '/participants', cookie: academy.cookie, body: { id: record.participant.id } },
    { path: '/admin/delete', cookie: admin.cookie, body: { entityType: 'participant', id: record.participant.id } },
  ]) {
    const { json } = await f.request(request.path, {
      method: 'DELETE', cookie: request.cookie, body: request.body, status: 409,
    });
    assert.equal(json.error.code, 'registration_participant_has_dances');
    assert.match(json.error.message, /Vuelo de prueba/);
    assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_participants WHERE id = ?')
      .get(record.participant.id).total, 1);
    assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_dance_participants WHERE participant_id = ?')
      .get(record.participant.id).total, 1);
  }

  await f.request('/dances', { method: 'DELETE', cookie: academy.cookie, body: { id: record.dance.id } });
  await f.request('/participants', { method: 'DELETE', cookie: academy.cookie, body: { id: record.participant.id } });
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_participants WHERE id = ?')
    .get(record.participant.id).total, 0);
});

test('Baby Aerial choreographies omit the level even when the academy has older participants', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'baby-without-level');
  const existing = await createDance(f, academy);
  const { json: { participant: baby } } = await f.request('/participants', {
    method: 'POST', cookie: academy.cookie, status: 201,
    body: { fullName: 'Participante Baby', curp: 'BBBB210101MDFCCC01', birthDate: '2021-01-01', age: 5, division: 'baby', shirtSize: '6_8' },
  });

  for (const [title, level] of [['Baby sin nivel', undefined], ['Baby con nivel heredado', 'elite']]) {
    const { json: { dance } } = await f.request('/dances', {
      method: 'POST', cookie: academy.cookie, status: 201,
      body: { title, genre: 'aereo', subgenre: 'aro', category: 'solo', venue: 'edomex', level,
        choreographerIds: [existing.choreographer.id], participantIds: [baby.id] },
    });
    assert.equal(dance.level, null);
    assert.deepEqual(dance.participants.map(participant => participant.id), [baby.id]);
  }
});

test('admin people summaries preserve distinct venues, empty people and latest dance ties', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'summary-admin', { role: 'admin' });
  const other = await seedAcademy(f, 'summary-other');
  f.db.sqlite.prepare("UPDATE registration_academies SET name = 'Alpha Academy' WHERE id = ?").run(admin.academyId);
  f.db.sqlite.prepare("UPDATE registration_academies SET name = 'Beta Academy' WHERE id = ?").run(other.academyId);
  const addChoreographer = f.db.sqlite.prepare('INSERT INTO registration_choreographers(id, academy_id, full_name) VALUES (?, ?, ?)');
  addChoreographer.run('summary-empty', admin.academyId, 'Ana');
  addChoreographer.run('summary-many', admin.academyId, 'Zoe');
  addChoreographer.run('summary-other', other.academyId, 'Ana');
  const addParticipant = f.db.sqlite.prepare(`INSERT INTO registration_participants
    (id, academy_id, full_name, curp, division, shirt_size) VALUES (?, ?, ?, ?, 'adulto', 'm')`);
  addParticipant.run('summary-participant', admin.academyId, 'Bailarina', 'SUMMARY-PARTICIPANT');
  addParticipant.run('summary-participant-empty', admin.academyId, 'Sin danzas', 'SUMMARY-EMPTY');
  const addDance = f.db.sqlite.prepare(`INSERT INTO registration_dances
    (id, academy_id, title, genre, subgenre, category, venue, created_at)
    VALUES (?, ?, ?, 'motion', 'ballet', 'solo', ?, ?)`);
  // Insert the tied winner first: recency must not depend on insertion order or title.
  addDance.run('summary-dance-z', admin.academyId, 'Alpha latest', 'puebla', '2026-10-01 12:00:00');
  addDance.run('summary-dance-a', admin.academyId, 'Zebra tied', 'cdmx', '2026-10-01 12:00:00');
  addDance.run('summary-dance-old', admin.academyId, 'Zebra oldest', 'cdmx', '2026-09-01 12:00:00');
  addDance.run('summary-dance-other', other.academyId, 'Other academy latest', 'edomex', '2026-10-02 12:00:00');
  const linkChoreographer = f.db.sqlite.prepare('INSERT INTO registration_dance_choreographers(dance_id, choreographer_id) VALUES (?, ?)');
  const linkParticipant = f.db.sqlite.prepare('INSERT INTO registration_dance_participants(dance_id, participant_id) VALUES (?, ?)');
  for (const id of ['summary-dance-z', 'summary-dance-a', 'summary-dance-old']) {
    linkChoreographer.run(id, 'summary-many');
    linkParticipant.run(id, 'summary-participant');
  }
  linkChoreographer.run('summary-dance-other', 'summary-other');

  const { json } = await f.request('/admin/participants', { cookie: admin.cookie });
  const summaries = json.choreographers.map(({ id, academyName, danceCount, eventVenues, latestDanceTitle, latestDanceAt }) => ({
    id, academyName, danceCount, eventVenues: [...eventVenues].sort(), latestDanceTitle, latestDanceAt,
  }));
  assert.deepEqual(summaries, [
    { id: 'summary-empty', academyName: 'Alpha Academy', danceCount: 0, eventVenues: [], latestDanceTitle: null, latestDanceAt: null },
    { id: 'summary-many', academyName: 'Alpha Academy', danceCount: 3, eventVenues: ['cdmx', 'puebla'], latestDanceTitle: 'Alpha latest', latestDanceAt: '2026-10-01 12:00:00' },
    { id: 'summary-other', academyName: 'Beta Academy', danceCount: 1, eventVenues: ['edomex'], latestDanceTitle: 'Other academy latest', latestDanceAt: '2026-10-02 12:00:00' },
  ]);
  assert.deepEqual(json.participants.map(({ id, eventVenues }) => ({ id, eventVenues: [...eventVenues].sort() })), [
    { id: 'summary-participant', eventVenues: ['cdmx', 'puebla'] },
    { id: 'summary-participant-empty', eventVenues: [] },
  ]);
});

test('admin choreographer summaries retain legacy link counts when a linked dance is missing', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'summary-orphan-admin', { role: 'admin' });
  f.db.sqlite.prepare('INSERT INTO registration_choreographers(id, academy_id, full_name) VALUES (?, ?, ?)')
    .run('summary-orphan', admin.academyId, 'Legacy choreographer');
  f.db.sqlite.exec('PRAGMA foreign_keys = OFF');
  f.db.sqlite.exec("INSERT INTO registration_dance_choreographers(dance_id, choreographer_id) VALUES ('missing-dance', 'summary-orphan')");
  f.db.sqlite.exec('PRAGMA foreign_keys = ON');
  const { json } = await f.request('/admin/participants', { cookie: admin.cookie });
  const [choreographer] = json.choreographers;
  assert.equal(choreographer.danceCount, 1);
  assert.deepEqual(choreographer.eventVenues, []);
  assert.equal(choreographer.latestDanceTitle, null);
  assert.equal(choreographer.latestDanceAt, null);
});


const singlePassCutoff = Date.parse('2026-10-21T00:00:00-06:00');
const ticketSalesCutoff = Date.parse(ticketEvent.salesEndsAt);

function singlePassBuyer(curp = curpA, quantity = 1, productId = 'block') {
  return { curp, buyerName: 'Compradora preventa', buyerEmail: 'preventa@example.test', ...phone,
    items: [{ productId, optionId: 'bloque-6', quantity }] };
}

async function singlePassAdmin(f, suffix = 'presale-admin') {
  const admin = await seedAcademy(f, suffix, { role: 'admin' });
  // Authentication is independent of the campaign clock exercised below.
  f.db.sqlite.prepare("UPDATE registration_sessions SET expires_at = '2099-01-01 00:00:00'").run();
  return admin;
}

test('ticket sales close at exactly 4 pm CDMX while earlier unpaid orders keep lookup and proof access', async t => {
  const f = await fixture(t);
  assert.equal(ticketEvent.salesEndsAt, '2026-11-13T16:00:00-06:00');
  let now = ticketSalesCutoff - 1;
  t.mock.method(Date, 'now', () => now);

  const { json: { order } } = await f.request('/shop/order', {
    method: 'POST', status: 201, body: singlePassBuyer(curpA, 1, 'full'),
  });
  const savedBeforeClosure = f.db.sqlite.prepare(
    'SELECT amount, line_items_json, access_token FROM registration_shop_orders WHERE id = ?',
  ).get(order.id);

  now = ticketSalesCutoff;
  const { json: blocked } = await f.request('/shop/order', {
    method: 'POST', status: 403, body: singlePassBuyer(curpA, 2, 'full'),
  });
  assert.equal(blocked.error.code, 'ticket_sales_closed');
  assert.equal(blocked.error.message, 'La venta de boletos digitales ha concluido.');
  assert.deepEqual(f.db.sqlite.prepare(
    'SELECT amount, line_items_json, access_token FROM registration_shop_orders WHERE id = ?',
  ).get(order.id), savedBeforeClosure, 'the closed endpoint cannot edit or rotate an earlier checkout');
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_shop_orders').get().total, 1);

  const { json: lookup } = await f.request('/shop/order/lookup', {
    method: 'POST', body: { orderId: order.id, accessToken: order.accessToken },
  });
  assert.equal(lookup.order.id, order.id);
  const { json: uploaded } = await f.request('/shop/order/proof', {
    method: 'POST', status: 201, body: { orderId: order.id, accessToken: order.accessToken, ...proof },
  });
  assert.equal(uploaded.order.status, 'payment_reported');
});

test('a ticket request crossing the 4 pm boundary cannot commit a new order or cart update', async t => {
  const f = await fixture(t);
  let now = ticketSalesCutoff - 1;
  t.mock.method(Date, 'now', () => now);
  f.db.beforeRun = sql => {
    if (/^\s*INSERT\s+INTO\s+registration_shop_orders\b/i.test(sql)) now = ticketSalesCutoff;
  };

  const { json: blockedInsert } = await f.request('/shop/order', {
    method: 'POST', status: 403, body: singlePassBuyer(curpA, 1, 'full'),
  });
  assert.equal(blockedInsert.error.code, 'ticket_sales_closed');
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_shop_orders').get().total, 0);

  f.db.beforeRun = undefined;
  now = ticketSalesCutoff - 1;
  const { json: { order } } = await f.request('/shop/order', {
    method: 'POST', status: 201, body: singlePassBuyer(curpA, 1, 'full'),
  });
  const saved = f.db.sqlite.prepare('SELECT amount, line_items_json, access_token FROM registration_shop_orders WHERE id = ?').get(order.id);
  f.db.beforeRun = sql => {
    if (/^\s*UPDATE\s+registration_shop_orders\b/i.test(sql)) now = ticketSalesCutoff;
  };

  const { json: blockedUpdate } = await f.request('/shop/order', {
    method: 'POST', status: 403, body: singlePassBuyer(curpA, 2, 'full'),
  });
  assert.equal(blockedUpdate.error.code, 'ticket_sales_closed');
  assert.deepEqual(
    f.db.sqlite.prepare('SELECT amount, line_items_json, access_token FROM registration_shop_orders WHERE id = ?').get(order.id),
    saved,
  );
});

test('Single pass changes at exactly midnight CDMX for both product aliases and reused carts', async t => {
  for (const productId of ['block', 'ticket-block']) {
    await t.test(productId, async t => {
      const f = await fixture(t);
      let now = singlePassCutoff - 1;
      t.mock.method(Date, 'now', () => now);
      const body = singlePassBuyer(curpA, 2, productId);
      body.items.push({ productId: 'day', optionId: 'domingo-15', quantity: 1 }, { productId: 'full', quantity: 1 });
      const { json: { order: before } } = await f.request('/shop/order', { method: 'POST', status: 201, body });
      assert.equal(before.lineItems[0].unitPrice, 250);
      assert.equal(before.amount, 1550);
      now = singlePassCutoff;
      const { json: { order: after } } = await f.request('/shop/order', { method: 'POST', status: 201, body });
      assert.equal(after.id, before.id);
      assert.deepEqual(after.lineItems.map(line => line.unitPrice), [350, 450, 600]);
      assert.equal(after.amount, 1750);
      assert.equal(f.db.sqlite.prepare('SELECT amount FROM registration_shop_orders WHERE id = ?').get(after.id).amount, 1750);
    });
  }
});


test('a cart edit cannot overwrite an order approved concurrently at the presale price', async t => {
  const f = await fixture(t);
  t.mock.method(Date, 'now', () => singlePassCutoff - 1);
  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer() });
  let approved = false;
  f.db.beforeRun = sql => {
    if (!approved && /UPDATE registration_shop_orders\s+SET participant_name/.test(sql)) {
      approved = true;
      f.db.sqlite.prepare("UPDATE registration_shop_orders SET status = 'paid', paid_amount = 250, paid_at = '2026-10-21 05:59:59' WHERE id = ?").run(order.id);
    }
  };
  const { json } = await f.request('/shop/order', { method: 'POST', status: 409, body: singlePassBuyer(curpA, 3) });
  assert.equal(approved, true);
  assert.equal(json.error.code, 'registration_shop_order_changed');
  const saved = f.db.sqlite.prepare('SELECT status, amount, paid_amount, access_token FROM registration_shop_orders WHERE id = ?').get(order.id);
  assert.equal(saved.status, 'paid');
  assert.equal(saved.amount, 250);
  assert.equal(saved.paid_amount, 250);
  assert.equal(saved.access_token, order.accessToken);
});

test('unpaid presale orders refresh only after token validation and cannot be approved at the old total', async t => {
  const f = await fixture(t);
  const admin = await singlePassAdmin(f);
  let now = singlePassCutoff - 1;
  t.mock.method(Date, 'now', () => now);
  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer(curpA, 3) });
  assert.equal(order.amount, 750);
  now = singlePassCutoff;
  await f.request('/shop/order/lookup', { method: 'POST', status: 404, body: { orderId: order.id, accessToken: 'wrong-token' } });
  assert.equal(f.db.sqlite.prepare('SELECT amount FROM registration_shop_orders WHERE id = ?').get(order.id).amount, 750,
    'an invalid token cannot mutate another buyer order');
  const { json: { order: refreshed } } = await f.request('/shop/order/lookup', {
    method: 'POST', body: { orderId: order.id, accessToken: order.accessToken },
  });
  assert.equal(refreshed.amount, 1050);
  assert.equal(refreshed.lineItems[0].unitPrice, 350);
  const saved = f.db.sqlite.prepare('SELECT amount, line_items_json, notes FROM registration_shop_orders WHERE id = ?').get(order.id);
  assert.equal(saved.amount, 1050);
  assert.equal(JSON.parse(saved.line_items_json)[0].amount, 1050);
  assert.match(saved.notes, /preventa/i);
  assert.equal('notes' in refreshed, false, 'the audit note remains private');
  await f.request('/shop/order/lookup', { method: 'POST', body: { orderId: order.id, accessToken: order.accessToken } });
  assert.equal(f.db.sqlite.prepare('SELECT notes FROM registration_shop_orders WHERE id = ?').get(order.id).notes, saved.notes,
    'the adjustment and audit entry are idempotent');
  const { json: uploaded } = await f.request('/shop/order/proof', { method: 'POST', status: 201,
    body: { orderId: order.id, accessToken: order.accessToken, ...proof } });
  assert.equal(uploaded.order.amount, 1050);
  const { json: rejected } = await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie, status: 400,
    body: { id: order.id, orderType: 'shop', status: 'paid', paidAmount: 750 } });
  assert.equal(rejected.error.code, 'payment_amount_incomplete');
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM registration_event_tickets WHERE source_order_id = ?').get(order.id).n, 0);
  const { json: approved } = await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie,
    body: { id: order.id, orderType: 'shop', status: 'paid', paidAmount: 1050 } });
  assert.equal(approved.order.amount, 1050);
  assert.equal(approved.order.tickets.length, 3);
});

test('a pre-cutoff proof awaiting review retains presale when approved after midnight', async t => {
  const f = await fixture(t);
  const admin = await singlePassAdmin(f);
  let now = singlePassCutoff - 1;
  t.mock.method(Date, 'now', () => now);
  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer(curpA, 2) });
  await f.request('/shop/order/proof', { method: 'POST', status: 201, body: { orderId: order.id, accessToken: order.accessToken, ...proof } });
  now = singlePassCutoff;
  const { json } = await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie,
    body: { id: order.id, orderType: 'shop', status: 'paid', paidAmount: 500 } });
  assert.equal(json.order.amount, 500);
  assert.equal(json.order.status, 'paid');
  assert.equal(json.order.paidAmount, 500);
  assert.equal(json.order.tickets.length, 2);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM registration_shop_payment_proofs WHERE order_id = ?').get(order.id).n, 1);
});

test('an approval crossing midnight keeps the price reserved by its pre-cutoff proof', async t => {
  const f = await fixture(t);
  const admin = await singlePassAdmin(f);
  let now = singlePassCutoff - 1;
  t.mock.method(Date, 'now', () => now);
  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer() });
  await f.request('/shop/order/proof', { method: 'POST', status: 201, body: { orderId: order.id, accessToken: order.accessToken, ...proof } });
  let crossed = false;
  f.db.beforeRun = sql => {
    if (!crossed && /UPDATE registration_shop_orders\s+SET\s+status = \?/.test(sql)) {
      crossed = true;
      now = singlePassCutoff;
    }
  };
  const { json } = await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie,
    body: { id: order.id, orderType: 'shop', status: 'paid', paidAmount: 250 } });
  assert.equal(crossed, true);
  assert.equal(json.order.amount, 250);
  assert.equal(json.order.status, 'paid');
});

test('rejecting the qualifying proof during approval prevents a stale presale approval', async t => {
  const f = await fixture(t);
  const admin = await singlePassAdmin(f);
  let now = singlePassCutoff - 1;
  t.mock.method(Date, 'now', () => now);
  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer() });
  await f.request('/shop/order/proof', { method: 'POST', status: 201, body: { orderId: order.id, accessToken: order.accessToken, ...proof } });
  now = singlePassCutoff;
  let rejected = false;
  f.db.beforeRun = sql => {
    if (!rejected && /UPDATE registration_shop_orders\s+SET\s+status = \?/.test(sql)) {
      rejected = true;
      f.db.sqlite.prepare("UPDATE registration_shop_payment_proofs SET status = 'rejected' WHERE order_id = ?").run(order.id);
    }
  };
  const { json } = await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie, status: 409,
    body: { id: order.id, orderType: 'shop', status: 'paid', paidAmount: 250 } });
  assert.equal(json.error.code, 'registration_shop_order_changed');
  const saved = f.db.sqlite.prepare('SELECT amount, status FROM registration_shop_orders WHERE id = ?').get(order.id);
  assert.equal(saved.amount, 350);
  assert.equal(saved.status, 'payment_reported');
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM registration_event_tickets WHERE source_order_id = ?').get(order.id).n, 0);
});

test('a proof submitted after cutoff receives the regular price even from a pre-cutoff reference', async t => {
  const f = await fixture(t);
  let now = singlePassCutoff - 1;
  t.mock.method(Date, 'now', () => now);
  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer() });
  now = singlePassCutoff;
  const { json } = await f.request('/shop/order/proof', { method: 'POST', status: 201,
    body: { orderId: order.id, accessToken: order.accessToken, ...proof } });
  assert.equal(json.order.amount, 350);
  assert.equal(json.order.lineItems[0].unitPrice, 350);
  assert.equal(json.order.status, 'payment_reported');
});

test('paid orders and timely proofs keep presale while other open orders update without reviving cancelled tickets', async t => {
  const f = await fixture(t);
  const admin = await singlePassAdmin(f);
  let now = singlePassCutoff - 1;
  t.mock.method(Date, 'now', () => now);
  const paid = await createPaidTicketOrder(f, admin, [{ productId: 'block', optionId: 'bloque-6', quantity: 1 }]);
  const cancelled = await createPaidTicketOrder(f, admin, [{ productId: 'block', optionId: 'bloque-6', quantity: 3 }]);
  f.db.sqlite.prepare("UPDATE registration_event_tickets SET status = 'cancelled' WHERE source_order_id = ?").run(cancelled.id);
  f.db.sqlite.prepare("UPDATE registration_shop_orders SET status = 'rejected', paid_amount = 0, notes = 'Duplicada cancelada' WHERE id = ?").run(cancelled.id);
  const { json: { order: reported } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer(curpA, 2) });
  await f.request('/shop/order/proof', { method: 'POST', status: 201, body: { orderId: reported.id, accessToken: reported.accessToken, ...proof } });
  const { json: { order: pending } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer(curpB, 3) });
  now = singlePassCutoff;
  const { json } = await f.request('/admin/payment-orders?includeTotals=1', { cookie: admin.cookie });
  const byId = new Map(json.orders.map(order => [order.id, order]));
  assert.equal(byId.get(paid.id).amount, 250);
  assert.equal(byId.get(paid.id).paidAmount, 250);
  assert.equal(byId.get(reported.id).amount, 500);
  assert.equal(byId.get(pending.id).amount, 1050);
  assert.equal(byId.get(cancelled.id).amount, 750);
  assert.equal(byId.get(cancelled.id).notes, 'Duplicada cancelada');
  assert.equal(json.totals.amount, 2550);
  assert.equal(json.totals.paidAmount, 250);
  const { json: exported } = await f.request('/admin/payment-orders?export=1', { cookie: admin.cookie });
  assert.equal(exported.orders.find(order => order.id === pending.id).amount, 1050);
  const { json: kept } = await f.request('/shop/order/lookup', { method: 'POST', body: { orderId: paid.id, accessToken: paid.accessToken } });
  assert.equal(kept.order.amount, 250);
  assert.equal(kept.order.lineItems[0].unitPrice, 250);
  assert.equal(kept.order.tickets.length, 1);
  assert.equal(f.db.sqlite.prepare("SELECT count(*) AS n FROM registration_event_tickets WHERE source_order_id = ? AND status = 'cancelled'").get(cancelled.id).n, 3);
});

test('timely proofs restore the prior automatic increase, including orders already approved afterwards', async t => {
  for (const status of ['payment_reported', 'paid']) {
    await t.test(status, async t => {
      const f = await fixture(t);
      const admin = await singlePassAdmin(f);
      let now = singlePassCutoff - 1000;
      t.mock.method(Date, 'now', () => now);
      let order;
      if (status === 'paid') {
        order = await createPaidTicketOrder(f, admin, [{ productId: 'block', optionId: 'bloque-6', quantity: 3 }]);
      } else {
        ({ json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer(curpA, 3) }));
        await f.request('/shop/order/proof', { method: 'POST', status: 201, body: { orderId: order.id, accessToken: order.accessToken, ...proof } });
      }
      const originalTickets = f.db.sqlite.prepare('SELECT id, ticket_code, status FROM registration_event_tickets WHERE source_order_id = ? ORDER BY id').all(order.id);
      const increasedLines = order.lineItems.map(line => ({ ...line, unitPrice: 350, amount: 1050 }));
      const audit = '[single-pass-price 2026-10-21T00:00:00-06:00] 2026-10-21T06:00:01.000Z: fin de preventa; 3 Single Pass de $250 a $350; total $750 a $1050. Pagos reportados y comprobantes conservados.';
      f.db.sqlite.prepare('UPDATE registration_shop_orders SET amount = 1050, line_items_json = ?, notes = ?, paid_amount = ? WHERE id = ?')
        .run(JSON.stringify(increasedLines), audit, status === 'paid' ? 1050 : 0, order.id);
      now = singlePassCutoff + 24 * 60 * 60 * 1000;
      const { json } = await f.request('/shop/order/lookup', { method: 'POST', body: { orderId: order.id, accessToken: order.accessToken } });
      assert.equal(json.order.amount, 750);
      assert.equal(json.order.lineItems[0].unitPrice, 250);
      assert.equal(json.order.status, status);
      assert.equal(json.order.paidAmount, status === 'paid' ? 1050 : 0, 'restoring the price never rewrites money already recorded');
      assert.deepEqual(f.db.sqlite.prepare('SELECT id, ticket_code, status FROM registration_event_tickets WHERE source_order_id = ? ORDER BY id').all(order.id), originalTickets);
      const notes = f.db.sqlite.prepare('SELECT notes FROM registration_shop_orders WHERE id = ?').get(order.id).notes;
      assert.ok(notes.startsWith(audit));
      assert.match(notes, /restaurado/);
      await f.request('/shop/order/lookup', { method: 'POST', body: { orderId: order.id, accessToken: order.accessToken } });
      assert.equal(f.db.sqlite.prepare('SELECT notes FROM registration_shop_orders WHERE id = ?').get(order.id).notes, notes, 'restoration is idempotent');
      await f.request('/admin/inscription-order/notes', { method: 'POST', cookie: admin.cookie,
        body: { id: order.id, orderType: 'shop', notes: 'Nota del administrador' } });
      assert.ok(f.db.sqlite.prepare('SELECT notes FROM registration_shop_orders WHERE id = ?').get(order.id).notes.includes(notes));
      if (status === 'payment_reported') {
        const { json: approved } = await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie,
          body: { id: order.id, orderType: 'shop', status: 'paid', paidAmount: 750, notes: 'Borrador anterior' } });
        assert.equal(approved.order.tickets.length, 3);
        assert.equal(approved.order.amount, 750);
        assert.ok(f.db.sqlite.prepare('SELECT notes FROM registration_shop_orders WHERE id = ?').get(order.id).notes.includes(notes));
      }
    });
  }
});

test('cutoff, rejected, replaced, invalid and client-provided proof timestamps do not reserve presale', async t => {
  for (const [name, timestamp, proofStatus] of [
    ['at cutoff', '2026-10-21 06:00:00', 'submitted'],
    ['after cutoff', '2026-10-21 06:00:01', 'submitted'],
    ['rejected', '2026-10-21 05:59:59', 'rejected'],
    ['invalid time', 'not-a-timestamp', 'submitted'],
  ]) {
    await t.test(name, async t => {
      const f = await fixture(t);
      let now = singlePassCutoff - 1000;
      t.mock.method(Date, 'now', () => now);
      const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer() });
      await f.request('/shop/order/proof', { method: 'POST', status: 201, body: { orderId: order.id, accessToken: order.accessToken, ...proof } });
      f.db.sqlite.prepare('UPDATE registration_shop_payment_proofs SET uploaded_at = ?, status = ? WHERE order_id = ?')
        .run(timestamp, proofStatus, order.id);
      now = singlePassCutoff;
      const { json } = await f.request('/shop/order/lookup', { method: 'POST', body: { orderId: order.id, accessToken: order.accessToken } });
      assert.equal(json.order.amount, 350);
    });
  }
  await t.test('replacement after cutoff', async t => {
    const f = await fixture(t);
    let now = singlePassCutoff - 1000;
    t.mock.method(Date, 'now', () => now);
    const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer() });
    await f.request('/shop/order/proof', { method: 'POST', status: 201, body: { orderId: order.id, accessToken: order.accessToken, ...proof } });
    f.db.sqlite.prepare(`INSERT INTO registration_shop_payment_proofs (id, order_id, file_name, content_type, file_size, data_url, uploaded_at)
      VALUES ('replacement-proof', ?, 'nuevo.png', 'image/png', 3, 'data:image/png;base64,AQID', '2026-10-21 06:00:00')`).run(order.id);
    now = singlePassCutoff;
    const { json } = await f.request('/shop/order/lookup', { method: 'POST', body: { orderId: order.id, accessToken: order.accessToken } });
    assert.equal(json.order.amount, 350, 'only the current proof reserves a price');
  });
  await t.test('the client cannot backdate a new proof', async t => {
    const f = await fixture(t);
    t.mock.method(Date, 'now', () => singlePassCutoff);
    const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer() });
    const { json } = await f.request('/shop/order/proof', { method: 'POST', status: 201,
      body: { orderId: order.id, accessToken: order.accessToken, ...proof, uploadedAt: '2026-10-20 12:00:00', uploaded_at: '2026-10-20 12:00:00' } });
    assert.equal(json.order.amount, 350);
    assert.equal(f.db.sqlite.prepare('SELECT uploaded_at FROM registration_shop_payment_proofs WHERE order_id = ?').get(order.id).uploaded_at, '2026-10-21 06:00:00');
  });
});

test('repricing preserves other products, media discount and a recorded partial payment', async t => {
  const f = await fixture(t);
  let now = singlePassCutoff - 1;
  t.mock.method(Date, 'now', () => now);
  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201, body: singlePassBuyer() });
  const lines = [...order.lineItems, { id: 'solo:dance-one', productId: 'solo', productName: 'Solos', itemType: 'media',
    productCategory: 'Fotografía y video', quantity: 1, unitPrice: 800, amount: 800 }];
  f.db.sqlite.prepare("UPDATE registration_shop_orders SET line_items_json = ?, amount = 970, paid_amount = 100, discount_amount = 80, discount_code = 'COLIBRI26' WHERE id = ?")
    .run(JSON.stringify(lines), order.id);
  now = singlePassCutoff;
  const { json } = await f.request('/shop/order/lookup', { method: 'POST', body: { orderId: order.id, accessToken: order.accessToken } });
  assert.equal(json.order.amount, 1070);
  assert.equal(json.order.paidAmount, 100);
  assert.equal(json.order.discountAmount, 80);
  assert.equal(json.order.lineItems[1].unitPrice, 800);
  assert.equal(json.order.lineItems[1].amount, 800);
});

test('inscription and shop payments keep proof, approval, ticket creation and token validation', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'payer');
  const admin = await seedAcademy(f, 'reviewer', { role: 'admin' });
  await createDance(f, academy);
  const { json: lookup } = await f.request('/inscription/lookup', { method: 'POST', cookie: academy.cookie, body: { curp: curpA } });
  assert.equal(lookup.lines.length, 1);
  const { json: { order } } = await f.request('/inscription/order', { method: 'POST', cookie: academy.cookie,
    body: { curp: curpA, ...phone }, status: 201 });
  assert.equal(order.status, 'pending_payment');
  assert.ok(order.amount > 0);
  await f.request('/inscription/order/status', { method: 'POST', cookie: academy.cookie, body: { id: order.id, status: 'paid' }, status: 403 });
  await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie,
    body: { id: order.id, status: 'paid', paidAmount: order.amount }, status: 400 });
  const uploaded = await f.request('/inscription/order/proof', { method: 'POST', cookie: academy.cookie,
    body: { orderId: order.id, curp: curpA, ...proof }, status: 201 });
  assert.equal(uploaded.json.order.status, 'payment_reported');
  await f.request('/inscription/order/proof', { method: 'POST', cookie: academy.cookie,
    body: { orderId: order.id, curp: curpA, ...proof }, status: 409 });
  const paid = await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie,
    body: { id: order.id, status: 'paid', paidAmount: order.amount, reviewedBy: 'Test admin' } });
  assert.equal(paid.json.order.status, 'paid');
  const { json: ownOrders } = await f.request('/inscription/orders', { cookie: academy.cookie });
  assert.equal(ownOrders.orders[0].id, order.id);
  assert.equal(ownOrders.orders[0].status, 'paid');
  const { json: { order: shop } } = await f.request('/shop/order', { method: 'POST', status: 201,
    body: { curp: curpA, buyerName: 'Comprador', buyerEmail: 'comprador@example.test', ...phone,
      items: [{ productId: 'ticket-full-pass', quantity: 2 }] } });
  assert.equal(shop.amount, 1200);
  assert.ok(shop.accessToken);
  await f.request('/shop/order/lookup', { method: 'POST', body: { orderId: shop.id, accessToken: 'invalid-token' }, status: 404 });
  await f.request('/shop/order/proof', { method: 'POST', body: { orderId: shop.id, accessToken: 'invalid-token', ...proof }, status: 404 });
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_shop_payment_proofs').get().total, 0);
  await f.request('/shop/order/proof', { method: 'POST', status: 201, body: { orderId: shop.id, accessToken: shop.accessToken, ...proof } });
  const shopPaid = await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie,
    body: { id: shop.id, orderType: 'shop', status: 'paid', paidAmount: shop.amount } });
  assert.equal(shopPaid.json.order.status, 'paid');
  const tickets = f.db.sqlite.prepare('SELECT * FROM registration_event_tickets WHERE source_order_id = ?').all(shop.id);
  assert.equal(tickets.length, 2, 'business ensureEventTickets still creates each paid ticket');
  const { json: shopLookup } = await f.request('/shop/order/lookup', { method: 'POST', body: { orderId: shop.id, accessToken: shop.accessToken } });
  assert.equal(shopLookup.order.status, 'paid');
  await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie,
    body: { id: shop.id, orderType: 'shop', status: 'paid', paidAmount: shop.amount } });
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_event_tickets WHERE source_order_id = ?').get(shop.id).total, 2);
  const scanned = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie, body: { ticketCode: tickets[0].ticket_code, blockId: 'bloque-1' } });
  assert.equal(scanned.json.admitted, true);
  const rescanned = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie, body: { ticketCode: tickets[0].ticket_code } });
  assert.equal(rescanned.json.reason, 'already_used');
  const { json: allOrders } = await f.request('/admin/inscription-orders', { cookie: admin.cookie });
  assert.equal(allOrders.orders.length, 2);
});

test('one configured scanner installer activates independent phones without consuming its authorization', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-installer-admin', { role: 'admin' });
  const token = 'scanner-installer-fixture-token-for-multiple-phones';
  const tokenHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  f.env.REGISTRATION_SCANNER_INSTALLER = JSON.stringify({ version: 1, tokenHash, issuedByUserId: admin.userId });
  const activations = await Promise.all(['Puerta norte', 'Puerta sur'].map(async deviceName => {
    const { json } = await f.request('/scanner/activate', { method: 'POST', status: 201,
      body: { pairingPayload: `LEVITATE:SCANNER-PAIR:${token}`, deviceName } });
    return json;
  }));
  assert.notEqual(activations[0].deviceToken, activations[1].deviceToken);
  assert.notEqual(activations[0].device.id, activations[1].device.id);
  const records = f.db.sqlite.prepare('SELECT pairing_code_id,created_by_user_id FROM registration_scanner_devices').all();
  assert.equal(new Set(records.map(r => r.pairing_code_id)).size, 2);
  assert.ok(records.every(r => r.created_by_user_id === admin.userId));
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM registration_scanner_pairing_codes WHERE used_at IS NOT NULL').get().n, 2);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM registration_scanner_pairing_codes WHERE pairing_token_hash=?').get(tokenHash).n, 0);
  for (const a of activations) {
    const { json } = await f.request('/scanner/me', { headers: { authorization: `Scanner ${a.deviceToken}` } });
    assert.equal(json.device.id, a.device.id);
    assert.deepEqual(json.blocks.map(b => b.id), scannerAccessIds);
  }
  await f.request('/scanner/me', { headers: { authorization: `Scanner ${token}` }, status: 401 });
  f.db.sqlite.prepare("UPDATE registration_scanner_devices SET status='revoked' WHERE id=?").run(activations[0].device.id);
  await f.request('/scanner/me', { headers: { authorization: `Scanner ${activations[0].deviceToken}` }, status: 401 });
  await f.request('/scanner/me', { headers: { authorization: `Scanner ${activations[1].deviceToken}` } });
  assert.doesNotMatch(JSON.stringify(activations), new RegExp(token));
});

test('unconfigured, mismatched, malformed and disabled scanner installers cannot authorize phones', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-installer-guards', { role: 'admin' });
  const academy = await seedAcademy(f, 'scanner-installer-academy');
  const token = 'scanner-installer-fixture-token-for-guard-checks';
  const tokenHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  const request = () => f.request('/scanner/activate', { method: 'POST', status: 401,
    body: { pairingPayload: `LEVITATE:SCANNER-PAIR:${token}`, deviceName: 'No autorizado' } });
  for (const config of [undefined, '', '{broken', '{}',
    JSON.stringify({ version: 1, tokenHash: 'a'.repeat(64), issuedByUserId: admin.userId }),
    JSON.stringify({ version: 1, tokenHash, issuedByUserId: academy.userId }),
    JSON.stringify({ version: 1, tokenHash, issuedByUserId: 'missing-admin' })]) {
    f.env.REGISTRATION_SCANNER_INSTALLER = config;
    await request();
  }
  f.db.sqlite.prepare("UPDATE registration_users SET status='disabled' WHERE id=?").run(admin.userId);
  f.env.REGISTRATION_SCANNER_INSTALLER = JSON.stringify({ version: 1, tokenHash, issuedByUserId: admin.userId });
  await request();
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM registration_scanner_devices').get().n, 0);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM registration_scanner_pairing_codes').get().n, 0);
});

test('ordinary scanner pairing remains single-use and expires even with a reusable installer configured', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-once-admin', { role: 'admin' });
  f.env.REGISTRATION_SCANNER_INSTALLER = JSON.stringify({ version: 1, tokenHash: 'b'.repeat(64), issuedByUserId: admin.userId });
  const { json: pairing } = await f.request('/admin/scanner/pairing-code', { method: 'POST', cookie: admin.cookie, status: 201 });
  const body = { pairingPayload: pairing.pairingPayload, deviceName: 'Uno solo' };
  await f.request('/scanner/activate', { method: 'POST', status: 201, body });
  await f.request('/scanner/activate', { method: 'POST', status: 401, body });
  const { json: expired } = await f.request('/admin/scanner/pairing-code', { method: 'POST', cookie: admin.cookie, status: 201 });
  f.db.sqlite.prepare("UPDATE registration_scanner_pairing_codes SET expires_at=datetime('now','-1 minute') WHERE used_at IS NULL").run();
  await f.request('/scanner/activate', { method: 'POST', status: 401, body: { ...body, pairingPayload: expired.pairingPayload } });
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS n FROM registration_scanner_devices').get().n, 1);
});

test('ticket scanner block catalog is available only to activated devices and activation returns it', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-catalog-admin', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin);
  assert.deepEqual(scanner.blocks.map(block => block.id), scannerAccessIds);
  assert.deepEqual(scanner.blocks.slice(0, 4).map(block => block.date), Array(4).fill('2026-11-14'));
  const { json: current } = await f.request('/scanner/me', { headers: scanner.headers });
  assert.deepEqual(current.blocks, scanner.blocks);
  assert.equal(current.device.id, scanner.device.id);
  await f.request('/scanner/me', { status: 401 });
  await f.request('/scanner/ticket/scan', { method: 'POST', body: { qrPayload: 'LEVITATE:TICKET:LV-AAAA-BBBB', blockId: 'bloque-1' }, status: 401 });
  await f.request('/admin/ticket/scan', { method: 'POST', body: { qrPayload: 'LEVITATE:TICKET:LV-AAAA-BBBB', blockId: 'bloque-1' }, status: 401 });
});

test('attendance summaries authenticate before reads and return seven zero counters without writes', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'attendance-admin', { role: 'admin' });
  const academy = await seedAcademy(f, 'attendance-academy');
  const scanner = await activateTicketScanner(f, admin);
  const start = f.db.runtimeQueries.length;
  await f.request('/scanner/attendance', { status: 401 });
  await f.request('/admin/attendance', { status: 401 });
  await f.request('/admin/attendance', { cookie: academy.cookie, status: 403 });
  assert.ok(f.db.runtimeQueries.slice(start).every(sql => !sql.includes('registration_attendance')));
  const readsStart = f.db.runtimeQueries.length;
  for (const [path, options] of [['/scanner/attendance', { headers: scanner.headers }], ['/admin/attendance', { cookie: admin.cookie }]]) {
    const { json: { attendance } } = await f.request(path, options);
    assert.equal(attendance.eventId, 'edomex-2026-otono');
    assert.equal(attendance.uniqueAdmissions, 0);
    assert.equal(attendance.blocks.length, 7);
    assert.ok(attendance.blocks.every(block => block.total === 0 && block.single === 0 && block.day === 0 && block.full === 0));
    assert.match(attendance.updatedAt, /^\d{4}-\d\d-\d\dT.*Z$/);
    assert.deepEqual(attendance.blocks.slice(0, 4).map(block => block.dayId), Array(4).fill('sabado-14'));
    assert.deepEqual(attendance.blocks.slice(4).map(block => block.dayId), Array(3).fill('domingo-15'));
  }
  assert.ok(f.db.runtimeQueries.slice(readsStart).every(sql => /^\s*(?:SELECT|WITH)/.test(sql)), 'polling must not write last_seen_at or counters');
  await f.request('/scanner/attendance?eventId=missing-event', { headers: scanner.headers, status: 404 });
  f.db.sqlite.prepare("UPDATE registration_scanner_devices SET status = 'revoked' WHERE id = ?").run(scanner.device.id);
  await f.request('/scanner/attendance', { headers: scanner.headers, status: 401 });
});

test('ticket sales summaries require scanner or global admin authentication and never write', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'sales-admin', { role: 'admin' });
  const academy = await seedAcademy(f, 'sales-academy');
  const scanner = await activateTicketScanner(f, admin);
  const start = f.db.runtimeQueries.length;
  await f.request('/admin/ticket-sales-summary', { status: 401 });
  await f.request('/scanner/ticket-sales-summary', { status: 401 });
  await f.request('/admin/ticket-sales-summary', { cookie: academy.cookie, status: 403 });
  assert.ok(f.db.runtimeQueries.slice(start).every(sql => !sql.includes('JSON_GROUP_ARRAY')));
  const readStart = f.db.runtimeQueries.length;
  for (const [path, options] of [['/admin/ticket-sales-summary', { cookie: admin.cookie }], ['/scanner/ticket-sales-summary', { headers: scanner.headers }]]) {
    const { json: { sales } } = await f.request(path, options);
    assert.equal(sales.eventId, ticketEvent.eventId);
    assert.equal(sales.capacityPerBlock, 500);
    assert.equal(sales.uniqueTickets, 0);
    assert.equal(sales.unassignedTickets, 0);
    assert.equal(sales.blocks.length, 7);
    assert.ok(sales.blocks.every(block => block.total === 0 && block.single === 0 && block.day === 0 && block.full === 0));
    assert.match(sales.updatedAt, /^\d{4}-\d\d-\d\dT.*Z$/);
  }
  assert.ok(f.db.runtimeQueries.slice(readStart).every(sql => /^\s*SELECT/.test(sql)), 'sales refresh must not write session timestamps, counters or ticket issuance');
  await f.request('/admin/ticket-sales-summary?eventId=unknown', { cookie: admin.cookie, status: 404 });
  await f.request('/scanner/ticket-sales-summary', { method: 'POST', headers: scanner.headers, status: 405 });
  f.db.sqlite.prepare("UPDATE registration_scanner_devices SET status = 'revoked' WHERE id = ?").run(scanner.device.id);
  await f.request('/scanner/ticket-sales-summary', { headers: scanner.headers, status: 401 });
});

test('sales count paid issued tickets across both order types and preserve ticket positions after cancellation', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'sales-coverage', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin);
  const first = await createPaidTicketOrder(f, admin, [
    { productId: 'block', optionId: 'bloque-1', quantity: 1 },
    { productId: 'day', optionId: 'sabado-14', quantity: 1 },
    { productId: 'day', optionId: 'domingo-15', quantity: 1 },
    { productId: 'full', quantity: 1 },
  ]);
  const second = await createPaidTicketOrder(f, admin, [
    { productId: 'block', optionId: 'bloque-2', quantity: 2 }, { productId: 'full', quantity: 1 },
  ]);
  // Source type is part of the order identity. Media never consumes ticket numbers.
  f.db.sqlite.prepare(`INSERT INTO registration_inscription_orders
    (id, curp, participant_name, academy_name, venue, reference, status, line_items_json)
    VALUES (?, 'PRIVATE-CURP', 'Private holder', 'Academia', 'cdmx', 'REG-SALES-COVERAGE', 'paid', ?)`)
    .run(second.id, JSON.stringify([{ productId: 'photo-solos', itemType: 'media', quantity: 50 },
      { productId: 'full', itemType: 'ticket', quantity: 1, eventId: ticketEvent.eventId }]));
  f.db.sqlite.prepare(`INSERT INTO registration_event_tickets
    (id, source_order_type, source_order_id, ticket_code, ticket_number, ticket_label, holder_name, qr_payload)
    VALUES ('sales-registration-ticket', 'registration', ?, 'LV-SALE-REGO', 1, 'Old printed label', 'Private holder', 'LEVITATE:TICKET:LV-SALE-REGO')`).run(second.id);
  const summary = async () => (await f.request('/scanner/ticket-sales-summary', { headers: scanner.headers })).json.sales;
  const original = await summary();
  assert.equal(original.uniqueTickets, 8);
  assert.equal(original.unassignedTickets, 0);
  assert.deepEqual(original.blocks.map(({ total, single, day, full }) => [total, single, day, full]), [
    [5, 1, 1, 3], [6, 2, 1, 3], [4, 0, 1, 3], [4, 0, 1, 3], [4, 0, 1, 3], [4, 0, 1, 3], [4, 0, 1, 3],
  ]);
  assert.doesNotMatch(JSON.stringify(original), /Private holder|PRIVATE-CURP|buyerEmail|ticketCode|sourceOrderId/);
  const scanStart = f.db.runtimeQueries.length;
  const { json: scanned } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
    body: { qrPayload: first.tickets[3].qrPayload, blockId: 'bloque-1' } });
  assert.equal(scanned.admitted, true);
  await f.request('/scanner/attendance', { headers: scanner.headers });
  assert.ok(f.db.runtimeQueries.slice(scanStart).every(sql => !sql.includes('JSON_GROUP_ARRAY')), 'QR scans and attendance polling must not recalculate sales');
  assert.deepEqual((await summary()).blocks, original.blocks, 'using an already purchased QR does not sell another ticket');
  f.db.sqlite.prepare("UPDATE registration_event_tickets SET status = 'cancelled' WHERE id = ?").run(second.tickets[0].id);
  const cancelled = await summary();
  assert.equal(cancelled.uniqueTickets, 7);
  assert.deepEqual(cancelled.blocks.map(block => block.total), [5, 5, 4, 4, 4, 4, 4]);
  assert.equal(cancelled.blocks[1].single, 1, 'ticket #2 remains the second Single while #3 remains Full');
  await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie, body: {
    id: second.id, orderType: 'shop', status: 'rejected', rejectionReason: 'payment_not_found', rejectionMessage: 'Revisión',
  } });
  const rejected = await summary();
  assert.equal(rejected.uniqueTickets, 5);
  assert.deepEqual(rejected.blocks.map(block => block.total), [4, 3, 3, 3, 3, 3, 3]);
  for (const status of ['pending_payment', 'payment_reported', 'rejected']) {
    f.db.sqlite.prepare('UPDATE registration_shop_orders SET status = ? WHERE id = ?').run(status, first.id);
    assert.equal((await summary()).uniqueTickets, 1, `exclude ${status} even when tickets were previously issued or used`);
  }
  f.db.sqlite.prepare('DELETE FROM registration_inscription_orders WHERE id = ?').run(second.id);
  assert.equal((await summary()).uniqueTickets, 0, 'orphan tickets do not count as approved purchases');
  const { json: currentAttendance } = await f.request('/scanner/attendance', { headers: scanner.headers });
  assert.equal(currentAttendance.attendance.uniqueAdmissions, 1, 'payment changes must preserve the admission ledger');
  assert.ok(currentAttendance.attendance.blocks.every(block => block.total === 1));
  const query = f.db.runtimeQueries.find(sql => sql.includes('JSON_GROUP_ARRAY'));
  const plan = f.db.sqlite.prepare(`EXPLAIN QUERY PLAN ${query}`).all(ticketEvent.eventId, ticketEvent.eventId).map(row => row.detail).join('\n');
  assert.match(plan, /USING COVERING INDEX idx_registration_event_tickets_event_sales/);
});

test('sales report legacy tickets without trustworthy day or event metadata as unassigned', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'sales-legacy', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [
    { productId: 'day', optionId: 'sabado-14', quantity: 1 }, { productId: 'full', quantity: 1 },
  ]);
  const lines = order.lineItems.map((line, index) => index === 0 ? { ...line, optionId: undefined } : { ...line, eventId: 'different-event' });
  f.db.sqlite.prepare('UPDATE registration_shop_orders SET line_items_json = ? WHERE id = ?').run(JSON.stringify(lines), order.id);
  f.db.sqlite.prepare("UPDATE registration_event_tickets SET ticket_label = 'Full pass válido todos los días' WHERE source_order_id = ?").run(order.id);
  const { json: { sales } } = await f.request('/admin/ticket-sales-summary', { cookie: admin.cookie });
  assert.equal(sales.uniqueTickets, 2);
  assert.equal(sales.unassignedTickets, 2);
  assert.ok(sales.blocks.every(block => block.total === 0));
  f.db.sqlite.prepare("UPDATE registration_event_tickets SET event_id = 'different-event' WHERE id = ?").run(order.tickets[1].id);
  const { json: scoped } = await f.request('/admin/ticket-sales-summary', { cookie: admin.cookie });
  assert.equal(scoped.sales.uniqueTickets, 1, 'tickets issued for another event are excluded entirely');
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_ticket_admissions').get().total, 0);
});

test('historical sales use the saved event catalog and the 500 capacity fallback', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'sales-history', { role: 'admin' });
  const historical = { eventId: 'past-sales-event', eventName: 'Encuentro anterior', venue: 'puebla',
    days: [{ id: 'past-day', label: 'Día anterior', blockIds: ['past-1', 'past-2'] }],
    blocks: [1, 2].map(number => ({ id: `past-${number}`, label: `Anterior ${number}`, dayId: 'past-day', date: '2025-01-01' })) };
  f.db.sqlite.prepare('INSERT INTO registration_attendance_events(id,name,venue,metadata_json) VALUES (?,?,?,?)')
    .run(historical.eventId, historical.eventName, historical.venue, JSON.stringify(historical));
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'full', quantity: 2 }]);
  const historicLines = [
    { productId: 'day', itemType: 'ticket', quantity: 1, optionId: 'past-day', eventId: historical.eventId },
    { productId: 'full', itemType: 'ticket', quantity: 1, eventId: historical.eventId },
  ];
  f.db.sqlite.prepare('UPDATE registration_shop_orders SET line_items_json = ? WHERE id = ?').run(JSON.stringify(historicLines), order.id);
  f.db.sqlite.prepare('UPDATE registration_event_tickets SET event_id = ? WHERE source_order_id = ?').run(historical.eventId, order.id);
  const { json: { sales } } = await f.request('/admin/ticket-sales-summary?eventId=past-sales-event', { cookie: admin.cookie });
  assert.equal(sales.eventName, historical.eventName);
  assert.equal(sales.capacityPerBlock, 500);
  assert.equal(sales.uniqueTickets, 2);
  assert.equal(sales.unassignedTickets, 0);
  assert.deepEqual(sales.blocks, historical.blocks.map(block => ({ ...block, total: 2, single: 0, day: 1, full: 1 })));
});

test('Day purchases require a canonical day and discard forged labels and event IDs', async t => {
  const f = await fixture(t);
  const buyer = { curp: curpA, buyerName: 'Titular', buyerEmail: 'day@example.test', ...phone };
  for (const productId of ['day', 'ticket-day-pass']) {
    for (const [optionId, code] of [[undefined, 'shop_ticket_day_required'], ['lunes-16', 'shop_ticket_day_invalid']]) {
      const { json } = await f.request('/shop/order', { method: 'POST', status: 400, body: { ...buyer, items: [{ productId, optionId }] } });
      assert.equal(json.error.code, code);
    }
  }
  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201,
    body: { ...buyer, items: [{ productId: 'day', optionId: 'domingo-15', optionLabel: 'Todos los días', eventId: 'forged-event' }] } });
  assert.equal(order.lineItems[0].optionLabel, ticketEvent.days.find(day => day.id === 'domingo-15').label);
  assert.equal(order.lineItems[0].eventId, ticketEvent.eventId);
});

test('first admissions credit Single one block, Day its purchased day and Full all seven exactly once', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'attendance-types', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin, 'Puerta Norte');
  const order = await createPaidTicketOrder(f, admin, [
    { productId: 'block', optionId: 'bloque-1', quantity: 1 },
    { productId: 'day', optionId: 'sabado-14', quantity: 1 },
    { productId: 'day', optionId: 'domingo-15', quantity: 1 },
    { productId: 'full', quantity: 1 },
  ]);
  const blocks = ['bloque-1', 'bloque-3', 'bloque-6', 'bloque-7'];
  let latest;
  for (const [index, ticket] of order.tickets.entries()) {
    if (index === 1) {
      const { json: wrong } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
        body: { qrPayload: ticket.qrPayload, blockId: 'bloque-5' } });
      assert.equal(wrong.reason, 'wrong_day');
      assert.equal(wrong.attendance.uniqueAdmissions, 1);
    }
    const { json } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
      body: { qrPayload: ticket.qrPayload, blockId: blocks[index], eventId: ticketEvent.eventId } });
    assert.equal(json.admitted, true);
    assert.equal(json.attendance.uniqueAdmissions, index + 1);
    latest = json.attendance;
    const { json: duplicate } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
      body: { qrPayload: ticket.qrPayload, blockId: blocks[index] } });
    assert.equal(duplicate.reason, 'already_used');
    assert.equal(duplicate.attendance.uniqueAdmissions, index + 1);
  }
  assert.deepEqual(latest.blocks.map(({ total, single, day, full }) => [total, single, day, full]), [
    [3, 1, 1, 1], [2, 0, 1, 1], [2, 0, 1, 1], [2, 0, 1, 1], [2, 0, 1, 1], [2, 0, 1, 1], [2, 0, 1, 1],
  ]);
  const admissions = f.db.sqlite.prepare('SELECT * FROM registration_ticket_admissions ORDER BY rowid').all();
  assert.equal(admissions.length, 4);
  assert.deepEqual(admissions.map(row => JSON.parse(row.coverage_json).length), [1, 4, 3, 7]);
  assert.deepEqual(admissions.map(row => row.day_id), ['sabado-14', 'sabado-14', 'domingo-15', null]);
  assert.ok(admissions.every(row => row.device_id === scanner.device.id && row.device_name === 'Puerta Norte' && row.admitted_at));
  assert.ok(!JSON.stringify(admissions).includes('Titular de boletos'));
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_attendance_blocks').get().total, 7);
});

test('invalid block, event and legacy Day metadata never consume tickets or create attendance', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'attendance-invalid', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [
    { productId: 'full', quantity: 1 }, { productId: 'day', optionId: 'sabado-14', quantity: 1 },
  ]);
  const [full, day] = order.tickets;
  for (const [body, reason] of [
    [{ qrPayload: full.qrPayload }, 'block_required'],
    [{ qrPayload: full.qrPayload, blockId: 'bloque-99' }, 'invalid_block'],
    [{ qrPayload: full.qrPayload, blockId: 'bloque-1', eventId: 'another-event' }, 'wrong_event'],
  ]) {
    const { json } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie, body });
    assert.equal(json.reason, reason);
    assert.equal(json.attendance.uniqueAdmissions, 0);
  }
  f.db.sqlite.prepare("UPDATE registration_event_tickets SET event_id = 'other-event' WHERE id = ?").run(full.id);
  const { json: wrongEvent } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: full.qrPayload, blockId: 'bloque-1' } });
  assert.equal(wrongEvent.reason, 'wrong_event');
  f.db.sqlite.prepare("UPDATE registration_event_tickets SET event_id = ? WHERE id = ?").run(ticketEvent.eventId, full.id);
  const legacyLines = order.lineItems.map(line => ({ ...line, optionId: undefined }));
  f.db.sqlite.prepare('UPDATE registration_shop_orders SET line_items_json = ? WHERE id = ?').run(JSON.stringify(legacyLines), order.id);
  const { json: legacyDay } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: day.qrPayload, blockId: 'bloque-1' } });
  assert.equal(legacyDay.reason, 'ticket_day_unknown');
  assert.match(legacyDay.message, /día válido/);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_event_tickets WHERE status = \'active\'').get().total, 2);
  f.db.sqlite.prepare("UPDATE registration_event_tickets SET status = 'used' WHERE id = ?").run(day.id);
  const { json: legacyUsed } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: day.qrPayload, blockId: 'bloque-1' } });
  assert.equal(legacyUsed.reason, 'already_used');
  assert.equal(legacyUsed.attendance.uniqueAdmissions, 0);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_ticket_admissions').get().total, 0);
});

test('atomic admission rolls back all counters and ticket usage on failure, then a retry succeeds', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'attendance-rollback', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'full', quantity: 1 }]);
  const ticket = order.tickets[0];
  f.db.failBatchAt = 4; // Fail after snapshot and totals, immediately before marking used.
  await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie, status: 500,
    body: { qrPayload: ticket.qrPayload, blockId: 'bloque-1' } });
  assert.equal(f.db.sqlite.prepare('SELECT status FROM registration_event_tickets WHERE id = ?').get(ticket.id).status, 'active');
  for (const table of ['registration_ticket_access_scans', 'registration_ticket_admissions', 'registration_attendance_blocks', 'registration_attendance_events']) {
    assert.equal(f.db.sqlite.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total, 0);
  }
  const { json } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: ticket.qrPayload, blockId: 'bloque-1' } });
  assert.equal(json.admitted, true);
  assert.equal(json.attendance.uniqueAdmissions, 1);
  assert.ok(json.attendance.blocks.every(block => block.total === 1));
});

test('accepted admissions remain accepted if the subsequent summary or device telemetry fails', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'attendance-accessory-failure', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin);
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'full', quantity: 2 }]);
  for (const [index, failure] of [/WITH selected_event AS/, /SET last_scan_at/].entries()) {
    f.db.failQuery = failure;
    const { json } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
      body: { qrPayload: order.tickets[index].qrPayload, blockId: 'bloque-1' } });
    assert.equal(json.admitted, true);
    assert.equal(json.ticket.status, 'used');
    if (index === 0) {
      assert.equal(json.attendance, null);
      assert.equal(json.attendanceUnavailable, true);
    }
  }
  const { json } = await f.request('/scanner/attendance', { headers: scanner.headers });
  assert.equal(json.attendance.uniqueAdmissions, 2);
});

test('successful admission returns its committed timestamp without reading the ticket again', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'attendance-no-reread', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'full', quantity: 1 }]);
  f.db.beforeBatch = () => {
    f.db.beforeBatch = null;
    f.db.failQuery = /FROM registration_event_tickets/;
  };
  const { json } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: order.tickets[0].qrPayload, blockId: 'bloque-1' } });
  assert.equal(json.admitted, true);
  assert.ok(f.db.failQuery, 'no ticket query should run after the atomic admission succeeds');
  const stored = f.db.sqlite.prepare('SELECT used_at, used_by, updated_at FROM registration_event_tickets WHERE id = ?').get(order.tickets[0].id);
  assert.equal(json.ticket.usedAt, stored.used_at);
  assert.equal(json.ticket.updatedAt, stored.updated_at);
  assert.equal(json.ticket.usedBy, stored.used_by);
  assert.equal(f.db.sqlite.prepare('SELECT admitted_at FROM registration_ticket_admissions').get().admitted_at, stored.used_at);
});

test('ticket event remains authoritative when a participant buys from another venue or changes dances', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'attendance-event-owner', { role: 'admin' });
  const academy = await seedAcademy(f, 'attendance-other-venue');
  const { dance, participant, choreographer } = await createDance(f, academy);
  // Venue follows the latest dance; make the first one unambiguously older
  // even when both HTTP requests finish within SQLite's one-second precision.
  f.db.sqlite.prepare("UPDATE registration_dances SET venue = 'cdmx', created_at = datetime('now', '-1 day') WHERE id = ?").run(dance.id);
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'full', quantity: 1 }]);
  assert.equal(order.venue, 'cdmx');
  await f.request('/dances', { method: 'POST', cookie: academy.cookie, status: 201, body: {
    title: 'Nueva sede', genre: 'motion', subgenre: 'ballet', category: 'solo', venue: 'puebla',
    choreographerIds: [choreographer.id], participantIds: [participant.id],
  } });
  assert.equal(f.db.sqlite.prepare('SELECT venue FROM registration_shop_orders WHERE id = ?').get(order.id).venue, 'puebla');
  const { json } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: order.tickets[0].qrPayload, blockId: 'bloque-1' } });
  assert.equal(json.admitted, true);
  assert.equal(json.attendance.eventId, 'edomex-2026-otono');
});

test('an order edit between entitlement read and atomic admission requires a new scan', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'attendance-race-edit', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'block', optionId: 'bloque-1', quantity: 1 }]);
  f.db.beforeBatch = () => {
    f.db.beforeBatch = null;
    const edited = order.lineItems.map(line => ({ ...line, optionId: 'bloque-2' }));
    f.db.sqlite.prepare('UPDATE registration_shop_orders SET line_items_json = ? WHERE id = ?').run(JSON.stringify(edited), order.id);
  };
  const { json } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: order.tickets[0].qrPayload, blockId: 'bloque-1' } });
  assert.equal(json.reason, 'ticket_changed');
  assert.equal(json.attendance.uniqueAdmissions, 0);
  assert.equal(f.db.sqlite.prepare('SELECT status FROM registration_event_tickets WHERE id = ?').get(order.tickets[0].id).status, 'active');
});

test('attendance history survives corrected order lines, order deletion and reopening the database', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'levitate-attendance-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const databasePath = join(directory, 'history.sqlite');
  const f = await fixture(t, { databasePath });
  const admin = await seedAcademy(f, 'attendance-history', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin, 'Puerta histórica');
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'day', optionId: 'domingo-15', quantity: 1 }]);
  const ticket = order.tickets[0];
  const { json: first } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
    body: { qrPayload: ticket.qrPayload, blockId: 'bloque-6' } });
  const ledgerBefore = f.db.sqlite.prepare('SELECT * FROM registration_ticket_admissions').all();
  f.db.sqlite.prepare('UPDATE registration_shop_orders SET line_items_json = ? WHERE id = ?')
    .run(JSON.stringify([{ productId: 'full', itemType: 'ticket', quantity: 1 }]), order.id);
  const { json: duplicate } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
    body: { qrPayload: ticket.qrPayload, blockId: 'bloque-1' } });
  assert.equal(duplicate.reason, 'already_used');
  assert.match(duplicate.message, /Day pass/);
  assert.deepEqual(duplicate.attendance.blocks, first.attendance.blocks);
  await f.request('/admin/delete', { method: 'DELETE', cookie: admin.cookie,
    body: { entityType: 'order', orderType: 'shop', id: order.id } });
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_event_tickets WHERE id = ?').get(ticket.id).total, 0);
  f.db.sqlite.close();
  f.db.sqlite = new DatabaseSync(databasePath);
  f.db.sqlite.exec('PRAGMA foreign_keys = ON');
  const { json: { attendance } } = await f.request('/admin/attendance', { cookie: admin.cookie });
  assert.equal(attendance.uniqueAdmissions, 1);
  assert.deepEqual(attendance.blocks, first.attendance.blocks);
  assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM registration_ticket_admissions').all(), ledgerBefore);
  const oldMetadata = { eventId: 'historic-event', eventName: 'Evento histórico', venue: 'puebla',
    blocks: [{ id: 'old-block', label: 'Bloque histórico', dayId: 'old-day', date: '2025-01-01' }] };
  f.db.sqlite.prepare('INSERT INTO registration_attendance_events(id,name,venue,metadata_json,unique_admissions) VALUES (?,?,?,?,1)')
    .run(oldMetadata.eventId, oldMetadata.eventName, oldMetadata.venue, JSON.stringify(oldMetadata));
  f.db.sqlite.exec("INSERT INTO registration_attendance_blocks(event_id,block_id,total,full_count) VALUES ('historic-event','old-block',1,1)");
  const { json: historical } = await f.request('/admin/attendance?eventId=historic-event', { cookie: admin.cookie });
  assert.equal(historical.attendance.eventName, 'Evento histórico');
  assert.deepEqual(historical.attendance.blocks, [{ ...oldMetadata.blocks[0], total: 1, single: 0, day: 0, full: 1 }]);
  assert.equal(historical.attendance.events.length, 2);
});

test('ticket cart requires a canonical block and replaces client supplied block labels', async t => {
  const f = await fixture(t);
  const buyer = { curp: curpA, buyerName: 'Titular', buyerEmail: 'bloques@example.test', ...phone };
  for (const productId of ['block', 'ticket-block']) {
    for (const [optionId, code] of [[undefined, 'shop_ticket_block_required'], ['bloque-99', 'shop_ticket_block_invalid']]) {
      const { json } = await f.request('/shop/order', { method: 'POST', status: 400,
        body: { ...buyer, items: [{ productId, quantity: 1, optionId, optionLabel: 'Full pass' }] } });
      assert.equal(json.error.code, code);
    }
  }
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_shop_orders').get().total, 0);
  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201,
    body: { ...buyer, items: [
      { productId: 'block', quantity: 1, optionId: 'bloque-1', optionLabel: 'Full pass' },
      { productId: 'ticket-block', quantity: 1, optionId: 'bloque-7', optionLabel: 'Bloque 1' },
    ] } });
  assert.deepEqual(order.lineItems.map(item => item.optionLabel), ['Bloque 1', 'Bloque 7']);
  assert.match(order.lineItems[0].title, /Bloque 1/);
  assert.doesNotMatch(order.lineItems[0].title, /Full pass/);
  assert.match(order.lineItems[1].title, /Bloque 7/);
  assert.equal(order.amount, 500);
});

test('ticket scanner and admin reject missing or wrong blocks without consuming the QR', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-block-admin', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin);
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'block', optionId: 'bloque-3', quantity: 2 }]);
  for (const [index, endpoint, auth] of [
    [0, '/scanner/ticket/scan', { headers: scanner.headers }],
    [1, '/admin/ticket/scan', { cookie: admin.cookie }],
  ]) {
    const ticket = order.tickets[index];
    for (const [blockId, reason] of [[undefined, 'block_required'], ['bloque-99', 'invalid_block'], ['bloque-1', 'wrong_block']]) {
      const { json } = await f.request(endpoint, { method: 'POST', ...auth, body: { qrPayload: ticket.qrPayload, blockId } });
      assert.equal(json.admitted, false);
      assert.equal(json.reason, reason);
      const stored = f.db.sqlite.prepare('SELECT status, used_at FROM registration_event_tickets WHERE id = ?').get(ticket.id);
      assert.equal(stored.status, 'active');
      assert.equal(stored.used_at, null);
    }
    const { json: accepted } = await f.request(endpoint, { method: 'POST', ...auth,
      body: { qrPayload: ticket.qrPayload, blockId: 'bloque-3' } });
    assert.equal(accepted.admitted, true);
    assert.equal(accepted.reason, 'accepted');
    assert.equal(accepted.ticket.status, 'used');
    f.db.sqlite.prepare("UPDATE registration_event_tickets SET ticket_label = 'Full pass · Bloque 7' WHERE id = ?").run(ticket.id);
    const { json: reused } = await f.request(endpoint, { method: 'POST', ...auth,
      body: { qrPayload: ticket.qrPayload, blockId: 'bloque-1' } });
    assert.equal(reused.admitted, false);
    assert.equal(reused.reason, 'already_used');
    assert.match(reused.message, /Boleto por bloque/);
    assert.match(reused.message, /Bloque 3/);
    assert.doesNotMatch(reused.message, /Full pass|Bloque 1|Bloque 7/, 'used-ticket guidance must identify the purchased block, not the current gate or an old forged label');
  }
});

test('ticket scanner exchanges Day and Full passes once at a valid purchased-day block', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-wristband-admin', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin);
  const order = await createPaidTicketOrder(f, admin,
    ['day', 'ticket-day-pass', 'full', 'ticket-full-pass'].map(productId => ({ productId, quantity: 1, optionId: productId.includes('day') ? 'sabado-14' : undefined })));
  assert.equal(order.tickets.length, 4);
  for (const [index, ticket] of order.tickets.entries()) {
    const { json: accepted } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
      body: { qrPayload: ticket.qrPayload, blockId: 'bloque-1' } });
    assert.equal(accepted.admitted, true);
    assert.match(accepted.message, /brazalete/i);
    const { json: duplicate } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
      body: { qrPayload: ticket.qrPayload, blockId: 'bloque-7' } });
    assert.equal(duplicate.admitted, false);
    assert.equal(duplicate.reason, 'already_used', 'changing blocks must never re-enable a redeemed Day/Full QR');
    assert.match(duplicate.message, index < 2 ? /Day pass/ : /Full pass/);
    assert.doesNotMatch(duplicate.message, index < 2 ? /Full pass/ : /Day pass/);
    assert.match(duplicate.message, /brazalete/i);
  }
});

test('ticket scanner maps existing QR numbers to original cart quantities instead of trusting printed labels', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-legacy-admin', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [
    { productId: 'block', optionId: 'bloque-1', quantity: 2 },
    { productId: 'ticket-day-pass', quantity: 1, optionId: 'sabado-14' },
    { productId: 'ticket-block', optionId: 'bloque-5', quantity: 2 },
  ]);
  // Simulate already issued mixed orders. Non-ticket products do not take a
  // ticket number, and old display labels may be incomplete or client supplied.
  const oldLines = [...order.lineItems];
  oldLines.splice(1, 0, { productId: 'photo-solos', itemType: 'media', quantity: 3, title: 'Fotografías' });
  f.db.sqlite.prepare('UPDATE registration_shop_orders SET line_items_json = ? WHERE id = ?').run(JSON.stringify(oldLines), order.id);
  f.db.sqlite.prepare("UPDATE registration_event_tickets SET ticket_label = 'Full pass · Bloque 7' WHERE source_order_id = ?").run(order.id);
  assert.equal(order.tickets.length, 5);
  const expectedBlocks = ['bloque-1', 'bloque-1', null, 'bloque-5', 'bloque-5'];
  for (const [index, ticket] of order.tickets.entries()) {
    if (expectedBlocks[index]) {
      const { json: wrong } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
        body: { qrPayload: ticket.qrPayload, blockId: 'bloque-7' } });
      assert.equal(wrong.reason, 'wrong_block');
      assert.equal(wrong.admitted, false);
    }
    const { json: accepted } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
      body: { qrPayload: ticket.qrPayload, blockId: expectedBlocks[index] || 'bloque-1' } });
    assert.equal(accepted.admitted, true);
    assert.equal(accepted.ticket.ticketCode, ticket.ticketCode);
    assert.equal(accepted.ticket.qrPayload, ticket.qrPayload, 'previously distributed QR payloads remain usable without reissuance');
  }
});

test('ticket scanner fails closed for legacy block tickets with missing or unrecognized entitlement metadata', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-unknown-admin', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin);
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'block', optionId: 'bloque-2', quantity: 1 }]);
  const ticket = order.tickets[0];
  const originalLine = order.lineItems[0];
  for (const [line, reason] of [
    [{ ...originalLine, optionId: undefined, optionLabel: 'Bloque 2' }, 'ticket_block_unknown'],
    [{ ...originalLine, optionId: 'bloque-99', optionLabel: 'Bloque 2' }, 'ticket_block_unknown'],
    [{ ...originalLine, id: undefined, productId: undefined, title: 'Single pass · Bloque 2' }, 'ticket_details_missing'],
    [{ ...originalLine, productId: 'unknown-ticket', title: 'Full pass' }, 'ticket_details_missing'],
  ]) {
    f.db.sqlite.prepare('UPDATE registration_shop_orders SET line_items_json = ? WHERE id = ?').run(JSON.stringify([line]), order.id);
    const { json } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
      body: { qrPayload: ticket.qrPayload, blockId: 'bloque-2' } });
    assert.equal(json.admitted, false);
    assert.equal(json.reason, reason);
    assert.equal(f.db.sqlite.prepare('SELECT status FROM registration_event_tickets WHERE id = ?').get(ticket.id).status, 'active');
  }
});

test('ticket scanner denies previously issued QR codes after approval is reversed', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-reversal-admin', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin);
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'full', quantity: 1 }]);
  const { json: reversal } = await f.request('/admin/inscription-order/status', { method: 'POST', cookie: admin.cookie,
    body: { id: order.id, orderType: 'shop', status: 'rejected', rejectionReason: 'payment_not_found',
      rejectionMessage: 'La transferencia no se acreditó.' } });
  assert.equal(reversal.order.status, 'rejected');
  assert.equal(reversal.order.paidAt, null);
  assert.equal(reversal.order.rejectionReason, 'payment_not_found');
  assert.equal(reversal.order.participantTickets[0].sourceOrderStatus, 'rejected');
  const { json } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
    body: { qrPayload: order.tickets[0].qrPayload, blockId: 'bloque-1' } });
  assert.equal(json.admitted, false);
  assert.equal(json.reason, 'payment_not_approved');
  assert.equal(f.db.sqlite.prepare('SELECT status FROM registration_event_tickets WHERE id = ?').get(order.tickets[0].id).status, 'active');
});

test('ticket scanner allows exactly one admission when two devices scan the same valid QR concurrently', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-concurrency-admin', { role: 'admin' });
  const firstScanner = await activateTicketScanner(f, admin, 'Puerta uno');
  const secondScanner = await activateTicketScanner(f, admin, 'Puerta dos');
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'block', optionId: 'bloque-4', quantity: 1 }]);
  const results = await Promise.all([firstScanner, secondScanner].map(scanner => f.request('/scanner/ticket/scan', {
    method: 'POST', headers: scanner.headers, body: { qrPayload: order.tickets[0].qrPayload, blockId: 'bloque-4a' },
  })));
  assert.equal(results.filter(result => result.json.admitted).length, 1);
  assert.deepEqual(results.map(result => result.json.reason).sort(), ['accepted', 'already_used']);
  const duplicate = results.find(result => result.json.reason === 'already_used').json;
  assert.match(duplicate.message, /ya fue validado en Bloque 4A/);
  assert.equal(f.db.sqlite.prepare('SELECT status FROM registration_event_tickets WHERE id = ?').get(order.tickets[0].id).status, 'used');
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_ticket_admissions').get().total, 1);
  const { json: { attendance } } = await f.request('/scanner/attendance', { headers: secondScanner.headers });
  assert.equal(attendance.uniqueAdmissions, 1);
  assert.deepEqual(attendance.blocks.map(block => block.total), [0, 0, 1, 0, 0, 0, 0]);
});

test('merged entry accepts original blocks 2 and 3 and normalizes cached scanner selections', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-merged', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin);
  const order = await createPaidTicketOrder(f, admin, [
    { productId: 'block', optionId: 'bloque-2', quantity: 2 },
    { productId: 'block', optionId: 'bloque-3', quantity: 2 },
    { productId: 'day', optionId: 'sabado-14', quantity: 1 },
    { productId: 'full', quantity: 1 },
  ]);
  const originalTickets = f.db.sqlite.prepare('SELECT id, ticket_code, qr_payload FROM registration_event_tickets ORDER BY id').all();
  for (const [index, ticket] of order.tickets.entries()) {
    const { json } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
      body: { qrPayload: ticket.qrPayload, blockId: ['bloque-2-3', 'bloque-3', 'bloque-2', 'bloque-2-3', 'bloque-2', 'bloque-3'][index] } });
    assert.equal(json.admitted, true);
    assert.equal(json.firstRedemption, true);
    const { json: duplicate } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
      body: { qrPayload: ticket.qrPayload, blockId: 'bloque-2-3' } });
    assert.equal(duplicate.reason, 'already_used');
  }
  assert.ok(f.db.sqlite.prepare('SELECT access_session_id FROM registration_ticket_access_scans').all()
    .every(row => row.access_session_id === 'bloque-2-3'));
  const { json: { sales } } = await f.request('/admin/ticket-sales-summary', { cookie: admin.cookie });
  const { json: { attendance } } = await f.request('/admin/attendance', { cookie: admin.cookie });
  assert.equal(sales.uniqueTickets, 6);
  assert.equal(attendance.uniqueAdmissions, 6);
  for (const report of [sales, attendance]) {
    assert.deepEqual(report.blocks.map(block => block.id), scannerAccessIds);
    assert.deepEqual(report.blocks.map(block => block.total), [2, 6, 2, 2, 1, 1, 1]);
    assert.deepEqual(report.blocks[1], { ...report.blocks[1], single: 4, day: 1, full: 1 });
  }
  assert.deepEqual(f.db.sqlite.prepare('SELECT id, ticket_code, qr_payload FROM registration_event_tickets ORDER BY id').all(), originalTickets);
  assert.equal(f.db.sqlite.prepare('SELECT line_items_json FROM registration_shop_orders WHERE id = ?').get(order.id).line_items_json, JSON.stringify(order.lineItems));
});

test('block 4 QR validates once per part in either order and preserves the first admission', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-split', { role: 'admin' });
  const scanner = await activateTicketScanner(f, admin, 'Puerta primera');
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'block', optionId: 'bloque-4', quantity: 2 }]);
  const { json: ambiguous } = await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
    body: { qrPayload: order.tickets[0].qrPayload, blockId: 'bloque-4' } });
  assert.equal(ambiguous.admitted, false);
  assert.match(ambiguous.message, /4A.*4B|4a.*4b/);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_ticket_access_scans').get().n, 0);
  for (const [index, ticket] of order.tickets.entries()) {
    const parts = index ? ['bloque-4b', 'bloque-4a'] : ['bloque-4a', 'bloque-4b'];
    const scan = async blockId => (await f.request('/scanner/ticket/scan', { method: 'POST', headers: scanner.headers,
      body: { qrPayload: ticket.qrPayload, blockId } })).json;
    const first = await scan(parts[0]);
    assert.equal(first.admitted, true);
    assert.equal(first.firstRedemption, true);
    const initialTicket = f.db.sqlite.prepare('SELECT * FROM registration_event_tickets WHERE id = ?').get(ticket.id);
    const canonical = f.db.sqlite.prepare('SELECT * FROM registration_ticket_admissions WHERE ticket_id = ?').get(ticket.id);
    const counters = f.db.sqlite.prepare('SELECT * FROM registration_attendance_blocks ORDER BY block_id').all();
    assert.equal((await scan(parts[0])).reason, 'already_used');
    const second = await scan(parts[1]);
    assert.equal(second.admitted, true);
    assert.equal(second.firstRedemption, false);
    assert.equal(second.ticket.usedAt, first.ticket.usedAt);
    assert.equal(second.ticket.usedBy, first.ticket.usedBy);
    assert.equal((await scan(parts[1])).reason, 'already_used');
    assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM registration_event_tickets WHERE id = ?').get(ticket.id), initialTicket);
    assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM registration_ticket_admissions WHERE ticket_id = ?').get(ticket.id), canonical);
    assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM registration_attendance_blocks ORDER BY block_id').all(), counters);
  }
  const { json: { attendance } } = await f.request('/admin/attendance', { cookie: admin.cookie });
  assert.equal(attendance.uniqueAdmissions, 2);
  assert.deepEqual(attendance.blocks.map(block => block.total), [0, 0, 2, 2, 0, 0, 0]);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_ticket_access_scans').get().n, 4);
});

test('Day and Full keep one wristband while allowing each split part once', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-split-wristband', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [
    { productId: 'day', optionId: 'sabado-14', quantity: 2 }, { productId: 'full', quantity: 2 },
    { productId: 'day', optionId: 'domingo-15', quantity: 1 },
  ]);
  for (const [index, ticket] of order.tickets.slice(0, 4).entries()) {
    const sequence = index % 2 ? ['bloque-4b', 'bloque-4a'] : ['bloque-1', 'bloque-4a', 'bloque-4b'];
    for (const [part, blockId] of sequence.entries()) {
      const { json } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
        body: { qrPayload: ticket.qrPayload, blockId } });
      assert.equal(json.admitted, true);
      assert.equal(json.firstRedemption, part === 0);
      assert.match(json.message, /brazalete/i);
      if (part) assert.match(json.message, /no.*(?:otro|nuevo|segundo)|sin.*(?:otro|nuevo|segundo)/i);
    }
    for (const blockId of ['bloque-4a', 'bloque-4b', 'bloque-2-3']) {
      const { json } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
        body: { qrPayload: ticket.qrPayload, blockId } });
      assert.equal(json.reason, 'already_used');
    }
  }
  const { json: wrongDay } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: order.tickets[4].qrPayload, blockId: 'bloque-4a' } });
  assert.equal(wrongDay.reason, 'wrong_day');
  const { json: { attendance } } = await f.request('/admin/attendance', { cookie: admin.cookie });
  assert.equal(attendance.uniqueAdmissions, 4);
  assert.deepEqual(attendance.blocks.map(block => block.total), [4, 4, 4, 4, 2, 2, 2]);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_ticket_admissions').get().n, 4);
});

test('simultaneous split parts admit twice with one first redemption and retain original ticket timestamps', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-distinct-concurrency', { role: 'admin' });
  const scanners = await Promise.all(['Primera', 'Segunda'].map(name => activateTicketScanner(f, admin, name)));
  const order = await createPaidTicketOrder(f, admin, [
    { productId: 'block', optionId: 'bloque-4', quantity: 1 },
    { productId: 'day', optionId: 'sabado-14', quantity: 1 }, { productId: 'full', quantity: 1 },
  ]);
  for (const ticket of order.tickets) {
    const results = await Promise.all(scanners.map((scanner, index) => f.request('/scanner/ticket/scan', {
      method: 'POST', headers: scanner.headers, body: { qrPayload: ticket.qrPayload, blockId: index ? 'bloque-4b' : 'bloque-4a' },
    })));
    assert.ok(results.every(result => result.json.admitted));
    assert.equal(results.filter(result => result.json.firstRedemption).length, 1);
    assert.equal(new Set(results.map(result => result.json.ticket.usedAt)).size, 1);
    assert.equal(new Set(results.map(result => result.json.ticket.usedBy)).size, 1);
    assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_ticket_access_scans WHERE ticket_id = ?').get(ticket.id).n, 2);
    assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_ticket_admissions WHERE ticket_id = ?').get(ticket.id).n, 1);
  }
  const { json: { attendance } } = await f.request('/admin/attendance', { cookie: admin.cookie });
  assert.equal(attendance.uniqueAdmissions, 3);
  assert.ok(attendance.blocks.every(block => block.total <= 3));
  assert.deepEqual(attendance.blocks.map(block => block.total), [2, 2, 3, 3, 1, 1, 1]);
});

test('each admission write rolls back together and split retries preserve committed history', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-split-rollback', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'block', optionId: 'bloque-4', quantity: 6 }]);
  const history = () => Object.fromEntries(['registration_ticket_access_scans', 'registration_ticket_admissions',
    'registration_attendance_events', 'registration_attendance_blocks'].map(table => [table,
    f.db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  const scan = async (ticket, blockId, status = 200) => (await f.request('/admin/ticket/scan', {
    method: 'POST', cookie: admin.cookie, status, body: { qrPayload: ticket.qrPayload, blockId },
  })).json;
  for (const [writeIndex, ticket] of order.tickets.entries()) {
    const originalHistory = history();
    f.db.failBatchAt = writeIndex;
    await scan(ticket, 'bloque-4a', 500);
    assert.deepEqual(history(), originalHistory);
    assert.equal(f.db.sqlite.prepare('SELECT status FROM registration_event_tickets WHERE id = ?').get(ticket.id).status, 'active');
    assert.equal((await scan(ticket, 'bloque-4a')).firstRedemption, true);
    const firstHistory = history();
    const firstTicket = f.db.sqlite.prepare('SELECT * FROM registration_event_tickets WHERE id = ?').get(ticket.id);
    f.db.failBatchAt = writeIndex;
    await scan(ticket, 'bloque-4b', 500);
    assert.deepEqual(history(), firstHistory);
    assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM registration_event_tickets WHERE id = ?').get(ticket.id), firstTicket);
    const retry = await scan(ticket, 'bloque-4b');
    assert.equal(retry.admitted, true);
    assert.equal(retry.firstRedemption, false);
    assert.deepEqual(f.db.sqlite.prepare('SELECT * FROM registration_event_tickets WHERE id = ?').get(ticket.id), firstTicket);
  }
});

test('a normal entry racing a split entry issues only one wristband', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-mixed-race', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [
    { productId: 'day', optionId: 'sabado-14', quantity: 2 }, { productId: 'full', quantity: 2 },
  ]);
  for (const [index, ticket] of order.tickets.entries()) {
    const parts = index % 2 ? ['bloque-4a', 'bloque-2-3'] : ['bloque-2-3', 'bloque-4a'];
    const results = await Promise.all(parts.map(blockId => f.request('/admin/ticket/scan', {
      method: 'POST', cookie: admin.cookie, body: { qrPayload: ticket.qrPayload, blockId },
    })));
    assert.equal(results.filter(result => result.json.firstRedemption).length, 1);
    assert.equal(results[parts.indexOf('bloque-4a')].json.admitted, true);
    assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_ticket_admissions WHERE ticket_id = ?').get(ticket.id).n, 1);
  }
});

test('an atomic ticket position change cannot use the entitlement read before the change', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-position-race', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [
    { productId: 'block', optionId: 'bloque-4', quantity: 1 },
    { productId: 'block', optionId: 'bloque-5', quantity: 1 },
  ]);
  f.db.sqlite.prepare('DELETE FROM registration_event_tickets WHERE id = ?').run(order.tickets[1].id);
  f.db.beforeBatch = () => {
    f.db.beforeBatch = null;
    f.db.sqlite.prepare('UPDATE registration_event_tickets SET ticket_number = 2 WHERE id = ?').run(order.tickets[0].id);
  };
  const { json } = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: order.tickets[0].qrPayload, blockId: 'bloque-4a' } });
  assert.equal(json.admitted, false);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_ticket_access_scans').get().n, 0);
  assert.equal(f.db.sqlite.prepare('SELECT status FROM registration_event_tickets WHERE id = ?').get(order.tickets[0].id).status, 'active');
});

test('split retries cannot reopen legacy consumed tickets or bypass a cancellation, payment reversal or order correction', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-split-guards', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'block', optionId: 'bloque-4', quantity: 4 }]);
  const scan = async (ticket, blockId) => (await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: ticket.qrPayload, blockId } })).json;
  for (const ticket of order.tickets) assert.equal((await scan(ticket, 'bloque-4a')).admitted, true);
  const [legacy, cancelled, untrusted, changed] = order.tickets;
  f.db.sqlite.prepare("UPDATE registration_ticket_admissions SET scanned_block_id = 'bloque-4' WHERE ticket_id = ?").run(legacy.id);
  f.db.sqlite.prepare('DELETE FROM registration_ticket_access_scans WHERE ticket_id = ?').run(legacy.id);
  f.db.sqlite.prepare("UPDATE registration_event_tickets SET status = 'cancelled' WHERE id = ?").run(cancelled.id);
  f.db.sqlite.prepare('DELETE FROM registration_ticket_access_scans WHERE ticket_id = ?').run(untrusted.id);
  f.db.sqlite.prepare('DELETE FROM registration_ticket_admissions WHERE ticket_id = ?').run(untrusted.id);
  for (const ticket of [legacy, cancelled, untrusted]) {
    for (const blockId of ['bloque-4a', 'bloque-4b']) assert.equal((await scan(ticket, blockId)).admitted, false);
  }
  f.db.sqlite.prepare("UPDATE registration_shop_orders SET status = 'rejected' WHERE id = ?").run(order.id);
  assert.equal((await scan(changed, 'bloque-4b')).admitted, false);
  f.db.sqlite.prepare("UPDATE registration_shop_orders SET status = 'paid' WHERE id = ?").run(order.id);
  f.db.beforeBatch = () => {
    f.db.beforeBatch = null;
    f.db.sqlite.prepare("UPDATE registration_shop_orders SET line_items_json = '[]' WHERE id = ?").run(order.id);
  };
  assert.equal((await scan(changed, 'bloque-4b')).admitted, false);
  assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) AS n FROM registration_ticket_access_scans WHERE access_session_id = 'bloque-4b'").get().n, 0);
});

test('ticket scanner still rejects used QR codes when original ticket details or source order are missing', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'scanner-used-legacy-admin', { role: 'admin' });
  const order = await createPaidTicketOrder(f, admin, [{ productId: 'full', quantity: 1 }]);
  const ticket = order.tickets[0];
  const scan = () => f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie,
    body: { qrPayload: ticket.qrPayload, blockId: 'bloque-1' } });
  assert.equal((await scan()).json.admitted, true);
  f.db.sqlite.prepare("UPDATE registration_shop_orders SET line_items_json = '[]' WHERE id = ?").run(order.id);
  for (const sourceMissing of [false, true]) {
    if (sourceMissing) {
      f.db.sqlite.prepare("UPDATE registration_event_tickets SET source_order_id = 'missing-legacy-order' WHERE id = ?").run(ticket.id);
    }
    const { json } = await scan();
    assert.equal(json.admitted, false);
    assert.equal(json.reason, 'already_used');
    assert.match(json.message, /Full pass ya utilizado/);
    assert.doesNotMatch(json.message, /Day pass|Boleto por bloque/, 'the original admission snapshot remains authoritative after order changes');
    assert.equal(json.ticket.status, 'used');
  }
});

test('ticket shop orders can be created before participant registration and link by CURP later', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'future-ticket');
  const admin = await seedAcademy(f, 'future-ticket-admin', { role: 'admin' });

  const { json: { order } } = await f.request('/shop/order', { method: 'POST', status: 201,
    body: { curp: curpB, buyerName: 'Compradora anticipada', buyerEmail: 'anticipada@example.test', ...phone,
      items: [{ productId: 'ticket-day-pass', quantity: 2, optionId: 'domingo-15' }] } });

  assert.equal(order.amount, 900);
  assert.equal(order.academyId, null);
  assert.equal(order.academyName, 'Registro pendiente');
  assert.equal(order.participantName, 'Compradora anticipada');

  await f.request('/shop/order', { method: 'POST', status: 404,
    body: { curp: 'CCCC100101MDFBBB01', buyerName: 'Compra foto', buyerEmail: 'foto@example.test', ...phone,
      items: [{ productId: 'photo-solos', quantity: 1, danceId: 'missing-dance' }] } });

  const { json: { participant } } = await f.request('/participants', { method: 'POST', cookie: academy.cookie, status: 201,
    body: { fullName: 'Participante boleto futuro', curp: curpB, birthDate: '2010-01-01', age: 16, division: 'teen', shirtSize: 'm' } });

  let storedOrder = f.db.sqlite.prepare(
    'SELECT participant_name, academy_id, academy_name, venue FROM registration_shop_orders WHERE id = ?',
  ).get(order.id);
  assert.equal(storedOrder.participant_name, 'Participante boleto futuro');
  assert.equal(storedOrder.academy_id, academy.academyId);
  assert.equal(storedOrder.academy_name, 'Independiente');

  const { json: { choreographer } } = await f.request('/choreographers', { method: 'POST', cookie: academy.cookie, status: 201,
    body: { fullName: 'Coreógrafa boleto futuro', email: 'coreografa-boleto@example.test', phone: '5555555555', shirtSize: 's' } });
  await f.request('/dances', { method: 'POST', cookie: academy.cookie, status: 201,
    body: { title: 'Vuelo boleto futuro', genre: 'aereo', subgenre: 'open_otro', subgenreDetail: 'Aparato propio', level: 'principiante',
      category: 'solo', venue: 'edomex', choreographerIds: [choreographer.id], participantIds: [participant.id] } });

  storedOrder = f.db.sqlite.prepare(
    'SELECT participant_name, academy_id, academy_name, venue FROM registration_shop_orders WHERE id = ?',
  ).get(order.id);
  assert.equal(storedOrder.venue, 'edomex');

  const { json: allOrders } = await f.request('/admin/inscription-orders', { cookie: admin.cookie });
  const listedOrder = allOrders.orders.find(item => item.id === order.id);
  assert.equal(listedOrder.academyId, academy.academyId);
  assert.equal(listedOrder.venue, 'edomex');
});

test('legacy D1 and Drive music remain visible; upload, replacement and removal preserve ownership', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'music');
  const otherAcademy = await seedAcademy(f, 'other-music');
  const { dance } = await createDance(f, academy);
  const music = { danceId: dance.id, fileName: 'vuelo.mp3', contentType: 'audio/mpeg',
    dataUrl: 'data:audio/mpeg;base64,AQID', fileSize: 3, durationSeconds: 180 };
  const { json: uploaded } = await f.request('/music', { method: 'POST', cookie: academy.cookie, body: music });
  assert.equal(uploaded.musicUpload.storageProvider, 'd1');
  assert.equal(uploaded.musicUpload.dataUrl, music.dataUrl);
  assert.equal(uploaded.musicUpload.durationSeconds, 180);
  assert.equal(uploaded.dance.musicUpload.durationSeconds, 180);
  assert.equal(f.db.sqlite.prepare('SELECT duration_seconds FROM registration_music_uploads WHERE dance_id = ?').get(dance.id).duration_seconds, 180);
  await f.request('/music', { method: 'POST', cookie: otherAcademy.cookie, body: music, status: 404 });
  const { json: replaced } = await f.request('/music', { method: 'POST', cookie: academy.cookie,
    body: { ...music, fileName: 'nueva.mp3', durationSeconds: 181.25 } });
  assert.equal(replaced.musicUpload.durationSeconds, 181.25);
  assert.equal(replaced.dance.musicUpload.durationSeconds, 181.25);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_music_uploads').get().total, 1);
  f.db.sqlite.prepare(`UPDATE registration_music_uploads SET storage_provider = 'google_drive', data_url = '',
    drive_file_id = 'fixture-drive-id', drive_web_view_link = 'https://drive.google.com/file/d/fixture-drive-id/view',
    drive_web_content_link = 'https://drive.google.com/uc?id=fixture-drive-id' WHERE dance_id = ?`).run(dance.id);
  const { json: bootstrap } = await f.request('/bootstrap', { cookie: academy.cookie });
  assert.equal(bootstrap.dances[0].musicUpload.storageProvider, 'google_drive');
  assert.equal(bootstrap.dances[0].musicUpload.fileName, 'nueva.mp3');
  assert.equal(bootstrap.dances[0].musicUpload.durationSeconds, 181.25);
  assert.equal(bootstrap.dances[0].musicUpload.driveFileId, null, 'public payload still hides internal Drive identifiers');
  assert.equal(f.db.sqlite.prepare('SELECT drive_file_id FROM registration_music_uploads WHERE dance_id = ?').get(dance.id).drive_file_id, 'fixture-drive-id');
  await f.request('/music', { method: 'DELETE', cookie: otherAcademy.cookie, body: { danceId: dance.id }, status: 404 });
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_music_uploads').get().total, 1);
  const { json: deleted } = await f.request('/music', { method: 'DELETE', cookie: academy.cookie, body: { danceId: dance.id } });
  assert.equal(deleted.musicUpload, null);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_music_uploads').get().total, 0);
});

test('program returns known and legacy song durations as metadata only behind admin authentication', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'program-duration');
  const legacyAcademy = await seedAcademy(f, 'legacy-program-duration');
  const emptyAcademy = await seedAcademy(f, 'empty-program-duration');
  const admin = await seedAcademy(f, 'program-duration-admin', { role: 'admin' });
  const { dance: known } = await createDance(f, academy);
  const { dance: legacy } = await createDance(f, legacyAcademy, curpB);
  const { dance: empty } = await createDance(f, emptyAcademy, 'CCCC100101MDFBBB01');
  const programme = {eventId:'edomex-2026-otono',blockId:'4a',blockTitle:'BLOQUE 4 A',blockOrder:3,
    position:61,number:'194 a',division:'petite',divisionLabel:'PETITE: 7 A 10 AÑOS',
    scheduledDate:'2026-11-14',scheduledTime:'13:00:00',durationSeconds:180,marginSeconds:200};
  f.db.sqlite.prepare('UPDATE registration_dances SET program_json=? WHERE id=?').run(JSON.stringify(programme),known.id);
  const originalDivision = f.db.sqlite.prepare('SELECT division FROM registration_participants WHERE academy_id=?').get(academy.academyId).division;
  await f.request('/music', { method: 'POST', cookie: academy.cookie, body: {
    danceId: known.id, fileName: 'known.mp3', contentType: 'audio/mpeg',
    dataUrl: 'data:audio/mpeg;base64,AQID', fileSize: 3, durationSeconds: 183.75,
  } });
  f.db.sqlite.prepare(`INSERT INTO registration_music_uploads
    (id, academy_id, dance_id, file_name, content_type, file_size, data_url, storage_provider,
      drive_file_id, drive_web_view_link, drive_web_content_link)
    VALUES ('legacy-track', ?, ?, 'legacy.mp3', 'audio/mpeg', 3, '', 'google_drive',
      'private-file-id', 'https://drive.google.com/private-view', 'https://drive.google.com/private-download')`)
    .run(legacyAcademy.academyId, legacy.id);
  const { json: legacyBootstrap } = await f.request('/bootstrap', { cookie: legacyAcademy.cookie });
  assert.equal(legacyBootstrap.dances[0].musicUpload.durationSeconds, null);
  const { json: knownBootstrap } = await f.request('/bootstrap', { cookie: academy.cookie });
  assert.deepEqual(knownBootstrap.dances[0].program,programme);
  assert.equal(legacyBootstrap.dances[0].program,null);

  for (const [cookie, status] of [[undefined, 401], [academy.cookie, 403]]) {
    const queryStart = f.db.runtimeQueries.length;
    await f.request('/admin/program', { cookie, status });
    assert.ok(f.db.runtimeQueries.slice(queryStart).every(sql => !/FROM registration_music_uploads/i.test(sql)),
      'unauthorized requests never read music');
  }
  const queryStart = f.db.runtimeQueries.length;
  const { json: program } = await f.request('/admin/program', { cookie: admin.cookie });
  const programById = new Map(program.dances.map(dance => [dance.id, dance]));
  assert.equal(programById.get(known.id).musicUpload.durationSeconds, 183.75);
  assert.equal(programById.get(known.id).musicUpload.fileName, 'known.mp3');
  assert.deepEqual(programById.get(known.id).program,programme);
  assert.equal(f.db.sqlite.prepare('SELECT division FROM registration_participants WHERE academy_id=?').get(academy.academyId).division,originalDivision);
  assert.equal(programById.get(legacy.id).musicUpload.durationSeconds, null);
  assert.equal(programById.get(legacy.id).musicUpload.storageProvider, 'google_drive');
  assert.equal(programById.get(empty.id).musicUpload, null);
  const musicQueries = f.db.runtimeQueries.slice(queryStart).filter(sql => /FROM registration_music_uploads/i.test(sql));
  assert.equal(musicQueries.length, 1, 'program music metadata is loaded in one query');
  assert.doesNotMatch(musicQueries[0], /SELECT\s+(?:registration_music_uploads\.)?\*|data_url|drive_file_id|drive_web_/i);
  for (const dance of program.dances) {
    if (!dance.musicUpload) continue;
    for (const privateField of ['dataUrl', 'driveFileId', 'driveUrl']) {
      assert.equal(Object.hasOwn(dance.musicUpload, privateField), false, `${privateField} is excluded from program metadata`);
    }
  }
  assert.doesNotMatch(JSON.stringify(program), /data:audio|private-file-id|drive\.google\.com/);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_music_uploads').get().total, 2);
});

test('student profile creation and repeated access work without schema preparation, and protected routes stay protected', async t => {
  const f = await fixture(t, { includeStudentSchema: true });
  const academy = await seedAcademy(f, 'student');
  await createDance(f, academy);
  const student = await f.request('/student/register', { method: 'POST', body: { curp: curpA }, status: 201 });
  assert.equal(student.json.user.curp, curpA);
  assert.ok(student.cookie);
  const again = await f.request('/student/login', { method: 'POST', body: { curp: curpA } });
  assert.equal(again.json.user.id, student.json.user.id, 'business ensureStudentProfile keeps one profile');
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_student_users').get().total, 1);
  await f.request('/student/me', { cookie: student.cookie });
  await f.request('/inscription/lookup', { method: 'POST', cookie: student.cookie, body: { curp: curpA } });
  await f.request('/inscription/lookup', { method: 'POST', cookie: student.cookie, body: { curp: curpB }, status: 403 });
  await f.request('/student/login', { method: 'POST', body: { curp: curpB }, status: 404 });
  for (const path of ['/me', '/bootstrap', '/participants', '/choreographers', '/dances', '/inscription/orders',
    '/admin/participants', '/admin/program', '/admin/inscription-orders']) {
    await f.request(path, { status: 401 });
    await f.request(path, { cookie: 'levitate_registration_session=invalid', status: 401 });
  }
  await f.request('/inscription/lookup', { method: 'POST', body: { curp: curpA }, status: 401 });
  await f.request('/student/logout', { method: 'POST', cookie: student.cookie });
  await f.request('/student/me', { cookie: student.cookie, status: 401 });
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_participants').get().total, 1);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_dances').get().total, 1);
});

test('international registration keeps compatibility with a legacy academy venue column', async t => {
  const f = await fixture(t);
  f.db.sqlite.exec("ALTER TABLE registration_academies ADD COLUMN venue TEXT NOT NULL DEFAULT 'edomex'");
  f.db.allowAcademyVenueProbe = true;
  const { json } = await f.request('/auth/register', { method: 'POST', status: 201,
    body: { name: 'Registro internacional', username: 'internacional', email: 'international@example.test',
      password: 'ClaveDePrueba123!', academy: 'Independiente', phone: '1155555555',
      academyOriginType: 'international', academyCountry: 'Argentina' } });
  assert.equal(json.status, 'pending_email_verification');
  const academy = f.db.sqlite.prepare('SELECT origin_type, origin_country, origin_state, venue FROM registration_academies').get();
  assert.deepEqual({ ...academy }, { origin_type: 'international', origin_country: 'Argentina', origin_state: null, venue: 'edomex' });
});

// Optional before/after contract comparison against an existing local git ref.
// Example: REGISTRATION_BASELINE_REF=HEAD node --test tests/registration-runtime.test.mjs
test('prepared fixtures return identical JSON with the previous Worker', {
  skip: !process.env.REGISTRATION_BASELINE_REF,
}, async t => {
  const source = execFileSync('git', ['show', `${process.env.REGISTRATION_BASELINE_REF}:worker/index.js`], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
  });
  const { default: previousWorker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const f = await fixture(t);
  const previous = await fixture(t, { workerUnderTest: previousWorker });
  previous.db.allowLegacySchemaPreparation = true;
  const academy = await seedAcademy(f, 'equivalence');
  const admin = await seedAcademy(f, 'equivalence-admin', { role: 'admin' });
  const { dance } = await createDance(f, academy);
  await f.request('/inscription/order', { method: 'POST', status: 201, cookie: academy.cookie, body: { curp: curpA, ...phone } });
  const { json: { order: shop } } = await f.request('/shop/order', { method: 'POST', status: 201,
    body: { curp: curpA, buyerName: 'Comprador', buyerEmail: 'comparacion@example.test', ...phone,
      items: [{ productId: 'ticket-full-pass', quantity: 1 }] } });
  await f.request('/music', { method: 'POST', cookie: academy.cookie, body: { danceId: dance.id, fileName: 'vuelo.mp3',
    contentType: 'audio/mpeg', dataUrl: 'data:audio/mpeg;base64,AQID', fileSize: 3, durationSeconds: 180 } });
  // Copy only synthetic local rows so UUIDs, timestamps, and tokens are identical.
  previous.db.sqlite.exec('PRAGMA foreign_keys = OFF');
  for (const { name } of f.db.sqlite.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE 'registration_%'").all()) {
    const quotedName = `"${name.replaceAll('"', '""')}"`;
    for (const row of f.db.sqlite.prepare(`SELECT * FROM ${quotedName}`).all()) {
      const names = Object.keys(row);
      previous.db.sqlite.prepare(`INSERT INTO ${quotedName} (${names.map(name => `"${name}"`).join(', ')})
        VALUES (${names.map(() => '?').join(', ')})`).run(...Object.values(row));
    }
  }
  previous.db.sqlite.exec('PRAGMA foreign_keys = ON');
  const requests = [
    ...['/me', '/bootstrap', '/participants', '/choreographers', '/dances', '/inscription/orders']
      .map(path => [path, { cookie: academy.cookie }]),
    ...['/admin/participants', '/admin/program', '/admin/inscription-orders']
      .map(path => [path, { cookie: admin.cookie }]),
    ['/inscription/lookup', { method: 'POST', cookie: academy.cookie, body: { curp: curpA } }],
    ['/shop/order/lookup', { method: 'POST', body: { orderId: shop.id, accessToken: shop.accessToken } }],
  ];
  const queryCounts = [];
  for (const [path, options] of requests) {
    const actualStart = f.db.runtimeQueries.length;
    const previousStart = previous.db.runtimeQueries.length;
    const actual = await f.request(path, options);
    const expected = await previous.request(path, options);
    assert.deepEqual(actual.json, expected.json, `Response changed for ${path}`);
    if (path === '/bootstrap' || path === '/shop/order/lookup') {
      queryCounts.push(`${path}: ${previous.db.runtimeQueries.length - previousStart} -> ${f.db.runtimeQueries.length - actualStart} SQL calls`);
    }
  }
  t.diagnostic(queryCounts.join('; '));
});


function pendingPdfRequest(cookie, { fileName = 'levitate-pendientes-Academia.pdf',
  pdf = Buffer.from('%PDF-1.4\nBinary bytes: \x00\xff\x80\n%%EOF\n', 'latin1').toString('base64'),
  origin = 'http://localhost', headers = {}, body, method = 'POST' } = {}) {
  return new Request('http://localhost/api/registration/admin/pending-report.pdf', {
    method,
    headers: { ...(cookie ? { cookie } : {}), origin,
      'content-type': 'application/x-www-form-urlencoded', ...headers },
    ...(method === 'POST' ? { body: body ?? new URLSearchParams({ fileName, pdf }) } : {}),
  });
}

test('pending PDF downloads require an admin session before reading the document', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'pdf-academy');
  for (const [cookie, status] of [[undefined, 401], [academy.cookie, 403]]) {
    const request = pendingPdfRequest(cookie);
    const response = await worker.fetch(request, f.env);
    assert.equal(response.status, status);
    assert.equal(request.bodyUsed, false);
    assert.equal(response.headers.get('content-disposition'), null);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});

test('pending PDF downloads return identical binary bytes as a private HTTP attachment', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'pdf-admin', { role: 'admin' });
  const request = pendingPdfRequest(admin.cookie);
  const expected = new URLSearchParams(await request.clone().text()).get('pdf');
  const response = await worker.fetch(request, f.env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="levitate-pendientes-Academia.pdf"');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(expected, 'base64'));
});

test('pending PDF downloads reject cross-origin posts, invalid files, and oversized payloads', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'pdf-validation', { role: 'admin' });
  for (const [options, status] of [
    [{ origin: 'https://untrusted.example' }, 403],
    [{ origin: '' }, 403],
    [{ method: 'GET' }, 405],
    [{ headers: { 'content-type': 'text/plain' } }, 400],
    [{ fileName: '../unsafe.pdf' }, 400],
    [{ fileName: 'report.pdf"\r\nx-header: injected' }, 400],
    [{ pdf: 'not base64!' }, 400],
    [{ pdf: Buffer.from('<html>not a pdf</html>').toString('base64') }, 400],
    [{ pdf: Buffer.from('%PDF-1.4\ntruncated').toString('base64') }, 400],
    [{ headers: { 'content-length': String(13 * 1024 * 1024) } }, 413],
    // The streaming limit also applies when Content-Length is absent or false.
    [{ body: 'x'.repeat(13 * 1024 * 1024) }, 413],
    [{ body: 'x'.repeat(13 * 1024 * 1024), headers: { 'content-length': '1' } }, 413],
  ]) {
    const request = pendingPdfRequest(admin.cookie, options);
    const response = await worker.fetch(request, f.env);
    assert.equal(response.status, status, JSON.stringify({ ...options, body: options.body ? '(oversized)' : undefined }));
    assert.equal(response.headers.get('content-disposition'), null);
    assert.ok((await response.json()).error.message);
  }
});

function seedAdminPaymentPages(f, count = 63) {
  for (let i = 0; i < count; i += 1) {
    const table = i % 2 ? 'registration_shop_orders' : 'registration_inscription_orders';
    f.db.sqlite.prepare(`INSERT INTO ${table}
      (id, curp, participant_name, academy_name, venue, reference, amount, paid_amount, status, created_at, updated_at)
      VALUES (?, ?, ?, 'Academia paginación', ?, ?, 1000, ?, ?, '2026-09-01 00:00:00', '2026-09-01 00:00:00')`)
      .run(`page-${String(Math.floor(i / 2)).padStart(3, '0')}`, i === 0 ? 'RELEVE:dance-test' : `ABCD100101MDFXX${String(i).padStart(4, '0')}`,
        `Persona ${i}`, i % 3 ? 'edomex' : 'puebla', `TEST-${i}`,
        i % 4 === 2 ? 1000 : 0, ['pending_payment', 'payment_reported', 'paid', 'rejected'][i % 4]);
  }
}

function paymentPageReadQueries(queries) {
  const repricing = queries.filter(sql => /UPDATE registration_inscription_orders AS o/.test(sql));
  assert.equal(repricing.length, 1, 'one set-based Relevé price refresh precedes pagination');
  assert.doesNotMatch(repricing[0], /data_url|SELECT\s+\*|event_tickets/, 'price refresh reads only proof timestamps/status, never files or tickets');
  return queries.filter(sql => !repricing.includes(sql));
}

test('admin payments use bounded SQL pages with stable identities and no proof or ticket hydration', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'page-admin', { role: 'admin' });
  seedAdminPaymentPages(f);
  const visited = [];
  for (let page = 1; page <= 3; page += 1) {
    const start = f.db.runtimeQueries.length;
    const { json } = await f.request(`/admin/payment-orders?page=${page}&pageSize=25`, { cookie: admin.cookie });
    assert.equal(json.pagination.totalItems, 63);
    assert.equal(json.pagination.page, page);
    assert.equal(json.orders.length, page === 3 ? 13 : 25);
    for (const order of json.orders) {
      assert.equal('proof' in order, false);
      assert.equal('tickets' in order, false);
      assert.equal('accessToken' in order, false);
      visited.push(`${order.orderType}:${order.id}`);
    }
    const queries = paymentPageReadQueries(f.db.runtimeQueries.slice(start));
    assert.ok(queries.some(sql => /LIMIT \? OFFSET \?/.test(sql)));
    assert.ok(queries.every(sql => !/payment_proofs|event_tickets/.test(sql)));
    const pageSql = queries.find(sql => /LIMIT \? OFFSET \?/.test(sql));
    const plan = f.db.sqlite.prepare(`EXPLAIN QUERY PLAN ${pageSql}`).all(25, (page - 1) * 25).map(row => row.detail).join('\n');
    assert.match(plan, /idx_registration_inscription_orders_recent/);
    assert.match(plan, /idx_registration_shop_orders_recent/);
    // SQLite may sort the constant order_type tie-breaker within each unique ID.
    // It must not sort the entire dataset to produce an ordered page.
    assert.doesNotMatch(plan, /USE TEMP B-TREE FOR ORDER BY/);
  }
  assert.equal(new Set(visited).size, 63, 'same IDs in the two order tables remain distinct');
  const { json: empty } = await f.request('/admin/payment-orders?status=paid&venue=cdmx', { cookie: admin.cookie });
  assert.equal(empty.pagination.totalItems, 0);
  assert.equal(empty.pagination.page, 1);
  const { json: clamped } = await f.request('/admin/payment-orders?page=99&pageSize=50', { cookie: admin.cookie });
  assert.equal(clamped.pagination.page, 2);
  assert.equal(clamped.orders.length, 13);
});

test('payment filters, reference search, optional global totals and exports span all pages', async t => {
  const f = await fixture(t);
  t.mock.method(Date, 'now', () => Date.parse('2026-10-14T18:00:00Z'));
  const admin = await seedAcademy(f, 'filter-admin', { role: 'admin' });
  seedAdminPaymentPages(f);
  const { json } = await f.request('/admin/payment-orders?status=paid&venue=puebla&purchaseType=registration&includeTotals=1', { cookie: admin.cookie });
  assert.ok(json.orders.length > 0);
  assert.ok(json.orders.every(order => order.status === 'paid' && order.venue === 'puebla' && order.orderType === 'registration'));
  assert.equal(json.totals.count, 63, 'summary cards describe the entire dataset, not the page');
  assert.equal(json.totals.amount, 63000, 'global totals include the extended Relevé presale price');
  const reference = json.orders[0].paymentReference;
  const { json: searched } = await f.request(`/admin/payment-orders?q=${encodeURIComponent(reference)}`, { cookie: admin.cookie });
  assert.ok(searched.orders.some(order => order.paymentReference === reference));
  assert.equal('totals' in searched, false, 'subsequent pages do not recompute global totals');
  const { json: releve } = await f.request('/admin/payment-orders?purchaseType=releve', { cookie: admin.cookie });
  assert.equal(releve.orders.length, 1);
  assert.match(releve.orders[0].curp, /^RELEVE:/);
  const { json: exported } = await f.request('/admin/payment-orders?export=1', { cookie: admin.cookie });
  assert.equal(exported.orders.length, 63);
  const { json: filteredExport } = await f.request('/admin/payment-orders?export=1&status=paid&venue=puebla&purchaseType=registration', { cookie: admin.cookie });
  assert.deepEqual(filteredExport.orders.map(order => order.id), json.orders.map(order => order.id));
  const { json: literalSearch } = await f.request('/admin/payment-orders?q=%25', { cookie: admin.cookie });
  assert.equal(literalSearch.orders.length, 0, 'SQL wildcard characters are literal searches');
});

test('payment details group every ticket for the same CURP and exports preserve private boundaries', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'detail-admin', { role: 'admin' });
  const paid = await createPaidTicketOrder(f, admin, [{ productId: 'ticket-full-pass', quantity: 3 }]);
  const secondPaid = await createPaidTicketOrder(f, admin, [{ productId: 'ticket-block', optionId: 'bloque-2', quantity: 2 }]);
  assert.equal(secondPaid.participantTickets.length, 5, 'approval responses refresh the grouped participant accesses');
  const { json: detail } = await f.request(`/admin/payment-order?id=${paid.id}&orderType=shop`, { cookie: admin.cookie });
  assert.equal(detail.order.proof.dataUrl, proof.dataUrl);
  assert.equal(detail.order.tickets.length, 3);
  assert.equal(detail.order.participantTickets.length, 5);
  assert.deepEqual(new Set(detail.order.participantTickets.map(ticket => ticket.sourceOrderId)), new Set([paid.id, secondPaid.id]));
  assert.deepEqual(new Set(detail.order.participantTickets.map(ticket => ticket.sourceOrderReference)), new Set([paid.reference, secondPaid.reference]));
  assert.ok(detail.order.participantTickets.every(ticket => ticket.sourceOrderStatus === 'paid'));
  const { json: exported } = await f.request('/admin/payment-orders?export=1', { cookie: admin.cookie });
  const exportedPaid = exported.orders.find(order => order.id === paid.id && order.orderType === 'shop');
  assert.equal(exportedPaid.proof.fileName, proof.fileName);
  assert.equal(exportedPaid.proof.dataUrl, '', 'CSV exports do not download the proof binary');
  assert.equal(exportedPaid.ticketCount, 3);
  assert.equal('accessToken' in exportedPaid, false);
  assert.equal('participantTickets' in exportedPaid, false, 'CSV exports stay bounded to per-order metadata');
  await f.request('/admin/payment-order?id=missing&orderType=shop', { cookie: admin.cookie, status: 404 });
});

test('payment pages, details and exports require a real admin session before reading order data', async t => {
  const f = await fixture(t);
  const academy = await seedAcademy(f, 'non-admin');
  for (const path of ['/admin/payment-orders', '/admin/payment-orders?export=1', '/admin/payment-order?id=test&orderType=shop']) {
    for (const [cookie, status] of [[undefined, 401], [academy.cookie, 403]]) {
      const start = f.db.runtimeQueries.length;
      await f.request(path, { cookie, status });
      assert.ok(f.db.runtimeQueries.slice(start).every(sql => !/FROM registration_(?:shop|inscription)_orders/.test(sql)));
    }
  }
  const admin = await seedAcademy(f, 'validation-admin', { role: 'admin' });
  for (const query of ['page=-1', 'page=1.5', 'page=Infinity', 'pageSize=10000', 'status=unknown', 'venue=unknown', 'purchaseType=unknown']) {
    await f.request(`/admin/payment-orders?${query}`, { cookie: admin.cookie, status: 400 });
  }
  await f.request('/admin/payment-order?id=test&orderType=unknown', { cookie: admin.cookie, status: 400 });
});

test('subsequent payment pages can skip counts and global totals, while filtered pages use ordered indexes', async t => {
  const f = await fixture(t);
  const admin = await seedAcademy(f, 'read-budget-admin', { role: 'admin' });
  seedAdminPaymentPages(f, 501);
  const start = f.db.runtimeQueries.length;
  const { json } = await f.request('/admin/payment-orders?page=2&pageSize=25&includeCount=0', { cookie: admin.cookie });
  assert.equal(json.orders.length, 25);
  assert.equal(json.pagination.totalItems, undefined);
  assert.equal(json.totals, undefined);
  const queries = paymentPageReadQueries(f.db.runtimeQueries.slice(start));
  assert.ok(queries.every(sql => !/COUNT\(|SUM\(|payment_proofs|event_tickets/.test(sql)));
  const selectQueries = queries.filter(sql => /SELECT \* FROM registration_(?:shop|inscription)_orders/.test(sql));
  assert.ok(selectQueries.length <= 2);
  assert.ok(selectQueries.every(sql => /WHERE id IN/.test(sql)), 'only the selected page is hydrated');
  for (const [filter, value, expectedIndex] of [['status', 'paid', 'status_recent'], ['venue', 'puebla', 'venue_recent']]) {
    const filterStart = f.db.runtimeQueries.length;
    await f.request(`/admin/payment-orders?${filter}=${value}&includeCount=0`, { cookie: admin.cookie });
    const sql = f.db.runtimeQueries.slice(filterStart).find(query => /LIMIT \? OFFSET \?/.test(query));
    const plan = f.db.sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(value, value, 25, 0).map(row => row.detail).join('\n');
    assert.match(plan, new RegExp(`idx_registration_inscription_orders_${expectedIndex}`));
    assert.match(plan, new RegExp(`idx_registration_shop_orders_${expectedIndex}`));
  }
});
