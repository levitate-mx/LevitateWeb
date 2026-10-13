import catalog from "../shared/workshops-event.json" with { type: "json" };

export const maxWorkshopPaymentProofBytes = 1_400_000;

export const workshopEvent = {
  eventId: catalog.eventId, eventName: catalog.eventName, venue: catalog.venue,
  date: catalog.date, dateLabel: catalog.dateLabel, includedCount: catalog.includedCount,
  extraUnitPrice: catalog.extraUnitPrice, currency: catalog.currency,
  requiresPaidRegistration: catalog.requiresPaidRegistration,
};

export const workshopSessions = catalog.tracks.flatMap((track) => track.slots.flatMap((slot) => {
  const classes = slot.shared ? [slot.shared] : slot.classes;
  return classes.map((item, index) => ({
    id: item.id, title: item.title, coach: item.coach, trackId: track.id,
    trackTitle: track.title, venue: track.venue, start: slot.start, end: slot.end,
    minAge: slot.shared ? 0 : track.groups[index].minAge,
    maxAge: slot.shared ? null : track.groups[index].maxAge,
    groupLabel: slot.shared ? "Todas las edades" : track.groups[index].label,
  }));
}));

function fail(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}

export function workshopAgeOnDate(birthDate, date = catalog.date) {
  if (typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const born = new Date(`${birthDate}T00:00:00Z`);
  if (!Number.isFinite(born.getTime()) || born.toISOString().slice(0, 10) !== birthDate || birthDate > date) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  const [eventYear, eventMonth, eventDay] = date.split("-").map(Number);
  const age = eventYear - year - Number(eventMonth < month || (eventMonth === month && eventDay < day));
  return age >= 0 ? age : null;
}

function ageMatches(session, age) {
  return age !== null && age >= session.minAge && (session.maxAge === null || age <= session.maxAge);
}

async function getParticipant(db, curp, academyId) {
  const { results = [] } = await db.prepare(`
    SELECT p.id, p.full_name, p.curp, p.birth_date, p.academy_id, a.name AS academy_name,
      EXISTS (SELECT 1 FROM registration_inscription_orders AS orders
        WHERE orders.curp = p.curp AND orders.venue = ? AND orders.status = 'paid') AS registration_paid
    FROM registration_participants AS p
    INNER JOIN registration_academies AS a ON a.id = p.academy_id
    WHERE p.curp = ? AND (? IS NULL OR p.academy_id = ?)
    ORDER BY p.created_at, p.id
  `).bind(catalog.venue, curp, academyId || null, academyId || null).all();
  if (!results.length) fail("workshops_participant_not_found", "No se encontró un participante registrado con esa CURP.", 404);
  const row = results[0];
  const age = workshopAgeOnDate(row.birth_date);
  const birthDates = new Set(results.map((item) => item.birth_date));
  const reason = birthDates.size > 1 ? "Hay fechas de nacimiento distintas para esta CURP. Pide a tu academia que revise el registro."
    : age === null ? "Tu registro necesita una fecha de nacimiento válida. Pide a tu academia que la revise."
    : catalog.requiresPaidRegistration && !row.registration_paid ? "La inscripción de la competencia debe tener el pago aprobado para reservar workshops."
    : null;
  return { row, age, eligible: reason === null, eligibilityReason: reason };
}

const enrollmentSql = `
  SELECT enrollment.*,
    proof.id AS proof_id, proof.file_name AS proof_file_name, proof.content_type AS proof_content_type,
    proof.file_size AS proof_file_size, proof.amount AS proof_amount, proof.status AS proof_status,
    proof.notes AS proof_notes, proof.created_at AS proof_created_at, proof.reviewed_at AS proof_reviewed_at,
    proof.submitted_revision AS proof_submitted_revision, proof.reviewed_revision AS proof_reviewed_revision,
    (SELECT JSON_GROUP_ARRAY(session_id) FROM registration_workshop_enrollment_sessions AS item
      WHERE item.event_id = enrollment.event_id AND item.curp = enrollment.curp) AS session_ids
  FROM registration_workshop_enrollments AS enrollment
  LEFT JOIN registration_workshop_payment_proofs AS proof ON proof.id = (
    SELECT latest.id FROM registration_workshop_payment_proofs AS latest
    WHERE latest.event_id = enrollment.event_id AND latest.curp = enrollment.curp
    ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1
  )
`;

async function paymentReference(eventId, curp) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${eventId}\u0000${curp.toUpperCase()}`));
  // A short opaque transfer concept stays stable; it is never an auth credential.
  return `WS-${Array.from(new Uint8Array(hash).slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

async function serializeEnrollment(row) {
  if (!row) return null;
  const sessionIds = JSON.parse(row.session_ids || "[]");
  const paidAmount = Number(row.paid_amount);
  const amountDue = Number(row.amount_due);
  const proofIsCurrent = Number(row.proof_reviewed_revision || row.proof_submitted_revision) === Number(row.revision);
  const latestProof = row.proof_id ? {
    id: row.proof_id, fileName: row.proof_file_name, contentType: row.proof_content_type,
    fileSize: Number(row.proof_file_size), amount: Number(row.proof_amount), status: row.proof_status,
    notes: row.proof_notes || "", createdAt: row.proof_created_at, reviewedAt: row.proof_reviewed_at,
    isCurrent: proofIsCurrent,
  } : null;
  const paymentStatus = amountDue === 0 ? "not_required" : paidAmount >= amountDue ? "paid"
    : proofIsCurrent && ["reported", "rejected"].includes(row.proof_status) ? row.proof_status
    : paidAmount > 0 ? "partial" : "pending";
  return {
    id: row.curp, curp: row.curp, name: row.participant_name,
    academyName: row.academy_name, birthDate: row.birth_date, age: Number(row.age),
    sessionIds: workshopSessions.filter((session) => sessionIds.includes(session.id)).map((session) => session.id),
    count: Number(row.session_count), extraCount: Number(row.extra_count),
    amountDue, paidAmount, balance: Math.max(0, amountDue - paidAmount),
    paymentStatus, latestProof, paymentReference: await paymentReference(row.event_id, row.curp),
    revision: Number(row.revision), createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function getEnrollment(db, curp) {
  return db.prepare(`${enrollmentSql} WHERE enrollment.event_id = ? AND enrollment.curp = ?`)
    .bind(catalog.eventId, curp).first();
}

async function getSessions(db, age = null) {
  const { results = [] } = await db.prepare(`
    SELECT session_id, capacity, enrolled_count FROM registration_workshop_sessions WHERE event_id = ?
  `).bind(catalog.eventId).all();
  const byId = new Map(results.map((row) => [row.session_id, row]));
  return workshopSessions.map((session) => {
    const stored = byId.get(session.id);
    const capacity = stored?.capacity == null ? null : Number(stored.capacity);
    const enrolled = Number(stored?.enrolled_count || 0);
    return { ...session, capacity, enrolled, available: capacity === null ? null : Math.max(0, capacity - enrolled), eligible: ageMatches(session, age) };
  });
}

export async function getWorkshopLookup(db, curp, { academyId = null } = {}) {
  const { row, age, eligible, eligibilityReason } = await getParticipant(db, curp, academyId);
  return {
    event: workshopEvent,
    participant: { curp, name: row.full_name, birthDate: row.birth_date, age, academyName: row.academy_name },
    eligible, eligibilityReason,
    sessions: await getSessions(db, age),
    enrollment: await serializeEnrollment(await getEnrollment(db, curp)),
  };
}

export async function saveWorkshopEnrollment(db, curp, body, { academyId = null } = {}) {
  const participant = await getParticipant(db, curp, academyId);
  if (!participant.eligible) fail("workshops_not_eligible", participant.eligibilityReason, 403);
  const revision = body.revision;
  if (!Number.isSafeInteger(revision) || revision < 0) fail("workshops_revision_required", "Actualiza los datos antes de guardar tu selección.", 409);
  const ids = body.sessionIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > workshopSessions.length || ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length) {
    fail("workshops_invalid_selection", "Selecciona al menos un workshop válido, sin repetir sesiones.");
  }
  const selected = ids.map((id) => workshopSessions.find((session) => session.id === id));
  if (selected.some((session) => !session || !ageMatches(session, participant.age))) {
    fail("workshops_age_restricted", "La selección contiene un workshop que no corresponde a tu edad.");
  }
  for (let i = 0; i < selected.length; i += 1) {
    if (selected.slice(i + 1).some((other) => selected[i].start < other.end && other.start < selected[i].end)) {
      fail("workshops_schedule_conflict", "No puedes reservar workshops que coinciden en horario.");
    }
  }
  const existing = await getEnrollment(db, curp);
  if (existing?.proof_status === "reported") fail("workshops_proof_pending", "Tu comprobante está en revisión. Espera la respuesta antes de cambiar los workshops.", 409);
  if (Number(existing?.revision || 0) !== revision) fail("workshops_revision_conflict", "La inscripción cambió. Actualiza los datos antes de volver a guardar.", 409);
  const extraCount = Math.max(0, ids.length - catalog.includedCount);
  const amountDue = extraCount * catalog.extraUnitPrice;
  if (Number(existing?.paid_amount || 0) > amountDue) {
    fail("workshops_payment_review_required", "Tu selección cuesta menos que el monto pagado. Administración debe revisar el pago antes de cambiarla.", 409);
  }
  const currentIds = JSON.parse(existing?.session_ids || "[]");
  const sessions = await getSessions(db, participant.age);
  for (const id of ids.filter((id) => !currentIds.includes(id))) {
    const session = sessions.find((item) => item.id === id);
    if (session.available !== null && session.available <= 0) fail("workshops_session_full", "Uno de los workshops seleccionados ya no tiene cupo. Actualiza y elige otra sesión.", 409);
  }

  const mutationId = crypto.randomUUID();
  const row = participant.row;
  // The snapshot used for age/access must still exist when the transaction runs.
  // Payment is optional for this phase; the catalog controls a future requirement.
  const eligibleSql = `EXISTS (
    SELECT 1 FROM registration_participants AS p
    WHERE p.id = ? AND p.curp = ? AND p.academy_id = ? AND p.birth_date = ?
      AND (? = 0 OR EXISTS (SELECT 1 FROM registration_inscription_orders AS paid
        WHERE paid.curp = p.curp AND paid.venue = ? AND paid.status = 'paid'))
  )`;
  const eligibleParams = [row.id, curp, row.academy_id, row.birth_date, Number(catalog.requiresPaidRegistration), catalog.venue];
  const mutationGuard = `EXISTS (SELECT 1 FROM registration_workshop_enrollments
    WHERE event_id = ? AND curp = ? AND mutation_id = ?)`;
  const guardParams = [catalog.eventId, curp, mutationId];
  try {
    const results = await db.batch([
      db.prepare(`
        INSERT INTO registration_workshop_enrollments
          (event_id, curp, participant_name, academy_id, academy_name, birth_date, age,
           session_count, extra_count, amount_due, revision, mutation_id)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ? WHERE ${eligibleSql}
          AND (? = 0 OR EXISTS (SELECT 1 FROM registration_workshop_enrollments WHERE event_id = ? AND curp = ?))
        ON CONFLICT(event_id, curp) DO UPDATE SET
          participant_name = excluded.participant_name, academy_id = excluded.academy_id,
          academy_name = excluded.academy_name, birth_date = excluded.birth_date, age = excluded.age,
          session_count = excluded.session_count, extra_count = excluded.extra_count, amount_due = excluded.amount_due,
          revision = revision + 1, mutation_id = excluded.mutation_id, updated_at = datetime('now')
        WHERE revision = ? AND paid_amount <= excluded.amount_due
          AND NOT EXISTS (SELECT 1 FROM registration_workshop_payment_proofs AS pending
            WHERE pending.event_id = registration_workshop_enrollments.event_id
              AND pending.curp = registration_workshop_enrollments.curp AND pending.status = 'reported')
      `).bind(catalog.eventId, curp, row.full_name, row.academy_id, row.academy_name, row.birth_date,
        participant.age, ids.length, extraCount, amountDue, mutationId, ...eligibleParams,
        revision, catalog.eventId, curp, revision),
      db.prepare(`DELETE FROM registration_workshop_enrollment_sessions
        WHERE event_id = ? AND curp = ? AND session_id NOT IN (SELECT value FROM json_each(?)) AND ${mutationGuard}`)
        .bind(catalog.eventId, curp, JSON.stringify(ids), ...guardParams),
      db.prepare(`INSERT INTO registration_workshop_sessions(event_id, session_id, capacity)
        SELECT ?, value, NULL FROM json_each(?) WHERE ${mutationGuard}
          AND NOT EXISTS (SELECT 1 FROM registration_workshop_sessions AS saved
            WHERE saved.event_id = ? AND saved.session_id = value)`)
        .bind(catalog.eventId, JSON.stringify(ids), ...guardParams, catalog.eventId),
      db.prepare(`INSERT INTO registration_workshop_enrollment_sessions(event_id, curp, session_id)
        SELECT ?, ?, value FROM json_each(?) WHERE ${mutationGuard}
          AND NOT EXISTS (SELECT 1 FROM registration_workshop_enrollment_sessions AS saved
            WHERE saved.event_id = ? AND saved.curp = ? AND saved.session_id = value)`)
        .bind(catalog.eventId, curp, JSON.stringify(ids), ...guardParams, catalog.eventId, curp),
    ]);
    if (Number(results[0].meta?.changes || 0) !== 1) {
      fail("workshops_revision_conflict", "La inscripción cambió. Actualiza los datos antes de volver a guardar.", 409);
    }
  } catch (error) {
    if (String(error?.message).includes("workshops_session_full")) {
      fail("workshops_session_full", "Uno de los workshops seleccionados ya no tiene cupo. Actualiza y elige otra sesión.", 409);
    }
    throw error;
  }
  return getWorkshopLookup(db, curp, { academyId });
}

export async function getAdminWorkshops(db) {
  const { results = [] } = await db.prepare(`${enrollmentSql}
    WHERE enrollment.event_id = ? ORDER BY enrollment.updated_at DESC, enrollment.curp`)
    .bind(catalog.eventId).all();
  return { event: workshopEvent, sessions: await getSessions(db), enrollments: await Promise.all(results.map(serializeEnrollment)) };
}

export async function saveWorkshopCapacity(db, body) {
  if (!workshopSessions.some((session) => session.id === body.sessionId)) fail("workshops_invalid_session", "El workshop seleccionado no existe.");
  if (body.capacity !== null && (!Number.isSafeInteger(body.capacity) || body.capacity < 0)) {
    fail("workshops_invalid_capacity", "El cupo debe ser un número entero no negativo, o quedar sin límite.");
  }
  const result = await db.prepare(`
    INSERT INTO registration_workshop_sessions(event_id, session_id, capacity) VALUES (?, ?, ?)
    ON CONFLICT(event_id, session_id) DO UPDATE SET capacity = excluded.capacity, updated_at = datetime('now')
    WHERE excluded.capacity IS NULL OR enrolled_count <= excluded.capacity
  `).bind(catalog.eventId, body.sessionId, body.capacity).run();
  if (Number(result.meta?.changes || 0) !== 1) fail("workshops_capacity_below_enrolled", "No puedes fijar un cupo menor a las reservas existentes.", 409);
  return getAdminWorkshops(db);
}

export async function saveWorkshopPayment(db, curp, body, actor) {
  const existing = await getEnrollment(db, curp);
  if (!existing) fail("workshops_enrollment_not_found", "No se encontró la inscripción a workshops.", 404);
  if (existing.proof_status === "reported") fail("workshops_proof_pending", "Revisa el comprobante pendiente antes de modificar el pago.", 409);
  if (!Number.isSafeInteger(body.revision) || body.revision !== Number(existing.revision)) {
    fail("workshops_revision_conflict", "La inscripción cambió. Actualiza antes de confirmar el pago.", 409);
  }
  if (!Number.isSafeInteger(body.paidAmount) || body.paidAmount < 0 || body.paidAmount > Number(existing.amount_due)) {
    fail("workshops_invalid_payment", "El total pagado debe estar entre cero y el importe de los workshops adicionales.");
  }
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 1000) fail("workshops_payment_notes_too_long", "La observación no puede superar 1000 caracteres.");
  if (body.paidAmount < Number(existing.paid_amount) && !notes) fail("workshops_payment_reason_required", "Escribe el motivo de la corrección del pago.");
  const mutationId = crypto.randomUUID();
  const results = await db.batch([
    db.prepare(`UPDATE registration_workshop_enrollments SET paid_amount = ?, revision = revision + 1,
      mutation_id = ?, updated_at = datetime('now') WHERE event_id = ? AND curp = ? AND revision = ? AND amount_due >= ?
      AND NOT EXISTS (SELECT 1 FROM registration_workshop_payment_proofs AS pending
        WHERE pending.event_id = registration_workshop_enrollments.event_id
          AND pending.curp = registration_workshop_enrollments.curp AND pending.status = 'reported')`)
      .bind(body.paidAmount, mutationId, catalog.eventId, curp, body.revision, body.paidAmount),
    db.prepare(`INSERT INTO registration_workshop_payments
      (id, event_id, curp, previous_amount, paid_amount, actor_id, actor_name, notes)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM registration_workshop_enrollments
        WHERE event_id = ? AND curp = ? AND mutation_id = ?)`)
      .bind(mutationId, catalog.eventId, curp, Number(existing.paid_amount), body.paidAmount,
        actor.id, actor.name, notes, catalog.eventId, curp, mutationId),
  ]);
  if (Number(results[0].meta?.changes || 0) !== 1) fail("workshops_revision_conflict", "La inscripción cambió. Actualiza antes de confirmar el pago.", 409);
  return getAdminWorkshops(db);
}

export async function submitWorkshopPaymentProof(db, curp, body, proof, { academyId = null } = {}) {
  // D1 stores the base64 data URL in a row limited to 2 MB. Bound the actual
  // payload too: the caller's fileSize alone cannot keep the stored row safe.
  const base64 = proof.dataUrl.slice(proof.dataUrl.indexOf(",") + 1);
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    fail("invalid_payment_proof", "El comprobante no contiene un archivo válido.");
  }
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const actualFileSize = (base64.length * 3) / 4 - padding;
  if (proof.fileSize > maxWorkshopPaymentProofBytes || actualFileSize > maxWorkshopPaymentProofBytes) {
    fail("payment_proof_too_large", "El comprobante debe pesar como máximo 1.4 MB.");
  }
  const existing = await getEnrollment(db, curp);
  if (!existing) fail("workshops_enrollment_not_found", "Guarda tu selección de workshops antes de enviar un comprobante.", 404);
  if (existing.proof_status === "reported") fail("workshops_proof_pending", "Ya hay un comprobante en revisión. Espera la respuesta de administración.", 409);
  if (!Number.isSafeInteger(body.revision) || body.revision !== Number(existing.revision)) {
    fail("workshops_revision_conflict", "La inscripción cambió. Actualiza antes de enviar el comprobante.", 409);
  }
  if (Number(existing.amount_due) <= Number(existing.paid_amount)) {
    fail("workshops_no_balance", "Tu inscripción no tiene un saldo pendiente de workshops.", 409);
  }
  const proofId = crypto.randomUUID();
  const results = await db.batch([
    db.prepare(`UPDATE registration_workshop_enrollments
      SET revision = revision + 1, mutation_id = ?, updated_at = datetime('now')
      WHERE event_id = ? AND curp = ? AND revision = ? AND amount_due > paid_amount
        AND NOT EXISTS (SELECT 1 FROM registration_workshop_payment_proofs AS pending
          WHERE pending.event_id = registration_workshop_enrollments.event_id
            AND pending.curp = registration_workshop_enrollments.curp AND pending.status = 'reported')`)
      .bind(proofId, catalog.eventId, curp, body.revision),
    db.prepare(`INSERT INTO registration_workshop_payment_proofs
      (id, event_id, curp, submitted_revision, captured_amount_due, captured_paid_amount, amount,
       file_name, content_type, file_size, data_url)
      SELECT ?, event_id, curp, revision, amount_due, paid_amount, amount_due - paid_amount, ?, ?, ?, ?
      FROM registration_workshop_enrollments WHERE event_id = ? AND curp = ? AND mutation_id = ?`)
      .bind(proofId, proof.fileName, proof.contentType, proof.fileSize, proof.dataUrl, catalog.eventId, curp, proofId),
  ]);
  if (Number(results[0].meta?.changes || 0) !== 1) {
    fail("workshops_revision_conflict", "La inscripción cambió o ya tiene un comprobante en revisión. Actualiza los datos.", 409);
  }
  return getWorkshopLookup(db, curp, { academyId });
}

export async function getWorkshopPaymentProof(db, curp, proofId) {
  if (typeof proofId !== "string" || !proofId.trim()) fail("workshops_proof_required", "Selecciona el comprobante que quieres revisar.");
  const proof = await db.prepare(`SELECT id, file_name, content_type, file_size, data_url,
      amount, status, notes, created_at, reviewed_at
    FROM registration_workshop_payment_proofs WHERE id = ? AND event_id = ? AND curp = ?`)
    .bind(proofId, catalog.eventId, curp).first();
  if (!proof) fail("workshops_proof_not_found", "No se encontró ese comprobante para la inscripción.", 404);
  return {
    id: proof.id, fileName: proof.file_name, contentType: proof.content_type, fileSize: Number(proof.file_size),
    dataUrl: proof.data_url, amount: Number(proof.amount), status: proof.status, notes: proof.notes,
    createdAt: proof.created_at, reviewedAt: proof.reviewed_at,
  };
}

export async function reviewWorkshopPaymentProof(db, curp, body, actor) {
  if (!["approve", "reject"].includes(body.decision)) fail("workshops_review_decision_invalid", "Elige aprobar o rechazar el comprobante.");
  if (typeof body.proofId !== "string" || !body.proofId.trim()) fail("workshops_proof_required", "Selecciona el comprobante que quieres revisar.");
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 1000) fail("workshops_payment_notes_too_long", "La observación no puede superar 1000 caracteres.");
  if (body.decision === "reject" && !notes) fail("workshops_rejection_reason_required", "Escribe el motivo del rechazo para que puedan corregir el comprobante.");
  const existing = await getEnrollment(db, curp);
  if (!existing) fail("workshops_enrollment_not_found", "No se encontró la inscripción a workshops.", 404);
  if (!Number.isSafeInteger(body.revision) || body.revision !== Number(existing.revision)) {
    fail("workshops_revision_conflict", "La inscripción cambió. Actualiza antes de revisar el comprobante.", 409);
  }
  // Review never loads the file: metadata and the captured balance are sufficient.
  const proof = await db.prepare(`SELECT id, status, submitted_revision, captured_amount_due,
      captured_paid_amount, amount FROM registration_workshop_payment_proofs
    WHERE id = ? AND event_id = ? AND curp = ?`).bind(body.proofId, catalog.eventId, curp).first();
  if (!proof) fail("workshops_proof_not_found", "No se encontró ese comprobante para la inscripción.", 404);
  if (proof.status !== "reported" || Number(proof.submitted_revision) !== body.revision) {
    fail("workshops_proof_already_reviewed", "El comprobante ya fue revisado o la inscripción cambió. Actualiza los datos.", 409);
  }
  const approved = body.decision === "approve";
  const status = approved ? "approved" : "rejected";
  const mutationId = crypto.randomUUID();
  const results = await db.batch([
    db.prepare(`UPDATE registration_workshop_enrollments
      SET paid_amount = paid_amount + ?, revision = revision + 1, mutation_id = ?, updated_at = datetime('now')
      WHERE event_id = ? AND curp = ? AND revision = ? AND amount_due = ? AND paid_amount = ?
        AND EXISTS (SELECT 1 FROM registration_workshop_payment_proofs AS pending
          WHERE pending.id = ? AND pending.event_id = registration_workshop_enrollments.event_id
            AND pending.curp = registration_workshop_enrollments.curp AND pending.status = 'reported'
            AND pending.submitted_revision = registration_workshop_enrollments.revision
            AND pending.captured_amount_due = registration_workshop_enrollments.amount_due
            AND pending.captured_paid_amount = registration_workshop_enrollments.paid_amount)`)
      .bind(approved ? Number(proof.amount) : 0, mutationId, catalog.eventId, curp, body.revision,
        Number(proof.captured_amount_due), Number(proof.captured_paid_amount), proof.id),
    db.prepare(`UPDATE registration_workshop_payment_proofs
      SET status = ?, notes = ?, reviewed_revision = ?, reviewed_at = datetime('now'), reviewed_by_id = ?, reviewed_by_name = ?
      WHERE id = ? AND event_id = ? AND curp = ? AND status = 'reported'
        AND EXISTS (SELECT 1 FROM registration_workshop_enrollments
          WHERE event_id = ? AND curp = ? AND mutation_id = ?)`)
      .bind(status, notes, body.revision + 1, actor.id, actor.name, proof.id, catalog.eventId, curp,
        catalog.eventId, curp, mutationId),
    db.prepare(`INSERT INTO registration_workshop_payments
      (id, event_id, curp, previous_amount, paid_amount, actor_id, actor_name, notes)
      SELECT ?, event_id, curp, ?, paid_amount, ?, ?, ? FROM registration_workshop_enrollments
      WHERE event_id = ? AND curp = ? AND mutation_id = ? AND ? = 1`)
      .bind(proof.id, Number(proof.captured_paid_amount), actor.id, actor.name,
        `Comprobante ${proof.id}${notes ? `: ${notes}` : ""}`, catalog.eventId, curp, mutationId, Number(approved)),
  ]);
  if (Number(results[0].meta?.changes || 0) !== 1) {
    fail("workshops_revision_conflict", "El comprobante o el saldo cambiaron durante la revisión. Actualiza los datos.", 409);
  }
  return getAdminWorkshops(db);
}
