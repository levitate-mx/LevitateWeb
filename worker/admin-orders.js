const sources = [
  { type: "registration", table: "registration_inscription_orders" },
  { type: "shop", table: "registration_shop_orders" },
];

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "invalid_order_pagination";
  throw error;
}

export function readAdminOrderFilters(params) {
  const filters = {
    query: (params.get("q") || "").trim().toLowerCase(),
    status: params.get("status") || "all",
    venue: params.get("venue") || "all",
    purchaseType: params.get("purchaseType") || "all",
  };
  if (filters.query.length > 200) invalid("La búsqueda no puede exceder 200 caracteres.");
  if (!["all", "pending_payment", "payment_reported", "paid", "rejected"].includes(filters.status)) invalid("Status inválido.");
  if (!["all", "cdmx", "puebla", "edomex", "veracruz"].includes(filters.venue)) invalid("Evento inválido.");
  if (!["all", "registration", "shop", "releve"].includes(filters.purchaseType)) invalid("Tipo de compra inválido.");
  return filters;
}

function filteredSources(filters) {
  return sources.filter(({ type }) => filters.purchaseType === "all" ||
    (filters.purchaseType === "releve" ? type === "registration" : type === filters.purchaseType));
}

function whereClause(filters) {
  const clauses = [];
  const values = [];
  if (filters.status !== "all") { clauses.push("status = ?"); values.push(filters.status); }
  if (filters.venue !== "all") { clauses.push("venue = ?"); values.push(filters.venue); }
  if (filters.purchaseType === "releve") clauses.push("curp LIKE 'RELEVE:%'");
  else if (filters.purchaseType !== "all") clauses.push("curp NOT LIKE 'RELEVE:%'");
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", values };
}

function matchesSearch(order, query) {
  return [order.paymentReference, order.reference, order.curp, order.participantName,
    order.buyerName, order.buyerEmail, order.buyerPhone, order.academyName, order.venue]
    .map((value) => value || "").join(" ").toLowerCase().includes(query);
}

// Keep the display-reference search identical to the existing UI, including
// international references computed with a hash. Text search scans candidate
// order records, but never hydrates their proofs or tickets. Ordinary browsing
// and the status/venue/type filters use indexed SQL pagination below.
async function searchOrders(db, filters, serialize) {
  const where = whereClause(filters);
  const orders = [];
  for (const source of filteredSources(filters)) {
    const { results } = await db.prepare(`SELECT * FROM ${source.table} ${where.sql}`)
      .bind(...where.values).all();
    orders.push(...results.map((row) => serialize(source.type, row)).filter((order) => matchesSearch(order, filters.query)));
  }
  return orders.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) ||
    b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id) || a.orderType.localeCompare(b.orderType));
}

export async function getAdminOrderTotals(db) {
  const totals = { count: 0, amount: 0, paidAmount: 0, pending: 0, reported: 0, paid: 0, rejected: 0, withProof: 0 };
  for (const { type, table } of sources) {
    const proofs = type === "shop" ? "registration_shop_payment_proofs" : "registration_inscription_payment_proofs";
    const row = await db.prepare(`SELECT COUNT(*) AS count,
      COALESCE(SUM(amount), 0) AS amount, COALESCE(SUM(paid_amount), 0) AS paidAmount,
      COALESCE(SUM(status = 'pending_payment'), 0) AS pending,
      COALESCE(SUM(status = 'payment_reported'), 0) AS reported,
      COALESCE(SUM(status = 'paid'), 0) AS paid,
      COALESCE(SUM(status = 'rejected'), 0) AS rejected,
      COALESCE(SUM(EXISTS (SELECT 1 FROM ${proofs} p WHERE p.order_id = ${table}.id)), 0) AS withProof
      FROM ${table}`).first();
    for (const key of Object.keys(totals)) totals[key] += Number(row[key]);
  }
  return totals;
}

