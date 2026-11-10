import { judgingConnection, readJudgingRows } from "./judging-reader.js";
import {
  requireJudgingEvent,
  levitateJudgingEventIds,
} from "./judging-authority.js";

const routineColumns =
  "event_id,routine_id,block_id,block,block_title,sort_order,name,academy,division,genre,level,category,choreographer,state,scheduled_time,duration,participant";
const orders = {
  blocks: "sort_order.asc,block_id.asc",
  routines: "sort_order.asc,routine_id.asc",
  criteria_templates: "sort_order.asc,template_id.asc",
  criteria: "template_id.asc,sort_order.asc,criterion_id.asc",
  scores: "routine_id.asc,judge_id.asc,criterion_id.asc",
  feedback: "routine_id.asc,judge_id.asc",
  penalties: "routine_id.asc,judge_id.asc",
  routine_favorite_votes:
    "block_id.asc,routine_id.asc,judge_id.asc,category.asc",
  routine_favorites: "block_id.asc,judge_id.asc,category.asc",
};
const columns = {
  blocks: "event_id,block_id,name,title,sort_order,is_active",
  routines: routineColumns,
  criteria_templates: "event_id,template_id,genre,title,max_score,sort_order",
  criteria:
    "event_id,template_id,criterion_id,section,label,max_score,sort_order",
  scores: "event_id,block_id,routine_id,judge_id,criterion_id,value,updated_at",
  feedback: "event_id,block_id,routine_id,judge_id,body,updated_at",
  penalties: "event_id,block_id,routine_id,judge_id,value,updated_at",
  routine_favorite_votes:
    "event_id,block_id,routine_id,judge_id,category,updated_at",
  routine_favorites:
    "event_id,block_id,routine_id,judge_id,category,updated_at",
};
const ownTables = new Set([
  "scores",
  "feedback",
  "penalties",
  "routine_favorite_votes",
  "routine_favorites",
]);
const categories = [
  ["costume", "favorite_1"],
  ["choreography", "favorite_2"],
  ["music", "favorite_3"],
];

function fail(code, message, statusCode = 400) {
  throw Object.assign(new Error(message), { code, statusCode });
}
function json(data) {
  return Response.json(data, {
    headers: { "cache-control": "no-store, private", vary: "Cookie" },
  });
}
function validId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);
}
function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}
function allowedBlock(scope, blockId) {
  return (
    (!scope.blocks.length || scope.blocks.includes(blockId)) &&
    (!scope.assigned.length || scope.assigned.includes(blockId))
  );
}

async function assignments(env, session) {
  if (session?.user?.role !== "judge")
    fail("judge_forbidden", "Esta cuenta no tiene acceso de juez.", 403);
  const { results } = await env.DB.prepare(
    `SELECT event_id, judge_id, block_ids_json
    FROM registration_judge_assignments WHERE user_id = ? AND enabled = 1 ORDER BY created_at, event_id`,
  )
    .bind(session.user.id)
    .all();
  const allowed = [];
  for (const row of results) {
    try {
      await requireJudgingEvent(env, row.event_id);
      allowed.push(row);
    } catch (error) {
      if (error.statusCode !== 403 && error.statusCode !== 400) throw error;
    }
  }
  return allowed;
}

