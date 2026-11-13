import { isJudgingGroupCategory } from '../shared/judging-group.js';

// Called after judging authorization. Resolve exact, enabled programme links;
// return counts only, without reading participant names or identifiers.
export async function withJudgingGroupParticipants(env, snapshot) {
  if (!snapshot.rows.some(row => isJudgingGroupCategory(row.category))) return snapshot;
  const editions = [...new Set(String(env.PARTICIPANT_REGISTRATION_EVENT_IDS || '').split(',').map(id => id.trim()).filter(Boolean))];
  const counts = new Map();
  if (env.DB && editions.length) {
    const { results = [] } = await env.DB.prepare(`
      SELECT r.source_routine_id, r.event_id, r.dance_id,
        COUNT(DISTINCT m.participant_id) AS participant_count
      FROM participant_portal_routines r
      JOIN participant_portal_judging_sources s ON s.event_id=r.event_id
        AND s.source_event_id=r.source_event_id AND s.enabled=1
      JOIN registration_dances d ON d.id=r.dance_id
      LEFT JOIN registration_dance_participants m ON m.dance_id=d.id
      WHERE r.source_event_id=? AND r.event_id IN (${editions.map(() => '?').join(',')})
      GROUP BY r.source_routine_id, r.event_id, r.dance_id
    `).bind(snapshot.event.id, ...editions).all();
    for (const row of results) {
      const count = Number(row.participant_count);
      // Multiple associations are ambiguous even if their member counts agree.
      counts.set(row.source_routine_id, counts.has(row.source_routine_id) ? null
        : Number.isSafeInteger(count) && count > 0 ? count : null);
    }
  }
  return { ...snapshot, rows: snapshot.rows.map(row => isJudgingGroupCategory(row.category)
    ? { ...row, participantCount: counts.get(String(row.id)) ?? null } : row) };
}
