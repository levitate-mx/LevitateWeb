import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import ticketEvent from '../shared/ticket-event.json' with { type: 'json' };
import { getTicketSalesSummary } from '../worker/ticket-sales.js';
import { getTicketAttendance } from '../worker/ticket-attendance-report.js';

const sessionIds = ['bloque-1', 'bloque-2-3', 'bloque-4a', 'bloque-4b', 'bloque-5', 'bloque-6', 'bloque-7'];

async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(await readFile(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  const queries = [];
  const db = {
    prepare(sql) {
      assert.match(sql.trimStart(), /^(?:SELECT|WITH)\b/i, 'reports never mutate or prepare the schema');
      queries.push(sql);
      const statement = sqlite.prepare(sql);
      let bindings = [];
      return {
        bind(...values) { bindings = values; return this; },
        async first() { return statement.get(...bindings) || null; },
        async all() { return { results: statement.all(...bindings) }; },
      };
    },
  };
  return { sqlite, db, queries };
}

function seedEvent(f, { eventId = ticketEvent.eventId, catalog = ticketEvent, count = 0 } = {}) {
  f.sqlite.prepare(`INSERT INTO registration_attendance_events
    (id, name, venue, metadata_json, unique_admissions) VALUES (?, ?, ?, ?, ?)`)
    .run(eventId, catalog.eventName, catalog.venue, JSON.stringify(catalog), count);
}

function seedAdmission(f, id, { passType = 'block', scanned = 'bloque-4', coverage = ['bloque-4'],
  eventId = ticketEvent.eventId, rawCoverage } = {}) {
  f.sqlite.prepare(`INSERT INTO registration_ticket_admissions
    (id, event_id, ticket_id, pass_type, scanned_block_id, device_name, actor_type, coverage_json)
    VALUES (?, ?, ?, ?, ?, 'Dispositivo de prueba', 'scanner', ?)`)
    .run(`admission-${id}`, eventId, id, passType, scanned, rawCoverage ?? JSON.stringify(coverage));
  f.sqlite.prepare('UPDATE registration_attendance_events SET unique_admissions = unique_admissions + 1 WHERE id = ?')
    .run(eventId);
}

function seedScan(f, ticketId, sessionId, { passType = 'block', coverage = [sessionId],
  eventId = ticketEvent.eventId, rawCoverage } = {}) {
  f.sqlite.prepare(`INSERT INTO registration_ticket_access_scans
    (id, event_id, ticket_id, access_session_id, pass_type, device_name, actor_type, coverage_json)
    VALUES (?, ?, ?, ?, ?, 'Dispositivo de prueba', 'scanner', ?)`)
    .run(`scan-${eventId}-${ticketId}-${sessionId}`, eventId, ticketId, sessionId, passType,
      rawCoverage ?? JSON.stringify(coverage));
}

let orderSequence = 0;
function seedOrder(f, lines, { type = 'shop', status = 'paid', ticketStatuses,
  eventId = ticketEvent.eventId } = {}) {
  const id = `synthetic-order-${++orderSequence}`;
  const items = lines.map(line => ({ itemType: 'ticket', quantity: 1, eventId, ...line }));
  const table = type === 'shop' ? 'registration_shop_orders' : 'registration_inscription_orders';
  f.sqlite.prepare(`INSERT INTO ${table}
    (id, curp, participant_name, academy_name, venue, reference, status, line_items_json)
    VALUES (?, 'SYNTHETIC-CURP', 'Persona de ejemplo', 'Academia de ejemplo', 'edomex', ?, ?, ?)`)
    .run(id, id, status, JSON.stringify(items));
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  for (let number = 1; number <= quantity; number++) {
    const code = `${id}-${number}`;
    f.sqlite.prepare(`INSERT INTO registration_event_tickets
      (id, event_id, source_order_type, source_order_id, ticket_code, ticket_number, ticket_label, qr_payload, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Boleto de prueba', ?, ?)`)
      .run(code, eventId, type, id, code, number, `LEVITATE:TICKET:${code}`, ticketStatuses?.[number - 1] || 'active');
  }
  return id;
}

function snapshotHistory(f) {
  return JSON.stringify(['registration_attendance_events', 'registration_attendance_blocks',
    'registration_ticket_admissions', 'registration_ticket_access_scans'].map(table =>
    f.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
}

function block(report, id) { return report.blocks.find(item => item.id === id); }
function checkCounters(report) {
  for (const row of report.blocks) {
    assert.ok(Number.isInteger(row.total));
    assert.ok(row.total <= report.uniqueAdmissions);
    assert.equal(row.total, row.single + row.day + row.full);
  }
}

test('sales projects original paid entitlements per QR without double-counting the merged session', async t => {
  const f = await fixture(t);
  seedEvent(f); // Stored original metadata must also use today's operational sessions.
  seedOrder(f, [
    { productId: 'ticket-block', optionId: 'bloque-2' },
    { productId: 'ticket-block', optionId: 'bloque-3' },
    { productId: 'ticket-block', optionId: 'bloque-4' },
    { productId: 'ticket-day-pass', optionId: 'sabado-14' },
    { productId: 'ticket-full-pass' },
  ]);
  seedOrder(f, [{ productId: 'ticket-block', optionId: 'bloque-4', quantity: 3 }], {
    type: 'registration', ticketStatuses: ['cancelled', 'active', 'used'],
  });
  seedOrder(f, [{ productId: 'ticket-full-pass' }], { status: 'pending_payment' });
  seedOrder(f, [{ productId: 'ticket-block', optionId: 'unknown' }]);
  const before = snapshotHistory(f);
  const report = await getTicketSalesSummary(f.db);
  assert.equal(report.uniqueTickets, 8);
  assert.equal(report.unassignedTickets, 1);
  assert.deepEqual(report.blocks.map(row => row.id), sessionIds);
  assert.deepEqual(report.blocks.map(row => row.total), [2, 4, 5, 5, 1, 1, 1]);
  assert.deepEqual([block(report, 'bloque-2-3').single, block(report, 'bloque-2-3').day,
    block(report, 'bloque-2-3').full], [2, 1, 1]);
  assert.equal(snapshotHistory(f), before);
});

test('sales for another event uses its stored original catalog without operational projection', async t => {
  const f = await fixture(t);
  const eventId = 'historical-edomex';
  const catalog = { ...ticketEvent, eventId, eventName: 'Evento histórico', capacityPerBlock: 321 };
  seedEvent(f, { eventId, catalog });
  seedOrder(f, [{ productId: 'ticket-block', optionId: 'bloque-4' },
    { productId: 'ticket-day-pass', optionId: 'sabado-14' }], { eventId });
  const report = await getTicketSalesSummary(f.db, eventId);
  assert.equal(report.capacityPerBlock, 321);
  assert.equal(report.eventName, 'Evento histórico');
  assert.deepEqual(report.blocks.map(row => row.id), ticketEvent.blocks.map(row => row.id));
  assert.deepEqual(report.blocks.map(row => row.total), [1, 1, 1, 2, 0, 0, 0]);
});

test('legacy attendance projects old Single4 to both parts and deduplicates Day/Full merged rights', async t => {
  const f = await fixture(t);
  seedEvent(f);
  seedAdmission(f, 'single2', { scanned: 'bloque-2', coverage: ['bloque-2'] });
  seedAdmission(f, 'single3', { scanned: 'bloque-3', coverage: ['bloque-3'] });
  seedAdmission(f, 'legacy4');
  seedAdmission(f, 'day', { passType: 'day', scanned: 'bloque-2', coverage: ticketEvent.days[0].blockIds });
  seedAdmission(f, 'full', { passType: 'full', scanned: 'bloque-7', coverage: ticketEvent.blocks.map(row => row.id) });
  // Existing original counters remain untouched; current projection reads the
  // canonical admissions so merged 2+3 never adds Day/Full twice.
  f.sqlite.prepare(`INSERT INTO registration_attendance_blocks
    (event_id, block_id, total, single_count) VALUES (?, 'bloque-4', 1, 1)`).run(ticketEvent.eventId);
  const before = snapshotHistory(f);
  const report = await getTicketAttendance(f.db);
  assert.equal(f.queries.length, 1, 'catalog, unique count, session counts and event list share one snapshot');
  assert.equal(report.uniqueAdmissions, 5);
  assert.deepEqual(report.blocks.map(row => row.id), sessionIds);
  assert.deepEqual(report.blocks.map(row => row.total), [2, 4, 3, 3, 1, 1, 1]);
  assert.deepEqual([block(report, 'bloque-2-3').single, block(report, 'bloque-2-3').day,
    block(report, 'bloque-2-3').full], [2, 1, 1]);
  checkCounters(report);
  assert.equal(snapshotHistory(f), before);
});

test('a newly scanned Single4 counts only the scanned part until the same QR enters the other part', async t => {
  const f = await fixture(t);
  seedEvent(f);
  seedAdmission(f, 'new4', { scanned: 'bloque-4a' });
  seedScan(f, 'new4', 'bloque-4a');
  let report = await getTicketAttendance(f.db);
  assert.equal(report.uniqueAdmissions, 1);
  assert.equal(block(report, 'bloque-4a').total, 1);
  assert.equal(block(report, 'bloque-4b').total, 0);
  seedScan(f, 'new4', 'bloque-4b');
  report = await getTicketAttendance(f.db);
  assert.equal(report.uniqueAdmissions, 1, 'two parts are still one canonical QR admission');
  assert.equal(block(report, 'bloque-4a').total, 1);
  assert.equal(block(report, 'bloque-4b').total, 1);
  checkCounters(report);
});

test('canonical and operational coverage union once per QR, including duplicate merged source blocks', async t => {
  const f = await fixture(t);
  seedEvent(f);
  seedAdmission(f, 'day', { passType: 'day', scanned: 'bloque-2-3', coverage: ticketEvent.days[0].blockIds });
  seedScan(f, 'day', 'bloque-2-3', { passType: 'day', coverage: ['bloque-1', 'bloque-2-3', 'bloque-4a', 'bloque-4b'] });
  seedScan(f, 'day', 'bloque-4a', { passType: 'day', coverage: ['bloque-1', 'bloque-2', 'bloque-3', 'bloque-4', 'bloque-4a'] });
  const report = await getTicketAttendance(f.db);
  assert.equal(report.uniqueAdmissions, 1);
  assert.deepEqual(report.blocks.map(row => row.total), [1, 1, 1, 1, 0, 0, 0]);
  assert.deepEqual(report.blocks.map(row => row.day), [1, 1, 1, 1, 0, 0, 0]);
  checkCounters(report);
});

test('orphan, cross-event, mismatched-type and unscanned Single4 ledger coverage cannot add attendance', async t => {
  const f = await fixture(t);
  seedEvent(f);
  seedEvent(f, { eventId: 'other' });
  seedAdmission(f, 'new4', { scanned: 'bloque-4b' });
  seedScan(f, 'new4', 'bloque-4b', { coverage: ['bloque-4a', 'bloque-4b', 'unknown'] });
  seedScan(f, 'orphan', 'bloque-4a');
  seedScan(f, 'new4', 'bloque-1', { passType: 'full', coverage: sessionIds });
  seedScan(f, 'new4', 'bloque-4a', { eventId: 'other' });
  const report = await getTicketAttendance(f.db);
  assert.equal(report.uniqueAdmissions, 1);
  assert.deepEqual(report.blocks.map(row => row.total), [0, 0, 0, 1, 0, 0, 0]);
  checkCounters(report);
});

test('attendance survives deleted tickets and orders because canonical and scan history are independent', async t => {
  const f = await fixture(t);
  seedEvent(f);
  const id = seedOrder(f, [{ productId: 'ticket-block', optionId: 'bloque-4' }]);
  seedAdmission(f, `${id}-1`, { scanned: 'bloque-4b' });
  seedScan(f, `${id}-1`, 'bloque-4b');
  f.sqlite.prepare('DELETE FROM registration_event_tickets WHERE source_order_id = ?').run(id);
  f.sqlite.prepare('DELETE FROM registration_shop_orders WHERE id = ?').run(id);
  const report = await getTicketAttendance(f.db);
  assert.equal(report.uniqueAdmissions, 1);
  assert.equal(block(report, 'bloque-4b').total, 1);
  assert.equal(block(report, 'bloque-4a').total, 0);
});

test('invalid coverage JSON is ignored without failing or interpreting object values as coverage', async t => {
  const f = await fixture(t);
  seedEvent(f);
  seedAdmission(f, 'malformed', { rawCoverage: 'not-json' });
  seedAdmission(f, 'object', { rawCoverage: '{"a":"bloque-4"}' });
  seedAdmission(f, 'new4', { scanned: 'bloque-4a' });
  seedScan(f, 'new4', 'bloque-4a', { rawCoverage: '{' });
  const report = await getTicketAttendance(f.db);
  assert.equal(report.uniqueAdmissions, 3);
  assert.ok(report.blocks.every(row => row.total === 0));
});

test('another event reads its original counters and metadata without the new ledger table', async t => {
  const f = await fixture(t);
  const eventId = 'historical-edomex';
  const catalog = { ...ticketEvent, eventId, eventName: 'Histórico conservado' };
  seedEvent(f, { eventId, catalog, count: 4 });
  f.sqlite.prepare(`INSERT INTO registration_attendance_blocks
    (event_id, block_id, total, single_count, day_count, full_count) VALUES (?, 'bloque-4', 4, 2, 1, 1)`)
    .run(eventId);
  f.sqlite.exec('DROP TABLE registration_ticket_access_scans');
  const report = await getTicketAttendance(f.db, eventId);
  assert.equal(f.queries.length, 1);
  assert.doesNotMatch(f.queries[0], /registration_ticket_access_scans/);
  assert.equal(report.eventName, 'Histórico conservado');
  assert.equal(report.uniqueAdmissions, 4);
  assert.deepEqual(report.blocks.map(row => row.id), ticketEvent.blocks.map(row => row.id));
  assert.equal(block(report, 'bloque-4').total, 4);
  assert.equal(block(report, 'bloque-4a'), undefined);
  assert.deepEqual(report.events.map(event => event.id), [ticketEvent.eventId, eventId]);
  checkCounters(report);
});

test('empty current event returns seven operational zero counters and unknown events return 404', async t => {
  const f = await fixture(t);
  const report = await getTicketAttendance(f.db);
  assert.equal(f.queries.length, 1);
  assert.equal(report.uniqueAdmissions, 0);
  assert.deepEqual(report.blocks.map(row => row.id), sessionIds);
  assert.ok(report.blocks.every(row => row.total === 0 && row.single === 0 && row.day === 0 && row.full === 0));
  assert.deepEqual(report.events, [{ id: ticketEvent.eventId, name: ticketEvent.eventName }]);
  for (const read of [getTicketAttendance, getTicketSalesSummary]) {
    await assert.rejects(read(f.db, 'not-an-event'), error => error.statusCode === 404);
  }
});
