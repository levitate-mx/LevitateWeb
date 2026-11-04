import ticketEvent from "../shared/ticket-event.json" with { type: "json" };
import { accessSessions, getAccessCoverage, getAccessSessionsForEvent } from "./ticket-access.js";

const eventSnapshotSql = `
  SELECT id, name, venue, metadata_json, unique_admissions
  FROM registration_attendance_events WHERE id = ?
`;

const snapshotOutputSql = `
  SELECT
    (SELECT json_object('id', id, 'name', name, 'venue', venue,
      'metadata_json', metadata_json, 'unique_admissions', unique_admissions)
      FROM selected_event) AS event_json,
    (SELECT json_group_array(json_object('block_id', block_id, 'total', total,
      'single_count', single_count, 'day_count', day_count, 'full_count', full_count))
      FROM totals) AS totals_json,
    (SELECT json_group_array(json_object('id', id, 'name', name))
      FROM (SELECT id, name FROM registration_attendance_events ORDER BY created_at DESC, id)) AS events_json
`;

// JSON coverage is written by the scanner, but a damaged legacy row must not
// make the whole report fail or treat an object's values as ticket coverage.
const coverageArraySql = (column) => `CASE WHEN json_valid(${column})
  THEN CASE WHEN json_type(${column}) = 'array' THEN ${column} ELSE '[]' END
  ELSE '[]' END`;

const currentAttendanceSql = `
  WITH selected_event AS (${eventSnapshotSql}),
  canonical AS (
    SELECT ticket_id, pass_type, scanned_block_id, coverage_json
    FROM registration_ticket_admissions WHERE event_id = ?
  ),
  mapping AS (
    SELECT source.key AS source_id, destination.value AS session_id
    FROM json_each(?) AS source, json_each(source.value) AS destination
  ),
  original_coverage AS (
    SELECT canonical.ticket_id, canonical.pass_type, coverage.value AS source_id
    FROM canonical, json_each(${coverageArraySql("canonical.coverage_json")}) AS coverage
    WHERE NOT (canonical.pass_type = 'block'
      AND canonical.scanned_block_id IN ('bloque-4a', 'bloque-4b'))
    UNION ALL
    SELECT canonical.ticket_id, canonical.pass_type, coverage.value AS source_id
    FROM registration_ticket_access_scans AS scan
    INNER JOIN canonical ON canonical.ticket_id = scan.ticket_id
      AND canonical.pass_type = scan.pass_type
    JOIN json_each(${coverageArraySql("scan.coverage_json")}) AS coverage
    WHERE scan.event_id = ?
      AND (canonical.pass_type <> 'block' OR coverage.value = scan.access_session_id)
  ),
  covered AS (
    SELECT DISTINCT original_coverage.ticket_id, original_coverage.pass_type, mapping.session_id
    FROM original_coverage INNER JOIN mapping ON mapping.source_id = original_coverage.source_id
  ),
  totals AS (
    SELECT session_id AS block_id, COUNT(*) AS total,
      SUM(pass_type = 'block') AS single_count,
      SUM(pass_type = 'day') AS day_count, SUM(pass_type = 'full') AS full_count
    FROM covered GROUP BY session_id
  )
  ${snapshotOutputSql}
`;

// Historical events keep their own catalog and immutable original counters.
// They do not depend on today's operational sessions or the new scan ledger.
const historicalAttendanceSql = `
  WITH selected_event AS (${eventSnapshotSql}),
  totals AS (
    SELECT block_id, total, single_count, day_count, full_count
    FROM registration_attendance_blocks WHERE event_id = ?
  )
  ${snapshotOutputSql}
`;

const mapping = Object.fromEntries([...new Set([
  ...ticketEvent.blocks.map((block) => block.id),
  ...accessSessions.map((session) => session.id),
])].map((id) => [id, [...getAccessCoverage([id])]]));

export async function getTicketAttendance(db, eventId = ticketEvent.eventId) {
  // A single SELECT includes catalog, counts and event picker in the same
  // SQLite snapshot, including scans concurrent with this read. Attendance is
  // derived solely from immutable admissions, never current orders or tickets.
  const current = eventId === ticketEvent.eventId;
  const snapshot = await db.prepare(current ? currentAttendanceSql : historicalAttendanceSql)
    .bind(...(current ? [eventId, eventId, JSON.stringify(mapping), eventId] : [eventId, eventId])).first();
  const stored = snapshot?.event_json ? JSON.parse(snapshot.event_json) : null;
  if (!stored && !current) {
    const error = new Error("No se encontró el evento solicitado.");
    error.code = "attendance_event_not_found";
    error.statusCode = 404;
    throw error;
  }
  const metadata = stored ? JSON.parse(stored.metadata_json) : ticketEvent;
  const byBlock = new Map(JSON.parse(snapshot?.totals_json || "[]").map((row) => [row.block_id, row]));
  const events = JSON.parse(snapshot?.events_json || "[]");
  if (!events.some((event) => event.id === ticketEvent.eventId)) {
    events.unshift({ id: ticketEvent.eventId, name: ticketEvent.eventName });
  }
  return {
    eventId,
    eventName: stored?.name || metadata.eventName,
    venue: stored?.venue || metadata.venue,
    updatedAt: new Date().toISOString(),
    uniqueAdmissions: Number(stored?.unique_admissions || 0),
    blocks: getAccessSessionsForEvent(metadata, eventId).map((block) => {
      const total = byBlock.get(block.id);
      return {
        id: block.id, label: block.label, dayId: block.dayId, date: block.date,
        total: Number(total?.total || 0), single: Number(total?.single_count || 0),
        day: Number(total?.day_count || 0), full: Number(total?.full_count || 0),
      };
    }),
    events,
  };
}
