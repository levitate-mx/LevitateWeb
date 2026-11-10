import { judgingConnection, readJudgingRows } from "./judging-reader.js";
import { buildJudgingScoreSnapshot } from "./judging-score-data.js";
import {
  levitateJudgingEventIds,
  requireJudgingEvent,
} from "./judging-authority.js";

const fields = {
  blocks: "event_id,block_id,name,title,sort_order,is_active,updated_at",
  routines:
    "event_id,routine_id,block_id,block,block_title,sort_order,name,academy,division,genre,level,category,choreographer,state,scheduled_time,duration,updated_at",
  judges:
    "event_id,judge_id,name,role,sort_order,photo_data,hero_image_name,assigned_block_ids,updated_at",
  criteria_templates:
    "event_id,template_id,genre,title,max_score,sort_order,template_version,applies_to",
  criteria:
    "event_id,template_id,criterion_id,section,label,max_score,sort_order,is_required",
  scores: "event_id,block_id,routine_id,judge_id,criterion_id,value,updated_at",
  feedback: "event_id,block_id,routine_id,judge_id,body,updated_at",
  penalties: "event_id,block_id,routine_id,judge_id,value,updated_at",
  routine_favorite_votes:
    "event_id,block_id,routine_id,judge_id,category,updated_at",
  routine_favorites:
    "event_id,block_id,routine_id,judge_id,category,updated_at",
  special_awards: "event_id,block_id,award,routine_id,manual_value,updated_at",
};
const orders = {
  blocks: "sort_order.asc,block_id.asc",
  routines: "sort_order.asc,routine_id.asc",
  judges: "sort_order.asc,judge_id.asc",
  criteria_templates: "sort_order.asc,template_id.asc",
  criteria: "template_id.asc,sort_order.asc,criterion_id.asc",
  scores: "routine_id.asc,judge_id.asc,criterion_id.asc",
  feedback: "routine_id.asc,judge_id.asc",
  penalties: "routine_id.asc,judge_id.asc",
  routine_favorite_votes:
    "block_id.asc,routine_id.asc,judge_id.asc,category.asc",
  routine_favorites: "block_id.asc,judge_id.asc,category.asc",
  special_awards: "block_id.asc,award.asc",
};
const idPattern = /^[A-Za-z0-9_-]{1,160}$/;
function browserPhoto(value) {
  if (typeof value !== "string" || !value) return "";
  if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))
    return value;
  if (!/^[A-Za-z0-9+/]+=*$/.test(value)) return "";
  const type = value.startsWith("/9j/")
    ? "jpeg"
    : value.startsWith("iVBORw0KGgo")
      ? "png"
      : value.startsWith("UklGR")
        ? "webp"
        : null;
  return type ? `data:image/${type};base64,${value}` : "";
}
const fail = (code, message, statusCode = 400) => {
  throw Object.assign(new Error(message), { code, statusCode });
};
export const adminJudgingJson = (data) =>
  Response.json(data, {
    headers: { "cache-control": "no-store, private", vary: "Cookie" },
  });
