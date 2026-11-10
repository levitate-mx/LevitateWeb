const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function levitateJudgingEventIds(env) {
  const ids = new Set(
    String(env.JUDGING_LEVITATE_EVENT_IDS || "")
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter((id) => uuid.test(id)),
  );
  if (env.DB) {
    const { results } = await env.DB.prepare(
      "SELECT event_id FROM registration_judging_events",
    ).all();
    for (const row of results)
      if (uuid.test(row.event_id)) ids.add(row.event_id.toLowerCase());
    const editions = String(env.PARTICIPANT_REGISTRATION_EVENT_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (editions.length) {
      const sources = await env.DB.prepare(
        `SELECT source_event_id FROM participant_portal_judging_sources WHERE enabled=1 AND event_id IN (${editions.map(() => "?").join(",")})`,
      )
        .bind(...editions)
        .all();
      for (const row of sources.results)
        if (uuid.test(row.source_event_id))
          ids.add(row.source_event_id.toLowerCase());
    }
  }
  if (!ids.size || ids.size > 200)
    throw Object.assign(
      new Error("El alcance de Levitate no esta configurado."),
      { statusCode: 503, code: "judging_not_configured" },
    );
  return [...ids];
}
export async function requireJudgingEvent(env, id) {
  if (typeof id !== "string" || !uuid.test(id))
    throw Object.assign(new Error("Selecciona un evento valido."), {
      statusCode: 400,
      code: "judging_invalid_event",
    });
  const value = id.toLowerCase(),
    configured = String(env.JUDGING_LEVITATE_EVENT_IDS || "")
      .split(",")
      .map((id) => id.trim().toLowerCase());
  if (configured.includes(value)) return value;
  if (!(await levitateJudgingEventIds(env)).includes(value))
    throw Object.assign(
      new Error("El evento no pertenece al alcance de Levitate."),
      { statusCode: 403, code: "judging_event_forbidden" },
    );
  return value;
}
