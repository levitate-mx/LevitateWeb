import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';

const endpoint = 'https://example.test/api/registration/admin/inscription-order/notes';

async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(await readFile(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      const query = {
        bind(...bindings) { values = bindings; return query; },
        async first() { return statement.get(...values) || null; },
        async all() { return { results: statement.all(...values) }; },
        async run() {
          const result = statement.run(...values);
          return { meta: { changes: result.changes } };
        },
      };
      return query;
    },
  };
  sqlite.exec(`INSERT INTO registration_academies (id, name, contact_name, email, phone)
    VALUES ('notes-academy', 'Academia de prueba', 'Responsable de prueba', 'notes@example.test', '5555555555')`);
  const cookies = {};
  for (const role of ['admin', 'academy']) {
    const token = `synthetic-notes-session-${role}`;
    const tokenHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
    sqlite.prepare(`INSERT INTO registration_users
      (id, academy_id, name, username, email, password_hash, role, email_confirmed_at)
      VALUES (?, 'notes-academy', 'Usuario de prueba', ?, ?, 'unused-test-password', ?, '2024-01-01 00:00:00')`)
      .run(role, `notes-${role}`, `${role}@example.test`, role);
    sqlite.prepare(`INSERT INTO registration_sessions (id, user_id, session_token_hash, expires_at)
      VALUES (?, ?, ?, datetime('now', '+1 day'))`).run(`notes-${role}`, role, tokenHash);
    cookies[role] = `levitate_registration_session=${token}`;
  }
  return {
    sqlite,
    cookies,
    async save(body, { cookie = cookies.admin, method = 'POST', status = 200, path = endpoint } = {}) {
      const response = await worker.fetch(new Request(new URL(path, endpoint), {
        method,
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
        ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}),
      }), { DB: db });
      const json = await response.json();
      assert.equal(response.status, status, JSON.stringify(json));
      return json;
    },
  };
}

function seedOrder(f, orderType, status = 'paid') {
  const table = orderType === 'shop' ? 'registration_shop_orders' : 'registration_inscription_orders';
  const proofTable = orderType === 'shop' ? 'registration_shop_payment_proofs' : 'registration_inscription_payment_proofs';
  const id = 'same-order-id';
  f.sqlite.prepare(`INSERT INTO ${table}
    (id, curp, participant_name, academy_id, academy_name, venue, reference, access_token,
     amount, paid_amount, status, line_items_json, notes, paid_at, reviewed_at, reviewed_by,
     rejection_reason, rejection_message, created_at, updated_at)
    VALUES (?, 'SYNTHETIC-NOTES', 'Participante de prueba', 'notes-academy', 'Academia de prueba', 'edomex', ?, ?,
     1200, 1200, ?, ?, 'Nota anterior', ?, '2024-01-02 03:04:05', 'Revisor original', ?, ?,
     '2024-01-01 00:00:00', '2024-01-02 03:04:05')`)
    .run(id, `${orderType}-notes`, `${orderType}-private-token`, status,
      JSON.stringify([{ productId: 'full', itemType: 'ticket', quantity: 2, amount: 1200 }]),
      status === 'paid' ? '2024-01-02 03:04:05' : null,
      status === 'rejected' ? 'payment_not_found' : null,
      status === 'rejected' ? 'Revisión pendiente del comprobante original.' : null);
  f.sqlite.prepare(`INSERT INTO ${proofTable}
    (id, order_id, file_name, content_type, file_size, data_url, status, uploaded_at, created_at)
    VALUES (?, ?, 'prueba.png', 'image/png', 3, 'data:image/png;base64,AQID', 'accepted',
      '2024-01-01 02:00:00', '2024-01-01 02:00:00')`).run(`${orderType}-proof`, id);
  for (const [number, ticketStatus] of [[1, 'active'], [2, 'used']]) {
    const code = `LV-${orderType === 'shop' ? 'SHOP' : 'REGI'}-000${number}`;
    f.sqlite.prepare(`INSERT INTO registration_event_tickets
      (id, source_order_type, source_order_id, ticket_code, ticket_number, ticket_label,
       qr_payload, status, used_at, used_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Boleto de prueba', ?, ?, ?, ?, '2024-01-01 00:00:00', '2024-01-02 03:04:05')`)
      .run(`${orderType}-ticket-${number}`, orderType, id, code, number, `LEVITATE:TICKET:${code}`, ticketStatus,
        ticketStatus === 'used' ? '2024-01-02 03:04:05' : null, ticketStatus === 'used' ? 'Puerta original' : null);
  }
  return { id, table, proofTable };
}

