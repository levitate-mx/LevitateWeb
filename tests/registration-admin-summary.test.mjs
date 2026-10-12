import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { constants, DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';

const base = 'https://example.test/api/registration/admin';
const largeProof = `data:image/png;base64,${'A'.repeat(64 * 1024)}`;

async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(await readFile(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  const queries = [];
  const blobReads = [];
  // SQLite reports actual column reads, including reads hidden by SELECT *.
  sqlite.setAuthorizer((action, table, column) => {
    if (action === constants.SQLITE_READ && /registration_(?:inscription|shop)_payment_proofs/.test(table)
      && column === 'data_url') blobReads.push({ table, column });
    return constants.SQLITE_OK;
  });
  const db = {
    prepare(sql) {
      queries.push({ sql, bindings: [] });
      const recorded = queries.at(-1);
      const statement = sqlite.prepare(sql);
      let values = [];
      const query = {
        bind(...bindings) { values = bindings; recorded.bindings = bindings; return query; },
        async first() { return statement.get(...values) || null; },
        async all() { return { results: statement.all(...values) }; },
        async run() { return { meta: { changes: statement.run(...values).changes } }; },
      };
      return query;
    },
  };
  sqlite.exec(`INSERT INTO registration_academies (id, name, contact_name, email)
    VALUES ('summary-academy', 'Academia sintética', 'Contacto sintético', 'summary@example.test')`);
  const cookies = {};
  for (const role of ['admin', 'academy']) {
    const token = `synthetic-summary-session-${role}`;
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
    sqlite.prepare(`INSERT INTO registration_users
      (id, academy_id, name, username, email, password_hash, role, email_confirmed_at)
      VALUES (?, 'summary-academy', 'Usuario sintético', ?, ?, 'unused-test-password', ?, '2024-01-01 00:00:00')`)
      .run(role, `summary-${role}`, `${role}@example.test`, role);
    sqlite.prepare(`INSERT INTO registration_sessions (id, user_id, session_token_hash, expires_at)
      VALUES (?, ?, ?, datetime('now', '+1 day'))`).run(`summary-${role}`, role, hash);
    cookies[role] = `levitate_registration_session=${token}`;
  }
  return {
    sqlite, queries, blobReads, cookies,
    async request(path, { cookie = cookies.admin, status = 200, method = 'GET', body } = {}) {
      queries.length = 0;
      blobReads.length = 0;
      const response = await worker.fetch(new Request(`${base}/${path}`, {
        method,
        headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }), { DB: db });
      const json = await response.json();
      assert.equal(response.status, status, JSON.stringify(json));
      return json;
    },
  };
}

function seedOrder(f, type, index, { status = 'paid', proof = true, tickets = true } = {}) {
  const table = type === 'shop' ? 'registration_shop_orders' : 'registration_inscription_orders';
  const proofTable = type === 'shop' ? 'registration_shop_payment_proofs' : 'registration_inscription_payment_proofs';
  const id = `order-${index}`; // Deliberately shared between the two sources.
  const amount = 1000 + index;
  const paidAmount = status === 'paid' ? amount : status === 'payment_reported' ? 100 : 0;
  const lineItems = [{ productId: 'full', itemType: 'ticket', quantity: 3, amount, currency: 'MXN' }];
  f.sqlite.prepare(`INSERT INTO ${table}
    (id, curp, participant_name, academy_id, academy_name, venue, reference, access_token,
     amount, paid_amount, status, line_items_json, notes, paid_at, reviewed_by, reviewed_at,
     rejection_reason, rejection_message, buyer_phone_country_code, buyer_phone_number,
     buyer_phone, created_at, updated_at)
    VALUES (?, ?, ?, 'summary-academy', 'Academia sintética', 'edomex', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      '+52', '5555555555', '+525555555555', '2024-01-01 00:00:00', ?)`)
    .run(id, `SYNTHETIC-${type}-${index}`, `Participante ${type} ${index}`, `${type}-summary-${index}`,
      `${type}-private-${index}`, amount, paidAmount, status, JSON.stringify(lineItems), `Nota ${type} ${index}`,
      status === 'paid' ? '2024-01-02 03:04:05' : null, 'Revisor sintético', '2024-01-02 03:04:05',
      status === 'rejected' ? 'payment_not_found' : null, status === 'rejected' ? 'Revisar pago.' : null,
      index === 0 ? '2024-01-03 00:00:00' : '2024-01-02 00:00:00');
  if (proof) {
    for (const [suffix, data] of [['older', 'data:image/png;base64,AQID'], ['latest', largeProof]]) {
      f.sqlite.prepare(`INSERT INTO ${proofTable}
        (id, order_id, file_name, content_type, file_size, data_url, status, uploaded_at, created_at)
        VALUES (?, ?, ?, 'image/png', 49152, ?, 'accepted', '2024-01-01 02:00:00', '2024-01-01 02:00:00')`)
        .run(`${type}-${index}-${suffix}`, id, `${type}-${suffix}.png`, data);
    }
  }
  if (tickets) {
    // Reverse insertion order verifies the API retains ticket-number ordering.
    for (const number of [3, 1, 2]) {
      const ticketStatus = number === 1 ? 'active' : number === 2 ? 'used' : 'cancelled';
      const code = `LV-${type.toUpperCase()}-${index}-${number}`;
      f.sqlite.prepare(`INSERT INTO registration_event_tickets
        (id, source_order_type, source_order_id, ticket_code, ticket_number, ticket_label, holder_name,
         qr_payload, status, used_at, used_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2024-01-01 00:00:00', '2024-01-02 03:04:05')`)
        .run(`${type}-${index}-ticket-${number}`, type, id, code, number, `Boleto ${type} ${number}`,
          `Titular ${type}`, `LEVITATE:TICKET:${code}`, ticketStatus,
          ticketStatus === 'used' ? '2024-01-02 03:04:05' : null, ticketStatus === 'used' ? 'Puerta sintética' : null);
    }
  }
  return id;
}

function ticketQueries(f) {
  return f.queries.filter(({ sql }) => /\bFROM\s+registration_event_tickets\b/i.test(sql));
}

test('legacy admin summary reads proof metadata without blobs and preserves order values, notes, totals and tickets', async t => {
  const f = await fixture(t);
  seedOrder(f, 'registration', 0);
  seedOrder(f, 'shop', 0, { status: 'payment_reported' });
  seedOrder(f, 'registration', 1, { status: 'pending_payment', proof: false, tickets: false });
  seedOrder(f, 'shop', 1, { status: 'rejected', proof: false, tickets: false });
  const listing = await f.request('inscription-orders');
  assert.deepEqual(f.blobReads, [], 'SQLite must never read the proof blob for this listing');
  const joins = f.queries.filter(({ sql }) => /LEFT JOIN registration_(?:inscription|shop)_payment_proofs/.test(sql));
  assert.equal(joins.length, 2);
  for (const { sql } of joins) {
    assert.match(sql, /'' AS proof_data_url/);
    assert.doesNotMatch(sql, /\bpayment_proof\.(?:data_url|\*)/);
  }
  assert.equal(ticketQueries(f).length, 2);
  assert.deepEqual(listing.totals, {
    amount: 4002, count: 4, paid: 1, paidAmount: 1100, pending: 1, rejected: 1, reported: 1, withProof: 2,
  });
  assert.deepEqual(listing.orders.map(order => order.id), ['order-0', 'order-0', 'order-1', 'order-1']);
  for (const summary of listing.orders) {
    assert.equal(summary.notes, `Nota ${summary.orderType} ${summary.id.at(-1)}`);
    if (summary.id === 'order-0') {
      assert.equal(summary.proof.id, `${summary.orderType}-0-latest`, 'latest-proof rowid tie-break must be retained');
      assert.equal(summary.proof.fileName, `${summary.orderType}-latest.png`);
      assert.equal(summary.proof.dataUrl, '');
      assert.equal(summary.proof.fileSize, 49152);
      assert.equal(summary.proof.status, 'accepted');
      assert.deepEqual(summary.tickets.map(ticket => ticket.ticketNumber), [1, 2, 3]);
      assert.deepEqual(summary.tickets.map(ticket => ticket.status), ['active', 'used', 'cancelled']);
      assert.ok(summary.tickets.every(ticket => ticket.sourceOrderType === summary.orderType && ticket.sourceOrderId === summary.id));
    } else {
      assert.equal(summary.proof, null);
      assert.deepEqual(summary.tickets, []);
    }
    const { order: detail } = await f.request(`payment-order?id=${summary.id}&orderType=${summary.orderType}`);
    const { participantTickets, ...sameShape } = detail;
    assert.ok(Array.isArray(participantTickets));
    if (detail.proof) {
      assert.equal(detail.proof.dataUrl, largeProof, 'opening the order still retrieves the full proof');
      assert.ok(f.blobReads.length > 0);
      sameShape.proof = { ...sameShape.proof, dataUrl: '' };
    }
    assert.deepEqual(summary, sameShape, 'list fields must match full detail except omitted proof data');
  }
});

test('legacy admin ticket hydration stays at one query per populated source as order count grows', async t => {
  const f = await fixture(t);
  for (const type of ['registration', 'shop']) seedOrder(f, type, 0);
  const first = await f.request('inscription-orders');
  const initialQueryCount = f.queries.length;
  assert.equal(first.orders.length, 2);
  assert.equal(ticketQueries(f).length, 2);
  for (let index = 1; index < 25; index += 1) {
    for (const type of ['registration', 'shop']) seedOrder(f, type, index);
  }
  const larger = await f.request('inscription-orders');
  assert.equal(larger.orders.length, 50);
  assert.equal(f.queries.length, initialQueryCount);
  assert.deepEqual(ticketQueries(f).map(query => query.bindings[0]).sort(), ['registration', 'shop']);
  assert.deepEqual(f.blobReads, []);
  assert.ok(larger.orders.every(order => order.tickets.length === 3 && order.proof.dataUrl === ''));
  assert.equal(larger.totals.count, 50);
  assert.equal(larger.totals.withProof, 50);
});

test('empty sources and a missing legacy ticket table keep the expected empty ticket arrays', async t => {
  const f = await fixture(t);
  const empty = await f.request('inscription-orders');
  assert.deepEqual(empty.orders, []);
  assert.equal(ticketQueries(f).length, 0);
  seedOrder(f, 'shop', 0, { tickets: false });
  const singleSource = await f.request('inscription-orders');
  assert.equal(ticketQueries(f).length, 1);
  assert.deepEqual(singleSource.orders[0].tickets, []);
  f.sqlite.exec('DROP TABLE registration_event_tickets');
  const noTicketTable = await f.request('inscription-orders');
  assert.deepEqual(noTicketTable.orders, singleSource.orders);
  assert.deepEqual(noTicketTable.totals, singleSource.totals);
});

test('legacy admin summary and detail require admin auth before reading orders, proofs or tickets', async t => {
  const f = await fixture(t);
  seedOrder(f, 'registration', 0);
  for (const path of ['inscription-orders', 'payment-order?id=order-0&orderType=registration']) {
    for (const [cookie, status] of [[null, 401], ['levitate_registration_session=invalid', 401], [f.cookies.academy, 403]]) {
      await f.request(path, { cookie, status });
      assert.ok(f.queries.every(({ sql }) => !/registration_(?:inscription_orders|shop_orders|\w+_payment_proofs|event_tickets)/.test(sql)));
      assert.deepEqual(f.blobReads, []);
    }
  }
});

test('payment review responses still contain the complete proof for both order sources', async t => {
  const f = await fixture(t);
  for (const orderType of ['registration', 'shop']) {
    const id = seedOrder(f, orderType, 0);
    const { order } = await f.request('inscription-order/status', {
      method: 'POST', body: { id, orderType, status: 'paid', paidAmount: 1000, notes: 'Nota de revisión.' },
    });
    assert.equal(order.proof.dataUrl, largeProof);
    assert.equal(order.notes, 'Nota de revisión.');
    assert.equal(order.paidAmount, 1000);
    assert.equal(order.tickets.length, 3);
    assert.ok(f.blobReads.length > 0);
  }
});
