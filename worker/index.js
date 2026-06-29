const passportSessionCookieName = "levitate_passport_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return sendJson({ ok: true, storage: "cloudflare-d1" });
    }

    if (url.pathname === "/api/passport/claim") {
      return handlePassportClaim(request, env);
    }

    if (url.pathname === "/api/passport/recover") {
      return handlePassportRecover(request, env);
    }

    if (url.pathname === "/api/passport/me") {
      return handlePassportMe(request, env);
    }

    if (url.pathname === "/api/passport/scan") {
      return handlePassportScan(request, env);
    }

    if (url.pathname === "/api/passport/admin/summary") {
      return handlePassportAdminSummary(request, env);
    }

    if (url.pathname === "/api/passport/admin/export.csv") {
      return handlePassportAdminExport(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return sendJson({ error: { code: "not_found", message: "API route not found" } }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handlePassportClaim(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const body = await readJsonBody(request);
    const token = requireString(body.token, "token");
    const participant = {
      name: requireString(body.name, "name"),
      academy: requireString(body.academy, "academy"),
      category: typeof body.category === "string" ? body.category.trim() : "",
      contact: typeof body.contact === "string" ? body.contact.trim() : "",
    };

    const { sessionToken, state } = await claimPassport({
      db: getDb(env),
      token,
      participant,
      request,
    });

    return sendJson(state, 201, {
      "set-cookie": buildSessionCookie(request, sessionToken),
    });
  } catch (error) {
    return sendHttpError(error);
  }
}

async function handlePassportRecover(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const body = await readJsonBody(request);
    const token = requireString(body.token, "token");
    const result = await recoverPassport({
      db: getDb(env),
      token,
      request,
    });
    const headers = result.sessionToken ? { "set-cookie": buildSessionCookie(request, result.sessionToken) } : {};

    return sendJson(
      {
        status: result.status,
        state: result.state ?? null,
      },
      200,
      headers,
    );
  } catch (error) {
    return sendHttpError(error);
  }
}

async function handlePassportMe(request, env) {
  try {
    assertMethod(request, ["GET"]);
    const state = await getPassportStateFromRequest({ db: getDb(env), request });
    return sendJson(state);
  } catch (error) {
    return sendHttpError(error);
  }
}

async function handlePassportScan(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const body = await readJsonBody(request);
    const eventSlug = requireString(body.eventSlug, "eventSlug");
    const stationSlug = requireString(body.stationSlug, "stationSlug");
    const result = await scanStation({
      db: getDb(env),
      request,
      eventSlug,
      stationSlug,
    });

    return sendJson(result);
  } catch (error) {
    return sendHttpError(error);
  }
}

async function handlePassportAdminSummary(request, env) {
  try {
    assertMethod(request, ["GET"]);
    requirePassportAdmin(request, env);

    const url = new URL(request.url);
    const eventSlug = url.searchParams.get("eventSlug") || "levitate-cdmx-2026";
    const summary = await getPassportAdminSummary(getDb(env), eventSlug);

    return sendJson(summary);
  } catch (error) {
    return sendHttpError(error);
  }
}

