import { useEffect, useState } from 'react';
import { LogOut, Maximize, Minimize, RefreshCw } from 'lucide-react';
import { RegistrationApiError, requestRegistrationApi } from '../admin/registrationApi';
import { ReportPanel, useJudgingFullscreen } from './JudgingAdminWorkspace';
import type { ComponentProps } from 'react';
import './JudgingAdminWorkspace.css';
import './JudgingReportViewer.css';

type ReportData = ComponentProps<typeof ReportPanel>['bundle'];
type Event = { id: string; name: string };

export function JudgingReportViewer() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [revision, setRevision] = useState(0);
  const fullscreen = useJudgingFullscreen(setError);
  const handleError = (cause: unknown) => {
    if (cause instanceof RegistrationApiError && cause.status === 401) window.location.replace('/login');
    else setError(cause instanceof Error ? cause.message : 'No se pudo consultar el dictamen.');
  };

  useEffect(() => {
    const controller = new AbortController();
    requestRegistrationApi<{ user: { name: string }; events: Event[] }>('/api/registration/judging-report/events', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setName(result.user.name); setEvents(result.events); setEventId(result.events[0]?.id || ''); setLoading(false); } })
      .catch(cause => { if (!controller.signal.aborted) { handleError(cause); setLoading(false); } });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    requestRegistrationApi<ReportData>(`/api/registration/judging-report/snapshot?eventId=${encodeURIComponent(eventId)}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setData(result); setBlockId(current => result.blocks.some(block => block.block_id === current) ? current : result.blocks[0]?.block_id || ''); } })
      .catch(cause => { if (!controller.signal.aborted) handleError(cause); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, revision]);

  const logout = async () => {
    try { await requestRegistrationApi('/api/registration/auth/logout', { method: 'POST', body: '{}' }); window.location.replace('/login'); }
    catch (cause) { handleError(cause); }
  };
  const report = data?.snapshot.report.blocks.find(block => block.id === blockId);
  return <div className="ja-app ja-report-reader" data-theme="dark">
    <div className="ja-main">
      <header className="ja-topbar">
        <a href="/jueceo/dictamen" aria-label="Dictamen final"><img src="/assets/levitate-logo-mx.png" alt="Levitate MX" /></a>
        <div className="ja-event"><label htmlFor="report-event">Evento</label><select id="report-event" value={eventId} disabled={loading || events.length < 2} onChange={event => { setBlockId(''); setEventId(event.target.value); }}>
          {!events.length && <option value="">Sin eventos disponibles</option>}{events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
        </select></div>
        {fullscreen.available && <button type="button" className="ja-icon" title={fullscreen.active ? 'Salir de pantalla completa' : 'Pantalla completa'} aria-label={fullscreen.active ? 'Salir de pantalla completa' : 'Pantalla completa'} aria-pressed={fullscreen.active} disabled={fullscreen.busy} onClick={() => void fullscreen.toggle()}>{fullscreen.active ? <Minimize size={21} /> : <Maximize size={21} />}</button>}
        <button type="button" className="ja-icon" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => void logout()}><LogOut size={21} /></button>
      </header>
      <main className="ja-content">
        <div className="ja-heading"><div><p className="ja-eyebrow">LEVITATE · JUECEO</p><h1>Dictamen final</h1><p className="ja-reader-identity">{name}</p></div>
          <button type="button" className="ja-icon" title="Actualizar dictamen" aria-label="Actualizar dictamen" disabled={!eventId || loading} onClick={() => setRevision(current => current + 1)}><RefreshCw size={21} /></button>
        </div>
        {error && <p role="alert" className="ja-reader-error">{error}</p>}
        {loading && <p role="status">Cargando dictamen…</p>}
        {!loading && data && <ReportPanel key={eventId} report={report} bundle={data} blockId={blockId} onBlockChange={setBlockId} readOnly />}
        {!loading && !error && !events.length && <p>No hay eventos asignados para consultar.</p>}
      </main>
    </div>
  </div>;
}
