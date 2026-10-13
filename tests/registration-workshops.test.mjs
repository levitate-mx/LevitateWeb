import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';
import { prepareRegistrationSchema } from '../scripts/lib/registration-schema.mjs';

// Actual SQLite constraints/triggers and isolated, serialized transactions model
// D1 request batches. There is no remote binding or authentication bypass.
class WorkshopD1 {
  constructor(filename = ':memory:') {
    this.sqlite = new DatabaseSync(filename);
    this.queue = Promise.resolve();
    this.queries = [];
  }

  close() { if (this.sqlite.isOpen) this.sqlite.close(); }

  prepare(sql) {
    assert.doesNotMatch(sql, /^\s*(?:CREATE|ALTER|DROP|PRAGMA)\b/i, 'HTTP requests must not prepare schema');
    this.queries.push(sql);
    const statement = this.sqlite.prepare(sql);
    let values = [];
    const execute = {
      bind(...bindings) { values = bindings; return execute; },
      async first(column) {
        const row = statement.get(...values);
        return row ? (column ? row[column] : { ...row }) : null;
      },
      async all() { return { success: true, results: statement.all(...values).map(row => ({ ...row })) }; },
      runSync() {
        if (statement.columns().length) {
          const results = statement.all(...values).map(row => ({ ...row }));
          return { success: true, results, meta: { changes: /^\s*SELECT\b/i.test(sql) ? 0 : results.length } };
        }
        const result = statement.run(...values);
        return { success: true, results: [], meta: { changes: result.changes, last_row_id: result.lastInsertRowid } };
      },
      async run() { return execute.runSync(); },
    };
    return execute;
  }

