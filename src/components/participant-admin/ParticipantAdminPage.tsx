import { useEffect, useRef, useState } from 'react';
import { RegistrationApiError, requestRegistrationApi } from '../admin/registrationApi';
import { MediaDriveConnectionPanel } from '../admin/MediaDriveConnectionPanel';
import { prepareParticipantPhoto } from './prepareParticipantPhoto';
import { ParticipantJudgingProgram } from './ParticipantJudgingProgram';
import './ParticipantAdminPage.css';

type Event = { id: string; title: string; season: string; venue: string; startsAt: string; published: boolean };
type Person = { id: string; name: string; academy: string; accesses: { id: string; active: boolean; eventId: string }[] };
type Routine = { id: string | null; danceId: string; eventId: string; title: string; category: string; division: string; level: string; status: string; sourceEventId?: string; sourceRoutineId?: string; result: Record<string, unknown> | null; judging: { judges: unknown[] } | null; photosPublished: boolean };
type Asset = { id: string; kind: string; routineId?: string; participantId?: string; published?: boolean; fileName?: string };
type Pagination = { offset: number; limit: number; hasMore: boolean };
type Data = { events: Event[]; participants: Person[]; routines: Routine[]; assets: Asset[]; pagination?: Pagination; routinePagination?: Pagination; assetPagination?: Pagination };
type ResultForm = { score: string; maxScore: string; medal: string; directCompetition: boolean; eligibleCount: string; place: string };
type MediaStorage = { ready: boolean; provider: string; accountEmail?: string; folderName?: string };
type JudgingSource = { events: { id: string; name: string }[]; sourceEventId: string };
const emptyResult: ResultForm = { score: '', maxScore: '', medal: 'participacion', directCompetition: false, eligibleCount: '1', place: '' };
const endpoint = '/api/registration/admin/participant-portal';

