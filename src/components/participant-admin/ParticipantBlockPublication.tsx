import { useEffect, useId, useRef, useState } from 'react';
import { RegistrationApiError, requestRegistrationApi } from '../admin/registrationApi';

type PublicationMode = 'individual' | 'block_close';
type Block = { id: string; name: string; routineCount: number };
type SelectedBlock = {
  id: string;
  name: string;
  state: 'open' | 'closed' | 'changed';
  complete: boolean;
  completedRoutines: number;
  totalRoutines: number;
  closedAt: string | null;
  fingerprint: string;
};
type Publication = { mode: PublicationMode; sourceEventId: string; blocks: Block[]; selectedBlock: SelectedBlock | null };
type Props = {
  eventId: string;
  disabled?: boolean;
  onChanged?: () => void;
  onError?: (cause: unknown) => void;
};

const endpoint = '/api/registration/admin/participant-portal';
const stateLabels = { open: 'Abierto · En preparación', closed: 'Cerrado · Listo para sus participantes', changed: 'Cambió la evaluación · Requiere revisión' };

export function ParticipantBlockPublication({ eventId, disabled = false, onChanged, onError }: Props) {
  const headingId = useId();
  const [selection, setSelection] = useState({ eventId, blockId: '' });
  const blockId = selection.eventId === eventId ? selection.blockId : '';
  const identity = JSON.stringify([eventId, blockId]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const callbacks = useRef({ onChanged, onError });
  callbacks.current = { onChanged, onError };
  const [response, setResponse] = useState<{ identity: string; data: Publication } | null>(null);
  const [mode, setMode] = useState<PublicationMode>('individual');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [loginRequired, setLoginRequired] = useState(false);
  const [message, setMessage] = useState('');
  const readSequence = useRef(0);
  const writeSequence = useRef(0);
  const readController = useRef<AbortController | null>(null);
  const writeController = useRef<AbortController | null>(null);
  const view = response?.identity === identity ? response.data : null;
  const selected = view?.selectedBlock;
  const locked = disabled || loading || busy || loginRequired;
  const canClose = Boolean(view?.mode === 'block_close' && mode === view.mode && view.sourceEventId && selected?.complete
    && selected.totalRoutines > 0 && selected.completedRoutines === selected.totalRoutines
    && selected.state !== 'closed' && /^[a-f0-9]{64}$/.test(selected.fingerprint));

  function reportError(cause: unknown) {
    const unauthorized = cause instanceof RegistrationApiError && (cause.status === 401 || cause.status === 403);
    setError(cause instanceof Error ? cause.message : 'No pudimos revisar la publicación del bloque.');
    if (unauthorized) {
      setLoginRequired(true); setResponse(null);
      callbacks.current.onError?.(cause);
    }
  }

  useEffect(() => {
    ++writeSequence.current;
    writeController.current?.abort();
    setBusy(false); setMessage(''); setError(''); setLoginRequired(false);
    return () => { ++writeSequence.current; writeController.current?.abort(); };
  }, [identity, disabled]);

  useEffect(() => {
    const sequence = ++readSequence.current, selectedIdentity = identity;
    readController.current?.abort();
    if (!eventId || disabled || loginRequired) { setLoading(false); return; }
    const controller = new AbortController(); readController.current = controller;
    const params = new URLSearchParams({ publication: '1', eventId });
    if (blockId) params.set('blockId', blockId);
    setLoading(true);
    requestRegistrationApi<Publication>(`${endpoint}?${params}`, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted || sequence !== readSequence.current || selectedIdentity !== currentIdentity.current) return;
      if (!['individual', 'block_close'].includes(data.mode) || typeof data.sourceEventId !== 'string'
        || !Array.isArray(data.blocks) || (data.selectedBlock !== null && typeof data.selectedBlock !== 'object')) {
        throw new Error('No pudimos leer la revisión del bloque. Actualiza los datos.');
      }
      setResponse({ identity: selectedIdentity, data }); setMode(data.mode);
    }).catch(cause => {
      if (controller.signal.aborted || sequence !== readSequence.current || selectedIdentity !== currentIdentity.current) return;
      setResponse(null); reportError(cause);
    }).finally(() => {
      if (sequence === readSequence.current && selectedIdentity === currentIdentity.current) setLoading(false);
    });
    return () => { ++readSequence.current; controller.abort(); };
  }, [identity, eventId, blockId, disabled, reload, loginRequired]);

  async function mutate(action: 'publication.mode.save' | 'block.close' | 'block.reopen') {
    if (locked || !view || !eventId) return;
    if (action === 'block.close' && !canClose) return;
    if (action === 'block.reopen' && (!selected || selected.state === 'open')) return;
    const sequence = ++writeSequence.current, selectedIdentity = identity;
    const controller = new AbortController(); writeController.current = controller;
    ++readSequence.current; readController.current?.abort();
    setBusy(true); setLoading(false); setError(''); setMessage('');
    try {
      await requestRegistrationApi(endpoint, {
        method: 'POST', signal: controller.signal,
        body: JSON.stringify(action === 'publication.mode.save'
          ? { action, eventId, mode }
          : { action, eventId, blockId: selected!.id, ...(action === 'block.close' ? { fingerprint: selected!.fingerprint } : {}) }),
      });
      if (controller.signal.aborted || sequence !== writeSequence.current || selectedIdentity !== currentIdentity.current) return;
      setMessage(action === 'publication.mode.save' ? 'Forma de publicación guardada.'
        : action === 'block.close' ? 'Bloque cerrado. Su material se mostrará cuando la edición esté visible.'
          : 'Bloque reabierto. Su material quedó oculto sin borrar evaluaciones ni archivos.');
      callbacks.current.onChanged?.();
    } catch (cause) {
      if (controller.signal.aborted || sequence !== writeSequence.current || selectedIdentity !== currentIdentity.current) return;
      reportError(cause);
    } finally {
      if (sequence === writeSequence.current && selectedIdentity === currentIdentity.current) {
        setBusy(false); setReload(value => value + 1);
      }
    }
  }

  return <section className="pp-admin-section pp-admin-block-publication" aria-labelledby={headingId} aria-busy={loading || busy}>
    <h2 id={headingId}>Publicación por bloque</h2>
    <p>Al cerrar un bloque se liberan juntas sus puntuaciones y hojas de jueceo. Las fotos requieren archivos aprobados y una galería habilitada. La edición conserva su visibilidad actual.</p>
    <fieldset disabled={locked}>
      <label>Forma de publicación<select value={mode} disabled={!view} onChange={change => setMode(change.target.value as PublicationMode)}>
        <option value="individual">Publicación individual</option>
        <option value="block_close">Al cerrar cada bloque</option>
      </select></label>
      <div className="pp-admin-actions">
        <button disabled={!view || mode === view.mode} onClick={() => void mutate('publication.mode.save')}>Guardar forma de publicación</button>
        <button className="pp-admin-subtle" onClick={() => { setError(''); setMessage(''); setReload(value => value + 1); }}>Actualizar revisión</button>
      </div>
      {view && !view.sourceEventId && <p>El programa de esta edición todavía no está vinculado. Puedes preparar la forma de publicación ahora; los bloques aparecerán al importar el programa en la app.</p>}
      {view?.sourceEventId && view.mode === 'individual' && <p>La publicación individual sigue activa. Guarda «Al cerrar cada bloque» para mantener las evaluaciones ocultas hasta su cierre.</p>}
      {view?.sourceEventId && view.mode === 'block_close' && <>
        {view.blocks.length ? <label>Bloque de competencia<select value={selected?.id || blockId} onChange={change => setSelection({ eventId, blockId: change.target.value })}>
          {view.blocks.map(block => <option key={block.id} value={block.id}>{block.name} · {block.routineCount} coreografías</option>)}
        </select></label> : <p>El programa vinculado todavía no tiene bloques de competencia disponibles.</p>}
        {selected && <div className="pp-admin-block-summary">
          <p className={`pp-admin-block-state pp-admin-block-state--${selected.state}`}><strong>{stateLabels[selected.state]}</strong></p>
          <p>{selected.completedRoutines} de {selected.totalRoutines} coreografías con todos sus jueces completos.</p>
          {selected.state === 'changed' && <p>La evaluación o el programa cambió después del cierre. Su material permanece oculto hasta revisar y cerrar de nuevo.</p>}
          {!selected.complete && <p>Para cerrar el bloque deben estar completas sus evaluaciones y vinculadas todas sus coreografías.</p>}
          <div className="pp-admin-actions">
            <button disabled={!canClose} onClick={() => void mutate('block.close')}>{selected.state === 'closed' ? 'Bloque cerrado' : 'Cerrar y publicar bloque'}</button>
            {selected.state !== 'open' && <button className="pp-admin-subtle" onClick={() => void mutate('block.reopen')}>Reabrir y ocultar</button>}
          </div>
        </div>}
      </>}
    </fieldset>
    {loading && <p role="status">Revisando evaluaciones del bloque…</p>}
    {busy && <p role="status">Guardando la publicación del bloque…</p>}
    {message && <p className="pp-admin-message" role="status">{message}</p>}
    {error && <p className="pp-admin-error" role="alert">{error}{loginRequired && <> <a href="/login">Iniciar sesión</a></>}</p>}
  </section>;
}
