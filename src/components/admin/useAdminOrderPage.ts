import { useCallback, useEffect, useRef, useState } from "react";
import { adminOrderKey, matchesAdminOrderFilters, type AdminOrderRecord, type AdminOrderFilters, type AdminOrderTotals } from "./adminOrderState";
import type { AdminPageSize } from "./useAdminPagination";

type Payload<T> = {
  orders: T[];
  pagination: { page: number; pageSize: AdminPageSize; totalItems?: number; pageCount?: number };
  totals?: AdminOrderTotals;
};

export function useAdminOrderPage<T extends AdminOrderRecord>({ enabled, filters, request, onTotals }: {
  enabled: boolean;
  filters: AdminOrderFilters;
  request: (path: string, init?: RequestInit) => Promise<Payload<T>>;
  onTotals: (totals: AdminOrderTotals) => void;
}) {
  const [search, setSearch] = useState(filters.query);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(filters.query), 300);
    return () => window.clearTimeout(timer);
  }, [filters.query]);
  const filterKey = JSON.stringify({ ...filters, query: search.trim() });
  const [position, setPosition] = useState({ page: 1, pageSize: 25 as AdminPageSize, filterKey });
  const page = position.filterKey === filterKey ? position.page : 1;
  const [result, setResult] = useState<(Payload<T> & { key: string; pagination: Required<Payload<T>["pagination"]> }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState("");
  const sequence = useRef(0);
  const needsTotals = useRef(true);
  const countSnapshot = useRef<{ filterKey: string; totalItems: number } | null>(null);
  const key = `${filterKey}:${page}:${position.pageSize}`;
  const refresh = useCallback(() => {
    needsTotals.current = true;
    countSnapshot.current = null;
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      countSnapshot.current = null;
      needsTotals.current = true;
      setIsLoading(false);
      return;
    }
    const id = ++sequence.current;
    const controller = new AbortController();
    const currentFilters = JSON.parse(filterKey) as AdminOrderFilters;
    const params = new URLSearchParams({ q: currentFilters.query, status: currentFilters.status,
      venue: currentFilters.venue, purchaseType: currentFilters.purchaseType,
      page: String(page), pageSize: String(position.pageSize), includeTotals: needsTotals.current ? "1" : "0",
      includeCount: countSnapshot.current?.filterKey === filterKey ? "0" : "1" });
    setIsLoading(true);
    setError("");
    void request(`/api/registration/admin/payment-orders?${params}`, { signal: controller.signal }).then((payload) => {
      if (id !== sequence.current || controller.signal.aborted) return;
      if (payload.totals) { onTotals(payload.totals); needsTotals.current = false; }
      if (payload.pagination.totalItems === undefined && payload.orders.length === 0 && page > 1) {
        // Another user deleted the final page: recount only when needed.
        countSnapshot.current = null;
        setRevision((current) => current + 1);
        return;
      }
      const totalItems = payload.pagination.totalItems ?? countSnapshot.current?.totalItems ?? 0;
      countSnapshot.current = { filterKey, totalItems };
      const pagination = { ...payload.pagination, totalItems, pageCount: Math.max(1, Math.ceil(totalItems / position.pageSize)) };
      // A deletion by another administrator may have removed the last page.
      setPosition({ page: payload.pagination.page, pageSize: payload.pagination.pageSize, filterKey });
      setResult({ ...payload, pagination, key: `${filterKey}:${payload.pagination.page}:${payload.pagination.pageSize}` });
      setUpdatedAt(new Date().toISOString());
    }).catch((cause: unknown) => {
      if (id !== sequence.current || controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los pagos.");
      setResult(null);
    }).finally(() => {
      if (id === sequence.current && !controller.signal.aborted) setIsLoading(false);
    });
    return () => { controller.abort(); sequence.current += 1; };
  }, [enabled, filterKey, page, position.pageSize, revision, request, onTotals]);

  const replaceOrder = (before: T, after: T | null) => {
    // Do not allow an older list request to overwrite a successful mutation.
    sequence.current += 1;
    setIsLoading(false);
    if (!enabled) {
      countSnapshot.current = null;
      needsTotals.current = true;
      setResult(null);
      return;
    }
    const activeFilters = JSON.parse(filterKey) as AdminOrderFilters;
    if (result?.key === key) {
      const total = Math.max(0, result.pagination.totalItems + Number(after !== null && matchesAdminOrderFilters(after, activeFilters)) - Number(matchesAdminOrderFilters(before, activeFilters)));
      countSnapshot.current = { filterKey, totalItems: total };
      const lastPage = Math.max(1, Math.ceil(total / position.pageSize));
      if (page > lastPage) setPosition({ page: lastPage, pageSize: position.pageSize, filterKey });
      // A removed/moved row shifts SQL offsets. Refill only this bounded page
      // so advancing to the next page cannot skip a record. No recount or
      // global reload is needed. On page one, ordinary updates stay local.
      if (matchesAdminOrderFilters(before, activeFilters) !== (after !== null && matchesAdminOrderFilters(after, activeFilters)) ||
          (page > 1 && before.updatedAt !== after?.updatedAt)) {
        setRevision((current) => current + 1);
      }
    }
    setResult((current) => {
      if (!current || current.key !== key) return current;
      const activeFilters = JSON.parse(filterKey) as AdminOrderFilters;
      const matchesBefore = matchesAdminOrderFilters(before, activeFilters);
      const matchesAfter = after !== null && matchesAdminOrderFilters(after, activeFilters);
      const totalItems = Math.max(0, current.pagination.totalItems + Number(matchesAfter) - Number(matchesBefore));
      const orders = current.orders.flatMap((order) => adminOrderKey(order) === adminOrderKey(before)
        ? (matchesAfter && after ? [after] : []) : [order]);
      orders.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "") ||
        (b.createdAt || "").localeCompare(a.createdAt || "") || b.id.localeCompare(a.id) ||
        (a.orderType || "registration").localeCompare(b.orderType || "registration"));
      const pageCount = Math.max(1, Math.ceil(totalItems / position.pageSize));
      return { ...current, orders, pagination: { ...current.pagination, totalItems, pageCount } };
    });
  };

  const data = result?.key === key ? result : null;
  const totalItems = data?.pagination.totalItems ?? 0;
  const orders = data?.orders ?? [];
  const firstItem = orders.length ? (page - 1) * position.pageSize + 1 : 0;
  return {
    orders, error, updatedAt, isLoading: enabled && (isLoading || search !== filters.query), refresh, replaceOrder,
    pagination: {
      firstItem, lastItem: orders.length ? firstItem + orders.length - 1 : 0, totalItems,
      page, pageSize: position.pageSize, pageCount: data?.pagination.pageCount ?? page,
      onPageChange: (next: number) => setPosition({ page: next, pageSize: position.pageSize, filterKey }),
      onPageSizeChange: (pageSize: AdminPageSize) => setPosition({ page: 1, pageSize, filterKey }),
    },
  };
}
