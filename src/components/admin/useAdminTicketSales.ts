import { useCallback, useEffect, useState } from "react";
import type { AdminTicketSalesSnapshot } from "./AdminTicketSalesPanel";

export function useAdminTicketSales({ enabled, request }: {
  enabled: boolean;
  request: (path: string, options?: RequestInit) => Promise<{ sales: AdminTicketSalesSnapshot }>;
}) {
  const [sales, setSales] = useState<AdminTicketSalesSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setSales(null);
      setIsLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError("");
    void request("/api/registration/admin/ticket-sales-summary", { signal: controller.signal })
      .then(({ sales: next }) => {
        if (controller.signal.aborted) return;
        // Approved purchases can decrease after cancellations or payment corrections.
        setSales(next);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof TypeError
          ? "No se pudo conectar para consultar las ventas. Intenta actualizar de nuevo."
          : cause instanceof Error ? cause.message : "No se pudieron actualizar los boletos comprados por bloque.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [enabled, request, revision]);

  return { sales, isLoading: enabled && (isLoading || (!sales && !error)), error, refresh };
}
