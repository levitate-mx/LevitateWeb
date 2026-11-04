import ticketEvent from "../shared/ticket-event.json" with { type: "json" };
import { getAccessCoverage, isSplitAccessSession } from "./ticket-access.js";

export { ticketEvent };
export { getTicketAttendance } from "./ticket-attendance-report.js";

// A session scan and its first global redemption commit in the same transaction.
// Only the attempt that inserts the canonical admission may issue a wristband,
// increment the original seven counters or mark the QR used for the first time.
export async function recordTicketAdmission(db, {
  ticket, order, orderTable, passType, dayId, accessSession, coverage, usedBy, device, actorId,
}) {
  const scanId = crypto.randomUUID();
  const admittedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
  const splitAccess = isSplitAccessSession(accessSession) && coverage.includes("bloque-4");
  const operationalCoverage = passType === "block" && splitAccess
    ? [accessSession.id]
    : getAccessCoverage(coverage);
  const sourceBlockId = passType === "block" ? coverage[0] || null : null;
  const eligible = `
    SELECT ticket.id FROM registration_event_tickets AS ticket
    INNER JOIN ${orderTable} AS source_order ON source_order.id = ticket.source_order_id
    WHERE ticket.id = ? AND ticket.ticket_number = ? AND ticket.event_id = ?
      AND ticket.source_order_type = ? AND ticket.source_order_id = ?
      AND source_order.status = 'paid' AND source_order.line_items_json = ?
      AND (
        (ticket.status = 'active' AND NOT EXISTS (
          SELECT 1 FROM registration_ticket_admissions previous
          WHERE previous.event_id = ticket.event_id AND previous.ticket_id = ticket.id
        ))
        OR (ticket.status = 'used' AND ? = 1 AND EXISTS (
          SELECT 1 FROM registration_ticket_admissions previous
          WHERE previous.event_id = ticket.event_id AND previous.ticket_id = ticket.id
            AND previous.pass_type = ? AND previous.scanned_block_id != 'bloque-4'
            AND json_type(CASE WHEN json_valid(previous.coverage_json) THEN previous.coverage_json ELSE '[]' END) = 'array'
            AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(previous.coverage_json) THEN previous.coverage_json ELSE '[]' END)
              WHERE value = 'bloque-4')
        ))
      )
  `;
  const eligibleParams = [ticket.id, ticket.ticket_number, ticketEvent.eventId, ticket.source_order_type,
    ticket.source_order_id, order.line_items_json, splitAccess ? 1 : 0, passType];
  const actor = [device?.id || null, device?.name || "Administración", device ? "scanner" : "admin", actorId || device?.id || null];
  const counts = ticketEvent.blocks.map((block) => ({
    id: block.id,
    total: Number(coverage.includes(block.id)),
    single: Number(passType === "block" && coverage.includes(block.id)),
    day: Number(passType === "day" && coverage.includes(block.id)),
    full: Number(passType === "full" && coverage.includes(block.id)),
  }));
  const results = await db.batch([
    db.prepare(`
      INSERT INTO registration_attendance_events(id, name, venue, metadata_json)
      SELECT ?, ?, ?, ? WHERE EXISTS (${eligible})
      ON CONFLICT(id) DO NOTHING
    `).bind(ticketEvent.eventId, ticketEvent.eventName, ticketEvent.venue, JSON.stringify(ticketEvent), ...eligibleParams),
    db.prepare(`
      INSERT INTO registration_ticket_access_scans
        (id, event_id, ticket_id, access_session_id, pass_type, day_id, source_block_id,
          device_id, device_name, actor_type, actor_id, coverage_json, admitted_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (${eligible})
      ON CONFLICT(event_id, ticket_id, access_session_id) DO NOTHING
    `).bind(scanId, ticketEvent.eventId, ticket.id, accessSession.id, passType, dayId || null, sourceBlockId,
      ...actor, JSON.stringify(operationalCoverage), admittedAt, ...eligibleParams),
    db.prepare(`
      INSERT INTO registration_ticket_admissions
        (id, event_id, ticket_id, pass_type, day_id, scanned_block_id, device_id, device_name, actor_type, actor_id, coverage_json, admitted_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM registration_ticket_access_scans WHERE id = ?)
        AND NOT EXISTS (SELECT 1 FROM registration_ticket_admissions WHERE event_id = ? AND ticket_id = ?)
      ON CONFLICT(event_id, ticket_id) DO NOTHING
    `).bind(scanId, ticketEvent.eventId, ticket.id, passType, dayId || null, accessSession.id,
      ...actor, JSON.stringify(coverage), admittedAt, scanId, ticketEvent.eventId, ticket.id),
    db.prepare(`
      INSERT INTO registration_attendance_blocks(event_id, block_id, total, single_count, day_count, full_count)
      SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.total'),
        json_extract(value, '$.single'), json_extract(value, '$.day'), json_extract(value, '$.full')
      FROM json_each(?) WHERE EXISTS (SELECT 1 FROM registration_ticket_admissions WHERE id = ?)
      ON CONFLICT(event_id, block_id) DO UPDATE SET
        total = total + excluded.total,
        single_count = single_count + excluded.single_count,
        day_count = day_count + excluded.day_count,
        full_count = full_count + excluded.full_count
      WHERE excluded.total > 0
    `).bind(ticketEvent.eventId, JSON.stringify(counts), scanId),
    db.prepare(`
      UPDATE registration_attendance_events
      SET unique_admissions = unique_admissions + 1, updated_at = ?
      WHERE id = ? AND EXISTS (SELECT 1 FROM registration_ticket_admissions WHERE id = ?)
    `).bind(admittedAt, ticketEvent.eventId, scanId),
    db.prepare(`
      UPDATE registration_event_tickets
      SET status = 'used', used_at = ?, used_by = ?, updated_at = ?
      WHERE id = ? AND status = 'active'
        AND EXISTS (SELECT 1 FROM registration_ticket_admissions WHERE id = ?)
    `).bind(admittedAt, usedBy, admittedAt, ticket.id, scanId),
  ]);
  const admitted = Number(results[1].meta?.changes || 0) === 1;
  const firstRedemption = admitted && Number(results[2].meta?.changes || 0) === 1;
  let usedAt = firstRedemption ? admittedAt : ticket.used_at;
  let originalUsedBy = firstRedemption ? usedBy : ticket.used_by;
  let updatedAt = firstRedemption ? admittedAt : ticket.updated_at;
  if (admitted && !firstRedemption && ticket.status !== "used") {
    // A second split scan may have read 'active' before the first one committed.
    // Refresh display metadata only; failure must not undo an accepted admission.
    try {
      const stored = await db.prepare("SELECT used_at, used_by, updated_at FROM registration_event_tickets WHERE id = ?")
        .bind(ticket.id).first();
      if (stored) { usedAt = stored.used_at; originalUsedBy = stored.used_by; updatedAt = stored.updated_at; }
    } catch { /* The committed scan and firstRedemption flag remain authoritative. */ }
  }
  return { admitted, admittedAt, firstRedemption, usedAt: usedAt || null, usedBy: originalUsedBy || null, updatedAt: updatedAt || null };
}
