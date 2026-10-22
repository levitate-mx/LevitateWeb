import ticketPricing from "../shared/ticket-pricing.json" with { type: "json" };
import ticketEvent from "../shared/ticket-event.json" with { type: "json" };

export const singlePassPresaleEndsAt = Date.parse(ticketPricing.singlePass.presaleEndsAt);
const { presalePrice, regularPrice } = ticketPricing.singlePass;
const auditPrefix = "[single-pass-price ";
const campaignAuditPrefix = `${auditPrefix}${ticketPricing.singlePass.presaleEndsAt}]`;

// D1 stores UTC timestamps without a timezone suffix. Never interpret them in
// the execution host's local timezone or accept a date without its upload time.
export function parseSinglePassTimestamp(value) {
  if (typeof value !== "string") return NaN;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return NaN;
  const [hour, minute, second] = match[2].split(":").map(Number);
  if (hour > 23 || minute > 59 || second > 59) return NaN;
  const timestamp = Date.parse(`${match[1]}T${match[2]}${match[3] || ""}${match[4] || "Z"}`);
  if (!Number.isFinite(timestamp)) return NaN;
  // Date.parse can normalize impossible dates such as February 30.
  const calendarDate = new Date(Date.parse(`${match[1]}T00:00:00Z`));
  return calendarDate.toISOString().slice(0, 10) === match[1] ? timestamp : NaN;
}

export function isSinglePassPresaleProof(proof) {
  return Boolean(proof && ["submitted", "accepted"].includes(proof.status)
    && parseSinglePassTimestamp(proof.uploaded_at) < singlePassPresaleEndsAt);
}

export function getSinglePassPrice(now = Date.now()) {
  return now < singlePassPresaleEndsAt ? presalePrice : regularPrice;
}

function isSinglePassLineAtPrice(line, price) {
  if (!line || typeof line !== "object" || Array.isArray(line)) return false;
  const productId = String(line.productId || line.id || "").trim().split(":")[0];
  return ["block", "ticket-block"].includes(productId)
    && (!line.eventId || line.eventId === ticketEvent.eventId)
    && Number(line.unitPrice) === price;
}

function hasAutomaticIncreaseAudit(order) {
  return String(order.notes || "").split("\n").some((line) => line.startsWith(campaignAuditPrefix)
    && line.includes(": fin de preventa;") && line.includes(`Single Pass de $${presalePrice} a $${regularPrice};`));
}

