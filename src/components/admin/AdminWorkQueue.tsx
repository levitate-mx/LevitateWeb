import { useMemo, useState } from "react";
import { ArrowUpRight, ClipboardList, Search } from "lucide-react";
import { normalizeAdminSearch } from "./adminNavigation";
import { formatMexicoCityDateTime } from "../../utils/mexicoCityTime";
import { AdminPagination } from "./AdminPagination";
import { useAdminPagination } from "./useAdminPagination";
import { buildAdminWorkQueue, getAdminWorkQueueAge, getAdminWorkQueueTimestamp, type AdminWorkQueueCategory, type AdminWorkQueueSources, type AdminWorkQueueTarget } from "./adminWorkQueueData";
import "./AdminWorkQueue.css";

type Props = AdminWorkQueueSources & {
  isLoading: boolean;
  scopeKey: string;
  venueLabel: (venue: string) => string;
  onOpen: (target: AdminWorkQueueTarget) => void;
};

export function AdminWorkQueue({ orders, dances, participants, isLoading, scopeKey, venueLabel, onOpen }: Props) {
  const [category, setCategory] = useState<AdminWorkQueueCategory | "all">("all");
  const [query, setQuery] = useState("");
  const items = useMemo(() => buildAdminWorkQueue({ orders, dances, participants }), [orders, dances, participants]);
  const filteredItems = items.filter((item) => (category === "all" || item.category === category) && normalizeAdminSearch(`${item.subject} ${item.academyName} ${item.detail}`).includes(normalizeAdminSearch(query)));
  const pagination = useAdminPagination(filteredItems, JSON.stringify([scopeKey, category, query]));
  const urgentCount = items.filter((item) => item.urgent).length;
  const filters = [
    { value: "all", label: "Todos" },
    { value: "payments", label: "Pagos" },
    { value: "music", label: "Música" },
    { value: "participants", label: "Datos de participantes" },
  ] as const;

  return (
    <section className="admin-work-queue" aria-labelledby="admin-work-queue-title" aria-busy={isLoading}>
      <header className="admin-work-queue__heading">
        <div>
          <h2 id="admin-work-queue-title">Pendientes por resolver</h2>
          <p>Del periodo y sede seleccionados. Primero los comprobantes con más de 48 h; después los demás pagos por revisar y corregir.</p>
        </div>
        <span className={urgentCount > 0 ? "admin-work-queue__urgent" : "admin-work-queue__count"}>
          {urgentCount > 0 ? `${urgentCount} ${urgentCount === 1 ? "urgente" : "urgentes"}` : `${items.length} pendientes`}
        </span>
      </header>
      <label className="admin-search admin-queue-search"><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar pendiente" placeholder="Buscar nombre, academia o referencia…" /></label>
      <div className="admin-work-queue__filters" role="group" aria-label="Tipo de pendiente">
        {filters.map((filter) => (
          <button key={filter.value} aria-pressed={category === filter.value} onClick={() => setCategory(filter.value)} type="button">
            {filter.label}<strong>{filter.value === "all" ? items.length : items.filter((item) => item.category === filter.value).length}</strong>
          </button>
        ))}
      </div>
      <ul className="admin-work-queue__list">
        {pagination.visibleItems.map((item) => {
          const timestamp = getAdminWorkQueueTimestamp(item.date);
          return (
            <li className={item.urgent ? "is-urgent" : ""} key={item.id}>
              <div className="admin-work-queue__case">
                <span className="admin-work-queue__type">{item.title}{item.urgent ? " · Más de 48 h" : ""}</span>
                <strong>{item.subject}</strong>
                <span>{item.academyName} · {item.venues.filter(Boolean).map(venueLabel).join(", ") || "Sin sede vinculada"}</span>
                <small>{item.detail}</small>
              </div>
              <div className="admin-work-queue__date">
                <strong>{getAdminWorkQueueAge(item.date)}</strong>
                <span>{item.dateLabel}</span>
                {Number.isFinite(timestamp) ? <time dateTime={new Date(timestamp).toISOString()}>{formatMexicoCityDateTime(timestamp)}</time> : null}
              </div>
              <button className="admin-work-queue__action" onClick={() => onOpen(item.target)} aria-label={`${item.actionLabel}: ${item.subject}`} type="button">
                {item.actionLabel}<ArrowUpRight aria-hidden="true" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      {filteredItems.length === 0 ? (
        <p className="admin-work-queue__empty" role="status"><ClipboardList aria-hidden="true" size={20} />{isLoading ? "Cargando pendientes..." : "No hay pendientes de este tipo en el periodo y sede seleccionados."}</p>
      ) : null}
      <AdminPagination {...pagination} itemLabel="pendientes" label="pendientes por resolver" />
    </section>
  );
}
