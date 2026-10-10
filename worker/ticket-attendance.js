import ticketEvent from "../shared/ticket-event.json" with { type: "json" };

export { ticketEvent };

export async function getTicketAttendance(db, eventId = ticketEvent.eventId) {
  // Read the event and its seven counters in one SQLite snapshot. A concurrent
  // admission must never yield old uniqueAdmissions with newer block totals.
  const { results: totals = [] } = await db.prepare(`
    SELECT event.id, event.name, event.venue, event.metadata_json, event.unique_admissions,
      block.block_id, block.total, block.single_count, block.day_count, block.full_count
    FROM registration_attendance_events AS event
    LEFT JOIN registration_attendance_blocks AS block ON block.event_id = event.id
    WHERE event.id = ?
  `).bind(eventId).all();
  const stored = totals[0];
  if (!stored && eventId !== ticketEvent.eventId) {
    const error = new Error("No se encontró el evento solicitado.");
    error.code = "attendance_event_not_found";
    error.statusCode = 404;
    throw error;
  }
  const metadata = stored ? JSON.parse(stored.metadata_json) : ticketEvent;
  const byBlock = new Map(totals.map((row) => [row.block_id, row]));
  const { results: events = [] } = await db.prepare(`
    SELECT id, name FROM registration_attendance_events ORDER BY created_at DESC, id
  `).all();
  const availableEvents = events.map((event) => ({ id: event.id, name: event.name }));
  if (!availableEvents.some((event) => event.id === ticketEvent.eventId)) {
    availableEvents.unshift({ id: ticketEvent.eventId, name: ticketEvent.eventName });
  }
  return {
    eventId,
    eventName: stored?.name || metadata.eventName,
    venue: stored?.venue || metadata.venue,
    updatedAt: new Date().toISOString(),
    uniqueAdmissions: Number(stored?.unique_admissions || 0),
    blocks: metadata.blocks.map((block) => {
      const total = byBlock.get(block.id);
      return {
        id: block.id, label: block.label, dayId: block.dayId, date: block.date,
        total: Number(total?.total || 0), single: Number(total?.single_count || 0),
        day: Number(total?.day_count || 0), full: Number(total?.full_count || 0),
      };
    }),
    events: availableEvents,
  };
}

// Each attempted redemption gets a new ID. Only the transaction that inserts
// that ID can increment counters or consume the ticket; retries cannot count it.
export async function recordTicketAdmission(db, { ticket, order, orderTable, passType, dayId, blockId, coverage, usedBy, device, actorId }) {
  const admissionId = crypto.randomUUID();
  const admittedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
  const eligible = `
    SELECT ticket.id FROM registration_event_tickets AS ticket
    INNER JOIN ${orderTable} AS source_order ON source_order.id = ticket.source_order_id
    WHERE ticket.id = ? AND ticket.status = 'active' AND ticket.event_id = ?
      AND ticket.source_order_type = ? AND ticket.source_order_id = ?
      AND source_order.status = 'paid'
      AND source_order.line_items_json = ?
  `;
  const eligibleParams = [ticket.id, ticketEvent.eventId, ticket.source_order_type, ticket.source_order_id, order.line_items_json];
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
      INSERT INTO registration_ticket_admissions
        (id, event_id, ticket_id, pass_type, day_id, scanned_block_id, device_id, device_name, actor_type, actor_id, coverage_json, admitted_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (${eligible})
      ON CONFLICT(event_id, ticket_id) DO NOTHING
    `).bind(admissionId, ticketEvent.eventId, ticket.id, passType, dayId || null, blockId,
      device?.id || null, device?.name || "Administración", device ? "scanner" : "admin", actorId || device?.id || null,
      JSON.stringify(coverage), admittedAt, ...eligibleParams),
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
    `).bind(ticketEvent.eventId, JSON.stringify(counts), admissionId),
    db.prepare(`
      UPDATE registration_attendance_events
      SET unique_admissions = unique_admissions + 1, updated_at = ?
      WHERE id = ? AND EXISTS (SELECT 1 FROM registration_ticket_admissions WHERE id = ?)
    `).bind(admittedAt, ticketEvent.eventId, admissionId),
    db.prepare(`
      UPDATE registration_event_tickets
      SET status = 'used', used_at = ?, used_by = ?, updated_at = ?
      WHERE id = ? AND status = 'active'
        AND EXISTS (SELECT 1 FROM registration_ticket_admissions WHERE id = ?)
    `).bind(admittedAt, usedBy, admittedAt, ticket.id, admissionId),
  ]);
  return { admitted: Number(results[1].meta?.changes || 0) === 1, admittedAt };
}
