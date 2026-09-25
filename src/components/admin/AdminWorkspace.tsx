import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  CreditCard,
  MessageCircle,
  Music2,
  Search,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AdminMessageComposer,
  type AdminMessageTemplate,
} from "./AdminMessageComposer";
import { AdminPagination } from "./AdminPagination";
import { useAdminPagination } from "./useAdminPagination";
import { normalizeAdminSearch, type AdminSection } from "./adminNavigation";
import {
  getAdminWorkQueueAge,
  type AdminWorkQueueItem,
  type AdminWorkQueueTarget,
} from "./adminWorkQueueData";

type HomeProps = {
  name: string;
  isLoading: boolean;
  hasError: boolean;
  academyCount: number;
  participantCount: number;
  danceCount: number;
  reviewCount: number;
  items: AdminWorkQueueItem[];
  onNavigate: (section: AdminSection) => void;
  onOpen: (target: AdminWorkQueueTarget) => void;
};

export function AdminWorkspaceHome({
  name,
  isLoading,
  hasError,
  academyCount,
  participantCount,
  danceCount,
  reviewCount,
  items,
  onNavigate,
  onOpen,
}: HomeProps) {
  const urgentCount = items.filter((item) => item.urgent).length;
  const stats = [
    {
      label: "Academias",
      value: academyCount,
      icon: Building2,
      section: "academies",
    },
    {
      label: "Participantes",
      value: participantCount,
      icon: Users,
      section: "registrations",
    },
    {
      label: "Coreografías",
      value: danceCount,
      icon: Music2,
      section: "choreographies",
    },
    {
      label: "Pagos por revisar",
      value: reviewCount,
      icon: CreditCard,
      section: "payments",
    },
  ] as const;
  return (
    <div className="admin-home" aria-busy={isLoading}>
      <header className="admin-home__welcome">
        <div>
          <span className="admin-eyebrow">ADMINISTRACIÓN</span>
          <h1>
            Hola, {name.trim().split(/\s+/)[0] || "equipo"}
            <span>.</span>
          </h1>
        </div>
        <span className="admin-home__season">
          <span /> Administración Levitate
        </span>
      </header>
      <section
        className="admin-home__stats"
        aria-label="Resumen de todos los registros"
      >
        {stats.map(({ label, value, icon: Icon, section }) => (
          <button
            key={section}
            onClick={() => onNavigate(section)}
            type="button"
          >
            <span>
              <Icon size={18} aria-hidden="true" />
              {label}
            </span>
            <strong>{isLoading ? "—" : value.toLocaleString("es-MX")}</strong>
            <small>
              Ver registros <ArrowUpRight size={15} aria-hidden="true" />
            </small>
          </button>
        ))}
      </section>
      <div className="admin-home__columns">
        <section
          className="admin-home__priorities admin-surface"
          aria-labelledby="admin-priorities-title"
        >
          <header className="admin-section-heading">
            <div>
              <span className="admin-eyebrow">SEGUIMIENTO</span>
              <h2 id="admin-priorities-title">Pendientes</h2>
            </div>
            <span className="admin-count">
              {isLoading ? "…" : items.length}
            </span>
          </header>
          <p className="admin-home__priority-copy">
            {isLoading
              ? "Consultando los pendientes del equipo…"
              : hasError
                ? "No se pudo cargar toda la información. Actualiza para volver a intentarlo."
                : urgentCount
                  ? `${urgentCount} comprobantes llevan más de 48 horas en espera.`
                  : "Primero los pagos por revisar; después, correcciones y requisitos."}
          </p>
          <div className="admin-home__tasks">
            {items.slice(0, 4).map((item) => (
              <button
                key={item.id}
                onClick={() => onOpen(item.target)}
                type="button"
              >
                <span
                  className={`admin-task-icon${item.urgent ? " is-urgent" : ""}`}
                >
                  {item.category === "payments" ? (
                    <CreditCard size={18} />
                  ) : item.category === "music" ? (
                    <Music2 size={18} />
                  ) : (
                    <Users size={18} />
                  )}
                </span>
                <span className="admin-home__task-copy">
                  <small>{item.title}</small>
                  <strong>{item.subject}</strong>
                  <span>
                    {item.academyName} · {getAdminWorkQueueAge(item.date)}
                  </span>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            ))}
            {!items.length ? (
              <div className="admin-empty">
                <CheckCheck size={28} />
                <strong>
                  {isLoading
                    ? "Cargando pendientes"
                    : hasError
                      ? "Información no disponible"
                      : "Sin pendientes"}
                </strong>
                <p>
                  {isLoading
                    ? "Cargando pagos, música y datos pendientes."
                    : hasError
                      ? "Intenta actualizar los datos."
                      : "No hay pagos, música o datos pendientes en los registros cargados."}
                </p>
              </div>
            ) : null}
          </div>
          <button
            className="admin-home__all"
            onClick={() => onNavigate("followup")}
            type="button"
          >
            Ir a seguimiento <ArrowRight size={16} />
          </button>
        </section>
        <aside className="admin-home__aside">
          <section className="admin-home__communication">
            <span className="admin-home__communication-icon">
              <MessageCircle size={23} />
            </span>
            <h2>Mensajes a academias</h2>
            <p>
              Consulta los pendientes de una academia y prepara un mensaje.
            </p>
            <button onClick={() => onNavigate("communications")} type="button">
              Preparar un mensaje <ArrowUpRight size={17} />
            </button>
          </section>
          <section className="admin-surface admin-home__shortcuts">
            <h2>Operación del evento</h2>
            <button onClick={() => onNavigate("program")} type="button">
              <ClipboardList size={18} />
              <span>
                Programa de competencia
                <small>Bloques, disciplinas y divisiones</small>
              </span>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => onNavigate("tickets")} type="button">
              <CheckCheck size={18} />
              <span>
                Boletos y accesos<small>Compras y boletos confirmados</small>
              </span>
              <ChevronRight size={16} />
            </button>
          </section>
        </aside>
      </div>
      <p className="admin-home__scope">
        Resumen de todas las sedes. Abre cada sección para filtrar y consultar
        el detalle.
      </p>
    </div>
  );
}

