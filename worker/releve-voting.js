import { releveVotingCandidates } from '../shared/releve-voting-catalog.js';

export const relevePollId = 'edomex-2026-otono-releve';
const eventId = 'edomex-2026-otono';
const cookieName = 'levitate_releve_voter';
const fail = (code, message, statusCode = 400) => { throw Object.assign(new Error(message), { code, statusCode }); };
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
const randomToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const first = (db, sql, ...values) => db.prepare(sql).bind(...values).first();
const all = async (db, sql, ...values) => (await db.prepare(sql).bind(...values).all()).results || [];
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'cache-control': 'private, no-store', 'vary': 'Cookie', 'x-robots-tag': 'noindex, nofollow', ...headers } });
const defaultPoll = () => ({ id: relevePollId, event_id: eventId, status: 'closed', voter_mode: 'device', revision: 0 });
const readPoll = async db => await first(db, 'SELECT * FROM releve_voting_polls WHERE id=? AND event_id=?', relevePollId, eventId) || defaultPoll();
const publicPoll = poll => ({ id: poll.id, status: poll.status, voterMode: poll.voter_mode, revision: poll.revision, configured: Boolean(poll.voter_mode) });

function sameOrigin(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    fail('releve_origin', 'Abre la votación desde su enlace original.', 403);
  }
}
async function body(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail('releve_body', 'No pudimos leer la solicitud.');
  const reader = request.body?.getReader();
  if (!reader) fail('releve_body', 'No pudimos leer la solicitud.');
  let bytes = 0, parts = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 2048) { await reader.cancel(); fail('releve_body', 'La solicitud es demasiado grande.', 413); }
    parts.push(value);
  }
  let input;
  try { input = JSON.parse(await new Blob(parts).text()); } catch { fail('releve_body', 'No pudimos leer la solicitud.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('releve_body', 'No pudimos leer la solicitud.');
  return input;
}
async function throttle(db, request, action) {
  await db.prepare("DELETE FROM releve_voting_rate_limits WHERE expires_at<=datetime('now')").run();
  const slot = Math.floor(Date.now() / 60000);
  // Cloudflare supplies this header; forwarded addresses supplied by a browser are ignored.
  const bucket = await hash(`${relevePollId}:${action}:${slot}:${request.headers.get('cf-connecting-ip') || 'local'}`);
  const row = await first(db, `INSERT INTO releve_voting_rate_limits(bucket_hash,expires_at)
    VALUES (?,datetime('now','+2 minutes')) ON CONFLICT(bucket_hash) DO UPDATE SET attempts=attempts+1 RETURNING attempts`, bucket);
  if (row.attempts > (action === 'session' ? 600 : 1200)) fail('releve_rate', 'Hay muchas solicitudes. Espera un minuto e intenta de nuevo.', 429);
}

async function readSession(db, request, poll) {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!cookie || !/^[\w-]{43}$/.test(cookie)) return null;
  const session = await first(db, `SELECT * FROM releve_voting_sessions WHERE token_hash=? AND poll_id=? AND voter_mode=? AND expires_at>datetime('now')`, await hash(cookie), poll.id, poll.voter_mode);
  if (!session) return null;
  return session;
}
async function voterState(db, session) {
  const ballot = session ? await first(db, 'SELECT id,candidate_id,session_hash FROM releve_voting_ballots WHERE poll_id=? AND voter_hash=?', session.poll_id, session.voter_hash) : null;
  const mayReadChoice = ballot?.session_hash === session?.token_hash;
  return { authenticated: Boolean(session), hasVoted: Boolean(ballot), candidateId: mayReadChoice ? ballot?.candidate_id || null : null };
}
async function adminState(db) {
  const poll = await readPoll(db);
  const totals = await all(db, 'SELECT candidate_id,COUNT(*) AS votes FROM releve_voting_ballots WHERE poll_id=? GROUP BY candidate_id', poll.id);
  const byId = new Map(totals.map(row => [row.candidate_id, row.votes]));
  return { poll: publicPoll(poll), candidates: releveVotingCandidates.map(candidate => ({ ...candidate, votes: byId.get(candidate.id) || 0 })), totalVotes: totals.reduce((sum, row) => sum + row.votes, 0) };
}
async function adminAction(db, actorId, input) {
  if (!actorId) fail('releve_admin', 'Inicia sesión en administración.', 401);
  if (!['open','close'].includes(input.action) || !Number.isSafeInteger(input.revision) || input.revision < 0) fail('releve_action', 'Actualiza la votación antes de continuar.');
  const before = await readPoll(db);
  if (before.revision !== input.revision) fail('releve_conflict', 'La votación cambió. Actualiza antes de continuar.', 409);
  const mode = 'device';
  if (input.action === 'open' && input.confirmation !== 'ABRIR') fail('releve_open_confirmation', 'Confirma la apertura de la votación.');
  await db.prepare(`INSERT OR IGNORE INTO releve_voting_polls(id,event_id,revision,created_by,updated_by) VALUES (?,?,0,?,?)`).bind(before.id, eventId, actorId, actorId).run();
  const status = input.action === 'open' ? 'open' : 'closed', actionId = crypto.randomUUID();
  await db.batch([
    db.prepare(`UPDATE releve_voting_polls SET status=?,voter_mode=?,revision=revision+1,updated_by=?,last_action_id=?,updated_at=datetime('now'),
      opened_at=CASE WHEN ?='open' THEN datetime('now') ELSE opened_at END,
      closed_at=CASE WHEN ?='closed' THEN datetime('now') ELSE closed_at END
      WHERE id=? AND revision=?`)
      .bind(status, mode, actorId, actionId, status, status, before.id, before.revision),
    db.prepare(`INSERT INTO releve_voting_audit(id,poll_id,actor_id,previous_status,next_status,voter_mode,revision)
      SELECT ?,id,?,?,status,voter_mode,revision FROM releve_voting_polls WHERE id=? AND last_action_id=?`)
      .bind(actionId, actorId, before.status, before.id, actionId),
  ]);
  if ((await readPoll(db)).last_action_id !== actionId) fail('releve_conflict', 'La votación cambió. Actualiza antes de continuar.', 409);
  return adminState(db);
}

