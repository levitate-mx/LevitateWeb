import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { pbkdf2Sync } from "node:crypto";
import worker from "../worker/index.js";

test("the existing administrator login protects admin entry and rejects anonymous API calls", async (t) => {
  const f = fixture(t),
    salt = Buffer.alloc(16, 7),
    password = "test-only-admin";
  const hash = `pbkdf2_sha256$100000$${salt.toString("base64url")}$${pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("base64url")}`;
  f.db
    .prepare(
      "UPDATE registration_users SET password_hash=?,email_confirmed_at=datetime('now') WHERE id='admin'",
    )
    .run(hash);
  const login = await worker.fetch(
    new Request("https://levitate.mx/api/registration/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password }),
    }),
    f.env,
  );
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  f.env.ASSETS = { fetch: async () => new Response("admin UI") };
  for (const path of ["/jueceo/admin", "/jueceo/app/?mode=admin-editor"]) {
    const response = await worker.fetch(
      new Request(`https://levitate.mx${path}`, { headers: { cookie } }),
      f.env,
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const anonymous = await worker.fetch(
      new Request(`https://levitate.mx${path}`),
      f.env,
    );
    assert.equal(anonymous.status, 302);
  }
  for (const path of ["workspace/events", "editor/session"]) {
    const response = await worker.fetch(
      new Request(`https://levitate.mx/api/registration/admin/judging/${path}`),
      f.env,
    );
    assert.equal(response.status, 401);
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
});
import {
  handleJudgingAdmin,
  validateAdminOperation,
} from "../worker/judging-admin.js";
import { handleAdminJudgeEditor } from "../worker/judge-workspace.js";
import {
  handleJudgingExports,
  serveJudgingExport,
} from "../worker/judging-admin-exports.js";

const eventId = "11111111-1111-4111-8111-111111111111",
  foreign = "22222222-2222-4222-8222-222222222222",
  rev = "2026-11-10T00:00:00Z";
const admin = { user: { id: "admin", name: "Admin", role: "admin" } };
function fixture(t) {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../db/registration_d1_schema.sql", import.meta.url),
      "utf8",
    ),
  );
  t.after(() => db.close());
  db.exec(
    "INSERT INTO registration_academies(id,name,contact_name,email) VALUES ('a','A','A','a@example.invalid'); INSERT INTO registration_users(id,academy_id,name,username,email,role,password_hash) VALUES ('admin','a','Admin','admin','admin@example.invalid','admin','not-a-real-password');",
  );
  const wrapper = {
    prepare(sql) {
      const s = db.prepare(sql);
      let values = [];
      return {
        bind(...v) {
          values = v;
          return this;
        },
        async first() {
          return s.get(...values) || null;
        },
        async all() {
          return { results: s.all(...values) };
        },
        async run() {
          return { meta: s.run(...values), success: true };
        },
      };
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const result = [];
        for (const s of statements) result.push(await s.run());
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const env = {
    DB: wrapper,
    JUDGING_SUPABASE_URL: "https://testing.supabase.co",
    JUDGING_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_testing",
    JUDGING_LEVITATE_EVENT_IDS: eventId,
    LEVITATE_ADMIN_WEB_SECRET: "testing-only-not-a-real-secret".repeat(3),
  };
  const data = {
    events: [
      {
        id: eventId,
        slug: "levitate-test",
        name: "Levitate",
        event_type: "event",
        competition_config: {},
        updated_at: rev,
      },
    ],
    blocks: [
      {
        event_id: eventId,
        block_id: "b1",
        name: "Bloque 1",
        title: "Bloque 1",
      },
    ],
    judges: [
      {
        event_id: eventId,
        judge_id: "one",
        name: "Eva Carrillo",
        role: "judge",
        assigned_block_ids: ["b1"],
        updated_at: rev,
      },
      {
        event_id: eventId,
        judge_id: "two",
        name: "Daniel Montalvo",
        role: "judge",
        assigned_block_ids: [],
        updated_at: rev,
      },
      {
        event_id: eventId,
        judge_id: "three",
        name: "Jorge Díaz",
        role: "judge",
        assigned_block_ids: [],
        updated_at: rev,
      },
    ],
    routines: [
      {
        event_id: eventId,
        routine_id: "r1",
        block_id: "b1",
        name: "Routine",
        academy: "Academy",
        genre: "Ballet",
        updated_at: rev,
      },
    ],
    criteria_templates: [
      {
        event_id: eventId,
        template_id: "ballet",
        genre: "Ballet",
        max_score: 10,
      },
    ],
    criteria: [
      {
        event_id: eventId,
        template_id: "ballet",
        criterion_id: 1,
        label: "Control",
        section: "Technique",
        max_score: 10,
      },
    ],
    scores: [
      {
        event_id: eventId,
        block_id: "b1",
        routine_id: "r1",
        judge_id: "one",
        criterion_id: 1,
        value: 0,
      },
    ],
    feedback: [],
    penalties: [],
    routine_favorite_votes: [],
    routine_favorites: [],
    special_awards: [],
    judge_activity: [],
    academy_contacts: [
      {
        event_id: eventId,
        academy_key: "academy",
        academy_name: "Academy",
        email: "academy@example.invalid",
      },
    ],
  };
  const calls = [];
  async function fetcher(input, options = {}) {
    const url = new URL(input);
    calls.push({ url, ...options });
    if (url.pathname.includes("/functions/"))
      return Response.json(
        url.pathname.endsWith("import-excel")
          ? {
              event_id: foreign,
              event_slug: JSON.parse(options.body).event_slug,
            }
          : { ok: true, codes: [] },
      );
    let rows =
      Number(url.searchParams.get("offset")) > 0
        ? []
        : data[url.pathname.split("/").pop()] || [];
    for (const key of ["id", "event_id", "judge_id", "routine_id"]) {
      const filter = url.searchParams.get(key);
      if (filter?.startsWith("eq."))
        rows = rows.filter((r) => r[key] === filter.slice(3));
    }
    return Response.json(rows);
  }
  function request(
    action,
    body,
    {
      event = eventId,
      origin = "https://levitate.mx",
      editor = false,
      judge = "one",
    } = {},
  ) {
    return new Request(
      `https://levitate.mx/api/registration/admin/judging/${editor ? "editor" : "workspace"}/${action}?${editor ? `event_id=${event}&judge_id=${judge}&routine_id=r1` : `eventId=${event}`}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers:
          body === undefined
            ? {}
            : { origin, "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
  }
  return { env, db, data, calls, fetcher, request };
}
test("all administration and editor actions reject judge, academy and unauthenticated sessions before upstream access", async (t) => {
  const f = fixture(t);
  for (const role of [null, "judge", "academy"]) {
    for (const handler of [handleJudgingAdmin, handleAdminJudgeEditor])
      await assert.rejects(
        handler(
          f.request("events"),
          f.env,
          role ? { user: { id: "x", role } } : null,
          { fetcher: f.fetcher },
        ),
        (e) => e.statusCode === 403,
      );
  }
  assert.equal(f.calls.length, 0);
});
test("admin lists only authorized Levitate events and private snapshots retain official zero scores", async (t) => {
  const f = fixture(t);
  f.data.judges[0].photo_data = "/9j/AA==";
  f.data.events.push({ id: foreign, name: "Another brand" });
  const events = await (
    await handleJudgingAdmin(f.request("events"), f.env, admin, {
      fetcher: f.fetcher,
    })
  ).json();
  assert.equal(events.events.length, 1);
  const response = await handleJudgingAdmin(
    f.request("snapshot"),
    f.env,
    admin,
    { fetcher: f.fetcher },
  );
  assert.match(response.headers.get("cache-control"), /no-store/);
  const snapshot = await response.json();
  assert.equal(snapshot.snapshot.rows[0].judges[0].total, 0);
  assert.equal(snapshot.snapshot.rows[0].judges[0].status, "complete");
  assert.equal(snapshot.judges.length, 3);
  assert.equal(snapshot.snapshot.rows[0].expectedJudges, 3);
  assert.equal(
    snapshot.judges[0].photo_data,
    "data:image/jpeg;base64,/9j/AA==",
  );
  const saved = validateAdminOperation("upsert-judge", {
    judge_id: "one",
    name: "ONE",
    assigned_block_ids: [],
    photo_data: snapshot.judges[0].photo_data,
  });
  assert.equal(saved.photo_data, "/9j/AA==");
  assert.equal(
    validateAdminOperation("upsert-judge", {
      judge_id: "one",
      name: "ONE",
      assigned_block_ids: [],
    }).photo_data,
    undefined,
  );
});
test("other brand ids fail closed even for administrators", async (t) => {
  const f = fixture(t);
  await assert.rejects(
    handleJudgingAdmin(
      f.request("snapshot", undefined, { event: foreign }),
      f.env,
      admin,
      { fetcher: f.fetcher },
    ),
    (e) => e.statusCode === 403,
  );
  assert.equal(f.calls.length, 0);
});
test("editing metadata requires a revision, whitelisted field and same-origin POST", async (t) => {
  const f = fixture(t);
  const input = {
    routine_id: "r1",
    field: "level",
    value: "Avanzado",
    expected_updated_at: rev,
  };
  await assert.rejects(
    handleJudgingAdmin(
      f.request("metadata", input, { origin: "https://evil.invalid" }),
      f.env,
      admin,
      { fetcher: f.fetcher },
    ),
    (e) => e.statusCode === 403,
  );
  for (const override of [
    { expected_updated_at: null },
    { field: "participant" },
    { routine_id: "r1&event_id=other" },
  ])
    assert.throws(() =>
      validateAdminOperation("metadata", { ...input, ...override }),
    );
  await handleJudgingAdmin(f.request("metadata", input), f.env, admin, {
    fetcher: f.fetcher,
  });
  const call = f.calls.find((c) =>
    c.url.pathname.includes("levitate-web-admin"),
  );
  assert.deepEqual(JSON.parse(call.body).allowed_event_ids, [eventId]);
  assert.equal(JSON.parse(call.body).actor_id, "admin");
  assert.equal(JSON.parse(call.body).data.field, "level");
});
test("destructive operations require exact identifiers and reserved/admin profiles remain protected", () => {
  assert.throws(() =>
    validateAdminOperation("delete-routine", {
      routine_id: "r1",
      expected_updated_at: rev,
      confirmation: "r2",
    }),
  );
  for (const judge_id of ["ati", "admin"])
    assert.throws(() =>
      validateAdminOperation("upsert-judge", {
        judge_id,
        name: "Bad",
        assigned_block_ids: [],
      }),
    );
  assert.throws(() =>
    validateAdminOperation("upsert-judge", {
      judge_id: "one",
      name: "One",
      assigned_block_ids: [],
      photo_data: "https://tracking.invalid/photo",
    }),
  );
});
test("administrator sheet editor only returns the selected judge and rejects foreign rows, blocks, methods and reserved profiles", async (t) => {
  const f = fixture(t);
  const response = await handleAdminJudgeEditor(
    f.request("bundle", undefined, { editor: true }),
    f.env,
    admin,
    { fetcher: f.fetcher },
  );
  const result = await response.json();
  assert.deepEqual(
    result.judges.map((j) => j.judge_id),
    ["one"],
  );
  await assert.rejects(
    handleAdminJudgeEditor(
      f.request("bundle", {}, { editor: true }),
      f.env,
      admin,
      { fetcher: f.fetcher },
    ),
    (e) => e.statusCode === 405,
  );
  await assert.rejects(
    handleAdminJudgeEditor(
      f.request(
        "scores",
        {
          rows: [
            {
              event_id: eventId,
              judge_id: "two",
              routine_id: "r1",
              block_id: "b1",
              criterion_id: 1,
              value: 7,
            },
          ],
        },
        { editor: true },
      ),
      f.env,
      admin,
      { fetcher: f.fetcher },
    ),
    (e) => e.statusCode === 403,
  );
  f.data.judges[0].role = "admin";
  await assert.rejects(
    handleAdminJudgeEditor(
      f.request("bundle", undefined, { editor: true }),
      f.env,
      admin,
      { fetcher: f.fetcher },
    ),
    (e) => e.statusCode === 403,
  );
});
test("administrator editing never impersonates judge activity", async (t) => {
  const f = fixture(t);
  await handleAdminJudgeEditor(
    f.request("activity", {}, { editor: true }),
    f.env,
    admin,
    { fetcher: f.fetcher },
  );
  assert.equal(f.calls.filter((c) => c.method === "POST").length, 0);
});
test("web accounts use the existing password hasher without elevating their effective role", async (t) => {
  const f = fixture(t);
  const response = await handleJudgingAdmin(
    f.request("web-account", { judge_id: "one", username: "judge-new" }),
    f.env,
    admin,
    {
      fetcher: f.fetcher,
      hashPassword: async (value) => {
        assert.equal(value.length, 36);
        return "hashed-test-only";
      },
    },
  );
  const result = await response.json();
  assert.equal(result.username, "judge-new");
  assert.equal(
    f.db
      .prepare(
        "SELECT role,is_judge FROM registration_users WHERE username='judge-new'",
      )
      .get().is_judge,
    1,
  );
  assert.equal(
    f.db
      .prepare("SELECT role FROM registration_users WHERE username='judge-new'")
      .get().role,
    "academy",
  );
  await assert.rejects(
    handleJudgingAdmin(
      f.request("web-account", { judge_id: "one", username: "judge-new" }),
      f.env,
      admin,
      { fetcher: f.fetcher, hashPassword: async () => "" },
    ),
    (e) => e.statusCode === 409,
  );
});
test("Excel import chooses a fresh slug and forces inactive/no replacement regardless of browser flags", async (t) => {
  const f = fixture(t);
  await handleJudgingAdmin(
    f.request("import", {
      name: "Test",
      filename: "test.xlsx",
      payload_base64: "eA==",
      event_slug: "existing",
      activate: true,
      force_replace: true,
    }),
    f.env,
    admin,
    { fetcher: f.fetcher },
  );
  const body = JSON.parse(f.calls[0].body);
  assert.match(body.event_slug, /^levitate-web-/);
  assert.equal(body.activate, false);
  assert.equal(body.replace_event, false);
  assert.equal(body.force_replace, false);
  assert.equal(
    f.db.prepare("SELECT event_id FROM registration_judging_events").get()
      .event_id,
    foreign,
  );
});
test("PDF exports require admin and same origin; uploads are scoped and never make Drive public", async (t) => {
  const f = fixture(t),
    stored = [];
  const dependencies = {
    fetcher: f.fetcher,
    getMediaStore: async () => ({
      put: async (...args) => {
        stored.push(args);
        return { objectKey: "google_drive:privatefile" };
      },
    }),
  };
  await assert.rejects(
    handleJudgingExports(
      f.request("export-start", { block_id: "b1" }),
      f.env,
      { user: { role: "judge" } },
      dependencies,
    ),
    (e) => e.statusCode === 403,
  );
  const batch = await (
    await handleJudgingExports(
      f.request("export-start", { block_id: "b1" }),
      f.env,
      admin,
      dependencies,
    )
  ).json();
  await assert.rejects(
    handleJudgingExports(
      f.request("export-file", {
        export_id: batch.id,
        routine_id: "other",
        pdf: "JVBERi0=",
      }),
      f.env,
      admin,
      dependencies,
    ),
  );
  await handleJudgingExports(
    f.request("export-file", {
      export_id: batch.id,
      routine_id: "r1",
      pdf: Buffer.from("%PDF-test-only").toString("base64"),
    }),
    f.env,
    admin,
    dependencies,
  );
  assert.equal(stored.length, 1);
  assert.equal(stored[0][2].httpMetadata.contentType, "application/pdf");
  assert.equal(
    f.db
      .prepare(
        "SELECT access_token_hash FROM registration_judging_export_files",
      )
      .get().access_token_hash,
    null,
  );
  await assert.rejects(
    serveJudgingExport(
      new Request("https://levitate.mx/api/judging-export?token=invalid"),
      f.env,
      dependencies,
    ),
    (e) => e.statusCode === 404,
  );
});
test("withdrawn sheet email actions reject stale clients before reading contacts or sending anything", async (t) => {
  const f = fixture(t);
  let reads = 0;
  let sends = 0;
  let storageReads = 0;
  const dependencies = {
    fetcher: async () => { reads++; throw new Error("No contact read is permitted"); },
    getMediaStore: async () => { storageReads++; throw new Error("No storage access is permitted"); },
    sendEmail: async () => { sends++; return { sent: true }; },
  };
  for (const action of ["export-recipients", "export-send"]) {
    for (const body of [{}, { export_id: "11111111-2222-4333-8444-555555555555", recipient: "academy@example.invalid", confirmation: "11111111-2222-4333-8444-555555555555" }]) {
      await assert.rejects(handleJudgingExports(f.request(action, body), f.env, admin, dependencies),
        error => error.statusCode === 410 && /correo.*deshabilitado/.test(error.message));
    }
    await assert.rejects(handleJudgingExports(f.request(action, {}), f.env, null, dependencies),
      error => error.statusCode === 401 || error.statusCode === 403);
  }
  assert.equal(reads, 0);
  assert.equal(sends, 0);
  assert.equal(storageReads, 0);
  const deliveries = await f.env.DB.prepare("SELECT count(*) total FROM registration_judging_mail_deliveries").first();
  assert.equal(deliveries.total, 0);
});
