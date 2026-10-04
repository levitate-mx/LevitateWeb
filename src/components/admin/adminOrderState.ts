export type AdminOrderRecord = {
  id: string;
  orderType?: "registration" | "shop";
  amount: number;
  paidAmount: number;
  status: string;
  curp: string;
  venue: string;
  reference: string;
  paymentReference?: string;
  participantName: string;
  academyName: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  proof?: unknown;
  updatedAt?: string;
  createdAt?: string;
};

export type AdminOrderTotals = {
  amount: number; count: number; paid: number; paidAmount: number;
  pending: number; rejected: number; reported: number; withProof: number;
};

export type AdminOrderFilters = { query: string; status: string; venue: string; purchaseType: string };

export function adminOrderKey(order: Pick<AdminOrderRecord, "id" | "orderType">) {
  return `${order.orderType || "registration"}:${order.id}`;
}

export function matchesAdminOrderFilters(order: AdminOrderRecord, filters: AdminOrderFilters) {
  const isReleve = order.curp.startsWith("RELEVE:");
  return (filters.status === "all" || order.status === filters.status) &&
    (filters.venue === "all" || order.venue === filters.venue) &&
    (filters.purchaseType === "all" || (filters.purchaseType === "releve" ? isReleve :
      !isReleve && (order.orderType || "registration") === filters.purchaseType)) &&
    [order.paymentReference, order.reference, order.curp, order.participantName, order.buyerName,
      order.buyerEmail, order.buyerPhone, order.academyName, order.venue]
      .map((value) => value || "").join(" ").toLowerCase().includes(filters.query.trim().toLowerCase());
}

export function adjustAdminOrderTotals(totals: AdminOrderTotals, before: AdminOrderRecord, after: AdminOrderRecord | null) {
  const next = { ...totals };
  const statusKeys: Record<string, "pending" | "reported" | "paid" | "rejected"> = {
    pending_payment: "pending", payment_reported: "reported", paid: "paid", rejected: "rejected",
  };
  for (const [order, sign] of [[before, -1], [after, 1]] as const) {
    if (!order) continue;
    next.count += sign;
    next.amount += sign * order.amount;
    next.paidAmount += sign * order.paidAmount;
    const statusKey = statusKeys[order.status];
    if (statusKey) next[statusKey] += sign;
    if (order.proof) next.withProof += sign;
  }
  return next;
}