export function repriceSinglePassOrder(order, now = Date.now(), proof = null) {
  if (now < singlePassPresaleEndsAt) return null;
  const protectedProof = isSinglePassPresaleProof(proof);
  const restore = protectedProof && parseSinglePassTimestamp(order.created_at) < singlePassPresaleEndsAt
    && hasAutomaticIncreaseAudit(order);
  // Already-approved orders retain their original price. A prior automatic
  // increase can be repaired even if the administrator approved it afterwards.
  if (protectedProof && !restore || !protectedProof && order.status === "paid") return null;
  const fromPrice = restore ? regularPrice : presalePrice;
  const toPrice = restore ? presalePrice : regularPrice;
  let lines;
  try { lines = JSON.parse(order.line_items_json || "[]"); } catch { return null; }
  if (!Array.isArray(lines)) return null;
  let delta = 0;
  let ticketCount = 0;
  const lineItems = lines.map((line) => {
    if (!isSinglePassLineAtPrice(line, fromPrice)) return line;
    const quantity = Number(line.quantity ?? line.qty ?? line.count ?? 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) return line;
    const originalAmount = Number(line.amount ?? fromPrice * quantity);
    if (!Number.isSafeInteger(originalAmount) || originalAmount < 0) return line;
    const lineDelta = (toPrice - fromPrice) * quantity;
    if (originalAmount + lineDelta < 0) return line;
    delta += lineDelta;
    ticketCount += quantity;
    return { ...line, unitPrice: toPrice, amount: originalAmount + lineDelta };
  });
  const amount = Number(order.amount) + delta;
  if (!ticketCount || !Number.isSafeInteger(amount) || amount < 0) return null;
  return { amount, lineItems, lineItemsJson: JSON.stringify(lineItems), ticketCount, delta,
    direction: restore ? "restore" : "increase" };
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

export async function getLatestShopProofMetadata(db, orderId) {
  return db.prepare(`
    SELECT id, status, uploaded_at, created_at, rowid AS proof_rowid
    FROM registration_shop_payment_proofs WHERE order_id = ?
    ORDER BY uploaded_at DESC, created_at DESC, rowid DESC LIMIT 1
  `).bind(orderId).first();
}

export function getSinglePassProofSnapshot(proof) {
  return proof ? JSON.stringify([proof.id, proof.status, proof.uploaded_at, proof.created_at, proof.proof_rowid]) : null;
}

// These subqueries always refer to the order being updated. Rechecking the
// latest proof in the UPDATE prevents replacement/rejection races from granting
// the old price based on a metadata read that is no longer current.
export const latestShopProofSnapshotSql = `(SELECT json_array(p.id, p.status, p.uploaded_at, p.created_at, p.rowid)
  FROM registration_shop_payment_proofs p WHERE p.order_id = registration_shop_orders.id
  ORDER BY p.uploaded_at DESC, p.created_at DESC, p.rowid DESC LIMIT 1)`;
export const validEarlyShopProofSql = `EXISTS (
  SELECT 1 FROM registration_shop_payment_proofs p
  WHERE p.order_id = registration_shop_orders.id
    AND p.id = (SELECT latest.id FROM registration_shop_payment_proofs latest
      WHERE latest.order_id = registration_shop_orders.id
      ORDER BY latest.uploaded_at DESC, latest.created_at DESC, latest.rowid DESC LIMIT 1)
    AND p.status IN ('submitted', 'accepted')
    AND substr(p.uploaded_at, 1, 19) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9][ T][0-9][0-9]:[0-9][0-9]:[0-9][0-9]'
    AND unixepoch(p.uploaded_at) < ${singlePassPresaleEndsAt / 1000}
)`;

const notCancelledOrderSql = `NOT (
  EXISTS (SELECT 1 FROM registration_event_tickets t
    WHERE t.source_order_type = 'shop' AND t.source_order_id = registration_shop_orders.id)
  AND NOT EXISTS (SELECT 1 FROM registration_event_tickets t
    WHERE t.source_order_type = 'shop' AND t.source_order_id = registration_shop_orders.id AND t.status != 'cancelled')
)`;

// Call only after authenticating the administrator or the individual order token.
// Candidate/proof reads contain metadata only, never a payment proof's file.
export async function refreshSinglePassPrices(db, { orderId, order, academyId, now = Date.now() } = {}) {
  if (now < singlePassPresaleEndsAt) return order;
  let candidates;
  if (order) candidates = [order];
  else {
    const filters = ["(status != 'paid' OR instr(COALESCE(notes, ''), ?) > 0)"];
    const values = [campaignAuditPrefix];
    if (orderId) { filters.push("id = ?"); values.push(orderId); }
    if (academyId) { filters.push("academy_id = ?"); values.push(academyId); }
    filters.push(`EXISTS (
      SELECT 1 FROM json_each(CASE WHEN json_valid(line_items_json) THEN line_items_json ELSE '[]' END) line
      WHERE CAST(json_extract(CASE WHEN line.type = 'object' THEN line.value ELSE '{}' END, '$.unitPrice') AS REAL) IN (?, ?)
        AND (json_extract(CASE WHEN line.type = 'object' THEN line.value ELSE '{}' END, '$.productId') IN ('block', 'ticket-block')
          OR json_extract(CASE WHEN line.type = 'object' THEN line.value ELSE '{}' END, '$.id') LIKE 'block:%'
          OR json_extract(CASE WHEN line.type = 'object' THEN line.value ELSE '{}' END, '$.id') LIKE 'ticket-block:%'
          OR json_extract(CASE WHEN line.type = 'object' THEN line.value ELSE '{}' END, '$.id') IN ('block', 'ticket-block'))
    )`);
    values.push(presalePrice, regularPrice);
    const { results = [] } = await db.prepare(`
      SELECT id, status, amount, line_items_json, notes, created_at FROM registration_shop_orders WHERE ${filters.join(" AND ")}
    `).bind(...values).all();
    candidates = results;
  }
  for (const original of candidates) {
    let current = original;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const proof = await getLatestShopProofMetadata(db, current.id);
      const update = repriceSinglePassOrder(current, now, proof);
      if (!update || await hasOnlyCancelledShopTickets(db, current.id)) break;
      const action = update.direction === "restore"
        ? `precio de preventa restaurado por comprobante ${proof.id} enviado antes del cierre; ${update.ticketCount} Single Pass de $${regularPrice} a $${presalePrice}`
        : `fin de preventa; ${update.ticketCount} Single Pass de $${presalePrice} a $${regularPrice}`;
      const audit = `${campaignAuditPrefix} ${new Date(now).toISOString()}: ${action}; total $${current.amount} a $${update.amount}. Pagos reportados y comprobantes conservados.`;
      const result = await db.prepare(`
        UPDATE registration_shop_orders SET amount = ?, line_items_json = ?,
          notes = CASE WHEN COALESCE(notes, '') = '' THEN ? ELSE notes || char(10) || ? END,
          updated_at = datetime('now')
        WHERE id = ? AND status = ? AND amount = ? AND line_items_json = ? AND notes IS ?
          AND ${latestShopProofSnapshotSql} IS ?
          AND (? = 'restore' OR status != 'paid')
          AND (? != 'restore' OR ${validEarlyShopProofSql})
          AND ${notCancelledOrderSql}
      `).bind(update.amount, update.lineItemsJson, audit, audit, current.id, current.status,
        current.amount, current.line_items_json, current.notes ?? null, getSinglePassProofSnapshot(proof),
        update.direction, update.direction).run();
      const fresh = await db.prepare("SELECT * FROM registration_shop_orders WHERE id = ? LIMIT 1").bind(current.id).first();
      if (!fresh) { current = null; break; }
      current = fresh;
      if (Number(result.meta?.changes || 0) === 1) break;
    }
    if (order) return current;
  }
  return order;
}