async function scopeFor(env, rows, eventId, fetcher) {
  const grant = rows.find((row) => row.event_id === eventId);
  if (!grant || !validId(grant.judge_id))
    fail(
      "judge_event_forbidden",
      "Este evento no está asignado a tu cuenta.",
      403,
    );
  await requireJudgingEvent(env, eventId);
  const config = judgingConnection(env);
  const read = async (table, select, filters = {}) => {
    const rows = await readJudgingRows(
      config,
      table,
      {
        select,
        event_id: `eq.${eventId}`,
        order: orders[table] || "judge_id.asc",
        ...filters,
      },
      fetcher,
    );
    if (rows.some((row) => row.event_id !== eventId))
      fail(
        "judge_invalid_response",
        "No pudimos verificar el evento de jueceo.",
        502,
      );
    return rows;
  };
  const [events, judges] = await Promise.all([
    readJudgingRows(
      config,
      "events",
      {
        select: "id,slug,name,source_name,is_active,event_type",
        id: `eq.${eventId}`,
        order: "id.asc",
      },
      fetcher,
    ),
    read(
      "judges",
      "event_id,judge_id,name,role,hero_image_name,photo_data,assigned_block_ids",
      { judge_id: `eq.${grant.judge_id}` },
    ),
  ]);
  if (
    events.length !== 1 ||
    events[0].id !== eventId ||
    ![null, undefined, "event"].includes(events[0].event_type) ||
    judges.length !== 1 ||
    judges[0].event_id !== eventId ||
    judges[0].judge_id !== grant.judge_id ||
    judges[0].role !== "judge" ||
    ["ati", "admin"].includes(grant.judge_id)
  ) {
    fail(
      "judge_assignment_unavailable",
      "La asignación de jueceo ya no está disponible.",
      403,
    );
  }
  let blocks;
  try {
    blocks = JSON.parse(grant.block_ids_json);
  } catch {
    blocks = null;
  }
  const assigned = judges[0].assigned_block_ids;
  if (
    !Array.isArray(blocks) ||
    blocks.some((id) => !validId(id)) ||
    !Array.isArray(assigned) ||
    assigned.some((id) => !validId(id))
  ) {
    fail(
      "judge_invalid_assignment",
      "El administrador debe revisar los bloques asignados.",
      403,
    );
  }
  return {
    config,
    read,
    event: events[0],
    judge: judges[0],
    blocks,
    assigned,
    eventId,
    judgeId: grant.judge_id,
  };
}

async function readBundle(scope) {
  const permittedJudges = new Set(
    (scope.selectableJudges || [scope.judge]).map((judge) => judge.judge_id),
  );
  const entries = await Promise.all(
    Object.entries(columns).map(async ([table, select]) => {
      const rows = await scope.read(
        table,
        select,
        ownTables.has(table)
          ? {
              judge_id: scope.selectableJudges
                ? `in.(${[...permittedJudges].join(",")})`
                : `eq.${scope.judgeId}`,
            }
          : {},
      );
      if (
        rows.some(
          (row) =>
            row.event_id !== scope.eventId ||
            (ownTables.has(table) && !permittedJudges.has(row.judge_id)),
        )
      ) {
        fail(
          "judge_invalid_response",
          "No pudimos verificar los datos de jueceo.",
          502,
        );
      }
      return [table, rows];
    }),
  );
  const data = Object.fromEntries(entries);
  data.blocks = data.blocks.filter((row) => allowedBlock(scope, row.block_id));
  data.routines = data.routines.filter((row) =>
    allowedBlock(scope, row.block_id),
  );
  const routineIds = new Set(data.routines.map((row) => row.routine_id));
  for (const table of ownTables)
    data[table] = data[table].filter(
      (row) =>
        routineIds.has(row.routine_id) && allowedBlock(scope, row.block_id),
    );
  return {
    event: scope.event,
    ...data,
    judges: scope.selectableJudges || [scope.judge],
    favorites: [...data.routine_favorite_votes, ...data.routine_favorites],
  };
}

function templateFor(routine, templates) {
  return (
    templates.find((t) => normalize(t.genre) === normalize(routine.genre)) ||
    (normalize(routine.genre).includes("TELA") ||
    normalize(routine.genre).includes("ARO")
      ? templates.find((t) => normalize(t.genre) === "DANZA AEREA")
      : null) ||
    templates[0]
  );
}

