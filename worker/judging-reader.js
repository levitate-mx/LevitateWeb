import { buildJudgingScoreSnapshot } from "./judging-score-data.js";

const pageSize = 1000;
const maximumRows = 50000;
const eventIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const eventColumns = "id,name,source_name,starts_at,is_active,event_type,competition_config,created_at";
const tableColumns = {
  blocks: "event_id,block_id,name,title,sort_order,is_active",
  routines: "event_id,routine_id,name,academy,state,genre,division,category,level,block_id,block,block_title,sort_order",
  judges: "event_id,judge_id,name,role,sort_order,assigned_block_ids",
  criteria_templates: "event_id,template_id,genre,title,max_score,sort_order,template_version,applies_to",
  criteria: "event_id,template_id,criterion_id,section,label,max_score,sort_order,is_required",
  scores: "event_id,routine_id,judge_id,criterion_id,value,updated_at",
  penalties: "event_id,block_id,routine_id,judge_id,value,updated_at",
  feedback: "event_id,routine_id,judge_id,body,updated_at",
  special_awards: "event_id,block_id,award,routine_id,manual_value",
};
const tableOrders = {
  blocks: "sort_order.asc,block_id.asc",
  routines: "sort_order.asc,routine_id.asc",
  judges: "sort_order.asc,judge_id.asc",
  criteria_templates: "sort_order.asc,template_id.asc",
  criteria: "template_id.asc,sort_order.asc,criterion_id.asc",
  scores: "routine_id.asc,judge_id.asc,criterion_id.asc",
  penalties: "routine_id.asc,judge_id.asc",
  feedback: "routine_id.asc,judge_id.asc",
  special_awards: "block_id.asc,award.asc",
};

function fail(code, message, statusCode = 503) {
  throw Object.assign(new Error(message), { code, statusCode });
}

