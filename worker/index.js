const passportSessionCookieName = "levitate_passport_session";
const registrationSessionCookieName = "levitate_registration_session";
const registrationStudentSessionCookieName = "levitate_registration_student_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const registrationEmailVerificationMaxAgeMinutes = 60 * 24 * 2;
const registrationPasswordResetMaxAgeMinutes = 60;
const registrationVenues = new Set(["cdmx", "puebla", "edomex", "veracruz"]);
const registrationAcademyOriginTypes = new Set(["mexico", "international"]);
const registrationMexicoStates = new Set([
  "aguascalientes",
  "baja_california",
  "baja_california_sur",
  "campeche",
  "chiapas",
  "chihuahua",
  "ciudad_de_mexico",
  "coahuila",
  "colima",
  "durango",
  "estado_de_mexico",
  "guanajuato",
  "guerrero",
  "hidalgo",
  "jalisco",
  "michoacan",
  "morelos",
  "nayarit",
  "nuevo_leon",
  "oaxaca",
  "puebla",
  "queretaro",
  "quintana_roo",
  "san_luis_potosi",
  "sinaloa",
  "sonora",
  "tabasco",
  "tamaulipas",
  "tlaxcala",
  "veracruz",
  "yucatan",
  "zacatecas",
]);
const registrationDivisions = new Set(["baby", "mini", "petite", "junior", "teen", "adulto", "senior", "legacy", "releve"]);
const registrationShirtSizes = new Set(["6_8", "10_12", "xs", "s", "m", "l", "xl"]);
const registrationGenres = new Set(["aereo", "motion"]);
const registrationSubgenresByGenre = {
  aereo: new Set([
    "aro",
    "tela",
    "open_aerial",
    "open_trapecio",
    "open_cuna",
    "open_luna",
    "open_esfera",
    "open_pole_aereo",
    "open_suspension_capilar",
    "open_otro",
  ]),
  motion: new Set(["acrojazz", "ballet", "belly_dance", "contemporaneo", "folklore", "jazz", "lirico", "open_motion", "urbanos"]),
};
const registrationCategoriesByGenre = {
  aereo: new Set(["solo", "dupla_1_aparato", "duo_2_aparatos", "terna_1_aparato", "trio_3_aparatos"]),
  motion: new Set(["solo", "duo", "trio", "grupo"]),
};
const registrationDriveGenreLabels = {
  aereo: "Aerial",
  motion: "Motion",
};
const registrationDriveSubgenreLabels = {
  acrojazz: "ACROJAZZ",
  aro: "ARO",
  ballet: "BALLET",
  belly_dance: "BELLY DANCE",
  contemporaneo: "CONTEMPORANEO",
  folklore: "FOLKLORE",
  jazz: "JAZZ",
  lirico: "LIRICO",
  open_aerial: "OPEN AERIAL",
  open_cuna: "OPEN Cuna",
  open_esfera: "OPEN Esfera",
  open_luna: "OPEN Luna",
  open_motion: "OPEN MOTION",
  open_otro: "OPEN Otro",
  open_pole_aereo: "OPEN Pole Aereo",
  open_suspension_capilar: "OPEN Suspension Capilar",
  open_trapecio: "OPEN Trapecio",
  tela: "TELA",
  urbanos: "URBANOS",
};
const registrationDriveCategoryLabels = {
  duo: "Duo",
  duo_2_aparatos: "Duo 2 Aparatos",
  dupla_1_aparato: "Duplas 1 Aparato",
  grupo: "Grupo",
  solo: "Solo",
  terna_1_aparato: "Ternas 1 Aparato",
  trio: "Trio",
  trio_3_aparatos: "Trios 3 Aparatos",
};
const registrationDriveDivisionLabels = {
  baby: "Baby",
  legacy: "Legacy",
  petite: "Petite",
  releve: "Releve",
  senior: "Senior",
  junior: "Junior",
  teen: "Teen",
};
const registrationDriveLegacyDivisionMap = {
  adulto: "senior",
  mini: "petite",
};
const registrationDriveDivisionOrder = ["baby", "petite", "junior", "teen", "senior", "legacy", "releve"];
const registrationCategoryParticipantRequirements = {
  solo: 1,
  duo: 2,
  dueto: 2,
  dupla_1_aparato: 2,
  duo_2_aparatos: 2,
  trio: 3,
  terna_1_aparato: 3,
  trio_3_aparatos: 3,
};
const registrationLevels = new Set(["nudo", "principiante", "intermedio", "avanzado", "elite"]);
const registrationInscriptionOrderStatuses = new Set(["pending_payment", "payment_reported", "paid", "rejected"]);
const registrationPaymentRejectionReasons = new Set(["missing_proof", "incomplete_amount", "payment_not_found", "invalid_or_unreadable_proof"]);
const registrationPaymentProofContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const registrationUserRoles = new Set(["academy", "admin"]);
const maxRegistrationPaymentProofBytes = 1800000;
const registrationMusicUploadContentTypes = new Set(["audio/mpeg", "audio/mp3"]);
const maxRegistrationMusicUploadBytes = 12000000;
const registrationGoogleDriveScope = "https://www.googleapis.com/auth/drive.file";
const registrationGmailSendScope = "https://www.googleapis.com/auth/gmail.send";
const registrationInscriptionPresaleEndsAt = Date.parse("2026-10-13T06:00:00.000Z");
const registrationReleveTeacherMinimumDances = 3;
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
const registrationShopDiscountCode = "COLIBRI26";
const registrationShopDiscountRate = 0.1;
const registrationMediaGroupBaseParticipantCount = 4;
const registrationMediaGroupExtraParticipantPrice = 300;
const registrationShopProducts = new Map([
  [
    "ticket-block",
    {
      id: "ticket-block",
      name: "Boleto por bloque",
      category: "Boletos",
      price: 250,
      visual: "ticket",
      itemType: "ticket",
    },
  ],
  [
    "ticket-full-pass",
    {
      id: "ticket-full-pass",
      name: "Full pass",
      category: "Boletos",
      price: 600,
      visual: "ticket",
      itemType: "ticket",
    },
  ],
  [
    "ticket-day-pass",
    {
      id: "ticket-day-pass",
      name: "Day pass",
      category: "Boletos",
      price: 450,
      visual: "ticket",
      itemType: "ticket",
    },
  ],
  [
    "photo-solos",
    {
      id: "photo-solos",
      name: "All inclusive solos",
      category: "Fotografía y video",
      price: 800,
      visual: "photo",
      itemType: "media",
      mediaDanceType: "solo",
    },
  ],
  [
    "photo-duos",
    {
      id: "photo-duos",
      name: "All inclusive dúos",
      category: "Fotografía y video",
      price: 1200,
      visual: "icon",
      itemType: "media",
      mediaDanceType: "duo",
    },
  ],
  [
    "photo-trios",
    {
      id: "photo-trios",
      name: "All inclusive tríos",
      category: "Fotografía y video",
      price: 1500,
      visual: "icon",
      itemType: "media",
      mediaDanceType: "trio",
    },
  ],
  [
    "photo-groups",
    {
      id: "photo-groups",
      name: "All inclusive grupos",
      category: "Fotografía y video",
      price: 2000,
      visual: "icon",
      itemType: "media",
      mediaDanceType: "group",
    },
  ],
  [
    "block",
    {
      id: "block",
      name: "Single pass",
      category: "Boletos",
      price: 250,
      visual: "ticket",
      itemType: "ticket",
    },
  ],
  [
    "day",
    {
      id: "day",
      name: "Day pass",
      category: "Boletos",
      price: 450,
      visual: "ticket",
      itemType: "ticket",
    },
  ],
  [
    "full",
    {
      id: "full",
      name: "Full pass",
      category: "Boletos",
      price: 600,
      visual: "ticket",
      itemType: "ticket",
    },
  ],
  [
    "solo",
    {
      id: "solo",
      name: "Solos",
      category: "Fotografía y video",
      price: 800,
      visual: "photo",
      itemType: "media",
      mediaDanceType: "solo",
    },
  ],
  [
    "duo",
    {
      id: "duo",
      name: "Dúos",
      category: "Fotografía y video",
      price: 1200,
      visual: "photo",
      itemType: "media",
      mediaDanceType: "duo",
    },
  ],
  [
    "trio",
    {
      id: "trio",
      name: "Tríos",
      category: "Fotografía y video",
      price: 1500,
      visual: "photo",
      itemType: "media",
      mediaDanceType: "trio",
    },
  ],
  [
    "group",
    {
      id: "group",
      name: "Grupos",
      category: "Fotografía y video",
      price: 2000,
      visual: "photo",
      itemType: "media",
      mediaDanceType: "group",
    },
  ],
]);

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

    if (url.pathname === "/api/registration/auth/verify-email") {
      return handleRegistrationVerifyEmail(request, env);
    }

    if (url.pathname === "/api/registration/auth/forgot-password") {
      return handleRegistrationForgotPassword(request, env);
    }

    if (url.pathname === "/api/registration/auth/reset-password") {
      return handleRegistrationResetPassword(request, env);
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

    if (url.pathname === "/api/registration/inscription/payment-lookup") {
      return handleRegistrationInscriptionPaymentLookup(request, env);
    }

    if (url.pathname === "/api/registration/inscription/order") {
      return handleRegistrationInscriptionOrder(request, env);
    }

    if (url.pathname === "/api/registration/inscription/payment-order") {
      return handleRegistrationInscriptionPaymentOrder(request, env);
    }

    if (url.pathname === "/api/registration/inscription/order/proof") {
      return handleRegistrationInscriptionOrderProof(request, env);
    }

    if (url.pathname === "/api/registration/inscription/payment-proof") {
      return handleRegistrationInscriptionPaymentProof(request, env);
    }

    if (url.pathname === "/api/registration/inscription/orders") {
      return handleRegistrationInscriptionOrders(request, env);
    }

    if (url.pathname === "/api/registration/inscription/order/status") {
      return handleRegistrationInscriptionOrderStatus(request, env);
    }

    if (url.pathname === "/api/registration/shop/order") {
      return handleRegistrationShopOrder(request, env);
    }

    if (url.pathname === "/api/registration/shop/order/proof") {
      return handleRegistrationShopOrderProof(request, env);
    }

    if (url.pathname === "/api/registration/admin/inscription-orders") {
      return handleRegistrationAdminInscriptionOrders(request, env);
    }

    if (url.pathname === "/api/registration/admin/program") {
      return handleRegistrationAdminProgram(request, env);
    }

    if (url.pathname === "/api/registration/admin/participants") {
      return handleRegistrationAdminParticipants(request, env);
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

    if (url.pathname === "/api/registration/music") {
      return handleRegistrationMusic(request, env);
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
    const academyOriginType = requireRegistrationChoice(body.academyOriginType || "mexico", "academyOriginType", registrationAcademyOriginTypes);
    const academyOriginState =
      academyOriginType === "mexico" ? requireRegistrationChoice(body.academyState, "academyState", registrationMexicoStates) : null;
    const academyOriginCountry = academyOriginType === "international" ? requireString(body.academyCountry, "academyCountry").slice(0, 90) : "México";

    if (password.length < 8) {
      throwHttpError("weak_password", "La contraseña debe tener al menos 8 caracteres", 400);
    }

    const db = getDb(env);
    await ensureRegistrationAcademyOriginColumns(db);
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
            phone,
            origin_type,
            origin_state,
            origin_country
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (name, venue) DO UPDATE SET
            contact_name = excluded.contact_name,
            email = excluded.email,
            phone = excluded.phone,
            origin_type = excluded.origin_type,
            origin_state = excluded.origin_state,
            origin_country = excluded.origin_country,
            updated_at = datetime('now')
        `,
      )
      .bind(academyId, academyName, venue, name, email, phone || null, academyOriginType, academyOriginState, academyOriginCountry)
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

    const state = await getRegistrationStateByUserId(db, userId);
    const verification = await createRegistrationEmailVerification(db, userId, request, env);
    const confirmationEmail = await sendRegistrationConfirmationEmail({
      env,
      request,
      verificationUrl: verification.url,
      session: state,
    });

    return sendJson(
      {
        ok: true,
        status: "pending_email_verification",
        message: "Te enviamos un correo para confirmar tu cuenta antes de ingresar al panel.",
        user: {
          email: state.user.email,
        },
        confirmationEmail,
        ...(verification.debugUrl ? { debugVerificationUrl: verification.debugUrl } : {}),
      },
      201,
    );
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

    if (!user.email_confirmed_at) {
      throwHttpError(
        "registration_email_unconfirmed",
        "Confirma tu correo con el enlace que te enviamos para entrar.",
        403,
      );
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

async function handleRegistrationVerifyEmail(request, env) {
  try {
    assertMethod(request, ["GET", "POST"]);

    const token =
      request.method === "GET"
        ? requireString(new URL(request.url).searchParams.get("token"), "token")
        : requireString((await readJsonBody(request)).token, "token");
    const tokenHash = await hashToken(token);
    const db = getDb(env);
    const verification = await db
      .prepare(
        `
          SELECT
            registration_email_verification_tokens.id,
            registration_email_verification_tokens.user_id
          FROM registration_email_verification_tokens
          INNER JOIN registration_users
            ON registration_users.id = registration_email_verification_tokens.user_id
          WHERE registration_email_verification_tokens.verification_token_hash = ?
            AND registration_email_verification_tokens.used_at IS NULL
            AND registration_email_verification_tokens.expires_at > datetime('now')
            AND registration_users.status = 'active'
          LIMIT 1
        `,
      )
      .bind(tokenHash)
      .first();

    if (!verification) {
      throwHttpError("registration_email_verification_invalid", "El enlace de confirmación expiró o ya fue usado", 400);
    }

    await db.batch([
      db
        .prepare(
          `
            UPDATE registration_users
            SET email_confirmed_at = COALESCE(email_confirmed_at, datetime('now')),
                updated_at = datetime('now')
            WHERE id = ?
          `,
        )
        .bind(verification.user_id),
      db
        .prepare(
          `
            UPDATE registration_email_verification_tokens
            SET used_at = datetime('now')
            WHERE id = ?
          `,
        )
        .bind(verification.id),
    ]);

    const sessionToken = await createRegistrationSession(db, verification.user_id, request);
    const state = await getRegistrationStateByUserId(db, verification.user_id);

    if (request.method === "GET") {
      return new Response(null, {
        status: 303,
        headers: {
          location: buildRegistrationAuthLandingUrl(request, env, { confirmed: "1" }),
          "set-cookie": buildRegistrationSessionCookie(request, sessionToken),
        },
      });
    }

    return sendJson(state, 200, {
      "set-cookie": buildRegistrationSessionCookie(request, sessionToken),
    });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationForgotPassword(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const body = await readJsonBody(request);
    const identifier = normalizeUsername(requireString(body.identifier, "identifier"));
    const db = getDb(env);
    const user = await db
      .prepare(
        `
          SELECT *
          FROM registration_users
          WHERE (username = ? OR email = ?)
            AND status = 'active'
            AND email_confirmed_at IS NOT NULL
          LIMIT 1
        `,
      )
      .bind(identifier, normalizeEmail(identifier))
      .first();

    const message = "Si encontramos una cuenta confirmada, enviaremos un enlace para cambiar la contraseña.";

    if (!user) {
      return sendJson({ ok: true, message });
    }

    const reset = await createRegistrationPasswordReset(db, user.id, request, env);
    await sendRegistrationPasswordResetEmail({
      env,
      request,
      resetUrl: reset.url,
      user,
    });

    return sendJson({
      ok: true,
      message,
      ...(reset.debugUrl ? { debugResetUrl: reset.debugUrl } : {}),
    });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationResetPassword(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const body = await readJsonBody(request);
    const token = requireString(body.token, "token");
    const password = requireString(body.password, "password");

    if (password.length < 8) {
      throwHttpError("weak_password", "La contraseña debe tener al menos 8 caracteres", 400);
    }

    const tokenHash = await hashToken(token);
    const db = getDb(env);
    const reset = await db
      .prepare(
        `
          SELECT
            registration_password_reset_tokens.id,
            registration_password_reset_tokens.user_id
          FROM registration_password_reset_tokens
          INNER JOIN registration_users
            ON registration_users.id = registration_password_reset_tokens.user_id
          WHERE registration_password_reset_tokens.reset_token_hash = ?
            AND registration_password_reset_tokens.used_at IS NULL
            AND registration_password_reset_tokens.expires_at > datetime('now')
            AND registration_users.status = 'active'
            AND registration_users.email_confirmed_at IS NOT NULL
          LIMIT 1
        `,
      )
      .bind(tokenHash)
      .first();

    if (!reset) {
      throwHttpError("registration_password_reset_invalid", "El enlace para cambiar contraseña expiró o ya fue usado", 400);
    }

    const passwordHash = await hashPassword(password);

    await db.batch([
      db
        .prepare(
          `
            UPDATE registration_users
            SET password_hash = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `,
        )
        .bind(passwordHash, reset.user_id),
      db
        .prepare(
          `
            UPDATE registration_password_reset_tokens
            SET used_at = datetime('now')
            WHERE id = ?
          `,
        )
        .bind(reset.id),
      db.prepare("DELETE FROM registration_sessions WHERE user_id = ?").bind(reset.user_id),
    ]);

    const sessionToken = await createRegistrationSession(db, reset.user_id, request);
    const state = await getRegistrationStateByUserId(db, reset.user_id);

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
    await requireRegistrationCurpExists(db, curp);

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

    await ensureRegistrationParticipantInternationalColumn(db);
    await ensureRegistrationParticipantReleveTeacherColumn(db);

    if (request.method === "GET") {
      return sendJson({ participants: await getRegistrationParticipants(db, academyId) });
    }

    const body = await readJsonBody(request);
    const fullName = requireString(body.fullName, "fullName");
    const isInternational = session.academy.originType === "international";
    const curp = isInternational
      ? normalizeRegistrationDocument(requireString(body.curp, "documentNumber"))
      : normalizeCurp(requireString(body.curp, "curp"));
    const birthDate = requireString(body.birthDate, "birthDate");
    const age = optionalInteger(body.age, "age");
    const division = requireRegistrationChoice(body.division, "division", registrationDivisions);
    const shirtSize = requireRegistrationChoice(body.shirtSize, "shirtSize", registrationShirtSizes);
    const isReleveTeacher = optionalBoolean(body.isReleveTeacher);

    if (age == null) {
      throwHttpError("validation_error", "age is required", 400);
    }

    if (isInternational && curp.length < 3) {
      throwHttpError("invalid_document_number", "Ingresa un número de documento válido", 400);
    }

    if (!isInternational && curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    if (isReleveTeacher) {
      await assertRegistrationReleveTeacherEligibility(db, academyId);
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
            is_international,
            is_releve_teacher,
            created_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        academyId,
        fullName,
        curp,
        birthDate,
        age,
        division,
        shirtSize,
        isInternational ? 1 : 0,
        isReleveTeacher ? 1 : 0,
        session.user.id,
      )
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

    const db = getDb(env);
    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp, "curp"));

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    await requireRegistrationInscriptionLookupAccess({ db, request, curp });

    const lookup = await getRegistrationInscriptionLookup(db, curp);
    return sendJson(serializePublicRegistrationInscriptionLookup(lookup));
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationInscriptionPaymentLookup(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const db = getDb(env);
    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp, "curp"));

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    const lookup = await getRegistrationInscriptionLookup(db, curp);
    return sendJson(serializePublicRegistrationInscriptionPaymentLookup(lookup));
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationInscriptionOrder(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const db = getDb(env);
    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp, "curp"));

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    await requireRegistrationInscriptionLookupAccess({ db, request, curp });

    const buyerPhoneContact = getRegistrationBuyerPhoneContact(body);
    const lookup = await createOrUpdateRegistrationInscriptionOrder(db, curp, buyerPhoneContact);
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

async function handleRegistrationInscriptionPaymentOrder(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const db = getDb(env);
    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp, "curp"));

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    const buyerPhoneContact = getRegistrationBuyerPhoneContact(body);
    const lookup = await createOrUpdateRegistrationInscriptionOrder(db, curp, buyerPhoneContact);

    return sendJson(
      {
        order: lookup.order ? serializePublicRegistrationInscriptionPaymentOrder(lookup.order) : null,
        lookup: serializePublicRegistrationInscriptionPaymentLookup(lookup),
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

    await requireRegistrationInscriptionLookupAccess({ db, request, curp });

    const order = await getRegistrationInscriptionOrderRecordByIdAndCurp(db, orderId, curp);
    const serializedOrder = await saveRegistrationInscriptionPaymentProof(db, order, body);

    return sendJson({ order: serializePublicRegistrationInscriptionOrder(serializedOrder) }, 201);
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationShopOrder(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const db = getDb(env);
    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp, "curp"));
    const buyerContact = getRegistrationShopBuyerContact(body);
    const buyerPhoneContact = getRegistrationBuyerPhoneContact(body);

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    const order = await createRegistrationShopOrder(db, {
      buyerContact,
      buyerPhoneContact,
      curp,
      discountCode: optionalString(body.discountCode),
      items: body.items,
    });

    return sendJson({ order: await serializeRegistrationShopOrderWithProof(db, order) }, 201);
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationShopOrderProof(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const db = getDb(env);
    await ensureRegistrationPaymentProofTables(db);

    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp, "curp"));
    const orderId = requireString(body.orderId, "orderId");

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    const order = await getRegistrationShopOrderRecordByIdAndCurp(db, orderId, curp);
    const existingProof = await getLatestRegistrationShopPaymentProof(db, order.id);

    if (existingProof && order.status !== "rejected") {
      throwHttpError("payment_proof_already_uploaded", "Esta orden ya tiene un comprobante cargado.", 409);
    }

    const proof = getRegistrationPaymentProofInput(body);

    await db
      .prepare(
        `
          INSERT INTO registration_shop_payment_proofs (
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
          UPDATE registration_shop_orders
          SET status = CASE
              WHEN status = 'paid' THEN status
              ELSE 'payment_reported'
            END,
            reviewed_by = CASE
              WHEN status = 'paid' THEN reviewed_by
              ELSE NULL
            END,
            reviewed_at = CASE
              WHEN status = 'paid' THEN reviewed_at
              ELSE NULL
            END,
            rejection_reason = CASE
              WHEN status = 'paid' THEN rejection_reason
              ELSE NULL
            END,
            rejection_message = CASE
              WHEN status = 'paid' THEN rejection_message
              ELSE NULL
            END,
            updated_at = datetime('now')
          WHERE id = ?
        `,
      )
      .bind(order.id)
      .run();

    const updatedOrder = await getRegistrationShopOrderRecordByIdAndCurp(db, order.id, curp);

    return sendJson({ order: await serializeRegistrationShopOrderWithProof(db, updatedOrder) }, 201);
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationInscriptionPaymentProof(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const db = getDb(env);
    await ensureRegistrationPaymentProofTables(db);

    const body = await readJsonBody(request);
    const curp = normalizeCurp(requireString(body.curp, "curp"));
    const orderId = requireString(body.orderId, "orderId");

    if (curp.length !== 18) {
      throwHttpError("invalid_curp", "La CURP debe tener 18 caracteres", 400);
    }

    const order = await getRegistrationInscriptionOrderRecordByIdAndCurp(db, orderId, curp);
    const serializedOrder = await saveRegistrationInscriptionPaymentProof(db, order, body);

    return sendJson({ order: serializePublicRegistrationInscriptionPaymentOrder(serializedOrder) }, 201);
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function saveRegistrationInscriptionPaymentProof(db, order, body) {
  const existingProof = await getLatestRegistrationPaymentProof(db, order.id);

  if (existingProof && order.status !== "rejected") {
    throwHttpError("payment_proof_already_uploaded", "Esta orden ya tiene un comprobante cargado.", 409);
  }

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

  try {
    await db
      .prepare(
        `
          UPDATE registration_inscription_orders
          SET status = CASE
              WHEN status = 'paid' THEN status
              ELSE 'payment_reported'
            END,
            reviewed_by = CASE
              WHEN status = 'paid' THEN reviewed_by
              ELSE NULL
            END,
            reviewed_at = CASE
              WHEN status = 'paid' THEN reviewed_at
              ELSE NULL
            END,
            rejection_reason = CASE
              WHEN status = 'paid' THEN rejection_reason
              ELSE NULL
            END,
            rejection_message = CASE
              WHEN status = 'paid' THEN rejection_message
              ELSE NULL
            END,
            updated_at = datetime('now')
          WHERE id = ?
        `,
      )
      .bind(order.id)
      .run();
  } catch (error) {
    if (!isMissingRegistrationInscriptionOrderReviewColumns(error)) {
      throw error;
    }

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
  }

  const updatedOrder = await getRegistrationInscriptionOrderRecordByIdAndCurp(db, order.id, order.curp);
  return serializeRegistrationInscriptionOrderWithProof(db, updatedOrder);
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

    const db = getDb(env);
    const admin = await requireRegistrationAdmin(request, env, db);
    await ensureRegistrationPaymentProofTables(db);

    const orders =
      admin.scope === "global"
        ? (await Promise.all([getAllRegistrationInscriptionOrders(db), getAllRegistrationShopOrders(db)]))
            .flat()
            .sort(compareRegistrationOrdersByUpdatedAt)
        : await getRegistrationInscriptionOrders(db, admin.session.academy.id);

    return sendJson({
      orders,
      totals: getRegistrationInscriptionOrderTotals(orders),
    });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationAdminProgram(request, env) {
  try {
    assertMethod(request, ["GET"]);

    const db = getDb(env);
    await requireRegistrationAdmin(request, env, db);

    return sendJson({
      dances: await getAllRegistrationProgramDances(db),
    });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationAdminParticipants(request, env) {
  try {
    assertMethod(request, ["GET"]);

    const db = getDb(env);
    await requireRegistrationAdmin(request, env, db);
    await ensureRegistrationAcademyOriginColumns(db);
    await ensureRegistrationParticipantInternationalColumn(db);
    await ensureRegistrationParticipantReleveTeacherColumn(db);

    return sendJson({
      participants: await getAllRegistrationAdminParticipants(db),
    });
  } catch (error) {
    return sendRegistrationError(error);
  }
}

async function handleRegistrationAdminInscriptionOrderStatus(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const db = getDb(env);
    const admin = await requireRegistrationAdmin(request, env, db);
    const body = await readJsonBody(request);
    const orderId = requireString(body.id, "id");
    const status = requireRegistrationChoice(body.status, "status", registrationInscriptionOrderStatuses);
    const paidAmount = optionalInteger(body.paidAmount, "paidAmount");
    const notes = optionalString(body.notes);
    const orderType = optionalString(body.orderType || body.sourceOrderType) === "shop" ? "shop" : "registration";
    const rejectionReason = optionalRegistrationChoice(body.rejectionReason, registrationPaymentRejectionReasons);
    const rejectionMessage = optionalString(body.rejectionMessage);
    const reviewedBy = optionalString(body.reviewedBy) || "Admin";

    if (orderType === "shop") {
      await updateRegistrationShopOrderStatus(db, {
        notes,
        orderId,
        paidAmount,
        rejectionMessage,
        rejectionReason,
        reviewedBy,
        status,
      });

      const order = await getRegistrationShopOrderRecordById(db, orderId);

      if (order.status === "paid") {
        await ensureRegistrationEventTicketsForOrder(db, order, "shop");
      }

      return sendJson({ order: await serializeRegistrationShopOrderWithProof(db, order) });
    }

    await updateRegistrationInscriptionOrderStatus(db, {
      academyId: admin.scope === "academy" ? admin.session.academy.id : undefined,
      notes,
      orderId,
      paidAmount,
      rejectionMessage,
      rejectionReason,
      reviewedBy,
      status,
    });

    const order =
      admin.scope === "global"
        ? await getRegistrationInscriptionOrderRecordById(db, orderId)
        : await getRegistrationInscriptionOrderRecordForStatusUpdate(db, orderId, admin.session.academy.id);

    if (order.status === "paid") {
      await ensureRegistrationEventTicketsForOrder(db, order, "registration");
    }

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
    const phone = requireString(body.phone, "phone");
    const shirtSize = requireRegistrationChoice(body.shirtSize, "shirtSize", registrationShirtSizes);
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
            shirt_size,
            created_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(choreographerId, academyId, fullName, email || null, phone, shirtSize, session.user.id)
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
    const category = requireRegistrationCategory(genre, body.category);
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

    const participantRequirement = registrationCategoryParticipantRequirements[category] || null;

    if (participantRequirement && participantIds.length !== participantRequirement) {
      throwHttpError(
        "invalid_participant_count",
        `Esta categoría requiere exactamente ${participantRequirement} ${participantRequirement === 1 ? "participante" : "participantes"}.`,
        400,
      );
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

async function handleRegistrationMusic(request, env) {
  try {
    assertMethod(request, ["POST"]);

    const db = getDb(env);
    const session = await getRegistrationStateFromRequest({ db, request });
    const academyId = session.academy.id;
    const body = await readJsonBody(request);
    const danceId = requireString(body.danceId, "danceId");
    const musicUpload = getRegistrationMusicUploadInput(body);

    await ensureRegistrationMusicUploadsTable(db);
    await assertRegistrationDanceBelongsToAcademy(db, academyId, danceId);

    const dance = await getRegistrationDanceById(db, academyId, danceId);
    const storedMusicUpload = await storeRegistrationMusicUpload({ dance, env, musicUpload, session });

    await db
      .prepare(
        `
          INSERT INTO registration_music_uploads (
            id,
            academy_id,
            dance_id,
            file_name,
            content_type,
            file_size,
            data_url,
            storage_provider,
            drive_file_id,
            drive_web_view_link,
            drive_web_content_link,
            uploaded_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(dance_id) DO UPDATE SET
            file_name = excluded.file_name,
            content_type = excluded.content_type,
            file_size = excluded.file_size,
            data_url = excluded.data_url,
            storage_provider = excluded.storage_provider,
            drive_file_id = excluded.drive_file_id,
            drive_web_view_link = excluded.drive_web_view_link,
            drive_web_content_link = excluded.drive_web_content_link,
            uploaded_by_user_id = excluded.uploaded_by_user_id,
            uploaded_at = datetime('now'),
            updated_at = datetime('now')
        `,
      )
      .bind(
        crypto.randomUUID(),
        academyId,
        danceId,
        musicUpload.fileName,
        musicUpload.contentType,
        musicUpload.fileSize,
        storedMusicUpload.dataUrl,
        storedMusicUpload.storageProvider,
        storedMusicUpload.driveFileId,
        storedMusicUpload.driveWebViewLink,
        storedMusicUpload.driveWebContentLink,
        session.user.id,
      )
      .run();

    return sendJson({
      dance: await getRegistrationDanceById(db, academyId, danceId),
      musicUpload: await getRegistrationMusicUploadByDanceId(db, academyId, danceId),
    });
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

async function sendRegistrationConfirmationEmail({ env, request, session, verificationUrl }) {
  const subject = "Confirma tu correo | Levitate MX";
  const html = buildRegistrationConfirmationHtml({
    name: session.user.name,
    academy: session.academy.name,
    verificationUrl,
  });
  const text = [
    `Hola ${session.user.name},`,
    "",
    "Recibimos el registro de tu academia en el panel Levitate MX.",
    `Academia: ${session.academy.name}`,
    "",
    "Para activar el acceso, confirma tu correo con este enlace:",
    verificationUrl,
    "",
    "El enlace expira en 48 horas. Si no solicitaste este registro, ignora este mensaje.",
    "",
    "Levitate MX",
  ].join("\n");

  return sendRegistrationGmailEmail({
    env,
    html,
    kind: "registration_confirmation",
    subject,
    text,
    to: session.user.email,
  });
}

async function sendRegistrationPasswordResetEmail({ env, request, user, resetUrl }) {
  const subject = "Cambia tu contraseña | Levitate MX";
  const html = buildRegistrationPasswordResetHtml({
    name: user.name,
    resetUrl,
  });
  const text = [
    `Hola ${user.name},`,
    "",
    "Recibimos una solicitud para cambiar la contraseña de tu acceso Levitate MX.",
    "Puedes hacerlo con este enlace:",
    resetUrl,
    "",
    "El enlace expira en 60 minutos. Si no solicitaste este cambio, ignora este mensaje.",
    "",
    "Levitate MX",
  ].join("\n");

  return sendRegistrationGmailEmail({
    env,
    html,
    kind: "registration_password_reset",
    subject,
    text,
    to: user.email,
  });
}

async function sendRegistrationGmailEmail({ env, html, kind, subject, text, to }) {
  const config = getRegistrationGmailConfig(env);

  if (!config) {
    return { sent: false, reason: "email_not_configured", provider: "gmail" };
  }

  try {
    const accessToken =
      config.authType === "oauth_refresh_token"
        ? await getGoogleOAuthAccessToken({
            authFailureCode: "registration_gmail_auth_failed",
            authFailureMessage: "No pudimos autenticar Gmail.",
            config,
          })
        : await getGoogleAccessToken({
            authFailureCode: "registration_gmail_auth_failed",
            authFailureMessage: "No pudimos autenticar Gmail.",
            config,
            scope: registrationGmailSendScope,
            subject: config.senderEmail,
          });
    const gmailUser = config.authType === "oauth_refresh_token" ? "me" : encodeURIComponent(config.senderEmail);
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${gmailUser}/messages/send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "user-agent": "levitate-registration-worker/1.0",
        },
        body: JSON.stringify({
          raw: buildGmailRawMessage({
            fromEmail: config.senderEmail,
            fromName: config.senderName,
            html,
            replyTo: env.REGISTRATION_EMAIL_REPLY_TO,
            subject,
            text,
            to,
          }),
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("Registration Gmail email failed", {
        kind,
        status: response.status,
        detail,
      });
      return { sent: false, reason: "provider_error", provider: "gmail" };
    }

    const payload = await response.json().catch(() => ({}));
    return { sent: true, id: payload.id || null, provider: "gmail" };
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    console.warn("Registration Gmail email failed", {
      kind,
      message: error?.message || String(error),
    });
    return { sent: false, reason: "network_error", provider: "gmail" };
  }
}

function getRegistrationGmailConfig(env) {
  const hasAnyOauthConfig = Boolean(
    optionalString(env.GMAIL_OAUTH_CLIENT_ID) ||
      optionalString(env.GMAIL_OAUTH_CLIENT_SECRET) ||
      optionalString(env.GMAIL_OAUTH_REFRESH_TOKEN) ||
      optionalString(env.GMAIL_SENDER_EMAIL),
  );
  const oauthClientId = optionalString(env.GMAIL_OAUTH_CLIENT_ID);
  const oauthClientSecret = optionalString(env.GMAIL_OAUTH_CLIENT_SECRET);
  const oauthRefreshToken = optionalString(env.GMAIL_OAUTH_REFRESH_TOKEN);
  const oauthSenderEmail = optionalEmail(env.GMAIL_SENDER_EMAIL);
  const oauthSenderName = optionalString(env.GMAIL_SENDER_NAME) || "Levitate MX";

  if (hasAnyOauthConfig) {
    if (!oauthClientId || !oauthClientSecret || !oauthRefreshToken || !oauthSenderEmail) {
      throwHttpError(
        "registration_gmail_not_configured",
        "Faltan variables de Gmail OAuth para enviar correos.",
        500,
      );
    }

    return {
      authType: "oauth_refresh_token",
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      refreshToken: oauthRefreshToken,
      senderEmail: oauthSenderEmail,
      senderName: oauthSenderName,
    };
  }

  const hasAnyWorkspaceConfig = Boolean(
    optionalString(env.GOOGLE_WORKSPACE_CLIENT_EMAIL) ||
      optionalString(env.GOOGLE_WORKSPACE_PRIVATE_KEY) ||
      optionalString(env.GOOGLE_WORKSPACE_SENDER_EMAIL),
  );
  const clientEmail = optionalString(env.GOOGLE_WORKSPACE_CLIENT_EMAIL || env.GOOGLE_DRIVE_CLIENT_EMAIL);
  const privateKey = optionalString(env.GOOGLE_WORKSPACE_PRIVATE_KEY || env.GOOGLE_DRIVE_PRIVATE_KEY);
  const senderEmail = optionalEmail(env.GOOGLE_WORKSPACE_SENDER_EMAIL);
  const senderName = optionalString(env.GOOGLE_WORKSPACE_SENDER_NAME) || "Levitate MX";

  if (!hasAnyWorkspaceConfig) {
    return null;
  }

  if (!clientEmail || !privateKey || !senderEmail) {
    throwHttpError(
      "registration_gmail_not_configured",
      "Faltan variables de Google Workspace para enviar correos.",
      500,
    );
  }

  return {
    authType: "service_account_delegation",
    clientEmail,
    privateKey,
    senderEmail,
    senderName,
  };
}

function buildGmailRawMessage({ fromEmail, fromName, html, replyTo, subject, text, to }) {
  const boundary = `levitate_${crypto.randomUUID().replace(/-/g, "")}`;
  const headers = [
    `From: ${formatEmailAddress(fromName, fromEmail)}`,
    `To: ${formatEmailAddress("", to)}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const cleanReplyTo = optionalEmail(replyTo);

  if (cleanReplyTo) {
    headers.push(`Reply-To: ${formatEmailAddress("", cleanReplyTo)}`);
  }

  const message = [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    chunkBase64(base64EncodeUtf8(text)),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    chunkBase64(base64EncodeUtf8(html)),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return base64UrlEncodeBytes(new TextEncoder().encode(message));
}

function formatEmailAddress(name, email) {
  const cleanEmail = sanitizeEmailHeaderValue(email);
  const cleanName = sanitizeEmailHeaderValue(name);

  if (!cleanName) {
    return cleanEmail;
  }

  return `${encodeMimeHeader(cleanName)} <${cleanEmail}>`;
}

function encodeMimeHeader(value) {
  return `=?UTF-8?B?${base64EncodeUtf8(sanitizeEmailHeaderValue(value))}?=`;
}

function sanitizeEmailHeaderValue(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function base64EncodeUtf8(value) {
  return base64EncodeBytes(new TextEncoder().encode(String(value || "")));
}

function base64EncodeBytes(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function chunkBase64(value) {
  return value.match(/.{1,76}/g)?.join("\r\n") || "";
}

function buildRegistrationConfirmationHtml({ name, academy, verificationUrl }) {
  const safeName = escapeHtml(name);
  const safeAcademy = escapeHtml(academy);
  const safeVerificationUrl = escapeHtml(verificationUrl);

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
                <h1 style="margin:0;font-size:34px;line-height:1.05;font-weight:700;">Confirma tu correo</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;color:#111015;">
                <p style="margin:0 0 16px;font-size:17px;line-height:1.5;">Hola ${safeName},</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">Recibimos el registro de tu academia. Para activar el acceso al panel, confirma que este correo es correcto.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid rgba(17,16,21,.12);border-radius:8px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:14px;color:rgba(17,16,21,.64);">Academia</td>
                    <td style="padding:14px 16px;font-size:14px;font-weight:700;text-align:right;">${safeAcademy}</td>
                  </tr>
                </table>
                <p style="margin:0 0 26px;font-size:16px;line-height:1.55;">Este enlace expira en 48 horas. Si no solicitaste este registro, puedes ignorar este mensaje.</p>
                <p style="margin:0;">
                  <a href="${safeVerificationUrl}" style="display:inline-block;background:#e74697;color:#ffffff;padding:14px 18px;border-radius:7px;font-size:13px;font-weight:700;letter-spacing:.1em;text-decoration:none;text-transform:uppercase;">Confirmar correo</a>
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

function buildRegistrationPasswordResetHtml({ name, resetUrl }) {
  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cambia tu contraseña | Levitate MX</title>
  </head>
  <body style="margin:0;background:#050505;color:#111015;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050505;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffaf4;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#111015;padding:28px 30px;color:#fffaf4;">
                <p style="margin:0 0 10px;color:#e74697;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">Levitate MX</p>
                <h1 style="margin:0;font-size:34px;line-height:1.05;font-weight:700;">Cambia tu contraseña</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;color:#111015;">
                <p style="margin:0 0 16px;font-size:17px;line-height:1.5;">Hola ${safeName},</p>
                <p style="margin:0 0 26px;font-size:16px;line-height:1.55;">Recibimos una solicitud para cambiar la contraseña de tu acceso Levitate MX. El enlace expira en 60 minutos.</p>
                <p style="margin:0 0 20px;">
                  <a href="${safeResetUrl}" style="display:inline-block;background:#e74697;color:#ffffff;padding:14px 18px;border-radius:7px;font-size:13px;font-weight:700;letter-spacing:.1em;text-decoration:none;text-transform:uppercase;">Cambiar contraseña</a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.55;color:rgba(17,16,21,.58);">Si no solicitaste este cambio, ignora este mensaje.</p>
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
    edomex: "Otoño 2026 - Estado de México",
    veracruz: "Primavera 2027 - Veracruz",
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

async function createRegistrationEmailVerification(db, userId, request, env) {
  await db
    .prepare(
      `
        UPDATE registration_email_verification_tokens
        SET used_at = datetime('now')
        WHERE user_id = ?
          AND used_at IS NULL
      `,
    )
    .bind(userId)
    .run();

  const token = createSessionToken();
  const tokenHash = await hashToken(token);

  await db
    .prepare(
      `
        INSERT INTO registration_email_verification_tokens (
          id,
          user_id,
          verification_token_hash,
          expires_at
        )
        VALUES (?, ?, ?, datetime('now', ?))
      `,
    )
    .bind(crypto.randomUUID(), userId, tokenHash, `+${registrationEmailVerificationMaxAgeMinutes} minutes`)
    .run();

  const url = buildRegistrationEmailVerificationUrl(request, env, token);

  return {
    url,
    debugUrl: isLocalRequest(request) ? url : "",
  };
}

async function createRegistrationPasswordReset(db, userId, request, env) {
  await db
    .prepare(
      `
        UPDATE registration_password_reset_tokens
        SET used_at = datetime('now')
        WHERE user_id = ?
          AND used_at IS NULL
      `,
    )
    .bind(userId)
    .run();

  const token = createSessionToken();
  const tokenHash = await hashToken(token);

  await db
    .prepare(
      `
        INSERT INTO registration_password_reset_tokens (
          id,
          user_id,
          reset_token_hash,
          expires_at
        )
        VALUES (?, ?, ?, datetime('now', ?))
      `,
    )
    .bind(crypto.randomUUID(), userId, tokenHash, `+${registrationPasswordResetMaxAgeMinutes} minutes`)
    .run();

  const url = buildRegistrationAuthActionUrl(request, env, "resetToken", token);

  return {
    url,
    debugUrl: isLocalRequest(request) ? url : "",
  };
}

function buildRegistrationAuthActionUrl(request, env, tokenParamName, token) {
  const actionUrl = new URL("/registro/academias", getRegistrationActionBaseUrl(request, env));
  actionUrl.searchParams.set(tokenParamName, token);

  if (isLocalRequest(request)) {
    actionUrl.searchParams.set("preview", "site");
  }

  return actionUrl.toString();
}

function buildRegistrationEmailVerificationUrl(request, env, token) {
  const actionUrl = new URL("/api/registration/auth/verify-email", getRegistrationActionBaseUrl(request, env));
  actionUrl.searchParams.set("token", token);
  return actionUrl.toString();
}

function buildRegistrationAuthLandingUrl(request, env, params = {}) {
  const landingUrl = new URL("/registro/academias", getRegistrationActionBaseUrl(request, env));

  if (isLocalRequest(request)) {
    landingUrl.searchParams.set("preview", "site");
  }

  for (const [key, value] of Object.entries(params)) {
    landingUrl.searchParams.set(key, value);
  }

  return landingUrl.toString();
}

function getRegistrationActionBaseUrl(request, env) {
  if (isLocalRequest(request)) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }

  return getPublicSiteUrl(request, env);
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
  await ensureRegistrationUserRoleColumn(db);
  await ensureRegistrationAcademyOriginColumns(db);

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
          registration_users.role AS user_role,
          registration_users.email_confirmed_at,
          registration_academies.id AS academy_id,
          registration_academies.name AS academy_name,
          registration_academies.venue,
          registration_academies.contact_name,
          registration_academies.email AS academy_email,
          registration_academies.phone,
          registration_academies.origin_type AS academy_origin_type,
          registration_academies.origin_state AS academy_origin_state,
          registration_academies.origin_country AS academy_origin_country
        FROM registration_sessions
        INNER JOIN registration_users ON registration_users.id = registration_sessions.user_id
        INNER JOIN registration_academies ON registration_academies.id = registration_users.academy_id
        WHERE registration_sessions.session_token_hash = ?
          AND registration_sessions.expires_at > datetime('now')
          AND registration_users.status = 'active'
          AND registration_users.email_confirmed_at IS NOT NULL
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

async function getOptionalRegistrationStateFromRequest({ db, request }) {
  try {
    return await getRegistrationStateFromRequest({ db, request });
  } catch (error) {
    if (error?.statusCode === 401) {
      return null;
    }

    throw error;
  }
}

async function getOptionalRegistrationStudentStateFromRequest({ db, request }) {
  try {
    return await getRegistrationStudentStateFromRequest({ db, request });
  } catch (error) {
    if (error?.statusCode === 401) {
      return null;
    }

    throw error;
  }
}

async function requireRegistrationInscriptionLookupAccess({ db, request, curp }) {
  let hasValidSession = false;
  const academySession = await getOptionalRegistrationStateFromRequest({ db, request });

  if (academySession) {
    hasValidSession = true;

    if (await isRegistrationCurpInAcademy(db, curp, academySession.academy.id)) {
      return { scope: "academy", session: academySession };
    }
  }

  const studentSession = await getOptionalRegistrationStudentStateFromRequest({ db, request });

  if (studentSession) {
    hasValidSession = true;

    if (normalizeCurp(studentSession.user.curp) === curp) {
      return { scope: "student", session: studentSession };
    }
  }

  if (hasValidSession) {
    throwHttpError("registration_inscription_lookup_forbidden", "No tienes acceso a esa inscripción", 403);
  }

  throwHttpError("registration_inscription_lookup_unauthorized", "Inicia sesión para consultar una inscripción", 401);
}

async function isRegistrationCurpInAcademy(db, curp, academyId) {
  const participant = await db
    .prepare(
      `
        SELECT id
        FROM registration_participants
        WHERE curp = ?
          AND academy_id = ?
        LIMIT 1
      `,
    )
    .bind(curp, academyId)
    .first();

  return Boolean(participant);
}

async function requireRegistrationCurpExists(db, curp) {
  const participant = await db
    .prepare(
      `
        SELECT id
        FROM registration_participants
        WHERE curp = ?
        LIMIT 1
      `,
    )
    .bind(curp)
    .first();

  if (!participant) {
    throwHttpError("registration_student_user_not_found", "No se encontró una inscripción asociada a esa CURP", 404);
  }
}

async function getRegistrationStateByUserId(db, userId) {
  await ensureRegistrationUserRoleColumn(db);
  await ensureRegistrationAcademyOriginColumns(db);

  const row = await db
    .prepare(
      `
        SELECT
          registration_users.id AS user_id,
          registration_users.name AS user_name,
          registration_users.username,
          registration_users.email AS user_email,
          registration_users.role AS user_role,
          registration_users.email_confirmed_at,
          registration_academies.id AS academy_id,
          registration_academies.name AS academy_name,
          registration_academies.venue,
          registration_academies.contact_name,
          registration_academies.email AS academy_email,
          registration_academies.phone,
          registration_academies.origin_type AS academy_origin_type,
          registration_academies.origin_state AS academy_origin_state,
          registration_academies.origin_country AS academy_origin_country
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
          (
            SELECT COUNT(*)
            FROM registration_dance_participants AS all_dance_participants
            WHERE all_dance_participants.dance_id = registration_dances.id
          ) AS participant_count,
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

async function createOrUpdateRegistrationInscriptionOrder(db, curp, buyerPhoneContact = null) {
  await ensureRegistrationInscriptionOrderBuyerPhoneColumns(db);

  const lookup = await getRegistrationInscriptionLookup(db, curp);
  const existingOrder = await getRegistrationInscriptionOrderByReference(db, lookup.reference);
  const lineItemsJson = JSON.stringify(lookup.lines);
  const buyerPhoneCountryCode = buyerPhoneContact?.countryCode || null;
  const buyerPhoneNumber = buyerPhoneContact?.number || null;
  const buyerPhone = buyerPhoneContact?.phone || null;

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
            buyer_phone_country_code = COALESCE(?, buyer_phone_country_code),
            buyer_phone_number = COALESCE(?, buyer_phone_number),
            buyer_phone = COALESCE(?, buyer_phone),
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
        buyerPhoneCountryCode,
        buyerPhoneNumber,
        buyerPhone,
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
            payment_method,
            buyer_phone_country_code,
            buyer_phone_number,
            buyer_phone,
            line_items_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bank_transfer', ?, ?, ?, ?)
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
        buyerPhoneCountryCode,
        buyerPhoneNumber,
        buyerPhone,
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

async function createRegistrationShopOrder(db, { buyerContact, buyerPhoneContact, curp, discountCode, items }) {
  await ensureRegistrationShopOrderBuyerContactColumns(db);
  await ensureRegistrationPaymentProofTables(db);

  const participant = await getRegistrationShopParticipantByCurp(db, curp);
  const normalizedCart = normalizeRegistrationShopCart(items, discountCode);
  normalizedCart.lineItems = await validateRegistrationShopMediaLineItems(db, curp, normalizedCart.lineItems);
  Object.assign(normalizedCart, getRegistrationShopCartTotals(normalizedCart.lineItems, discountCode));
  const reusableOrder = await getReusableRegistrationShopOrderWithoutProof(db, curp);

  if (reusableOrder) {
    await db
      .prepare(
        `
          UPDATE registration_shop_orders
          SET participant_name = ?,
            academy_id = ?,
            academy_name = ?,
            venue = ?,
            amount = ?,
            paid_amount = 0,
            status = 'pending_payment',
            buyer_name = ?,
            buyer_email = ?,
            buyer_phone_country_code = ?,
            buyer_phone_number = ?,
            buyer_phone = ?,
            discount_code = ?,
            discount_amount = ?,
            line_items_json = ?,
            paid_at = NULL,
            reviewed_by = NULL,
            reviewed_at = NULL,
            rejection_reason = NULL,
            rejection_message = NULL,
            updated_at = datetime('now')
          WHERE id = ?
        `,
      )
      .bind(
        participant.full_name,
        participant.academy_id || null,
        participant.academy_name,
        participant.venue,
        normalizedCart.amount,
        buyerContact.name,
        buyerContact.email,
        buyerPhoneContact.countryCode,
        buyerPhoneContact.number,
        buyerPhoneContact.phone,
        normalizedCart.discountCode || null,
        normalizedCart.discountAmount,
        JSON.stringify(normalizedCart.lineItems),
        reusableOrder.id,
      )
      .run();

    return getRegistrationShopOrderRecordById(db, reusableOrder.id);
  }

  const reference = await createRegistrationShopReference(db, curp);
  const orderId = crypto.randomUUID();

  await db
    .prepare(
      `
        INSERT INTO registration_shop_orders (
          id,
          curp,
          participant_name,
          academy_id,
          academy_name,
          venue,
          reference,
          amount,
          payment_method,
          buyer_name,
          buyer_email,
          buyer_phone_country_code,
          buyer_phone_number,
          buyer_phone,
          discount_code,
          discount_amount,
          line_items_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bank_transfer', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      orderId,
      curp,
      participant.full_name,
      participant.academy_id || null,
      participant.academy_name,
      participant.venue,
      reference,
      normalizedCart.amount,
      buyerContact.name,
      buyerContact.email,
      buyerPhoneContact.countryCode,
      buyerPhoneContact.number,
      buyerPhoneContact.phone,
      normalizedCart.discountCode || null,
      normalizedCart.discountAmount,
      JSON.stringify(normalizedCart.lineItems),
    )
    .run();

  return getRegistrationShopOrderRecordById(db, orderId);
}

async function getRegistrationShopParticipantByCurp(db, curp) {
  const participant = await db
    .prepare(
      `
        SELECT
          registration_participants.*,
          registration_academies.name AS academy_name,
          registration_academies.venue AS venue
        FROM registration_participants
        INNER JOIN registration_academies
          ON registration_academies.id = registration_participants.academy_id
        WHERE registration_participants.curp = ?
        ORDER BY registration_participants.created_at DESC
        LIMIT 1
      `,
    )
    .bind(curp)
    .first();

  if (!participant) {
    throwHttpError("registration_participant_not_found", "No encontramos un registro para esa CURP.", 404);
  }

  return participant;
}

function normalizeRegistrationShopCart(rawItems, discountCode) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throwHttpError("shop_cart_empty", "Agrega al menos un producto para generar la orden.", 400);
  }

  const groupedItems = new Map();

  for (const rawItem of rawItems) {
    const productId = optionalString(rawItem?.productId ?? rawItem?.id);
    const product = registrationShopProducts.get(productId);

    if (!product) {
      throwHttpError("shop_product_not_found", "Uno de los productos de la tienda ya no está disponible.", 400);
    }

    const quantity = optionalInteger(rawItem?.quantity ?? rawItem?.qty ?? rawItem?.count ?? 1, "quantity") ?? 1;

    if (quantity < 1 || quantity > 100) {
      throwHttpError("shop_quantity_invalid", "La cantidad de un producto no es válida.", 400);
    }

    const optionId = optionalString(rawItem?.optionId);
    const optionLabel = optionalString(rawItem?.optionLabel);
    const danceId = optionalString(rawItem?.danceId);
    const danceTitle = optionalString(rawItem?.danceTitle);
    const groupKey = [product.id, optionId, danceId].filter(Boolean).join(":");
    const existingItem = groupedItems.get(groupKey) || {
      danceId,
      danceTitle,
      groupKey,
      optionId,
      optionLabel,
      product,
      quantity: 0,
    };

    existingItem.quantity += quantity;
    groupedItems.set(groupKey, existingItem);
  }

  const lineItems = Array.from(groupedItems.values()).map((groupedItem) => {
    const { danceId, danceTitle, groupKey, optionId, optionLabel, product, quantity } = groupedItem;
    const amount = product.price * quantity;
    const title = [product.name, optionLabel || danceTitle].filter(Boolean).join(" · ");

    return {
      id: groupKey,
      danceId: danceId || undefined,
      danceTitle: danceTitle || undefined,
      optionId: optionId || undefined,
      optionLabel: optionLabel || undefined,
      productId: product.id,
      productName: product.name,
      title,
      category: product.category,
      productCategory: product.category,
      itemType: product.itemType,
      visual: product.visual,
      quantity,
      unitPrice: product.price,
      amount,
    };
  });
  const totals = getRegistrationShopCartTotals(lineItems, discountCode);

  return {
    ...totals,
    lineItems,
  };
}

function getRegistrationShopCartTotals(lineItems, discountCode) {
  const subtotal = lineItems.reduce((total, lineItem) => total + lineItem.amount, 0);
  const mediaSubtotal = lineItems.reduce(
    (total, lineItem) => (lineItem.productCategory === "Fotografía y video" ? total + lineItem.amount : total),
    0,
  );
  const normalizedDiscountCode = optionalString(discountCode).toUpperCase();
  const appliedDiscountCode =
    normalizedDiscountCode === registrationShopDiscountCode && mediaSubtotal > 0 ? registrationShopDiscountCode : "";
  const discountAmount = appliedDiscountCode ? Math.round(mediaSubtotal * registrationShopDiscountRate) : 0;

  return {
    amount: Math.max(0, subtotal - discountAmount),
    discountAmount,
    discountCode: appliedDiscountCode,
    subtotal,
  };
}

async function validateRegistrationShopMediaLineItems(db, curp, lineItems) {
  const mediaLineItems = lineItems.filter((lineItem) => lineItem.itemType === "media");

  if (mediaLineItems.length === 0) {
    return lineItems;
  }

  const lookup = await getRegistrationInscriptionLookup(db, curp);
  const dancesById = new Map();

  lookup.lines.forEach((line, index) => {
    dancesById.set(line.id, line);
    dancesById.set(`concepto-${index + 1}`, line);
  });

  return lineItems.map((lineItem) => {
    if (lineItem.itemType !== "media") {
      return lineItem;
    }

    const product = registrationShopProducts.get(lineItem.productId);
    const expectedDanceType = product?.mediaDanceType || "";
    const danceId = optionalString(lineItem.danceId);
    const danceTitle = optionalString(lineItem.danceTitle);

    if (!danceId) {
      throwHttpError("shop_media_dance_required", "Selecciona una coreografía compatible para cada paquete de foto y video.", 400);
    }

    const dance = getRegistrationShopMediaDanceForLine(lookup.lines, dancesById, danceId, danceTitle, expectedDanceType);

    if (!dance) {
      throwHttpError("shop_media_dance_not_found", "La coreografía seleccionada no está vinculada a esa CURP.", 400);
    }

    const actualDanceType = normalizeRegistrationMediaDanceType(dance.category);

    if (!expectedDanceType || expectedDanceType !== actualDanceType) {
      throwHttpError(
        "shop_media_dance_mismatch",
        `El paquete ${lineItem.productName} solo puede asignarse a coreografías de ${getRegistrationMediaDanceTypeLabel(expectedDanceType)}.`,
        400,
      );
    }

    const participantCount = getRegistrationMediaDanceParticipantCount(dance);
    const unitPrice = getRegistrationShopMediaUnitPrice(product, participantCount);

    return {
      ...lineItem,
      amount: unitPrice * lineItem.quantity,
      id: [lineItem.productId, lineItem.optionId, dance.id].filter(Boolean).join(":"),
      danceId: dance.id,
      danceTitle: dance.title || lineItem.danceTitle,
      participantCount,
      title: [lineItem.productName, dance.title || lineItem.danceTitle].filter(Boolean).join(" · "),
      unitPrice,
    };
  });
}

function getRegistrationShopMediaDanceForLine(lines, dancesById, danceId, danceTitle, expectedDanceType) {
  const dance = dancesById.get(danceId);

  if (!danceTitle) {
    return dance;
  }

  const normalizedDanceTitle = normalizeRegistrationMediaDanceTitle(danceTitle);

  if (
    dance &&
    normalizeRegistrationMediaDanceTitle(dance.title) === normalizedDanceTitle &&
    normalizeRegistrationMediaDanceType(dance.category) === expectedDanceType
  ) {
    return dance;
  }

  return lines.find((line) => (
    normalizeRegistrationMediaDanceTitle(line.title) === normalizedDanceTitle &&
    normalizeRegistrationMediaDanceType(line.category) === expectedDanceType
  )) || null;
}

function normalizeRegistrationMediaDanceTitle(title) {
  return String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getRegistrationMediaDanceParticipantCount(dance) {
  const participantCount = Number(dance?.participantCount ?? dance?.participant_count ?? 0);
  return Number.isFinite(participantCount) && participantCount > 0 ? participantCount : 0;
}

function getRegistrationShopMediaUnitPrice(product, participantCount) {
  if (product?.mediaDanceType !== "group") {
    return product?.price || 0;
  }

  const extraParticipantCount = Math.max(0, participantCount - registrationMediaGroupBaseParticipantCount);
  return product.price + extraParticipantCount * registrationMediaGroupExtraParticipantPrice;
}

function normalizeRegistrationMediaDanceType(category) {
  const normalizedCategory = String(category || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["solo", "solos", "solista", "individual"].includes(normalizedCategory)) {
    return "solo";
  }

  if (["duo", "duos", "dueto", "duetos", "dupla", "duplas", "dupla_1_aparato", "duo_2_aparatos"].includes(normalizedCategory)) {
    return "duo";
  }

  if (["trio", "trios", "terna", "ternas", "terna_1_aparato", "trio_3_aparatos"].includes(normalizedCategory)) {
    return "trio";
  }

  if (["grupo", "grupos", "group", "groups", "grupal"].includes(normalizedCategory)) {
    return "group";
  }

  return "";
}

function getRegistrationMediaDanceTypeLabel(danceType) {
  return {
    duo: "dúo",
    group: "grupo",
    solo: "solo",
    trio: "trío",
  }[danceType] || "esa categoría";
}

async function createRegistrationShopReference(db, curp) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const reference = `LEV-SHOP-${curp.slice(0, 4)}-${randomRegistrationTicketSegment(4)}`;
    const existingOrder = await getRegistrationShopOrderByReference(db, reference);

    if (!existingOrder) {
      return reference;
    }
  }

  return `LEV-SHOP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
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

async function getRegistrationShopOrderByReference(db, reference) {
  try {
    return await db
      .prepare(
        `
          SELECT *
          FROM registration_shop_orders
          WHERE reference = ?
          LIMIT 1
        `,
      )
      .bind(reference)
      .first();
  } catch (error) {
    if (isMissingRegistrationShopOrdersTable(error)) {
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

async function getRegistrationShopOrderRecordById(db, orderId) {
  const order = await db
    .prepare(
      `
        SELECT *
        FROM registration_shop_orders
        WHERE id = ?
        LIMIT 1
      `,
    )
    .bind(orderId)
    .first();

  if (!order) {
    throwHttpError("registration_shop_order_not_found", "Orden de tienda no encontrada", 404);
  }

  return order;
}

async function getReusableRegistrationShopOrderWithoutProof(db, curp) {
  try {
    return await db
      .prepare(
        `
          SELECT registration_shop_orders.*
          FROM registration_shop_orders
          WHERE registration_shop_orders.curp = ?
            AND registration_shop_orders.status IN ('pending_payment', 'rejected')
            AND NOT EXISTS (
              SELECT 1
              FROM registration_shop_payment_proofs
              WHERE registration_shop_payment_proofs.order_id = registration_shop_orders.id
            )
          ORDER BY registration_shop_orders.updated_at DESC, registration_shop_orders.created_at DESC
          LIMIT 1
        `,
      )
      .bind(curp)
      .first();
  } catch (error) {
    if (isMissingRegistrationShopPaymentProofsTable(error)) {
      return null;
    }

    throw error;
  }
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

async function getRegistrationShopOrderRecordByIdAndCurp(db, orderId, curp) {
  const order = await db
    .prepare(
      `
        SELECT *
        FROM registration_shop_orders
        WHERE id = ?
          AND curp = ?
        LIMIT 1
      `,
    )
    .bind(orderId, curp)
    .first();

  if (!order) {
    throwHttpError("registration_shop_order_not_found", "Orden de tienda no encontrada para esa CURP", 404);
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

async function updateRegistrationInscriptionOrderStatus(db, {
  academyId,
  notes,
  orderId,
  paidAmount,
  rejectionMessage,
  rejectionReason,
  reviewedBy,
  status,
}) {
  const existingOrder = await getRegistrationInscriptionOrderRecordForStatusUpdate(db, orderId, academyId);
  const nextPaidAmount = paidAmount == null ? Number(existingOrder.paid_amount || 0) : paidAmount;
  const hasProof = Boolean(await getLatestRegistrationPaymentProof(db, orderId));
  const nextReviewedBy = reviewedBy || "Admin";
  const nextRejectionReason = status === "rejected" ? rejectionReason : "";
  const nextRejectionMessage = status === "rejected" ? optionalString(rejectionMessage) : "";

  if (status === "paid") {
    if (!hasProof) {
      throwHttpError("payment_proof_required", "No se puede aprobar una orden sin comprobante.", 400);
    }

    if (nextPaidAmount < Number(existingOrder.amount || 0)) {
      throwHttpError("payment_amount_incomplete", "No se puede aprobar un pago menor al monto esperado.", 400);
    }
  }

  if (status === "rejected") {
    if (!nextRejectionReason) {
      throwHttpError("rejection_reason_required", "Selecciona el motivo del rechazo.", 400);
    }

    if (!nextRejectionMessage) {
      throwHttpError("rejection_message_required", "Escribe qué debe corregir la familia para aprobar el pago.", 400);
    }
  }

  const academyClause = academyId ? "AND academy_id = ?" : "";
  const bindings = [
    status,
    nextPaidAmount,
    notes || null,
    status,
    status,
    status === "paid" || status === "rejected" ? nextReviewedBy : null,
    status,
    status === "rejected" ? nextRejectionReason : null,
    status === "rejected" ? nextRejectionMessage : null,
    orderId,
  ];

  if (academyId) {
    bindings.push(academyId);
  }

  await db
    .prepare(
      `
        UPDATE registration_inscription_orders
        SET
          status = ?,
          paid_amount = ?,
          notes = ?,
          paid_at = CASE
            WHEN ? = 'paid' THEN COALESCE(paid_at, datetime('now'))
            ELSE NULL
          END,
          reviewed_at = CASE
            WHEN ? IN ('paid', 'rejected') THEN datetime('now')
            ELSE NULL
          END,
          reviewed_by = ?,
          rejection_reason = CASE
            WHEN ? = 'rejected' THEN ?
            ELSE NULL
          END,
          rejection_message = ?,
          updated_at = datetime('now')
        WHERE id = ?
          ${academyClause}
      `,
    )
    .bind(...bindings)
    .run();
}

async function updateRegistrationShopOrderStatus(db, {
  notes,
  orderId,
  paidAmount,
  rejectionMessage,
  rejectionReason,
  reviewedBy,
  status,
}) {
  const existingOrder = await getRegistrationShopOrderRecordForStatusUpdate(db, orderId);
  const nextPaidAmount = paidAmount == null ? Number(existingOrder.paid_amount || 0) : paidAmount;
  const hasProof = Boolean(await getLatestRegistrationShopPaymentProof(db, orderId));
  const nextReviewedBy = reviewedBy || "Admin";
  const nextRejectionReason = status === "rejected" ? rejectionReason : "";
  const nextRejectionMessage = status === "rejected" ? optionalString(rejectionMessage) : "";

  if (status === "paid") {
    if (!hasProof) {
      throwHttpError("payment_proof_required", "No se puede aprobar una orden sin comprobante.", 400);
    }

    if (nextPaidAmount < Number(existingOrder.amount || 0)) {
      throwHttpError("payment_amount_incomplete", "No se puede aprobar un pago menor al monto esperado.", 400);
    }
  }

  if (status === "rejected") {
    if (!nextRejectionReason) {
      throwHttpError("rejection_reason_required", "Selecciona el motivo del rechazo.", 400);
    }

    if (!nextRejectionMessage) {
      throwHttpError("rejection_message_required", "Escribe qué debe corregir la familia para aprobar el pago.", 400);
    }
  }

  await db
    .prepare(
      `
        UPDATE registration_shop_orders
        SET
          status = ?,
          paid_amount = ?,
          notes = ?,
          paid_at = CASE
            WHEN ? = 'paid' THEN COALESCE(paid_at, datetime('now'))
            ELSE NULL
          END,
          reviewed_at = CASE
            WHEN ? IN ('paid', 'rejected') THEN datetime('now')
            ELSE NULL
          END,
          reviewed_by = ?,
          rejection_reason = CASE
            WHEN ? = 'rejected' THEN ?
            ELSE NULL
          END,
          rejection_message = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `,
    )
    .bind(
      status,
      nextPaidAmount,
      notes || null,
      status,
      status,
      status === "paid" || status === "rejected" ? nextReviewedBy : null,
      status,
      status === "rejected" ? nextRejectionReason : null,
      status === "rejected" ? nextRejectionMessage : null,
      orderId,
    )
    .run();
}

async function getRegistrationInscriptionOrderRecordForStatusUpdate(db, orderId, academyId) {
  const academyClause = academyId ? "AND academy_id = ?" : "";
  const bindings = academyId ? [orderId, academyId] : [orderId];
  const order = await db
    .prepare(
      `
        SELECT *
        FROM registration_inscription_orders
        WHERE id = ?
          ${academyClause}
        LIMIT 1
      `,
    )
    .bind(...bindings)
    .first();

  if (!order) {
    throwHttpError("registration_inscription_order_not_found", "Orden de inscripción no encontrada", 404);
  }

  return order;
}

async function getRegistrationShopOrderRecordForStatusUpdate(db, orderId) {
  const order = await db
    .prepare(
      `
        SELECT *
        FROM registration_shop_orders
        WHERE id = ?
        LIMIT 1
      `,
    )
    .bind(orderId)
    .first();

  if (!order) {
    throwHttpError("registration_shop_order_not_found", "Orden de tienda no encontrada", 404);
  }

  return order;
}

async function ensureRegistrationEventTicketsForOrder(db, order, sourceOrderType = "registration") {
  const ticketSpecs = getRegistrationEventTicketSpecs(order);

  if (ticketSpecs.length === 0) {
    return [];
  }

  try {
    const existingTickets = await getRegistrationEventTicketsForSource(db, sourceOrderType, order.id);

    if (existingTickets.length >= ticketSpecs.length) {
      return existingTickets;
    }

    for (let index = existingTickets.length; index < ticketSpecs.length; index += 1) {
      const ticketSpec = ticketSpecs[index];
      const ticketCode = await createRegistrationEventTicketCode(db);

      await db
        .prepare(
          `
            INSERT INTO registration_event_tickets (
              id,
              source_order_type,
              source_order_id,
              ticket_code,
              ticket_number,
              ticket_label,
              holder_name,
              qr_payload
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          crypto.randomUUID(),
          sourceOrderType,
          order.id,
          ticketCode,
          index + 1,
          ticketSpec.label,
          order.participant_name,
          buildRegistrationTicketQrPayload(ticketCode),
        )
        .run();
    }

    return getRegistrationEventTicketsForSource(db, sourceOrderType, order.id);
  } catch (error) {
    if (isMissingRegistrationEventTicketsTable(error)) {
      return [];
    }

    throw error;
  }
}

function getRegistrationEventTicketSpecs(order) {
  return parseRegistrationOrderLineItems(order.line_items_json).flatMap((lineItem) => {
    if (!isRegistrationTicketLineItem(lineItem)) {
      return [];
    }

    const quantity = getRegistrationTicketLineQuantity(lineItem);
    const label = lineItem.title || lineItem.name || lineItem.productName || "Boleto Levitate";

    return Array.from({ length: quantity }, () => ({ label }));
  });
}

function isRegistrationTicketLineItem(lineItem) {
  const category = String(lineItem.productCategory || lineItem.category || "").toLowerCase();
  const itemType = String(lineItem.itemType || lineItem.type || "").toLowerCase();
  const visual = String(lineItem.visual || "").toLowerCase();
  const productId = String(lineItem.productId || lineItem.id || "").toLowerCase();

  return category === "boletos" || category === "tickets" || itemType === "ticket" || visual === "ticket" || productId.startsWith("ticket-");
}

function getRegistrationTicketLineQuantity(lineItem) {
  const quantity = Number(lineItem.quantity ?? lineItem.qty ?? lineItem.count ?? 1);

  if (!Number.isFinite(quantity) || quantity < 1) {
    return 1;
  }

  return Math.min(100, Math.floor(quantity));
}

async function createRegistrationEventTicketCode(db) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `LV-${randomRegistrationTicketSegment(4)}-${randomRegistrationTicketSegment(4)}`;
    const existingTicket = await getRegistrationEventTicketByCode(db, code);

    if (!existingTicket) {
      return code;
    }
  }

  return `LV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function randomRegistrationTicketSegment(size) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function getRegistrationEventTicketByCode(db, ticketCode) {
  try {
    return await db
      .prepare(
        `
          SELECT *
          FROM registration_event_tickets
          WHERE ticket_code = ?
          LIMIT 1
        `,
      )
      .bind(ticketCode)
      .first();
  } catch (error) {
    if (isMissingRegistrationEventTicketsTable(error)) {
      return null;
    }

    throw error;
  }
}

function buildRegistrationTicketQrPayload(ticketCode) {
  return `LEVITATE:TICKET:${ticketCode}`;
}

async function getRegistrationEventTicketsForSource(db, sourceOrderType, sourceOrderId) {
  try {
    const { results = [] } = await db
      .prepare(
        `
          SELECT *
          FROM registration_event_tickets
          WHERE source_order_type = ?
            AND source_order_id = ?
          ORDER BY ticket_number ASC, created_at ASC
        `,
      )
      .bind(sourceOrderType, sourceOrderId)
      .all();

    return results.map(serializeRegistrationEventTicket);
  } catch (error) {
    if (isMissingRegistrationEventTicketsTable(error)) {
      return [];
    }

    throw error;
  }
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
          SELECT
            registration_inscription_orders.*,
            payment_proof.id AS proof_id,
            payment_proof.file_name AS proof_file_name,
            payment_proof.content_type AS proof_content_type,
            payment_proof.file_size AS proof_file_size,
            payment_proof.data_url AS proof_data_url,
            payment_proof.status AS proof_status,
            payment_proof.uploaded_at AS proof_uploaded_at
          FROM registration_inscription_orders
          LEFT JOIN registration_inscription_payment_proofs AS payment_proof
            ON payment_proof.id = (
              SELECT latest_proof.id
              FROM registration_inscription_payment_proofs AS latest_proof
              WHERE latest_proof.order_id = registration_inscription_orders.id
              ORDER BY latest_proof.uploaded_at DESC, latest_proof.created_at DESC
              LIMIT 1
            )
          ORDER BY updated_at DESC, created_at DESC
        `,
      )
      .all();

    return Promise.all(results.map((order) => serializeRegistrationInscriptionOrderWithJoinedProof(db, order)));
  } catch (error) {
    if (isMissingRegistrationInscriptionOrdersTable(error)) {
      return [];
    }

    throw error;
  }
}

async function getAllRegistrationShopOrders(db) {
  try {
    const { results = [] } = await db
      .prepare(
        `
          SELECT
            registration_shop_orders.*,
            payment_proof.id AS proof_id,
            payment_proof.file_name AS proof_file_name,
            payment_proof.content_type AS proof_content_type,
            payment_proof.file_size AS proof_file_size,
            payment_proof.data_url AS proof_data_url,
            payment_proof.status AS proof_status,
            payment_proof.uploaded_at AS proof_uploaded_at
          FROM registration_shop_orders
          LEFT JOIN registration_shop_payment_proofs AS payment_proof
            ON payment_proof.id = (
              SELECT latest_proof.id
              FROM registration_shop_payment_proofs AS latest_proof
              WHERE latest_proof.order_id = registration_shop_orders.id
              ORDER BY latest_proof.uploaded_at DESC, latest_proof.created_at DESC
              LIMIT 1
            )
          ORDER BY updated_at DESC, created_at DESC
        `,
      )
      .all();

    return Promise.all(results.map((order) => serializeRegistrationShopOrderWithJoinedProof(db, order)));
  } catch (error) {
    if (isMissingRegistrationShopOrdersTable(error)) {
      return [];
    }

    throw error;
  }
}

function compareRegistrationOrdersByUpdatedAt(firstOrder, secondOrder) {
  const firstDate = Date.parse(firstOrder.updatedAt || firstOrder.createdAt || "");
  const secondDate = Date.parse(secondOrder.updatedAt || secondOrder.createdAt || "");

  return (Number.isNaN(secondDate) ? 0 : secondDate) - (Number.isNaN(firstDate) ? 0 : firstDate);
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

async function getAllRegistrationAdminParticipants(db) {
  const { results = [] } = await db
    .prepare(
      `
        SELECT
          registration_participants.*,
          registration_academies.name AS academy_name,
          registration_academies.venue AS academy_venue,
          registration_academies.contact_name AS academy_contact_name,
          registration_academies.email AS academy_email,
          registration_academies.phone AS academy_phone,
          registration_academies.origin_type AS academy_origin_type,
          registration_academies.origin_state AS academy_origin_state,
          registration_academies.origin_country AS academy_origin_country
        FROM registration_participants
        INNER JOIN registration_academies
          ON registration_academies.id = registration_participants.academy_id
        ORDER BY registration_academies.name ASC, registration_participants.full_name ASC
      `,
    )
    .all();

  return results.map(serializeRegistrationAdminParticipant);
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

async function getRegistrationAcademyDanceCount(db, academyId) {
  const row = await db
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM registration_dances
        WHERE academy_id = ?
      `,
    )
    .bind(academyId)
    .first();

  return Number(row?.total || 0);
}

async function assertRegistrationReleveTeacherEligibility(db, academyId) {
  const danceCount = await getRegistrationAcademyDanceCount(db, academyId);

  if (danceCount >= registrationReleveTeacherMinimumDances) {
    return;
  }

  throwHttpError(
    "releve_teacher_requires_dances",
    `Para registrar un Maestro Relevé, tu academia debe tener al menos ${registrationReleveTeacherMinimumDances} coreografías inscritas. Actualmente tiene ${danceCount}.`,
    400,
  );
}

async function getAllRegistrationProgramDances(db) {
  try {
    const { results: dances = [] } = await db
      .prepare(
        `
          SELECT
            registration_dances.*,
            registration_academies.name AS academy_name
          FROM registration_dances
          INNER JOIN registration_academies
            ON registration_academies.id = registration_dances.academy_id
          ORDER BY registration_dances.created_at DESC
        `,
      )
      .all();

    return serializeRegistrationProgramDances(db, dances);
  } catch (error) {
    if (isMissingRegistrationDancesTable(error)) {
      return [];
    }

    throw error;
  }
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

async function assertRegistrationDanceBelongsToAcademy(db, academyId, danceId) {
  const dance = await db
    .prepare(
      `
        SELECT id
        FROM registration_dances
        WHERE academy_id = ? AND id = ?
        LIMIT 1
      `,
    )
    .bind(academyId, danceId)
    .first();

  if (!dance) {
    throwHttpError("registration_dance_not_found", "Coreografía no encontrada", 404);
  }
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
          registration_participants.full_name,
          registration_participants.division,
          registration_participants.shirt_size
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
  const musicUploadsByDance = await getRegistrationMusicUploadsByDance(db, academyId, danceIds);

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
    musicUpload: musicUploadsByDance.get(dance.id) || null,
  }));
}

async function serializeRegistrationProgramDances(db, dances) {
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
        INNER JOIN registration_choreographers
          ON registration_choreographers.id = registration_dance_choreographers.choreographer_id
      `,
    )
    .all();
  const { results: participants = [] } = await db
    .prepare(
      `
        SELECT
          registration_dance_participants.dance_id,
          registration_participants.id,
          registration_participants.full_name,
          registration_participants.division,
          registration_participants.shirt_size
        FROM registration_dance_participants
        INNER JOIN registration_participants
          ON registration_participants.id = registration_dance_participants.participant_id
      `,
    )
    .all();
  const choreographersByDance = groupRegistrationRelations(choreographers, danceIds);
  const participantsByDance = groupRegistrationRelations(participants, danceIds);

  return dances.map((dance) => ({
    academyName: dance.academy_name,
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

async function getRegistrationMusicUploadsByDance(db, academyId, danceIds) {
  const uploadsByDance = new Map();

  if (danceIds.size === 0) {
    return uploadsByDance;
  }

  try {
    const { results: uploads = [] } = await db
      .prepare(
        `
          SELECT registration_music_uploads.*
          FROM registration_music_uploads
          INNER JOIN registration_dances
            ON registration_dances.id = registration_music_uploads.dance_id
          WHERE registration_dances.academy_id = ?
          ORDER BY registration_music_uploads.uploaded_at DESC, registration_music_uploads.created_at DESC
        `,
      )
      .bind(academyId)
      .all();

    for (const upload of uploads) {
      if (danceIds.has(upload.dance_id) && !uploadsByDance.has(upload.dance_id)) {
        uploadsByDance.set(upload.dance_id, serializeRegistrationMusicUpload(upload));
      }
    }
  } catch (error) {
    if (!isMissingRegistrationMusicUploadsTable(error)) {
      throw error;
    }
  }

  return uploadsByDance;
}

async function getRegistrationMusicUploadByDanceId(db, academyId, danceId) {
  const upload = await db
    .prepare(
      `
        SELECT registration_music_uploads.*
        FROM registration_music_uploads
        INNER JOIN registration_dances
          ON registration_dances.id = registration_music_uploads.dance_id
        WHERE registration_dances.academy_id = ?
          AND registration_music_uploads.dance_id = ?
        LIMIT 1
      `,
    )
    .bind(academyId, danceId)
    .first();

  return upload ? serializeRegistrationMusicUpload(upload) : null;
}

function groupRegistrationRelations(rows, danceIds) {
  const grouped = new Map();

  for (const row of rows) {
    if (!danceIds.has(row.dance_id)) {
      continue;
    }

    const current = grouped.get(row.dance_id) || [];
    current.push({
      division: row.division,
      id: row.id,
      fullName: row.full_name,
      shirtSize: row.shirt_size,
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
      role: registrationUserRoles.has(row.user_role) ? row.user_role : "academy",
      emailConfirmedAt: row.email_confirmed_at || null,
    },
    academy: {
      id: row.academy_id,
      name: row.academy_name,
      venue: row.venue,
      contactName: row.contact_name,
      email: row.academy_email,
      phone: row.phone,
      originType: row.academy_origin_type || "mexico",
      originState: row.academy_origin_state || null,
      originCountry: row.academy_origin_country || "México",
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
    isInternational: Boolean(participant.is_international),
    isReleveTeacher: Boolean(participant.is_releve_teacher),
    createdAt: participant.created_at,
  };
}

function serializeRegistrationAdminParticipant(participant) {
  return {
    ...serializeRegistrationParticipant(participant),
    academyId: participant.academy_id,
    academyName: participant.academy_name,
    academyVenue: participant.academy_venue,
    academyContactName: participant.academy_contact_name,
    academyEmail: participant.academy_email,
    academyPhone: participant.academy_phone,
    academyOriginType: participant.academy_origin_type || "mexico",
    academyOriginState: participant.academy_origin_state || null,
    academyOriginCountry: participant.academy_origin_country || "México",
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
    participantCount: Number(dance.participant_count || 0),
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

function getRegistrationBuyerPhoneContact(body) {
  const countryCode = normalizePhoneCountryCode(
    optionalString(body.buyerPhoneCountryCode ?? body.phoneCountryCode ?? body.countryCode),
  );
  const explicitPhone = normalizePhoneNumber(optionalString(body.buyerPhone));
  const countryDigits = countryCode.replace(/\D/g, "");
  let number = normalizePhoneNumber(optionalString(body.buyerPhoneNumber ?? body.phoneNumber ?? body.phone));

  if (!number && explicitPhone) {
    number = explicitPhone.startsWith(countryDigits) ? explicitPhone.slice(countryDigits.length) : explicitPhone;
  }

  if (!number) {
    throwHttpError("invalid_buyer_phone", "Ingresa un número de WhatsApp para avisos de pago", 400);
  }

  const phoneDigits = `${countryDigits}${number}`;

  if (number.length < 7 || phoneDigits.length < 8 || phoneDigits.length > 15) {
    throwHttpError("invalid_buyer_phone", "Ingresa un número de WhatsApp válido", 400);
  }

  return {
    countryCode,
    number,
    phone: `${countryCode}${number}`,
  };
}

function getRegistrationShopBuyerContact(body) {
  const name = optionalString(body.buyerName ?? body.name ?? body.buyerFullName);
  const email = optionalEmail(body.buyerEmail ?? body.email);

  if (!name) {
    throwHttpError("invalid_buyer_name", "Ingresa el nombre del titular o responsable.", 400);
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throwHttpError("invalid_buyer_email", "Ingresa un correo válido.", 400);
  }

  return {
    email,
    name,
  };
}

async function ensureRegistrationShopOrderBuyerContactColumns(db) {
  const { results = [] } = await db.prepare("PRAGMA table_info(registration_shop_orders)").all();
  const existingColumns = new Set(results.map((column) => column.name));
  const requiredColumns = [
    ["buyer_name", "TEXT"],
    ["buyer_email", "TEXT"],
  ];

  for (const [name, definition] of requiredColumns) {
    if (!existingColumns.has(name)) {
      try {
        await db.prepare(`ALTER TABLE registration_shop_orders ADD COLUMN ${name} ${definition}`).run();
      } catch (error) {
        if (!String(error?.message || error).match(/duplicate column name/i)) {
          throw error;
        }
      }
    }
  }
}

async function ensureRegistrationInscriptionOrderBuyerPhoneColumns(db) {
  const { results = [] } = await db.prepare("PRAGMA table_info(registration_inscription_orders)").all();
  const existingColumns = new Set(results.map((column) => column.name));
  const requiredColumns = [
    ["buyer_phone_country_code", "TEXT"],
    ["buyer_phone_number", "TEXT"],
    ["buyer_phone", "TEXT"],
  ];

  for (const [name, definition] of requiredColumns) {
    if (!existingColumns.has(name)) {
      try {
        await db.prepare(`ALTER TABLE registration_inscription_orders ADD COLUMN ${name} ${definition}`).run();
      } catch (error) {
        if (!String(error?.message || error).match(/duplicate column name/i)) {
          throw error;
        }
      }
    }
  }
}

async function ensureRegistrationAcademyOriginColumns(db) {
  const { results = [] } = await db.prepare("PRAGMA table_info(registration_academies)").all();
  const existingColumns = new Set(results.map((column) => column.name));
  const requiredColumns = [
    ["origin_type", "TEXT NOT NULL DEFAULT 'mexico' CHECK (origin_type IN ('mexico', 'international'))"],
    ["origin_state", "TEXT"],
    ["origin_country", "TEXT NOT NULL DEFAULT 'México'"],
  ];

  for (const [name, definition] of requiredColumns) {
    if (existingColumns.has(name)) {
      continue;
    }

    try {
      await db.prepare(`ALTER TABLE registration_academies ADD COLUMN ${name} ${definition}`).run();
    } catch (error) {
      if (!String(error?.message || error).match(/duplicate column name/i)) {
        throw error;
      }
    }
  }
}

async function ensureRegistrationParticipantInternationalColumn(db) {
  const { results = [] } = await db.prepare("PRAGMA table_info(registration_participants)").all();
  const existingColumns = new Set(results.map((column) => column.name));

  if (existingColumns.has("is_international")) {
    return;
  }

  try {
    await db
      .prepare(
        `
          ALTER TABLE registration_participants
          ADD COLUMN is_international INTEGER NOT NULL DEFAULT 0 CHECK (is_international IN (0, 1))
        `,
      )
      .run();
  } catch (error) {
    if (!String(error?.message || error).match(/duplicate column name/i)) {
      throw error;
    }
  }
}

async function ensureRegistrationParticipantReleveTeacherColumn(db) {
  const { results = [] } = await db.prepare("PRAGMA table_info(registration_participants)").all();
  const existingColumns = new Set(results.map((column) => column.name));

  if (existingColumns.has("is_releve_teacher")) {
    return;
  }

  try {
    await db
      .prepare(
        `
          ALTER TABLE registration_participants
          ADD COLUMN is_releve_teacher INTEGER NOT NULL DEFAULT 0 CHECK (is_releve_teacher IN (0, 1))
        `,
      )
      .run();
  } catch (error) {
    if (!String(error?.message || error).match(/duplicate column name/i)) {
      throw error;
    }
  }
}

async function ensureRegistrationUserRoleColumn(db) {
  const existingColumns = await getTableColumnNames(db, "registration_users");

  if (existingColumns.has("role")) {
    return;
  }

  await db
    .prepare(
      `
        ALTER TABLE registration_users
          ADD COLUMN role TEXT NOT NULL DEFAULT 'academy' CHECK (role IN ('academy', 'admin'))
      `,
    )
    .run();
}

async function getTableColumnNames(db, tableName) {
  const allowedTables = new Set(["registration_users"]);

  if (!allowedTables.has(tableName)) {
    throwHttpError("registration_invalid_table", "Tabla de registro inválida", 500);
  }

  const { results = [] } = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  return new Set(results.map((row) => row.name));
}

function normalizePhoneCountryCode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `+${digits.slice(0, 4)}` : "+52";
}

function normalizePhoneNumber(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function serializeRegistrationInscriptionOrder(order) {
  return {
    orderType: "registration",
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
    buyerName: order.buyer_name,
    buyerEmail: order.buyer_email,
    buyerPhoneCountryCode: order.buyer_phone_country_code,
    buyerPhoneNumber: order.buyer_phone_number,
    buyerPhone: order.buyer_phone,
    notes: order.notes,
    paidAt: order.paid_at,
    reviewedBy: order.reviewed_by,
    reviewedAt: order.reviewed_at,
    rejectionReason: order.rejection_reason,
    rejectionMessage: order.rejection_message,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

function serializeRegistrationShopOrder(order) {
  return {
    orderType: "shop",
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
    buyerName: order.buyer_name,
    buyerEmail: order.buyer_email,
    buyerPhoneCountryCode: order.buyer_phone_country_code,
    buyerPhoneNumber: order.buyer_phone_number,
    buyerPhone: order.buyer_phone,
    discountCode: order.discount_code,
    discountAmount: Number(order.discount_amount || 0),
    notes: order.notes,
    paidAt: order.paid_at,
    reviewedBy: order.reviewed_by,
    reviewedAt: order.reviewed_at,
    rejectionReason: order.rejection_reason,
    rejectionMessage: order.rejection_message,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

async function serializeRegistrationInscriptionOrderWithProof(db, order) {
  return {
    ...serializeRegistrationInscriptionOrder(order),
    proof: await getLatestRegistrationPaymentProof(db, order.id),
    tickets: await getRegistrationEventTicketsForSource(db, "registration", order.id),
  };
}

async function serializeRegistrationInscriptionOrderWithJoinedProof(db, order) {
  return {
    ...serializeRegistrationInscriptionOrder(order),
    proof: serializeJoinedRegistrationPaymentProof(order),
    tickets: await getRegistrationEventTicketsForSource(db, "registration", order.id),
  };
}

async function serializeRegistrationShopOrderWithProof(db, order) {
  return {
    ...serializeRegistrationShopOrder(order),
    proof: await getLatestRegistrationShopPaymentProof(db, order.id),
    tickets: await getRegistrationEventTicketsForSource(db, "shop", order.id),
  };
}

async function serializeRegistrationShopOrderWithJoinedProof(db, order) {
  return {
    ...serializeRegistrationShopOrder(order),
    proof: serializeJoinedRegistrationPaymentProof(order),
    tickets: await getRegistrationEventTicketsForSource(db, "shop", order.id),
  };
}

function serializeRegistrationEventTicket(ticket) {
  return {
    id: ticket.id,
    sourceOrderType: ticket.source_order_type,
    sourceOrderId: ticket.source_order_id,
    ticketCode: ticket.ticket_code,
    ticketNumber: Number(ticket.ticket_number || 0),
    ticketLabel: ticket.ticket_label,
    holderName: ticket.holder_name,
    qrPayload: ticket.qr_payload,
    status: ticket.status,
    usedAt: ticket.used_at,
    usedBy: ticket.used_by,
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
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

async function getLatestRegistrationShopPaymentProof(db, orderId) {
  try {
    const proof = await db
      .prepare(
        `
          SELECT *
          FROM registration_shop_payment_proofs
          WHERE order_id = ?
          ORDER BY uploaded_at DESC, created_at DESC
          LIMIT 1
        `,
      )
      .bind(orderId)
      .first();

    return proof ? serializeRegistrationPaymentProof(proof) : null;
  } catch (error) {
    if (isMissingRegistrationShopPaymentProofsTable(error)) {
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

function serializeJoinedRegistrationPaymentProof(row) {
  if (!row.proof_id) {
    return null;
  }

  return {
    id: row.proof_id,
    fileName: row.proof_file_name,
    contentType: row.proof_content_type,
    fileSize: Number(row.proof_file_size || 0),
    dataUrl: row.proof_data_url,
    status: row.proof_status,
    uploadedAt: row.proof_uploaded_at,
  };
}

function serializePublicRegistrationInscriptionLookup(lookup) {
  const { academyId, order, ...publicLookup } = lookup;

  return {
    ...publicLookup,
    order: order ? serializePublicRegistrationInscriptionOrder(order) : null,
  };
}

function serializePublicRegistrationInscriptionPaymentLookup(lookup) {
  return {
    curp: lookup.curp,
    participantName: lookup.participantName,
    academyName: lookup.academyName,
    venue: lookup.venue,
    reference: lookup.reference,
    registrations: [],
    lines: lookup.lines.map((line, index) => ({
      ...line,
      id: `concepto-${index + 1}`,
    })),
    subtotal: lookup.subtotal,
    order: lookup.order ? serializePublicRegistrationInscriptionPaymentOrder(lookup.order) : null,
  };
}

function serializePublicRegistrationInscriptionOrder(order) {
  const { academyId, ...publicOrder } = order;
  return publicOrder;
}

function serializePublicRegistrationInscriptionPaymentOrder(order) {
  return {
    id: order.id,
    curp: order.curp,
    participantName: order.participantName,
    academyName: order.academyName,
    venue: order.venue,
    reference: order.reference,
    amount: order.amount,
    paidAmount: order.paidAmount,
    status: order.status,
    paymentMethod: order.paymentMethod,
    buyerPhoneCountryCode: order.buyerPhoneCountryCode,
    buyerPhoneNumber: order.buyerPhoneNumber,
    buyerPhone: order.buyerPhone,
    paidAt: order.paidAt,
    reviewedAt: order.reviewedAt,
    rejectionMessage: order.rejectionMessage,
    proof: order.proof ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
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

function isMissingRegistrationShopOrdersTable(error) {
  return String(error?.message || error).includes("registration_shop_orders");
}

function isMissingRegistrationDancesTable(error) {
  return String(error?.message || error).includes("registration_dances");
}

function isMissingRegistrationInscriptionOrderReviewColumns(error) {
  const message = String(error?.message || error);
  return ["reviewed_by", "reviewed_at", "rejection_reason", "rejection_message"].some((column) => message.includes(column));
}

function isMissingRegistrationEventTicketsTable(error) {
  return String(error?.message || error).includes("registration_event_tickets");
}

function isMissingRegistrationPaymentProofsTable(error) {
  return String(error?.message || error).includes("registration_inscription_payment_proofs");
}

function isMissingRegistrationShopPaymentProofsTable(error) {
  return String(error?.message || error).includes("registration_shop_payment_proofs");
}

function isMissingRegistrationMusicUploadsTable(error) {
  return String(error?.message || error).includes("registration_music_uploads");
}

async function ensureRegistrationPaymentProofTables(db) {
  await db
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS registration_inscription_payment_proofs (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES registration_inscription_orders(id) ON DELETE CASCADE,
          file_name TEXT NOT NULL,
          content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
          file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 1800000),
          data_url TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected')),
          uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `,
    )
    .run();
  await db
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS registration_shop_payment_proofs (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES registration_shop_orders(id) ON DELETE CASCADE,
          file_name TEXT NOT NULL,
          content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
          file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 1800000),
          data_url TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected')),
          uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `,
    )
    .run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_registration_inscription_payment_proofs_order_id ON registration_inscription_payment_proofs(order_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_registration_shop_payment_proofs_order_id ON registration_shop_payment_proofs(order_id)`).run();
}

async function ensureRegistrationMusicUploadsTable(db) {
  await db
    .prepare(
      `
        CREATE TABLE IF NOT EXISTS registration_music_uploads (
          id TEXT PRIMARY KEY,
          academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
          dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
          file_name TEXT NOT NULL,
          content_type TEXT NOT NULL CHECK (content_type IN ('audio/mpeg', 'audio/mp3')),
          file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 12000000),
          data_url TEXT NOT NULL,
          storage_provider TEXT NOT NULL DEFAULT 'd1' CHECK (storage_provider IN ('d1', 'google_drive')),
          drive_file_id TEXT,
          drive_web_view_link TEXT,
          drive_web_content_link TEXT,
          uploaded_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
          uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (dance_id)
        )
      `,
    )
    .run();
  await ensureRegistrationMusicUploadsStorageColumns(db);
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_registration_music_uploads_academy_id ON registration_music_uploads(academy_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_registration_music_uploads_dance_id ON registration_music_uploads(dance_id)`).run();
}

async function ensureRegistrationMusicUploadsStorageColumns(db) {
  const { results = [] } = await db.prepare("PRAGMA table_info(registration_music_uploads)").all();
  const existingColumns = new Set(results.map((column) => column.name));
  const columns = [
    {
      definition: "TEXT NOT NULL DEFAULT 'd1' CHECK (storage_provider IN ('d1', 'google_drive'))",
      name: "storage_provider",
    },
    { definition: "TEXT", name: "drive_file_id" },
    { definition: "TEXT", name: "drive_web_view_link" },
    { definition: "TEXT", name: "drive_web_content_link" },
  ];

  for (const { definition, name } of columns) {
    if (!existingColumns.has(name)) {
      try {
        await db.prepare(`ALTER TABLE registration_music_uploads ADD COLUMN ${name} ${definition}`).run();
      } catch (error) {
        if (!String(error?.message || error).match(/duplicate column name/i)) {
          throw error;
        }
      }
    }
  }
}

function serializeRegistrationMusicUpload(upload) {
  const storageProvider = upload.storage_provider || (upload.drive_file_id ? "google_drive" : "d1");

  return {
    id: upload.id,
    danceId: upload.dance_id,
    fileName: upload.file_name,
    contentType: upload.content_type,
    fileSize: Number(upload.file_size || 0),
    dataUrl: upload.data_url || null,
    driveFileId: null,
    driveUrl: null,
    storageProvider,
    uploadedAt: upload.uploaded_at,
  };
}

async function storeRegistrationMusicUpload({ dance, env, musicUpload, session }) {
  const driveConfig = getRegistrationMusicDriveConfig(env);

  if (!driveConfig) {
    return {
      dataUrl: musicUpload.dataUrl,
      driveFileId: null,
      driveWebContentLink: null,
      driveWebViewLink: null,
      storageProvider: "d1",
    };
  }

  const driveFile = await uploadRegistrationMusicToGoogleDrive({
    config: driveConfig,
    dance,
    musicUpload,
    session,
  });

  return {
    dataUrl: "",
    driveFileId: driveFile.id,
    driveWebContentLink: driveFile.webContentLink || null,
    driveWebViewLink: driveFile.webViewLink || null,
    storageProvider: "google_drive",
  };
}

function getRegistrationMusicDriveConfig(env) {
  const folderId = optionalString(env.REGISTRATION_MUSIC_DRIVE_FOLDER_ID || env.GOOGLE_DRIVE_MUSIC_FOLDER_ID);
  const oauthClientId = optionalString(env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || env.GMAIL_OAUTH_CLIENT_ID);
  const oauthClientSecret = optionalString(env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || env.GMAIL_OAUTH_CLIENT_SECRET);
  const oauthRefreshToken = optionalString(env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN);
  const hasAnyDriveOauthConfig = Boolean(
    optionalString(env.GOOGLE_DRIVE_OAUTH_CLIENT_ID) ||
      optionalString(env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET) ||
      oauthRefreshToken,
  );
  const clientEmail = optionalString(env.GOOGLE_DRIVE_CLIENT_EMAIL);
  const privateKey = optionalString(env.GOOGLE_DRIVE_PRIVATE_KEY);
  const hasAnyDriveConfig = Boolean(folderId || hasAnyDriveOauthConfig || clientEmail || privateKey);

  if (!hasAnyDriveConfig) {
    return null;
  }

  if (hasAnyDriveOauthConfig) {
    if (!folderId || !oauthClientId || !oauthClientSecret || !oauthRefreshToken) {
      throwHttpError(
        "registration_music_drive_not_configured",
        "Faltan variables de Google Drive OAuth para subir música.",
        500,
      );
    }

    return {
      authType: "oauth_refresh_token",
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      folderId,
      refreshToken: oauthRefreshToken,
    };
  }

  if (!folderId || !clientEmail || !privateKey) {
    throwHttpError(
      "registration_music_drive_not_configured",
      "Faltan variables de Google Drive para subir música.",
      500,
    );
  }

  return {
    authType: "service_account",
    clientEmail,
    folderId,
    privateKey,
  };
}

async function uploadRegistrationMusicToGoogleDrive({ config, dance, musicUpload, session }) {
  const accessToken = await getGoogleDriveAccessToken(config);
  const fileBytes = dataUrlToUint8Array(musicUpload.dataUrl, musicUpload.contentType);
  const uploadUrl = new URL("https://www.googleapis.com/upload/drive/v3/files");
  uploadUrl.searchParams.set("uploadType", "resumable");
  uploadUrl.searchParams.set("fields", "id,webViewLink,webContentLink");

  const metadata = {
    mimeType: musicUpload.contentType,
    name: buildRegistrationMusicDriveFileName({ dance, session }),
    parents: [config.folderId],
  };
  const startResponse = await fetch(uploadUrl.toString(), {
    body: JSON.stringify(metadata),
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(fileBytes.byteLength),
      "x-upload-content-type": musicUpload.contentType,
    },
    method: "POST",
  });

  if (!startResponse.ok) {
    const detail = await startResponse.text().catch(() => "");
    console.warn("Google Drive music upload session failed", {
      detail,
      status: startResponse.status,
    });
    throwHttpError("registration_music_drive_upload_failed", "No pudimos iniciar la subida a Google Drive.", 502);
  }

  const resumableUrl = startResponse.headers.get("location");

  if (!resumableUrl) {
    throwHttpError("registration_music_drive_upload_failed", "Google Drive no devolvió URL de subida.", 502);
  }

  const uploadResponse = await fetch(resumableUrl, {
    body: fileBytes,
    headers: {
      "content-type": musicUpload.contentType,
    },
    method: "PUT",
  });

  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text().catch(() => "");
    console.warn("Google Drive music upload failed", {
      detail,
      status: uploadResponse.status,
    });
    throwHttpError("registration_music_drive_upload_failed", "No pudimos subir la música a Google Drive.", 502);
  }

  const payload = await uploadResponse.json().catch(() => ({}));

  if (!payload.id) {
    throwHttpError("registration_music_drive_upload_failed", "Google Drive no devolvió el archivo creado.", 502);
  }

  return payload;
}

async function getGoogleDriveAccessToken(config) {
  if (config.authType === "oauth_refresh_token") {
    return getGoogleOAuthAccessToken({
      authFailureCode: "registration_music_drive_auth_failed",
      authFailureMessage: "No pudimos autenticar Google Drive.",
      config,
    });
  }

  return getGoogleAccessToken({
    authFailureCode: "registration_music_drive_auth_failed",
    authFailureMessage: "No pudimos autenticar Google Drive.",
    config,
    scope: registrationGoogleDriveScope,
  });
}

async function getGoogleOAuthAccessToken({ authFailureCode, authFailureMessage, config }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.warn("Google OAuth auth failed", {
      detail,
      status: response.status,
    });
    throwHttpError(authFailureCode, authFailureMessage, 502);
  }

  const payload = await response.json().catch(() => ({}));

  if (!payload.access_token) {
    throwHttpError(authFailureCode, "Google no devolvió token de acceso.", 502);
  }

  return payload.access_token;
}

async function getGoogleAccessToken({ authFailureCode, authFailureMessage, config, scope, subject = "" }) {
  const assertion = await createGoogleServiceAccountAssertion({ config, scope, subject });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.warn("Google auth failed", {
      detail,
      scope,
      status: response.status,
      subject: subject || null,
    });
    throwHttpError(authFailureCode, authFailureMessage, 502);
  }

  const payload = await response.json().catch(() => ({}));

  if (!payload.access_token) {
    throwHttpError(authFailureCode, "Google no devolvió token de acceso.", 502);
  }

  return payload.access_token;
}

async function createGoogleServiceAccountAssertion({ config, scope, subject = "" }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    iss: config.clientEmail,
    scope,
  };

  if (subject) {
    payload.sub = subject;
  }

  const unsignedToken = [
    base64UrlEncodeJson({ alg: "RS256", typ: "JWT" }),
    base64UrlEncodeJson(payload),
  ].join(".");
  const privateKey = await importGoogleServiceAccountPrivateKey(config.privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function importGoogleServiceAccountPrivateKey(privateKey) {
  const normalizedPrivateKey = privateKey
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  return crypto.subtle.importKey(
    "pkcs8",
    base64ToUint8Array(normalizedPrivateKey),
    {
      hash: "SHA-256",
      name: "RSASSA-PKCS1-v1_5",
    },
    false,
    ["sign"],
  );
}

function buildRegistrationMusicDriveFileName({ dance, session }) {
  const modalityAndGenre = [
    getRegistrationDriveOptionLabel(registrationDriveGenreLabels, dance.genre),
    getRegistrationDriveOptionLabel(registrationDriveSubgenreLabels, dance.subgenre),
  ]
    .filter(Boolean)
    .join(" ");
  const division = getRegistrationMusicDriveDivision(dance);
  const parts = [
    dance.title,
    session.academy.name,
    modalityAndGenre,
    getRegistrationDriveOptionLabel(registrationDriveCategoryLabels, dance.category),
    registrationDriveDivisionLabels[division] || "Sin division",
  ].map(sanitizeRegistrationDriveFileNamePart);
  const name = parts.filter(Boolean).join(" - ");

  return `${name || "Levitate musica"}.mp3`;
}

function getRegistrationMusicDriveDivision(dance) {
  const divisions = Array.isArray(dance.participants)
    ? dance.participants.map((participant) => participant.division).filter(Boolean)
    : [];

  if (divisions.length === 0) {
    return "";
  }

  const [highestDivision = ""] = divisions.sort(
    (left, right) => getRegistrationDriveDivisionRank(right) - getRegistrationDriveDivisionRank(left),
  );

  return normalizeRegistrationDriveDivision(highestDivision);
}

function getRegistrationDriveDivisionRank(division) {
  const index = registrationDriveDivisionOrder.indexOf(normalizeRegistrationDriveDivision(division));
  return index === -1 ? 999 : index;
}

function normalizeRegistrationDriveDivision(division) {
  const value = String(division || "").trim();
  return registrationDriveLegacyDivisionMap[value] || value;
}

function getRegistrationDriveOptionLabel(labels, value) {
  const key = String(value || "").trim();
  return labels[key] || key.replace(/_/g, " ");
}

function sanitizeRegistrationDriveFileNamePart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function dataUrlToUint8Array(dataUrl, contentType) {
  const prefix = `data:${contentType};base64,`;

  if (!dataUrl.startsWith(prefix)) {
    throwHttpError("invalid_music_file", "La canción no coincide con el formato MP3", 400);
  }

  return base64ToUint8Array(dataUrl.slice(prefix.length));
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function base64UrlEncodeJson(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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
    shirtSize: choreographer.shirt_size || "m",
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

function optionalRegistrationChoice(value, allowedValues) {
  const text = optionalString(value);

  if (!text) {
    return "";
  }

  if (!allowedValues.has(text)) {
    throwHttpError("validation_error", "rejectionReason is invalid", 400);
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

function requireRegistrationCategory(genre, value) {
  const allowedValues = registrationCategoriesByGenre[genre];

  if (!allowedValues) {
    throwHttpError("validation_error", "genre is invalid", 400);
  }

  return requireRegistrationChoice(value, "category", allowedValues);
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

function getRegistrationMusicUploadInput(body) {
  const fileName = requireString(body.fileName, "fileName").slice(0, 180);
  const contentType = requireRegistrationChoice(body.contentType || "audio/mpeg", "contentType", registrationMusicUploadContentTypes);
  const dataUrl = requireString(body.dataUrl, "dataUrl");
  const estimatedFileSize = estimateBase64DataUrlSize(dataUrl);
  const providedFileSize = optionalInteger(body.fileSize, "fileSize");
  const fileSize = providedFileSize || estimatedFileSize;

  if (!fileName.toLowerCase().endsWith(".mp3")) {
    throwHttpError("invalid_music_file", "La canción debe estar en formato MP3", 400);
  }

  if (!dataUrl.startsWith(`data:${contentType};base64,`)) {
    throwHttpError("invalid_music_file", "La canción no coincide con el formato MP3", 400);
  }

  if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > maxRegistrationMusicUploadBytes) {
    throwHttpError("music_file_too_large", "La canción debe pesar menos de 12 MB", 400);
  }

  if (estimatedFileSize > maxRegistrationMusicUploadBytes || dataUrl.length > maxRegistrationMusicUploadBytes * 1.45) {
    throwHttpError("music_file_too_large", "La canción debe pesar menos de 12 MB", 400);
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

function optionalBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "on";
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

function normalizeRegistrationDocument(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
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

function isLocalRequest(request) {
  const host = new URL(request.url).host;
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function buildRegistrationSessionCookie(request, token) {
  const isLocal = isLocalRequest(request);
  const secure = isLocal ? "" : "; Secure";
  return `${registrationSessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${secure}`;
}

function expireRegistrationSessionCookie(request) {
  const isLocal = isLocalRequest(request);
  const secure = isLocal ? "" : "; Secure";
  return `${registrationSessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

function buildRegistrationStudentSessionCookie(request, token) {
  const isLocal = isLocalRequest(request);
  const secure = isLocal ? "" : "; Secure";
  return `${registrationStudentSessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${secure}`;
}

function expireRegistrationStudentSessionCookie(request) {
  const isLocal = isLocalRequest(request);
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

async function requireRegistrationAdmin(request, env, db) {
  const session = await getRegistrationStateFromRequest({ db, request });

  if (session.user.role !== "admin") {
    throwHttpError("registration_admin_forbidden", "Este usuario no tiene acceso al panel admin", 403);
  }

  return { scope: "global", session };
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