export async function getAdminOrderPage(db, params, serialize) {
  const filters = readAdminOrderFilters(params);
  const requestedPage = Number(params.get("page") || 1);
  const pageSize = Number(params.get("pageSize") || 25);
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 1000000) invalid("Página inválida.");
  if (![10, 25, 50].includes(pageSize)) invalid("Tamaño de página inválido.");
  const selectedSources = filteredSources(filters);
  const where = whereClause(filters);
  let orders;
  let totalItems;
  let page;
  if (filters.query) {
    const matches = await searchOrders(db, filters, serialize);
    totalItems = matches.length;
    page = Math.min(requestedPage, Math.max(1, Math.ceil(totalItems / pageSize)));
    orders = matches.slice((page - 1) * pageSize, page * pageSize);
  } else {
    if (params.get("includeCount") !== "0") {
      totalItems = 0;
      for (const { table } of selectedSources) {
        const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table} ${where.sql}`).bind(...where.values).first();
        totalItems += Number(row.count);
      }
    }
    page = totalItems === undefined ? requestedPage : Math.min(requestedPage, Math.max(1, Math.ceil(totalItems / pageSize)));
    const sql = selectedSources.map(({ table, type }) =>
      `SELECT id, '${type}' AS order_type, updated_at, created_at FROM ${table} ${where.sql}`).join(" UNION ALL ");
    const { results: identities } = await db.prepare(`${sql}
      ORDER BY updated_at DESC, created_at DESC, id DESC, order_type ASC LIMIT ? OFFSET ?`)
      .bind(...selectedSources.flatMap(() => where.values), pageSize, (page - 1) * pageSize).all();
    const records = new Map();
    for (const { table, type } of selectedSources) {
      const ids = identities.filter((row) => row.order_type === type).map((row) => row.id);
      if (!ids.length) continue;
      const { results } = await db.prepare(`SELECT * FROM ${table} WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
      for (const row of results) records.set(`${type}:${row.id}`, serialize(type, row));
    }
    orders = identities.map((row) => records.get(`${row.order_type}:${row.id}`)).filter(Boolean);
  }
  return {
    orders,
    pagination: { page, pageSize, totalItems,
      pageCount: totalItems === undefined ? undefined : Math.max(1, Math.ceil(totalItems / pageSize)) },
    ...(params.get("includeTotals") === "1" ? { totals: await getAdminOrderTotals(db) } : {}),
  };
}

// Exports are explicitly requested full reads, independent of the visible page.
export async function getAdminOrderExport(db, params, serialize) {
  const filters = readAdminOrderFilters(params);
  const orders = await searchOrders(db, filters, serialize);
  const metadata = new Map();
  const where = whereClause(filters);
  for (const { table, type } of filteredSources(filters)) {
    const proofs = type === "shop" ? "registration_shop_payment_proofs" : "registration_inscription_payment_proofs";
    const { results } = await db.prepare(`SELECT o.id, p.id AS proof_id, p.file_name, p.content_type,
      p.file_size, p.status AS proof_status, p.uploaded_at,
      (SELECT COUNT(*) FROM registration_event_tickets t WHERE t.source_order_type = '${type}' AND t.source_order_id = o.id) AS ticket_count
      FROM (SELECT id FROM ${table} ${where.sql}) o
      LEFT JOIN ${proofs} p ON p.id = (SELECT id FROM ${proofs} latest WHERE latest.order_id = o.id
        ORDER BY uploaded_at DESC, created_at DESC, rowid DESC LIMIT 1)`).bind(...where.values).all();
    for (const row of results) metadata.set(`${type}:${row.id}`, {
      ticketCount: Number(row.ticket_count),
      proof: row.proof_id ? { id: row.proof_id, fileName: row.file_name, contentType: row.content_type,
        fileSize: row.file_size, status: row.proof_status, uploadedAt: row.uploaded_at, dataUrl: "" } : null,
    });
  }
  return { orders: orders.map((order) => ({ ...order, ...metadata.get(`${order.orderType}:${order.id}`) })) };
}
