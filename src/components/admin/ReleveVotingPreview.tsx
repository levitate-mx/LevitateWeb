import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Check, CheckCircle2, Eye, LockKeyhole, RotateCcw, Sparkles, Trophy, UserRound } from "lucide-react";
import { requestRegistrationApi } from "./registrationApi";
import { getReleveVotingPreview } from "../../../shared/releve-voting-preview.js";
import type { RelevePreviewCandidate as PreviewCandidate, RelevePreviewDivision as PreviewDivision, ReleveVotingPreviewPayload as PreviewPayload } from "../../../shared/releve-voting-preview.js";
import "./ReleveVotingPreview.css";

type PreviewPhase = "upcoming" | "open" | "closed";
type PreviewVotes = Record<PreviewDivision, string | null>;

const divisions: { id: PreviewDivision; label: string; shortLabel: string }[] = [
  { id: "motion", label: "Relevé Motion", shortLabel: "Motion" },
  { id: "aerial", label: "Relevé Aerial", shortLabel: "Aerial" },
];
const phaseLabels: Record<PreviewPhase, string> = { upcoming: "Próximamente", open: "Abierta", closed: "Cerrada" };

function recordPreviewVote(candidates: readonly PreviewCandidate[], votes: PreviewVotes, division: PreviewDivision, selectedId: string, phase: PreviewPhase): PreviewVotes {
  if (phase !== "open") throw new Error("Abre la simulación para confirmar un voto de prueba.");
  if (votes[division]) throw new Error("Ya confirmaste un voto de prueba en esta modalidad. Reinícialo para probar otra elección.");
  const candidate = candidates.find((item) => item.id === selectedId && item.division === division);
  if (!candidate) throw new Error("Selecciona un candidato de esta modalidad antes de continuar.");
  return { ...votes, [division]: candidate.id };
}

function simulatedResults(candidates: readonly PreviewCandidate[], votes: PreviewVotes, division: PreviewDivision) {
  return candidates.filter((candidate) => candidate.division === division).map((candidate) => ({
    candidate, votes: votes[division] === candidate.id ? 1 : 0,
  }));
}

