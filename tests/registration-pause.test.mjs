import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';

// Real SQLite, authenticated synthetic actors and isolated D1-style batches.
// These tests never connect to a remote database or invoke a deployment.
class PauseD1 {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    this.sqlite.function('levitate_test_unixepoch_now', () => Math.floor(Date.now() / 1000));
    this.queries = [];
    this.writes = [];
    this.queue = Promise.resolve();
  }

  prepare(sql) {
    assert.doesNotMatch(sql, /^\s*(?:CREATE|ALTER|DROP)\b/i, 'requests must not prepare schema');
    if (/\bPRAGMA\b/i.test(sql)) assert.ok(this.allowAcademyVenueProbe && /^\s*PRAGMA table_info\(registration_academies\)\s*$/i.test(sql), 'only academy compatibility may inspect its table');
    this.queries.push(sql);
    const statement = this.sqlite.prepare(sql.replaceAll("unixepoch('now')", 'levitate_test_unixepoch_now()'));
    let values = [];
    const db = this;
    const query = {
      bind(...bindings) { values = bindings; return query; },
      async first(column) {
        const row = statement.get(...values);
        return row ? (column ? row[column] : { ...row }) : null;
      },
      async all() { return { success: true, results: statement.all(...values).map(row => ({ ...row })) }; },
      runSync() {
        db.beforeRun?.(sql);
        const result = statement.run(...values);
        if (/^\s*(?:INSERT|UPDATE|DELETE)\b/i.test(sql)) db.writes.push(sql);
        return { success: true, results: [], meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
      },
      async run() { return query.runSync(); },
    };
    return query;
  }

  batch(statements) {
    const result = this.queue.then(() => {
      this.beforeBatch?.();
      this.sqlite.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.runSync());
        this.sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        this.sqlite.exec('ROLLBACK');
        throw error;
      }
    });
    this.queue = result.catch(() => {});
    return result;
  }
}

async function seedActor(db, id, role = 'academy') {
  db.sqlite.prepare(`INSERT INTO registration_academies(id,name,contact_name,email,phone)
    VALUES (?, ?, 'Responsable de prueba', ?, '5555555555')`).run(id, `Academia ${id}`, `${id}@example.test`);
  db.sqlite.prepare(`INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,email_confirmed_at)
    VALUES (?, ?, 'Persona local', ?, ?, 'fixture-unused-password', ?, '2026-01-01 00:00:00')`)
    .run(id, id, id, `${id}@example.test`, role);
  const token = `pause-session-${id}`;
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  db.sqlite.prepare(`INSERT INTO registration_sessions(id,user_id,session_token_hash,expires_at)
    VALUES (?, ?, ?, '2099-01-01 00:00:00')`).run(`session-${id}`, id, hash);
  return { id, cookie: `levitate_registration_session=${token}` };
}

async function seedStudent(db, curp) {
  const token = `pause-student-${curp}`;
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  db.sqlite.prepare('INSERT INTO registration_student_users(id,curp) VALUES (?, ?)').run(`student-${curp}`, curp);
  db.sqlite.prepare(`INSERT INTO registration_student_sessions(id,user_id,session_token_hash,expires_at)
    VALUES (?, ?, ?, '2099-01-01 00:00:00')`).run(`student-session-${curp}`, `student-${curp}`, hash);
  return `levitate_registration_student_session=${token}`;
}

