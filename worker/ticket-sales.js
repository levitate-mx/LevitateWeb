import ticketEvent from "../shared/ticket-event.json" with { type: "json" };
import { getRegistrationEventTicketSpecs, getRegistrationTicketCoverage } from "./ticket-entitlements.js";

// One row per paid order, not one copy of its JSON per ticket. Original ticket
// numbers retain their positions when another ticket in that order is cancelled.
const paidTicketsSql = [
  ["shop", "registration_shop_orders"],
  ["registration", "registration_inscription_orders"],
].map(([type, table]) => `
  SELECT tickets.source_order_type, tickets.source_order_id, orders.line_items_json,
    JSON_GROUP_ARRAY(tickets.ticket_number) AS ticket_numbers
  FROM registration_event_tickets AS tickets
  INNER JOIN ${table} AS orders ON orders.id = tickets.source_order_id
  WHERE tickets.event_id = ? AND tickets.source_order_type = '${type}'
    AND tickets.status IN ('active', 'used') AND orders.status = 'paid'
  GROUP BY tickets.source_order_id
`).join(" UNION ALL ");

export async function getTicketSalesSummary(db, eventId = ticketEvent.eventId) {
  const stored = await db.prepare(`
    SELECT name, venue, metadata_json FROM registration_attendance_events WHERE id = ?
  `).bind(eventId).first();
  if (!stored && eventId !== ticketEvent.eventId) {
    const error = new Error("No se encontró el evento solicitado.");
    error.code = "ticket_sales_event_not_found";
    error.statusCode = 404;
    throw error;
  }
  const catalog = stored ? JSON.parse(stored.metadata_json) : ticketEvent;
  const blocks = catalog.blocks.map((block) => ({
    id: block.id, label: block.label, dayId: block.dayId, date: block.date,
    total: 0, single: 0, day: 0, full: 0,
  }));
  const byBlock = new Map(blocks.map((block) => [block.id, block]));
  const { results: orders = [] } = await db.prepare(paidTicketsSql).bind(eventId, eventId).all();
  let uniqueTickets = 0;
  let unassignedTickets = 0;
  for (const order of orders) {
    const specs = getRegistrationEventTicketSpecs(order, catalog);
    for (const ticketNumber of JSON.parse(order.ticket_numbers)) {
      uniqueTickets += 1;
      const spec = specs[Number(ticketNumber) - 1];
      const coverage = spec?.eventId === eventId ? getRegistrationTicketCoverage(spec, catalog) : [];
      if (!coverage.length) {
        unassignedTickets += 1;
        continue;
      }
      const type = spec.passType === "block" ? "single" : spec.passType;
      for (const blockId of coverage) {
        const block = byBlock.get(blockId);
        block.total += 1;
        block[type] += 1;
      }
    }
  }
  return {
    eventId,
    eventName: stored?.name || catalog.eventName,
    venue: stored?.venue || catalog.venue,
    updatedAt: new Date().toISOString(),
    capacityPerBlock: Number(catalog.capacityPerBlock) > 0 ? Number(catalog.capacityPerBlock) : 500,
    uniqueTickets, unassignedTickets, blocks,
  };
}
