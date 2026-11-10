import { judgingConnection, readJudgingRows } from "./judging-reader.js";
import {
  readAdminSnapshot,
  adminJudgingBody,
  adminJudgingJson,
  requireJudgingAdmin,
} from "./judging-admin.js";
import { requireJudgingEvent } from "./judging-authority.js";

const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), {
    statusCode,
    code: "judging_export_error",
  });
};
const normalized = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
const escape = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function hash(value) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
async function fileToken(env, fileId) {
  if (
    typeof env.LEVITATE_ADMIN_WEB_SECRET !== "string" ||
    env.LEVITATE_ADMIN_WEB_SECRET.length < 40
  )
    fail("No se configuro el envio privado.", 503);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.LEVITATE_ADMIN_WEB_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return [
    ...new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`judging-export:${fileId}`),
      ),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
function uuid(value) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value))
    fail("Exportacion no valida.");
  return value;
}
async function batchFor(env, eventId, id) {
  const row = await env.DB.prepare(
    "SELECT * FROM registration_judging_exports WHERE id=? AND event_id=?",
  )
    .bind(uuid(id), eventId)
    .first();
  if (!row) fail("No se encontro la exportacion.", 404);
  return row;
}
export async function serveJudgingExport(request, env, { getMediaStore }) {
  const url = new URL(request.url),
    token = url.searchParams.get("token");
  if (request.method !== "GET" || !token || !/^[a-f0-9]{64}$/.test(token))
    fail("El enlace no esta disponible.", 404);
  const row = await env.DB.prepare(
    "SELECT object_key,file_name,event_id FROM registration_judging_export_files WHERE access_token_hash=? AND expires_at>datetime('now')",
  )
    .bind(await hash(token))
    .first();
  if (!row) fail("El enlace vencio o no esta disponible.", 404);
  await requireJudgingEvent(env, row.event_id);
  const store = await getMediaStore(),
    file = await store.get(row.object_key);
  if (!file) fail("No se encontro el PDF.", 404);
  return new Response(file.body, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store, private",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex, nofollow",
      "content-disposition": `attachment; filename="${row.file_name.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "x-content-type-options": "nosniff",
    },
  });
}
export async function handleJudgingExports(
  request,
  env,
  session,
  { getMediaStore, sendEmail, fetcher = fetch },
) {
  requireJudgingAdmin(session);
  const url = new URL(request.url),
    action = url.pathname.split("/").pop(),
    eventId = await requireJudgingEvent(env, url.searchParams.get("eventId"));
  const body = await adminJudgingBody(request, 11500000);
  const snapshot = await readAdminSnapshot(env, eventId, { fetcher });
  if (action === "export-start") {
    if (!snapshot.blocks.some((b) => b.block_id === body.block_id))
      fail("Selecciona un bloque valido.");
    const id = crypto.randomUUID(),
      title = `${snapshot.event.name} - ${snapshot.blocks.find((b) => b.block_id === body.block_id).name}`;
    await env.DB.prepare(
      "INSERT INTO registration_judging_exports(id,event_id,block_id,title,created_by) VALUES (?,?,?,?,?)",
    )
      .bind(id, eventId, body.block_id, title, session.user.id)
      .run();
    return adminJudgingJson({ id, title });
  }
  const batch = await batchFor(env, eventId, body.export_id);
  if (action === "export-file") {
    const routine = snapshot.routines.find(
      (r) => r.routine_id === body.routine_id && r.block_id === batch.block_id,
    );
    if (!routine)
      fail("La coreografia no pertenece al bloque de esta exportacion.");
    if (
      typeof body.pdf !== "string" ||
      body.pdf.length > 11200000 ||
      !/^[A-Za-z0-9+/]+=*$/.test(body.pdf)
    )
      fail("El PDF no es valido o supera 8 MB.");
    let bytes;
    try {
      bytes = Uint8Array.from(atob(body.pdf), (c) => c.charCodeAt(0));
    } catch {
      fail("El PDF no es valido.");
    }
    if (
      bytes.length > 8 * 1024 * 1024 ||
      new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"
    )
      fail("El archivo no es un PDF valido.");
    const existing = await env.DB.prepare(
      "SELECT id FROM registration_judging_export_files WHERE export_id=? AND routine_id=? AND judge_id='all'",
    )
      .bind(batch.id, routine.routine_id)
      .first();
    if (existing) return adminJudgingJson({ ok: true, alreadyUploaded: true });
    const fileId = crypto.randomUUID(),
      name = `Levitate-${routine.routine_id.replace(/[^a-z0-9_-]/gi, "_")}.pdf`;
    const store = await getMediaStore({ create: true }),
      saved = await store.put(`judging/${batch.id}/${fileId}.pdf`, bytes, {
        httpMetadata: { contentType: "application/pdf" },
      });
    await env.DB.prepare(
      "INSERT INTO registration_judging_export_files(id,export_id,event_id,routine_id,judge_id,object_key,file_name) VALUES (?,?,?,?,'all',?,?)",
    )
      .bind(
        fileId,
        batch.id,
        eventId,
        routine.routine_id,
        saved.objectKey,
        name,
      )
      .run();
    return adminJudgingJson({ ok: true });
  }
  const config = judgingConnection(env),
    contacts = await readJudgingRows(
      config,
      "academy_contacts",
      {
        select: "event_id,academy_key,academy_name,email,state",
        event_id: `eq.${eventId}`,
        order: "academy_key.asc",
      },
      fetcher,
    );
  if (contacts.some((c) => c.event_id !== eventId))
    fail("No se pudo verificar el directorio de academias.", 502);
  const { results: files } = await env.DB.prepare(
    "SELECT * FROM registration_judging_export_files WHERE export_id=? AND event_id=?",
  )
    .bind(batch.id, eventId)
    .all();
  const recipients = new Map();
  const missing = [];
  for (const file of files) {
    const routine = snapshot.routines.find(
      (r) => r.routine_id === file.routine_id,
    );
    if (!routine) continue;
    const matches = contacts.filter(
      (c) =>
        [c.academy_key, c.academy_name].some(
          (v) => normalized(v) && normalized(v) === normalized(routine.academy),
        ) &&
        (!c.state ||
          !routine.state ||
          normalized(c.state) === normalized(routine.state)),
    );
    const addresses = [
      ...new Set(
        matches
          .map((c) =>
            String(c.email || "")
              .trim()
              .toLowerCase(),
          )
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
      ),
    ];
    if (!addresses.length) missing.push(routine.academy);
    for (const email of addresses) {
      if (!recipients.has(email))
        recipients.set(email, { email, academy: routine.academy, files: [] });
      recipients.get(email).files.push({ ...file, name: routine.name });
    }
  }
  if (action === "export-recipients") {
    const { results: deliveries } = await env.DB.prepare(
      "SELECT recipient,status FROM registration_judging_mail_deliveries WHERE export_id=?",
    )
      .bind(batch.id)
      .all();
    return adminJudgingJson({
      id: batch.id,
      title: batch.title,
      files: files.length,
      recipients: [...recipients.values()].map((r) => ({
        email: r.email,
        academy: r.academy,
        files: r.files.length,
        deliveryStatus:
          deliveries.find((d) => d.recipient === r.email)?.status || null,
      })),
      missingAcademies: [...new Set(missing)],
    });
  }
  if (action !== "export-send") fail("Operacion no disponible.", 404);
  if (
    body.confirmation !== batch.id ||
    typeof body.recipient !== "string" ||
    !recipients.has(body.recipient)
  )
    fail("Confirma el destinatario antes de enviar.");
  const recipient = recipients.get(body.recipient),
    deliveryId = `${batch.id}:${recipient.email}`;
  const already = await env.DB.prepare(
    "SELECT status FROM registration_judging_mail_deliveries WHERE id=?",
  )
    .bind(deliveryId)
    .first();
  if (already)
    fail(
      `Este envio ya esta ${already.status === "sent" ? "confirmado" : "registrado; revisa su estado antes de repetirlo"}.`,
      409,
    );
  const statements = [];
  const links = [];
  for (const file of recipient.files) {
    const token = await fileToken(env, file.id);
    statements.push(
      env.DB.prepare(
        "UPDATE registration_judging_export_files SET access_token_hash=?,expires_at=datetime('now','+30 days') WHERE id=? AND access_token_hash IS NULL",
      ).bind(await hash(token), file.id),
    );
    links.push({
      name: file.name,
      url: `${url.origin}/api/judging-export?token=${token}`,
    });
  }
  statements.push(
    env.DB.prepare(
      "INSERT INTO registration_judging_mail_deliveries(id,export_id,recipient,status) VALUES (?,?,?,'sending')",
    ).bind(deliveryId, batch.id, recipient.email),
  );
  try {
    await env.DB.batch(statements);
  } catch {
    fail(
      "El envio ya esta en curso o no se pudo reservar. No se envio otro correo.",
      409,
    );
  }
  let result;
  try {
    result = await sendEmail({
      to: recipient.email,
      subject: `Levitate · Hojas de jueceo · ${batch.title}`,
      kind: "judging_admin_sheets",
      text: `${recipient.academy}\n${batch.title}\n\n${links.map((l) => `${l.name}\n${l.url}`).join("\n\n")}\n\nEnlaces privados disponibles durante 30 dias.`,
      html: `<h2>${escape(batch.title)}</h2><p>${escape(recipient.academy)}</p><ul>${links.map((l) => `<li><a href="${escape(l.url)}">${escape(l.name)}</a></li>`).join("")}</ul><p>Enlaces privados disponibles durante 30 dias.</p>`,
    });
  } catch {
    result = { sent: false, reason: "unknown" };
  }
  await env.DB.prepare(
    "UPDATE registration_judging_mail_deliveries SET status=?,sent_at=CASE WHEN ?=1 THEN datetime('now') ELSE NULL END,error=? WHERE id=?",
  )
    .bind(
      result.sent ? "sent" : "unknown",
      result.sent ? 1 : 0,
      result.sent ? null : result.reason || "unknown",
      deliveryId,
    )
    .run();
  if (!result.sent)
    fail(
      "No se confirmo el correo. No lo reenvies hasta revisar el estado en Gmail.",
      502,
    );
  return adminJudgingJson({ ok: true, sent: true, recipient: recipient.email });
}
