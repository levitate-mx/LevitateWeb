import { useEffect, useRef, useState } from 'react';
import { parseParticipantJudgingProgram, type ParticipantJudgingProgramLink } from '../../../shared/participant-judging-program.js';
import { requestRegistrationApi } from '../admin/registrationApi';

type Props = { eventId: string; sourceEventId: string; disabled?: boolean; onLinked?: () => void };
type Program = { identity: string; fileName: string; links: ParticipantJudgingProgramLink[] };

export function ParticipantJudgingProgram({ eventId, sourceEventId, disabled = false, onLinked }: Props) {
  const [program, setProgram] = useState<Program | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const identity = JSON.stringify([eventId, sourceEventId]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  useEffect(() => {
    ++generation.current;
    controller.current?.abort();
    setProgram(null); setBusy(false); setMessage(''); setError('');
    return () => { ++generation.current; controller.current?.abort(); };
  }, [identity]);

  async function readProgram(file: File) {
    const sequence = ++generation.current, selectedIdentity = currentIdentity.current;
    setProgram(null); setMessage(''); setError('');
    try {
      if (!file.name.toLowerCase().endsWith('.xls') || file.size > 2 * 1024 * 1024) {
        throw new Error('Selecciona el programa .xls exportado desde esta web, de hasta 2 MB.');
      }
      const contents = await file.text();
      if (sequence !== generation.current || selectedIdentity !== currentIdentity.current) return;
      const links = parseParticipantJudgingProgram(contents);
      setProgram({ identity: selectedIdentity, fileName: file.name, links });
    } catch (cause) {
      if (sequence !== generation.current || selectedIdentity !== currentIdentity.current) return;
      setError(cause instanceof Error ? cause.message : 'No pudimos leer el programa.');
    }
  }

  async function linkProgram() {
    if (disabled || busy || !program || program.identity !== currentIdentity.current || !eventId || !sourceEventId) return;
    const sequence = ++generation.current, selectedIdentity = currentIdentity.current;
    const request = new AbortController(); controller.current = request;
    setBusy(true); setMessage(''); setError('');
    try {
      await requestRegistrationApi('/api/registration/admin/participant-portal', {
        method: 'POST', signal: request.signal,
        body: JSON.stringify({ action: 'judging.program.link', eventId, sourceEventId, links: program.links }),
      });
      if (sequence !== generation.current || selectedIdentity !== currentIdentity.current) return;
      setMessage(`${program.links.length} coreografías vinculadas con el jueceo. Las hojas se obtendrán automáticamente al consultar sus resúmenes.`);
      onLinked?.();
    } catch (cause) {
      if (request.signal.aborted || sequence !== generation.current || selectedIdentity !== currentIdentity.current) return;
      setError(cause instanceof Error ? cause.message : 'No pudimos vincular el programa.');
    } finally {
      if (sequence === generation.current && selectedIdentity === currentIdentity.current) setBusy(false);
    }
  }

  return <div className="pp-admin-judging-program">
    <h3>Vincular el programa de competencia</h3>
    <p>Selecciona el mismo programa .xls exportado desde esta web e importado en la app de jueceo. Conserva sus columnas ID e ID INSCRIPCIÓN para asociar cada evaluación con la coreografía correspondiente.</p>
    <label>Programa importado en la app<input type="file" accept=".xls" disabled={disabled || busy || !eventId || !sourceEventId} onChange={change => {
      const file = change.target.files?.[0]; change.target.value = '';
      if (file) void readProgram(file);
    }} /></label>
    {program?.identity === identity && <p role="status">{program.links.length} coreografías listas para vincular · {program.fileName}</p>}
    <button disabled={disabled || busy || !program || program.identity !== identity || !eventId || !sourceEventId} aria-busy={busy} onClick={() => void linkProgram()}>
      {busy ? 'Vinculando programa…' : 'Vincular programa con jueceo'}
    </button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
