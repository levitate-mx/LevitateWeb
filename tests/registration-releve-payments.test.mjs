import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';

async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(await readFile(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  const db = {
    async batch(statements) { return Promise.all(statements.map(statement => statement.run())); },
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      const query = {
        bind(...bindings) { values = bindings; return query; },
        async first() { return statement.get(...values) || null; },
        async all() { return { results: statement.all(...values) }; },
        async run() { return { meta: { changes: statement.run(...values).changes } }; },
      };
      return query;
    },
  };
  const cookies = {};
  for (const [academyId, role] of [['academy-one', 'academy'], ['academy-two', 'academy'], ['global-admin', 'admin']]) {
    sqlite.prepare(`INSERT INTO registration_academies (id, name, contact_name, email)
      VALUES (?, ?, 'Responsable', ?)`).run(academyId, academyId, `${academyId}@example.test`);
    const token = `releve-session-${academyId}`;
    const tokenHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
    sqlite.prepare(`INSERT INTO registration_users
      (id, academy_id, name, username, email, password_hash, role, email_confirmed_at)
      VALUES (?, ?, 'Persona', ?, ?, 'unused', ?, '2024-01-01 00:00:00')`)
      .run(academyId, academyId, academyId, `${academyId}@example.test`, role);
    sqlite.prepare(`INSERT INTO registration_sessions (id, user_id, session_token_hash, expires_at)
      VALUES (?, ?, ?, datetime('now', '+1 day'))`).run(`session-${academyId}`, academyId, tokenHash);
    cookies[academyId] = `levitate_registration_session=${token}`;
  }
  sqlite.prepare(`INSERT INTO registration_dances
    (id, academy_id, title, genre, subgenre, is_releve, category, venue, created_at)
    VALUES ('dance-one', 'academy-one', 'Pieza de prueba', 'aereo', 'tela', 1, 'solo', 'cdmx', '2026-09-23 12:00:00')`).run();
  sqlite.prepare(`INSERT INTO registration_choreographers (id, academy_id, full_name)
    VALUES ('teacher-one', 'academy-one', 'Maestra Uno'), ('teacher-two', 'academy-one', 'Maestro Dos')`).run();

  async function request(path, { cookie = cookies['academy-one'], body = {}, method = 'POST', status = 200 } = {}) {
    const response = await worker.fetch(new Request(`https://example.test${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    }), { DB: db });
    const json = await response.json();
    assert.equal(response.status, status, JSON.stringify(json));
    return json;
  }
  return { sqlite, cookies, request };
}

test('Relevé accepts exactly one teacher and only the solo category', async t => {
  const f = await fixture(t);
  const base = {
    title: 'Relevé individual', genre: 'motion', subgenre: 'jazz', category: 'solo',
    level: null, venue: 'cdmx', choreographerIds: ['teacher-one'], participantIds: [], isReleve: true,
  };
  const none = await f.request('/api/registration/dances', { body: { ...base, choreographerIds: [] }, status: 400 });
  assert.equal(none.error.code, 'invalid_releve_choreographers');
  const multiple = await f.request('/api/registration/dances', {
    body: { ...base, choreographerIds: ['teacher-one', 'teacher-two'] }, status: 400,
  });
  assert.equal(multiple.error.code, 'invalid_releve_choreographers');

  for (const category of ['duo', 'trio', 'grupo']) {
    const result = await f.request('/api/registration/dances', { body: { ...base, category }, status: 400 });
    assert.equal(result.error.code, 'invalid_releve_category');
  }
  for (const category of ['dupla_1_aparato', 'duo_2_aparatos', 'terna_1_aparato', 'trio_3_aparatos']) {
    const result = await f.request('/api/registration/dances', {
      body: { ...base, genre: 'aereo', subgenre: 'tela', level: 'nudo', category }, status: 400,
    });
    assert.equal(result.error.code, 'invalid_releve_category');
  }

  const created = await f.request('/api/registration/dances', { body: base, status: 201 });
  assert.equal(created.dance.isReleve, true);
  assert.equal(created.dance.category, 'solo');
  assert.deepEqual(created.dance.choreographers.map(teacher => teacher.id), ['teacher-one']);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS count FROM registration_dances').get().count, 2);
});

test('Relevé creates one academy-owned order with Banamex concept and fixed presale amount', async t => {
  const f = await fixture(t);
  const first = await f.request('/api/registration/releve/orders');
  assert.equal(first.orders.length, 1);
  assert.match(first.orders[0].reference, /^REL-\d{5}$/);
  assert.equal(first.orders[0].paymentReference, first.orders[0].reference);
  assert.equal(first.orders[0].amount, 1000);
  assert.equal(first.orders[0].danceId, 'dance-one');
  const second = await f.request('/api/registration/releve/orders');
  assert.equal(second.orders[0].id, first.orders[0].id);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM registration_inscription_orders").get().count, 1);
  f.sqlite.prepare(`INSERT INTO registration_dances
    (id, academy_id, title, genre, subgenre, is_releve, category, venue, created_at)
    VALUES ('dance-after-presale', 'academy-one', 'Pieza posterior', 'aereo', 'aro', 1, 'solo', 'puebla', '2026-10-14 12:00:00')`).run();
  const later = await f.request('/api/registration/releve/orders');
  assert.equal(later.orders.find(order => order.danceId === 'dance-after-presale').amount, 1500);
  assert.notEqual(later.orders[0].reference, later.orders[1].reference);
  assert.deepEqual((await f.request('/api/registration/releve/orders', { cookie: f.cookies['academy-two'] })).orders, []);
  await f.request('/api/registration/releve/orders', { cookie: '', status: 401 });
});

test('Relevé proof stays academy-scoped and enters the admin review flow', async t => {
  const f = await fixture(t);
  const order = (await f.request('/api/registration/releve/orders')).orders[0];
  const proof = { orderId: order.id, fileName: 'comprobante.png', contentType: 'image/png', fileSize: 3, dataUrl: 'data:image/png;base64,AQID' };
  await f.request('/api/registration/releve/order/proof', { cookie: f.cookies['academy-two'], body: proof, status: 404 });
  const uploaded = await f.request('/api/registration/releve/order/proof', { body: proof, status: 201 });
  assert.equal(uploaded.order.status, 'payment_reported');
  assert.equal(uploaded.order.proof.fileName, 'comprobante.png');
  await f.request('/api/registration/releve/order/proof', { body: proof, status: 409 });
  const admin = await f.request('/api/registration/admin/inscription-orders', { cookie: f.cookies['global-admin'], method: 'GET' });
  assert.equal(admin.orders[0].paymentReference, order.reference);
  assert.equal(admin.orders[0].status, 'payment_reported');
  const rejected = await f.request('/api/registration/admin/inscription-order/status', {
    cookie: f.cookies['global-admin'],
    body: { id: order.id, orderType: 'registration', status: 'rejected', paidAmount: 0,
      rejectionReason: 'invalid_or_unreadable_proof', rejectionMessage: 'Sube un comprobante legible.', reviewedBy: 'Admin' },
  });
  assert.equal(rejected.order.status, 'rejected');
  const replacement = await f.request('/api/registration/releve/order/proof', { body: { ...proof, fileName: 'nuevo.png' }, status: 201 });
  assert.equal(replacement.order.status, 'payment_reported');
  assert.equal(replacement.order.proof.fileName, 'nuevo.png');
  const reviewed = await f.request('/api/registration/admin/inscription-order/status', {
    cookie: f.cookies['global-admin'],
    body: { id: order.id, orderType: 'registration', status: 'paid', paidAmount: 1000, reviewedBy: 'Admin' },
  });
  assert.equal(reviewed.order.status, 'paid');
  assert.equal((await f.request('/api/registration/releve/orders')).orders[0].status, 'paid');
  await f.request('/api/registration/dances?id=dance-one', { method: 'DELETE' });
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM registration_inscription_orders").get().count, 0);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM registration_inscription_payment_proofs").get().count, 0);
});
