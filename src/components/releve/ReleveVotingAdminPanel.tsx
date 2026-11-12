import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { requestRegistrationApi } from '../admin/registrationApi';
import type { ReleveVotingAdminState } from './releveVotingApi';

const endpoint = '/api/registration/admin/releve-voting';
export function ReleveVotingAdminPanel({ refreshToken }: { refreshToken: string }) {
  const [data, setData] = useState<ReleveVotingAdminState | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const generation = useRef(0), writing = useRef(false);
  const read = useCallback(async () => {
    if (writing.current) return;
    const version = ++generation.current;
    setBusy(true);
    try { const next = await requestRegistrationApi<ReleveVotingAdminState>(endpoint); if (version === generation.current) { setData(next); setError(''); } }
    catch (error) { if (version === generation.current) setError(error instanceof Error ? error.message : 'No pudimos cargar la votación.'); }
    finally { if (version === generation.current) setBusy(false); }
  }, []);
  useEffect(() => { void read(); }, [read, refreshToken]);
  async function change(action: 'open' | 'close') {
    if (!data) return;
    writing.current = true; generation.current++;
    setBusy(true); setError(''); setNotice('');
    try {
      setData(await requestRegistrationApi<ReleveVotingAdminState>(endpoint, { method: 'POST', body: JSON.stringify({ action, revision: data.poll.revision, ...(action === 'open' ? { confirmation: 'ABRIR' } : {}) }) }));
      setConfirmOpen(false); setNotice(action === 'open' ? 'La votación está abierta y recibe votos reales.' : 'Votación cerrada. Los votos registrados se conservan.');
    } catch (error) { setError(error instanceof Error ? error.message : 'No pudimos actualizar la votación. Actualiza para comprobar su estado.'); }
    finally { writing.current = false; setBusy(false); }
  }
  return <section className="ja-releve-admin" aria-label="Administrar votación Relevé" aria-busy={busy}>
    <div className="ja-releve-control">
      <header><div><p>ESTADO DE MÉXICO · OTOÑO 2026</p><h2>El público elige.</h2></div><span className={`ja-status ${data?.poll.status === 'open' ? 'is-complete' : 'is-pending'}`}>{data ? data.poll.status === 'open' ? 'Abierta' : 'Cerrada' : 'Conectando…'}</span></header>
      <p>Sin código. Un voto por dispositivo, con un control aproximado que puede fallar al cambiar de navegador o usar protecciones de privacidad.</p>
      <div className="ja-releve-buttons">
        {data?.poll.status === 'open' ? <button disabled={busy} className="ja-primary" onClick={() => void change('close')}>Cerrar votación</button> : <button disabled={busy || !data} className="ja-primary" onClick={() => setConfirmOpen(true)}>Abrir votación</button>}
        <button disabled={busy} onClick={() => void read()}><RefreshCw size={16} />Actualizar resultados</button>
        <button onClick={() => void navigator.clipboard.writeText(`${location.origin}/votacion-releve`).then(() => setNotice('Enlace copiado.')).catch(() => setError('No pudimos copiar el enlace.'))}><Copy size={16} />Copiar enlace</button>
        <a href="/votacion-releve" target="_blank" rel="noreferrer">Ver votación</a>
      </div>
      {confirmOpen && data?.poll.status !== 'open' ? <div className="ja-releve-confirm" role="group" aria-label="Confirmar apertura de votación">
        <p>Se recibirán votos reales por los cinco participantes. No se pueden cambiar ni reiniciar los votos guardados.</p>
        <p>La foto de Mariana sigue pendiente; su opción también estará disponible para votar.</p>
        <div className="ja-releve-buttons"><button className="ja-primary" disabled={busy} onClick={() => void change('open')}>Confirmar apertura</button><button disabled={busy} onClick={() => setConfirmOpen(false)}>Cancelar</button></div>
      </div> : null}
    </div>
    {notice ? <p className="ja-notice" role="status"><Check size={16} />{notice}</p> : null}
    {error ? <p className="ja-error" role="alert">{error}</p> : null}
    {data ? <section className="ja-releve-results" aria-label="Resultados privados de Relevé">
      <header><h2>Resultados</h2><span>{data.totalVotes} votos registrados</span></header>
      <p>Solo administración puede consultar estos resultados.</p>
      {[...data.candidates].sort((a,b) => b.votes - a.votes).map(candidate => <article key={candidate.id}>
        <div><small>{candidate.academy}</small><h3>{candidate.choreography}</h3><p>{candidate.participantName}</p></div><strong>{candidate.votes}</strong>
      </article>)}
    </section> : null}
  </section>;
}
