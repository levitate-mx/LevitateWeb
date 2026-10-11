import ticketEvent from "../shared/ticket-event.json" with { type: "json" };

export function getRegistrationEventTicketSpecs(order, catalog = ticketEvent) {
  let lines;
  try { lines = JSON.parse(order.line_items_json || "[]"); } catch { return []; }
  if (!Array.isArray(lines)) return [];
  return lines.flatMap((lineItem) => {
    if (!isRegistrationTicketLineItem(lineItem)) return [];
    const quantity = getRegistrationTicketLineQuantity(lineItem);
    const label = lineItem.title || lineItem.name || lineItem.productName || "Boleto Levitate";
    const rawProductId = lineItem.productId || lineItem.id;
    const productId = typeof rawProductId === "string" ? rawProductId.trim().split(":")[0] : "";
    const passType = getRegistrationTicketPassType(productId);
    const block = passType === "block" ? catalog.blocks.find((item) => item.id === lineItem.optionId) || null : null;
    const day = passType === "day" ? (catalog.days || []).find((item) => item.id === lineItem.optionId) || null : null;
    const eventId = lineItem.eventId || "edomex-2026-otono";
    return Array.from({ length: quantity }, () => ({ label, passType, block, day, eventId }));
  });
}

export function getRegistrationTicketPassType(productId) {
  if (productId === "block" || productId === "ticket-block") return "block";
  if (productId === "day" || productId === "ticket-day-pass") return "day";
  if (productId === "full" || productId === "ticket-full-pass") return "full";
  return null;
}

export function getRegistrationTicketCoverage(spec, catalog = ticketEvent) {
  if (spec?.passType === "full") return catalog.blocks.map((block) => block.id);
  if (spec?.passType === "block") return spec.block ? [spec.block.id] : [];
  if (spec?.passType === "day" && Array.isArray(spec.day?.blockIds)) {
    const validBlocks = new Set(catalog.blocks.map((block) => block.id));
    return [...new Set(spec.day.blockIds)].filter((id) => validBlocks.has(id));
  }
  return [];
}

function isRegistrationTicketLineItem(lineItem) {
  if (!lineItem || typeof lineItem !== "object" || Array.isArray(lineItem)) return false;
  const category = String(lineItem.productCategory || lineItem.category || "").toLowerCase();
  const itemType = String(lineItem.itemType || lineItem.type || "").toLowerCase();
  const visual = String(lineItem.visual || "").toLowerCase();
  const productId = String(lineItem.productId || lineItem.id || "").toLowerCase();
  return category === "boletos" || category === "tickets" || itemType === "ticket" || visual === "ticket" || productId.startsWith("ticket-");
}

function getRegistrationTicketLineQuantity(lineItem) {
  const quantity = Number(lineItem.quantity ?? lineItem.qty ?? lineItem.count ?? 1);
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  return Math.min(100, Math.floor(quantity));
}
