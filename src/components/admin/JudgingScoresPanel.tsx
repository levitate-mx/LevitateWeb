import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RefreshCw, Search } from "lucide-react";
import { AdminPagination } from "./AdminPagination";
import { normalizeAdminSearch } from "./adminNavigation";
import { requestRegistrationApi } from "./registrationApi";
import { useAdminPagination } from "./useAdminPagination";
import { formatMexicoCityDateTime } from "../../utils/mexicoCityTime";
import "./JudgingScoresPanel.css";

type JudgingEvent = {
  id: string;
  name: string;
  sourceName: string;
  isActive: boolean;
  startsAt: string | null;
};
type JudgeStatus = "pending" | "partial" | "complete";
type ScoreStatus = JudgeStatus | "unavailable";
type JudgeScore = {
  id: string | number;
  name: string;
  status: JudgeStatus;
  subtotal: number | null;
  penalty: number;
  total: number | null;
  maximumScore: number | null;
  criteria: { id: number; label: string; section: string; value: number | null; maximumScore: number }[];
  feedback: string;
};
type ChoreographyScore = {
  id: string | number;
  name: string;
  academy: string;
  genre: string;
  division: string;
  category: string;
  level: string;
  blockId: string | number | null;
  blockName: string;
  status: ScoreStatus;
  completedJudges: number;
  expectedJudges: number;
  recordedScores: number;
  judges: JudgeScore[];
};
type EventsPayload = { events: JudgingEvent[]; fetchedAt: string };
type ScoresPayload = { event: JudgingEvent; fetchedAt: string; warnings: string[]; rows: ChoreographyScore[] };

const statusLabels: Record<ScoreStatus, string> = {
  pending: "Pendiente",
  partial: "Incompleta",
  complete: "Completa",
  unavailable: "No disponible",
};
const scoreFormatter = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 20 });

function scoreValue(value: number | null) {
  return value === null ? "Pendiente" : Number.isFinite(value) ? scoreFormatter.format(value) : "No disponible";
}

function disciplineName(value: string) {
  const normalized = normalizeAdminSearch(value);
  return normalized === "aereo" || normalized === "aerial" ? "Aerial" : normalized === "motion" ? "Motion" : value || "Sin disciplina";
}

function blockKey(row: ChoreographyScore) {
  return row.blockId === null || !String(row.blockId).trim() ? "unassigned" : String(row.blockId).trim();
}