export function requireJudgingAdmin(session) {
  if (session?.user?.role !== "admin")
    fail(
      "judging_admin_forbidden",
      "Esta cuenta no tiene permisos de administracion.",
      403,
    );
}
export async function adminJudgingBody(request, maximum = 3500000) {
  const url = new URL(request.url);
  if (request.method !== "POST")
    fail("method_not_allowed", "Metodo no permitido.", 405);
  if (
    request.headers.get("origin") !== url.origin ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    fail(
      "judging_invalid_origin",
      "El cambio debe realizarse desde Levitate.",
      403,
    );
  if (Number(request.headers.get("content-length") || 0) > maximum)
    fail("judging_too_large", "El archivo o envio supera el limite.", 413);
  const text = await request.text();
  if (text.length > maximum)
    fail("judging_too_large", "El archivo o envio supera el limite.", 413);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail("judging_invalid_json", "El envio no es valido.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("judging_invalid_json", "El envio no es valido.");
  return data;
}
function text(value, name, maximum = 160, optional = false) {
  if (
    typeof value !== "string" ||
    value.length > maximum ||
    (!optional && !value.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    fail("judging_invalid_field", `Revisa ${name}.`);
  return value.trim();
}
function id(value, name) {
  if (typeof value !== "string" || !idPattern.test(value))
    fail("judging_invalid_id", `Revisa ${name}.`);
  return value;
}
function revision(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    fail("judging_revision_missing", "Actualiza los datos antes de guardar.");
  return value;
}
export function validateAdminOperation(action, input) {
  const d = {};
  if (["metadata", "move-routine", "delete-routine"].includes(action)) {
    d.routine_id = id(input.routine_id, "la coreografia");
    d.expected_updated_at = revision(input.expected_updated_at);
    if (action === "metadata") {
      if (
        ![
          "name",
          "academy",
          "division",
          "genre",
          "level",
          "category",
          "choreographer",
          "state",
          "scheduled_time",
          "duration",
        ].includes(input.field)
      )
        fail("judging_invalid_field", "Campo no permitido.");
      d.field = input.field;
      d.value = text(
        input.value,
        "el valor",
        200,
        !["name", "genre"].includes(input.field),
      );
    } else if (action === "move-routine")
      d.target_block_id = id(input.target_block_id, "el bloque destino");
    else {
      d.confirmation = text(input.confirmation, "la confirmacion");
      if (d.confirmation !== d.routine_id)
        fail("judging_confirmation", "Confirma el numero de coreografia.");
    }
  } else if (["upsert-judge", "delete-judge"].includes(action)) {
    d.judge_id = id(input.judge_id, "el juez");
    if (["ati", "admin"].includes(d.judge_id))
      fail(
        "judging_invalid_judge",
        "Ese perfil no se puede modificar desde jueces.",
        403,
      );
    if (input.expected_updated_at != null)
      d.expected_updated_at = revision(input.expected_updated_at);
    if (action === "delete-judge") {
      d.confirmation = text(input.confirmation, "la confirmacion");
      if (d.confirmation !== d.judge_id)
        fail("judging_confirmation", "Confirma el juez.");
    } else {
      d.name = text(input.name, "el nombre", 100);
      if (
        !Array.isArray(input.assigned_block_ids) ||
        input.assigned_block_ids.length > 200
      )
        fail("judging_invalid_blocks", "Revisa los bloques asignados.");
      d.assigned_block_ids = [
        ...new Set(input.assigned_block_ids.map((v) => id(v, "el bloque"))),
      ];
      if (input.photo_data !== undefined) {
        if (
          typeof input.photo_data !== "string" ||
          input.photo_data.length > 1500000 ||
          !(
            /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(
              input.photo_data,
            ) || input.photo_data === ""
          )
        )
          fail(
            "judging_invalid_photo",
            "Usa una foto JPEG, PNG o WebP de hasta 1 MB.",
          );
        // Native iOS decodes plain base64, not a browser data URL.
        d.photo_data = input.photo_data ? input.photo_data.split(",")[1] : "";
      }
    }
  } else if (action === "special-award") {
    d.block_id = id(input.block_id, "el bloque");
    d.award = text(input.award, "el premio", 80);
    if (!/^award_[1-9][0-9]?$/.test(d.award))
      fail("judging_invalid_award", "Premio no valido.");
    d.manual_value = text(input.manual_value, "el premio", 200, true);
  } else if (
    ["configuration", "activate", "archive", "restore"].includes(action)
  ) {
    d.expected_updated_at = revision(input.expected_updated_at);
    if (action === "archive")
      d.confirmation = text(input.confirmation, "la confirmacion");
    if (action === "configuration") {
      const c = input.configuration;
      if (
        !c ||
        typeof c !== "object" ||
        Array.isArray(c) ||
        Object.keys(c).some((k) => !["scoring", "resultReport"].includes(k))
      )
        fail("judging_invalid_configuration", "Configuracion no valida.");
      const s = c.scoring;
      if (s) {
        if (
          !["average", "sum"].includes(s.aggregation) ||
          !["ignore", "zero"].includes(s.missingScorePolicy) ||
          !["ignore", "zero"].includes(s.officialMissingScorePolicy) ||
          ![s.dropHighestCount, s.dropLowestCount].every(
            (v) => Number.isInteger(v) && v >= 0 && v <= 20,
          ) ||
          typeof s.includePenalties !== "boolean"
        )
          fail(
            "judging_invalid_configuration",
            "Revisa las reglas de calculo.",
          );
        for (const name of ["criterionWeights", "evaluatorWeights"])
          if (
            s[name] != null &&
            (!s[name] ||
              typeof s[name] !== "object" ||
              Array.isArray(s[name]) ||
              Object.entries(s[name]).some(
                ([k, v]) =>
                  k.length > 160 || !Number.isFinite(v) || v < 0 || v > 100,
              ))
          )
            fail(
              "judging_invalid_configuration",
              "Las ponderaciones deben ser numeros entre 0 y 100.",
            );
      }
      if (
        c.resultReport &&
        (typeof c.resultReport !== "object" ||
          !Number.isInteger(c.resultReport.rankedPositions) ||
          c.resultReport.rankedPositions < 1 ||
          c.resultReport.rankedPositions > 20)
      )
        fail("judging_invalid_configuration", "Revisa el dictamen.");
      d.configuration = c;
    }
  } else fail("judging_invalid_action", "Operacion no disponible.", 404);
  return d;
}

export async function readAdminEvent(
  env,
  eventId,
  { fetcher = fetch, allowArchived = false } = {},
) {
  eventId = await requireJudgingEvent(env, eventId);
  const config = judgingConnection(env);
  const rows = await readJudgingRows(
    config,
    "events",
    {
      select:
        "id,slug,name,source_name,is_active,event_type,competition_config,updated_at",
      id: `eq.${eventId}`,
      order: "id.asc",
    },
    fetcher,
  );
  if (rows.length !== 1 || rows[0].id !== eventId)
    fail("judging_event_missing", "No se encontro el evento.", 404);
  if (
    ![
      null,
      undefined,
      "event",
      ...(allowArchived ? ["archived"] : []),
    ].includes(rows[0].event_type)
  )
    fail("judging_event_archived", "El evento esta archivado.", 409);
  return { event: rows[0], config, eventId };
}
export async function readAdminTable(
  scope,
  table,
  fetcher = fetch,
  filter = {},
) {
  const rows = await readJudgingRows(
    scope.config,
    table,
    {
      select: fields[table],
      event_id: `eq.${scope.eventId}`,
      order: orders[table],
      ...filter,
    },
    fetcher,
  );
  if (rows.some((r) => r.event_id !== scope.eventId))
    fail(
      "judging_scope_mismatch",
      "No se pudo comprobar el alcance del programa.",
      502,
    );
  return rows;
}
export async function readAdminSnapshot(
  env,
  eventId,
  { fetcher = fetch, blockId } = {},
) {
  const scope = await readAdminEvent(env, eventId, { fetcher });
  const raw = Object.fromEntries(
    await Promise.all(
      Object.keys(fields).map(async (table) => [
        table,
        await readAdminTable(scope, table, fetcher),
      ]),
    ),
  );
  const votes = new Map();
  for (const r of [...raw.routine_favorites, ...raw.routine_favorite_votes])
    votes.set(
      JSON.stringify([r.block_id, r.routine_id, r.judge_id, r.category]),
      r,
    );
  const snapshot = buildJudgingScoreSnapshot({
    event: scope.event,
    ...raw,
    templates: raw.criteria_templates,
    specialAwards: raw.special_awards,
  });
  const { results: accounts } = await env.DB.prepare(
    `SELECT a.judge_id,a.enabled,u.username,u.id user_id FROM registration_judge_assignments a
    JOIN registration_users u ON u.id=a.user_id WHERE a.event_id=? AND u.is_judge=1`,
  )
    .bind(scope.eventId)
    .all();
  return {
    event: scope.event,
    blocks: raw.blocks,
    routines: raw.routines,
    judges: raw.judges.map((judge) => ({
      ...judge,
      photo_data: browserPhoto(judge.photo_data),
    })),
    templates: raw.criteria_templates,
    criteria: raw.criteria,
    favorites: [...votes.values()],
    specialAwards: raw.special_awards,
    accounts,
    snapshot,
  };
}
export async function adminBridge(
  env,
  session,
  action,
  eventId,
  data,
  { fetcher = fetch } = {},
) {
  const secret = env.LEVITATE_ADMIN_WEB_SECRET;
  if (typeof secret !== "string" || secret.length < 40)
    fail(
      "judging_admin_not_configured",
      "La conexion de administracion todavia no esta configurada.",
      503,
    );
  const config = judgingConnection(env);
  let response;
  try {
    response = await fetcher(`${config.base}/functions/v1/levitate-web-admin`, {
      method: "POST",
      headers: {
        ...config.headers,
        "content-type": "application/json",
        "x-levitate-admin-secret": secret,
      },
      body: JSON.stringify({
        action,
        event_id: eventId,
        allowed_event_ids: await levitateJudgingEventIds(env),
        actor_id: session.user.id,
        data,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    fail(
      "judging_admin_unavailable",
      "No se pudo conectar con la base. No se confirmo el cambio.",
      503,
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    fail(
      "judging_admin_rejected",
      typeof result?.error === "string"
        ? result.error
        : "La base de datos no confirmo el cambio.",
      response.status === 409 ? 409 : 502,
    );
  return result;
}

export async function handleJudgingAdmin(
  request,
  env,
  session,
  { fetcher = fetch, hashPassword } = {},
) {
  requireJudgingAdmin(session);
  const url = new URL(request.url),
    action = url.pathname.split("/").pop();
  if (action === "import") {
    const body = await adminJudgingBody(request, 28500000);
    const name = text(body.name, "el nombre del evento", 150),
      filename = text(body.filename, "el archivo", 160);
    if (
      !/\.xlsx?$/i.test(filename) ||
      typeof body.payload_base64 !== "string" ||
      !/^[A-Za-z0-9+/]+=*$/.test(body.payload_base64) ||
      body.payload_base64.length > 28000000
    )
      fail("judging_invalid_file", "Usa un archivo Excel de hasta 20 MB.");
    const config = judgingConnection(env),
      slug = `levitate-web-${crypto.randomUUID()}`;
    let response;
    try {
      response = await fetcher(`${config.base}/functions/v1/import-excel`, {
        method: "POST",
        headers: { ...config.headers, "content-type": "application/json" },
        redirect: "manual",
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({
          event_slug: slug,
          event_name: name,
          filename,
          payload_base64: body.payload_base64,
          activate: false,
          replace_event: false,
          force_replace: false,
          allow_embedded_templates: true,
          device_id: "levitate-web-admin",
        }),
      });
    } catch {
      fail(
        "judging_import_unavailable",
        "No se confirmo la importacion. Los eventos existentes no se modificaron.",
        503,
      );
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.event_id || result.event_slug !== slug)
      fail(
        "judging_import_failed",
        typeof result?.error === "string"
          ? result.error
          : "No se pudo importar el programa.",
        502,
      );
    await env.DB.prepare(
      "INSERT INTO registration_judging_events(event_id,source_name,created_by) VALUES (?,?,?)",
    )
      .bind(result.event_id, filename, session.user.id)
      .run();
    return adminJudgingJson({ ...result, inactive: true });
  }
  if (action === "events") {
    if (request.method !== "GET")
      fail("method_not_allowed", "Metodo no permitido.", 405);
    const ids = await levitateJudgingEventIds(env),
      config = judgingConnection(env);
    const rows = await readJudgingRows(
      config,
      "events",
      {
        select: "id,slug,name,source_name,is_active,event_type,updated_at",
        id: `in.(${ids.join(",")})`,
        order: "is_active.desc,created_at.desc,id.asc",
      },
      fetcher,
    );
    return adminJudgingJson({
      user: { id: session.user.id, name: session.user.name },
      events: rows.filter(
        (e) =>
          ids.includes(e.id) &&
          [null, undefined, "event", "archived"].includes(e.event_type),
      ),
    });
  }
  const eventId = await requireJudgingEvent(
    env,
    url.searchParams.get("eventId"),
  );
  if (action === "exports" && request.method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT e.id,e.block_id,e.title,e.created_at,COUNT(f.id) files FROM registration_judging_exports e
      LEFT JOIN registration_judging_export_files f ON f.export_id=e.id WHERE e.event_id=? GROUP BY e.id ORDER BY e.created_at DESC LIMIT 100`,
    )
      .bind(eventId)
      .all();
    return adminJudgingJson({ exports: results });
  }
  if (action === "snapshot" && request.method === "GET")
    return adminJudgingJson(await readAdminSnapshot(env, eventId, { fetcher }));
  if (action === "activity" && request.method === "GET") {
    const scope = await readAdminEvent(env, eventId, { fetcher });
    const rows = await readJudgingRows(
      scope.config,
      "judge_activity",
      {
        select:
          "event_id,judge_id,device_id,state,block_id,routine_id,platform,updated_at,sync_diagnostics,sync_reported_at",
        event_id: `eq.${eventId}`,
        order: "updated_at.desc",
      },
      fetcher,
    );
    if (rows.some((r) => r.event_id !== eventId))
      fail("judging_scope_mismatch", "No se pudo verificar la actividad.", 502);
    return adminJudgingJson({
      activity: rows,
      fetchedAt: new Date().toISOString(),
    });
  }
  if (action === "access-codes" && request.method === "GET") {
    await readAdminEvent(env, eventId, { fetcher, allowArchived: true });
    return adminJudgingJson(
      await adminBridge(env, session, "access-codes", eventId, {}, { fetcher }),
    );
  }
  const body = await adminJudgingBody(request);
  await readAdminEvent(env, eventId, {
    fetcher,
    allowArchived: action === "restore",
  });
  if (action === "web-account") {
    const judgeId = id(body.judge_id, "el juez");
    const scope = await readAdminEvent(env, eventId, { fetcher });
    const judges = await readAdminTable(scope, "judges", fetcher, {
      judge_id: `eq.${judgeId}`,
    });
    if (judges.length !== 1 || judges[0].role !== "judge")
      fail("judging_invalid_judge", "No se encontro un juez valido.", 404);
    if (body.user_id) {
      const uid = text(body.user_id, "el usuario");
      const user = await env.DB.prepare(
        "SELECT id FROM registration_users WHERE id=? AND is_judge=1 AND status='active'",
      )
        .bind(uid)
        .first();
      if (!user)
        fail(
          "judging_invalid_user",
          "El usuario no es una cuenta de juez.",
          404,
        );
      await env.DB.prepare(
        "UPDATE registration_judge_assignments SET enabled=? WHERE user_id=? AND event_id=? AND judge_id=?",
      )
        .bind(body.enabled === true ? 1 : 0, uid, eventId, judgeId)
        .run();
      return adminJudgingJson({ ok: true });
    }
    const username = text(body.username, "el usuario", 60).toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,59}$/.test(username))
      fail(
        "judging_invalid_username",
        "Usa al menos tres letras o numeros para el usuario.",
      );
    const email = body.email
      ? text(body.email, "el correo", 160).toLowerCase()
      : `${username}@example.invalid`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail("judging_invalid_email", "Revisa el correo.");
    const existing = await env.DB.prepare(
      "SELECT id FROM registration_users WHERE username=? OR email=?",
    )
      .bind(username, email)
      .first();
    const bound = await env.DB.prepare(
      "SELECT user_id FROM registration_judge_assignments WHERE event_id=? AND judge_id=?",
    )
      .bind(eventId, judgeId)
      .first();
    if (existing || bound)
      fail(
        "judging_account_exists",
        "El usuario o el acceso ya existe. No se modifico ninguna contraseña.",
        409,
      );
    if (!hashPassword)
      fail("judging_admin_not_configured", "No se puede crear el acceso.", 503);
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const password = Array.from(bytes, (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
    const uid = crypto.randomUUID(),
      academy = crypto.randomUUID(),
      hash = await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO registration_academies(id,name,contact_name,email) VALUES (?,?,?,?)",
      ).bind(academy, "Jueces Levitate", judges[0].name, email),
      env.DB.prepare(
        `INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,is_judge,email_confirmed_at) VALUES (?,?,?,?,?,?,1,datetime('now'))`,
      ).bind(uid, academy, judges[0].name, username, email, hash),
      env.DB.prepare(
        "INSERT INTO registration_judge_assignments(user_id,event_id,judge_id) VALUES (?,?,?)",
      ).bind(uid, eventId, judgeId),
    ]);
    return adminJudgingJson({ ok: true, username, password });
  }
  const data = validateAdminOperation(action, body);
  const result = await adminBridge(env, session, action, eventId, data, {
    fetcher,
  });
  if (action === "delete-judge")
    await env.DB.prepare(
      "UPDATE registration_judge_assignments SET enabled=0 WHERE event_id=? AND judge_id=?",
    )
      .bind(eventId, data.judge_id)
      .run();
  return adminJudgingJson(result);
}
