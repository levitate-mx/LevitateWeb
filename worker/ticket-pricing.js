import ticketPricing from "../shared/ticket-pricing.json" with { type: "json" };
import ticketEvent from "../shared/ticket-event.json" with { type: "json" };

export const singlePassPresaleEndsAt = Date.parse(ticketPricing.singlePass.presaleEndsAt);
const { presalePrice, regularPrice } = ticketPricing.singlePass;
const auditPrefix = "[single-pass-price ";

export function getSinglePassPrice(now = Date.now()) {
  return now < singlePassPresaleEndsAt ? presalePrice : regularPrice;
}

function isPresaleSinglePassLine(line) {
  if (!line || typeof line !== "object" || Array.isArray(line)) return false;
  const productId = String(line.productId || line.id || "").trim().split(":")[0];
  return ["block", "ticket-block"].includes(productId)
    && (!line.eventId || line.eventId === ticketEvent.eventId)
    && Number(line.unitPrice) === presalePrice;
}

export function repriceSinglePassOrder(order, now = Date.now()) {
  if (order.status === "paid" || now < singlePassPresaleEndsAt) return null;
  let lines;
  try { lines = JSON.parse(order.line_items_json || "[]"); } catch { return null; }
  if (!Array.isArray(lines)) return null;
  let delta = 0;
  let ticketCount = 0;
  const lineItems = lines.map((line) => {
    if (!isPresaleSinglePassLine(line)) return line;
    const quantity = Number(line.quantity ?? line.qty ?? line.count ?? 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) return line;
    const originalAmount = Number(line.amount ?? presalePrice * quantity);
    if (!Number.isSafeInteger(originalAmount) || originalAmount < 0) return line;
    const lineDelta = (regularPrice - presalePrice) * quantity;
    delta += lineDelta;
    ticketCount += quantity;
    return { ...line, unitPrice: regularPrice, amount: originalAmount + lineDelta };
  });
  if (!ticketCount) return null;
  return { amount: Number(order.amount) + delta, lineItems, lineItemsJson: JSON.stringify(lineItems), ticketCount, delta };
}

// Keep the automatic audit even when payment review posts an older notes draft.
export function preserveSinglePassPricingAudit(notes, existingNotes) {
  const nextNotes = String(notes ?? "").trim();
  const auditLines = String(existingNotes || "").split("\n")
    .filter((line) => line.startsWith(auditPrefix) && !nextNotes.includes(line));
  return [nextNotes, ...auditLines].filter(Boolean).join("\n") || null;
}

export async function hasOnlyCancelledShopTickets(db, orderId) {
  const result = await db.prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(status != 'cancelled'), 0) AS remaining
    FROM registration_event_tickets WHERE source_order_type = 'shop' AND source_order_id = ?
  `).bind(orderId).first();
  return Number(result.total) > 0 && Number(result.remaining) === 0;
}

const notCancelledOrderSql = `NOT (
  EXISTS (SELECT 1 FROM registration_event_tickets t
    WHERE t.source_order_type = 'shop' AND t.source_order_id = registration_shop_orders.id)
  AND NOT EXISTS (SELECT 1 FROM registration_event_tickets t
    WHERE t.source_order_type = 'shop' AND t.source_order_id = registration_shop_orders.id AND t.status != 'cancelled')
)`;

// Call only after authenticating the administrator or the individual order token.
// The SQL candidate read excludes proofs, personal data and ticket hydration.
export async function refreshSinglePassPrices(db, { orderId, order, academyId, now = Date.now() } = {}) {
  if (now < singlePassPresaleEndsAt) return order;
  let candidates;
  if (order) candidates = [order];
  else {
    const filters = ["status != 'paid'"];
    const values = [];
    if (orderId) { filters.push("id = ?"); values.push(orderId); }
    if (academyId) { filters.push("academy_id = ?"); values.push(academyId); }
    filters.push(`EXISTS (
      SELECT 1 FROM json_each(CASE WHEN json_valid(line_items_json) THEN line_items_json ELSE '[]' END) line
      WHERE CAST(json_extract(CASE WHEN line.type = 'object' THEN line.value ELSE '{}' END, '$.unitPrice') AS REAL) = ?
        AND (json_extract(CASE WHEN line.type = 'object' THEN line.value ELSE '{}' END, '$.productId') IN ('block', 'ticket-block')
          OR json_extract(CASE WHEN line.type = 'object' THEN line.value ELSE '{}' END, '$.id') LIKE 'block:%'
          OR json_extract(CASE WHEN line.type = 'object' THEN line.value ELSE '{}' END, '$.id') LIKE 'ticket-block:%'
          OR json_extract(CASE WHEN line.type = 'object' THEN line.value ELSE '{}' END, '$.id') IN ('block', 'ticket-block'))
    )`);
    values.push(presalePrice);
    const { results = [] } = await db.prepare(`
      SELECT id, status, amount, line_items_json FROM registration_shop_orders WHERE ${filters.join(" AND ")}
    `).bind(...values).all();
    candidates = results;
  }
  for (const original of candidates) {
    let current = original;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const update = repriceSinglePassOrder(current, now);
      if (!update || await hasOnlyCancelledShopTickets(db, current.id)) break;
      const audit = `${auditPrefix}${ticketPricing.singlePass.presaleEndsAt}] ${new Date(now).toISOString()}: fin de preventa; ${update.ticketCount} Single Pass de $${presalePrice} a $${regularPrice}; total $${current.amount} a $${update.amount}. Pagos reportados y comprobantes conservados.`;
      const result = await db.prepare(`
        UPDATE registration_shop_orders SET amount = ?, line_items_json = ?,
          notes = CASE WHEN COALESCE(notes, '') = '' THEN ? ELSE notes || char(10) || ? END,
          updated_at = datetime('now')
        WHERE id = ? AND status = ? AND status != 'paid' AND amount = ? AND line_items_json = ?
          AND ${notCancelledOrderSql}
      `).bind(update.amount, update.lineItemsJson, audit, audit, current.id, current.status,
        current.amount, current.line_items_json).run();
      const fresh = await db.prepare("SELECT * FROM registration_shop_orders WHERE id = ? LIMIT 1").bind(current.id).first();
      if (!fresh) { current = null; break; }
      current = fresh;
      if (Number(result.meta?.changes || 0) === 1) break;
    }
    if (order) return current;
  }
  return order;
}