export async function handleReleveVoting(request, env, { requireAdmin } = {}) {
  try {
    const url = new URL(request.url), db = env.DB;
    const admin = url.pathname === '/api/registration/admin/releve-voting';
    if (admin) {
      if (!requireAdmin) fail('releve_admin', 'Inicia sesión en administración.', 401);
      const session = await requireAdmin(request);
      if (request.method === 'GET') return json(await adminState(db));
      if (request.method !== 'POST') fail('releve_method', 'Método no permitido.', 405);
      sameOrigin(request);
      return json(await adminAction(db, session.user.id, await body(request)));
    }
    if (!db) fail('releve_unavailable', 'No pudimos conectar la votación. Intenta de nuevo.', 503);
    const poll = await readPoll(db);
    if (url.pathname === '/api/releve-voting' && request.method === 'GET') {
      return json({ poll: publicPoll(poll), candidates: releveVotingCandidates, voter: await voterState(db, await readSession(db, request, poll)) });
    }
    if (!['/api/releve-voting/session','/api/releve-voting/vote'].includes(url.pathname)) fail('releve_route', 'No se encontró la votación.', 404);
    if (request.method !== 'POST') fail('releve_method', 'Método no permitido.', 405);
    sameOrigin(request);
    if (poll.status !== 'open' || !poll.voter_mode) fail('releve_closed', 'La votación está cerrada.', 409);
    const action = url.pathname.endsWith('/session') ? 'session' : 'vote';
    await throttle(db, request, action);
    const input = await body(request);
    const inputKey = action === 'session' ? 'fingerprint' : 'candidateId';
    if (Object.keys(input).some(key => key !== inputKey)) fail('releve_body', 'La solicitud no corresponde a esta votación.');
    if (action === 'session') {
      const current = await readSession(db, request, poll);
      if (typeof input.fingerprint !== 'string' || !/^[a-f0-9]{32}$/.test(input.fingerprint)) fail('releve_device', 'No pudimos reconocer este navegador. Intenta de nuevo.');
      const voterHash = current?.voter_hash || await hash(`${poll.id}:device:${input.fingerprint}`);
      if (current) return json({ voter: await voterState(db, current) });
      const token = randomToken(), tokenHash = await hash(token);
      await db.prepare("DELETE FROM releve_voting_sessions WHERE expires_at<=datetime('now')").run();
      await db.prepare(`INSERT INTO releve_voting_sessions(token_hash,poll_id,voter_hash,voter_mode,expires_at)
        SELECT ?,id,?,?,datetime('now','+3 days') FROM releve_voting_polls WHERE id=? AND status='open' AND voter_mode=?`)
        .bind(tokenHash, voterHash, poll.voter_mode, poll.id, poll.voter_mode).run();
      const session = await first(db, 'SELECT * FROM releve_voting_sessions WHERE token_hash=?', tokenHash);
      if (!session) fail('releve_closed', 'La votación cambió. Actualiza antes de continuar.', 409);
      return json({ voter: await voterState(db, session) }, 200, { 'set-cookie': `${cookieName}=${token}; Path=/api/releve-voting; HttpOnly; Secure; SameSite=Strict; Max-Age=259200` });
    }
    if (typeof input.candidateId !== 'string' || !releveVotingCandidates.some(candidate => candidate.id === input.candidateId)) fail('releve_candidate', 'Elige un participante de esta votación.');
    const session = await readSession(db, request, poll);
    if (!session) fail('releve_session', 'Valida tu acceso para votar.', 401);
    await db.prepare(`INSERT INTO releve_voting_ballots(id,poll_id,voter_hash,candidate_id,session_hash)
      SELECT ?,p.id,s.voter_hash,?,s.token_hash FROM releve_voting_polls p JOIN releve_voting_sessions s ON s.poll_id=p.id
      WHERE p.id=? AND p.status='open' AND p.voter_mode=s.voter_mode AND s.token_hash=? AND s.expires_at>datetime('now')
      ON CONFLICT(poll_id,voter_hash) DO NOTHING`)
      .bind(crypto.randomUUID(), input.candidateId, poll.id, session.token_hash).run();
    const voter = await voterState(db, session);
    if (!voter.hasVoted) fail('releve_closed', 'La votación cambió. Actualiza antes de continuar.', 409);
    // A repeated request returns the persisted receipt. It never changes the first ballot.
    return json({ voter });
  } catch (error) {
    const status = error.statusCode || 500;
    return json({ error: { code: status === 500 ? 'releve_unavailable' : error.code, message: status === 500 ? 'No pudimos conectar la votación. Intenta de nuevo.' : error.message } }, status, status === 429 ? { 'retry-after': '60' } : {});
  }
}