async function handlePassportAdminExport(request, env) {
  try {
    assertMethod(request, ["GET"]);
    requirePassportAdmin(request, env);

    const url = new URL(request.url);
    const eventSlug = url.searchParams.get("eventSlug") || "levitate-cdmx-2026";
    const csv = await getPassportAdminCsv(getDb(env), eventSlug);

    return new Response(csv.body, {
      status: 200,
      headers: {
        "content-disposition": `attachment; filename="${csv.filename}"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return sendHttpError(error);
  }
}

function getDb(env) {
  if (!env.DB) {
    throwHttpError("missing_d1_binding", "Missing D1 binding DB", 500);
  }

  return env.DB;
}

async function claimPassport({ db, token, participant, request }) {
  const passport = await getPassportByClaimToken(db, token);

  if (!passport) {
    throwHttpError("passport_token_not_found", "Pasaporte no encontrado", 404);
  }

  if (passport.status === "disabled") {
    throwHttpError("passport_disabled", "Este pasaporte está deshabilitado", 409);
  }

  if (passport.status === "claimed") {
    throwHttpError("passport_already_claimed", "Este pasaporte ya fue activado", 409);
  }

  const updateResult = await db
    .prepare(
      `
        UPDATE passports
        SET
          status = 'claimed',
          participant_name = ?,
          academy = ?,
          category = ?,
          contact = ?,
          claimed_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ?
          AND status = 'available'
      `,
    )
    .bind(
      participant.name,
      participant.academy,
      participant.category || null,
      participant.contact || null,
      passport.id,
    )
    .run();

  if (!updateResult.meta?.changes) {
    throwHttpError("passport_already_claimed", "Este pasaporte ya fue activado", 409);
  }

  const sessionToken = await createPassportSession(db, passport.id, request);

  const state = await getPassportStateByPassportId(db, passport.id);
  return { sessionToken, state };
}

async function recoverPassport({ db, token, request }) {
  const passport = await getPassportByClaimToken(db, token);

  if (!passport) {
    throwHttpError("passport_token_not_found", "Pasaporte no encontrado", 404);
  }

  if (passport.status === "disabled") {
    throwHttpError("passport_disabled", "Este pasaporte está deshabilitado", 409);
  }

  if (passport.status === "available") {
    return { status: "available" };
  }

  const sessionToken = await createPassportSession(db, passport.id, request);
  const state = await getPassportStateByPassportId(db, passport.id);

  return {
    status: "claimed",
    sessionToken,
    state,
  };
}

async function getPassportByClaimToken(db, token) {
  const claimTokenHash = await hashToken(token);

  return db
    .prepare(
      `
        SELECT
          passports.*,
          passport_events.slug AS event_slug
        FROM passports
        INNER JOIN passport_events ON passport_events.id = passports.event_id
        WHERE passports.claim_token_hash = ?
        LIMIT 1
      `,
    )
    .bind(claimTokenHash)
    .first();
}

async function createPassportSession(db, passportId, request) {
  const sessionToken = createSessionToken();
  const sessionTokenHash = await hashToken(sessionToken);
  const userAgent = request.headers.get("user-agent");

  await db
    .prepare(
      `
        INSERT INTO passport_sessions (
          id,
          passport_id,
          session_token_hash,
          user_agent,
          expires_at
        )
        VALUES (?, ?, ?, ?, datetime('now', '+30 days'))
      `,
    )
    .bind(crypto.randomUUID(), passportId, sessionTokenHash, userAgent)
    .run();

  return sessionToken;
}

async function getPassportStateFromRequest({ db, request }) {
  const sessionToken = readCookie(request, passportSessionCookieName);

  if (!sessionToken) {
    throwHttpError("passport_session_missing", "Activa tu pasaporte para continuar", 401);
  }

  return getPassportStateBySessionToken(db, sessionToken);
}

async function getPassportStateBySessionToken(db, sessionToken) {
  const sessionTokenHash = await hashToken(sessionToken);
  const session = await db
    .prepare(
      `
        SELECT passport_id
        FROM passport_sessions
        WHERE session_token_hash = ?
          AND expires_at > datetime('now')
        LIMIT 1
      `,
    )
    .bind(sessionTokenHash)
    .first();

  if (!session) {
    throwHttpError("passport_session_invalid", "Tu sesión de pasaporte expiró o no existe", 401);
  }

  await db
    .prepare(
      `
        UPDATE passport_sessions
        SET last_seen_at = datetime('now')
        WHERE session_token_hash = ?
      `,
    )
    .bind(sessionTokenHash)
    .run();

  return getPassportStateByPassportId(db, session.passport_id);
}

async function scanStation({ db, request, eventSlug, stationSlug }) {
  const sessionToken = readCookie(request, passportSessionCookieName);

  if (!sessionToken) {
    throwHttpError("passport_session_missing", "Activa tu pasaporte para desbloquear sellos", 401);
  }

  const sessionTokenHash = await hashToken(sessionToken);
  const row = await db
    .prepare(
      `
        SELECT
          passport_sessions.passport_id,
          passports.event_id
        FROM passport_sessions
        INNER JOIN passports ON passports.id = passport_sessions.passport_id
        INNER JOIN passport_events ON passport_events.id = passports.event_id
        WHERE passport_sessions.session_token_hash = ?
          AND passport_sessions.expires_at > datetime('now')
          AND passport_events.slug = ?
        LIMIT 1
      `,
    )
    .bind(sessionTokenHash, eventSlug)
    .first();

  if (!row) {
    throwHttpError("passport_session_invalid", "Este pasaporte no corresponde a este evento", 401);
  }

  const station = await db
    .prepare(
      `
        SELECT passport_stations.*
        FROM passport_stations
        INNER JOIN passport_events ON passport_events.id = passport_stations.event_id
        WHERE passport_events.slug = ?
          AND passport_stations.slug = ?
        LIMIT 1
      `,
    )
    .bind(eventSlug, stationSlug)
    .first();

  if (!station) {
    throwHttpError("passport_station_not_found", "Estación no encontrada", 404);
  }

  await db
    .prepare(
      `
        INSERT OR IGNORE INTO station_scans (
          event_id,
          passport_id,
          station_id,
          metadata
        )
        VALUES (?, ?, ?, ?)
      `,
    )
    .bind(
      row.event_id,
      row.passport_id,
      station.id,
      JSON.stringify({
        userAgent: request.headers.get("user-agent"),
      }),
    )
    .run();

  const state = await getPassportStateByPassportId(db, row.passport_id);
  return { state, station: serializeStation(station) };
}

async function getPassportAdminSummary(db, eventSlug) {
  const event = await getPassportEventBySlug(db, eventSlug);
  const stationCount = await getPassportStationCount(db, event.id);
  const totalsRow = await db
    .prepare(
      `
        SELECT
          COUNT(*) AS passports,
          SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) AS claimed,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available,
          SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) AS disabled
        FROM passports
        WHERE event_id = ?
      `,
    )
    .bind(event.id)
    .first();
  const scansRow = await db
    .prepare("SELECT COUNT(*) AS scans FROM station_scans WHERE event_id = ?")
    .bind(event.id)
    .first();
  const completedRow = await db
    .prepare(
      `
        SELECT COUNT(*) AS completed
        FROM (
          SELECT passports.id, COUNT(station_scans.station_id) AS scanned_count
          FROM passports
          LEFT JOIN station_scans ON station_scans.passport_id = passports.id
          WHERE passports.event_id = ?
          GROUP BY passports.id
        ) passport_progress
        WHERE scanned_count >= ?
      `,
    )
    .bind(event.id, stationCount)
    .first();
  const { results: stations = [] } = await db
    .prepare(
      `
        SELECT
          passport_stations.id,
          passport_stations.slug,
          passport_stations.station_order,
          passport_stations.title,
          passport_stations.short_title,
          COUNT(station_scans.id) AS scans
        FROM passport_stations
        LEFT JOIN station_scans ON station_scans.station_id = passport_stations.id
        WHERE passport_stations.event_id = ?
        GROUP BY
          passport_stations.id,
          passport_stations.slug,
          passport_stations.station_order,
          passport_stations.title,
          passport_stations.short_title
        ORDER BY passport_stations.station_order ASC
      `,
    )
    .bind(event.id)
    .all();
  const { results: recentPassports = [] } = await db
    .prepare(
      `
        SELECT
          passports.code,
          passports.status,
          passports.participant_name,
          passports.academy,
          passports.category,
          passports.contact,
          passports.claimed_at,
          COUNT(station_scans.station_id) AS completed_stations
        FROM passports
        LEFT JOIN station_scans ON station_scans.passport_id = passports.id
        WHERE passports.event_id = ?
        GROUP BY passports.id
        ORDER BY COALESCE(passports.claimed_at, passports.created_at) DESC
        LIMIT 12
      `,
    )
    .bind(event.id)
    .all();
  const { results: recentScans = [] } = await db
    .prepare(
      `
        SELECT
          passports.code AS passport_code,
          passports.participant_name,
          passport_stations.title AS station_title,
          passport_stations.slug AS station_slug,
          station_scans.scanned_at
        FROM station_scans
        INNER JOIN passports ON passports.id = station_scans.passport_id
        INNER JOIN passport_stations ON passport_stations.id = station_scans.station_id
        WHERE station_scans.event_id = ?
        ORDER BY station_scans.scanned_at DESC
        LIMIT 16
      `,
    )
    .bind(event.id)
    .all();

  return {
    event: {
      slug: event.slug,
      title: event.title,
      city: event.city,
      date: event.event_date,
      passportName: event.passport_name,
    },
    totals: {
      passports: toNumber(totalsRow?.passports),
      claimed: toNumber(totalsRow?.claimed),
      available: toNumber(totalsRow?.available),
      disabled: toNumber(totalsRow?.disabled),
      scans: toNumber(scansRow?.scans),
      completed: toNumber(completedRow?.completed),
      stations: stationCount,
    },
    stations: stations.map((station) => ({
      id: station.id,
      slug: station.slug,
      order: station.station_order,
      title: station.title,
      shortTitle: station.short_title,
      scans: toNumber(station.scans),
    })),
    recentPassports: recentPassports.map((passport) => ({
      code: passport.code,
      status: passport.status,
      participantName: passport.participant_name,
      academy: passport.academy,
      category: passport.category,
      contact: passport.contact,
      claimedAt: passport.claimed_at,
      completedStations: toNumber(passport.completed_stations),
      totalStations: stationCount,
    })),
    recentScans: recentScans.map((scan) => ({
      passportCode: scan.passport_code,
      participantName: scan.participant_name,
      stationTitle: scan.station_title,
      stationSlug: scan.station_slug,
      scannedAt: scan.scanned_at,
    })),
  };
}

async function getPassportAdminCsv(db, eventSlug) {
  const event = await getPassportEventBySlug(db, eventSlug);
  const stationCount = await getPassportStationCount(db, event.id);
  const { results: passports = [] } = await db
    .prepare(
      `
        SELECT
          passports.code,
          passports.status,
          passports.participant_name,
          passports.academy,
          passports.category,
          passports.contact,
          passports.claimed_at,
          COUNT(station_scans.station_id) AS completed_count,
          GROUP_CONCAT(passport_stations.short_title, ' | ') AS completed_stations
        FROM passports
        LEFT JOIN station_scans ON station_scans.passport_id = passports.id
        LEFT JOIN passport_stations ON passport_stations.id = station_scans.station_id
        WHERE passports.event_id = ?
        GROUP BY passports.id
        ORDER BY passports.code ASC
      `,
    )
    .bind(event.id)
    .all();
  const header = [
    "code",
    "status",
    "participant_name",
    "academy",
    "category",
    "contact",
    "claimed_at",
    "completed_count",
    "total_stations",
    "completed_stations",
  ];
  const rows = passports.map((passport) => [
    passport.code,
    passport.status,
    passport.participant_name,
    passport.academy,
    passport.category,
    passport.contact,
    passport.claimed_at,
    passport.completed_count,
    stationCount,
    passport.completed_stations,
  ]);
  const body = [header, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n");

  return {
    body,
    filename: `${event.slug}-pasaportes.csv`,
  };
}

async function getPassportStateByPassportId(db, passportId) {
  const passport = await db
    .prepare(
      `
        SELECT
          passports.*,
          passport_events.slug AS event_slug,
          passport_events.title AS event_title,
          passport_events.city AS event_city,
          passport_events.event_date,
          passport_events.passport_name
        FROM passports
        INNER JOIN passport_events ON passport_events.id = passports.event_id
        WHERE passports.id = ?
        LIMIT 1
      `,
    )
    .bind(passportId)
    .first();

  if (!passport) {
    throwHttpError("passport_not_found", "Pasaporte no encontrado", 404);
  }

  const { results: stations = [] } = await db
    .prepare(
      `
        SELECT *
        FROM passport_stations
        WHERE event_id = ?
        ORDER BY station_order ASC
      `,
    )
    .bind(passport.event_id)
    .all();

  const { results: scans = [] } = await db
    .prepare(
      `
        SELECT station_id, scanned_at
        FROM station_scans
        WHERE passport_id = ?
      `,
    )
    .bind(passport.id)
    .all();

  const scannedByStationId = new Map(scans.map((scan) => [String(scan.station_id), scan.scanned_at]));
  const serializedStations = stations.map((station) => ({
    ...serializeStation(station),
    completed: scannedByStationId.has(String(station.id)),
    scannedAt: scannedByStationId.get(String(station.id)) || null,
  }));
  const completedCount = serializedStations.filter((station) => station.completed).length;

  return {
    event: {
      slug: passport.event_slug,
      title: passport.event_title,
      city: passport.event_city,
      date: passport.event_date,
      passportName: passport.passport_name,
    },
    passport: {
      id: passport.id,
      code: passport.code,
      status: passport.status,
      participantName: passport.participant_name,
      academy: passport.academy,
      category: passport.category,
      contact: passport.contact,
      claimedAt: passport.claimed_at,
    },
    stations: serializedStations,
    progress: {
      completed: completedCount,
      total: serializedStations.length,
      isComplete: completedCount === serializedStations.length && serializedStations.length > 0,
    },
  };
}

async function getPassportEventBySlug(db, eventSlug) {
  const event = await db
    .prepare("SELECT * FROM passport_events WHERE slug = ? LIMIT 1")
    .bind(eventSlug)
    .first();

  if (!event) {
    throwHttpError("passport_event_not_found", "Evento de pasaporte no encontrado", 404);
  }

  return event;
}

async function getPassportStationCount(db, eventId) {
  const row = await db
    .prepare("SELECT COUNT(*) AS total FROM passport_stations WHERE event_id = ?")
    .bind(eventId)
    .first();

  return toNumber(row?.total);
}

function serializeStation(station) {
  return {
    id: station.id,
    slug: station.slug,
    order: station.station_order,
    title: station.title,
    shortTitle: station.short_title,
    description: station.description,
    stampLabel: station.stamp_label,
    highlights: parseJsonArray(station.highlights),
  };
}

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function requirePassportAdmin(request, env) {
  const configuredToken = env.PASSPORT_ADMIN_TOKEN;
  const host = new URL(request.url).host;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (!configuredToken) {
    if (isLocal) {
      return;
    }

    throwHttpError("passport_admin_not_configured", "Configura PASSPORT_ADMIN_TOKEN para habilitar el admin", 503);
  }

  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.replace(/^Bearer\s+/i, "").trim();
  const queryToken = new URL(request.url).searchParams.get("adminToken") || "";

  if (bearerToken !== configuredToken && queryToken !== configuredToken) {
    throwHttpError("passport_admin_unauthorized", "Token admin inválido", 401);
  }
}

function toNumber(value) {
  return Number(value || 0);
}

function toCsvCell(value) {
  const text = value == null ? "" : String(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function sendJson(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function sendHttpError(error) {
  return sendJson(
    {
      error: {
        code: error.code || "internal_error",
        message: error.message || "Unexpected error",
      },
    },
    error.statusCode || 500,
  );
}

function assertMethod(request, allowed) {
  if (allowed.includes(request.method)) {
    return;
  }

  throwHttpError("method_not_allowed", `Method ${request.method} not allowed`, 405);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throwHttpError("invalid_json", "Request body must be valid JSON", 400);
  }
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throwHttpError("validation_error", `${fieldName} is required`, 400);
  }

  return value.trim();
}

function readCookie(request, name) {
  const rawCookie = request.headers.get("cookie") || "";
  const prefix = `${name}=`;
  const match = rawCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

function buildSessionCookie(request, token) {
  const host = new URL(request.url).host;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const secure = isLocal ? "" : "; Secure";
  return `${passportSessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${secure}`;
}

function createSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function hashToken(token) {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function throwHttpError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}
