import { getJudgingEvents, getJudgingScores } from './judging-reader.js';
import { levitateJudgingEventIds, requireJudgingEvent } from './judging-authority.js';

const fail = (code, message, statusCode) => { throw Object.assign(new Error(message), { code, statusCode }); };
const json = value => Response.json(value, { headers: { 'cache-control': 'no-store, private', vary: 'Cookie' } });

export function requireJudgingReportReader(session) {
  if (!['admin', 'judging_admin', 'judging_viewer'].includes(session?.user?.role)) {
    fail('judging_report_forbidden', 'Esta cuenta no tiene acceso al dictamen final.', 403);
  }
}

export function enforceJudgingReportRequest(request, session) {
  if (session?.user?.role !== 'judging_viewer') return;
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/registration/')) return;
  if ((path === '/api/registration/me' && request.method === 'GET')
      || (path === '/api/registration/auth/logout' && request.method === 'POST')
      || path.startsWith('/api/registration/judging-report/')) return;
  fail('judging_report_only', 'Esta cuenta permite solamente consultar el dictamen final.', 403);
}

async function allowedEvents(env, session) {
  const verified = await levitateJudgingEventIds(env);
  if (session.user.role !== 'judging_viewer') return verified;
  const { results = [] } = await env.DB.prepare('SELECT event_id FROM registration_judging_report_access WHERE user_id=? AND enabled=1')
    .bind(session.user.id).all();
  return verified.filter(id => results.some(grant => grant.event_id === id));
}

// Return only the final report and the metadata required by its filters. No
// individual notes, feedback, private participants, account bindings or exports.
function reportProjection(snapshot) {
  return {
    event: { id: snapshot.event.id, name: snapshot.event.name },
    blocks: snapshot.report.blocks.map(block => ({ block_id: block.id, name: block.name, title: block.title })),
    snapshot: {
      fetchedAt: snapshot.fetchedAt,
      report: snapshot.report,
      rows: snapshot.rows.map(row => ({ id: row.id, programNumber: row.programNumber,
        name: row.name, academy: row.academy, state: row.state, genre: row.genre,
        division: row.division, category: row.category, level: row.level,
        blockId: row.blockId, blockName: row.blockName, status: row.status,
        completedJudges: row.completedJudges, expectedJudges: row.expectedJudges,
        recordedScores: row.recordedScores, judges: [] })),
    },
  };
}

export async function handleJudgingReport(request, env, session, { fetcher = fetch } = {}) {
  requireJudgingReportReader(session);
  if (request.method !== 'GET') fail('method_not_allowed', 'Este acceso permite solamente consultar el dictamen.', 405);
  const url = new URL(request.url), action = url.pathname.split('/').pop();
  if (!['events', 'snapshot'].includes(action)) fail('judging_report_not_found', 'Consulta no disponible.', 404);
  const ids = await allowedEvents(env, session);
  if (!ids.length) fail('judging_report_unassigned', 'Esta cuenta no tiene un evento asignado para consultar.', 403);
  if (action === 'events') {
    const result = await getJudgingEvents({ ...env, JUDGING_LEVITATE_EVENT_IDS: ids.join(',') }, { fetcher });
    return json({ user: { name: session.user.name, role: session.user.role }, events: result.events.map(event => ({ id: event.id, name: event.name })), fetchedAt: result.fetchedAt });
  }
  const requested = url.searchParams.get('eventId');
  if (!ids.includes(requested)) fail('judging_report_event_forbidden', 'Esta cuenta no tiene acceso al dictamen de ese evento.', 403);
  const eventId = await requireJudgingEvent(env, requested);
  const snapshot = await getJudgingScores({ ...env, JUDGING_LEVITATE_EVENT_IDS: eventId }, eventId, { fetcher });
  // Recheck event grants after the awaited source read, before releasing data.
  if (!(await allowedEvents(env, session)).includes(eventId)) fail('judging_report_event_forbidden', 'Se retiró el acceso a este dictamen.', 403);
  return json(reportProjection(snapshot));
}
