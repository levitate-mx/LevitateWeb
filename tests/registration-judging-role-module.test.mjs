import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { handleJudgingAdmin, requireJudgingAdmin } from "../worker/judging-admin.js";
import { handleAdminJudgeEditor } from "../worker/judge-workspace.js";
import { handleJudgingExports } from "../worker/judging-admin-exports.js";

const eventId = "11111111-1111-4111-8111-111111111111";
const foreignId = "22222222-2222-4222-8222-222222222222";
const importedId = "33333333-3333-4333-8333-333333333333";
const revision = "2026-11-10T00:00:00Z";
const judgingAdmin = { user: { id: "judging-admin", name: "Admin de jueceo", role: "judging_admin" } };

function fixture(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(readFileSync(new URL("../db/registration_d1_schema.sql", import.meta.url), "utf8"));
  db.exec(`
    INSERT INTO registration_academies(id,name,contact_name,email) VALUES ('a','Domain fixture','Fixture','fixture@example.invalid');
    INSERT INTO registration_users(id,academy_id,name,username,email,role,password_hash,is_judge,is_judging_admin)
    VALUES
      ('judging-admin','a','Admin de jueceo','adminjueceo','internal@example.invalid','academy','test-only-hash',0,1),
      ('judge-user','a','Juez','judge','judge@example.invalid','academy','test-only-hash',1,0),
      ('global-mixed','a','Global secret','global-secret','global-secret@example.invalid','admin','test-only-hash',1,0),
      ('domain-mixed','a','Domain secret','domain-secret','domain-secret@example.invalid','academy','test-only-hash',1,1);
    INSERT INTO registration_judge_assignments(user_id,event_id,judge_id) VALUES
      ('judge-user','${eventId}','one'),
      ('global-mixed','${eventId}','two'),
      ('domain-mixed','${eventId}','three'),
      ('judge-user','${foreignId}','one');
  `);
  const queries = [];
  const wrapper = {
    prepare(sql) {
      queries.push(sql);
      const statement = db.prepare(sql);
      let values = [];
      return {
        bind(...input) { values = input; return this; },
        async first() { return statement.get(...values) || null; },
        async all() { return { results: statement.all(...values) }; },
        async run() { return { success: true, meta: statement.run(...values) }; },
      };
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        db.exec("COMMIT");
        return result;
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
  const env = {
    DB: wrapper,
    JUDGING_SUPABASE_URL: "https://testing.supabase.co",
    JUDGING_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
    JUDGING_LEVITATE_EVENT_IDS: eventId,
    LEVITATE_ADMIN_WEB_SECRET: "test-only-not-a-real-secret".repeat(3),
  };
  const data = {
    events: [{ id: eventId, slug: "levitate-fixture", name: "Levitate fixture", event_type: "event", competition_config: {}, updated_at: revision }],
    blocks: [{ event_id: eventId, block_id: "b1", name: "Bloque 1", title: "Bloque 1" }],
    judges: ["one", "two", "three", "fresh"].map(judge_id => ({ event_id: eventId, judge_id, name: judge_id.toUpperCase(), role: "judge", assigned_block_ids: ["b1"], updated_at: revision })),
    routines: [{ event_id: eventId, routine_id: "r1", block_id: "b1", name: "Routine", academy: "Academy", genre: "Ballet", updated_at: revision }],
    criteria_templates: [{ event_id: eventId, template_id: "ballet", genre: "Ballet", max_score: 10 }],
    criteria: [{ event_id: eventId, template_id: "ballet", criterion_id: 1, label: "Control", section: "Technique", max_score: 10 }],
    scores: ["one", "two"].map(judge_id => ({ event_id: eventId, block_id: "b1", routine_id: "r1", judge_id, criterion_id: 1, value: 0 })),
    feedback: [], penalties: [], routine_favorite_votes: [], routine_favorites: [], special_awards: [], judge_activity: [],
    access_codes: [],
    academy_contacts: [{ event_id: eventId, academy_key: "academy", academy_name: "Academy", email: "academy@example.invalid" }],
  };
  const calls = [];
  async function fetcher(input, options = {}) {
    const url = new URL(input);
    calls.push({ url, ...options });
    if (url.pathname.endsWith("/import-excel")) return Response.json({ event_id: importedId, event_slug: JSON.parse(options.body).event_slug });
    if (url.pathname.includes("/functions/")) return Response.json({ ok: true, codes: data.access_codes });
    let rows = Number(url.searchParams.get("offset")) > 0 ? [] : data[url.pathname.split("/").pop()] || [];
    for (const key of ["id", "event_id", "judge_id", "routine_id"]) {
      const filter = url.searchParams.get(key);
      if (filter?.startsWith("eq.")) rows = rows.filter(row => row[key] === filter.slice(3));
    }
    return Response.json(rows);
  }
  function request(action, body, { event = eventId, editor = false, judge = "one", origin = "https://levitate.mx" } = {}) {
    return new Request(`https://levitate.mx/api/registration/admin/judging/${editor ? "editor" : "workspace"}/${action}?${editor ? `event_id=${event}&judge_id=${judge}&routine_id=r1` : `eventId=${event}`}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { origin, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  return { db, env, data, calls, queries, fetcher, request };
}

test("only global and judging administrators enter judging handlers before any upstream or database access", async t => {
  for (const role of ["admin", "judging_admin"]) assert.doesNotThrow(() => requireJudgingAdmin({ user: { role } }));
  const f = fixture(t);
  for (const role of [null, "judge", "academy", "scanner", "judging-admin", "ADMIN"]) {
    const session = role ? { user: { id: "untrusted", role } } : null;
    for (const handler of [handleJudgingAdmin, handleAdminJudgeEditor, handleJudgingExports]) {
      await assert.rejects(handler(f.request("events"), f.env, session, { fetcher: f.fetcher }), error => error.statusCode === 403);
    }
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.queries.length, 0);
});

test("the dedicated role reads the Levitate catalogue and snapshot without exposing privileged website accounts", async t => {
  const f = fixture(t);
  f.data.events.push({ id: foreignId, name: "Another brand", event_type: "event" });
  const events = await (await handleJudgingAdmin(f.request("events"), f.env, judgingAdmin, { fetcher: f.fetcher })).json();
  assert.equal(events.user.role, "judging_admin");
  assert.deepEqual(events.events.map(event => event.id), [eventId]);
  const response = await handleJudgingAdmin(f.request("snapshot"), f.env, judgingAdmin, { fetcher: f.fetcher });
  assert.match(response.headers.get("cache-control"), /no-store/);
  const snapshot = await response.json();
  assert.deepEqual(snapshot.accounts.map(account => account.user_id), ["judge-user"]);
  assert.doesNotMatch(JSON.stringify(snapshot), /global-secret|domain-secret|password_hash|test-only-hash/);
});

test("the dedicated role can edit a selected ordinary judge sheet but not read another judge through that editor", async t => {
  const f = fixture(t);
  const session = await (await handleAdminJudgeEditor(f.request("session", undefined, { editor: true }), f.env, judgingAdmin, { fetcher: f.fetcher })).json();
  assert.equal(session.assignments.length, 1);
  assert.equal(session.assignments[0].judge.judge_id, "one");
  const bundle = await (await handleAdminJudgeEditor(f.request("bundle", undefined, { editor: true }), f.env, judgingAdmin, { fetcher: f.fetcher })).json();
  assert.equal(bundle.scores.length, 1);
  assert.equal(bundle.scores[0].judge_id, "one");
});

test("native administrator access codes stay out of the dedicated judging account", async t => {
  const f = fixture(t);
  f.data.judges.push(
    { event_id: eventId, judge_id: "native-admin", name: "Native admin", role: "admin" },
    { event_id: eventId, judge_id: "ati", name: "Reserved profile", role: "judge" },
  );
  f.data.access_codes.push(
    { judge_id: "one", name: "One", role: "judge", access_code: "ordinary-code" },
    { judge_id: "native-admin", role: "admin", access_code: "native-admin-secret" },
    { judge_id: "ati", role: "judge", access_code: "reserved-profile-secret" },
    { judge_id: "not-in-this-event", role: "judge", access_code: "unknown-secret" },
    { judge_id: "two", role: "admin", access_code: "mismatched-role-secret" },
    { judge_id: "three", access_code: "unverified-role-secret" },
  );
  const response = await handleJudgingAdmin(f.request("access-codes"), f.env, judgingAdmin, { fetcher: f.fetcher });
  assert.match(response.headers.get("cache-control"), /no-store/);
  const result = await response.json();
  assert.deepEqual(result.codes, [f.data.access_codes[0]]);
  assert.doesNotMatch(JSON.stringify(result), /secret/);
  const global = await (await handleJudgingAdmin(f.request("access-codes"), f.env, { user: { id: "global-admin", role: "admin" } }, { fetcher: f.fetcher })).json();
  assert.deepEqual(global.codes, f.data.access_codes);
});

test("other-brand events are rejected for all dedicated judging entry points before any Core request", async t => {
  const f = fixture(t);
  for (const [handler, action, body, editor] of [
    [handleJudgingAdmin, "snapshot", undefined, false],
    [handleAdminJudgeEditor, "session", undefined, true],
    [handleJudgingExports, "export-start", { block_id: "b1" }, false],
  ]) {
    await assert.rejects(handler(f.request(action, body, { event: foreignId, editor }), f.env, judgingAdmin, { fetcher: f.fetcher }), error => error.statusCode === 403);
  }
  assert.equal(f.calls.length, 0);
});

test("programme and block changes stay exclusive to the global administrator before reading input or contacting data sources", async t => {
  const f = fixture(t);
  for (const action of ["import", "metadata", "move-routine", "delete-routine", "activate", "archive", "restore", "configuration", "unknown-future-action"]) {
    const request = new Request(`https://levitate.mx/api/registration/admin/judging/workspace/${action}?eventId=${eventId}`, { method: "POST", headers: { origin: "https://levitate.mx", "content-type": "application/json" }, body: "invalid json" });
    await assert.rejects(handleJudgingAdmin(request, f.env, judgingAdmin, { fetcher: f.fetcher }), error => error.statusCode === 403 && error.code === "judging_program_forbidden");
    assert.equal(request.bodyUsed, false);
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.queries.length, 0);
});

test("judge access toggles cannot target privileged accounts even when legacy judge flags are present", async t => {
  const f = fixture(t);
  for (const [user_id, judge_id] of [["global-mixed", "two"], ["domain-mixed", "three"]]) {
    await assert.rejects(handleJudgingAdmin(f.request("web-account", { user_id, judge_id, enabled: false }), f.env, judgingAdmin, { fetcher: f.fetcher }), error => error.statusCode === 404);
    assert.equal(f.db.prepare("SELECT enabled FROM registration_judge_assignments WHERE user_id=? AND event_id=?").get(user_id, eventId).enabled, 1);
  }
  await handleJudgingAdmin(f.request("web-account", { user_id: "judge-user", judge_id: "one", enabled: false }), f.env, judgingAdmin, { fetcher: f.fetcher });
  assert.equal(f.db.prepare("SELECT enabled FROM registration_judge_assignments WHERE user_id='judge-user' AND event_id=?").get(eventId).enabled, 0);
  assert.equal(f.db.prepare("SELECT enabled FROM registration_judge_assignments WHERE user_id='judge-user' AND event_id=?").get(foreignId).enabled, 1);
});

test("a judging administrator can only create ordinary judge accounts despite attempted role injection", async t => {
  const f = fixture(t);
  await handleJudgingAdmin(f.request("web-account", { judge_id: "fresh", username: "ordinary-new-judge", role: "admin", is_judging_admin: 1 }), f.env, judgingAdmin, { fetcher: f.fetcher, hashPassword: async () => "fixture-only-hash" });
  const user = f.db.prepare("SELECT role,is_judge,is_judging_admin FROM registration_users WHERE username='ordinary-new-judge'").get();
  assert.deepEqual({ ...user }, { role: "academy", is_judge: 1, is_judging_admin: 0 });
  assert.equal(f.db.prepare("SELECT COUNT(*) total FROM registration_users WHERE is_judging_admin=1").get().total, 2);
});

test("dedicated administrative mutations retain server-selected actor and the exact Levitate allowlist", async t => {
  const f = fixture(t);
  await handleJudgingAdmin(f.request("special-award", { block_id: "b1", award: "award_1", manual_value: "Award fixture", actor_id: "global-mixed", allowed_event_ids: [foreignId] }), f.env, judgingAdmin, { fetcher: f.fetcher });
  const body = JSON.parse(f.calls.find(call => call.url.pathname.endsWith("/levitate-web-admin")).body);
  assert.equal(body.actor_id, judgingAdmin.user.id);
  assert.deepEqual(body.allowed_event_ids, [eventId]);
  assert.deepEqual(Object.keys(body.data).sort(), ["award", "block_id", "manual_value"]);
});

test("global administrator Excel imports retain a fresh inactive programme instead of replacing one", async t => {
  const f = fixture(t);
  const globalAdmin = { user: { id: "global-mixed", role: "admin" } };
  await handleJudgingAdmin(f.request("import", { name: "Programme", filename: "programme.xlsx", payload_base64: "eA==", event_slug: "existing", activate: true, replace_event: true, force_replace: true }), f.env, globalAdmin, { fetcher: f.fetcher });
  const body = JSON.parse(f.calls[0].body);
  assert.match(body.event_slug, /^levitate-web-/);
  assert.equal(body.activate, false);
  assert.equal(body.replace_event, false);
  assert.equal(body.force_replace, false);
  assert.equal(f.db.prepare("SELECT created_by FROM registration_judging_events WHERE event_id=?").get(importedId).created_by, globalAdmin.user.id);
});

test("the dedicated role exports only its selected block to private judging storage without sending mail", async t => {
  const f = fixture(t);
  const puts = [];
  let sent = 0;
  const dependencies = {
    fetcher: f.fetcher,
    getMediaStore: async options => {
      assert.equal(options.create, true);
      return { put: async (key, bytes) => { puts.push({ key, bytes }); return { objectKey: key }; } };
    },
    sendEmail: async () => { sent++; throw new Error("No real mail in this fixture"); },
  };
  const batch = await (await handleJudgingExports(f.request("export-start", { block_id: "b1", created_by: "global-mixed" }), f.env, judgingAdmin, dependencies)).json();
  assert.equal(f.db.prepare("SELECT created_by FROM registration_judging_exports WHERE id=?").get(batch.id).created_by, judgingAdmin.user.id);
  await handleJudgingExports(f.request("export-file", { export_id: batch.id, routine_id: "r1", pdf: Buffer.from("%PDF-1.4\n%%EOF").toString("base64") }), f.env, judgingAdmin, dependencies);
  assert.equal(puts.length, 1);
  assert.ok(puts[0].key.startsWith(`judging/${batch.id}/`));
  await assert.rejects(handleJudgingExports(f.request("export-file", { export_id: batch.id, routine_id: "another-routine", pdf: "JVBERi0=" }), f.env, judgingAdmin, dependencies), error => error.statusCode === 400);
  assert.equal(puts.length, 1);
  assert.equal(sent, 0);
});
