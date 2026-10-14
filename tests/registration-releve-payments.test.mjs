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

test('unpaid Relevé orders follow both CDMX deadlines instead of their creation date', async t => {
  const f = await fixture(t);
  let now = Date.parse('2026-10-05T18:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const first = await f.request('/api/registration/releve/orders');
  assert.equal(first.orders.length, 1);
  assert.match(first.orders[0].reference, /^REL-\d{5}$/);
  assert.equal(first.orders[0].paymentReference, first.orders[0].reference);
  assert.equal(first.orders[0].amount, 1000);
  assert.equal(first.orders[0].danceId, 'dance-one');

  now = Date.parse('2026-10-06T06:00:00Z');
  const second = await f.request('/api/registration/releve/orders');
  assert.equal(second.orders[0].id, first.orders[0].id);
  assert.equal(second.orders[0].amount, 700);
  assert.equal(second.orders[0].lineItems[0].amount, 700);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM registration_inscription_orders").get().count, 1);

  f.sqlite.prepare(`INSERT INTO registration_dances
    (id, academy_id, title, genre, subgenre, is_releve, category, venue, created_at)
    VALUES ('dance-at-hot-presale-end', 'academy-one', 'Pieza al cierre de Hot Presale', 'aereo', 'aro', 1, 'solo', 'puebla', '2026-10-08 15:00:00')`).run();
  now = Date.parse('2026-10-08T16:00:00Z');
  const afterHotPresale = await f.request('/api/registration/releve/orders');
  assert.equal(afterHotPresale.orders.find(order => order.danceId === 'dance-one').amount, 1000);
  assert.equal(afterHotPresale.orders.find(order => order.danceId === 'dance-at-hot-presale-end').amount, 1000);

  f.sqlite.prepare(`INSERT INTO registration_dances
    (id, academy_id, title, genre, subgenre, is_releve, category, venue, created_at)
    VALUES ('dance-after-presale', 'academy-one', 'Pieza posterior', 'aereo', 'aro', 1, 'solo', 'puebla', '2026-10-27 12:00:00')`).run();
  now = Date.parse('2026-10-27T18:00:00Z');
  const later = await f.request('/api/registration/releve/orders');
  assert.equal(later.orders.find(order => order.danceId === 'dance-after-presale').amount, 1500);
  assert.equal(later.orders.find(order => order.danceId === 'dance-one').amount, 1500);
  assert.equal(later.orders.find(order => order.danceId === 'dance-one').lineItems[0].amount, 1500);
  assert.equal(new Set(later.orders.map(order => order.reference)).size, 3);
  assert.deepEqual((await f.request('/api/registration/releve/orders', { cookie: f.cookies['academy-two'] })).orders, []);
  await f.request('/api/registration/releve/orders', { cookie: '', status: 401 });
});

function seedReleveOrder(f, id, { status = 'pending_payment', amount = 700, proofAt, proofStatus = 'submitted', currency = 'MXN' } = {}) {
  f.sqlite.prepare(`INSERT INTO registration_inscription_orders
    (id, curp, participant_name, academy_id, academy_name, venue, reference, amount, paid_amount,
     status, line_items_json, notes, created_at, updated_at)
    VALUES (?, ?, ?, 'academy-one', 'Academia Uno', 'edomex', ?, ?, ?, ?, ?, 'Conservar nota',
      '2026-10-07 12:00:00', '2026-10-07 12:00:00')`)
    .run(id, `RELEVE:${id}`, id, `REL-${id}`, amount, status === 'paid' ? amount : 0, status,
      JSON.stringify([{ id, title: `Relevé · ${id}`, category: 'releve', genre: 'motion', currency, amount }]));
  if (proofAt) {
    f.sqlite.prepare(`INSERT INTO registration_inscription_payment_proofs
      (id, order_id, file_name, content_type, file_size, data_url, status, uploaded_at, created_at)
      VALUES (?, ?, 'pago.png', 'image/png', 3, 'data:image/png;base64,AQID', ?, ?, ?)`)
      .run(`proof-${id}`, id, proofStatus, proofAt, proofAt);
  }
}

test('the extended Relevé presale applies through October 25 CDMX without reviving the 30 percent offer', async t => {
  const f = await fixture(t);
  let now = Date.parse('2026-10-14T18:00:00Z');
  t.mock.method(Date, 'now', () => now);
  seedReleveOrder(f, 'old-hot', { status: 'rejected' });
  seedReleveOrder(f, 'old-regular', { amount: 1500 });
  seedReleveOrder(f, 'paid-hot', { status: 'paid' });
  for (const date of ['2026-10-14T18:00:00Z', '2026-10-26T05:59:59Z', '2026-10-26T06:00:00Z']) {
    now = Date.parse(date);
    const amount = date === '2026-10-26T06:00:00Z' ? 1500 : 1000;
    const { orders } = await f.request('/api/registration/inscription/orders', { method: 'GET' });
    assert.equal(orders.find(o => o.id === 'old-hot').amount, amount, date);
    assert.equal(orders.find(o => o.id === 'old-regular').amount, amount, date);
    assert.equal(orders.find(o => o.id === 'paid-hot').amount, 700, 'approved promotional payment stays unchanged');
    const newlyBilled = await f.request('/api/registration/releve/orders');
    assert.equal(newlyBilled.orders[0].amount, amount, 'new and existing orders agree');
  }
});

test('admin list, export, detail and totals refresh old orders without an academy visit', async t => {
  const f = await fixture(t);
  t.mock.method(Date, 'now', () => Date.parse('2026-10-27T18:00:00Z'));
  seedReleveOrder(f, 'pending');
  seedReleveOrder(f, 'rejected', { status: 'rejected' });
  seedReleveOrder(f, 'approved', { status: 'paid' });
  // Ordinary registrations and shop purchases do not share this price policy.
  seedReleveOrder(f, 'ordinary');
  f.sqlite.prepare("UPDATE registration_inscription_orders SET curp = 'SYNTHETIC-CURP' WHERE id = 'ordinary'").run();
  const admin = { method: 'GET', cookie: f.cookies['global-admin'] };
  const path = '/api/registration/admin/payment-orders?includeTotals=1';
  await f.request(path, { method: 'GET', cookie: '', status: 401 });
  await f.request(path, { method: 'GET', status: 403 });
  assert.equal(f.sqlite.prepare("SELECT amount FROM registration_inscription_orders WHERE id = 'pending'").get().amount, 700);
  const page = await f.request(path, admin);
  assert.deepEqual(Object.fromEntries(page.orders.map(o => [o.id, o.amount])), {
    pending: 1500, rejected: 1500, approved: 700, ordinary: 700,
  });
  assert.equal(page.totals.amount, 4400);
  assert.equal(page.totals.paidAmount, 700);
  for (const order of page.orders) assert.equal(order.lineItems[0].amount, order.amount);
  const legacy = await f.request('/api/registration/admin/inscription-orders', admin);
  assert.equal(legacy.totals.amount, page.totals.amount);
  const exported = await f.request('/api/registration/admin/payment-orders?export=1', admin);
  assert.equal(exported.orders.find(o => o.id === 'pending').amount, 1500);
  // Repeating a read does not rewrite dates, notes, paid amounts or proof data.
  f.sqlite.prepare("UPDATE registration_inscription_orders SET updated_at = '2026-10-27 12:00:00' WHERE id = 'pending'").run();
  const { order } = await f.request('/api/registration/admin/payment-order?id=pending&orderType=registration', admin);
  assert.equal(order.amount, 1500);
  assert.equal(order.updatedAt, '2026-10-27 12:00:00');
  assert.equal(order.notes, 'Conservar nota');
  assert.equal(order.paidAmount, 0);
});

test('only the latest valid submitted proof reserves the price at submission', async t => {
  const f = await fixture(t);
  t.mock.method(Date, 'now', () => Date.parse('2026-10-27T18:00:00Z'));
  const cases = [
    ['timely-hot', '2026-10-08 15:59:59', 700],
    ['hot-cutoff', '2026-10-08 16:00:00', 1000],
    ['timely-presale', '2026-10-26 05:59:59', 1000],
    ['presale-cutoff', '2026-10-26 06:00:00', 1500],
    ['late', '2026-10-27 12:00:00', 1500],
  ];
  for (const [id, proofAt] of cases) seedReleveOrder(f, id, { status: 'payment_reported', proofAt });
  seedReleveOrder(f, 'rejected-proof', { status: 'rejected', proofAt: '2026-10-07 12:00:00' });
  seedReleveOrder(f, 'missing-proof', { status: 'payment_reported' });
  seedReleveOrder(f, 'invalid-proof', { status: 'payment_reported', proofAt: '2026-10-07 12:00:00', proofStatus: 'rejected' });
  seedReleveOrder(f, 'replacement', { status: 'payment_reported', proofAt: '2026-10-07 12:00:00' });
  f.sqlite.prepare(`INSERT INTO registration_inscription_payment_proofs
    (id, order_id, file_name, content_type, file_size, data_url, uploaded_at)
    VALUES ('new-proof', 'replacement', 'nuevo.png', 'image/png', 3, 'data:image/png;base64,AQID', '2026-10-27 12:00:00')`).run();
  const listing = await f.request('/api/registration/inscription/orders', { method: 'GET' });
  for (const [id, , amount] of cases) assert.equal(listing.orders.find(o => o.id === id).amount, amount, id);
  for (const id of ['rejected-proof', 'missing-proof', 'invalid-proof', 'replacement']) {
    assert.equal(listing.orders.find(o => o.id === id).amount, 1500, id);
  }
  assert.equal(listing.orders.find(o => o.id === 'replacement').proof.id, 'new-proof');
});

test('an old dance first billed after presale and stale approvals use the current rate', async t => {
  const f = await fixture(t);
  t.mock.method(Date, 'now', () => Date.parse('2026-10-27T18:00:00Z'));
  const { orders } = await f.request('/api/registration/releve/orders');
  assert.equal(orders[0].amount, 1500, 'dance creation during presale does not reserve a price');
  seedReleveOrder(f, 'late-approval', { status: 'payment_reported', proofAt: '2026-10-27 12:00:00' });
  const rejected = await f.request('/api/registration/admin/inscription-order/status', {
    cookie: f.cookies['global-admin'], status: 400,
    body: { id: 'late-approval', status: 'paid', paidAmount: 700 },
  });
  assert.equal(rejected.error.code, 'payment_amount_incomplete');
  const approved = await f.request('/api/registration/admin/inscription-order/status', {
    cookie: f.cookies['global-admin'], body: { id: 'late-approval', status: 'paid', paidAmount: 1500 },
  });
  assert.equal(approved.order.amount, 1500);
  assert.equal(approved.order.status, 'paid');
});

test('a proof uploaded from an expired checkout updates the order before it can be approved', async t => {
  const f = await fixture(t);
  let now = Date.parse('2026-10-07T18:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const { orders: [order] } = await f.request('/api/registration/releve/orders');
  assert.equal(order.amount, 700);
  now = Date.parse('2026-10-26T06:00:00Z');
  // Simulate the database clock at submission independently of the JS clock.
  f.sqlite.exec(`CREATE TRIGGER submission_time AFTER INSERT ON registration_inscription_payment_proofs
    BEGIN UPDATE registration_inscription_payment_proofs SET uploaded_at = '2026-10-26 06:00:00' WHERE id = NEW.id; END;`);
  const uploaded = await f.request('/api/registration/releve/order/proof', {
    body: { orderId: order.id, fileName: 'pago.png', contentType: 'image/png', fileSize: 3, dataUrl: 'data:image/png;base64,AQID' }, status: 201,
  });
  assert.equal(uploaded.order.amount, 1500);
  assert.equal(uploaded.order.lineItems[0].amount, 1500);
  assert.equal(uploaded.order.status, 'payment_reported');
});

test('Relevé proof stays academy-scoped and enters the admin review flow', async t => {
  const f = await fixture(t);
  t.mock.method(Date, 'now', () => Date.parse('2026-10-05T18:00:00Z'));
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
