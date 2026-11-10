const operations = new Set([
  "access-codes",
  "metadata",
  "move-routine",
  "delete-routine",
  "upsert-judge",
  "delete-judge",
  "special-award",
  "configuration",
  "activate",
  "archive",
  "restore",
]);

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}
async function authorized(request: Request) {
  const expected = Deno.env.get("LEVITATE_ADMIN_WEB_SECRET") || "";
  const provided = request.headers.get("x-levitate-admin-secret") || "";
  if (expected.length < 40 || provided.length < 40 || provided.length > 200)
    return false;
  const [a, b] = await Promise.all([digest(expected), digest(provided)]);
  let different = 0;
  for (let n = 0; n < a.length; n++) different |= a[n] ^ b[n];
  return different === 0;
}
function serviceKey() {
  const direct =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SECRET_KEY");
  if (direct) return direct;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  return keys.default || keys.service_role || "";
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return Response.json({ error: "Metodo no permitido." }, { status: 405 });
  if (!(await authorized(request)))
    return Response.json({ error: "No autorizado." }, { status: 401 });
  try {
    const payload = await request.json();
    if (
      !operations.has(payload.action) ||
      !Array.isArray(payload.allowed_event_ids) ||
      !payload.allowed_event_ids.includes(payload.event_id) ||
      typeof payload.actor_id !== "string" ||
      !payload.actor_id ||
      !payload.data ||
      typeof payload.data !== "object"
    ) {
      return Response.json({ error: "Solicitud no valida." }, { status: 400 });
    }
    const key = serviceKey();
    if (!key) throw new Error("configuration");
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/web_admin_judging_operation`,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_action: payload.action,
          p_event_id: payload.event_id,
          p_allowed_event_ids: payload.allowed_event_ids,
          p_actor_id: payload.actor_id,
          p_data: payload.data,
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      const status =
        data.code === "40001"
          ? 409
          : data.code === "42501"
            ? 403
            : data.code === "P0002"
              ? 404
              : 400;
      return Response.json(
        { error: data.message || "La base de datos rechazo la operacion." },
        { status, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(data, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { error: "No se pudo completar la operacion de administracion." },
      { status: 503 },
    );
  }
});