export function validateJudgeRows(
  kind,
  input,
  scope,
  routines,
  templates,
  criteria,
) {
  if (!Array.isArray(input) || !input.length || input.length > 250)
    fail("judge_invalid_rows", "El envío de datos no es válido.");
  return input.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row))
      fail("judge_invalid_rows", "El envío de datos no es válido.");
    if (row.event_id !== scope.eventId || row.judge_id !== scope.judgeId)
      fail(
        "judge_scope_mismatch",
        "No podés modificar datos de otro juez o evento.",
        403,
      );
    const routine = routines.find((item) => item.routine_id === row.routine_id);
    if (
      !routine ||
      routine.event_id !== scope.eventId ||
      !allowedBlock(scope, routine.block_id) ||
      row.block_id !== routine.block_id
    )
      fail(
        "judge_routine_forbidden",
        "La coreografía o el bloque no están asignados a tu cuenta.",
        403,
      );
    const clean = {
      event_id: scope.eventId,
      judge_id: scope.judgeId,
      routine_id: routine.routine_id,
      block_id: routine.block_id,
      device_id:
        typeof row.device_id === "string" ? row.device_id.slice(0, 160) : "web",
      updated_at: new Date().toISOString(),
    };
    if (kind === "scores") {
      const template = templateFor(routine, templates);
      const criterion = criteria.find(
        (c) =>
          c.template_id === template?.template_id &&
          c.criterion_id === row.criterion_id,
      );
      if (
        !criterion ||
        !Number.isInteger(row.value) ||
        row.value < 0 ||
        row.value > Number(criterion.max_score)
      ) {
        fail(
          "judge_invalid_score",
          "El puntaje no corresponde a la hoja o está fuera del máximo permitido.",
        );
      }
      return { ...clean, criterion_id: row.criterion_id, value: row.value };
    }
    if (kind === "feedback") {
      if (typeof row.body !== "string" || row.body.length > 350)
        fail(
          "judge_invalid_feedback",
          "La devolución admite hasta 350 caracteres.",
        );
      return { ...clean, body: row.body };
    }
    if (kind === "penalties") {
      if (!Number.isFinite(row.value) || row.value < -100 || row.value > 0)
        fail(
          "judge_invalid_penalty",
          "La penalización debe estar entre -100 y 0.",
        );
      return { ...clean, value: row.value };
    }
    if (!categories.some((pair) => pair.includes(row.category)))
      fail("judge_invalid_favorite", "La categoría de favorito no es válida.");
    return { ...clean, category: row.category };
  });
}

async function writeRows(scope, kind, rows, fetcher) {
  const conflicts = {
    scores: "event_id,routine_id,judge_id,criterion_id",
    feedback: "event_id,routine_id,judge_id",
    penalties: "event_id,routine_id,judge_id",
    favorites: "event_id,block_id,routine_id,judge_id,category",
  };
  if (kind === "delete-favorites") {
    for (const row of rows)
      for (const table of ["routine_favorite_votes", "routine_favorites"]) {
        const url = new URL(`/rest/v1/${table}`, scope.config.base);
        for (const key of ["event_id", "judge_id", "block_id", "routine_id"])
          url.searchParams.set(key, `eq.${row[key]}`);
        const pair = categories.find((pair) => pair.includes(row.category));
        url.searchParams.set("category", `in.(${pair.join(",")})`);
        await sendWrite(scope, url, "DELETE", null, fetcher);
      }
  } else {
    const table = kind === "favorites" ? "routine_favorite_votes" : kind;
    const url = new URL(`/rest/v1/${table}`, scope.config.base);
    url.searchParams.set("on_conflict", conflicts[kind]);
    await sendWrite(scope, url, "POST", rows, fetcher);
  }
}

