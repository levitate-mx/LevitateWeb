const passportSessionCookieName = "levitate_passport_session";
const registrationSessionCookieName = "levitate_registration_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const registrationVenues = new Set(["cdmx", "puebla", "edomex"]);
const registrationDivisions = new Set(["baby", "mini", "junior", "teen", "adulto"]);
const registrationShirtSizes = new Set(["6", "8", "10", "12", "xs", "s", "m", "l"]);
const registrationGenres = new Set(["aereo", "motion", "fusion"]);
const registrationSubgenres = new Set(["tela", "aro", "trapecio", "contemporaneo"]);
const registrationCategories = new Set(["solo", "duo", "trio", "grupo"]);
const registrationLevels = new Set(["nudo", "principiante", "intermedio", "avanzado"]);

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

    if (url.pathname === "/api/registration/auth/register") {
      return handleRegistrationRegister(request, env);
    }

    if (url.pathname === "/api/registration/auth/login") {
      return handleRegistrationLogin(request, env);
    }

    if (url.pathname === "/api/registration/auth/logout") {
      return handleRegistrationLogout(request, env);
    }

    if (url.pathname === "/api/registration/me") {
      return handleRegistrationMe(request, env);
    }

    if (url.pathname === "/api/registration/bootstrap") {
      return handleRegistrationBootstrap(request, env);
    }

    if (url.pathname === "/api/registration/participants") {
      return handleRegistrationParticipants(request, env);
    }

    if (url.pathname === "/api/registration/choreographers") {
      return handleRegistrationChoreographers(request, env);
    }

    if (url.pathname === "/api/registration/dances") {
      return handleRegistrationDances(request, env);
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

async function handleRegistrationRegister(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const body = await readJsonBody(request);
    const name = requireString(body.name, "name");
    const username = normalizeUsername(requireString(body.username, "username"));
    const email = normalizeEmail(requireString(body.email, "email"));
    const password = requireString(body.password, "password");
    const academyName = requireString(body.academy, "academy");
    const venue = requireRegistrationChoice(body.venue, "venue", registrationVenues);
    const phone = optionalString(body.phone);

    if (password.length < 8) {
      throwHttpError("weak_password", "La contraseña debe tener al menos 8 caracteres", 400);
    }

    const db = getDb(env);
    const existingUser = await db
      .prepare(
        `
          SELECT id
          FROM registration_users
          WHERE username = ? OR email = ?
          LIMIT 1
        `,
      )
      .bind(username, email)
      .first();

    if (existingUser) {
      throwHttpError("registration_user_exists", "Ese usuario o correo ya está registrado", 409);
    }

    const academyId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await db
      .prepare(
        `
          INSERT INTO registration_academies (
            id,
            name,
            venue,
            contact_name,
            email,
            phone
          )
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (name, venue) DO UPDATE SET
            contact_name = excluded.contact_name,
            email = excluded.email,
            phone = excluded.phone,
            updated_at = datetime('now')
        `,
      )
      .bind(academyId, academyName, venue, name, email, phone || null)
      .run();

    const academy = await db
      .prepare(
        `
          SELECT *
          FROM registration_academies
          WHERE name = ? AND venue = ?
          LIMIT 1
        `,
      )
      .bind(academyName, venue)
      .first();

    await db
      .prepare(
        `
          INSERT INTO registration_users (
            id,
            academy_id,
            name,
            username,
            email,
            password_hash
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(userId, academy.id, name, username, email, passwordHash)
      .run();

    const sessionToken = await createRegistrationSession(db, userId, request);
    const state = await getRegistrationStateByUserId(db, userId);

    return sendJson(state, 201, {
      "set-cookie": buildRegistrationSessionCookie(request, sessionToken),
    });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationLogin(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const body = await readJsonBody(request);
    const username = normalizeUsername(requireString(body.username, "username"));
    const password = requireString(body.password, "password");
    const db = getDb(env);
    const user = await db
      .prepare(
        `
          SELECT *
          FROM registration_users
          WHERE (username = ? OR email = ?)
            AND status = 'active'
          LIMIT 1
        `,
      )
      .bind(username, normalizeEmail(username))
      .first();

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throwHttpError("registration_login_invalid", "Usuario o contraseña incorrectos", 401);
    }

    const sessionToken = await createRegistrationSession(db, user.id, request);
    const state = await getRegistrationStateByUserId(db, user.id);

    return sendJson(state, 200, {
      "set-cookie": buildRegistrationSessionCookie(request, sessionToken),
    });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationLogout(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const sessionToken = readCookie(request, registrationSessionCookieName);

    if (sessionToken) {
      await getDb(env)
        .prepare("DELETE FROM registration_sessions WHERE session_token_hash = ?")
        .bind(await hashToken(sessionToken))
        .run();
    }

    return sendJson(
      { ok: true },
      200,
      {
        "set-cookie": expireRegistrationSessionCookie(request),
      },
    );
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationMe(request, env) {
  try {
    assertMethod(request, ["GET"]);
    const session = await getRegistrationStateFromRequest({ db: getDb(env), request });
    return sendJson(session);
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationBootstrap(request, env) {
  try {
    assertMethod(request, ["GET"]);

    const db = getDb(env);
    const session = await getRegistrationStateFromRequest({ db, request });
    const academyId = session.academy.id;

    return sendJson({
      ...session,
      participants: await getRegistrationParticipants(db, academyId),
      choreographers: await getRegistrationChoreographers(db, academyId),
      dances: await getRegistrationDances(db, academyId),
    });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationParticipants(request, env) {
  try {
    assertMethod(request, ["GET", "POST"]);

    const db = getDb(env);
    const session = await getRegistrationStateFromRequest({ db, request });
    const academyId = session.academy.id;

    if (request.method === "GET") {
      return sendJson({ participants: await getRegistrationParticipants(db, academyId) });
    }

    const body = await readJsonBody(request);
    const fullName = requireString(body.fullName, "fullName");
    const curp = requireString(body.curp, "curp").toUpperCase();
    const birthDate = optionalString(body.birthDate);
    const age = optionalInteger(body.age, "age");
    const division = requireRegistrationChoice(body.division, "division", registrationDivisions);
    const shirtSize = requireRegistrationChoice(body.shirtSize, "shirtSize", registrationShirtSizes);

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    await db
      .prepare(
        `
          INSERT INTO registration_participants (
            id,
            academy_id,
            full_name,
            curp,
            birth_date,
            age,
            division,
            shirt_size,
            created_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(crypto.randomUUID(), academyId, fullName, curp, birthDate || null, age, division, shirtSize, session.user.id)
      .run();

    const participant = await db
      .prepare(
        `
          SELECT *
          FROM registration_participants
          WHERE academy_id = ? AND curp = ?
          LIMIT 1
        `,
      )
      .bind(academyId, curp)
      .first();

    return sendJson({ participant: serializeRegistrationParticipant(participant) }, 201);
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationChoreographers(request, env) {
  try {
    assertMethod(request, ["GET", "POST"]);

    const db = getDb(env);
    const session = await getRegistrationStateFromRequest({ db, request });
    const academyId = session.academy.id;

    if (request.method === "GET") {
      return sendJson({ choreographers: await getRegistrationChoreographers(db, academyId) });
    }

    const body = await readJsonBody(request);
    const fullName = requireString(body.fullName, "fullName");
    const email = optionalEmail(body.email);
    const phone = optionalString(body.phone);
    const choreographerId = crypto.randomUUID();

    await db
      .prepare(
        `
          INSERT INTO registration_choreographers (
            id,
            academy_id,
            full_name,
            email,
            phone,
            created_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(choreographerId, academyId, fullName, email || null, phone || null, session.user.id)
      .run();

    const choreographer = await db
      .prepare(
        `
          SELECT *
          FROM registration_choreographers
          WHERE academy_id = ? AND id = ?
          LIMIT 1
        `,
      )
      .bind(academyId, choreographerId)
      .first();

    return sendJson({ choreographer: serializeRegistrationChoreographer(choreographer) }, 201);
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationDances(request, env) {
  try {
    assertMethod(request, ["GET", "POST"]);

    const db = getDb(env);
    const session = await getRegistrationStateFromRequest({ db, request });
    const academyId = session.academy.id;

    if (request.method === "GET") {
      return sendJson({ dances: await getRegistrationDances(db, academyId) });
    }

    const body = await readJsonBody(request);
    const title = requireString(body.title, "title");
    const genre = requireRegistrationChoice(body.genre, "genre", registrationGenres);
    const subgenre = requireRegistrationChoice(body.subgenre, "subgenre", registrationSubgenres);
    const category = requireRegistrationChoice(body.category, "category", registrationCategories);
    const level = requireRegistrationChoice(body.level, "level", registrationLevels);
    const venue = requireRegistrationChoice(body.venue || session.academy.venue, "venue", registrationVenues);
    const choreographerIds = requireStringArray(body.choreographerIds, "choreographerIds");
    const participantIds = requireStringArray(body.participantIds, "participantIds");

    if (choreographerIds.length === 0) {
      throwHttpError("missing_choreographers", "Selecciona al menos un coreógrafo", 400);
    }

    if (participantIds.length === 0) {
      throwHttpError("missing_participants", "Selecciona al menos un participante", 400);
    }

    await assertRegistrationIdsBelongToAcademy(
      db,
      "registration_choreographers",
      academyId,
      choreographerIds,
      "Coreógrafo no encontrado",
    );
    await assertRegistrationIdsBelongToAcademy(
      db,
      "registration_participants",
      academyId,
      participantIds,
      "Participante no encontrado",
    );

    const danceId = crypto.randomUUID();
    const statements = [
      db
        .prepare(
          `
            INSERT INTO registration_dances (
              id,
              academy_id,
              title,
              genre,
              subgenre,
              category,
              level,
              venue,
              created_by_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(danceId, academyId, title, genre, subgenre, category, level, venue, session.user.id),
      ...choreographerIds.map((choreographerId) =>
        db
          .prepare(
            `
              INSERT INTO registration_dance_choreographers (
                dance_id,
                choreographer_id
              )
              VALUES (?, ?)
            `,
          )
          .bind(danceId, choreographerId),
      ),
      ...participantIds.map((participantId) =>
        db
          .prepare(
            `
              INSERT INTO registration_dance_participants (
                dance_id,
                participant_id
              )
              VALUES (?, ?)
            `,
          )
          .bind(danceId, participantId),
      ),
    ];

    await db.batch(statements);

    return sendJson({ dance: await getRegistrationDanceById(db, academyId, danceId) }, 201);
  } catch (error) {
    return sendRegistrationError(error);
  }
}

function getDb(env) {
  if (!env.DB) {
    throwHttpError("missing_d1_binding", "Missing D1 binding DB", 500);
  }

  return env.DB;
}

async function createRegistrationSession(db, userId, request) {
  const sessionToken = createSessionToken();
  const sessionTokenHash = await hashToken(sessionToken);
  const userAgent = request.headers.get("user-agent");

  await db
    .prepare(
      `
        INSERT INTO registration_sessions (
          id,
          user_id,
          session_token_hash,
          user_agent,
          expires_at
        )
        VALUES (?, ?, ?, ?, datetime('now', '+30 days'))
      `,
    )
    .bind(crypto.randomUUID(), userId, sessionTokenHash, userAgent)
    .run();

  return sessionToken;
}

async function getRegistrationStateFromRequest({ db, request }) {
  const sessionToken = readCookie(request, registrationSessionCookieName);

  if (!sessionToken) {
    throwHttpError("registration_session_missing", "Inicia sesión para continuar", 401);
  }

  const sessionTokenHash = await hashToken(sessionToken);
  const row = await db
    .prepare(
      `
        SELECT
          registration_users.id AS user_id,
          registration_users.name AS user_name,
          registration_users.username,
          registration_users.email AS user_email,
          registration_academies.id AS academy_id,
          registration_academies.name AS academy_name,
          registration_academies.venue,
          registration_academies.contact_name,
          registration_academies.email AS academy_email,
          registration_academies.phone
        FROM registration_sessions
        INNER JOIN registration_users ON registration_users.id = registration_sessions.user_id
        INNER JOIN registration_academies ON registration_academies.id = registration_users.academy_id
        WHERE registration_sessions.session_token_hash = ?
          AND registration_sessions.expires_at > datetime('now')
          AND registration_users.status = 'active'
        LIMIT 1
      `,
    )
    .bind(sessionTokenHash)
    .first();

  if (!row) {
    throwHttpError("registration_session_invalid", "Tu sesión expiró o no existe", 401);
  }

  await db
    .prepare(
      `
        UPDATE registration_sessions
        SET last_seen_at = datetime('now')
        WHERE session_token_hash = ?
      `,
    )
    .bind(sessionTokenHash)
    .run();

  return serializeRegistrationSession(row);
}

async function getRegistrationStateByUserId(db, userId) {
  const row = await db
    .prepare(
      `
        SELECT
          registration_users.id AS user_id,
          registration_users.name AS user_name,
          registration_users.username,
          registration_users.email AS user_email,
          registration_academies.id AS academy_id,
          registration_academies.name AS academy_name,
          registration_academies.venue,
          registration_academies.contact_name,
          registration_academies.email AS academy_email,
          registration_academies.phone
        FROM registration_users
        INNER JOIN registration_academies ON registration_academies.id = registration_users.academy_id
        WHERE registration_users.id = ?
        LIMIT 1
      `,
    )
    .bind(userId)
    .first();

  if (!row) {
    throwHttpError("registration_user_not_found", "Usuario no encontrado", 404);
  }

  return serializeRegistrationSession(row);
}

async function getRegistrationParticipants(db, academyId) {
  const { results = [] } = await db
    .prepare(
      `
        SELECT *
        FROM registration_participants
        WHERE academy_id = ?
        ORDER BY full_name ASC
      `,
    )
    .bind(academyId)
    .all();

  return results.map(serializeRegistrationParticipant);
}

async function getRegistrationChoreographers(db, academyId) {
  const { results = [] } = await db
    .prepare(
      `
        SELECT *
        FROM registration_choreographers
        WHERE academy_id = ?
        ORDER BY full_name ASC
      `,
    )
    .bind(academyId)
    .all();

  return results.map(serializeRegistrationChoreographer);
}

async function getRegistrationDances(db, academyId) {
  const { results: dances = [] } = await db
    .prepare(
      `
        SELECT *
        FROM registration_dances
        WHERE academy_id = ?
        ORDER BY created_at DESC
      `,
    )
    .bind(academyId)
    .all();

  return serializeRegistrationDances(db, academyId, dances);
}

async function getRegistrationDanceById(db, academyId, danceId) {
  const dance = await db
    .prepare(
      `
        SELECT *
        FROM registration_dances
        WHERE academy_id = ? AND id = ?
        LIMIT 1
      `,
    )
    .bind(academyId, danceId)
    .first();

  if (!dance) {
    throwHttpError("registration_dance_not_found", "Baile no encontrado", 404);
  }

  const [serializedDance] = await serializeRegistrationDances(db, academyId, [dance]);
  return serializedDance;
}

async function serializeRegistrationDances(db, academyId, dances) {
  if (dances.length === 0) {
    return [];
  }

  const danceIds = new Set(dances.map((dance) => dance.id));
  const { results: choreographers = [] } = await db
    .prepare(
      `
        SELECT
          registration_dance_choreographers.dance_id,
          registration_choreographers.id,
          registration_choreographers.full_name
        FROM registration_dance_choreographers
        INNER JOIN registration_dances
          ON registration_dances.id = registration_dance_choreographers.dance_id
        INNER JOIN registration_choreographers
          ON registration_choreographers.id = registration_dance_choreographers.choreographer_id
        WHERE registration_dances.academy_id = ?
      `,
    )
    .bind(academyId)
    .all();
  const { results: participants = [] } = await db
    .prepare(
      `
        SELECT
          registration_dance_participants.dance_id,
          registration_participants.id,
          registration_participants.full_name
        FROM registration_dance_participants
        INNER JOIN registration_dances
          ON registration_dances.id = registration_dance_participants.dance_id
        INNER JOIN registration_participants
          ON registration_participants.id = registration_dance_participants.participant_id
        WHERE registration_dances.academy_id = ?
      `,
    )
    .bind(academyId)
    .all();
  const choreographersByDance = groupRegistrationRelations(choreographers, danceIds);
  const participantsByDance = groupRegistrationRelations(participants, danceIds);

  return dances.map((dance) => ({
    id: dance.id,
    title: dance.title,
    genre: dance.genre,
    subgenre: dance.subgenre,
    category: dance.category,
    level: dance.level,
    venue: dance.venue,
    createdAt: dance.created_at,
    choreographers: choreographersByDance.get(dance.id) || [],
    participants: participantsByDance.get(dance.id) || [],
  }));
}

function groupRegistrationRelations(rows, danceIds) {
  const grouped = new Map();

  for (const row of rows) {
    if (!danceIds.has(row.dance_id)) {
      continue;
    }

    const current = grouped.get(row.dance_id) || [];
    current.push({
      id: row.id,
      fullName: row.full_name,
    });
    grouped.set(row.dance_id, current);
  }

  return grouped;
}

async function assertRegistrationIdsBelongToAcademy(db, tableName, academyId, ids, message) {
  const allowedTables = new Set(["registration_choreographers", "registration_participants"]);

  if (!allowedTables.has(tableName)) {
    throwHttpError("registration_invalid_table", "Tabla de registro inválida", 500);
  }

  const { results = [] } = await db
    .prepare(
      `
        SELECT id
        FROM ${tableName}
        WHERE academy_id = ?
      `,
    )
    .bind(academyId)
    .all();
  const existingIds = new Set(results.map((row) => row.id));
  const allExist = ids.every((id) => existingIds.has(id));

  if (!allExist) {
    throwHttpError("registration_relation_not_found", message, 404);
  }
}

function serializeRegistrationSession(row) {
  return {
    user: {
      id: row.user_id,
      name: row.user_name,
      username: row.username,
      email: row.user_email,
    },
    academy: {
      id: row.academy_id,
      name: row.academy_name,
      venue: row.venue,
      contactName: row.contact_name,
      email: row.academy_email,
      phone: row.phone,
    },
  };
}

function serializeRegistrationParticipant(participant) {
  return {
    id: participant.id,
    fullName: participant.full_name,
    curp: participant.curp,
    birthDate: participant.birth_date,
    age: participant.age,
    division: participant.division,
    shirtSize: participant.shirt_size,
    createdAt: participant.created_at,
  };
}

function serializeRegistrationChoreographer(choreographer) {
  return {
    id: choreographer.id,
    fullName: choreographer.full_name,
    email: choreographer.email,
    phone: choreographer.phone,
    createdAt: choreographer.created_at,
  };
}

function requireRegistrationChoice(value, fieldName, allowedValues) {
  const text = requireString(value, fieldName);

  if (!allowedValues.has(text)) {
    throwHttpError("validation_error", `${fieldName} is invalid`, 400);
  }

  return text;
}

function requireStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throwHttpError("validation_error", `${fieldName} must be an array`, 400);
  }

  return [...new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))];
}

function optionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalEmail(value) {
  const email = optionalString(value);
  return email ? normalizeEmail(email) : "";
}

function optionalInteger(value, fieldName) {
  if (value === "" || value == null) {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number < 0) {
    throwHttpError("validation_error", `${fieldName} must be a positive integer`, 400);
  }

  return number;
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const iterations = 100000;
  const hash = await derivePasswordHash(password, salt, iterations);

  return `pbkdf2_sha256$${iterations}$${base64Url(salt)}$${base64Url(hash)}`;
}

async function verifyPassword(password, storedHash) {
  try {
    const [algorithm, rawIterations, rawSalt, rawHash] = String(storedHash || "").split("$");

    if (algorithm !== "pbkdf2_sha256" || !rawIterations || !rawSalt || !rawHash) {
      return false;
    }

    const iterations = Number(rawIterations);

    if (!Number.isInteger(iterations) || iterations <= 0) {
      return false;
    }

    const expectedHash = base64UrlToBytes(rawHash);
    const actualHash = await derivePasswordHash(password, base64UrlToBytes(rawSalt), iterations);

    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

async function derivePasswordHash(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    key,
    256,
  );

  return new Uint8Array(bits);
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }

  return result === 0;
}

function buildRegistrationSessionCookie(request, token) {
  const host = new URL(request.url).host;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const secure = isLocal ? "" : "; Secure";
  return `${registrationSessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${secure}`;
}

function expireRegistrationSessionCookie(request) {
  const host = new URL(request.url).host;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const secure = isLocal ? "" : "; Secure";
  return `${registrationSessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

function sendRegistrationError(error) {
  if (isMissingRegistrationSchemaError(error)) {
    return sendJson(
      {
        error: {
          code: "registration_schema_missing",
          message: "Ejecuta npm run db:migrate:registration para preparar la base de registro",
        },
      },
      503,
    );
  }

  if (isUniqueConstraintError(error)) {
    return sendJson(
      {
        error: {
          code: "registration_duplicate",
          message: "Ese registro ya existe",
        },
      },
      409,
    );
  }

  return sendHttpError(error);
}

function isMissingRegistrationSchemaError(error) {
  return /no such table: registration_/i.test(String(error?.message || error));
}

function isUniqueConstraintError(error) {
  return /unique constraint failed/i.test(String(error?.message || error));
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