function levitateEventIds(env) {
  const ids = [...new Set(String(env.JUDGING_LEVITATE_EVENT_IDS || "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean))];
  if (!ids.length || ids.some(id => !eventIdPattern.test(id))) {
    fail("judging_not_configured", "Los eventos de Levitate todavía no están configurados para esta consulta.");
  }
  return new Set(ids);
}

function isVisibleEvent(event) {
  return event.event_type == null || event.event_type === "event";
}

function configuration(env) {
  const key = String(env.JUDGING_SUPABASE_PUBLISHABLE_KEY || "").trim();
  let url;
  try { url = new URL(env.JUDGING_SUPABASE_URL); } catch { /* Report configuration without its contents. */ }
  if (!key || !url || url.protocol !== "https:" || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)
    || url.port || url.username || url.password || !["", "/"].includes(url.pathname) || url.search || url.hash) {
    fail("judging_not_configured", "La conexión con JueceoCore todavía no está configurada.");
  }
  // This integration intentionally uses the existing low-privilege app key,
  // never a service-role credential, and makes GET requests only.
  if (key.startsWith("sb_secret_")) fail("judging_not_configured", "La conexión de consulta requiere una clave de la aplicación.");
  const headers = { apikey: key, accept: "application/json" };
  if (key.split(".").length === 3) {
    try {
      const claims = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (claims.role !== "anon") throw new Error("Unexpected role");
    } catch { fail("judging_not_configured", "La conexión de consulta requiere una clave de la aplicación."); }
    headers.authorization = `Bearer ${key}`;
  }
  return { base: url.origin, headers };
}

async function readRows(config, table, parameters, fetcher) {
  const rows = [];
  // Continue until an empty page: an upstream row cap may be lower than ours.
  // Never return a truncated set as if the evaluation were complete.
  for (;;) {
    const url = new URL(`/rest/v1/${table}`, config.base);
    for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(rows.length));
    let response;
    try {
      response = await fetcher(url.toString(), {
        method: "GET", headers: config.headers, redirect: "manual", signal: AbortSignal.timeout(15000),
      });
    } catch {
      fail("judging_unavailable", "No pudimos consultar JueceoCore. Intenta actualizar en unos minutos.");
    }
    if (!response.ok) {
      // Upstream bodies may contain private configuration. Do not return/log them.
      fail("judging_unavailable", "JueceoCore no está disponible para consultar las puntuaciones en este momento.");
    }
    let page;
    try { page = await response.json(); } catch { fail("judging_invalid_response", "No pudimos leer las puntuaciones de JueceoCore.", 502); }
    if (!Array.isArray(page) || page.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
      fail("judging_invalid_response", "No pudimos leer las puntuaciones de JueceoCore.", 502);
    }
    if (!page.length) return rows;
    rows.push(...page);
    if (rows.length > maximumRows) fail("judging_too_many_rows", "Este evento supera el límite de consulta. Contacta al administrador para revisar la conexión.");
  }
}

function mapEvent(event) {
  return { id: event.id, name: event.name, sourceName: event.source_name || "", isActive: Boolean(event.is_active), startsAt: event.starts_at || null };
}

export async function getJudgingEvents(env, { fetcher = fetch } = {}) {
  const allowedIds = levitateEventIds(env);
  const config = configuration(env);
  const events = await readRows(config, "events", {
    select: eventColumns, id: `in.(${[...allowedIds].join(",")})`,
    or: "(event_type.is.null,event_type.eq.event)", order: "is_active.desc,created_at.desc,id.asc",
  }, fetcher);
  return { events: events.filter(event => allowedIds.has(event.id) && isVisibleEvent(event)).map(mapEvent), fetchedAt: new Date().toISOString() };
}

function allowedEventId(env, eventId) {
  if (typeof eventId !== "string" || !eventIdPattern.test(eventId)) {
    fail("judging_invalid_event", "Selecciona un evento válido de JueceoCore.", 400);
  }
  eventId = eventId.toLowerCase();
  const allowedIds = levitateEventIds(env);
  if (!allowedIds.has(eventId)) fail("judging_event_not_found", "No se encontró el evento de Levitate seleccionado.", 404);
  return eventId;
}

async function readEvent(config, eventId, fetcher, columns = eventColumns) {
  const events = await readRows(config, "events", {
    select: columns, id: `eq.${eventId}`, or: "(event_type.is.null,event_type.eq.event)", order: "id.asc",
  }, fetcher);
  if (events.length !== 1 || events[0].id !== eventId || !isVisibleEvent(events[0])) {
    fail("judging_event_not_found", "No se encontró el evento de Levitate seleccionado.", 404);
  }
  return events[0];
}

// Programme association needs identities, not an entire evaluation snapshot.
// Keep the same event guards while avoiding scores, judges and criteria reads.
export async function getJudgingRoutineDirectory(env, eventId, { fetcher = fetch } = {}) {
  eventId = allowedEventId(env, eventId);
  const config = configuration(env);
  const event = await readEvent(config, eventId, fetcher, "id,name,event_type");
  const routines = await readRows(config, "routines", {
    select: "event_id,routine_id,name,academy", event_id: `eq.${eventId}`, order: tableOrders.routines,
  }, fetcher);
  const ids = new Set();
  const rows = routines.map(row => {
    const id = typeof row.routine_id === "string" ? row.routine_id.trim() : "";
    if (row.event_id !== eventId || !id || ids.has(id)) {
      fail("judging_invalid_response", "No pudimos comprobar las identidades del programa de JueceoCore.", 502);
    }
    ids.add(id);
    return { id, name: typeof row.name === "string" ? row.name.trim() : "", academy: typeof row.academy === "string" ? row.academy.trim() : "" };
  });
  return { event: { id: eventId, name: typeof event.name === "string" ? event.name.trim() : "" }, rows };
}

// A participant needs only their own sheets. Do not download or calculate a
// whole event's evaluations on every QR visit, especially on Workers Free.
export async function getJudgingSheets(env, eventId, { routineIds, fetcher = fetch } = {}) {
  eventId = allowedEventId(env,eventId);
  if (!Array.isArray(routineIds) || !routineIds.length || routineIds.length>50
    || routineIds.some(id=>typeof id!=="string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id))) {
    fail("judging_invalid_routine","No pudimos identificar las hojas de esta presentación.",400);
  }
  const filter=`in.(${[...new Set(routineIds)].join(",")})`;
  const config=configuration(env), event=await readEvent(config,eventId,fetcher);
  const scopedTables=new Set(["routines","scores","penalties","feedback"]);
  const entries=await Promise.all(Object.entries(tableColumns).filter(([table])=>table!=="special_awards")
    .map(async([table,columns])=>[table,await readRows(config,table,{
      select:columns,event_id:`eq.${eventId}`,order:tableOrders[table],...(scopedTables.has(table)?{routine_id:filter}:{}),
    },fetcher)]));
  const data=Object.fromEntries(entries);
  // Validate the upstream scope as well as requesting it, before projecting.
  for(const table of scopedTables) if(data[table].some(row=>row.event_id!==eventId || !routineIds.includes(row.routine_id))) {
    fail("judging_invalid_response","No pudimos verificar las hojas de esta presentación.",502);
  }
  return buildJudgingScoreSnapshot({event,blocks:data.blocks,routines:data.routines,judges:data.judges,
    templates:data.criteria_templates,criteria:data.criteria,scores:data.scores,penalties:data.penalties,
    feedback:data.feedback,specialAwards:[]},new Date().toISOString());
}

export async function getJudgingScores(env, eventId, { fetcher = fetch } = {}) {
  eventId = allowedEventId(env, eventId);
  const config = configuration(env);
  const event = await readEvent(config, eventId, fetcher);
  const entries = await Promise.all(Object.entries(tableColumns).map(async ([table, columns]) => [table,
    await readRows(config, table, { select: columns, event_id: `eq.${eventId}`, order: tableOrders[table] }, fetcher),
  ]));
  const data = Object.fromEntries(entries);
  return buildJudgingScoreSnapshot({
    event, blocks: data.blocks, routines: data.routines, judges: data.judges,
    templates: data.criteria_templates, criteria: data.criteria, scores: data.scores, penalties: data.penalties, feedback: data.feedback,
    specialAwards: data.special_awards,
  }, new Date().toISOString());
}
