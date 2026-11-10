import { useEffect, useRef, useState } from 'react';
import { RegistrationApiError, requestRegistrationApi } from '../admin/registrationApi';

type Routine = { danceId: string; title: string };
type Trial = {
  folder: { id: string; name: string; url: string | null; accountEmail: string };
  eventId: string;
  participantId: string;
  danceId: string;
  routineId: string;
  imported: number;
  reused: number;
  previewUrl: string;
};
type Props = {
  eventId: string;
  participantId: string;
  disabled?: boolean;
  onComplete?: () => void;
  onError?: (cause: unknown) => void;
};
const endpoint = '/api/registration/admin/participant-portal';

function verifiedLinks(trial: Trial, eventId: string, participantId: string, danceId: string) {
  if (!trial || trial.eventId !== eventId || trial.participantId !== participantId || trial.danceId !== danceId
    || !trial.folder || !/^[A-Za-z0-9_-]{10,200}$/.test(trial.folder.id)) throw new Error('La respuesta no corresponde a esta prueba. Vuelve a consultar sus previews.');
  const preview = new URL(trial.previewUrl, 'https://levitate.mx');
  if (preview.origin !== 'https://levitate.mx' || preview.pathname !== '/admin/mi-levitate/resumen'
    || preview.searchParams.get('eventId') !== eventId || preview.searchParams.get('participantId') !== participantId
    || preview.searchParams.getAll('eventId').length !== 1 || preview.searchParams.getAll('participantId').length !== 1
    || preview.hash) throw new Error('No pudimos validar los enlaces de esta prueba. Vuelve a consultar sus previews.');
  let folderUrl: string | null = null;
  if (trial.folder.url !== null) {
    const folder = new URL(trial.folder.url);
    if (folder.protocol !== 'https:' || folder.hostname !== 'drive.google.com' || folder.port || folder.username || folder.password
      || !new RegExp(`^/drive/(?:u/\\d+/)?folders/${trial.folder.id}/?$`).test(folder.pathname)
      || folder.hash) throw new Error('No pudimos validar el enlace de la carpeta de prueba. Vuelve a consultar sus previews.');
    folderUrl = folder.href;
  }
  return { folderUrl, previewUrl: preview.pathname + preview.search };
}

export function ParticipantDriveDemoTrial({ eventId, participantId, disabled = false, onComplete, onError }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [danceId, setDanceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<(Trial & { folderUrl: string | null }) | null>(null);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busyRequest = useRef(false);
  const identity = JSON.stringify([eventId, participantId]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;

  useEffect(() => {
    const sequence = ++generation.current;
    const request = new AbortController();
    controller.current?.abort(); controller.current = request;
    busyRequest.current = false;
    setRoutines([]); setDanceId(''); setResult(null); setError(''); setBusy(false); setLoading(true);
    if (eventId && participantId) {
      const params = new URLSearchParams({ photoTrial: '1', eventId, participantId });
      requestRegistrationApi<{ routines: Routine[] }>(`${endpoint}?${params}`, { signal: request.signal }).then(response => {
        if (request.signal.aborted || sequence !== generation.current) return;
        setRoutines(response.routines);
        setDanceId(response.routines.length === 1 ? response.routines[0].danceId : '');
      }).catch(cause => {
        if (request.signal.aborted || sequence !== generation.current) return;
        setError(cause instanceof Error ? cause.message : 'No pudimos consultar sus coreografías.');
        if (cause instanceof RegistrationApiError && (cause.status === 401 || cause.status === 403)) onError?.(cause);
      }).finally(() => {
        if (!request.signal.aborted && sequence === generation.current) setLoading(false);
      });
    } else setLoading(false);
    return () => { ++generation.current; request.abort(); controller.current?.abort(); };
  }, [identity]);

  async function prepareTrial() {
    if (disabled || loading || busyRequest.current || !eventId || !participantId || !routines.some(routine => routine.danceId === danceId)) return;
    busyRequest.current = true;
    const sequence = ++generation.current, selectedIdentity = currentIdentity.current, selectedDanceId = danceId;
    const request = new AbortController(); controller.current = request;
    setBusy(true); setResult(null); setError('');
    try {
      const response = await requestRegistrationApi<Trial>(endpoint, { method: 'POST', signal: request.signal,
        body: JSON.stringify({ action: 'photo.demo.trial', eventId, participantId, danceId: selectedDanceId }) });
      if (request.signal.aborted || sequence !== generation.current || selectedIdentity !== currentIdentity.current) return;
      const links = verifiedLinks(response, eventId, participantId, selectedDanceId);
      setResult({ ...response, ...links });
      onComplete?.();
    } catch (cause) {
      if (request.signal.aborted || sequence !== generation.current || selectedIdentity !== currentIdentity.current) return;
      setError(cause instanceof Error ? cause.message : 'No pudimos preparar la prueba en Drive.');
      if (cause instanceof RegistrationApiError && (cause.status === 401 || cause.status === 403)) onError?.(cause);
    } finally {
      if (sequence === generation.current && selectedIdentity === currentIdentity.current) { busyRequest.current = false; setBusy(false); }
    }
  }

  return <div className="pp-admin-drive-demo-trial">
    <h3>Probar fotos desde Drive</h3>
    <p>Prepara una carpeta con el nombre de su coreografía y participante, y comprueba la llegada de dos fotos demo a su pasaporte. Son imágenes de ejemplo; no corresponden a esta persona.</p>
    {loading ? <p role="status">Consultando sus coreografías…</p> : routines.length ? <label>Coreografía para la prueba<select value={danceId} disabled={disabled || busy}
      onChange={change => { setDanceId(change.target.value); setResult(null); setError(''); }}>
      <option value="">Seleccionar coreografía</option>{routines.map(routine => <option key={routine.danceId} value={routine.danceId}>{routine.title}</option>)}
    </select></label> : !error && <p>Esta persona no tiene coreografías registradas en la edición seleccionada.</p>}
    <button type="button" disabled={disabled || busy || loading || !danceId} aria-busy={busy} onClick={() => void prepareTrial()}>
      {busy ? 'Preparando y comprobando fotos…' : 'Probar carpeta de fotos en Drive'}
    </button>
    <p>La prueba conserva la visibilidad de la edición y guarda las fotos en borrador para revisión interna. La detección continua de nuevas fotos todavía no está habilitada.</p>
    {result && <div role="status">
      <p>Las dos fotos demo están listas para revisar en su pasaporte. Carpeta: <strong>{result.folder.name}</strong>{result.folder.accountEmail ? ` · ${result.folder.accountEmail}` : ''}.</p>
      <div className="pp-admin-actions">
        {result.folderUrl && <a className="pp-admin-preview-link" href={result.folderUrl} target="_blank" rel="noreferrer">Abrir carpeta de prueba ↗</a>}
        <a className="pp-admin-preview-link" href={result.previewUrl} target="_blank" rel="noreferrer">Ver previews en su pasaporte ↗</a>
      </div>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
