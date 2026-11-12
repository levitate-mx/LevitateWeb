import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, X } from "lucide-react";
import { releveVotingCandidates } from "../../data/releveVotingCandidates";
import type { ReleveVotingCandidate } from "../../data/releveVotingCandidates";
import "./ReleveVotingPage.css";

function CandidateInfo({ candidate }: { candidate: ReleveVotingCandidate }) {
  return <span className="releve-candidate-info">
    <span className="releve-candidate-info__academy">{candidate.academy}</span>
    <strong className="releve-candidate-info__choreography">{candidate.choreography}</strong>
    <span className="releve-candidate-info__participant">{candidate.participantName}</span>
  </span>;
}

export function ReleveVotingPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const receipt = useRef<HTMLParagraphElement>(null);
  const choices = useRef<HTMLFieldSetElement>(null);
  const selected = releveVotingCandidates.find((candidate) => candidate.id === selectedId) ?? null;

  useEffect(() => {
    if (confirmedId) receipt.current?.focus();
  }, [confirmedId]);

  function confirmChoice() {
    if (!selected?.photo) return;
    dialog.current?.close();
    // This remains a local preview; no ballot or registration request is sent.
    setConfirmedId(selected.id);
  }

  function resetChoice() {
    setSelectedId(null);
    setConfirmedId(null);
    window.requestAnimationFrame(() => choices.current?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus());
  }

  return (
    <main className="releve-voting-page levitate-home-redesign">
      <title>Votación Relevé | Levitate MX</title>
      <meta name="robots" content="noindex, nofollow" />
      <header className="releve-voting-page__header">
        <a href="/" aria-label="Levitate MX · Inicio"><img src="/assets/levitate-logo-mx.png" alt="Levitate MX" width="132" height="48" /></a>
        <h1>Vota <span>Relevé.</span></h1>
      </header>

      <fieldset ref={choices} className="releve-photo-grid" disabled={Boolean(confirmedId)}>
        <legend className="releve-voting-page__sr-only">Elige tu favorito de Relevé</legend>
        {releveVotingCandidates.map((candidate) => (
          <label className={`releve-photo-card${selectedId === candidate.id ? " is-selected" : ""}${!candidate.photo ? " is-pending" : ""}`} key={candidate.id}>
            <input type="radio" name="releve-choice" value={candidate.id} aria-label={`Academia: ${candidate.academy}. Coreografía: ${candidate.choreography}. Participante: ${candidate.participantName}.`} checked={selectedId === candidate.id} disabled={!candidate.photo} onChange={() => setSelectedId(candidate.id)} />
            <span className="releve-photo-card__photo">
              {candidate.photo ? <img src={candidate.photo} alt="" width="1024" height="1536" style={{ objectPosition: candidate.photoPosition }} decoding="async" /> : <span className="releve-photo-card__pending"><ImagePlus size={30} strokeWidth={1.2} aria-hidden="true" /><span>Foto pendiente</span></span>}
            </span>
            <CandidateInfo candidate={candidate} />
            {selectedId === candidate.id ? <span className="releve-photo-card__check" aria-hidden="true"><Check size={18} strokeWidth={2.5} /></span> : null}
          </label>
        ))}
      </fieldset>

      <div className="releve-voting-page__action">
        {confirmedId ? <>
          <p ref={receipt} tabIndex={-1} role="status"><Check size={18} aria-hidden="true" />Elección de prueba confirmada.</p>
          <button className="releve-voting-page__reset" type="button" onClick={resetChoice}>Elegir otra</button>
        </> : <button className="releve-voting-page__vote" type="button" disabled={!selected?.photo} onClick={() => dialog.current?.showModal()}>Votar</button>}
        <small>Vista previa · Los votos no se guardan.</small>
      </div>

      <dialog ref={dialog} className="releve-vote-dialog" aria-labelledby="releve-vote-confirmation">
        <button className="releve-vote-dialog__close" type="button" onClick={() => dialog.current?.close()} aria-label="Cerrar"><X size={20} aria-hidden="true" /></button>
        {selected?.photo ? <img src={selected.photo} alt="" width="1024" height="1536" style={{ objectPosition: selected.photoPosition }} /> : null}
        {selected ? <CandidateInfo candidate={selected} /> : null}
        <h2 id="releve-vote-confirmation">¿Confirmar tu elección?</h2>
        <div className="releve-vote-dialog__actions">
          <button type="button" onClick={() => dialog.current?.close()}>Cambiar</button>
          <button type="button" className="releve-voting-page__vote" onClick={confirmChoice}>Confirmar</button>
        </div>
        <small>Voto de prueba</small>
      </dialog>
    </main>
  );
}