function PreviewCandidateCard({ candidate, selected, disabled, onSelect }: {
  candidate: PreviewCandidate;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={`releve-voting-preview__candidate${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}>
      <input type="radio" name={`releve-preview-${candidate.division}`} value={candidate.id} checked={selected} disabled={disabled} onChange={onSelect} />
      <span className="releve-voting-preview__candidate-top"><span>#{String(candidate.entryNumber).padStart(2, "0")}</span><span className="releve-voting-preview__radio-mark" aria-hidden="true">{selected ? <Check size={14} /> : null}</span></span>
      <span className="releve-voting-preview__portrait" aria-hidden="true"><UserRound size={38} strokeWidth={1.2} /></span>
      <span className="releve-voting-preview__demo-label">Candidato de demostración</span>
      <strong>{candidate.teacherName}</strong>
      <span className="releve-voting-preview__academy">{candidate.academyName}</span>
      <span className="releve-voting-preview__piece"><span>Coreografía</span><b>{candidate.choreographyTitle}</b></span>
      <span className="releve-voting-preview__candidate-action">{selected ? "Tu elección" : "Elegir candidato"}<ArrowRight aria-hidden="true" size={16} /></span>
    </label>
  );
}

function PreviewVoteReceipt({ candidate, divisionLabel, onReset }: { candidate: PreviewCandidate; divisionLabel: string; onReset: () => void }) {
  return (
    <div className="releve-voting-preview__receipt">
      <CheckCircle2 size={34} aria-hidden="true" strokeWidth={1.5} />
      <p className="releve-voting-preview__eyebrow">{divisionLabel} · Simulación</p>
      <h4>Voto de prueba confirmado</h4>
      <p>Elegiste a <strong>{candidate.teacherName}</strong> con <strong>{candidate.choreographyTitle}</strong>.</p>
      <span>{candidate.academyName}</span>
      <small>Este recibo es una demostración. No se envió ni se guardó un voto real.</small>
      <button type="button" onClick={onReset}><RotateCcw aria-hidden="true" size={15} />Reiniciar este voto de prueba</button>
    </div>
  );
}

export function ReleveVotingPreview({ refreshKey = 0, onUpdated, standalone = false }: { refreshKey?: number; onUpdated?: (date: string) => void; standalone?: boolean }) {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [division, setDivision] = useState<PreviewDivision>("motion");
  const [phase, setPhase] = useState<PreviewPhase>(standalone ? "open" : "upcoming");
  const [selected, setSelected] = useState<PreviewVotes>({ motion: null, aerial: null });
  const [votes, setVotes] = useState<PreviewVotes>({ motion: null, aerial: null });
  const [reviewing, setReviewing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [voteError, setVoteError] = useState("");
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const receiptContainer = useRef<HTMLDivElement>(null);
  const candidatesHeading = useRef<HTMLHeadingElement>(null);
  const tabButtons = useRef<Partial<Record<PreviewDivision, HTMLButtonElement | null>>>({});
  const updatedCallback = useRef(onUpdated);
  updatedCallback.current = onUpdated;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(""); setPreview(null);
    setSelected({ motion: null, aerial: null }); setVotes({ motion: null, aerial: null });
    setReviewing(false); setFeedback(""); setVoteError("");
    const previewRequest = standalone
      ? Promise.resolve(getReleveVotingPreview())
      : requestRegistrationApi<PreviewPayload>("/api/registration/admin/releve-voting/preview", { signal: controller.signal, cache: "no-store" });
    void previewRequest
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (payload.mode !== "preview" || payload.publicVotingEnabled !== false || typeof payload.title !== "string" || typeof payload.description !== "string"
          || typeof payload.fetchedAt !== "string" || !Array.isArray(payload.candidates)
          || payload.candidates.some((candidate) => !candidate || typeof candidate.id !== "string" || !candidate.id
            || !["motion", "aerial"].includes(candidate.division) || !Number.isFinite(candidate.entryNumber)
            || typeof candidate.teacherName !== "string" || typeof candidate.academyName !== "string" || typeof candidate.choreographyTitle !== "string")
          || new Set(payload.candidates.map((candidate) => candidate.id)).size !== payload.candidates.length) {
          throw new Error("No pudimos leer la vista previa. Vuelve a cargar la prueba.");
        }
        setPreview(payload);
        updatedCallback.current?.(payload.fetchedAt);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "No se pudo cargar la vista previa de votación.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refreshKey, retry, standalone]);

  const candidates = preview?.candidates.filter((candidate) => candidate.division === division) || [];
  const divisionLabel = divisions.find((item) => item.id === division)?.label || "Relevé";
  const selectedCandidate = candidates.find((candidate) => candidate.id === selected[division]) || null;
  const confirmedCandidate = candidates.find((candidate) => candidate.id === votes[division]) || null;
  const localResults = simulatedResults(preview?.candidates || [], votes, division);
  const localVoteCount = localResults.reduce((total, result) => total + result.votes, 0);
  const canChoose = phase === "open" && !confirmedCandidate && !reviewing;
  const CandidatesHeading = standalone ? "h2" : "h3";

  useEffect(() => { if (reviewing) reviewHeading.current?.focus(); }, [reviewing]);

  const selectDivision = (next: PreviewDivision) => {
    setDivision(next); setReviewing(false); setVoteError(""); setFeedback("");
  };
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, current: PreviewDivision) => {
    let next: PreviewDivision | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = current === "motion" ? "aerial" : "motion";
    if (event.key === "Home") next = "motion";
    if (event.key === "End") next = "aerial";
    if (next) { event.preventDefault(); selectDivision(next); tabButtons.current[next]?.focus(); }
  };
  const choose = (candidate: PreviewCandidate) => {
    if (!canChoose) return;
    setSelected((current) => ({ ...current, [division]: candidate.id }));
    setVoteError(""); setFeedback("");
  };
  const confirmVote = () => {
    if (!preview || !reviewing) return;
    try {
      setVotes(recordPreviewVote(preview.candidates, votes, division, selected[division] || "", phase));
      setReviewing(false); setVoteError("");
      setFeedback(`Voto de prueba confirmado en ${divisionLabel}. No se envió un voto real.`);
      window.requestAnimationFrame(() => receiptContainer.current?.focus());
    } catch (error) { setVoteError(error instanceof Error ? error.message : "No pudimos simular el voto."); }
  };
  const resetDivisionVote = () => {
    setVotes((current) => ({ ...current, [division]: null }));
    setSelected((current) => ({ ...current, [division]: null }));
    setReviewing(false); setVoteError(""); setFeedback(`Voto de prueba de ${divisionLabel} reiniciado.`);
    candidatesHeading.current?.focus();
  };
  const resetPreview = () => {
    setSelected({ motion: null, aerial: null }); setVotes({ motion: null, aerial: null });
    setPhase(standalone ? "open" : "upcoming"); setReviewing(false); setShowResults(false); setVoteError("");
    setFeedback("Prueba reiniciada. Los votos simulados volvieron a cero.");
  };

  return (
    <section className={`releve-voting-preview${standalone ? " releve-voting-preview--standalone" : ""}`} aria-label={standalone ? "Vista previa de votación Relevé" : "Vista previa privada de votación Relevé"} aria-busy={loading}>
      {!standalone ? <div className="releve-voting-preview__private-bar"><span><LockKeyhole aria-hidden="true" size={16} /><strong>Vista previa privada</strong><small>Solo administradores · Votación pública deshabilitada</small></span><span className="releve-voting-preview__demo-tag">Modo prueba</span></div> : null}
      {!standalone ? <div className="releve-voting-preview__controls">
        <label><span>Estado de la simulación</span><select value={phase} onChange={(event) => { setPhase(event.target.value as PreviewPhase); setReviewing(false); setVoteError(""); setFeedback(`Simulación ${phaseLabels[event.target.value as PreviewPhase].toLowerCase()}.`); }} disabled={loading || !preview}>
          <option value="upcoming">Próximamente</option><option value="open">Abierta</option><option value="closed">Cerrada</option>
        </select></label>
        <div><button type="button" disabled={loading || !preview} onClick={() => setShowResults((current) => !current)} aria-pressed={showResults}><Eye aria-hidden="true" size={15} />{showResults ? "Ocultar resultados simulados" : "Ver resultados simulados"}</button><button type="button" disabled={loading || !preview} onClick={resetPreview}><RotateCcw aria-hidden="true" size={15} />Reiniciar prueba</button></div>
      </div> : null}
      <div className="releve-voting-preview__announcements" role="status" aria-live="polite" aria-atomic="true">{feedback}</div>
      {loadError ? <div className="releve-voting-preview__load-error"><p role="alert">{loadError}</p><button type="button" onClick={() => setRetry((current) => current + 1)}>Volver a cargar la prueba</button></div> : null}
      {loading ? <p className="releve-voting-preview__loading" role="status">Preparando la vista previa de Relevé…</p> : null}
      {preview ? <div className="releve-voting-preview__stage">
        {!standalone ? <header className="releve-voting-preview__intro"><span className="releve-voting-preview__eyebrow"><Sparkles aria-hidden="true" size={15} />La ovación también se elige</span><h2>{preview.title}</h2><p>{preview.description}</p><span className={`releve-voting-preview__phase is-${phase}`}><span aria-hidden="true" />{phaseLabels[phase]}</span></header> : null}
        <div className="releve-voting-preview__tabs" role="tablist" aria-label="Modalidad de Relevé">
          {divisions.map((item) => <button key={item.id} ref={(element) => { tabButtons.current[item.id] = element; }} id={`releve-voting-tab-${item.id}`} role="tab" type="button" aria-selected={division === item.id} aria-controls={`releve-voting-panel-${item.id}`} tabIndex={division === item.id ? 0 : -1} onClick={() => selectDivision(item.id)} onKeyDown={(event) => handleTabKey(event, item.id)}>{item.label}</button>)}
        </div>
        <div id={`releve-voting-panel-${division}`} role="tabpanel" aria-labelledby={`releve-voting-tab-${division}`} className="releve-voting-preview__panel">
          <div className="releve-voting-preview__section-heading"><div><span className="releve-voting-preview__eyebrow">{standalone ? "Votación Relevé" : divisionLabel}</span><CandidatesHeading ref={candidatesHeading} tabIndex={-1}>{standalone ? <>¿Quién se lleva <span>tu aplauso?</span></> : "¿Quién se lleva tu aplauso?"}</CandidatesHeading></div><p>Maestros y coreografías de demostración</p></div>
          {phase !== "open" ? <div className="releve-voting-preview__phase-notice" role="status"><Trophy aria-hidden="true" size={20} /><p>{phase === "upcoming" ? "Pronto podrás elegir a tu favorito. En esta prueba, cambia el estado a Abierta para recorrer la votación." : "La votación está cerrada en esta simulación. Puedes revisar tu elección y los resultados de prueba."}</p></div> : null}
          <fieldset className="releve-voting-preview__candidates" disabled={!canChoose}><legend>Elige un candidato de {divisionLabel}</legend>
            {candidates.map((candidate) => <PreviewCandidateCard key={candidate.id} candidate={candidate} selected={(confirmedCandidate?.id || selected[division]) === candidate.id} disabled={!canChoose} onSelect={() => choose(candidate)} />)}
          </fieldset>
          {!candidates.length ? <p className="releve-voting-preview__empty">Todavía no hay candidatos de demostración para esta modalidad.</p> : null}
          {confirmedCandidate ? <div ref={receiptContainer} tabIndex={-1}><PreviewVoteReceipt candidate={confirmedCandidate} divisionLabel={divisionLabel} onReset={resetDivisionVote} /></div> : reviewing && selectedCandidate ? <section className="releve-voting-preview__confirmation" aria-label="Confirmación de voto de prueba"><h4 ref={reviewHeading} tabIndex={-1}>Confirma tu voto de prueba</h4><p>Elegiste a <strong>{selectedCandidate.teacherName}</strong> con <strong>{selectedCandidate.choreographyTitle}</strong>, de {selectedCandidate.academyName}.</p><small>Solo estás probando la experiencia. Esta elección no se envía al sistema de votación.</small><div><button type="button" onClick={() => { setReviewing(false); setVoteError(""); }}>Volver a elegir</button><button className="releve-voting-preview__primary" type="button" disabled={phase !== "open"} onClick={confirmVote}>Confirmar voto simulado<Check aria-hidden="true" size={16} /></button></div></section> : phase === "open" && candidates.length > 0 ? <div className="releve-voting-preview__selection"><div><span>Tu elección de prueba</span><strong>{selectedCandidate ? selectedCandidate.teacherName : "Selecciona un maestro para continuar"}</strong>{selectedCandidate ? <small>{selectedCandidate.choreographyTitle}</small> : null}</div><button className="releve-voting-preview__primary" type="button" disabled={!selectedCandidate} onClick={() => { setReviewing(true); setVoteError(""); }}>Revisar mi voto<ArrowRight aria-hidden="true" size={16} /></button></div> : null}
          {voteError ? <p className="releve-voting-preview__vote-error" role="alert">{voteError}</p> : null}
          {showResults ? <section className="releve-voting-preview__results" aria-label={`Resultados simulados de ${divisionLabel}`}><header><div><span className="releve-voting-preview__eyebrow">Resultados simulados</span><h4>Así se vería el conteo</h4></div><strong>{localVoteCount} {localVoteCount === 1 ? "voto de prueba" : "votos de prueba"}</strong></header><p>Este conteo incluye únicamente los votos que confirmaste durante esta prueba. Se borra al salir o recargar.</p><ul>{localResults.map((result) => <li key={result.candidate.id}><div><strong>{result.candidate.teacherName}</strong><span>{result.votes} {result.votes === 1 ? "voto" : "votos"}</span></div><span className="releve-voting-preview__result-bar" aria-hidden="true"><span style={{ width: result.votes ? "100%" : "0%" }} /></span></li>)}</ul></section> : null}
        </div>
        {standalone ? <div className="releve-voting-preview__public-actions"><button type="button" onClick={() => setShowResults((current) => !current)} aria-pressed={showResults}><Eye aria-hidden="true" size={15} />{showResults ? "Ocultar resultados simulados" : "Ver resultados simulados"}</button><button type="button" onClick={resetPreview}><RotateCcw aria-hidden="true" size={15} />Reiniciar prueba</button></div> : null}
        <footer className="releve-voting-preview__footer"><Sparkles aria-hidden="true" size={14} /><p>Vista previa con datos de demostración. Las selecciones viven únicamente en esta vista y no cuentan para ningún resultado real.</p></footer>
      </div> : null}
    </section>
  );
}

export default ReleveVotingPreview;