async function sendWrite(scope, url, method, body, fetcher) {
  let response;
  try {
    response = await fetcher(url.toString(), {
      method,
      headers: {
        ...scope.config.headers,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    fail(
      "judge_sync_unavailable",
      "No se pudo conectar con la base de datos. Tus cambios siguen pendientes en este navegador.",
      503,
    );
  }
  if (!response.ok) {
    const reasons = {
      400: "La base de datos rechazó el formato de los datos.",
      401: "La conexión de jueceo no pudo autenticarse.",
      403: "La base de datos rechazó el permiso de guardado.",
      409: "La asignación o la coreografía cambió. Actualizá el programa e intentá de nuevo.",
      429: "Hay demasiados envíos. Intentá de nuevo en unos segundos.",
    };
    fail(
      "judge_sync_failed",
      `${reasons[response.status] || "La base de datos no pudo guardar los cambios."} (HTTP ${response.status})`,
      502,
    );
  }
}

export async function handleJudgeWorkspace(
  request,
  env,
  session,
  { fetcher = fetch } = {},
) {
  const url = new URL(request.url),
    action = url.pathname.split("/").pop();
  if (session?.user?.role !== "judge")
    fail("judge_forbidden", "Esta cuenta no tiene acceso de juez.", 403);
  const canSelect = String(env.JUDGING_SELECTABLE_JUDGE_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(session.user.id);
  if (canSelect)
    return handleSelectableWorkspace(request, env, session, action, fetcher);
  const grants = await assignments(env, session);
  if (action === "session" && request.method === "GET") {
    const scopes = await Promise.all(
      grants.map((grant) => scopeFor(env, grants, grant.event_id, fetcher)),
    );
    return json({
      user: { id: session.user.id, name: session.user.name },
      assignments: scopes.map((scope) => ({
        event: scope.event,
        judge: scope.judge,
      })),
    });
  }
  if (request.method !== (action === "bundle" ? "GET" : "POST"))
    fail("method_not_allowed", "Método no permitido.", 405);
  const eventId = url.searchParams.get("event_id");
  const scope = await scopeFor(env, grants, eventId, fetcher);
  return handleScopedJudgeAction(request, scope, action, fetcher);
}

async function selectableScope(env, eventId, fetcher, judgeId = null) {
  eventId = await requireJudgingEvent(env, eventId);
  const config = judgingConnection(env);
  const rows = await readJudgingRows(
    config,
    "judges",
    {
      select:
        "event_id,judge_id,name,role,hero_image_name,photo_data,assigned_block_ids",
      event_id: `eq.${eventId}`,
      order: "sort_order.asc,judge_id.asc",
    },
    fetcher,
  );
  if (rows.some((row) => row.event_id !== eventId))
    fail(
      "judge_invalid_response",
      "No pudimos verificar los jueces del evento.",
      502,
    );
  const judges = rows.filter(
    (row) => row.role === "judge" && !["ati", "admin"].includes(row.judge_id),
  );
  if (
    judges.some(
      (row) =>
        !validId(row.judge_id) ||
        !Array.isArray(row.assigned_block_ids) ||
        row.assigned_block_ids.some((id) => !validId(id)),
    )
  ) {
    fail(
      "judge_invalid_assignment",
      "El administrador debe revisar los jueces y bloques del programa.",
      403,
    );
  }
  const judge = judgeId
    ? judges.find((row) => row.judge_id === judgeId)
    : judges[0];
  if (!judge)
    fail(
      "judge_assignment_unavailable",
      "El juez no esta disponible para este evento.",
      403,
    );
  const scope = await scopeFor(
    env,
    [{ event_id: eventId, judge_id: judge.judge_id, block_ids_json: "[]" }],
    eventId,
    fetcher,
  );
  return { ...scope, availableJudges: judges };
}

async function handleSelectableWorkspace(
  request,
  env,
  session,
  action,
  fetcher,
) {
  const url = new URL(request.url);
  if (action === "session" && request.method === "GET") {
    const ids = await levitateJudgingEventIds(env),
      config = judgingConnection(env);
    const rows = await readJudgingRows(
      config,
      "events",
      {
        select: "id,slug,name,source_name,is_active,event_type",
        id: `in.(${ids.join(",")})`,
        order: "is_active.desc,created_at.desc,id.asc",
      },
      fetcher,
    );
    if (rows.some((event) => !ids.includes(event.id)))
      fail(
        "judge_invalid_response",
        "No pudimos verificar el catalogo de Levitate.",
        502,
      );
    const events = rows.filter((event) =>
      [null, undefined, "event"].includes(event.event_type),
    );
    const programs = new Map(
      events.map((event) => [event.id, { event, judges: [], blocks: [] }]),
    );
    const read = async (table, select, order) => {
      if (!programs.size) return [];
      const values = await readJudgingRows(
        config,
        table,
        { select, event_id: `in.(${[...programs.keys()].join(",")})`, order },
        fetcher,
      );
      if (values.some((row) => !programs.has(row.event_id)))
        fail(
          "judge_invalid_response",
          "No pudimos verificar los programas de Levitate.",
          502,
        );
      return values;
    };
    const [judges, blocks, routines] = await Promise.all([
      read(
        "judges",
        "event_id,judge_id,name,role,assigned_block_ids",
        "event_id.asc,sort_order.asc,judge_id.asc",
      ),
      read(
        "blocks",
        columns.blocks,
        "event_id.asc,sort_order.asc,block_id.asc",
      ),
      read(
        "routines",
        "event_id,routine_id,block_id,block,name,academy,division,genre,level,category",
        "event_id.asc,sort_order.asc,routine_id.asc",
      ),
    ]);
    for (const judge of judges) {
      if (judge.role !== "judge" || ["ati", "admin"].includes(judge.judge_id))
        continue;
      if (
        !validId(judge.judge_id) ||
        !Array.isArray(judge.assigned_block_ids) ||
        judge.assigned_block_ids.some((id) => !validId(id))
      )
        fail(
          "judge_invalid_assignment",
          "El administrador debe revisar los bloques de los jueces.",
          403,
        );
      programs.get(judge.event_id).judges.push(judge);
    }
    const byBlock = new Map();
    for (const routine of routines) {
      const key = JSON.stringify([routine.event_id, routine.block_id]);
      if (!byBlock.has(key)) byBlock.set(key, []);
      byBlock.get(key).push(routine);
    }
    for (const block of blocks)
      programs
        .get(block.event_id)
        .blocks.push({
          ...block,
          routines:
            byBlock.get(JSON.stringify([block.event_id, block.block_id])) || [],
        });
    const catalog = [...programs.values()]
      .filter((program) => program.judges.length)
      .map((program) => ({
        event: program.event,
        judge: program.judges[0],
        blocks: program.blocks,
      }));
    return json({
      user: { id: session.user.id, name: session.user.name },
      selectableJudges: true,
      assignments: catalog,
    });
  }
  if (request.method !== (action === "bundle" ? "GET" : "POST"))
    fail("method_not_allowed", "Metodo no permitido.", 405);
  const judgeId = url.searchParams.get("judge_id");
  if (action !== "bundle" && !validId(judgeId))
    fail("judge_invalid_judge", "Selecciona un juez antes de guardar.");
  const eventId = url.searchParams.get('event_id');
  const scope = action === 'bundle'
    ? await selectableScope(env,eventId,fetcher,judgeId)
    : await scopeFor(env,[{event_id:eventId,judge_id:judgeId,block_ids_json:'[]'}],eventId,fetcher);
  if (action === "bundle") {
    return handleScopedJudgeAction(
      request,
      { ...scope, assigned: [], selectableJudges: scope.availableJudges },
      action,
      fetcher,
    );
  }
  return handleScopedJudgeAction(request, scope, action, fetcher);
}

export async function handleAdminJudgeEditor(
  request,
  env,
  session,
  { fetcher = fetch } = {},
) {
  if (session?.user?.role !== "admin")
    fail(
      "judge_admin_forbidden",
      "Esta cuenta no tiene permisos de administracion.",
      403,
    );
  const url = new URL(request.url),
    eventId = await requireJudgingEvent(env, url.searchParams.get("event_id")),
    judgeId = url.searchParams.get("judge_id");
  if (!validId(judgeId))
    fail("judge_invalid_judge", "Selecciona un juez valido.");
  const scope = await scopeFor(
    env,
    [{ event_id: eventId, judge_id: judgeId, block_ids_json: "[]" }],
    eventId,
    fetcher,
  );
  const action = url.pathname.split("/").pop();
  if (action === "session" && request.method === "GET") {
    const routineId = url.searchParams.get("routine_id");
    if (routineId) {
      if (!validId(routineId))
        fail("judge_invalid_routine", "Selecciona una coreografia valida.");
      const rows = await scope.read(
        "routines",
        "event_id,routine_id,block_id",
        { routine_id: `eq.${routineId}` },
      );
      if (rows.length !== 1 || !allowedBlock(scope, rows[0].block_id))
        fail(
          "judge_routine_forbidden",
          "La coreografia no esta asignada a este juez.",
          403,
        );
    }
    return json({
      user: { id: session.user.id, name: session.user.name },
      assignments: [{ event: scope.event, judge: scope.judge }],
      editor: true,
      routineId,
    });
  }
  if (action === "activity" && request.method === "POST")
    return json({ ok: true });
  return handleScopedJudgeAction(request, scope, action, fetcher);
}

async function handleScopedJudgeAction(request, scope, action, fetcher) {
  const url = new URL(request.url);
  if (request.method !== (action === "bundle" ? "GET" : "POST"))
    fail("method_not_allowed", "Metodo no permitido.", 405);
  if (action === "bundle") return json(await readBundle(scope));
  if (
    request.headers.get("origin") !== url.origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  ) {
    fail(
      "judge_invalid_origin",
      "El envío debe realizarse desde la web de Levitate.",
      403,
    );
  }
  if (Number(request.headers.get("content-length") || 0) > 150000)
    fail("judge_request_too_large", "El envío es demasiado grande.", 413);
  const text = await request.text();
  if (text.length > 150000)
    fail("judge_request_too_large", "El envío es demasiado grande.", 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    fail("judge_invalid_json", "El envío no tiene un formato válido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail("judge_invalid_json", "El envío no tiene un formato válido.");
  if (action === "activity") {
    if (body.event_id !== scope.eventId || body.judge_id !== scope.judgeId)
      fail(
        "judge_scope_mismatch",
        "La sesión no corresponde a este juez.",
        403,
      );
    if (
      !["home", "judging"].includes(body.state) ||
      typeof body.device_id !== "string" ||
      !validId(body.device_id)
    ) {
      fail("judge_invalid_activity", "El estado de jueceo no es válido.");
    }
    if (body.routine_id != null) {
      if (!validId(body.routine_id))
        fail("judge_invalid_activity", "La coreografía no es válida.");
      const routines = await scope.read(
        "routines",
        "event_id,routine_id,block_id",
        { routine_id: `eq.${body.routine_id}` },
      );
      if (
        routines.length !== 1 ||
        routines[0].event_id !== scope.eventId ||
        routines[0].routine_id !== body.routine_id ||
        routines[0].block_id !== body.block_id ||
        !allowedBlock(scope, body.block_id)
      ) {
        fail(
          "judge_routine_forbidden",
          "La coreografía no está asignada a tu cuenta.",
          403,
        );
      }
    } else if (body.block_id != null)
      fail("judge_invalid_activity", "El estado del bloque no es válido.");
    const report = body.sync_diagnostics;
    const diagnostic =
      report &&
      Number.isInteger(report.pending_count) &&
      report.pending_count >= 0
        ? {
            version: 1,
            pending_count: report.pending_count,
            report_id:
              typeof report.report_id === "string"
                ? report.report_id.slice(0, 160)
                : "",
            last_confirmed_at:
              typeof report.last_confirmed_at === "string"
                ? report.last_confirmed_at.slice(0, 40)
                : null,
            last_error:
              typeof report.last_error === "string"
                ? report.last_error.slice(0, 800)
                : null,
            app_version: "Levitate Web",
            backend_host: new URL(request.url).host,
          }
        : null;
    const endpoint = new URL("/rest/v1/judge_activity", scope.config.base);
    endpoint.searchParams.set("on_conflict", "event_id,judge_id,device_id");
    await sendWrite(
      scope,
      endpoint,
      "POST",
      [
        {
          event_id: scope.eventId,
          judge_id: scope.judgeId,
          device_id: body.device_id,
          state: body.state,
          block_id: body.block_id ?? null,
          routine_id: body.routine_id ?? null,
          platform: "Web",
          updated_at: new Date().toISOString(),
          sync_diagnostics: diagnostic,
        },
      ],
      fetcher,
    );
    return json({ ok: true });
  }
  if (
    ![
      "scores",
      "feedback",
      "penalties",
      "favorites",
      "delete-favorites",
    ].includes(action)
  )
    fail("not_found", "Operación no disponible.", 404);
  const [routines, templates, criteria] = await Promise.all([
    scope.read("routines", routineColumns),
    scope.read("criteria_templates", columns.criteria_templates),
    scope.read("criteria", columns.criteria),
  ]);
  const rows = validateJudgeRows(
    action,
    body.rows,
    scope,
    routines,
    templates,
    criteria,
  );
  await writeRows(scope, action, rows, fetcher);
  return json({ ok: true });
}
