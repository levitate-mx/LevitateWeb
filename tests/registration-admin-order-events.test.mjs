import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { getAdminOrderPage, readAdminOrderFilters } from '../worker/admin-orders.js';

class LocalD1 {
  constructor() {
    this.sqlite = new DatabaseSync(':memory:');
    for (const table of ['registration_inscription_orders', 'registration_shop_orders']) {
      this.sqlite.exec(`CREATE TABLE ${table} (
        id TEXT PRIMARY KEY,
        event_id TEXT,
        venue TEXT NOT NULL,
        reference TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    }
  }

  prepare(sql) {
    const query = this.sqlite.prepare(sql);
    let values = [];
    const statement = {
      bind(...nextValues) {
        values = nextValues;
        return statement;
      },
      async first() {
        const row = query.get(...values);
        return row ? { ...row } : null;
      },
      async all() {
        return { results: query.all(...values).map((row) => ({ ...row })) };
      },
    };
    return statement;
  }
}

const serialize = (orderType, row) => ({
  id: row.id,
  orderType,
  eventId: row.event_id || ({ cdmx: 'cdmx-2026', veracruz: 'orizaba-2027' })[row.venue] || '',
  venue: row.venue,
  reference: row.reference,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function seedOrders(db) {
  for (const table of ['registration_inscription_orders', 'registration_shop_orders']) {
    const insert = db.sqlite.prepare(`INSERT INTO ${table}
      (id, event_id, venue, reference, created_at, updated_at)
      VALUES (?, ?, ?, ?, '2026-11-24 00:00:00', '2026-11-24 00:00:00')`);
    const suffix = table === 'registration_shop_orders' ? 'shop' : 'registration';
    insert.run(`legacy-${suffix}`, null, 'cdmx', `LEGACY-${suffix}`);
    insert.run(`cdmx-2026-${suffix}`, 'cdmx-2026', 'cdmx', `CDMX26-${suffix}`);
    insert.run(`cdmx-2027-${suffix}`, 'cdmx-2027', 'cdmx', `CDMX27-${suffix}`);
    insert.run(`orizaba-2027-${suffix}`, 'orizaba-2027', 'veracruz', `ORIZABA27-${suffix}`);
  }
}

async function readPage(db, query) {
  return getAdminOrderPage(db, new URLSearchParams(`${query}&includeCount=0&pageSize=25`), serialize);
}

test('admin payment filters keep the two CDMX editions isolated', async (t) => {
  const db = new LocalD1();
  t.after(() => db.sqlite.close());
  seedOrders(db);

  const historical = await readPage(db, 'venue=cdmx');
  assert.deepEqual(new Set(historical.orders.map((order) => order.id)), new Set([
    'legacy-registration',
    'legacy-shop',
    'cdmx-2026-registration',
    'cdmx-2026-shop',
  ]));
  assert.ok(historical.orders.every((order) => order.eventId === 'cdmx-2026'));

  const nextEdition = await readPage(db, 'venue=cdmx-2027');
  assert.deepEqual(new Set(nextEdition.orders.map((order) => order.id)), new Set([
    'cdmx-2027-registration',
    'cdmx-2027-shop',
  ]));
  assert.ok(nextEdition.orders.every((order) => order.eventId === 'cdmx-2027'));
});

test('admin payment search accepts the new event key without relabeling the physical venue', async (t) => {
  const db = new LocalD1();
  t.after(() => db.sqlite.close());
  seedOrders(db);

  const result = await readPage(db, 'q=cdmx-2027');
  assert.deepEqual(new Set(result.orders.map((order) => order.id)), new Set([
    'cdmx-2027-registration',
    'cdmx-2027-shop',
  ]));
  assert.ok(result.orders.every((order) => order.venue === 'cdmx'));
});

test('admin payment validation recognizes CDMX 2027 as a separate filter', () => {
  assert.equal(readAdminOrderFilters(new URLSearchParams('venue=cdmx-2027')).venue, 'cdmx-2027');
  assert.throws(
    () => readAdminOrderFilters(new URLSearchParams('venue=cdmx-2028')),
    (error) => error.statusCode === 400 && error.code === 'invalid_order_pagination',
  );
});
