const passportSessionCookieName = "levitate_passport_session";
const registrationSessionCookieName = "levitate_registration_session";
const registrationStudentSessionCookieName = "levitate_registration_student_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const registrationVenues = new Set(["cdmx", "puebla", "edomex"]);
const registrationDivisions = new Set(["baby", "mini", "junior", "teen", "adulto"]);
const registrationShirtSizes = new Set(["6", "8", "10", "12", "xs", "s", "m", "l"]);
const registrationGenres = new Set(["aereo", "motion"]);
const registrationSubgenresByGenre = {
  aereo: new Set(["aro", "tela", "trapecio", "open_aerial"]),
  motion: new Set(["acrojazz", "ballet", "belly_dance", "contemporaneo", "folklore", "jazz", "lirico", "open_motion", "urbanos"]),
};
const registrationCategories = new Set(["solo", "duo", "trio", "grupo"]);
const registrationLevels = new Set(["nudo", "principiante", "intermedio", "avanzado", "elite"]);
const registrationInscriptionOrderStatuses = new Set(["pending_payment", "payment_reported", "paid", "rejected"]);
const registrationPaymentProofContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxRegistrationPaymentProofBytes = 1800000;
const registrationInscriptionPresaleEndsAt = Date.parse("2026-10-13T06:00:00.000Z");
const registrationInscriptionPrices = {
  normal: {
    duo: 1400,
    grupo: 1000,
    solo: 1750,
    trio: 1200,
  },
  presale: {
    duo: 1300,
    grupo: 800,
    solo: 1500,
    trio: 950,
  },
};

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

    if (url.pathname === "/api/registration/student/register") {
      return handleRegistrationStudentRegister(request, env);
    }

    if (url.pathname === "/api/registration/student/login") {
      return handleRegistrationStudentLogin(request, env);
    }

    if (url.pathname === "/api/registration/student/logout") {
      return handleRegistrationStudentLogout(request, env);
    }

    if (url.pathname === "/api/registration/student/me") {
      return handleRegistrationStudentMe(request, env);
    }

    if (url.pathname === "/api/registration/inscription/lookup") {
      return handleRegistrationInscriptionLookup(request, env);
    }

    if (url.pathname === "/api/registration/inscription/order") {
      return handleRegistrationInscriptionOrder(request, env);
    }

    if (url.pathname === "/api/registration/inscription/order/proof") {
      return handleRegistrationInscriptionOrderProof(request, env);
    }

    if (url.pathname === "/api/registration/inscription/orders") {
      return handleRegistrationInscriptionOrders(request, env);
    }

    if (url.pathname === "/api/registration/inscription/order/status") {
      return handleRegistrationInscriptionOrderStatus(request, env);
    }

    if (url.pathname === "/api/registration/admin/inscription-orders") {
      return handleRegistrationAdminInscriptionOrders(request, env);
    }

    if (url.pathname === "/api/registration/admin/inscription-order/status") {
      return handleRegistrationAdminInscriptionOrderStatus(request, env);
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
    const confirmationEmail = await sendRegistrationConfirmationEmail({
      env,
      request,
      session: state,
    });

    return sendJson({ ...state, confirmationEmail }, 201, {
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

async function handleRegistrationStudentRegister(request, env) {
  return handleRegistrationStudentAccess(request, env, 201);
}

async function handleRegistrationStudentLogin(request, env) {
  return handleRegistrationStudentAccess(request, env, 200);
}

async function handleRegistrationStudentAccess(request, env, status = 200) {
  try {
    assertMethod(request, ["POST"]);

    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp ?? body.identifier, "curp"));

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    const db = getDb(env);
    const user = await ensureRegistrationStudentProfile(db, curp);
    const sessionToken = await createRegistrationStudentSession(db, user.id, request);
    const state = await getRegistrationStudentState(db, user);

    return sendJson(state, status, {
      "set-cookie": buildRegistrationStudentSessionCookie(request, sessionToken),
    });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationStudentLogout(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const sessionToken = readCookie(request, registrationStudentSessionCookieName);

    if (sessionToken) {
      await getDb(env)
        .prepare("DELETE FROM registration_student_sessions WHERE session_token_hash = ?")
        .bind(await hashToken(sessionToken))
        .run();
    }

    return sendJson(
      { ok: true },
      200,
      {
        "set-cookie": expireRegistrationStudentSessionCookie(request),
      },
    );
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationStudentMe(request, env) {
  try {
    assertMethod(request, ["GET"]);
    const session = await getRegistrationStudentStateFromRequest({ db: getDb(env), request });
    return sendJson(session);
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
      inscriptionOrders: await getRegistrationInscriptionOrders(db, academyId),
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
    const curp = normalizeCurp(requireString(body.curp, "curp"));
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

async function handleRegistrationInscriptionLookup(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp, "curp"));

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    const lookup = await getRegistrationInscriptionLookup(getDb(env), curp);
    return sendJson(serializePublicRegistrationInscriptionLookup(lookup));
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationInscriptionOrder(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp, "curp"));

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    const lookup = await createOrUpdateRegistrationInscriptionOrder(getDb(env), curp);
    return sendJson(
      {
        order: lookup.order ? serializePublicRegistrationInscriptionOrder(lookup.order) : null,
        lookup: serializePublicRegistrationInscriptionLookup(lookup),
      },
      201,
    );
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationInscriptionOrderProof(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const db = getDb(env);
    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp, "curp"));
    const orderId = requireString(body.orderId, "orderId");

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    const order = await getRegistrationInscriptionOrderRecordByIdAndCurp(db, orderId, curp);
    const proof = getRegistrationPaymentProofInput(body);

    await db
      .prepare(
        `
          INSERT INTO registration_inscription_payment_proofs (
            id,
            order_id,
            file_name,
            content_type,
            file_size,
            data_url
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(crypto.randomUUID(), order.id, proof.fileName, proof.contentType, proof.fileSize, proof.dataUrl)
      .run();

    await db
      .prepare(
        `
          UPDATE registration_inscription_orders
          SET status = CASE
              WHEN status = 'paid' THEN status
              ELSE 'payment_reported'
            END,
            updated_at = datetime('now')
          WHERE id = ?
        `,
      )
      .bind(order.id)
      .run();

    const updatedOrder = await getRegistrationInscriptionOrderRecordByIdAndCurp(db, order.id, curp);
    const serializedOrder = await serializeRegistrationInscriptionOrderWithProof(db, updatedOrder);

    return sendJson({ order: serializePublicRegistrationInscriptionOrder(serializedOrder) }, 201);
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationInscriptionOrders(request, env) {
  try {
    assertMethod(request, ["GET"]);

    const db = getDb(env);
    const session = await getRegistrationStateFromRequest({ db, request });
    const orders = await getRegistrationInscriptionOrders(db, session.academy.id);

    return sendJson({ orders });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationInscriptionOrderStatus(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const db = getDb(env);
    const session = await getRegistrationStateFromRequest({ db, request });
    const body = await readJsonBody(request);
    const orderId = requireString(body.id, "id");
    const status = requireRegistrationChoice(body.status, "status", registrationInscriptionOrderStatuses);
    const paidAmount = optionalInteger(body.paidAmount, "paidAmount");
    const notes = optionalString(body.notes);

    await updateRegistrationInscriptionOrderStatus(db, {
      academyId: session.academy.id,
      notes,
      orderId,
      paidAmount,
      status,
    });

    const order = await getRegistrationInscriptionOrderById(db, orderId, session.academy.id);
    return sendJson({ order });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationAdminInscriptionOrders(request, env) {
  try {
    assertMethod(request, ["GET"]);
    requireRegistrationAdmin(request, env);

    const orders = await getAllRegistrationInscriptionOrders(getDb(env));

    return sendJson({
      orders,
      totals: getRegistrationInscriptionOrderTotals(orders),
    });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationAdminInscriptionOrderStatus(request, env) {
  try {
    assertMethod(request, ["POST"]);
    requireRegistrationAdmin(request, env);

    const db = getDb(env);
    const body = await readJsonBody(request);
    const orderId = requireString(body.id, "id");
    const status = requireRegistrationChoice(body.status, "status", registrationInscriptionOrderStatuses);
    const paidAmount = optionalInteger(body.paidAmount, "paidAmount");
    const notes = optionalString(body.notes);

    await updateRegistrationInscriptionOrderStatus(db, {
      notes,
      orderId,
      paidAmount,
      status,
    });

    const order = await getRegistrationInscriptionOrderRecordById(db, orderId);
    return sendJson({ order: await serializeRegistrationInscriptionOrderWithProof(db, order) });
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
    const subgenre = requireRegistrationSubgenre(genre, body.subgenre);
    const category = requireRegistrationChoice(body.category, "category", registrationCategories);
    const level = requireRegistrationLevel(genre, body.level);
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

async function sendRegistrationConfirmationEmail({ env, request, session }) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.REGISTRATION_EMAIL_FROM;

  if (!apiKey || !from) {
    return { sent: false, reason: "email_not_configured" };
  }

  const registrationUrl = `${getPublicSiteUrl(request, env)}/registro`;
  const venueLabel = getRegistrationVenueLabel(session.academy.venue);
  const subject = "Registro confirmado | Levitate MX";
  const html = buildRegistrationConfirmationHtml({
    name: session.user.name,
    academy: session.academy.name,
    venue: venueLabel,
    registrationUrl,
  });
  const text = [
    `Hola ${session.user.name},`,
    "",
    "Tu usuario del panel de registro Levitate MX ya quedó creado.",
    `Academia: ${session.academy.name}`,
    `Sede: ${venueLabel}`,
    "",
    `Puedes entrar al panel aquí: ${registrationUrl}`,
    "",
    "Gracias por registrarte.",
    "Levitate MX",
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": `registration-${session.user.id}`,
        "user-agent": "levitate-registration-worker/1.0",
      },
      body: JSON.stringify({
        from,
        to: [session.user.email],
        subject,
        html,
        text,
        ...(env.REGISTRATION_EMAIL_REPLY_TO ? { reply_to: env.REGISTRATION_EMAIL_REPLY_TO } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("Registration confirmation email failed", {
        status: response.status,
        detail,
      });
      return { sent: false, reason: "provider_error" };
    }

    const payload = await response.json().catch(() => ({}));
    return { sent: true, id: payload.id || null };
  } catch (error) {
    console.warn("Registration confirmation email failed", {
      message: error?.message || String(error),
    });
    return { sent: false, reason: "network_error" };
  }
}

function buildRegistrationConfirmationHtml({ name, academy, venue, registrationUrl }) {
  const safeName = escapeHtml(name);
  const safeAcademy = escapeHtml(academy);
  const safeVenue = escapeHtml(venue);
  const safeRegistrationUrl = escapeHtml(registrationUrl);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Registro confirmado | Levitate MX</title>
  </head>
  <body style="margin:0;background:#050505;color:#111015;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050505;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffaf4;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#111015;padding:28px 30px;color:#fffaf4;">
                <p style="margin:0 0 10px;color:#e74697;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">Levitate MX</p>
                <h1 style="margin:0;font-size:34px;line-height:1.05;font-weight:700;">Registro confirmado</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;color:#111015;">
                <p style="margin:0 0 16px;font-size:17px;line-height:1.5;">Hola ${safeName},</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">Tu usuario del panel de registro Levitate MX ya quedó creado.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid rgba(17,16,21,.12);border-radius:8px;">
                  <tr>
                    <td style="padding:14px 16px;border-bottom:1px solid rgba(17,16,21,.1);font-size:14px;color:rgba(17,16,21,.64);">Academia</td>
                    <td style="padding:14px 16px;border-bottom:1px solid rgba(17,16,21,.1);font-size:14px;font-weight:700;text-align:right;">${safeAcademy}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;font-size:14px;color:rgba(17,16,21,.64);">Sede</td>
                    <td style="padding:14px 16px;font-size:14px;font-weight:700;text-align:right;">${safeVenue}</td>
                  </tr>
                </table>
                <p style="margin:0 0 26px;font-size:16px;line-height:1.55;">Desde el panel puedes registrar participantes, coreógrafos y bailes.</p>
                <p style="margin:0;">
                  <a href="${safeRegistrationUrl}" style="display:inline-block;background:#e74697;color:#ffffff;padding:14px 18px;border-radius:7px;font-size:13px;font-weight:700;letter-spacing:.1em;text-decoration:none;text-transform:uppercase;">Ir al panel</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function getPublicSiteUrl(request, env) {
  if (env.PUBLIC_SITE_URL) {
    return env.PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function getRegistrationVenueLabel(venue) {
  const labels = {
    cdmx: "CDMX - 29 /31 mayo 2026",
    puebla: "Puebla - 7 junio 2026",
    edomex: "Edo. Méx. - 13 /15 noviembre 2026",
  };

  return labels[venue] || venue;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

async function createRegistrationStudentSession(db, userId, request) {
  const sessionToken = createSessionToken();
  const sessionTokenHash = await hashToken(sessionToken);
  const userAgent = request.headers.get("user-agent");

  await db
    .prepare(
      `
        INSERT INTO registration_student_sessions (
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

async function ensureRegistrationStudentProfile(db, curp) {
  await db
    .prepare(
      `
        INSERT OR IGNORE INTO registration_student_users (
          id,
          username,
          curp,
          password_hash
        )
        VALUES (?, ?, ?, ?)
      `,
    )
    .bind(crypto.randomUUID(), normalizeUsername(curp), curp, "curp_only_access")
    .run();

  const user = await db
    .prepare(
      `
        SELECT id, curp
        FROM registration_student_users
        WHERE curp = ?
          AND status = 'active'
        LIMIT 1
      `,
    )
    .bind(curp)
    .first();

  if (!user) {
    throwHttpError("registration_student_user_not_found", "No se pudo abrir el portal para esa CURP", 404);
  }

  return user;
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

async function getRegistrationStudentStateFromRequest({ db, request }) {
  const sessionToken = readCookie(request, registrationStudentSessionCookieName);

  if (!sessionToken) {
    throwHttpError("registration_student_session_missing", "Inicia sesión para continuar", 401);
  }

  const sessionTokenHash = await hashToken(sessionToken);
  const user = await db
    .prepare(
      `
        SELECT
          registration_student_users.id,
          registration_student_users.curp
        FROM registration_student_sessions
        INNER JOIN registration_student_users
          ON registration_student_users.id = registration_student_sessions.user_id
        WHERE registration_student_sessions.session_token_hash = ?
          AND registration_student_sessions.expires_at > datetime('now')
          AND registration_student_users.status = 'active'
        LIMIT 1
      `,
    )
    .bind(sessionTokenHash)
    .first();

  if (!user) {
    throwHttpError("registration_student_session_invalid", "Tu sesión expiró o no existe", 401);
  }

  await db
    .prepare(
      `
        UPDATE registration_student_sessions
        SET last_seen_at = datetime('now')
        WHERE session_token_hash = ?
      `,
    )
    .bind(sessionTokenHash)
    .run();

  return getRegistrationStudentState(db, user);
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

async function getRegistrationStudentStateByUserId(db, userId) {
  const user = await db
    .prepare(
      `
        SELECT id, curp
        FROM registration_student_users
        WHERE id = ?
          AND status = 'active'
        LIMIT 1
      `,
    )
    .bind(userId)
    .first();

  if (!user) {
    throwHttpError("registration_student_user_not_found", "Portal de alumno no encontrado", 404);
  }

  return getRegistrationStudentState(db, user);
}

async function getRegistrationStudentState(db, user) {
  const curp = normalizeCurp(user.curp);
  const { results: registrationRows = [] } = await db
    .prepare(
      `
        SELECT
          registration_participants.id,
          registration_participants.academy_id,
          registration_participants.full_name,
          registration_participants.curp,
          registration_participants.division,
          registration_participants.shirt_size,
          registration_academies.name AS academy_name,
          registration_academies.venue
        FROM registration_participants
        INNER JOIN registration_academies
          ON registration_academies.id = registration_participants.academy_id
        WHERE registration_participants.curp = ?
        ORDER BY registration_participants.created_at DESC
      `,
    )
    .bind(curp)
    .all();
  const { results: danceRows = [] } = await db
    .prepare(
      `
        SELECT DISTINCT
          registration_dances.id,
          registration_dances.title,
          registration_dances.category,
          registration_dances.level,
          registration_dances.venue,
          registration_academies.name AS academy_name,
          registration_dances.created_at
        FROM registration_dance_participants
        INNER JOIN registration_participants
          ON registration_participants.id = registration_dance_participants.participant_id
        INNER JOIN registration_dances
          ON registration_dances.id = registration_dance_participants.dance_id
        INNER JOIN registration_academies
          ON registration_academies.id = registration_dances.academy_id
        WHERE registration_participants.curp = ?
        ORDER BY registration_dances.created_at DESC
      `,
    )
    .bind(curp)
    .all();
  const { results: resourceRows = [] } = await db
    .prepare(
      `
        SELECT id, resource_type, title, url, status
        FROM registration_student_resources
        WHERE curp = ?
          AND status <> 'hidden'
        ORDER BY created_at DESC
      `,
    )
    .bind(curp)
    .all();

  return {
    user: {
      id: user.id,
      curp,
    },
    registrations: registrationRows.map(serializeRegistrationStudentRecord),
    dances: danceRows.map(serializeRegistrationStudentDance),
    resources: resourceRows.map(serializeRegistrationStudentResource),
  };
}

async function getRegistrationInscriptionLookup(db, curp) {
  const { results: registrationRows = [] } = await db
    .prepare(
      `
        SELECT
          registration_participants.id,
          registration_participants.academy_id,
          registration_participants.full_name,
          registration_participants.curp,
          registration_participants.division,
          registration_participants.shirt_size,
          registration_academies.name AS academy_name,
          registration_academies.venue,
          registration_participants.created_at
        FROM registration_participants
        INNER JOIN registration_academies
          ON registration_academies.id = registration_participants.academy_id
        WHERE registration_participants.curp = ?
        ORDER BY registration_participants.created_at DESC
      `,
    )
    .bind(curp)
    .all();

  if (registrationRows.length === 0) {
    throwHttpError("registration_inscription_not_found", "No encontramos una inscripción asociada a esa CURP", 404);
  }

  const { results: danceRows = [] } = await db
    .prepare(
      `
        SELECT DISTINCT
          registration_dances.id,
          registration_dances.title,
          registration_dances.genre,
          registration_dances.subgenre,
          registration_dances.category,
          registration_dances.level,
          registration_dances.venue,
          registration_academies.name AS academy_name,
          registration_dances.created_at
        FROM registration_dance_participants
        INNER JOIN registration_participants
          ON registration_participants.id = registration_dance_participants.participant_id
        INNER JOIN registration_dances
          ON registration_dances.id = registration_dance_participants.dance_id
        INNER JOIN registration_academies
          ON registration_academies.id = registration_dances.academy_id
        WHERE registration_participants.curp = ?
        ORDER BY registration_dances.created_at DESC
      `,
    )
    .bind(curp)
    .all();
  const lines = buildRegistrationInscriptionLines(danceRows);
  const subtotal = lines.reduce((total, line) => total + line.amount, 0);
  const primaryRegistration = registrationRows[0];
  const reference = buildRegistrationInscriptionReference(curp, primaryRegistration.venue);
  const order = await getRegistrationInscriptionOrderByReference(db, reference);
  const serializedOrder = order ? await serializeRegistrationInscriptionOrderWithProof(db, order) : null;

  return {
    curp,
    academyId: primaryRegistration.academy_id,
    participantName: primaryRegistration.full_name,
    academyName: primaryRegistration.academy_name,
    venue: primaryRegistration.venue,
    reference,
    registrations: registrationRows.map(serializeRegistrationStudentRecord),
    lines,
    subtotal,
    order: serializedOrder,
  };
}

async function createOrUpdateRegistrationInscriptionOrder(db, curp) {
  const lookup = await getRegistrationInscriptionLookup(db, curp);
  const existingOrder = await getRegistrationInscriptionOrderByReference(db, lookup.reference);
  const lineItemsJson = JSON.stringify(lookup.lines);

  if (existingOrder) {
    await db
      .prepare(
        `
          UPDATE registration_inscription_orders
          SET
            curp = ?,
            participant_name = ?,
            academy_id = ?,
            academy_name = ?,
            venue = ?,
            amount = ?,
            line_items_json = ?,
            updated_at = datetime('now')
          WHERE reference = ?
        `,
      )
      .bind(
        lookup.curp,
        lookup.participantName,
        lookup.academyId || null,
        lookup.academyName,
        lookup.venue,
        lookup.subtotal,
        lineItemsJson,
        lookup.reference,
      )
      .run();
  } else {
    await db
      .prepare(
        `
          INSERT INTO registration_inscription_orders (
            id,
            curp,
            participant_name,
            academy_id,
            academy_name,
            venue,
            reference,
            amount,
            line_items_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        lookup.curp,
        lookup.participantName,
        lookup.academyId || null,
        lookup.academyName,
        lookup.venue,
        lookup.reference,
        lookup.subtotal,
        lineItemsJson,
      )
      .run();
  }

  const order = await getRegistrationInscriptionOrderByReference(db, lookup.reference);
  const serializedOrder = order ? await serializeRegistrationInscriptionOrderWithProof(db, order) : null;

  return {
    ...lookup,
    order: serializedOrder,
  };
}

async function getRegistrationInscriptionOrderByReference(db, reference) {
  try {
    return await db
      .prepare(
        `
          SELECT *
          FROM registration_inscription_orders
          WHERE reference = ?
          LIMIT 1
        `,
      )
      .bind(reference)
      .first();
  } catch (error) {
    if (isMissingRegistrationInscriptionOrdersTable(error)) {
      return null;
    }

    throw error;
  }
}

async function getRegistrationInscriptionOrderById(db, orderId, academyId) {
  const order = await db
    .prepare(
      `
        SELECT *
        FROM registration_inscription_orders
        WHERE id = ?
          AND academy_id = ?
        LIMIT 1
      `,
    )
    .bind(orderId, academyId)
    .first();

  if (!order) {
    throwHttpError("registration_inscription_order_not_found", "Orden de inscripción no encontrada", 404);
  }

  return serializeRegistrationInscriptionOrderWithProof(db, order);
}

async function getRegistrationInscriptionOrderRecordById(db, orderId) {
  const order = await db
    .prepare(
      `
        SELECT *
        FROM registration_inscription_orders
        WHERE id = ?
        LIMIT 1
      `,
    )
    .bind(orderId)
    .first();

  if (!order) {
    throwHttpError("registration_inscription_order_not_found", "Orden de inscripción no encontrada", 404);
  }

  return order;
}

async function getRegistrationInscriptionOrderRecordByIdAndCurp(db, orderId, curp) {
  const order = await db
    .prepare(
      `
        SELECT *
        FROM registration_inscription_orders
        WHERE id = ?
          AND curp = ?
        LIMIT 1
      `,
    )
    .bind(orderId, curp)
    .first();

  if (!order) {
    throwHttpError("registration_inscription_order_not_found", "Orden de inscripción no encontrada para esa CURP", 404);
  }

  return order;
}

async function updateRegistrationInscriptionOrderStatus(db, { academyId, notes, orderId, paidAmount, status }) {
  const academyClause = academyId ? "AND academy_id = ?" : "";
  const statement = db.prepare(
    `
      UPDATE registration_inscription_orders
      SET
        status = ?,
        paid_amount = COALESCE(?, paid_amount),
        notes = ?,
        paid_at = CASE
          WHEN ? = 'paid' THEN COALESCE(paid_at, datetime('now'))
          ELSE NULL
        END,
        updated_at = datetime('now')
      WHERE id = ?
        ${academyClause}
    `,
  );
  const bindings = academyId
    ? [status, paidAmount, notes || null, status, orderId, academyId]
    : [status, paidAmount, notes || null, status, orderId];

  await statement.bind(...bindings).run();
}

async function getRegistrationInscriptionOrders(db, academyId) {
  try {
    const { results = [] } = await db
      .prepare(
        `
          SELECT *
          FROM registration_inscription_orders
          WHERE academy_id = ?
          ORDER BY updated_at DESC, created_at DESC
        `,
      )
      .bind(academyId)
      .all();

    return Promise.all(results.map((order) => serializeRegistrationInscriptionOrderWithProof(db, order)));
  } catch (error) {
    if (isMissingRegistrationInscriptionOrdersTable(error)) {
      return [];
    }

    throw error;
  }
}

async function getAllRegistrationInscriptionOrders(db) {
  try {
    const { results = [] } = await db
      .prepare(
        `
          SELECT *
          FROM registration_inscription_orders
          ORDER BY updated_at DESC, created_at DESC
        `,
      )
      .all();

    return Promise.all(results.map((order) => serializeRegistrationInscriptionOrderWithProof(db, order)));
  } catch (error) {
    if (isMissingRegistrationInscriptionOrdersTable(error)) {
      return [];
    }

    throw error;
  }
}

function getRegistrationInscriptionOrderTotals(orders) {
  return orders.reduce(
    (totals, order) => {
      totals.count += 1;
      totals.amount += Number(order.amount || 0);
      totals.paidAmount += Number(order.paidAmount || 0);

      if (order.proof) {
        totals.withProof += 1;
      }

      if (order.status === "pending_payment") {
        totals.pending += 1;
      } else if (order.status === "payment_reported") {
        totals.reported += 1;
      } else if (order.status === "paid") {
        totals.paid += 1;
      } else if (order.status === "rejected") {
        totals.rejected += 1;
      }

      return totals;
    },
    {
      amount: 0,
      count: 0,
      paid: 0,
      paidAmount: 0,
      pending: 0,
      rejected: 0,
      reported: 0,
      withProof: 0,
    },
  );
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

function serializeRegistrationStudentRecord(participant) {
  return {
    id: participant.id,
    fullName: participant.full_name,
    curp: participant.curp,
    academyName: participant.academy_name,
    venue: participant.venue,
    division: participant.division,
    shirtSize: participant.shirt_size,
  };
}

function serializeRegistrationStudentDance(dance) {
  return {
    id: dance.id,
    title: dance.title,
    category: dance.category,
    level: dance.level,
    venue: dance.venue,
    academyName: dance.academy_name,
  };
}

function serializeRegistrationInscriptionLine(dance) {
  const baseAmount = getRegistrationInscriptionAmount(dance);

  return {
    id: dance.id,
    title: dance.title,
    genre: dance.genre,
    subgenre: dance.subgenre,
    category: dance.category,
    level: dance.level,
    venue: dance.venue,
    academyName: dance.academy_name,
    baseAmount,
    discountAmount: 0,
    discountRate: 0,
    pricingPosition: 0,
    amount: baseAmount,
  };
}

function buildRegistrationInscriptionLines(dances) {
  return dances
    .map(serializeRegistrationInscriptionLine)
    .sort((firstLine, secondLine) => secondLine.baseAmount - firstLine.baseAmount)
    .map((line, index) => {
      const pricingPosition = index + 1;
      const discountRate = [2, 4, 6].includes(pricingPosition) ? 0.5 : 0;
      const discountAmount = Math.round(line.baseAmount * discountRate);

      return {
        ...line,
        discountAmount,
        discountRate,
        pricingPosition,
        amount: line.baseAmount - discountAmount,
      };
    });
}

function getRegistrationInscriptionAmount(dance) {
  const prices = Date.now() < registrationInscriptionPresaleEndsAt
    ? registrationInscriptionPrices.presale
    : registrationInscriptionPrices.normal;

  if (dance.genre === "aereo") {
    return prices.solo;
  }

  return prices[dance.category] ?? prices.grupo;
}

function buildRegistrationInscriptionReference(curp, venue) {
  const venueCode = String(venue || "sede").toUpperCase();
  return `LEV-${venueCode}-${curp.slice(0, 4)}-${curp.slice(-4)}`;
}

function serializeRegistrationInscriptionOrder(order) {
  return {
    id: order.id,
    curp: order.curp,
    participantName: order.participant_name,
    academyId: order.academy_id,
    academyName: order.academy_name,
    venue: order.venue,
    reference: order.reference,
    amount: Number(order.amount || 0),
    paidAmount: Number(order.paid_amount || 0),
    status: order.status,
    paymentMethod: order.payment_method,
    lineItems: parseRegistrationOrderLineItems(order.line_items_json),
    notes: order.notes,
    paidAt: order.paid_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

async function serializeRegistrationInscriptionOrderWithProof(db, order) {
  return {
    ...serializeRegistrationInscriptionOrder(order),
    proof: await getLatestRegistrationPaymentProof(db, order.id),
  };
}

async function getLatestRegistrationPaymentProof(db, orderId) {
  try {
    const proof = await db
      .prepare(
        `
          SELECT *
          FROM registration_inscription_payment_proofs
          WHERE order_id = ?
          ORDER BY uploaded_at DESC, created_at DESC
          LIMIT 1
        `,
      )
      .bind(orderId)
      .first();

    return proof ? serializeRegistrationPaymentProof(proof) : null;
  } catch (error) {
    if (isMissingRegistrationPaymentProofsTable(error)) {
      return null;
    }

    throw error;
  }
}

function serializeRegistrationPaymentProof(proof) {
  return {
    id: proof.id,
    fileName: proof.file_name,
    contentType: proof.content_type,
    fileSize: Number(proof.file_size || 0),
    dataUrl: proof.data_url,
    status: proof.status,
    uploadedAt: proof.uploaded_at,
  };
}

function serializePublicRegistrationInscriptionLookup(lookup) {
  const { academyId, order, ...publicLookup } = lookup;

  return {
    ...publicLookup,
    order: order ? serializePublicRegistrationInscriptionOrder(order) : null,
  };
}

function serializePublicRegistrationInscriptionOrder(order) {
  const { academyId, ...publicOrder } = order;
  return publicOrder;
}

function parseRegistrationOrderLineItems(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isMissingRegistrationInscriptionOrdersTable(error) {
  return String(error?.message || error).includes("registration_inscription_orders");
}

function isMissingRegistrationPaymentProofsTable(error) {
  return String(error?.message || error).includes("registration_inscription_payment_proofs");
}

function serializeRegistrationStudentResource(resource) {
  return {
    id: resource.id,
    type: resource.resource_type,
    title: resource.title,
    url: resource.url,
    status: resource.status,
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

function requireRegistrationSubgenre(genre, value) {
  const allowedValues = registrationSubgenresByGenre[genre];

  if (!allowedValues) {
    throwHttpError("validation_error", "genre is invalid", 400);
  }

  return requireRegistrationChoice(value, "subgenre", allowedValues);
}

function requireRegistrationLevel(genre, value) {
  if (genre === "motion") {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      throwHttpError("validation_error", "Motion no tiene niveles", 400);
    }

    return null;
  }

  return requireRegistrationChoice(value, "level", registrationLevels);
}

function getRegistrationPaymentProofInput(body) {
  const fileName = requireString(body.fileName, "fileName").slice(0, 140);
  const contentType = requireRegistrationChoice(body.contentType, "contentType", registrationPaymentProofContentTypes);
  const dataUrl = requireString(body.dataUrl, "dataUrl");
  const estimatedFileSize = estimateBase64DataUrlSize(dataUrl);
  const providedFileSize = optionalInteger(body.fileSize, "fileSize");
  const fileSize = providedFileSize || estimatedFileSize;

  if (!dataUrl.startsWith(`data:${contentType};base64,`)) {
    throwHttpError("invalid_payment_proof", "El comprobante no coincide con el tipo de archivo permitido", 400);
  }

  if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > maxRegistrationPaymentProofBytes) {
    throwHttpError("payment_proof_too_large", "El comprobante debe pesar menos de 1.8 MB", 400);
  }

  if (estimatedFileSize > maxRegistrationPaymentProofBytes || dataUrl.length > maxRegistrationPaymentProofBytes * 1.45) {
    throwHttpError("payment_proof_too_large", "El comprobante debe pesar menos de 1.8 MB", 400);
  }

  return {
    contentType,
    dataUrl,
    fileName,
    fileSize,
  };
}

function estimateBase64DataUrlSize(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
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

function normalizeCurp(value) {
  return value.trim().toUpperCase();
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

function buildRegistrationStudentSessionCookie(request, token) {
  const host = new URL(request.url).host;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const secure = isLocal ? "" : "; Secure";
  return `${registrationStudentSessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${secure}`;
}

function expireRegistrationStudentSessionCookie(request) {
  const host = new URL(request.url).host;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const secure = isLocal ? "" : "; Secure";
  return `${registrationStudentSessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
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

function requireRegistrationAdmin(request, env) {
  return;
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