async function api<T>(suffix = '', body?: unknown): Promise<T> {
  return requestRegistrationApi<T>(endpoint + suffix, { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined });
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
async function fileData(file: File | Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function ParticipantAdminPage() {
  const [data, setData] = useState<Data>({ events: [], participants: [], routines: [], assets: [] });
  const [eventId, setEventId] = useState('');
  const [search, setSearch] = useState('');
  const [personOffset, setPersonOffset] = useState(0);
  const [routineSearch, setRoutineSearch] = useState('');
  const [routineOffset, setRoutineOffset] = useState(0);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetOffset, setAssetOffset] = useState(0);
  const [assetPagination, setAssetPagination] = useState<Pagination>();
  const [personId, setPersonId] = useState('');
  const [danceId, setDanceId] = useState('');
  const [eventDraft, setEventDraft] = useState<Event>({ id: '', title: '', season: '', venue: 'edomex', startsAt: '', published: false });
  const [result, setResult] = useState<ResultForm>(emptyResult);
  const [judging, setJudging] = useState('');
  const [photosPublished, setPhotosPublished] = useState(false);
  const [qr, setQr] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [mediaStorage, setMediaStorage] = useState<MediaStorage | null>(null);
  const [storageMessage, setStorageMessage] = useState('');
  const [judgingSource, setJudgingSource] = useState<JudgingSource>({ events: [], sourceEventId: '' });
  const [judgingSourceMessage, setJudgingSourceMessage] = useState('');
  const latest = useRef(0);
  const latestAssets = useRef(0);
  const person = data.participants.find(row => row.id === personId);
  const routine = data.routines.find(row => row.danceId === danceId);
  const edition = data.events.find(row => row.id === eventId);
  const reportError = (cause: unknown) => {
    if (cause instanceof RegistrationApiError && (cause.status === 401 || cause.status === 403)) {
      ++latest.current; ++latestAssets.current;
      setAuthorized(false);
      setData({ events: [], participants: [], routines: [], assets: [] });
      setAssets([]); setAssetPagination(undefined); setQr('');
      setPersonId(''); setDanceId('');
    }
    setError(cause instanceof Error ? cause.message : 'No se pudo completar la solicitud.');
  };
  const refresh = async (query = search, selectedEvent = eventId) => {
    const sequence = ++latest.current;
    const response = await api<Data>(`?eventId=${encodeURIComponent(selectedEvent)}&q=${encodeURIComponent(query)}&offset=${personOffset}&routineQ=${encodeURIComponent(routineSearch)}&routineOffset=${routineOffset}`);
    if (sequence === latest.current) { setData(response); setAuthorized(true); }
  };
  const refreshAssets = async () => {
    const sequence = ++latestAssets.current;
    if (!eventId || (!personId && !routine?.id)) { setAssets([]); setAssetPagination(undefined); return; }
    const params = new URLSearchParams({ eventId, assetOffset: String(assetOffset) });
    if (personId) params.set('participantId', personId);
    if (routine?.id) params.set('routineId', routine.id);
    const response = await api<Data>('?' + params);
    if (sequence === latestAssets.current) { setAssets(response.assets); setAssetPagination(response.assetPagination); }
  };
  useEffect(() => {
    const timer = setTimeout(() => { refresh().catch(reportError); }, 220);
    return () => clearTimeout(timer);
  }, [eventId, search, personOffset, routineSearch, routineOffset]);
  useEffect(() => { refreshAssets().catch(reportError); }, [eventId, personId, routine?.id, assetOffset]);
  useEffect(() => {
    if (!authorized) { setMediaStorage(null); return; }
    let active = true;
    api<{ mediaStorage: MediaStorage }>('?storage=1').then(response => {
      if (active) { setMediaStorage(response.mediaStorage); setStorageMessage(''); }
    }).catch(cause => {
      if (!active) return;
      if (cause instanceof RegistrationApiError && (cause.status === 401 || cause.status === 403)) reportError(cause);
      else setStorageMessage(cause instanceof Error ? cause.message : 'Prepara la carpeta privada para cargar material.');
    });
    return () => { active = false; };
  }, [authorized]);
  useEffect(() => {
    let active = true;
    setJudgingSource({ events: [], sourceEventId: '' }); setJudgingSourceMessage('');
    if (authorized && eventId) api<JudgingSource>(`?judging=1&eventId=${encodeURIComponent(eventId)}`)
      .then(value => { if (active) setJudgingSource(value); })
      .catch(cause => { if (active) setJudgingSourceMessage(cause instanceof Error ? cause.message : 'No se pudo comprobar la conexión de jueceo.'); });
    return () => { active = false; };
  }, [authorized, eventId]);
  useEffect(() => {
    const current = data.events.find(row => row.id === eventId);
    if (current) setEventDraft(current);
    setQr(''); setPersonId(''); setDanceId(''); setPersonOffset(0); setRoutineOffset(0); setAssetOffset(0);
  }, [eventId]);
  useEffect(() => {
    if (!routine) { setResult(emptyResult); setJudging(''); setPhotosPublished(false); return; }
    const value = routine.result;
    setResult(value ? { score: String(value.score ?? ''), maxScore: String(value.maxScore ?? ''), medal: String(value.medal ?? 'participacion'), directCompetition: Boolean(value.directCompetition), eligibleCount: String(value.eligibleCount ?? 1), place: String(value.place ?? '') } : emptyResult);
    setJudging(routine.judging ? JSON.stringify(routine.judging, null, 2) : '');
    setPhotosPublished(Boolean(routine.photosPublished));
  }, [danceId, data.routines]);
  const perform = async (work: () => Promise<void>, success: string) => {
    setBusy(true); setError(''); setMessage('');
    try { await work(); await refresh(); await refreshAssets(); setMessage(success); }
    catch (e) { reportError(e); }
    finally { setBusy(false); }
  };
  const routinePayload = () => ({ action: 'routine.save', eventId, danceId, sourceEventId: routine?.sourceEventId || '', sourceRoutineId: routine?.sourceRoutineId || '', result: result.score === '' ? null : { score: Number(result.score), maxScore: Number(result.maxScore), medal: result.medal, directCompetition: result.directCompetition, eligibleCount: Number(result.eligibleCount), place: result.directCompetition && result.place ? Number(result.place) : null }, judging: judging.trim() ? JSON.parse(judging) : null, photosPublished });
  const upload = async (file: File | Blob, kind: string, fileName: string, participantId?: string) => {
    if (file.size > 12 * 1024 * 1024) throw new Error('Cada archivo debe pesar menos de 12 MB.');
    if (kind !== 'photo' && file.size > 8 * 1024 * 1024) throw new Error('Los documentos deben pesar hasta 8 MB.');
    const prepared = kind === 'photo' ? await prepareParticipantPhoto(file, fileName) : null;
    const content = prepared?.blob || file;
    return api<{ assetId: string }>('', { action: 'asset.upload', eventId, kind, fileName: prepared?.fileName || fileName, contentType: content.type, base64Data: await fileData(content), ...(prepared ? { width: prepared.width, height: prepared.height } : {}), ...(participantId ? { participantId } : { routineId: routine?.id }) });
  };
  const publishDiploma = (assetId: string) => perform(async () => {
    await api('', { action: 'asset.publish', assetId, published: true });
    await api('', { action: 'document.assign', eventId, participantId: personId, assetId, published: true });
  }, 'Diploma publicado.');

  return <main className="pp-admin">
    <header><a href="/admin">← Administración Levitate</a><nav aria-label="Herramientas de Mi Levitate"><a href="/admin/foto-video">Foto y video</a><a href="/mi-levitate/demo" target="_blank" rel="noreferrer">Ver resumen de ejemplo ↗</a></nav><span>MI LEVITATE / PUBLICACIÓN</span></header>
    <h1>Su experiencia.<br /><em>En tus manos.</em></h1>
    <p className="pp-admin-intro">Vincula cada presentación, revisa sus resultados y publica los documentos y fotografías de sus integrantes.</p>
    {authorized && <section className="pp-admin-drive" aria-label="Drive y vistas previas de Mi Levitate"><MediaDriveConnectionPanel /><p>La carpeta de foto y video corresponde al respaldo de originales. Las vistas de Mi Levitate se guardan en la carpeta privada indicada abajo y se revisan y aprueban por presentación.</p></section>}
    {authorized && <section className="pp-admin-section" aria-label="Vistas previas privadas en Drive">
      <h2>Vistas previas privadas en Drive</h2>
      <p>Se usa el espacio disponible de Drive para guardar las copias de Mi Levitate. Las fotos se preparan con marca de agua antes de subirlas y los originales se conservan.</p>
      {mediaStorage?.ready && <p role="status">Carpeta lista: <strong>{mediaStorage.folderName || 'Mi Levitate'}</strong>{mediaStorage.accountEmail ? ` · ${mediaStorage.accountEmail}` : ''}.</p>}
      {storageMessage && <p>{storageMessage}</p>}
      <button disabled={busy} onClick={() => perform(async () => {
        const response = await api<{ mediaStorage: MediaStorage }>('', { action: 'storage.prepare' });
        setMediaStorage(response.mediaStorage); setStorageMessage('');
      }, 'Carpeta privada de Drive verificada. Ya puedes cargar las vistas previas.')}>
        {mediaStorage?.ready ? 'Comprobar carpeta privada' : 'Preparar carpeta privada en Drive'}
      </button>
      <button disabled={busy || !mediaStorage?.ready} onClick={() => perform(async () => {
        for (const slot of ['foto-1', 'foto-2']) await api('', { action: 'demo.photo.prepare', slot });
      }, 'Las dos fotos de ejemplo están guardadas en Drive y disponibles en la demo.')}>
        Guardar fotos de la demo en Drive
      </button>
    </section>}
    {error && <div className="pp-admin-error" role="alert">{error} <a href="/login">Iniciar sesión</a></div>}
    {message && <p className="pp-admin-message" role="status">{message}</p>}
    <fieldset disabled={busy || !authorized}>
      <section className="pp-admin-section">
        <h2>01 / Edición</h2>
        <label>Edición<select value={eventId} onChange={e => setEventId(e.target.value)}><option value="">Seleccionar edición</option>{data.events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
        <details><summary>Crear o actualizar edición</summary><div className="pp-admin-fields">
          <label>Identificador de edición<input value={eventDraft.id} onChange={e => setEventDraft({ ...eventDraft, id: e.target.value })} placeholder="otono-2026-edomex" /></label>
          <label>Título<input value={eventDraft.title} onChange={e => setEventDraft({ ...eventDraft, title: e.target.value })} placeholder="Levitate MX · Otoño 2026" /></label>
          <label>Temporada<input value={eventDraft.season} onChange={e => setEventDraft({ ...eventDraft, season: e.target.value })} placeholder="Otoño 2026" /></label>
          <label>Sede<select value={eventDraft.venue} onChange={e => setEventDraft({ ...eventDraft, venue: e.target.value })}>{['edomex', 'cdmx', 'puebla', 'veracruz'].map(v => <option key={v}>{v}</option>)}</select></label>
          <label>Inicio<input type="date" value={eventDraft.startsAt?.slice(0, 10) || ''} onChange={e => setEventDraft({ ...eventDraft, startsAt: e.target.value })} /></label>
          <label className="pp-admin-check"><input type="checkbox" checked={Boolean(eventDraft.published)} onChange={e => setEventDraft({ ...eventDraft, published: e.target.checked })} />Edición visible para sus participantes</label>
        </div><button onClick={() => perform(async () => { await api('', { action: 'event.upsert', event: eventDraft }); setEventId(eventDraft.id); }, 'Edición guardada.')}>Guardar edición</button></details>
      </section>
      {eventId && <>
        <section className="pp-admin-section">
          <h2>Jueceo y reconocimientos automáticos</h2>
          <p>Exporta el programa desde administración e impórtalo en la app de jueceo. La edición y sus coreografías quedarán vinculadas automáticamente. Los resultados y las hojas se leen de la app; cada participante descarga su reconocimiento sin cargar PDFs.</p>
          <p role="status">{judgingSource.sourceEventId ? `Conectado a ${judgingSource.events.find(source=>source.id===judgingSource.sourceEventId)?.name || 'su evento de jueceo'}.` : 'La conexión se completará al importar el programa exportado desde esta web.'}</p>
          {judgingSourceMessage && <p role="status">{judgingSourceMessage}</p>}
          <p>Las evaluaciones incompletas permanecen pendientes. Los lugares se muestran cuando termina la categoría y la edición debe estar visible para sus participantes.</p>
          <details><summary>Vinculación de programas anteriores</summary>
          <label>Evento de jueceo<select value={judgingSource.sourceEventId} onChange={e => setJudgingSource({ ...judgingSource, sourceEventId: e.target.value })}>
            <option value="">Sin vincular</option>{judgingSource.events.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select></label>
          <button onClick={() => perform(async () => { await api('', { action: 'judging.source.save', eventId, sourceEventId: judgingSource.sourceEventId }); }, 'Conexión de jueceo guardada. Los datos se consultarán automáticamente.')}>Guardar conexión de jueceo</button>
          <p>La asociación utiliza la identidad de cada coreografía. Las evaluaciones incompletas permanecen pendientes y una edición oculta no muestra hojas a sus participantes.</p>
          <ParticipantJudgingProgram eventId={eventId} sourceEventId={judgingSource.sourceEventId} disabled={busy}
            onLinked={() => { void refresh().catch(reportError); }} />
          </details>
        </section>
        <section className="pp-admin-section">
          <h2>02 / Participantes y diplomas</h2>
          <label>Buscar por nombre o academia<input value={search} onChange={e => { setSearch(e.target.value); setPersonOffset(0); }} placeholder="Escribe para buscar" /></label>
          <label>Participante<select value={personId} onChange={e => { setPersonId(e.target.value); setQr(''); setAssetOffset(0); }}><option value="">Seleccionar participante</option>{data.participants.map(p => <option key={p.id} value={p.id}>{p.name} · {p.academy}</option>)}</select></label>
          <div className="pp-admin-actions"><button disabled={personOffset === 0} onClick={() => { setPersonOffset(Math.max(0, personOffset - 100)); setPersonId(''); }}>Anterior</button><span>Participantes · página {Math.floor(personOffset / 100) + 1}</span><button disabled={!data.pagination?.hasMore} onClick={() => { setPersonOffset(personOffset + 100); setPersonId(''); }}>Siguientes</button></div>
          {person && <div className="pp-admin-person">
            <h3>{person.name}</h3><p>{person.academy}</p>
            <div className="pp-admin-actions"><a className="pp-admin-preview-link" href={`/admin/mi-levitate/resumen?${new URLSearchParams({ eventId, participantId: person.id })}`} target="_blank" rel="noreferrer">Revisar su resumen de Mi Levitate ↗</a></div>
            <p>Vista interna con los borradores y archivos de esta persona. Abrirla no genera un acceso ni publica contenido.</p>
            <p>El reconocimiento se genera automáticamente en su resumen. Conserva el QR que ya recibió; no necesitas reemplazarlo para preparar su diploma.</p>
            <details><summary>Accesos y documentos anteriores</summary>
            <div className="pp-admin-actions"><button onClick={() => perform(async () => { const value = await api<{ entryUrl: string }>('', { action: 'access.create', eventId, participantId: personId, rotate: person.accesses?.some(a => a.active && a.eventId === eventId) || false }); setQr(new URL(value.entryUrl, location.origin).href); }, 'Acceso individual creado. Guarda su QR antes de salir.')}>{person.accesses?.some(a => a.active && a.eventId === eventId) ? 'Reemplazar acceso y generar nuevo QR' : 'Crear enlace y QR individual'}</button>
              <button disabled={!qr} onClick={() => perform(async () => {
                const { generateParticipantDiploma } = await import('../../../shared/participant-diploma.js');
                const logoBytes = await fetch('/assets/levitate-logo-mx.png').then(r => r.arrayBuffer());
                const templateBytes = await fetch('/assets/participant-recognition-template.pdf').then(r => r.arrayBuffer());
                const unicodeFontBytes = await fetch('/assets/participant-recognition-unicode.ttf').then(r => r.arrayBuffer());
                const pdf = await generateParticipantDiploma({ name: person.name, academy: person.academy, eventTitle: edition?.title || '', season: edition?.season, venue: edition?.venue, dateLabel: edition?.startsAt?.slice(0, 10), entryUrl: qr || undefined, logoBytes, templateBytes, unicodeFontBytes });
                const blob = new Blob([new Uint8Array(pdf)], { type: 'application/pdf' });
                download(blob, `diploma-${person.id}.pdf`);
                const asset = await upload(blob, 'diploma', `diploma-${person.id}.pdf`, person.id);
                await api('', { action: 'document.assign', eventId, participantId: person.id, assetId: asset.assetId, published: false });
              }, 'PDF generado y guardado en borrador. Revísalo antes de publicarlo.')}>Generar diploma PDF</button>
            </div>
            {!qr && <p>Para generar un diploma con QR, crea o reemplaza el acceso individual primero. También puedes cargar un PDF que ya tengas aprobado.</p>}
            {qr && <div className="pp-admin-qr"><p>Este enlace da acceso a sus documentos. Entrégalo únicamente al participante o su responsable.</p><input aria-label="Enlace individual privado" readOnly value={qr} /><button onClick={() => perform(async () => { const { generateParticipantQrSvg } = await import('../../../shared/participant-diploma.js'); const svg = await generateParticipantQrSvg(qr); download(new Blob([svg], { type: 'image/svg+xml' }), `qr-${person.id}.svg`); }, 'QR descargado.')}>Descargar QR SVG</button></div>}
            <label>Cargar un diploma PDF aprobado<input type="file" accept="application/pdf" onChange={e => { const file = e.target.files?.[0]; if (file) void perform(async () => { const asset = await upload(file, 'diploma', file.name, person.id); await api('', { action: 'document.assign', eventId, participantId: person.id, assetId: asset.assetId, published: false }); }, 'Diploma cargado en borrador.'); e.target.value = ''; }} /></label>
            <ul className="pp-admin-assets">{assets.filter(a => a.kind === 'diploma' && a.participantId === personId).map(a => <li key={a.id}><a target="_blank" rel="noreferrer" href={`${endpoint}?assetId=${encodeURIComponent(a.id)}`}>Revisar {a.fileName || 'diploma'}</a><button onClick={() => publishDiploma(a.id)}>Publicar este diploma</button></li>)}</ul>
            {person.accesses?.filter(a => a.active && a.eventId === eventId).map(a => <button className="pp-admin-subtle" key={a.id} onClick={() => perform(async () => { await api('', { action: 'access.revoke', accessId: a.id }); setQr(''); }, 'Acceso revocado.')}>Revocar acceso {a.id.slice(-6)}</button>)}
            </details>
          </div>}
        </section>
        <section className="pp-admin-section">
          <h2>03 / Presentaciones y resultados</h2>
          <label>Buscar presentación<input value={routineSearch} onChange={e => { setRoutineSearch(e.target.value); setRoutineOffset(0); }} /></label>
          <label>Presentación<select value={danceId} onChange={e => { setDanceId(e.target.value); setAssetOffset(0); }}><option value="">Seleccionar presentación</option>{data.routines.map(r => <option key={r.danceId} value={r.danceId}>{r.title} · {r.division} · {r.level}</option>)}</select></label>
          <div className="pp-admin-actions"><button disabled={routineOffset === 0} onClick={() => { setRoutineOffset(Math.max(0, routineOffset - 200)); setDanceId(''); }}>Anterior</button><span>Presentaciones · página {Math.floor(routineOffset / 200) + 1}</span><button disabled={!data.routinePagination?.hasMore} onClick={() => { setRoutineOffset(routineOffset + 200); setDanceId(''); }}>Siguientes</button></div>
          {routine && <>
            <p>Estado: <strong>{routine.status === 'published' ? 'Publicado' : 'Borrador'}</strong>. Guarda el puntaje y la medalla oficiales de esta presentación.</p>
            <div className="pp-admin-fields"><label>Puntaje<input type="number" step="0.01" min="0" value={result.score} onChange={e => setResult({ ...result, score: e.target.value })} /></label><label>Puntaje máximo<input type="number" min="1" value={result.maxScore} onChange={e => setResult({ ...result, maxScore: e.target.value })} /></label><label>Medalla<select value={result.medal} onChange={e => setResult({ ...result, medal: e.target.value })}>{['oro', 'plata', 'bronce', 'participacion'].map(m => <option key={m}>{m}</option>)}</select></label><label className="pp-admin-check"><input type="checkbox" checked={result.directCompetition} onChange={e => setResult({ ...result, directCompetition: e.target.checked, place: '' })} />Competencia directa</label>
              {result.directCompetition && <><label>Presentaciones elegibles<input type="number" min="2" value={result.eligibleCount} onChange={e => setResult({ ...result, eligibleCount: e.target.value })} /></label><label>Lugar oficial<select value={result.place} onChange={e => setResult({ ...result, place: e.target.value })}><option value="">Sin lugar de podio</option><option value="1">1.er lugar</option><option value="2">2.º lugar</option><option value="3">3.er lugar</option></select></label></>}
            </div>
            <p>Las hojas de jueceo se consultan automáticamente desde el evento vinculado. Usa la vista interna del participante para revisarlas antes de mostrar la edición.</p>
            <label className="pp-admin-check"><input type="checkbox" checked={photosPublished} onChange={e => setPhotosPublished(e.target.checked)} />Galería disponible al publicar esta presentación</label>
            <div className="pp-admin-actions"><button onClick={() => perform(async () => { await api('', routinePayload()); }, 'Borrador guardado. Los cambios aún no son visibles.')}>Guardar borrador</button><button disabled={!routine.id} onClick={() => perform(async () => { const saved = await api<{ routineId: string }>('', routinePayload()); await api('', { action: 'routine.publish', routineId: saved.routineId }); }, 'Presentación publicada para sus integrantes.')}>Publicar presentación</button>{routine.status === 'published' && <button onClick={() => perform(async () => { await api('', { action: 'routine.unpublish', routineId: routine.id }); }, 'Presentación retirada de los perfiles.')}>Retirar publicación</button>}</div>
            {routine.id && <div className="pp-admin-uploads"><h3>Fotografías</h3><p>Carga las fotos de una sola presentación. Sus integrantes recibirán el mismo álbum. Las vistas previas se preparan automáticamente con la marca de agua de Levitate. Recomendado: entre 10 y 20 fotografías.</p>
              <label>Vistas previas JPEG, PNG o WebP<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) void perform(async () => { for (const file of files) await upload(file, 'photo', file.name); }, `${files.length} fotografías cargadas en borrador.`); }} /></label>
              <ul className="pp-admin-assets">{assets.filter(a => a.routineId === routine.id).map(a => <li key={a.id}><a target="_blank" rel="noreferrer" href={`${endpoint}?assetId=${encodeURIComponent(a.id)}`}>Revisar {a.fileName || a.kind}</a><button onClick={() => perform(async () => { await api('', { action: 'asset.publish', assetId: a.id, published: !a.published }); }, a.published ? 'Archivo retirado.' : 'Archivo aprobado para publicación.')}>{a.published ? 'Retirar archivo' : 'Aprobar archivo'}</button></li>)}</ul>
            </div>}
          </>}
        </section>
        {(assetOffset > 0 || assetPagination?.hasMore) && <div className="pp-admin-actions"><button disabled={assetOffset === 0} onClick={() => setAssetOffset(Math.max(0, assetOffset - 500))}>Archivos anteriores</button><button disabled={!assetPagination?.hasMore} onClick={() => setAssetOffset(assetOffset + 500)}>Más archivos</button></div>}
      </>}
    </fieldset>
    {busy && <p className="pp-admin-busy" role="status">Guardando y verificando…</p>}
    <footer>Los accesos, resultados, documentos y fotografías se publican de forma independiente. Una edición debe estar visible para que sus integrantes puedan consultar sus archivos.</footer>
  </main>;
}