function snapshot(f, table) {
  return f.sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all().map(row => ({ ...row }));
}

for (const orderType of ['registration', 'shop']) {
  for (const status of ['paid', 'rejected']) {
    test(`admin notes update only the ${orderType} note while preserving ${status} payment, dates, review and QR records`, async t => {
      const f = await fixture(t);
      const order = seedOrder(f, orderType, status);
      const other = seedOrder(f, orderType === 'shop' ? 'registration' : 'shop');
      const before = snapshot(f, order.table);
      const otherBefore = snapshot(f, other.table);
      const ticketsBefore = snapshot(f, 'registration_event_tickets');
      const proofsBefore = snapshot(f, order.proofTable);
      const { order: saved } = await f.save({ id: order.id, orderType, notes: '  Confirmar con administración.\nSin cambio en el pago.  ',
        status: 'pending_payment', paidAmount: 0, reviewedBy: 'No debe sobrescribir la revisión' });
      const expectedNote = 'Confirmar con administración.\nSin cambio en el pago.';
      assert.deepEqual(snapshot(f, order.table), before.map(row => ({ ...row, notes: expectedNote })));
      assert.deepEqual(snapshot(f, other.table), otherBefore, 'same id in another order type must remain unchanged');
      assert.deepEqual(snapshot(f, 'registration_event_tickets'), ticketsBefore);
      assert.deepEqual(snapshot(f, order.proofTable), proofsBefore);
      assert.equal(saved.notes, expectedNote);
      assert.equal(saved.status, status);
      assert.equal(saved.paidAmount, 1200);
      assert.equal(saved.reviewedBy, 'Revisor original');
      assert.equal(saved.reviewedAt, '2024-01-02 03:04:05');
      assert.equal(saved.updatedAt, '2024-01-02 03:04:05');
      assert.equal(saved.proof.id, `${orderType}-proof`);
      assert.equal(saved.tickets.length, 2);
      assert.deepEqual(saved.tickets.map(ticket => ticket.status), ['active', 'used']);
      const { order: cleared } = await f.save({ id: order.id, orderType, notes: '  \n  ' });
      assert.equal(cleared.notes, null);
      assert.deepEqual(snapshot(f, order.table), before.map(row => ({ ...row, notes: null })));
      assert.deepEqual(snapshot(f, 'registration_event_tickets'), ticketsBefore);
    });
  }
}

test('admin notes reject anonymous, invalid-session and academy callers before changing an order', async t => {
  const f = await fixture(t);
  const order = seedOrder(f, 'shop');
  const before = snapshot(f, order.table);
  const body = { id: order.id, orderType: 'shop', notes: 'Cambio no autorizado' };
  await f.save(body, { cookie: null, status: 401 });
  await f.save(body, { cookie: 'levitate_registration_session=invalid', status: 401 });
  await f.save(body, { cookie: f.cookies.academy, status: 403 });
  f.sqlite.exec("UPDATE registration_sessions SET expires_at = datetime('now', '-1 minute') WHERE user_id = 'admin'");
  await f.save(body, { status: 401 });
  assert.deepEqual(snapshot(f, order.table), before);
});

test('admin notes validate body, order type and note length without changing payment data', async t => {
  const f = await fixture(t);
  const order = seedOrder(f, 'registration');
  const before = snapshot(f, order.table);
  const body = { id: order.id, orderType: 'registration', notes: 'Nota válida' };
  for (const invalid of [null, [], 'nota', { ...body, id: '' }, { ...body, id: 1 },
    { ...body, orderType: undefined }, { ...body, orderType: 'other' }, { ...body, orderType: [] },
    { ...body, notes: undefined }, { ...body, notes: null }, { ...body, notes: 7 },
    { ...body, notes: {} }, { ...body, notes: [] }, { ...body, notes: 'x'.repeat(4001) }]) {
    const response = await f.save(invalid, { status: 400 });
    assert.equal(response.error.code, 'validation_error');
  }
  assert.deepEqual(snapshot(f, order.table), before);
  const { order: saved } = await f.save({ ...body, notes: 'x'.repeat(4000) });
  assert.equal(saved.notes.length, 4000);
  assert.equal(saved.status, 'paid');
  assert.equal(saved.updatedAt, before[0].updated_at);
});