function blockLabel(row: ChoreographyScore) {
  return row.blockName?.trim() || (blockKey(row) === "unassigned" ? "Sin bloque" : `Bloque ${String(row.blockId).trim()}`);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function JudgeBreakdown({ judge }: { judge: JudgeScore }) {
  return (
    <article className="judging-scores__judge">
      <header>
        <h4>{judge.name || `Juez ${judge.id}`}</h4>
        <span className={`judging-scores__status is-${judge.status}`}>{statusLabels[judge.status]}</span>
      </header>
      {judge.criteria.length ? (
        <div className="judging-scores__criteria-scroll" tabIndex={0} role="region" aria-label={`Criterios de ${judge.name || judge.id}`}>
          <table className="judging-scores__criteria">
            <thead><tr><th scope="col">Criterio</th><th scope="col">Puntuación</th><th scope="col">Máximo</th></tr></thead>
            <tbody>
              {judge.criteria.map((criterion) => (
                <tr key={`${criterion.section}-${criterion.id}`}>
                  <th scope="row">{criterion.label}{criterion.section ? <small>{criterion.section}</small> : null}</th>
                  <td>{scoreValue(criterion.value)}</td>
                  <td>{scoreValue(criterion.maximumScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="judging-scores__muted">Todavía no hay criterios registrados para este juez.</p>}
      <dl className="judging-scores__judge-totals">
        <div><dt>Subtotal registrado</dt><dd>{scoreValue(judge.subtotal)}</dd></div>
        <div><dt>Penalización</dt><dd>{scoreValue(judge.penalty)}</dd></div>
        <div><dt>{judge.status === "partial" ? "Total registrado (parcial)" : "Total del juez"}</dt><dd>{scoreValue(judge.total)}{judge.total !== null && judge.maximumScore !== null ? <small> / {scoreValue(judge.maximumScore)}</small> : null}</dd></div>
      </dl>
      {judge.feedback?.trim() ? <div className="judging-scores__feedback"><h5>Comentarios del juez</h5><p>{judge.feedback}</p></div> : null}
    </article>
  );
}

export function JudgingScoresPanel({ refreshKey = 0, onUpdated }: { refreshKey?: number; onUpdated?: (date: string) => void }) {
  const [events, setEvents] = useState<JudgingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");
  const [eventId, setEventId] = useState("");
  const [eventRevision, setEventRevision] = useState(0);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<ScoresPayload | null>(null);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [scoresError, setScoresError] = useState("");
  const [query, setQuery] = useState("");
  const [blockFilter, setBlockFilter] = useState("all");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState("");
  const scoreRequest = useRef<AbortController | null>(null);
  const notifyUpdated = useRef(onUpdated);
  notifyUpdated.current = onUpdated;

  useEffect(() => {
    setQuery("");
    setBlockFilter("all");
    setDisciplineFilter("all");
    setStatusFilter("all");
    setExpandedId("");
  }, [eventId]);

  useEffect(() => {
    const controller = new AbortController();
    scoreRequest.current?.abort();
    setEventsLoading(true);
    setEventsError("");
    setScoresError("");
    setScoresLoading(false);
    setSnapshot(null);
    setExpandedId("");
    void requestRegistrationApi<EventsPayload>("/api/registration/admin/judging/events", { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(payload.events) || payload.events.some((event) => !event || typeof event.id !== "string" || !event.id || typeof event.name !== "string")) {
          throw new Error("No se pudo leer la lista de eventos. Usa Actualizar para volver a intentar.");
        }
        setEvents(payload.events);
        setEventId((current) => payload.events.some((event) => event.id === current)
          ? current
          : (payload.events.find((event) => event.isActive) || payload.events[0])?.id || "");
        setEventRevision((current) => current + 1);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setEvents([]);
        setEventId("");
        setEventsError(errorMessage(error, "No se pudieron cargar los eventos de jueceo."));
      })
      .finally(() => { if (!controller.signal.aborted) setEventsLoading(false); });
    return () => controller.abort();
  }, [refreshKey, refreshRevision]);

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    scoreRequest.current = controller;
    setScoresLoading(true);
    setScoresError("");
    setSnapshot(null);
    setExpandedId("");
    const params = new URLSearchParams({ eventId });
    void requestRegistrationApi<ScoresPayload>(`/api/registration/admin/judging/scores?${params}`, { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (!payload.event || payload.event.id !== eventId || typeof payload.fetchedAt !== "string" || !Array.isArray(payload.rows) || !Array.isArray(payload.warnings)
          || payload.rows.some((row) => !row || !Object.hasOwn(statusLabels, row.status) || !Array.isArray(row.judges)
            || row.judges.some((judge) => !judge || !["pending", "partial", "complete"].includes(judge.status) || !Array.isArray(judge.criteria)))) {
          throw new Error("No se pudieron leer las puntuaciones de este evento. Usa Actualizar para volver a intentar.");
        }
        setSnapshot(payload);
        notifyUpdated.current?.(payload.fetchedAt);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setScoresError(errorMessage(error, "No se pudieron cargar las puntuaciones."));
      })
      .finally(() => { if (!controller.signal.aborted) setScoresLoading(false); });
    return () => controller.abort();
  }, [eventId, eventRevision]);

  const current = snapshot?.event.id === eventId ? snapshot : null;
  const rows = current?.rows || [];
  const blocks = useMemo(() => {
    const values = new Map<string, string>();
    for (const row of rows) values.set(blockKey(row), blockLabel(row));
    return [...values].sort((left, right) => left[1].localeCompare(right[1], "es", { numeric: true }));
  }, [current]);
  const disciplines = useMemo(() => [...new Set(rows.map((row) => row.genre))].sort((left, right) => disciplineName(left).localeCompare(disciplineName(right), "es")), [current]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const text = normalizeAdminSearch(`${row.id} ${row.name} ${row.academy}`);
    return text.includes(normalizeAdminSearch(query))
      && (blockFilter === "all" || blockKey(row) === blockFilter)
      && (disciplineFilter === "all" || row.genre === disciplineFilter)
      && (statusFilter === "all" || row.status === statusFilter);
  }), [current, query, blockFilter, disciplineFilter, statusFilter]);
  const pagination = useAdminPagination(filteredRows, `${eventId}|${query}|${blockFilter}|${disciplineFilter}|${statusFilter}`);
  const counts = rows.reduce((total, row) => {
    total[row.status] += 1;
    total.completedJudges += row.completedJudges;
    total.expectedJudges += row.expectedJudges;
    return total;
  }, { pending: 0, partial: 0, complete: 0, unavailable: 0, completedJudges: 0, expectedJudges: 0 });
  const loading = eventsLoading || scoresLoading;
  const hasFilters = Boolean(query.trim()) || blockFilter !== "all" || disciplineFilter !== "all" || statusFilter !== "all";
  const resetFilters = () => { setQuery(""); setBlockFilter("all"); setDisciplineFilter("all"); setStatusFilter("all"); setExpandedId(""); };
  const selectEvent = (id: string) => {
    scoreRequest.current?.abort();
    setSnapshot(null);
    setScoresError("");
    resetFilters();
    setEventId(id);
  };

  return (
    <section className="judging-scores" aria-label="Puntuaciones por coreografía" aria-busy={loading}>
      <div className="judging-scores__toolbar">
        <div>
          <p>Calificaciones sincronizadas desde la app de jueceo.</p>
          <p className="judging-scores__consulted" role="status">{loading ? "Consultando puntuaciones…" : current ? <>Consultado <time dateTime={current.fetchedAt}>{formatMexicoCityDateTime(current.fetchedAt)}</time> · CDMX</> : "Selecciona un evento para consultar sus calificaciones."}</p>
        </div>
        <button disabled={loading} onClick={() => setRefreshRevision((value) => value + 1)} type="button"><RefreshCw aria-hidden="true" size={16} />Actualizar</button>
      </div>
      <label className="judging-scores__event"><span>Evento</span><select value={eventId} disabled={eventsLoading || !events.length} onChange={(event) => selectEvent(event.target.value)}>
        {!events.length ? <option value="">{eventsLoading ? "Cargando eventos…" : "Sin eventos disponibles"}</option> : null}
        {events.map((event) => <option key={event.id} value={event.id}>{event.name}{event.sourceName ? ` · ${event.sourceName}` : ""}{event.isActive ? " · Activo" : ""}</option>)}
      </select></label>
      {eventsError || scoresError ? <p className="registration-admin-alert" role="alert">{eventsError || scoresError}</p> : null}
      {!eventsLoading && !eventsError && !events.length ? <p className="judging-scores__empty" role="status">No hay eventos de jueceo disponibles para consultar.</p> : null}
      {current ? (
        <>
          {current.warnings.length ? <div className="judging-scores__warnings" role="status"><ul>{current.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></div> : null}
          <div className="judging-scores__stats">
            <article><span>Coreografías</span><strong>{rows.length}</strong><small>{counts.completedJudges} de {counts.expectedJudges} evaluaciones completas</small></article>
            <article><span>Completas</span><strong>{counts.complete}</strong><small>Todos los jueces terminaron</small></article>
            <article><span>Incompletas</span><strong>{counts.partial}</strong><small>Faltan calificaciones</small></article>
            <article><span>Pendientes</span><strong>{counts.pending}</strong><small>Sin evaluación completa</small></article>
          </div>
          {counts.unavailable ? <p className="judging-scores__muted" role="status">{counts.unavailable} {counts.unavailable === 1 ? "coreografía tiene información no disponible" : "coreografías tienen información no disponible"}. Revisa el detalle antes de interpretar sus puntuaciones.</p> : null}
          <p className="judging-scores__scope">Consulta las calificaciones y comentarios de cada juez. Esta vista muestra el detalle registrado; no calcula un resultado general ni posiciones.</p>
          <div className="judging-scores__filters" aria-label="Filtros de puntuaciones">
            <label className="judging-scores__search"><span>Buscar coreografía</span><span><Search aria-hidden="true" size={17} /><input type="search" placeholder="Nombre, academia o ID…" value={query} onChange={(event) => { setQuery(event.target.value); setExpandedId(""); }} /></span></label>
            <label><span>Bloque</span><select value={blockFilter} onChange={(event) => { setBlockFilter(event.target.value); setExpandedId(""); }}><option value="all">Todos</option>{blocks.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
            <label><span>Disciplina</span><select value={disciplineFilter} onChange={(event) => { setDisciplineFilter(event.target.value); setExpandedId(""); }}><option value="all">Todas</option>{disciplines.map((genre) => <option key={genre} value={genre}>{disciplineName(genre)}</option>)}</select></label>
            <label><span>Estado</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setExpandedId(""); }}><option value="all">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          {hasFilters ? <button className="judging-scores__clear" type="button" onClick={resetFilters}>Limpiar filtros</button> : null}
          <div className="judging-scores__results">
            <div className="judging-scores__table-scroll" role="region" aria-label="Listado de puntuaciones" tabIndex={0}>
              <table className="judging-scores__table">
                <thead><tr><th scope="col">Coreografía</th><th scope="col">Academia</th><th scope="col">Bloque</th><th scope="col">Disciplina</th><th scope="col">Estado</th><th scope="col">Jueces</th><th scope="col">Detalle</th></tr></thead>
                <tbody>
                  {pagination.visibleItems.map((row) => {
                    const key = String(row.id);
                    const expanded = expandedId === key;
                    const detailId = `judging-score-detail-${encodeURIComponent(eventId)}-${encodeURIComponent(key)}`;
                    return <Fragment key={key}>
                      <tr className={expanded ? "is-expanded" : ""}>
                        <th scope="row"><strong>{row.name || "Coreografía sin nombre"}</strong><small>ID {row.id}{[row.division, row.category, row.level].filter(Boolean).length ? ` · ${[row.division, row.category, row.level].filter(Boolean).join(" · ")}` : ""}</small></th>
                        <td>{row.academy || "Sin academia"}</td><td>{blockLabel(row)}</td><td>{disciplineName(row.genre)}</td>
                        <td><span className={`judging-scores__status is-${row.status}`}>{statusLabels[row.status]}</span></td>
                        <td>{row.expectedJudges > 0 ? <>{row.completedJudges}/{row.expectedJudges}<small>Completos</small></> : <span className="judging-scores__muted">Sin asignar</span>}</td>
                        <td><button aria-expanded={expanded} aria-controls={detailId} aria-label={`${expanded ? "Cerrar" : "Ver"} detalle de ${row.name || `coreografía ${row.id}`}`} onClick={() => setExpandedId(expanded ? "" : key)} type="button">{expanded ? "Cerrar" : "Ver detalle"}<ChevronDown aria-hidden="true" size={15} /></button></td>
                      </tr>
                      {expanded ? <tr className="judging-scores__detail-row"><td colSpan={7}><section id={detailId} className="judging-scores__detail" aria-label={`Puntuaciones de ${row.name || row.id}`}><h3>{row.name || `Coreografía ${row.id}`}</h3>{row.judges.length ? <div className="judging-scores__judges">{row.judges.map((judge) => <JudgeBreakdown key={judge.id} judge={judge} />)}</div> : <p className="judging-scores__muted">Todavía no hay jueces asignados o evaluaciones disponibles para esta coreografía.</p>}</section></td></tr> : null}
                    </Fragment>;
                  })}
                </tbody>
              </table>
              {!filteredRows.length ? <p className="judging-scores__empty" role="status">{rows.length ? "No hay coreografías que coincidan con los filtros." : "Este evento todavía no tiene coreografías disponibles."}</p> : null}
            </div>
            <AdminPagination {...pagination} label="puntuaciones" itemLabel="coreografías" />
          </div>
        </>
      ) : !loading && scoresError ? <p className="judging-scores__muted">Usa Actualizar para volver a consultar las puntuaciones.</p> : null}
    </section>
  );
}

export default JudgingScoresPanel;