  batch(statements) {
    const result = this.queue.then(() => {
      this.beforeBatch?.();
      this.sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement, index) => {
          if (this.failBatchAt === index) {
            this.failBatchAt = null;
            throw new Error('Injected workshop batch failure');
          }
          return statement.runSync();
        });
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

function requester(db) {
  return async (path, { method = 'POST', cookie, body, status = 200, rawBody } = {}) => {
    const response = await worker.fetch(new Request(`https://example.test/api/registration${path}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined || rawBody !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : rawBody !== undefined ? { body: rawBody } : {}),
    }), { DB: db });
    const json = await response.json();
    if (status !== null) assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(json)}`);
    return { status: response.status, json, headers: response.headers };
  };
}

async function seedActor(db, id, role = 'academy') {
  db.sqlite.prepare(`INSERT INTO registration_academies(id,name,contact_name,email)
    VALUES (?, ?, 'Responsable ficticio', ?)`).run(id, `Academia ${id}`, `${id}@example.test`);
  db.sqlite.prepare(`INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,email_confirmed_at)
    VALUES (?, ?, 'Persona de prueba', ?, ?, 'fixture-no-password-login', ?, datetime('now'))`)
    .run(id, id, id, `${id}@example.test`, role);
  const token = `workshops-session-${id}`;
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  db.sqlite.prepare(`INSERT INTO registration_sessions(id,user_id,session_token_hash,expires_at)
    VALUES (?, ?, ?, datetime('now','+1 day'))`).run(`session-${id}`, id, hash);
  return { id, cookie: `levitate_registration_session=${token}` };
}

async function seedStudent(db, curp) {
  const token = `workshops-student-${curp}`;
  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  db.sqlite.prepare(`INSERT INTO registration_student_users(id,curp) VALUES (?, ?)`).run(curp, curp);
  db.sqlite.prepare(`INSERT INTO registration_student_sessions(id,user_id,session_token_hash,expires_at)
    VALUES (?, ?, ?, datetime('now','+1 day'))`).run(curp, curp, hash);
  return `levitate_registration_student_session=${token}`;
}

async function fixture(t, { filename } = {}) {
  const db = new WorkshopD1(filename);
  t.after(() => db.close());
  db.sqlite.exec(await readFile(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  const prep = {
    async read(statements) { return statements.map(sql => db.sqlite.prepare(sql).all().map(row => ({ ...row }))); },
    async write(statements) {
      db.sqlite.exec('BEGIN');
      try { for (const sql of statements) db.sqlite.exec(sql); db.sqlite.exec('COMMIT'); }
      catch (error) { db.sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  await prepareRegistrationSchema(prep, { apply: true });
  const academy = await seedActor(db, 'workshops-academy');
  const other = await seedActor(db, 'workshops-other');
  const admin = await seedActor(db, 'workshops-admin', 'admin');
  const request = requester(db);
  let participantSequence = 0;
  const f = {
    db, prep, academy, other, admin, request,
    async participant({ birthDate = '2013-11-14', venue = 'edomex', paid = true, dance = true, owner = academy, curp: explicitCurp } = {}) {
      const index = participantSequence++;
      const curp = explicitCurp || `TAA${String.fromCharCode(65 + index)}${birthDate.slice(2).replaceAll('-', '')}MDFBBB01`;
      const id = `workshop-participant-${index}`;
      db.sqlite.prepare(`INSERT INTO registration_participants(id,academy_id,full_name,curp,birth_date,age,division,shirt_size)
        VALUES (?, ?, ?, ?, ?, 99, 'teen', 'm')`).run(id, owner.id, `Participante ${index}`, curp, birthDate);
      if (dance) {
        db.sqlite.prepare(`INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,venue)
          VALUES (?, ?, 'Coreografía local', 'motion', 'jazz', 'solo', ?)`).run(`dance-${id}`, owner.id, venue);
        db.sqlite.prepare(`INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES (?, ?)`)
          .run(`dance-${id}`, id);
      }
      // Use the ordinary order flow so eligibility sees genuine registration
      // line IDs and a server-created payment amount, not invented line shapes.
      let order;
      if (dance) {
        order = (await request('/inscription/order', { cookie: owner.cookie, status: 201,
          body: { curp, buyerPhoneCountryCode: '+52', buyerPhoneNumber: '5555555555' } })).json.order;
        if (paid) {
          await request('/inscription/order/proof', { cookie: owner.cookie, status: 201,
            body: { orderId: order.id, curp, fileName: 'local.png', contentType: 'image/png', fileSize: 3, dataUrl: 'data:image/png;base64,AQID' } });
          await request('/admin/inscription-order/status', { cookie: admin.cookie,
            body: { id: order.id, orderType: 'registration', status: 'paid', paidAmount: order.amount } });
        }
      }
      return { id, curp, birthDate, order, cookie: owner.cookie };
    },
    async lookup(person, options = {}) {
      return (await request('/workshops/lookup', { cookie: person.cookie, body: { curp: person.curp }, ...options })).json.workshops;
    },
    async enroll(person, sessionIds, revision = 0, options = {}) {
      return request('/workshops/enrollment', { cookie: person.cookie, body: { curp: person.curp, sessionIds, revision }, ...options });
    },
    async adminState() { return (await request('/admin/workshops', { method: 'GET', cookie: admin.cookie })).json.workshops; },
    async capacity(sessionId, capacity, options = {}) {
      return request('/admin/workshops/capacity', { cookie: admin.cookie, body: { sessionId, capacity }, ...options });
    },
    async openAll(capacity = 20) {
      for (const session of (await f.adminState()).sessions) await f.capacity(session.id, capacity);
    },
  };
  return f;
}

const ids = view => view.sessions.filter(session => session.eligible).map(session => session.id);
const counts = view => Object.fromEntries(view.sessions.map(session => [session.id, session.enrolled]));
const localProofBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=';
const localProof = {
  fileName: 'comprobante-sintetico-local.png', contentType: 'image/png',
  fileSize: Buffer.from(localProofBase64, 'base64').length,
  dataUrl: `data:image/png;base64,${localProofBase64}`,
};
const uploadProof = (f, person, revision, options = {}) => f.request('/workshops/payment-proof', {
  cookie: person.cookie, body: { curp: person.curp, revision, ...localProof }, ...options,
});
const reviewProof = (f, person, enrollment, decision, options = {}) => f.request('/admin/workshops/payment-review', {
  cookie: f.admin.cookie, body: { curp: person.curp, revision: enrollment.revision,
    proofId: enrollment.latestProof.id, decision }, ...options,
});
function assertNoProofBlob(value) {
  assert.doesNotMatch(JSON.stringify(value), /dataUrl|data_url|data:image|data:application|iVBORw0KGgo/);
}
function storedWorkshops(db) {
  return Object.fromEntries(db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'registration_workshop%' ORDER BY name")
    .all().map(({ name }) => [name, db.sqlite.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all().map(row => ({ ...row }))]));
}

test('workshop participant access requires a current session and the exact authorized CURP', async t => {
  const f = await fixture(t);
  const person = await f.participant();
  const stranger = await f.participant({ owner: f.other });
  for (const path of ['/workshops/lookup', '/workshops/enrollment']) {
    const body = { curp: person.curp, sessionIds: [], revision: 0 };
    for (const cookie of [undefined, 'levitate_registration_session=invalid'])
      await f.request(path, { cookie, body, status: 401 });
    await f.request(path, { cookie: stranger.cookie, body, status: 403 });
  }
  const studentCookie = await seedStudent(f.db, person.curp);
  assert.equal((await f.lookup(person, { cookie: studentCookie })).participant.curp, person.curp);
  await f.lookup(stranger, { cookie: studentCookie, status: 403 });
  await f.enroll(stranger, [], 0, { cookie: studentCookie, status: 403 });
  f.db.sqlite.prepare("UPDATE registration_student_users SET status='disabled' WHERE curp=?").run(person.curp);
  await f.lookup(person, { cookie: studentCookie, status: 401 });
  f.db.sqlite.prepare("UPDATE registration_sessions SET expires_at=datetime('now','-1 day') WHERE user_id=?").run(f.academy.id);
  await f.lookup(person, { status: 401 });
});

test('legacy deployment missing student portal tables can migrate then use the public workshop CURP flow', async t => {
  const f = await fixture(t);
  const person = await f.participant();
  f.db.sqlite.exec(`
    DROP TABLE registration_student_sessions;
    DROP TABLE registration_student_users;
    DROP TABLE registration_student_resources;
  `);
  const preservedTables = ['registration_academies', 'registration_participants', 'registration_inscription_orders'];
  const snapshot = () => preservedTables.map(table => f.db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
  const before = snapshot();

  const failedLogin = await f.request('/student/login', { body: { curp: person.curp }, status: 503 });
  assert.equal(failedLogin.json.error.code, 'registration_schema_missing');
  assert.doesNotMatch(failedLogin.json.error.message, /npm|migrat|SQL/i);
  assert.equal((await prepareRegistrationSchema(f.prep)).steps.length, 6, 'read-only check must detect the missing portal tables and indexes');
  const migrated = await prepareRegistrationSchema(f.prep, { apply: true });
  assert.equal(migrated.applied, 6);
  assert.deepEqual(snapshot(), before, 'creating the student portal must preserve registrations and payments');

  const login = await f.request('/student/login', { body: { curp: person.curp } });
  assert.equal(login.json.user.curp, person.curp);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.match(cookie, /^levitate_registration_student_session=.+/);
  const view = await f.lookup(person, { cookie });
  assert.equal(view.participant.curp, person.curp);
  assert.equal(view.eligible, true);
  assert.equal(ids(view).length, 6);
  await f.lookup(person, { cookie: undefined, status: 401 });

  const portalTables = ['registration_student_users', 'registration_student_sessions', 'registration_student_resources'];
  const portalSnapshot = () => portalTables.map(table => f.db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
  const portalBefore = portalSnapshot();
  assert.equal((await prepareRegistrationSchema(f.prep, { apply: true })).applied, 0);
  assert.deepEqual(portalSnapshot(), portalBefore, 'repeat preparation preserves existing student sessions');
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(f.db.sqlite.prepare('PRAGMA foreign_key_check').all(), []);
});

test('workshop age uses the event date, including the exact thirteenth birthday', async t => {
  const f = await fixture(t);
  const young = await f.participant({ birthDate: '2013-11-14' });
  const older = await f.participant({ birthDate: '2013-11-13' });
  const youngView = await f.lookup(young);
  const olderView = await f.lookup(older);
  assert.equal(youngView.participant.age, 12);
  assert.equal(olderView.participant.age, 13);
  assert.equal(ids(youngView).length, 6);
  assert.equal(ids(olderView).length, 6);
  assert.equal(youngView.sessions.length, 10);
  assert.equal(ids(youngView).filter(id => ids(olderView).includes(id)).length, 2, 'only the two shared Flex sessions accept both ages');
  await f.openAll();
  const onlyOlder = ids(olderView).find(id => !ids(youngView).includes(id));
  const before = storedWorkshops(f.db);
  await f.enroll(young, [onlyOlder], 0, { status: 400 });
  assert.deepEqual(storedWorkshops(f.db), before);
});

test('all registered participants can enroll without a paid order or event dance; invalid dates stay rejected', async t => {
  const f = await fixture(t);
  const otherEvent = await f.participant({ venue: 'puebla' });
  const noDance = await f.participant({ dance: false });
  const unpaid = await f.participant({ paid: false });
  for (const person of [otherEvent, noDance, unpaid]) {
    const view = await f.lookup(person);
    assert.equal(view.eligible, true);
    assert.equal(view.eligibilityReason, null);
    await f.enroll(person, [ids(view)[0]]);
  }
  const person = await f.participant();
  for (const birthDate of ['2013-02-30', '2027-01-01', 'not-a-date']) {
    f.db.sqlite.prepare('UPDATE registration_participants SET birth_date=? WHERE id=?').run(birthDate, person.id);
    const view = await f.lookup(person);
    assert.equal(view.eligible, false, birthDate);
    await f.enroll(person, [view.sessions[0].id], 0, { status: 403 });
  }
});

test('one through six eligible workshops include three places and price only the extras', async t => {
  const f = await fixture(t);
  const person = await f.participant();
  await f.openAll();
  const selection = ids(await f.lookup(person));
  let revision = 0;
  for (let count = 1; count <= 6; count++) {
    const { json: { workshops: view } } = await f.enroll(person, selection.slice(0, count), revision);
    const enrollment = view.enrollment;
    assert.deepEqual([...enrollment.sessionIds].sort(), selection.slice(0, count).sort());
    assert.equal(enrollment.extraCount, Math.max(0, count - 3));
    assert.equal(enrollment.amountDue, Math.max(0, count - 3) * 200);
    assert.equal(enrollment.paidAmount, 0);
    assert.equal(enrollment.paymentStatus, count <= 3 ? 'not_required' : 'pending');
    assert.ok(enrollment.revision > revision);
    revision = enrollment.revision;
    assert.deepEqual(counts(await f.adminState()), Object.fromEntries(view.sessions.map(s => [s.id, selection.slice(0, count).includes(s.id) ? 1 : 0])));
  }
  await f.enroll(person, selection, revision);
  assert.ok(Object.values(counts(await f.adminState())).every(count => count <= 1), 'repeated enrollment never duplicates seats');
});

test('null capacity is unlimited, configured zero rejects new seats, and controls remain admin-only', async t => {
  const f = await fixture(t);
  const person = await f.participant();
  const view = await f.lookup(person);
  const [sessionId, limitedId] = ids(view);
  assert.equal(view.sessions.find(s => s.id === sessionId).capacity, null);
  assert.equal(view.sessions.find(s => s.id === sessionId).available, null);
  const first = (await f.enroll(person, [sessionId])).json.workshops.enrollment;
  for (const [cookie, status] of [[undefined, 401], [person.cookie, 403], [await seedStudent(f.db, person.curp), 401]]) {
    await f.request('/admin/workshops', { method: 'GET', cookie, status });
    await f.capacity(sessionId, 9, { cookie, status });
    await f.request('/admin/workshops/payment', { cookie, status, body: { curp: person.curp, revision: 0, paidAmount: 200 } });
  }
  await f.capacity(limitedId, 0);
  await f.enroll(person, [sessionId, limitedId], first.revision, { status: 409 });
  await f.capacity(limitedId, 1);
  await f.enroll(person, [sessionId, limitedId], first.revision);
  await f.capacity(limitedId, 0, { status: 409 });
  assert.equal((await f.adminState()).sessions.find(s => s.id === limitedId).enrolled, 1);
});

test('young and older participants share one Flex capacity pool and cannot oversubscribe it', async t => {
  const f = await fixture(t);
  const people = [await f.participant({ birthDate: '2013-11-14' }), await f.participant({ birthDate: '2013-11-13' })];
  const sessionId = ids(await f.lookup(people[0]))[0];
  assert.ok(ids(await f.lookup(people[1])).includes(sessionId));
  await f.capacity(sessionId, 1);
  const responses = await Promise.all(people.map(person => f.enroll(person, [sessionId], 0, { status: null })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const state = await f.adminState();
  assert.equal(state.sessions.find(s => s.id === sessionId).enrolled, 1);
  assert.equal(state.enrollments.filter(e => e.sessionIds.includes(sessionId)).length, 1);
  assert.equal((await f.lookup(people[responses.findIndex(r => r.status === 409)] )).enrollment, null);
});

test('concurrent requests for the same participant preserve one enrollment and reject stale edits', async t => {
  const f = await fixture(t);
  const person = await f.participant();
  await f.openAll();
  const selection = ids(await f.lookup(person));
  const responses = await Promise.all([f.enroll(person, selection.slice(0, 2), 0, { status: null }), f.enroll(person, selection.slice(2, 4), 0, { status: null })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const after = await f.lookup(person);
  assert.equal(after.enrollment.sessionIds.length, 2);
  assert.equal((await f.adminState()).enrollments.filter(e => e.curp === person.curp).length, 1);
  const before = storedWorkshops(f.db);
  await f.enroll(person, [selection[5]], 0, { status: 409 });
  assert.deepEqual(storedWorkshops(f.db), before);
});

test('a rejected replacement and an injected batch failure preserve every previous seat', async t => {
  const f = await fixture(t);
  const person = await f.participant();
  const blocker = await f.participant();
  await f.openAll(1);
  const selection = ids(await f.lookup(person));
  await f.enroll(blocker, [selection[3]]);
  const { json: { workshops: current } } = await f.enroll(person, selection.slice(0, 2));
  const before = storedWorkshops(f.db);
  await f.enroll(person, [selection[2], selection[3]], current.enrollment.revision, { status: 409 });
  assert.deepEqual(storedWorkshops(f.db), before, 'a full new session must roll back release of the original sessions');
  f.db.failBatchAt = 2;
  await f.enroll(person, [selection[2]], current.enrollment.revision, { status: 500 });
  assert.deepEqual(storedWorkshops(f.db), before, 'all writes roll back if a later SQL statement fails');
});

test('confirmed workshop payments survive selection changes and require explicit review to reduce', async t => {
  const f = await fixture(t);
  const person = await f.participant();
  await f.openAll();
  const selection = ids(await f.lookup(person));
  let view = (await f.enroll(person, selection.slice(0, 4))).json.workshops;
  await f.request('/admin/workshops/payment', { cookie: f.admin.cookie,
    body: { curp: person.curp, revision: view.enrollment.revision, paidAmount: 200 } });
  view = await f.lookup(person);
  assert.equal(view.enrollment.paidAmount, 200);
  assert.equal(view.enrollment.paymentStatus, 'paid');
  const firstAudit = f.db.sqlite.prepare('SELECT * FROM registration_workshop_payments').get();
  assert.equal(firstAudit.previous_amount, 0);
  assert.equal(firstAudit.paid_amount, 200);
  assert.equal(firstAudit.actor_id, f.admin.id);
  assert.equal(firstAudit.actor_name, 'Persona de prueba');
  view = (await f.enroll(person, selection.slice(0, 5), view.enrollment.revision)).json.workshops;
  assert.equal(view.enrollment.amountDue, 400);
  assert.equal(view.enrollment.paidAmount, 200);
  assert.equal(view.enrollment.paymentStatus, 'partial');
  const before = storedWorkshops(f.db);
  await f.enroll(person, selection.slice(0, 3), view.enrollment.revision, { status: 409 });
  assert.deepEqual(storedWorkshops(f.db), before);
  await f.request('/admin/workshops/payment', { cookie: f.admin.cookie, status: 400,
    body: { curp: person.curp, revision: view.enrollment.revision, paidAmount: 0 } });
  assert.deepEqual(storedWorkshops(f.db), before);
  await f.request('/admin/workshops/payment', { cookie: f.admin.cookie,
    body: { curp: person.curp, revision: view.enrollment.revision, paidAmount: 0, notes: 'Corrección comprobada en prueba local.' } });
  view = await f.lookup(person);
  assert.equal(view.enrollment.paidAmount, 0);
  view = (await f.enroll(person, selection.slice(0, 3), view.enrollment.revision)).json.workshops;
  assert.equal(view.enrollment.amountDue, 0);
  assert.equal(view.enrollment.paymentStatus, 'not_required');
  assert.deepEqual(view.sessions.map(session => session.enrolled), view.sessions.map(session => selection.slice(0, 3).includes(session.id) ? 1 : 0));
  const correction = f.db.sqlite.prepare('SELECT * FROM registration_workshop_payments WHERE previous_amount=200').get();
  assert.equal(correction.paid_amount, 0);
  assert.equal(correction.actor_id, f.admin.id);
  assert.equal(correction.notes, 'Corrección comprobada en prueba local.');
});

test('payment and selection edits at the same revision cannot create mismatched charges or audit duplicates', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  const selection = ids(await f.lookup(person));
  const current = (await f.enroll(person, selection.slice(0, 4))).json.workshops.enrollment;
  const before = storedWorkshops(f.db);
  for (const paidAmount of [-1, 0.5, '200', null, 201, Number.MAX_SAFE_INTEGER + 1]) {
    await f.request('/admin/workshops/payment', { cookie: f.admin.cookie, status: 400,
      body: { curp: person.curp, revision: current.revision, paidAmount } });
    assert.deepEqual(storedWorkshops(f.db), before);
  }
  const responses = await Promise.all([
    f.request('/admin/workshops/payment', { cookie: f.admin.cookie, status: null,
      body: { curp: person.curp, revision: current.revision, paidAmount: 200 } }),
    f.enroll(person, selection.slice(0, 3), current.revision, { status: null }),
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const enrollment = (await f.lookup(person)).enrollment;
  assert.equal(enrollment.revision, current.revision + 1);
  assert.ok(enrollment.paidAmount <= enrollment.amountDue);
  assert.equal(enrollment.amountDue, responses[0].status === 200 ? 200 : 0);
  assert.equal(enrollment.paidAmount, responses[0].status === 200 ? 200 : 0);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_workshop_payments').get().total,
    responses[0].status === 200 ? 1 : 0);
  const after = storedWorkshops(f.db);
  await f.request('/admin/workshops/payment', { cookie: f.admin.cookie, status: 409,
    body: { curp: person.curp, revision: current.revision, paidAmount: 200 } });
  assert.deepEqual(storedWorkshops(f.db), after);
});

test('a participant birth date changed after validation prevents the entire reservation', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  const selection = ids(await f.lookup(person));
  const before = storedWorkshops(f.db);
  f.db.beforeBatch = () => {
    f.db.beforeBatch = null;
    f.db.sqlite.prepare('UPDATE registration_participants SET birth_date=? WHERE id=?').run('2013-11-13', person.id);
  };
  await f.enroll(person, selection, 0, { status: 409 });
  assert.deepEqual(storedWorkshops(f.db), before);
  assert.equal((await f.lookup(person)).participant.age, 13);
});

test('a capacity change after validation rolls back enrollment, releases and partial new reservations', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  const selection = ids(await f.lookup(person));
  const current = (await f.enroll(person, selection.slice(0, 2))).json.workshops.enrollment;
  await f.capacity(selection[2], 1);
  await f.capacity(selection[3], 1);
  let expected;
  f.db.beforeBatch = () => {
    f.db.beforeBatch = null;
    f.db.sqlite.prepare('UPDATE registration_workshop_sessions SET capacity=0 WHERE session_id=?').run(selection[3]);
    expected = storedWorkshops(f.db);
  };
  await f.enroll(person, selection.slice(2, 4), current.revision, { status: 409 });
  assert.deepEqual(storedWorkshops(f.db), expected);
  assert.deepEqual((await f.lookup(person)).enrollment.sessionIds, selection.slice(0, 2));
});

test('malformed workshop requests do not change reservations or trust client amounts', async t => {
  const f = await fixture(t);
  const person = await f.participant();
  await f.openAll();
  const selection = ids(await f.lookup(person));
  const before = storedWorkshops(f.db);
  for (const sessionIds of [[], null, 'not-an-array', [selection[0], selection[0]], ['unknown-session'], [...selection, 'unknown-session'], [23], [null]]) {
    await f.enroll(person, sessionIds, 0, { status: 400 });
    assert.deepEqual(storedWorkshops(f.db), before);
  }
  for (const revision of [-1, 0.5, '0', null]) await f.enroll(person, [selection[0]], revision, { status: 409 });
  for (const capacity of [-1, 0.5, '2', true]) await f.capacity(selection[0], capacity, { status: 400 });
  for (const rawBody of ['null', '[]', '"text"', '12', 'true']) {
    for (const path of ['/workshops/lookup', '/workshops/enrollment'])
      await f.request(path, { cookie: person.cookie, rawBody, status: 400 });
    for (const path of ['/admin/workshops/capacity', '/admin/workshops/payment'])
      await f.request(path, { cookie: f.admin.cookie, rawBody, status: 400 });
  }
  await f.request('/workshops/lookup', { cookie: person.cookie, body: { curp: 'bad' }, status: 400 });
  await f.request('/workshops/enrollment', { cookie: person.cookie, rawBody: '{', status: 400 });
  await f.request('/workshops/enrollment', { cookie: person.cookie, method: 'GET', status: 405 });
  assert.deepEqual(storedWorkshops(f.db), before);
  const saved = await f.request('/workshops/enrollment', { cookie: person.cookie,
    body: { curp: person.curp, sessionIds: selection, revision: 0, amountDue: 0, paidAmount: 600, age: 99, eligible: true } });
  assert.equal(saved.json.workshops.enrollment.amountDue, 600);
  assert.equal(saved.json.workshops.enrollment.paidAmount, 0);
});

test('workshop enrollments and counters persist on reopen and schema preparation is idempotent', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'levitate-workshops-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = join(directory, 'workshops.sqlite');
  const f = await fixture(t, { filename });
  const person = await f.participant();
  await f.openAll();
  const selection = ids(await f.lookup(person)).slice(0, 4);
  let saved = (await f.enroll(person, selection)).json.workshops;
  saved = (await uploadProof(f, person, saved.enrollment.revision)).json.workshops;
  const before = storedWorkshops(f.db);
  const prep = await prepareRegistrationSchema(f.prep, { apply: true });
  assert.equal(prep.applied, 0);
  assert.deepEqual(storedWorkshops(f.db), before);
  f.db.close();
  const reopened = new WorkshopD1(filename);
  t.after(() => reopened.close());
  const current = (await requester(reopened)('/workshops/lookup', { cookie: person.cookie, body: { curp: person.curp } })).json.workshops;
  assert.deepEqual(current.enrollment, saved.enrollment);
  assert.deepEqual(counts(current), counts(saved));
});

test('proof migration adds its table and both indexes without changing existing workshop enrollments', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  await f.enroll(person, ids(await f.lookup(person)).slice(0, 4));
  f.db.sqlite.exec('DROP TABLE registration_workshop_payment_proofs');
  const before = storedWorkshops(f.db);
  const migrated = await prepareRegistrationSchema(f.prep, { apply: true });
  assert.equal(migrated.applied, 3);
  const after = storedWorkshops(f.db);
  assert.deepEqual(after.registration_workshop_payment_proofs, []);
  delete after.registration_workshop_payment_proofs;
  assert.deepEqual(after, before);
  const indexes = f.db.sqlite.prepare('PRAGMA index_list(registration_workshop_payment_proofs)').all();
  assert.ok(indexes.some(index => index.name === 'idx_registration_workshop_proofs_latest'));
  assert.ok(indexes.some(index => index.name === 'idx_registration_workshop_proofs_pending' && index.unique === 1 && index.partial === 1));
  assert.equal((await prepareRegistrationSchema(f.prep, { apply: true })).applied, 0);
});

test('workshop proof upload requires the exact CURP owner and proof files are admin-only', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  const stranger = await f.participant({ dance: false, paid: false, owner: f.other });
  const enrollment = (await f.enroll(person, ids(await f.lookup(person)).slice(0, 4))).json.workshops.enrollment;
  const studentCookie = await seedStudent(f.db, person.curp);
  const strangerCookie = await seedStudent(f.db, stranger.curp);
  const before = storedWorkshops(f.db);
  for (const [cookie, status] of [[undefined, 401], ['levitate_registration_session=bad', 401],
    [stranger.cookie, 403], [strangerCookie, 403]]) {
    await uploadProof(f, person, enrollment.revision, { cookie, status });
    assert.deepEqual(storedWorkshops(f.db), before);
  }
  const uploaded = (await uploadProof(f, person, enrollment.revision, { cookie: studentCookie })).json.workshops;
  const proof = uploaded.enrollment.latestProof;
  assert.equal(proof.status, 'reported');
  assert.equal(proof.amount, 200);
  assertNoProofBlob(uploaded);
  const path = `/admin/workshops/payment-proof?curp=${person.curp}&proofId=${proof.id}`;
  for (const [cookie, status] of [[undefined, 401], [person.cookie, 403], [studentCookie, 401]]) {
    await f.request(path, { method: 'GET', cookie, status });
    await reviewProof(f, person, uploaded.enrollment, 'approve', { cookie, status });
  }
  const detail = (await f.request(path, { method: 'GET', cookie: f.admin.cookie })).json.proof;
  assert.equal(detail.dataUrl, localProof.dataUrl);
  assert.equal(detail.id, proof.id);
  assert.equal(detail.fileName, localProof.fileName);
  await f.request(`/admin/workshops/payment-proof?curp=${stranger.curp}&proofId=${proof.id}`,
    { method: 'GET', cookie: f.admin.cookie, status: 404 });
  await f.request(`/admin/workshops/payment-proof?curp=${person.curp}&proofId=nonexistent-proof`,
    { method: 'GET', cookie: f.admin.cookie, status: 404 });
  f.db.queries = [];
  assertNoProofBlob(await f.lookup(person));
  assertNoProofBlob(await f.adminState());
  assert.ok(f.db.queries.every(sql => !/\bdata_url\b/i.test(sql)), 'summaries never load file data from D1');
});

test('reported proofs capture the remaining balance and lock edits until one atomic approval', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  const selection = ids(await f.lookup(person));
  let enrollment = (await f.enroll(person, selection.slice(0, 5))).json.workshops.enrollment;
  assert.match(enrollment.paymentReference, /^WS-/);
  const reference = enrollment.paymentReference;
  await f.request('/admin/workshops/payment', { cookie: f.admin.cookie,
    body: { curp: person.curp, revision: enrollment.revision, paidAmount: 200 } });
  enrollment = (await f.lookup(person)).enrollment;
  const beforeUpload = enrollment.revision;
  const upload = await uploadProof(f, person, beforeUpload, { body: {
    curp: person.curp, revision: beforeUpload, ...localProof, amount: 1, paidAmount: 999, status: 'approved',
  } });
  enrollment = upload.json.workshops.enrollment;
  assert.equal(enrollment.paymentReference, reference);
  assert.equal(enrollment.latestProof.amount, 200);
  assert.equal(enrollment.paidAmount, 200);
  assert.equal(enrollment.paymentStatus, 'reported');
  assert.ok(enrollment.revision > beforeUpload);
  const reported = storedWorkshops(f.db);
  await f.enroll(person, selection.slice(0, 6), enrollment.revision, { status: 409 });
  await f.request('/admin/workshops/payment', { cookie: f.admin.cookie, status: 409,
    body: { curp: person.curp, revision: enrollment.revision, paidAmount: 400 } });
  await uploadProof(f, person, enrollment.revision, { status: 409 });
  await reviewProof(f, person, enrollment, 'approve', { status: 404, body: {
    curp: person.curp, revision: enrollment.revision, proofId: 'not-this-proof', decision: 'approve',
  } });
  assert.deepEqual(storedWorkshops(f.db), reported);
  await reviewProof(f, person, enrollment, 'approve');
  const approved = (await f.lookup(person)).enrollment;
  assert.equal(approved.paidAmount, 400);
  assert.equal(approved.balance, 0);
  assert.equal(approved.paymentStatus, 'paid');
  assert.equal(approved.latestProof.status, 'approved');
  assert.ok(approved.latestProof.reviewedAt);
  assert.equal(approved.paymentReference, reference);
  const audit = f.db.sqlite.prepare('SELECT * FROM registration_workshop_payments WHERE previous_amount=200').all();
  assert.equal(audit.length, 1);
  assert.equal(audit[0].paid_amount, 400);
  assert.equal(audit[0].actor_id, f.admin.id);
  const after = storedWorkshops(f.db);
  await reviewProof(f, person, enrollment, 'approve', { status: 409 });
  await reviewProof(f, person, approved, 'approve', { status: 409 });
  await uploadProof(f, person, approved.revision, { status: 409 });
  assert.deepEqual(storedWorkshops(f.db), after);
});

test('rejection needs a reason, preserves the payment balance and permits a fresh proof', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  let enrollment = (await f.enroll(person, ids(await f.lookup(person)).slice(0, 4))).json.workshops.enrollment;
  enrollment = (await uploadProof(f, person, enrollment.revision)).json.workshops.enrollment;
  const reported = storedWorkshops(f.db);
  for (const notes of [undefined, '', '   ']) {
    await reviewProof(f, person, enrollment, 'reject', { status: 400, body: {
      curp: person.curp, revision: enrollment.revision, proofId: enrollment.latestProof.id, decision: 'reject', notes,
    } });
    assert.deepEqual(storedWorkshops(f.db), reported);
  }
  const oldProofId = enrollment.latestProof.id;
  await reviewProof(f, person, enrollment, 'reject', { body: {
    curp: person.curp, revision: enrollment.revision, proofId: oldProofId, decision: 'reject', notes: 'Archivo de prueba ilegible.',
  } });
  enrollment = (await f.lookup(person)).enrollment;
  assert.equal(enrollment.paidAmount, 0);
  assert.equal(enrollment.balance, 200);
  assert.equal(enrollment.paymentStatus, 'rejected');
  assert.equal(enrollment.latestProof.notes, 'Archivo de prueba ilegible.');
  assert.equal(enrollment.latestProof.status, 'rejected');
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_workshop_payments').get().total, 0);
  const retry = (await uploadProof(f, person, enrollment.revision)).json.workshops.enrollment;
  assert.notEqual(retry.latestProof.id, oldProofId);
  assert.equal(retry.paymentStatus, 'reported');
  assert.equal(retry.latestProof.amount, 200);
  await reviewProof(f, person, retry, 'approve');
  assert.equal((await f.lookup(person)).enrollment.paymentStatus, 'paid');
  const previousFile = (await f.request(`/admin/workshops/payment-proof?curp=${person.curp}&proofId=${oldProofId}`,
    { method: 'GET', cookie: f.admin.cookie })).json.proof;
  assert.equal(previousFile.status, 'rejected');
});

test('concurrent uploads and concurrent reviews create one proof and one payment only', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  const initial = (await f.enroll(person, ids(await f.lookup(person)).slice(0, 4))).json.workshops.enrollment;
  const uploads = await Promise.all([
    uploadProof(f, person, initial.revision, { status: null }),
    uploadProof(f, person, initial.revision, { status: null }),
  ]);
  assert.deepEqual(uploads.map(result => result.status).sort(), [200, 409]);
  const reported = (await f.lookup(person)).enrollment;
  const reviews = await Promise.all([
    reviewProof(f, person, reported, 'approve', { status: null }),
    reviewProof(f, person, reported, 'approve', { status: null }),
  ]);
  assert.deepEqual(reviews.map(result => result.status).sort(), [200, 409]);
  const approved = (await f.lookup(person)).enrollment;
  assert.equal(approved.paidAmount, 200);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) AS total FROM registration_workshop_payments').get().total, 1);
  assert.equal(approved.revision, initial.revision + 2);
});

test('proof upload and review failures roll back the enrollment, file and payment audit together', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  let enrollment = (await f.enroll(person, ids(await f.lookup(person)).slice(0, 4))).json.workshops.enrollment;
  const before = storedWorkshops(f.db);
  f.db.failBatchAt = 1;
  await uploadProof(f, person, enrollment.revision, { status: 500 });
  assert.deepEqual(storedWorkshops(f.db), before);
  enrollment = (await uploadProof(f, person, enrollment.revision)).json.workshops.enrollment;
  const reported = storedWorkshops(f.db);
  f.db.failBatchAt = 1;
  await reviewProof(f, person, enrollment, 'approve', { status: 500 });
  assert.deepEqual(storedWorkshops(f.db), reported);
  await reviewProof(f, person, enrollment, 'approve');
  assert.equal((await f.lookup(person)).enrollment.paymentStatus, 'paid');
});

test('proof upload racing selection or manual payment preserves one matching revision and balance', async t => {
  const f = await fixture(t);
  for (const action of ['selection', 'payment']) {
    const person = await f.participant({ dance: false, paid: false });
    const selection = ids(await f.lookup(person));
    const initial = (await f.enroll(person, selection.slice(0, 4))).json.workshops.enrollment;
    const otherRequest = () => action === 'selection'
      ? f.enroll(person, selection.slice(0, 5), initial.revision, { status: null })
      : f.request('/admin/workshops/payment', { cookie: f.admin.cookie, status: null,
        body: { curp: person.curp, revision: initial.revision, paidAmount: 200 } });
    const responses = await Promise.all([
      uploadProof(f, person, initial.revision, { status: null }), otherRequest(),
    ]);
    assert.equal(responses.filter(response => response.status === 409).length, 1);
    assert.equal(responses.filter(response => response.status === 200).length, 1);
    const enrollment = (await f.lookup(person)).enrollment;
    assert.equal(enrollment.revision, initial.revision + 1);
    assert.equal(enrollment.paymentReference, initial.paymentReference);
    if (responses[0].status === 200) {
      assert.equal(enrollment.amountDue, 200);
      assert.equal(enrollment.paidAmount, 0);
      assert.equal(enrollment.latestProof.amount, 200);
      assert.equal(enrollment.paymentStatus, 'reported');
      assert.equal(enrollment.sessionIds.length, 4);
    } else {
      assert.equal(enrollment.latestProof, null);
      assert.equal(enrollment.amountDue, action === 'selection' ? 400 : 200);
      assert.equal(enrollment.paidAmount, action === 'selection' ? 0 : 200);
    }
  }
});

test('changing a rejected enrollment resets its current payment status while retaining proof history', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  const selection = ids(await f.lookup(person));
  let enrollment = (await f.enroll(person, selection.slice(0, 4))).json.workshops.enrollment;
  const reference = enrollment.paymentReference;
  enrollment = (await uploadProof(f, person, enrollment.revision)).json.workshops.enrollment;
  const proofId = enrollment.latestProof.id;
  await reviewProof(f, person, enrollment, 'reject', { body: {
    curp: person.curp, revision: enrollment.revision, proofId, decision: 'reject', notes: 'Prueba de cambio posterior.',
  } });
  enrollment = (await f.lookup(person)).enrollment;
  enrollment = (await f.enroll(person, selection.slice(0, 5), enrollment.revision)).json.workshops.enrollment;
  assert.equal(enrollment.paymentStatus, 'pending');
  assert.equal(enrollment.amountDue, 400);
  assert.equal(enrollment.paymentReference, reference);
  const history = (await f.request(`/admin/workshops/payment-proof?curp=${person.curp}&proofId=${proofId}`,
    { method: 'GET', cookie: f.admin.cookie })).json.proof;
  assert.equal(history.status, 'rejected');
  enrollment = (await uploadProof(f, person, enrollment.revision)).json.workshops.enrollment;
  assert.equal(enrollment.latestProof.amount, 400);
  const other = await f.participant({ dance: false, paid: false });
  const otherEnrollment = (await f.enroll(other, ids(await f.lookup(other)).slice(0, 4))).json.workshops.enrollment;
  assert.notEqual(otherEnrollment.paymentReference, reference);
});

test('malformed proofs and reviews never mutate enrollments or store client-controlled payment values', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  let enrollment = (await f.enroll(person, ids(await f.lookup(person)).slice(0, 4))).json.workshops.enrollment;
  const before = storedWorkshops(f.db);
  for (const fields of [
    { fileName: '' }, { contentType: 'text/html' }, { fileSize: -1 }, { fileSize: 0.5 },
    { fileSize: 1800001 }, { dataUrl: 'https://example.test/file.png' },
    { dataUrl: 'data:application/pdf;base64,QQ==' },
    { fileSize: 1, dataUrl: `data:image/png;base64,${'A'.repeat(2400004)}` },
  ]) {
    await uploadProof(f, person, enrollment.revision, { status: 400, body: {
      curp: person.curp, revision: enrollment.revision, ...localProof, ...fields,
    } });
    assert.deepEqual(storedWorkshops(f.db), before);
  }
  for (const rawBody of ['null', '[]', 'false', '"bad"']) {
    await f.request('/workshops/payment-proof', { cookie: person.cookie, rawBody, status: 400 });
    await f.request('/admin/workshops/payment-review', { cookie: f.admin.cookie, rawBody, status: 400 });
  }
  await uploadProof(f, person, enrollment.revision + 1, { status: 409 });
  assert.deepEqual(storedWorkshops(f.db), before);
  enrollment = (await uploadProof(f, person, enrollment.revision)).json.workshops.enrollment;
  const reported = storedWorkshops(f.db);
  for (const decision of ['paid', '', null, true]) {
    await reviewProof(f, person, enrollment, decision, { status: 400 });
    assert.deepEqual(storedWorkshops(f.db), reported);
  }
  await reviewProof(f, person, enrollment, 'reject', { status: 400, body: {
    curp: person.curp, revision: enrollment.revision, proofId: enrollment.latestProof.id,
    decision: 'reject', notes: 'x'.repeat(1001),
  } });
  assert.deepEqual(storedWorkshops(f.db), reported);
});

test('workshop proofs enforce the actual 1.4 MB boundary and leave room for D1 row metadata', async t => {
  const f = await fixture(t);
  const person = await f.participant({ dance: false, paid: false });
  const enrollment = (await f.enroll(person, ids(await f.lookup(person)).slice(0, 4))).json.workshops.enrollment;
  const limit = 1_400_000;
  const makeProof = bytes => ({
    ...localProof, fileSize: bytes, dataUrl: `data:image/png;base64,${Buffer.alloc(bytes, 0x41).toString('base64')}`,
  });
  const before = storedWorkshops(f.db);
  // The claimed size cannot bypass the limit on the bytes encoded in the file.
  for (const proof of [makeProof(limit + 1), { ...makeProof(limit + 1), fileSize: 1 },
    { ...localProof, fileSize: limit + 1 }]) {
    await uploadProof(f, person, enrollment.revision, { status: 400,
      body: { curp: person.curp, revision: enrollment.revision, ...proof } });
    assert.deepEqual(storedWorkshops(f.db), before, 'oversized files must not change revision, payment or proof rows');
  }
  const boundary = makeProof(limit);
  const accepted = (await uploadProof(f, person, enrollment.revision, {
    body: { curp: person.curp, revision: enrollment.revision, ...boundary },
  })).json.workshops.enrollment;
  assert.equal(accepted.revision, enrollment.revision + 1);
  assert.equal(accepted.latestProof.fileSize, limit);
  assert.equal(accepted.paymentStatus, 'reported');
  const stored = f.db.sqlite.prepare('SELECT * FROM registration_workshop_payment_proofs WHERE id=?').get(accepted.latestProof.id);
  assert.equal(Buffer.from(stored.data_url.split(',')[1], 'base64').length, limit);
  assert.equal(stored.data_url, boundary.dataUrl);
  const encodedBytes = Buffer.byteLength(stored.data_url);
  assert.ok(encodedBytes < 1_900_000, 'base64 payload must leave at least 100 KB below the 2 MB D1 row limit');
  assert.ok(Buffer.byteLength(JSON.stringify({ ...stored, notes: 'x'.repeat(1000), reviewed_by_name: 'Admin de prueba' })) < 2_000_000,
    'the full proof row retains space for review metadata');
  assertNoProofBlob(await f.lookup(person));
  assertNoProofBlob(await f.adminState());
});
