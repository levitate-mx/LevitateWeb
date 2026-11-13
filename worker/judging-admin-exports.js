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
async function hash(value) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
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
  { getMediaStore, fetcher = fetch },
) {
  requireJudgingAdmin(session);
  const url = new URL(request.url),
    action = url.pathname.split("/").pop();
  if (action === "export-send" || action === "export-recipients") {
    fail("El envío de hojas por correo está deshabilitado. Habilítalas por bloque en Mi Levitate.", 410);
  }
  const eventId = await requireJudgingEvent(env, url.searchParams.get("eventId"));
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
  fail("Operación no disponible.", 404);
}
