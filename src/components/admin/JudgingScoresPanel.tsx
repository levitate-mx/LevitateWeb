import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { normalizeAdminSearch } from "./adminNavigation";
import { requestRegistrationApi } from "./registrationApi";
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
export type ChoreographyScore = {
  id: string | number;
  programNumber?: string;
  name: string;
  academy: string;
  state: string;
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
export type ReportStanding = {
  routineId: string;
  score: number | null;
  juryScore?: number | null;
  maximumScore?: number;
  audience?: { candidateId: string | null; votes: number | null; bonus: number; ready: boolean; status: string };
  placement: { rank: number | null; label: string; isFirstPlace: boolean; isParticipation: boolean } | null;
};
export type ReportBlock = {
  id: string;
  name: string;
  title: string;
  isActive: boolean;
  sections: { id: string; label: string; categories: { id: string; title: string; rows: ReportStanding[] }[] }[];
  specialAwards: { id: string; title: string; displayValue: string; isAssigned: boolean; routineId: string | null }[];
  counts: { disciplines: number; categories: number; scored: number; total: number };
  topScore: { routineId: string; score: number } | null;
};
type ScoresPayload = {
  event: JudgingEvent;
  fetchedAt: string;
  warnings: string[];
  rows: ChoreographyScore[];
  report: { title: string; subtitle: string; maximumScore: number; blocks: ReportBlock[] };
};

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

function reportScoreValue(value: number | null) {
  return value === null ? "Pendiente" : Number.isFinite(value)
    ? new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(value)
    : "No disponible";
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

export function filterReportSections(block: ReportBlock | null, rows: ChoreographyScore[], filters: { query: string; discipline: string; status: string }) {
  const rowLookup = new Map(rows.map((row) => [String(row.id), row]));
  const search = normalizeAdminSearch(filters.query);
  return (block?.sections || []).map((section) => ({
    ...section,
    categories: section.categories.map((category) => ({
      ...category,
      rows: category.rows.flatMap((standing) => {
        const row = rowLookup.get(String(standing.routineId));
        if (!row) return [];
        const text = normalizeAdminSearch(`${row.programNumber || ""} ${row.id} ${row.name} ${row.academy} ${row.state} ${row.division} ${row.category} ${row.level}`);
        const matches = text.includes(search)
          && (filters.discipline === "all" || section.id === filters.discipline)
          && (filters.status === "all" || row.status === filters.status);
        return matches ? [{ standing, row }] : [];
      }),
    })).filter((category) => category.rows.length > 0),
  })).filter((section) => section.categories.length > 0);
}

export function DictamenEntry({ standing, row, maximumScore, eventId, blockId, expanded, onToggle, showMetadata = false }: {
  standing: ReportStanding;
  row: ChoreographyScore;
  maximumScore: number;
  eventId: string;
  blockId: string;
  expanded: boolean;
  onToggle: () => void;
  showMetadata?: boolean;
}) {
  const detailId = `judging-score-detail-${encodeURIComponent(eventId)}-${encodeURIComponent(blockId)}-${encodeURIComponent(String(row.id))}`;
  const place = standing.placement === null ? "—"
    : standing.placement.isParticipation ? "Participación"
      : standing.placement.rank !== null ? `${standing.placement.rank}.º lugar` : standing.placement.label;
  const scoreText = row.status === "pending" && row.recordedScores === 0 ? "Pendiente"
    : row.status === "unavailable" && standing.score === null ? "No disponible" : reportScoreValue(standing.score);
  const isNumericScore = Number.isFinite(standing.score) && !(row.status === "pending" && row.recordedScores === 0);
  const audience = standing.audience;
  const audiencePending = audience?.ready === false;
  return (
    <article className={`judging-scores__entry${standing.placement?.isFirstPlace ? " is-first" : ""}`}>
      <div className="judging-scores__standing">
        <div className={`judging-scores__points${isNumericScore ? "" : " is-text"}`}><span>{audience ? audiencePending ? "Jurado" : "Puntaje final" : "Puntaje"}</span><strong>{scoreText}</strong></div>
        <div className="judging-scores__entry-info">
          <h5>{row.name || "Coreografía sin nombre"}</h5>
          <p className="judging-scores__academy">{row.academy || "Sin academia"}</p>
          {audience ? <p className="judging-scores__audience">Jurado: {reportScoreValue(standing.juryScore ?? null)} · Público: {audience.votes === null ? "No disponible" : `${audience.votes} votos`} · Bono: {audiencePending ? "Pendiente" : `+${audience.bonus}`}
            {audiencePending ? <span>{audience.status === 'tie_pending' ? 'Empate del público · bono por definir' : audience.status === 'open' ? 'Votación abierta · resultado provisional' : 'Pendiente del cierre de votación'}</span> : null}</p> : null}
          {showMetadata ? <div className="judging-scores__entry-metadata"><span>#{row.programNumber || row.id}</span>{row.level ? <span>{row.level}</span> : null}{row.category ? <span>{row.category}</span> : null}<span className={`judging-scores__status is-${row.status}`}>{statusLabels[row.status]}</span></div>
            : row.status === "partial" ? <span className="judging-scores__incomplete is-partial">{statusLabels[row.status]}</span> : null}
          <button className="judging-scores__entry-action" aria-expanded={expanded} aria-controls={detailId} aria-label={`${expanded ? "Cerrar" : "Ver"} detalle de ${row.name || `coreografía ${row.id}`}`} onClick={onToggle} type="button">{expanded ? "Cerrar" : "Detalle"}<ChevronDown aria-hidden="true" size={16} /></button>
        </div>
        <div className={`judging-scores__placement${standing.placement?.isParticipation ? " is-participation" : ""}${standing.placement === null ? " is-pending" : ""}`}><span>Lugar</span><strong>{audiencePending ? 'Pendiente' : standing.placement === null ? <span role="img" aria-label="Sin lugar asignado">{place}</span> : place}</strong></div>
      </div>
      {expanded ? <section id={detailId} className="judging-scores__detail" aria-label={`Puntuaciones de ${row.name || row.id}`}><h6>Detalle por juez · {blockLabel(row)}</h6><p className="judging-scores__detail-progress">{statusLabels[row.status]} · {row.expectedJudges > 0 ? `${row.completedJudges}/${row.expectedJudges} jueces completos` : "Sin jueces asignados"} · Escala de {scoreValue(maximumScore)} puntos{row.state ? ` · ${row.state}` : ""}</p>{row.judges.length ? <div className="judging-scores__judges">{row.judges.map((judge) => <JudgeBreakdown key={judge.id} judge={judge} />)}</div> : <p className="judging-scores__muted">Todavía no hay jueces asignados o evaluaciones disponibles para esta coreografía.</p>}</section> : null}
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
  const [blockFilter, setBlockFilter] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState("");
  const scoreRequest = useRef<AbortController | null>(null);
  const notifyUpdated = useRef(onUpdated);
  notifyUpdated.current = onUpdated;

  useEffect(() => {
    setQuery("");
    setBlockFilter("");
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
            || row.judges.some((judge) => !judge || !["pending", "partial", "complete"].includes(judge.status) || !Array.isArray(judge.criteria)))
          || !payload.report || !Array.isArray(payload.report.blocks)
          || payload.report.blocks.some((block) => !block || !Array.isArray(block.sections) || !Array.isArray(block.specialAwards) || !block.counts
            || block.sections.some((section) => !section || !Array.isArray(section.categories)
              || section.categories.some((category) => !category || !Array.isArray(category.rows))))) {
          throw new Error("No se pudieron leer las puntuaciones de este evento. Usa Actualizar para volver a intentar.");
        }
        const rowIds = new Set(payload.rows.map((row) => String(row.id)));
        if (payload.report.blocks.some((block) => block.sections.some((section) => section.categories.some((category) => category.rows.some((row) => !row || !rowIds.has(String(row.routineId))))))) {
          throw new Error("El dictamen no coincide con las coreografías recibidas. Usa Actualizar para volver a intentar.");
        }
        setSnapshot(payload);
        setBlockFilter((selected) => payload.report.blocks.some((block) => block.id === selected)
          ? selected
          : (payload.report.blocks.find((block) => block.isActive) || payload.report.blocks[0])?.id || "");
        notifyUpdated.current?.(payload.fetchedAt);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setScoresError(errorMessage(error, "No se pudieron cargar las puntuaciones."));
      })
      .finally(() => { if (!controller.signal.aborted) setScoresLoading(false); });
    return () => controller.abort();
  }, [eventId, eventRevision]);

  const current = snapshot?.event.id === eventId ? snapshot : null;
  const selectedBlock = current?.report.blocks.find((block) => block.id === blockFilter)
    || current?.report.blocks.find((block) => block.isActive) || current?.report.blocks[0] || null;
  const rowLookup = useMemo(() => new Map((current?.rows || []).map((row) => [String(row.id), row])), [current]);
  const sections = useMemo(() => filterReportSections(selectedBlock, current?.rows || [], {
    query, discipline: disciplineFilter, status: statusFilter,
  }), [selectedBlock, current, query, disciplineFilter, statusFilter]);
  const visibleCount = sections.reduce((total, section) => total + section.categories.reduce((sum, category) => sum + category.rows.length, 0), 0);
  const loading = eventsLoading || scoresLoading;
  const hasFilters = Boolean(query.trim()) || disciplineFilter !== "all" || statusFilter !== "all";
  const resetFilters = () => { setQuery(""); setDisciplineFilter("all"); setStatusFilter("all"); setExpandedId(""); };
  const selectEvent = (id: string) => {
    scoreRequest.current?.abort();
    setSnapshot(null);
    setScoresError("");
    setBlockFilter("");
    resetFilters();
    setEventId(id);
  };
  useEffect(() => {
    setQuery("");
    setDisciplineFilter("all");
    setStatusFilter("all");
    setExpandedId("");
  }, [selectedBlock?.id]);

  return (
    <section className="judging-scores" aria-label="Dictamen final por bloque" aria-busy={loading}>
      <div className="judging-scores__toolbar">
        <div className="judging-scores__selectors">
          <label><span>Evento</span><select value={eventId} disabled={eventsLoading || !events.length} onChange={(event) => selectEvent(event.target.value)}>
            {!events.length ? <option value="">{eventsLoading ? "Cargando eventos…" : "Sin eventos disponibles"}</option> : null}
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </select></label>
          {current ? <label><span>Bloque de competencia</span><select value={selectedBlock?.id || ""} disabled={!current.report.blocks.length} onChange={(event) => { resetFilters(); setBlockFilter(event.target.value); }}>
            {!current.report.blocks.length ? <option value="">Sin bloques disponibles</option> : null}
            {current.report.blocks.map((block) => <option key={block.id} value={block.id}>{block.name || block.title}</option>)}
          </select></label> : null}
        </div>
        <button disabled={loading} onClick={() => setRefreshRevision((value) => value + 1)} type="button"><RefreshCw aria-hidden="true" size={17} />Actualizar</button>
      </div>
      {loading ? <p className="judging-scores__muted" role="status">Cargando resultados…</p> : null}
      {eventsError || scoresError ? <p className="registration-admin-alert" role="alert">{eventsError || scoresError}</p> : null}
      {!eventsLoading && !eventsError && !events.length ? <p className="judging-scores__empty" role="status">Todavía no hay eventos de Levitate disponibles para consultar.</p> : null}
      {current ? <>
        {current.warnings.length ? <div className="judging-scores__warnings" role="status"><ul>{current.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></div> : null}
        <header className="judging-scores__report-heading"><h2>{selectedBlock?.name || selectedBlock?.title || "Dictamen final"}</h2></header>
        {selectedBlock ? <>
          <details className="judging-scores__filter-drawer">
            <summary>Buscar y filtrar{hasFilters ? " · Filtros activos" : ""}</summary>
            <div className="judging-scores__filters" aria-label="Filtros del dictamen">
              <label><span>Buscar coreografía</span><input type="search" placeholder="Nombre, academia, estado o ID…" value={query} onChange={(event) => { setQuery(event.target.value); setExpandedId(""); }} /></label>
              <label><span>Disciplina</span><select value={disciplineFilter} onChange={(event) => { setDisciplineFilter(event.target.value); setExpandedId(""); }}><option value="all">Todas</option>{selectedBlock.sections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
              <label><span>Estado de evaluación</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setExpandedId(""); }}><option value="all">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            {hasFilters ? <div className="judging-scores__filter-summary"><p role="status">{visibleCount} de {selectedBlock.counts.total} coreografías del bloque.</p><button className="judging-scores__clear" type="button" onClick={resetFilters}>Limpiar filtros</button></div> : null}
          </details>
          <div className="judging-scores__sections">
            {sections.map((section) => {
              const repeatsBlock = [selectedBlock.name, selectedBlock.title].some((value) => normalizeAdminSearch(value) === normalizeAdminSearch(section.label));
              return <section className={`judging-scores__genre${repeatsBlock ? " judging-scores__genre--without-heading" : ""}`} key={section.id} aria-label={section.label}>
              {!repeatsBlock ? <header><h3>{section.label}</h3></header> : null}
              <div className="judging-scores__categories">
                {section.categories.map((category) => <section className="judging-scores__category" key={category.id} aria-label={category.title}>
                  <header><h4>{category.title}</h4></header>
                  <div className="judging-scores__standings">
                    {category.rows.map(({ standing, row }) => <DictamenEntry
                      key={String(row.id)} standing={standing} row={row} maximumScore={current.report.maximumScore}
                      eventId={eventId} blockId={selectedBlock.id} expanded={expandedId === String(row.id)}
                      onToggle={() => setExpandedId(expandedId === String(row.id) ? "" : String(row.id))}
                    />)}
                  </div>
                </section>)}
              </div>
            </section>;
            })}
            {!sections.length ? <p className="judging-scores__empty" role="status">{hasFilters ? "No hay coreografías que coincidan con los filtros de este bloque." : "No hay resultados disponibles para mostrar en este bloque."}</p> : null}
          </div>
          {selectedBlock.specialAwards.length ? <section className="judging-scores__awards" aria-label="Premios especiales del bloque"><header><h3>Premios especiales</h3></header><div className="judging-scores__awards-grid">{selectedBlock.specialAwards.map((award) => {
            const routine = award.routineId === null ? null : rowLookup.get(String(award.routineId));
            return <article className={award.isAssigned ? "" : "is-unassigned"} key={award.id}><h4>{award.title}</h4><strong>{award.displayValue || "Sin asignar"}</strong>{routine ? <p>{routine.academy || "Sin academia"}{routine.state ? ` · ${routine.state}` : ""}</p> : null}</article>;
          })}</div></section> : null}
        </> : <p className="judging-scores__empty" role="status">Este evento todavía no tiene bloques de competencia disponibles.</p>}
      </> : !loading && scoresError ? <p className="judging-scores__muted">Usa Actualizar para volver a consultar las puntuaciones.</p> : null}
    </section>
  );
}

export default JudgingScoresPanel;