async function fixture(t, { pausedVenues = 'edomex' } = {}) {
  t.mock.method(Date, 'now', () => Date.parse('2026-11-04T12:00:00-06:00'));
  const db = new PauseD1();
  t.after(() => db.sqlite.close());
  db.sqlite.exec(await readFile(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  const academy = await seedActor(db, 'pause-academy');
  const other = await seedActor(db, 'pause-other');
  const admin = await seedActor(db, 'pause-admin', 'admin');
  for (const actor of [academy, other]) {
    db.sqlite.prepare('INSERT INTO registration_choreographers(id,academy_id,full_name) VALUES (?, ?, ?)')
      .run(`teacher-${actor.id}`, actor.id, `Maestra ${actor.id}`);
  }
  const env = { DB: db, ...(pausedVenues == null ? {} : { REGISTRATION_PAUSED_VENUES: pausedVenues }) };
  let sequence = 0;
  const f = {
    db, env, academy, other, admin,
    async request(path, { method = 'POST', cookie = academy.cookie, body, status = 200, envOverrides = {} } = {}) {
      const response = await worker.fetch(new Request(`https://example.test/api/registration${path}`, {
        method,
        headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }), { ...env, ...envOverrides });
      const json = await response.json();
      if (status != null) assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(json)}`);
      return { status: response.status, json, headers: response.headers };
    },
    person({ owner = academy, curp } = {}) {
      const index = sequence++;
      const person = { id: `pause-person-${index}`, curp: curp || `PAA${String.fromCharCode(65 + index)}100101MDFBBB01`, owner };
      db.sqlite.prepare(`INSERT INTO registration_participants(id,academy_id,full_name,curp,birth_date,age,division,shirt_size)
        VALUES (?, ?, ?, ?, '2010-01-01', 16, 'teen', 'm')`).run(person.id, owner.id, person.id, person.curp);
      return person;
    },
    dance({ person, owner = person?.owner || academy, venue = 'edomex', isReleve = false, createdAt, title } = {}) {
      const id = `pause-dance-${sequence++}`;
      db.sqlite.prepare(`INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,venue,is_releve,created_at)
        VALUES (?, ?, ?, 'motion', 'jazz', 'solo', ?, ?, COALESCE(?, datetime('now')))`)
        .run(id, owner.id, title || id, venue, isReleve ? 1 : 0, createdAt || null);
      db.sqlite.prepare('INSERT INTO registration_dance_choreographers(dance_id,choreographer_id) VALUES (?, ?)')
        .run(id, `teacher-${owner.id}`);
      if (person && !isReleve) {
        db.sqlite.prepare('INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES (?, ?)').run(id, person.id);
      }
      return { id, venue, owner, isReleve };
    },
  };
  return f;
}

const phone = { buyerPhoneCountryCode: '+52', buyerPhoneNumber: '5555555555' };
const proof = { fileName: 'comprobante-local.png', contentType: 'image/png', fileSize: 3, dataUrl: 'data:image/png;base64,AQID' };
const orderPaths = ['/inscription/order', '/inscription/payment-order'];
const proofPaths = ['/inscription/order/proof', '/inscription/payment-proof'];
const lookupPaths = ['/inscription/lookup', '/inscription/payment-lookup'];
const orderRow = (f, id) => ({ ...f.db.sqlite.prepare('SELECT * FROM registration_inscription_orders WHERE id = ?').get(id) });
const businessTables = ['registration_participants', 'registration_choreographers', 'registration_dances',
  'registration_dance_participants', 'registration_dance_choreographers', 'registration_inscription_orders',
  'registration_inscription_payment_proofs', 'registration_event_tickets'];
const businessSnapshot = f => Object.fromEntries(businessTables.map(table => [table,
  f.db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(row => ({ ...row })),
]));
const assertNoDeletes = f => assert.ok(f.db.writes.every(sql => !/^\s*DELETE\b/i.test(sql)), 'pausing registration must never delete stored records');
const danceBody = (f, person, venue = 'edomex', isReleve = false) => ({
  title: 'Formulario abierto antes del cierre', genre: 'motion', subgenre: 'jazz', category: 'solo', venue,
  level: null, isReleve, choreographerIds: [`teacher-${f.academy.id}`], participantIds: isReleve ? [] : [person.id],
});

async function createExistingOrder(f, person, { status = 'pending_payment' } = {}) {
  const { json: { order } } = await f.request('/inscription/order', { body: { curp: person.curp, ...phone }, status: 201,
    envOverrides: { REGISTRATION_PAUSED_VENUES: '' } });
  const lineItems = JSON.parse(orderRow(f, order.id).line_items_json).map(line => ({ ...line, amount: 777 }));
  f.db.sqlite.prepare(`UPDATE registration_inscription_orders SET amount = 777, status = ?, line_items_json = ?,
    buyer_phone_country_code = '+52', buyer_phone_number = '5555555555', buyer_phone = '+525555555555',
    notes = 'Conservar registro y comprobantes', updated_at = '2026-10-20 12:00:00' WHERE id = ?`)
    .run(status, JSON.stringify(lineItems), order.id);
  return { ...order, status, amount: 777 };
}

function seedReleveOrder(f, dance) {
  const id = `order-${dance.id}`;
  f.db.sqlite.prepare(`INSERT INTO registration_inscription_orders
    (id,curp,participant_name,academy_id,academy_name,venue,reference,amount,status,line_items_json,
      buyer_phone,notes,created_at,updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1500, 'pending_payment', ?, '+525555555555', 'No modificar ni borrar',
      '2026-10-01 12:00:00', '2026-10-01 12:00:00')`)
    .run(id, `RELEVE:${dance.id}`, dance.id, dance.owner.id, `Academia ${dance.owner.id}`, dance.venue, `REL-${dance.id}`,
      JSON.stringify([{ id: dance.id, title: `Relevé · ${dance.id}`, category: 'releve', genre: 'motion',
        venue: dance.venue, currency: 'MXN', amount: 1500 }]));
  return id;
}

test('registration status publishes the configured pause without changing the default-open behavior', async t => {
  const f = await fixture(t);
  const { json } = await f.request('/status', { method: 'GET', cookie: '' });
  assert.deepEqual(json.registrationPolicy.pausedVenues, ['edomex']);
  assert.equal(typeof json.registrationPolicy.message, 'string');
  assert.ok(json.registrationPolicy.message.trim());
  const open = await fixture(t, { pausedVenues: null });
  const response = await open.request('/status', { method: 'GET', cookie: '' });
  assert.deepEqual(response.json.registrationPolicy.pausedVenues, []);
  assertNoDeletes(f);
});

test('a stale Edomex dance form is blocked after authentication, including Relevé, without changing business records', async t => {
  const f = await fixture(t);
  const person = f.person();
  const before = businessSnapshot(f);
  for (const isReleve of [false, true]) {
    const body = danceBody(f, person, 'edomex', isReleve);
    await f.request('/dances', { cookie: '', body, status: 401 });
    const { json } = await f.request('/dances', { body, status: 403 });
    assert.equal(json.error.code, 'registration_paused');
    assert.deepEqual(businessSnapshot(f), before);
  }
  assertNoDeletes(f);
});

test('other venues still accept ordinary dances and Relevé while Edomex is paused', async t => {
  const f = await fixture(t);
  const person = f.person();
  for (const venue of ['cdmx', 'puebla', 'veracruz']) {
    for (const isReleve of [false, true]) {
      const { json } = await f.request('/dances', { body: danceBody(f, person, venue, isReleve), status: 201 });
      assert.equal(json.dance.venue, venue);
      assert.equal(json.dance.isReleve, isReleve);
    }
  }
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_dances').get().n, 6);
  assertNoDeletes(f);
});

test('registration and legacy payment endpoints authenticate and enforce CURP ownership before the pause or order data', async t => {
  const f = await fixture(t);
  const person = f.person();
  f.dance({ person });
  const existing = await createExistingOrder(f, person);
  const before = businessSnapshot(f);
  for (const path of [...lookupPaths, ...orderPaths, ...proofPaths]) {
    const body = { curp: person.curp, orderId: existing.id, ...phone, ...proof };
    await f.request(path, { cookie: '', body, status: 401 });
    const { json } = await f.request(path, { cookie: f.other.cookie, body, status: 403 });
    assert.equal(json.error.code, 'registration_inscription_lookup_forbidden');
    assert.deepEqual(businessSnapshot(f), before);
  }
  await f.request('/releve/orders', { cookie: '', body: {}, status: 401 });
  assertNoDeletes(f);
});

test('an academy sharing the CURP still cannot attach proof to another academy order', async t => {
  const f = await fixture(t);
  const person = f.person();
  f.dance({ person });
  const existing = await createExistingOrder(f, person);
  const otherPerson = f.person({ owner: f.other, curp: person.curp });
  f.dance({ person: otherPerson, venue: 'puebla' });
  const before = businessSnapshot(f);
  for (const path of proofPaths) {
    const { json } = await f.request(path, { cookie: f.other.cookie,
      body: { curp: person.curp, orderId: existing.id, ...proof }, status: 403 });
    assert.equal(json.error.code, 'registration_inscription_lookup_forbidden');
    assert.deepEqual(businessSnapshot(f), before);
  }
  assertNoDeletes(f);
});

test('both payment endpoints create an order for existing Edomex dances after dance registration closes, including mixed venues', async t => {
  for (const mixed of [false, true]) {
    await t.test(mixed ? 'mixed with CDMX first' : 'Edomex only', async t => {
      const f = await fixture(t);
      const person = f.person();
      f.dance({ person, venue: 'edomex', title: 'Z coreografía existente' });
      if (mixed) f.dance({ person, venue: 'cdmx', title: 'A sede abierta', createdAt: '2026-11-03 12:00:00' });
      const { json: quote } = await f.request('/inscription/lookup', { body: { curp: person.curp } });
      assert.ok(quote.lines.some(line => line.venue === 'edomex'));
      for (const path of orderPaths) {
        const { json } = await f.request(path, { body: { curp: person.curp, ...phone }, status: 201 });
        assert.equal(json.order.status, 'pending_payment');
        assert.equal(json.order.amount, quote.subtotal);
        assert.deepEqual(json.order.lineItems.map(line => [line.title, line.amount]), quote.lines.map(line => [line.title, line.amount]));
      }
      assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_orders').get().n, 1);
      assertNoDeletes(f);
    });
  }
});

test('matching student sessions retain payment access after dance closure, and other venues and explicit-open fixtures stay available', async t => {
  const f = await fixture(t);
  const person = f.person();
  f.dance({ person });
  const cookie = await seedStudent(f.db, person.curp);
  for (const path of orderPaths) {
    const { json } = await f.request(path, { cookie, body: { curp: person.curp, ...phone }, status: 201 });
    assert.equal(json.order.venue, 'edomex');
    assert.ok(json.order.amount > 0);
  }
  const allowed = f.person();
  f.dance({ person: allowed, venue: 'puebla' });
  const { json } = await f.request('/inscription/payment-order', { body: { curp: allowed.curp, ...phone }, status: 201 });
  assert.equal(json.order.venue, 'puebla');
  const open = await fixture(t, { pausedVenues: '' });
  const openPerson = open.person();
  const dance = await open.request('/dances', { body: danceBody(open, openPerson), status: 201 });
  assert.equal(dance.json.dance.venue, 'edomex');
  const created = await open.request('/inscription/order', { body: { curp: openPerson.curp, ...phone }, status: 201 });
  assert.equal(created.json.order.venue, 'edomex');
  assertNoDeletes(f);
  assertNoDeletes(open);
});

test('after dance closure pending and rejected orders still synchronize concepts, while paid and reported financial snapshots stay intact', async t => {
  for (const status of ['pending_payment', 'rejected', 'payment_reported', 'paid']) {
    await t.test(status, async t => {
      const f = await fixture(t);
      const person = f.person();
      f.dance({ person });
      const existing = await createExistingOrder(f, person, { status });
      f.db.sqlite.prepare('UPDATE registration_inscription_orders SET paid_amount = ? WHERE id = ?').run(status === 'paid' ? 777 : 100, existing.id);
      const before = orderRow(f, existing.id);
      const editable = status === 'pending_payment' || status === 'rejected';
      let quote;
      for (const path of lookupPaths) {
        const { json } = await f.request(path, { body: { curp: person.curp } });
        quote = json;
        assert.equal(json.order.id, existing.id);
        assert.equal(json.order.amount, 777);
        assert.equal(json.subtotal > 777, editable);
        assert.deepEqual(orderRow(f, existing.id), before, 'reading a quote does not rewrite the saved order');
      }
      for (const path of orderPaths) {
        const { json } = await f.request(path, { body: { curp: person.curp, ...phone }, status: 201 });
        assert.equal(json.order.id, existing.id);
        assert.equal(json.order.amount, editable ? quote.subtotal : 777);
        assert.equal(json.order.status, status);
      }
      const after = orderRow(f, existing.id);
      for (const field of ['paid_amount', 'paid_at', 'notes', 'created_at']) assert.equal(after[field], before[field], field);
      if (editable) assert.deepEqual(JSON.parse(after.line_items_json).map(line => [line.title, line.amount]), quote.lines.map(line => [line.title, line.amount]));
      else for (const field of ['amount', 'status', 'line_items_json']) assert.equal(after[field], before[field], field);
      assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_orders').get().n, 1);
      assertNoDeletes(f);
    });
  }
});

test('owners can consult and submit proof for existing paused orders without repricing or deleting their records', async t => {
  for (const path of proofPaths) {
    await t.test(path, async t => {
      const f = await fixture(t);
      const person = f.person();
      f.dance({ person });
      const existing = await createExistingOrder(f, person);
      const before = orderRow(f, existing.id);
      for (const lookupPath of lookupPaths) {
        const { json } = await f.request(lookupPath, { body: { curp: person.curp } });
        assert.equal(json.order.id, existing.id);
        assert.equal(json.order.amount, 777);
      }
      const cookie = await seedStudent(f.db, person.curp);
      const { json } = await f.request(path, { cookie, body: { orderId: existing.id, curp: person.curp, ...proof }, status: 201 });
      assert.equal(json.order.id, existing.id);
      assert.equal(json.order.status, 'payment_reported');
      const after = orderRow(f, existing.id);
      for (const field of ['amount', 'paid_amount', 'line_items_json', 'buyer_phone', 'buyer_phone_number', 'created_at']) {
        assert.equal(after[field], before[field], field);
      }
      assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_payment_proofs WHERE order_id = ?')
        .get(existing.id).n, 1);
      assertNoDeletes(f);
    });
  }
});

test('Relevé payments for existing dances stay available after closure, including previously unbilled dances', async t => {
  const f = await fixture(t);
  const existingDance = f.dance({ venue: 'edomex', isReleve: true });
  const missingDance = f.dance({ venue: 'edomex', isReleve: true });
  const allowedDance = f.dance({ venue: 'puebla', isReleve: true });
  const otherDance = f.dance({ owner: f.other, venue: 'puebla', isReleve: true });
  const id = seedReleveOrder(f, existingDance);
  const before = orderRow(f, id);
  const { json } = await f.request('/releve/orders', { body: {} });
  assert.deepEqual(new Set(json.orders.map(order => order.danceId)), new Set([existingDance.id, missingDance.id, allowedDance.id]));
  assert.equal(json.orders.find(order => order.id === id).amount, 1500);
  assert.deepEqual(orderRow(f, id), before);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_orders WHERE curp = ?').get(`RELEVE:${missingDance.id}`).n, 1);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_orders WHERE curp = ?').get(`RELEVE:${otherDance.id}`).n, 0);
  const proofResult = await f.request('/releve/order/proof', { body: { orderId: id, ...proof }, status: 201 });
  assert.equal(proofResult.json.order.amount, 1500);
  assert.equal(proofResult.json.order.status, 'payment_reported');
  await f.request('/releve/order/proof', { cookie: f.other.cookie, body: { orderId: id, ...proof }, status: 404 });
  assertNoDeletes(f);
});


const reopeningStart = Date.parse('2026-11-02T00:00:00-06:00');
const reopeningEnd = Date.parse('2026-11-03T00:00:00-06:00');
const reopeningCases = [
  ['one millisecond before November 2 CDMX', reopeningStart - 1, false],
  ['exactly November 2 at midnight CDMX', reopeningStart, true],
  ['the last millisecond of November 2 CDMX', reopeningEnd - 1, true],
  ['exactly November 3 at midnight CDMX', reopeningEnd, false],
  ['after the reopening has finished', reopeningEnd + 24 * 60 * 60 * 1000, false],
];

test('the shared reopening policy uses the exact CDMX day and retains unrelated venue pauses', async () => {
  const { resolveRegistrationPolicy } = await import('../shared/registration-policy.js');
  const base = Object.freeze(['edomex', 'puebla']);
  for (const [label, now, active] of reopeningCases) {
    const policy = resolveRegistrationPolicy(base, now);
    assert.deepEqual(policy.basePausedVenues, ['edomex', 'puebla'], label);
    assert.deepEqual(policy.pausedVenues, active ? ['puebla'] : ['edomex', 'puebla'], label);
    assert.equal(policy.temporaryOpeningActive, active, label);
    assert.equal(policy.temporaryOpening.venue, 'edomex', label);
    assert.equal(Date.parse(policy.temporaryOpening.startsAt), reopeningStart);
    assert.equal(Date.parse(policy.temporaryOpening.endsAt), reopeningEnd);
    assert.equal(Date.parse(policy.serverTime), now);
    const next = now < reopeningStart ? reopeningStart : now < reopeningEnd ? reopeningEnd : null;
    assert.equal(policy.nextChangeAt == null ? null : Date.parse(policy.nextChangeAt), next, label);
  }
});

test('server status and new ordinary/Relevé dances follow the November 3 boundary while existing dance payments stay open', async t => {
  for (const [label, timestamp, active] of reopeningCases) {
    await t.test(label, async t => {
      const f = await fixture(t);
      t.mock.method(Date, 'now', () => timestamp);
      const status = await f.request('/status', { method: 'GET', cookie: '' });
      assert.deepEqual(status.json.registrationPolicy.pausedVenues, active ? [] : ['edomex']);
      assert.equal(status.json.registrationPolicy.temporaryOpeningActive, active);
      assert.equal(Date.parse(status.json.registrationPolicy.serverTime), timestamp);
      assert.equal(status.headers.get('cache-control'), 'no-store');

      const person = f.person();
      for (const isReleve of [false, true]) {
        const body = danceBody(f, person, 'edomex', isReleve);
        await f.request('/dances', { cookie: '', body, status: 401 });
        const before = businessSnapshot(f);
        const result = await f.request('/dances', { body, status: active ? 201 : 403 });
        if (active) {
          assert.equal(result.json.dance.venue, 'edomex');
          assert.equal(result.json.dance.isReleve, isReleve);
        } else {
          assert.equal(result.json.error.code, 'registration_paused');
          assert.deepEqual(businessSnapshot(f), before);
        }
      }
      for (const path of orderPaths) {
        const orderPerson = f.person();
        f.dance({ person: orderPerson, venue: 'edomex' });
        const body = { curp: orderPerson.curp, ...phone };
        await f.request(path, { cookie: '', body, status: 401 });
        const result = await f.request(path, { body, status: 201 });
        assert.equal(result.json.order.venue, 'edomex');
        assert.equal(result.json.order.status, 'pending_payment');
      }
      assertNoDeletes(f);
    });
  }
});

test('the temporary Edomex reopening leaves other venue rules unchanged', async t => {
  for (const [label, timestamp] of reopeningCases) {
    await t.test(label, async t => {
      const f = await fixture(t, { pausedVenues: 'edomex,puebla' });
      t.mock.method(Date, 'now', () => timestamp);
      const person = f.person();
      const status = await f.request('/status', { method: 'GET', cookie: '' });
      assert.ok(status.json.registrationPolicy.pausedVenues.includes('puebla'));
      const blocked = await f.request('/dances', { body: danceBody(f, person, 'puebla'), status: 403 });
      assert.equal(blocked.json.error.code, 'registration_paused');
      for (const venue of ['cdmx', 'veracruz']) {
        const { json } = await f.request('/dances', { body: danceBody(f, person, venue), status: 201 });
        assert.equal(json.dance.venue, venue);
      }
      assertNoDeletes(f);
    });
  }
});

test('a proof can still be submitted after the reopened day ends without changing or deleting the existing registration', async t => {
  for (const path of proofPaths) {
    await t.test(path, async t => {
      const f = await fixture(t);
      let now = reopeningStart;
      t.mock.method(Date, 'now', () => now);
      const person = f.person();
      const { json: { dance } } = await f.request('/dances', { body: danceBody(f, person), status: 201 });
      const { json: { order } } = await f.request('/inscription/order', { body: { curp: person.curp, ...phone }, status: 201 });
      const before = orderRow(f, order.id);
      now = reopeningEnd;
      await f.request('/dances', { body: danceBody(f, person), status: 403 });
      for (const orderPath of orderPaths) {
        const response = await f.request(orderPath, { body: { curp: person.curp, ...phone }, status: 201 });
        assert.equal(response.json.order.id, order.id);
        assert.equal(response.json.order.amount, before.amount);
        assert.equal(orderRow(f, order.id).line_items_json, before.line_items_json);
      }
      await f.request(path, { cookie: '', body: { curp: person.curp, orderId: order.id, ...proof }, status: 401 });
      const { json } = await f.request(path, { body: { curp: person.curp, orderId: order.id, ...proof }, status: 201 });
      assert.equal(json.order.id, order.id);
      assert.equal(json.order.status, 'payment_reported');
      const after = orderRow(f, order.id);
      for (const field of ['amount', 'paid_amount', 'line_items_json', 'buyer_phone', 'buyer_phone_number', 'created_at']) {
        assert.equal(after[field], before[field], field);
      }
      assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_dances WHERE id = ?').get(dance.id).n, 1);
      assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_payment_proofs WHERE order_id = ?').get(order.id).n, 1);
      assertNoDeletes(f);
    });
  }
});

test('a dance request crossing the closing instant cannot commit an ordinary or Relevé dance', async t => {
  for (const isReleve of [false, true]) {
    await t.test(isReleve ? 'Relevé' : 'ordinary', async t => {
      const f = await fixture(t);
      let now = reopeningEnd - 1;
      t.mock.method(Date, 'now', () => now);
      const person = f.person();
      const before = businessSnapshot(f);
      f.db.beforeBatch = () => { now = reopeningEnd; };
      const { json } = await f.request('/dances', { body: danceBody(f, person, 'edomex', isReleve), status: 403 });
      assert.equal(json.error.code, 'registration_paused');
      assert.deepEqual(businessSnapshot(f), before, 'the closing guard must roll back the dance and every participant/teacher link');
      assertNoDeletes(f);
    });
  }
});

test('new payment orders for existing dances remain creatable across the midnight dance-registration boundary', async t => {
  for (const path of orderPaths) {
    await t.test(path, async t => {
      const f = await fixture(t);
      let now = reopeningEnd - 1;
      t.mock.method(Date, 'now', () => now);
      const person = f.person();
      const dance = f.dance({ person });
      f.db.beforeRun = sql => { if (/^\s*INSERT\s+INTO\s+registration_inscription_orders\b/i.test(sql)) now = reopeningEnd; };
      const { json } = await f.request(path, { body: { curp: person.curp, ...phone }, status: 201 });
      assert.equal(now, reopeningEnd);
      assert.equal(json.order.status, 'pending_payment');
      assert.ok(json.order.amount > 0);
      assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_dances WHERE id = ?').get(dance.id).n, 1);
      assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_orders').get().n, 1);
      assertNoDeletes(f);
    });
  }
});

test('a pending checkout crossing midnight still synchronizes concepts without losing recorded money or notes', async t => {
  const f = await fixture(t);
  const person = f.person();
  f.dance({ person });
  const existing = await createExistingOrder(f, person);
  f.db.sqlite.prepare('UPDATE registration_inscription_orders SET paid_amount = 100 WHERE id = ?').run(existing.id);
  const before = orderRow(f, existing.id);
  let now = reopeningEnd - 1;
  t.mock.method(Date, 'now', () => now);
  const { json: quote } = await f.request('/inscription/lookup', { body: { curp: person.curp } });
  f.db.beforeRun = sql => { if (/^\s*UPDATE\s+registration_inscription_orders\b/i.test(sql)) now = reopeningEnd; };
  const response = await f.request('/inscription/order', {
    body: { curp: person.curp, ...phone, buyerPhoneNumber: '5512345678' }, status: 201,
  });
  assert.equal(now, reopeningEnd);
  assert.equal(response.json.order.id, existing.id);
  const after = orderRow(f, existing.id);
  assert.equal(after.amount, quote.subtotal);
  assert.equal(after.buyer_phone_number, '5512345678');
  for (const field of ['paid_amount', 'paid_at', 'notes', 'created_at']) assert.equal(after[field], before[field], field);
  assertNoDeletes(f);
});

test('Relevé orders for existing dances can be created before and after the new-dance closing boundary', async t => {
  for (const [label, timestamp] of reopeningCases) {
    await t.test(label, async t => {
      const f = await fixture(t);
      t.mock.method(Date, 'now', () => timestamp);
      const edomex = f.dance({ venue: 'edomex', isReleve: true });
      const puebla = f.dance({ venue: 'puebla', isReleve: true });
      const { json } = await f.request('/releve/orders', { body: {} });
      assert.deepEqual(new Set(json.orders.map(order => order.danceId)), new Set([edomex.id, puebla.id]));
      assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_orders WHERE curp = ?').get(`RELEVE:${edomex.id}`).n, 1);
      assertNoDeletes(f);
    });
  }
});

test('Relevé billing still succeeds when its insert crosses the dance closing instant', async t => {
  const f = await fixture(t);
  let now = reopeningEnd - 1;
  t.mock.method(Date, 'now', () => now);
  const dance = f.dance({ venue: 'edomex', isReleve: true });
  f.db.beforeRun = sql => { if (/^\s*INSERT\s+INTO\s+registration_inscription_orders\b/i.test(sql)) now = reopeningEnd; };
  const { json } = await f.request('/releve/orders', { body: {} });
  assert.equal(now, reopeningEnd);
  assert.deepEqual(json.orders.map(order => order.danceId), [dance.id]);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_orders WHERE curp = ?').get(`RELEVE:${dance.id}`).n, 1);
  assertNoDeletes(f);
});


const productionClosureDates = [
  ['2026-11-02T00:00:00-06:00', true],
  ['2026-11-02T23:59:59.999-06:00', true],
  ['2026-11-03T00:00:00-06:00', false],
  ['2026-11-13T00:00:00-06:00', false],
  ['2026-11-15T23:59:59-06:00', false],
  ['2027-01-01T00:00:00-06:00', false],
];

test('production policy leaves November 2 open and closes new Edomex dances at exactly November 3 midnight CDMX', async t => {
  const defaults = JSON.parse(await readFile(new URL('../shared/registration-policy.json', import.meta.url), 'utf8'));
  const deployment = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.deepEqual(defaults.pausedVenues, ['edomex']);
  assert.equal(deployment.vars.REGISTRATION_PAUSED_VENUES, 'edomex');
  assert.equal(deployment.vars.TICKET_SALES_PAUSED, 'false');
  assert.match(defaults.message, /nuevas coreografías/i);
  assert.match(defaults.message, /pagos.*comprobantes/i);
  const { resolveRegistrationPolicy } = await import('../shared/registration-policy.js');
  const f = await fixture(t, { pausedVenues: deployment.vars.REGISTRATION_PAUSED_VENUES });
  let now;
  t.mock.method(Date, 'now', () => now);
  for (const [date, active] of productionClosureDates) {
    now = Date.parse(date);
    const fallback = resolveRegistrationPolicy(defaults.pausedVenues, now);
    const { json, headers } = await f.request('/status', { method: 'GET', cookie: '' });
    for (const policy of [fallback, json.registrationPolicy]) {
      assert.deepEqual(policy.basePausedVenues, ['edomex'], date);
      assert.deepEqual(policy.pausedVenues, active ? [] : ['edomex'], date);
      assert.equal(policy.temporaryOpeningActive, active, date);
      assert.equal(Date.parse(policy.temporaryOpening.startsAt), reopeningStart);
      assert.equal(Date.parse(policy.temporaryOpening.endsAt), reopeningEnd);
      assert.equal(policy.nextChangeAt == null ? null : Date.parse(policy.nextChangeAt), active ? reopeningEnd : null,
        'after midnight there is no scheduled reopening');
    }
    assert.equal(headers.get('cache-control'), 'no-store');
  }
  assertNoDeletes(f);
});

test('production closes only new ordinary and Relevé dances while prior registrations retain payment, lookup and proof access', async t => {
  const deployment = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  for (const [date, active] of productionClosureDates) {
    await t.test(date, async t => {
      const f = await fixture(t, { pausedVenues: deployment.vars.REGISTRATION_PAUSED_VENUES });
      t.mock.method(Date, 'now', () => Date.parse(date));
      const person = f.person();
      const beforeNewDance = businessSnapshot(f);
      for (const isReleve of [false, true]) {
        const result = await f.request('/dances', { body: danceBody(f, person, 'edomex', isReleve), status: active ? 201 : 403 });
        if (active) assert.equal(result.json.dance.isReleve, isReleve);
        else {
          assert.equal(result.json.error.code, 'registration_paused');
          assert.deepEqual(businessSnapshot(f), beforeNewDance);
        }
      }
      const unbilled = f.person();
      f.dance({ person: unbilled });
      for (const path of orderPaths) {
        const created = await f.request(path, { body: { curp: unbilled.curp, ...phone }, status: 201 });
        assert.equal(created.json.order.venue, 'edomex');
        assert.equal(created.json.order.status, 'pending_payment');
      }
      const unbilledReleve = f.dance({ isReleve: true });
      await f.request('/releve/orders', { cookie: '', body: {}, status: 401 });
      const listing = await f.request('/releve/orders', { body: {} });
      assert.ok(listing.json.orders.some(order => order.danceId === unbilledReleve.id), 'an existing dance can receive a new Relevé payment order after closure');
      for (const venue of ['cdmx', 'puebla', 'veracruz']) {
        const candidate = f.person();
        for (const isReleve of [false, true]) {
          const created = await f.request('/dances', { body: danceBody(f, candidate, venue, isReleve), status: 201 });
          assert.equal(created.json.dance.venue, venue);
        }
      }
      for (const path of proofPaths) {
        const owner = f.person();
        f.dance({ person: owner });
        const previous = await createExistingOrder(f, owner, { status: 'payment_reported' });
        const before = orderRow(f, previous.id);
        const login = await f.request('/student/login', { cookie: '', body: { curp: owner.curp } });
        const cookie = login.headers.get('set-cookie')?.split(';')[0];
        assert.ok(cookie);
        for (const lookupPath of lookupPaths) {
          await f.request(lookupPath, { cookie: '', body: { curp: owner.curp }, status: 401 });
          await f.request(lookupPath, { cookie: f.other.cookie, body: { curp: owner.curp }, status: 403 });
          const { json } = await f.request(lookupPath, { cookie, body: { curp: owner.curp } });
          assert.equal(json.order.id, previous.id);
          assert.equal(json.order.amount, 777);
          assert.deepEqual(orderRow(f, previous.id), before);
        }
        await f.request(path, { cookie: '', body: { curp: owner.curp, orderId: previous.id, ...proof }, status: 401 });
        await f.request(path, { cookie: f.other.cookie, body: { curp: owner.curp, orderId: previous.id, ...proof }, status: 403 });
        const uploaded = await f.request(path, { cookie, body: { curp: owner.curp, orderId: previous.id, ...proof }, status: 201 });
        assert.equal(uploaded.json.order.id, previous.id);
        assert.equal(uploaded.json.order.status, 'payment_reported');
        const after = orderRow(f, previous.id);
        for (const field of ['amount', 'paid_amount', 'line_items_json', 'buyer_phone', 'created_at']) assert.equal(after[field], before[field], field);
        const retrieved = await f.request('/inscription/payment-lookup', { cookie, body: { curp: owner.curp } });
        assert.equal(retrieved.json.order.proof.fileName, proof.fileName);
      }
      assertNoDeletes(f);
    });
  }
});

test('academy, participant and choreographer creation remain available after new Edomex dance registration closes', async t => {
  const f = await fixture(t);
  f.db.allowAcademyVenueProbe = true;
  const before = businessSnapshot(f);
  const participant = await f.request('/participants', { body: {
    fullName: 'Participante nuevo después del cierre', curp: 'NUEA100101MDFBBB01', birthDate: '2010-01-01', age: 16, division: 'teen', shirtSize: 'm',
  }, status: 201 });
  assert.ok(participant.json.participant.id);
  const choreographer = await f.request('/choreographers', { body: {
    fullName: 'Coreógrafa nueva después del cierre', email: 'nueva@example.test', phone: '5555555555', shirtSize: 'm',
  }, status: 201 });
  assert.ok(choreographer.json.choreographer.id);
  const registration = await f.request('/auth/register', { cookie: '', body: {
    name: 'Responsable después del cierre', username: 'academia-despues-cierre', email: 'academia-despues@example.test',
    password: 'ClaveDePrueba123!', academy: 'Academia nueva después del cierre', phone: '5555555555', academyState: 'guanajuato',
  }, status: 201 });
  assert.equal(registration.json.status, 'pending_email_verification');
  assert.equal(f.db.sqlite.prepare("SELECT COUNT(*) AS n FROM registration_academies WHERE name = 'Academia nueva después del cierre'").get().n, 1);
  for (const table of ['registration_dances', 'registration_dance_participants', 'registration_dance_choreographers', 'registration_inscription_orders']) {
    assert.deepEqual(businessSnapshot(f)[table], before[table], table);
  }
  assertNoDeletes(f);
});


async function paidRegistrationWithNewPendingDance(f) {
  const person = f.person();
  const paidDance = f.dance({ person, title: 'Coreografía anterior pagada' });
  const created = await f.request('/inscription/order', { body: { curp: person.curp, ...phone }, status: 201 });
  const order = created.json.order;
  await f.request('/inscription/order/proof', { body: { curp: person.curp, orderId: order.id, ...proof }, status: 201 });
  await f.request('/admin/inscription-order/status', { cookie: f.admin.cookie,
    body: { id: order.id, orderType: 'registration', status: 'paid', paidAmount: order.amount } });
  const paidSnapshot = orderRow(f, order.id);
  const pendingDance = f.dance({ person, title: 'Coreografía nueva pendiente' });
  const next = await f.request('/inscription/order', { body: { curp: person.curp, ...phone }, status: 201 });
  assert.notEqual(next.json.order.id, order.id);
  assert.equal(next.json.order.status, 'pending_payment');
  return { person, paidDance, pendingDance, paid: order, pending: next.json.order,
    paidSnapshot, pendingSnapshot: orderRow(f, next.json.order.id) };
}

test('an authorized historical order link returns its own snapshot even when a newer order exists', async t => {
  const f = await fixture(t, { pausedVenues: '' });
  t.mock.method(Date, 'now', () => Date.parse('2026-10-29T12:00:00-06:00'));
  const { person, paid, pending, paidSnapshot, pendingSnapshot } = await paidRegistrationWithNewPendingDance(f);
  const login = await f.request('/student/login', { cookie: '', body: { curp: person.curp } });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const wrongCurp = f.person();
  f.dance({ person: wrongCurp });
  const sameCurpOtherAcademy = f.person({ owner: f.other, curp: person.curp });
  f.dance({ person: sameCurpOtherAcademy, venue: 'puebla' });
  for (const path of lookupPaths) {
    const current = await f.request(path, { cookie: f.academy.cookie, body: { curp: person.curp } });
    assert.equal(current.json.order.id, pending.id, 'ordinary lookup keeps its existing latest-order behavior');
    assert.equal(Boolean(current.json.orderSnapshotOnly), false);
    if (path === '/inscription/payment-lookup') assert.equal(current.json.orderSnapshotOnly, false);
    await f.request(path, { cookie: '', body: { curp: person.curp, orderId: paid.id }, status: 401 });
    for (const ownerCookie of [f.academy.cookie, cookie]) {
      const { json } = await f.request(path, { cookie: ownerCookie, body: { curp: person.curp, orderId: paid.id } });
      assert.equal(json.order.id, paid.id);
      assert.equal(json.orderSnapshotOnly, true, 'an explicit historical link must be displayed without rebuilding its order');
      assert.equal(json.order.status, 'paid');
      assert.equal(json.order.amount, paidSnapshot.amount);
      assert.equal(json.subtotal, paidSnapshot.amount);
      assert.deepEqual(json.lines.map(line => line.title), JSON.parse(paidSnapshot.line_items_json).map(line => line.title));
      assert.equal(json.order.proof.fileName, proof.fileName);
    }
    await f.request(path, { body: { curp: wrongCurp.curp, orderId: paid.id }, status: 404 });
    await f.request(path, { cookie: f.other.cookie, body: { curp: person.curp, orderId: paid.id }, status: 403 });
  }
  assert.deepEqual(orderRow(f, paid.id), paidSnapshot, 'history lookup must not reprice or rewrite the original paid order');
  assert.deepEqual(orderRow(f, pending.id), pendingSnapshot, 'viewing history must not replace the current pending order');
  assertNoDeletes(f);
});

test('the photo and video catalog retains paid choreographies while payment lines contain only the new amount due', async t => {
  const f = await fixture(t, { pausedVenues: '' });
  t.mock.method(Date, 'now', () => Date.parse('2026-10-29T12:00:00-06:00'));
  const { person, paidDance, pendingDance, paid, pending, paidSnapshot, pendingSnapshot } = await paidRegistrationWithNewPendingDance(f);
  for (const path of lookupPaths) {
    const { json } = await f.request(path, { body: { curp: person.curp } });
    assert.equal(json.order.id, pending.id);
    assert.deepEqual(new Set(json.mediaLines.map(line => line.id)), new Set([paidDance.id, pendingDance.id]),
      'media selection must use canonical choreography IDs from both paid and pending registrations');
    assert.deepEqual(json.lines.map(line => line.title), JSON.parse(pendingSnapshot.line_items_json).map(line => line.title));
    assert.equal(json.subtotal, pendingSnapshot.amount);
  }
  const purchased = await f.request('/shop/order', { status: 201, body: {
    curp: person.curp, buyerName: 'Compradora de prueba', buyerEmail: 'foto@example.test', ...phone,
    items: [{ productId: 'photo-solos', quantity: 1, danceId: paidDance.id }],
  } });
  assert.equal(purchased.json.order.lineItems[0].danceId, paidDance.id);
  assert.match(purchased.json.order.lineItems[0].danceTitle, /Coreografía anterior pagada/);
  const unrelated = f.person({ owner: f.other });
  const unrelatedDance = f.dance({ person: unrelated });
  const rejected = await f.request('/shop/order', { status: 400, body: {
    curp: person.curp, buyerName: 'Compradora de prueba', buyerEmail: 'foto@example.test', ...phone,
    items: [{ productId: 'photo-solos', quantity: 1, danceId: unrelatedDance.id }],
  } });
  assert.equal(rejected.json.error.code, 'shop_media_dance_not_found');
  assert.deepEqual(orderRow(f, paid.id), paidSnapshot);
  assert.deepEqual(orderRow(f, pending.id), pendingSnapshot);
  assertNoDeletes(f);
});


test('an ordinary pending checkout synchronizes newly added dance lines before payment without losing notes or recorded money', async t => {
  const f = await fixture(t, { pausedVenues: '' });
  t.mock.method(Date, 'now', () => Date.parse('2026-10-29T12:00:00-06:00'));
  const person = f.person();
  const firstDance = f.dance({ person, title: 'Coreografía anterior pendiente' });
  const original = await createExistingOrder(f, person);
  f.db.sqlite.prepare('UPDATE registration_inscription_orders SET paid_amount = 100 WHERE id = ?').run(original.id);
  const before = orderRow(f, original.id);
  const addedDance = f.dance({ person, title: 'Coreografía nueva por incluir' });
  let expectedTotal;
  let expectedLines;
  for (const path of lookupPaths) {
    const { json } = await f.request(path, { body: { curp: person.curp } });
    assert.equal(json.order.id, original.id);
    assert.equal(Boolean(json.orderSnapshotOnly), false, 'a regular pending lookup is a current quote, not a frozen historical order');
    if (path === '/inscription/payment-lookup') assert.equal(json.orderSnapshotOnly, false);
    assert.equal(json.order.amount, before.amount);
    assert.ok(json.subtotal > before.amount, 'the computed quote must include the newly added choreography');
    assert.equal(json.lines.length, 2);
    assert.deepEqual(orderRow(f, original.id), before, 'reading the quote does not silently rewrite the stored payment order');
    expectedTotal = json.subtotal;
    expectedLines = json.lines.map(line => [line.title, line.amount]);
  }
  const { json } = await f.request('/inscription/payment-order', {
    body: { curp: person.curp, ...phone }, status: 201,
  });
  assert.equal(json.order.id, original.id);
  assert.equal(json.order.status, 'pending_payment');
  assert.equal(json.order.amount, expectedTotal);
  const after = orderRow(f, original.id);
  assert.equal(after.amount, expectedTotal);
  assert.deepEqual(JSON.parse(after.line_items_json).map(line => [line.title, line.amount]), expectedLines);
  assert.deepEqual(new Set(JSON.parse(after.line_items_json).map(line => line.id)), new Set([firstDance.id, addedDance.id]));
  assert.equal(after.notes, before.notes);
  assert.equal(after.paid_amount, 100, 'synchronizing the quote must preserve a partial payment already recorded');
  assert.equal(after.created_at, before.created_at);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_orders').get().n, 1);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_payment_proofs').get().n, 0);
  assertNoDeletes(f);
});
