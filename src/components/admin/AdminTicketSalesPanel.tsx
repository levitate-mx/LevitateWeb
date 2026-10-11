import { RefreshCw } from "lucide-react";
import { formatMexicoCityDate, formatMexicoCityDateTime } from "../../utils/mexicoCityTime";
import "./AdminTicketSalesPanel.css";

export type AdminTicketSalesSnapshot = {
  eventId: string;
  eventName: string;
  venue: string;
  updatedAt: string;
  capacityPerBlock: number;
  uniqueTickets: number;
  unassignedTickets: number;
  blocks: {
    id: string;
    label: string;
    dayId: string;
    date: string;
    total: number;
    single: number;
    day: number;
    full: number;
  }[];
  events?: { id: string; name: string }[];
};

type Props = {
  sales: AdminTicketSalesSnapshot | null;
  isLoading: boolean;
  error: string;
  onRefresh: () => void;
};

const countFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

function blockDateLabel(date: string) {
  // A calendar date must retain its day when formatted in Mexico City.
  const value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00Z` : date;
  return formatMexicoCityDate(value, { weekday: "long", day: "numeric", month: "long" });
}

export function AdminTicketSalesPanel({ sales, isLoading, error, onRefresh }: Props) {
  return (
    <section className="admin-ticket-sales" aria-label="Boletos comprados por bloque" aria-busy={isLoading}>
      <header className="admin-ticket-sales__header">
        <div>
          <h2>Boletos comprados por bloque</h2>
          <p className="admin-ticket-sales__event">
            {sales ? sales.eventName : "Evento pendiente de confirmar"}
          </p>
        </div>
        <button className="admin-ticket-sales__refresh" type="button" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw size={15} aria-hidden="true" />
          {isLoading ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      <p className="admin-ticket-sales__explanation">
        Lugares vendidos según compras con pago aprobado, aunque todavía no se hayan escaneado los QR.
        Single cuenta en su bloque, Day en todos los bloques de su día y Full en todo el evento.
        La suma de los bloques no equivale a personas únicas.
      </p>

      <div className="admin-ticket-sales__status" aria-live="polite">
        {sales ? (
          <p>
            {error ? "Último dato disponible" : isLoading ? "Actualizando · último dato" : "Actualizado"}
            {" · "}<time dateTime={sales.updatedAt}>{formatMexicoCityDateTime(sales.updatedAt)}</time> CDMX
          </p>
        ) : (
          <p>{isLoading ? "Cargando ocupación por bloque…" : "Resumen no disponible. Usa Actualizar para volver a consultar."}</p>
        )}
        {error ? <p className="admin-ticket-sales__error" role="alert">{error}</p> : null}
      </div>

      {sales ? (
        <>
          <div className="admin-ticket-sales__summary">
            <span><strong>{countFormat.format(sales.uniqueTickets)}</strong> boletos comprados</span>
            <span>Capacidad: {countFormat.format(sales.capacityPerBlock)} por bloque</span>
          </div>
          {sales.unassignedTickets > 0 ? (
            <p className="admin-ticket-sales__capacity-warning" role="status">
              Hay {countFormat.format(sales.unassignedTickets)} boletos comprados sin bloque o día definido.
              No están incluidos en los totales por bloque y requieren revisión.
            </p>
          ) : null}
          <ul className="admin-ticket-sales__grid">
            {sales.blocks.map((block) => {
              const percentage = (block.total / sales.capacityPerBlock) * 100;
              const exceedsCapacity = block.total > sales.capacityPerBlock;
              return (
                <li key={block.id} className={`admin-ticket-sales__block${exceedsCapacity ? " is-over-capacity" : ""}`}>
                  <div className="admin-ticket-sales__block-heading">
                    <h3>{block.label}</h3>
                    <time dateTime={block.date}>{blockDateLabel(block.date)}</time>
                  </div>
                  <p className="admin-ticket-sales__occupancy">
                    <span><strong>{countFormat.format(block.total)}</strong>/{countFormat.format(sales.capacityPerBlock)} vendidos</span>
                    <strong>{percentFormat.format(percentage)}%</strong>
                  </p>
                  <div className="admin-ticket-sales__bar" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
                  </div>
                  <dl className="admin-ticket-sales__breakdown">
                    <div><dt>Single</dt><dd>{countFormat.format(block.single)}</dd></div>
                    <div><dt>Day</dt><dd>{countFormat.format(block.day)}</dd></div>
                    <div><dt>Full</dt><dd>{countFormat.format(block.full)}</dd></div>
                  </dl>
                  {exceedsCapacity ? (
                    <p className="admin-ticket-sales__capacity-warning">
                      Supera la capacidad en {countFormat.format(block.total - sales.capacityPerBlock)}{" "}
                      {block.total - sales.capacityPerBlock === 1 ? "lugar vendido" : "lugares vendidos"}.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