test('admin notes return not found for absent orders and reject unsupported methods', async t => {
  const f = await fixture(t);
  for (const orderType of ['registration', 'shop']) {
    await f.save({ id: 'missing-order', orderType, notes: 'Nota' }, { status: 404 });
  }
  await f.save(undefined, { method: 'GET', status: 405 });
  assert.equal(f.sqlite.prepare('SELECT count(*) AS total FROM registration_event_tickets').get().total, 0);
});

test('saved internal notes remain visible to admin but are excluded from academy, student and private shop responses', async t => {
  const f = await fixture(t);
  const registration = seedOrder(f, 'registration');
  const shop = seedOrder(f, 'shop');
  const curp = 'NNNN100101MDFBBB01';
  f.sqlite.prepare('UPDATE registration_inscription_orders SET curp = ?').run(curp);
  f.sqlite.prepare(`INSERT INTO registration_participants (id, academy_id, full_name, curp, division, shirt_size)
    VALUES ('notes-student-participant', 'notes-academy', 'Participante de prueba', ?, 'teen', 'm')`).run(curp);
  const token = 'synthetic-notes-student-session';
  const tokenHash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
  f.sqlite.prepare(`INSERT INTO registration_student_users (id, username, curp)
    VALUES ('notes-student', 'notes-student', ?)`).run(curp);
  f.sqlite.prepare(`INSERT INTO registration_student_sessions (id, user_id, session_token_hash, expires_at)
    VALUES ('notes-student-session', 'notes-student', ?, datetime('now', '+1 day'))`).run(tokenHash);
  const studentCookie = `levitate_registration_student_session=${token}`;
  const readClients = async () => [
    await f.save(undefined, { path: '/api/registration/inscription/orders', method: 'GET', cookie: f.cookies.academy }),
    await f.save(undefined, { path: '/api/registration/bootstrap', method: 'GET', cookie: f.cookies.academy }),
    await f.save({ curp }, { path: '/api/registration/inscription/lookup', cookie: f.cookies.academy }),
    await f.save({ curp }, { path: '/api/registration/inscription/lookup', cookie: studentCookie }),
    await f.save({ orderId: shop.id, accessToken: 'shop-private-token' }, { path: '/api/registration/shop/order/lookup', cookie: null }),
  ];
  const assertNotesAbsent = value => {
    if (!value || typeof value !== 'object') return;
    assert.equal(Object.hasOwn(value, 'notes'), false, 'internal notes must not appear anywhere in a customer response');
    for (const nested of Object.values(value)) assertNotesAbsent(nested);
  };
  const before = await readClients();
  before.forEach(assertNotesAbsent);
  assert.equal(before[0].orders[0].id, registration.id);
  assert.equal(before[1].inscriptionOrders[0].id, registration.id);
  assert.equal(before[2].order.id, registration.id);
  assert.equal(before[3].order.id, registration.id);
  assert.equal(before[4].order.id, shop.id);
  const adminBefore = await f.save(undefined, { path: '/api/registration/admin/inscription-orders', method: 'GET' });
  assert.deepEqual(adminBefore.orders.map(order => order.notes), ['Nota anterior', 'Nota anterior']);
  for (const orderType of ['registration', 'shop']) {
    const { order } = await f.save({ id: registration.id, orderType, notes: `Nota privada de ${orderType}.` });
    assert.equal(order.notes, `Nota privada de ${orderType}.`);
  }
  const after = await readClients();
  after.forEach(assertNotesAbsent);
  assert.deepEqual(after, before, 'saving an internal note must not change any customer-visible order field');
  const adminAfter = await f.save(undefined, { path: '/api/registration/admin/inscription-orders', method: 'GET' });
  for (const order of adminAfter.orders) {
    assert.equal(order.notes, `Nota privada de ${order.orderType}.`);
  }
});

test('admin payment review responses retain internal notes for both order types', async t => {
  const f = await fixture(t);
  for (const orderType of ['registration', 'shop']) {
    const order = seedOrder(f, orderType);
    const { order: reviewed } = await f.save({ id: order.id, orderType, status: 'paid', paidAmount: 1200,
      notes: `Nota de revisión ${orderType}.` }, { path: '/api/registration/admin/inscription-order/status' });
    assert.equal(reviewed.notes, `Nota de revisión ${orderType}.`);
    assert.equal(reviewed.status, 'paid');
    assert.equal(reviewed.tickets.length, 2);
  }
});
