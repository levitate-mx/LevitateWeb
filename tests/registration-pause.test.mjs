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
    this.queries = [];
    this.writes = [];
    this.queue = Promise.resolve();
  }

  prepare(sql) {
    assert.doesNotMatch(sql, /^\s*(?:CREATE|ALTER|DROP|PRAGMA)\b/i, 'requests must not prepare schema');
    this.queries.push(sql);
    const statement = this.sqlite.prepare(sql);
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
  t.mock.method(Date, 'now', () => Date.parse('2026-10-23T12:00:00Z'));
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
      return { status: response.status, json };
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
    VALUES (?, ?, ?, ?, ?, ?, ?, 1000, 'pending_payment', ?, '+525555555555', 'No modificar ni borrar',
      '2026-10-01 12:00:00', '2026-10-01 12:00:00')`)
    .run(id, `RELEVE:${dance.id}`, dance.id, dance.owner.id, `Academia ${dance.owner.id}`, dance.venue, `REL-${dance.id}`,
      JSON.stringify([{ id: dance.id, title: `Relevé · ${dance.id}`, category: 'releve', genre: 'motion',
        venue: dance.venue, currency: 'MXN', amount: 1000 }]));
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

test('both order endpoints reject a new paused-venue order even when an allowed venue is first in a mixed lookup', async t => {
  for (const mixed of [false, true]) {
    await t.test(mixed ? 'mixed with CDMX first' : 'Edomex only', async t => {
      const f = await fixture(t);
      const person = f.person();
      f.dance({ person, venue: 'edomex', title: 'Z sede pausada', createdAt: '2026-10-20 12:00:00' });
      if (mixed) f.dance({ person, venue: 'cdmx', title: 'A sede abierta', createdAt: '2026-10-21 12:00:00' });
      const lookup = await f.request('/inscription/lookup', { body: { curp: person.curp } });
      assert.equal(lookup.json.venue, mixed ? 'cdmx' : 'edomex');
      assert.ok(lookup.json.lines.some(line => line.venue === 'edomex'));
      const before = businessSnapshot(f);
      for (const path of orderPaths) {
        const { json } = await f.request(path, { body: { curp: person.curp, ...phone }, status: 403 });
        assert.equal(json.error.code, 'registration_paused');
        assert.deepEqual(businessSnapshot(f), before);
      }
      assertNoDeletes(f);
    });
  }
});

test('a matching student session cannot create a paused order while unpaused venues and an unset flag stay available', async t => {
  const f = await fixture(t);
  const person = f.person();
  f.dance({ person });
  const cookie = await seedStudent(f.db, person.curp);
  for (const path of orderPaths) {
    const { json } = await f.request(path, { cookie, body: { curp: person.curp, ...phone }, status: 403 });
    assert.equal(json.error.code, 'registration_paused');
  }
  const allowed = f.person();
  f.dance({ person: allowed, venue: 'puebla' });
  const { json } = await f.request('/inscription/payment-order', { body: { curp: allowed.curp, ...phone }, status: 201 });
  assert.equal(json.order.venue, 'puebla');
  const open = await fixture(t, { pausedVenues: null });
  const openPerson = open.person();
  open.dance({ person: openPerson });
  const created = await open.request('/inscription/order', { body: { curp: openPerson.curp, ...phone }, status: 201 });
  assert.equal(created.json.order.venue, 'edomex');
  assertNoDeletes(f);
  assertNoDeletes(open);
});

test('existing paused orders are returned unchanged by stale checkout posts, including their phone and original line amounts', async t => {
  for (const status of ['pending_payment', 'payment_reported', 'paid', 'rejected']) {
    await t.test(status, async t => {
      const f = await fixture(t);
      const person = f.person();
      f.dance({ person });
      const existing = await createExistingOrder(f, person, { status });
      const before = orderRow(f, existing.id);
      for (const path of lookupPaths) {
        const { json } = await f.request(path, { body: { curp: person.curp } });
        assert.equal(json.order.id, existing.id);
        assert.equal(json.order.amount, 777);
        assert.equal(json.subtotal, 777);
        assert.deepEqual(json.lines.map(line => line.amount), [777]);
        assert.deepEqual(orderRow(f, existing.id), before);
      }
      for (const path of orderPaths) {
        const { json } = await f.request(path, { body: { curp: person.curp, ...phone, buyerPhoneNumber: '5512345678' }, status: 201 });
        assert.equal(json.order.id, existing.id);
        assert.equal(json.order.amount, 777);
        assert.equal(json.order.status, status);
        assert.deepEqual(orderRow(f, existing.id), before);
      }
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

test('Relevé listing keeps existing closed-venue orders, skips missing ones and still bills allowed venues', async t => {
  const f = await fixture(t);
  const existingDance = f.dance({ venue: 'edomex', isReleve: true });
  const missingDance = f.dance({ venue: 'edomex', isReleve: true });
  const allowedDance = f.dance({ venue: 'puebla', isReleve: true });
  const otherDance = f.dance({ owner: f.other, venue: 'puebla', isReleve: true });
  const id = seedReleveOrder(f, existingDance);
  const before = orderRow(f, id);
  const { json } = await f.request('/releve/orders', { body: {} });
  assert.deepEqual(new Set(json.orders.map(order => order.danceId)), new Set([existingDance.id, allowedDance.id]));
  assert.equal(json.orders.find(order => order.id === id).amount, 1000);
  assert.deepEqual(orderRow(f, id), before);
  for (const dance of [missingDance, otherDance]) {
    assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM registration_inscription_orders WHERE curp = ?')
      .get(`RELEVE:${dance.id}`).n, 0);
  }
  const proofResult = await f.request('/releve/order/proof', { body: { orderId: id, ...proof }, status: 201 });
  assert.equal(proofResult.json.order.amount, 1000);
  assert.equal(proofResult.json.order.status, 'payment_reported');
  await f.request('/releve/order/proof', { cookie: f.other.cookie, body: { orderId: id, ...proof }, status: 404 });
  assertNoDeletes(f);
});
