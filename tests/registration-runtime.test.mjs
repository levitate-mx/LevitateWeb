import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';
import { prepareRegistrationSchema } from '../scripts/lib/registration-schema.mjs';

// A real SQLite database catches missing columns, constraints, joins, and writes;
// this adapter only supplies D1's async result shape. No network/database service
// is contacted by these tests.
class LocalD1 {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.runtimeQueries = [];
    this.allowAcademyVenueProbe = false;
    this.allowLegacySchemaPreparation = false;
  }

  prepare(sql) {
    this.runtimeQueries.push(sql);
    if (!this.allowLegacySchemaPreparation) {
      assert.doesNotMatch(sql, /^\s*(?:CREATE|ALTER|DROP)\b/i, 'request attempted schema preparation');
    }
    if (!this.allowLegacySchemaPreparation && /\bPRAGMA\s+table_info\b/i.test(sql)) {
      assert.ok(this.allowAcademyVenueProbe && /^\s*PRAGMA table_info\(registration_academies\)\s*$/i.test(sql),
        'only new-academy legacy venue compatibility may inspect schema');
    }
    const statement = this.sqlite.prepare(sql);
    let values = [];
    const execute = {
      bind(...nextValues) { values = nextValues; return execute; },
      async first(column) {
        const row = statement.get(...values);
        return row ? (column ? row[column] : { ...row }) : null;
      },
      async all() { return { success: true, results: statement.all(...values).map(row => ({ ...row })) }; },
      async run() {
        const result = statement.run(...values);
        return { success: true, results: [], meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
      },
    };
    return execute;
  }

  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

async function fixture(t, { includeStudentSchema = false, workerUnderTest = worker } = {}) {
  const db = new LocalD1();
  t.after(() => db.sqlite.close());
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
    async request(path, { method = 'GET', cookie, body, status = 200 } = {}) {
      const response = await workerUnderTest.fetch(new Request(`http://localhost/api/registration${path}`, {
        method,
        headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }), env);
      const json = await response.json();
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(json)}`);
      return { json, cookie: response.headers.get('set-cookie')?.split(';')[0] };
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
  f.db.sqlite.prepare(`INSERT INTO registration_sessions (id, user_id, session_token_hash, expires_at)
    VALUES (?, ?, ?, datetime('now', '+1 day'))`).run(`session-${suffix}`, userId, tokenHash);
  return { academyId, userId, cookie: `levitate_registration_session=${token}` };
}

const curpA = 'AAAA100101MDFBBB01';
const curpB = 'BBBB100101MDFBBB01';
const phone = { buyerPhoneCountryCode: '+52', buyerPhoneNumber: '5555555555' };
const proof = { fileName: 'comprobante.png', contentType: 'image/png', dataUrl: 'data:image/png;base64,AQID', fileSize: 3 };

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
  await f.request('/dances', { method: 'DELETE', cookie: a.cookie, body: { id: record.dance.id } });
  await f.request('/participants', { method: 'DELETE', cookie: a.cookie, body: { id: record.participant.id } });
  await f.request('/choreographers', { method: 'DELETE', cookie: a.cookie, body: { id: record.choreographer.id } });
  const { json: remaining } = await f.request('/bootstrap', { cookie: b.cookie });
  assert.equal(remaining.dances[0].id, other.dance.id);
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
  const scanned = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie, body: { ticketCode: tickets[0].ticket_code } });
  assert.equal(scanned.json.admitted, true);
  const rescanned = await f.request('/admin/ticket/scan', { method: 'POST', cookie: admin.cookie, body: { ticketCode: tickets[0].ticket_code } });
  assert.equal(rescanned.json.reason, 'already_used');
  const { json: allOrders } = await f.request('/admin/inscription-orders', { cookie: admin.cookie });
  assert.equal(allOrders.orders.length, 2);
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
  await f.request('/music', { method: 'POST', cookie: otherAcademy.cookie, body: music, status: 404 });
  await f.request('/music', { method: 'POST', cookie: academy.cookie, body: { ...music, fileName: 'nueva.mp3' } });
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_music_uploads').get().total, 1);
  f.db.sqlite.prepare(`UPDATE registration_music_uploads SET storage_provider = 'google_drive', data_url = '',
    drive_file_id = 'fixture-drive-id', drive_web_view_link = 'https://drive.google.com/file/d/fixture-drive-id/view',
    drive_web_content_link = 'https://drive.google.com/uc?id=fixture-drive-id' WHERE dance_id = ?`).run(dance.id);
  const { json: bootstrap } = await f.request('/bootstrap', { cookie: academy.cookie });
  assert.equal(bootstrap.dances[0].musicUpload.storageProvider, 'google_drive');
  assert.equal(bootstrap.dances[0].musicUpload.fileName, 'nueva.mp3');
  assert.equal(bootstrap.dances[0].musicUpload.driveFileId, null, 'public payload still hides internal Drive identifiers');
  assert.equal(f.db.sqlite.prepare('SELECT drive_file_id FROM registration_music_uploads WHERE dance_id = ?').get(dance.id).drive_file_id, 'fixture-drive-id');
  await f.request('/music', { method: 'DELETE', cookie: otherAcademy.cookie, body: { danceId: dance.id }, status: 404 });
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_music_uploads').get().total, 1);
  const { json: deleted } = await f.request('/music', { method: 'DELETE', cookie: academy.cookie, body: { danceId: dance.id } });
  assert.equal(deleted.musicUpload, null);
  assert.equal(f.db.sqlite.prepare('SELECT count(*) AS total FROM registration_music_uploads').get().total, 0);
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
