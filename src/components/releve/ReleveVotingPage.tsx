import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, X } from "lucide-react";
import { releveVotingCandidates } from "../../data/releveVotingCandidates";
import type { ReleveVotingCandidate } from "../../data/releveVotingCandidates";
import { connectReleveVoter, getReleveVoting, releveDeviceId, submitReleveVote } from './releveVotingApi';
import type { ReleveVotingState } from './releveVotingApi';
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
  const [state, setState] = useState<ReleveVotingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const receipt = useRef<HTMLParagraphElement>(null);
  const generation = useRef(0), writing = useRef(false);
  const selected = releveVotingCandidates.find((candidate) => candidate.id === selectedId) ?? null;
  const hasVoted = Boolean(state?.voter.hasVoted);
  const isOpen = state?.poll.status === 'open';
  const message = (error: unknown) => error instanceof Error ? error.message : 'No pudimos conectar la votación. Intenta de nuevo.';

  useEffect(() => {
    if (hasVoted) receipt.current?.focus();
  }, [hasVoted]);

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const read = async () => {
      if (document.hidden || writing.current) return;
      const version = generation.current;
      try {
        const next = await getReleveVoting(controller.signal);
        if (live && version === generation.current) { setState(next); setConnectionError(''); if (next.voter.hasVoted) setSelectedId(next.voter.candidateId); }
      } catch (error) { if (live && !controller.signal.aborted && version === generation.current) setConnectionError(message(error)); }
    };
    void read();
    const timer = window.setInterval(read, 15000);
    document.addEventListener('visibilitychange', read);
    return () => { live = false; controller.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', read); };
  }, []);

  async function connectDevice() {
    writing.current = true; generation.current++;
    setBusy(true); setError('');
    try {
      await connectReleveVoter({ fingerprint: await releveDeviceId() });
      const next = await getReleveVoting();
      if (!next.voter.authenticated) throw new Error('Permite las cookies de este sitio para votar.');
      setState(next);
      if (next.voter.hasVoted) setSelectedId(next.voter.candidateId);
    } catch (error) { setError(message(error)); }
    finally { writing.current = false; setBusy(false); }
  }

  useEffect(() => {
    if (isOpen && state?.poll.voterMode === 'device' && !state.voter.authenticated && !error) void connectDevice();
  }, [isOpen, state?.poll.voterMode, state?.voter.authenticated]);

  async function verifyVote() {
    writing.current = true; generation.current++;
    setBusy(true);
    try {
      const next = await getReleveVoting(); setState(next); setUncertain(false); setError(''); setConnectionError('');
      if (next.voter.hasVoted) setSelectedId(next.voter.candidateId);
    } catch (error) { setError(message(error)); }
    finally { writing.current = false; setBusy(false); }
  }

  async function confirmChoice() {
    if (!selected || !isOpen || busy || hasVoted) return;
    writing.current = true; generation.current++;
    setBusy(true); setError('');
    try {
      const result = await submitReleveVote(selected.id);
      if (!result.voter.hasVoted) throw new Error('No pudimos confirmar el voto guardado.');
      setState(current => current ? { ...current, voter: result.voter } : current);
      setSelectedId(result.voter.candidateId);
      setUncertain(false); dialog.current?.close();
    } catch {
      setUncertain(true); dialog.current?.close();
      setError('No pudimos confirmar la respuesta. Verifica si tu voto quedó registrado antes de intentar otra vez.');
    } finally { writing.current = false; setBusy(false); }
  }

  return (
    <main className="releve-voting-page levitate-home-redesign">
      <title>Votación Relevé | Levitate MX</title>
      <meta name="robots" content="noindex, nofollow" />
      <header className="releve-voting-page__header">
        <a href="/" aria-label="Levitate MX · Inicio"><img src="/assets/levitate-logo-mx.png" alt="Levitate MX" width="132" height="48" /></a>
        <h1>Vota <span>Relevé.</span></h1>
      </header>

      <fieldset className="releve-photo-grid" disabled={!isOpen || hasVoted || busy || uncertain}>
        <legend className="releve-voting-page__sr-only">Elige tu favorito de Relevé</legend>
        {releveVotingCandidates.map((candidate) => (
          <label className={`releve-photo-card${selectedId === candidate.id ? " is-selected" : ""}${!candidate.photo ? " is-pending" : ""}`} key={candidate.id}>
            <input type="radio" name="releve-choice" value={candidate.id} aria-label={`Academia: ${candidate.academy}. Coreografía: ${candidate.choreography}. Participante: ${candidate.participantName}.`} checked={selectedId === candidate.id} onChange={() => setSelectedId(candidate.id)} />
            <span className="releve-photo-card__photo">
              {candidate.photo ? <img src={candidate.photo} alt="" width="1024" height="1536" style={{ objectPosition: candidate.photoPosition }} decoding="async" /> : <span className="releve-photo-card__pending"><ImagePlus size={30} strokeWidth={1.2} aria-hidden="true" /><span>Foto pendiente</span></span>}
            </span>
            <CandidateInfo candidate={candidate} />
            {selectedId === candidate.id ? <span className="releve-photo-card__check" aria-hidden="true"><Check size={18} strokeWidth={2.5} /></span> : null}
          </label>
        ))}
      </fieldset>

      <div className="releve-voting-page__action">
        {hasVoted ? <p ref={receipt} tabIndex={-1} role="status"><Check size={18} aria-hidden="true" />Tu voto quedó registrado. ¡Gracias!</p>
          : !state ? <p role="status">{connectionError ? 'Votación no disponible por el momento.' : 'Conectando votación…'}</p>
          : !isOpen ? <p role="status">La votación está cerrada.</p>
          : <>
            <button className="releve-voting-page__vote" type="button" disabled={!selected || !state.voter.authenticated || busy || uncertain} onClick={() => dialog.current?.showModal()}>{busy ? 'Conectando…' : 'Votar'}</button>
            <small>Un voto por dispositivo · control aproximado.</small>
          </>}
        {error || connectionError ? <div className="releve-voting-error" role="alert"><p>{error || connectionError}</p><button type="button" disabled={busy} onClick={() => void (uncertain ? verifyVote() : state?.poll.voterMode === 'device' && isOpen && !state.voter.authenticated ? connectDevice() : verifyVote())}>{uncertain ? 'Verificar mi voto' : 'Volver a intentar'}</button></div> : null}
      </div>

      <dialog ref={dialog} className="releve-vote-dialog" aria-labelledby="releve-vote-confirmation">
        <button className="releve-vote-dialog__close" type="button" disabled={busy} onClick={() => dialog.current?.close()} aria-label="Cerrar"><X size={20} aria-hidden="true" /></button>
        {selected?.photo ? <img src={selected.photo} alt="" width="1024" height="1536" style={{ objectPosition: selected.photoPosition }} /> : null}
        {selected ? <CandidateInfo candidate={selected} /> : null}
        <h2 id="releve-vote-confirmation">¿Confirmar tu elección?</h2>
        <div className="releve-vote-dialog__actions">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>Cambiar</button>
          <button type="button" className="releve-voting-page__vote" disabled={busy} onClick={() => void confirmChoice()}>{busy ? 'Guardando…' : 'Confirmar voto'}</button>
        </div>
        <small>Una vez registrado, tu voto no se puede cambiar.</small>
      </dialog>
    </main>
  );
}