export type AdminCommunicationContact = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  initials: string;
  alerts: string[];
  templates: AdminMessageTemplate[];
  international: boolean;
};

export function AdminCommunications({
  contacts,
  isLoading,
  onOpenAcademy,
}: {
  contacts: AdminCommunicationContact[];
  isLoading: boolean;
  onOpenAcademy: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const filtered = useMemo(
    () =>
      contacts
        .filter(
          (contact) =>
            (filter === "all" || contact.alerts.length > 0) &&
            normalizeAdminSearch(
              `${contact.name} ${contact.contactName} ${contact.email} ${contact.phone}`,
            ).includes(normalizeAdminSearch(query)),
        )
        .sort(
          (a, b) =>
            b.alerts.length - a.alerts.length ||
            a.name.localeCompare(b.name, "es"),
        ),
    [contacts, query, filter],
  );
  const pagination = useAdminPagination(
    filtered,
    JSON.stringify([query, filter]),
  );
  const selected = contacts.find((contact) => contact.id === selectedId);
  return (
    <div
      className={`admin-communications${selected ? " has-selection" : ""}`}
      aria-busy={isLoading}
    >
      <section
        className="admin-communications__directory admin-surface"
        aria-label="Contactos de academias"
      >
        <header>
          <h2>
            Academias <span>{contacts.length}</span>
          </h2>
          <p>Elige a quién dar seguimiento.</p>
          <label className="admin-search">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="Buscar contacto"
              placeholder="Buscar academia o contacto…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
            />
          </label>
          <div
            className="admin-segmented"
            aria-label="Filtrar contactos"
            role="group"
          >
            <button
              type="button"
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Todas
            </button>
            <button
              type="button"
              aria-pressed={filter === "pending"}
              onClick={() => setFilter("pending")}
            >
              Con pendientes{" "}
              <span>
                {contacts.filter((contact) => contact.alerts.length).length}
              </span>
            </button>
          </div>
        </header>
        <div className="admin-communications__contacts">
          {pagination.visibleItems.map((contact) => (
            <button
              key={contact.id}
              type="button"
              aria-pressed={selectedId === contact.id}
              onClick={() => setSelectedId(contact.id)}
            >
              <span className="admin-avatar">{contact.initials}</span>
              <span>
                <strong>{contact.name}</strong>
                <small>
                  {contact.contactName || "Sin responsable registrado"}
                </small>
                <em>
                  {contact.alerts.length
                    ? `${contact.alerts.length} asuntos por atender`
                    : "Sin pendientes detectados"}
                </em>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
          {!filtered.length ? (
            <div className="admin-empty">
              <Search size={24} />
              <strong>
                {isLoading ? "Cargando contactos…" : "Sin resultados"}
              </strong>
              <p>
                {query || filter !== "all"
                  ? "Prueba otro nombre o selecciona Todas."
                  : "Las academias registradas aparecerán aquí."}
              </p>
            </div>
          ) : null}
        </div>
        <AdminPagination
          {...pagination}
          itemLabel="academias"
          label="contactos"
        />
      </section>
      <section
        className="admin-communications__conversation admin-surface"
        aria-label="Preparar comunicación"
      >
        {selected ? (
          <>
            <header className="admin-communications__recipient">
              <button
                className="admin-communications__back"
                type="button"
                onClick={() => setSelectedId("")}
              >
                <ArrowLeft size={17} /> Volver a academias
              </button>
              <div>
                <span className="admin-avatar">{selected.initials}</span>
                <div>
                  <span className="admin-eyebrow">CONTACTO DE LA ACADEMIA</span>
                  <h2>{selected.name}</h2>
                  <p>{selected.email || "Sin correo registrado"}</p>
                </div>
              </div>
              <button
                className="admin-text-button"
                type="button"
                onClick={() => onOpenAcademy(selected.id)}
              >
                Ver expediente <ArrowUpRight size={15} />
              </button>
            </header>
            {selected.alerts.length ? (
              <div className="admin-communications__context">
                <h3>
                  <CircleAlert size={16} /> Antes de escribir
                </h3>
                <ul>
                  {selected.alerts.map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <AdminMessageComposer
              recipientName={selected.contactName || selected.name}
              phone={selected.phone}
              requireCountryPrefix={selected.international}
              templates={selected.templates}
              contextKey={`communications:${selected.id}`}
            />
            <p className="admin-communications__notice">
              El envío se completa en WhatsApp. Las respuestas y el historial se
              consultan allí.
            </p>
          </>
        ) : (
          <div className="admin-communications__empty">
            <span>
              <MessageCircle size={34} />
            </span>
            <h2>Selecciona una academia</h2>
            <p>
              Consulta sus pendientes y prepara un mensaje.
            </p>
            <div>
              <span>
                01 <strong>Elige una academia</strong>
              </span>
              <span>
                02 <strong>Revisa y edita el mensaje</strong>
              </span>
              <span>
                03 <strong>Continúa en WhatsApp</strong>
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
