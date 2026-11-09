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

async function readRows(config, table, parameters, fetcher, budget) {
  const rows = [];
  // Continue until an empty page: an upstream row cap may be lower than ours.
  // Never return a truncated set as if the evaluation were complete.
  for (;;) {
    if (budget && ++budget.requests > 40) {
      fail("judging_request_limit", "La consulta de este bloque supera el límite disponible. Revisa el programa con administración.");
    }
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
    if (budget && (budget.rows += page.length) > maximumRows) {
      fail("judging_too_many_rows", "Este bloque supera el límite de consulta. Contacta al administrador para revisar la conexión.");
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

// Only internal callers may supply this option after authenticating an import
// capability or resolving the participant's persisted edition/source binding.
// It authorizes exactly that event, never a catalog or arbitrary HTTP parameter.
function allowedParticipantEventId(env, eventId, trustedEventId) {
  if (typeof eventId !== "string" || !eventIdPattern.test(eventId)) {
    fail("judging_invalid_event", "Selecciona un evento válido de JueceoCore.", 400);
  }
  if (typeof trustedEventId === "string" && eventIdPattern.test(trustedEventId)
    && trustedEventId.toLowerCase() === eventId.toLowerCase()) return eventId.toLowerCase();
  return allowedEventId(env,eventId);
}

async function readEvent(config, eventId, fetcher, columns = eventColumns, budget) {
  const events = await readRows(config, "events", {
    select: columns, id: `eq.${eventId}`, or: "(event_type.is.null,event_type.eq.event)", order: "id.asc",
  }, fetcher, budget);
  if (events.length !== 1 || events[0].id !== eventId || !isVisibleEvent(events[0])) {
    fail("judging_event_not_found", "No se encontró el evento de Levitate seleccionado.", 404);
  }
  return events[0];
}

// Programme association needs identities, not an entire evaluation snapshot.
// Keep the same event guards while avoiding scores, judges and criteria reads.
export async function getJudgingRoutineDirectory(env, eventId, { fetcher = fetch, trustedEventId } = {}) {
  eventId = allowedParticipantEventId(env, eventId, trustedEventId);
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

const routineIdPattern = /^[A-Za-z0-9_-]{1,100}$/;
const cleanText = value => typeof value === "string" ? value.trim() : "";
const stableBlock = value => cleanText(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

function routineChunks(ids) {
  const groups=[];
  let group=[];
  for(const id of ids) {
    if (!routineIdPattern.test(id)) fail("judging_invalid_response","No pudimos verificar los identificadores del bloque.",502);
    const candidate=[...group,id];
    if(group.length && (candidate.length>200 || encodeURIComponent(`in.(${candidate.join(",")})`).length>6000)) {
      groups.push(group);group=[];
    }
    group.push(id);
  }
  if(group.length)groups.push(group);
  return groups;
}

// A result's category can include other routines, so fetch the complete blocks
// containing the participant's presentations. Full-event metadata establishes
// membership; scoring rows remain limited to those blocks and stay server-side.
export async function getJudgingSheets(env, eventId, { routineIds, fetcher = fetch, trustedEventId } = {}) {
  eventId = allowedParticipantEventId(env,eventId,trustedEventId);
  if (!Array.isArray(routineIds) || !routineIds.length || routineIds.length>50
    || routineIds.some(id=>typeof id!=="string" || !routineIdPattern.test(id))) {
    fail("judging_invalid_routine","No pudimos identificar las hojas de esta presentación.",400);
  }
  const budget={requests:0,rows:0}, config=configuration(env);
  const event=await readEvent(config,eventId,fetcher,eventColumns,budget);
  const readTable=table=>readRows(config,table,{select:tableColumns[table],event_id:`eq.${eventId}`,order:tableOrders[table]},fetcher,budget);
  const [allRoutines,blocks]=await Promise.all([readTable("routines"),readTable("blocks")]);
  const byRoutine=new Map(),byBlock=new Map();
  for(const block of blocks) {
    const id=cleanText(block.block_id);
    if(block.event_id!==eventId || !id || byBlock.has(id)) fail("judging_invalid_response","No pudimos comprobar los bloques del programa.",502);
    byBlock.set(id,block);
  }
  for(const routine of allRoutines) {
    const id=cleanText(routine.routine_id);
    if(routine.event_id!==eventId || !id || id!==routine.routine_id || byRoutine.has(id)) {
      fail("judging_invalid_response","No pudimos comprobar las identidades del programa.",502);
    }
    byRoutine.set(id,routine);
  }
  const blockFor=routine=>{
    if(cleanText(routine.block_id))return {id:cleanText(routine.block_id)};
    const label=cleanText(routine.block);
    if(!label)return {id:""};
    const candidates=blocks.filter(block=>cleanText(block.name)===label);
    if(candidates.length>1)return {id:"",ambiguous:candidates.map(block=>cleanText(block.block_id))};
    return {id:candidates[0]?.block_id || stableBlock(label)};
  };
  const selectedBlocks=new Set();
  for(const id of new Set(routineIds)) {
    const routine=byRoutine.get(id);
    if(!routine)continue; // A not-yet-imported presentation stays unlinked.
    const block=blockFor(routine);
    if(!block.id)fail("judging_invalid_response","Esta presentación todavía no tiene un bloque de competencia identificable.",502);
    selectedBlocks.add(block.id);
  }
  if(!selectedBlocks.size) {
    const snapshot=buildJudgingScoreSnapshot({event,blocks:[],routines:[],judges:[],templates:[],criteria:[],scores:[],penalties:[],feedback:[],specialAwards:[]});
    return {...snapshot,resultScope:{complete:false,eventId,blockIds:[]}};
  }
  const routines=[];
  for(const routine of allRoutines) {
    const block=blockFor(routine);
    if(block.ambiguous?.some(id=>selectedBlocks.has(id))) fail("judging_invalid_response","El programa contiene bloques ambiguos; revisa su asociación.",502);
    if(selectedBlocks.has(block.id))routines.push({...routine,block_id:block.id});
  }
  const chunks=routineChunks(routines.map(routine=>routine.routine_id));
  const readScoring=async table=>{
    const rows=[];
    for(const ids of chunks) {
      const page=await readRows(config,table,{select:tableColumns[table],event_id:`eq.${eventId}`,order:tableOrders[table],
        routine_id:`in.(${ids.join(",")})`},fetcher,budget);
      if(page.some(row=>row.event_id!==eventId || !ids.includes(row.routine_id))) {
        fail("judging_invalid_response","No pudimos verificar las hojas de esta presentación.",502);
      }
      rows.push(...page);
    }
    return rows;
  };
  const metadata=["judges","criteria_templates","criteria"],scoring=["scores","penalties","feedback"];
  const entries=await Promise.all([...metadata.map(async table=>[table,await readTable(table)]),
    ...scoring.map(async table=>[table,await readScoring(table)])]);
  const data=Object.fromEntries(entries);
  if(metadata.some(table=>data[table].some(row=>row.event_id!==eventId))) {
    fail("judging_invalid_response","No pudimos comprobar los criterios y jueces del evento.",502);
  }
  const snapshot=buildJudgingScoreSnapshot({event,blocks:blocks.filter(block=>selectedBlocks.has(block.block_id)),routines,judges:data.judges,
    templates:data.criteria_templates,criteria:data.criteria,scores:data.scores,penalties:data.penalties,
    feedback:data.feedback,specialAwards:[]},new Date().toISOString());
  return {...snapshot,resultScope:{complete:true,eventId,blockIds:[...selectedBlocks]}};
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
