import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../worker/index.js";

const eventId = "11111111-1111-4111-8111-111111111111";
const foreignId = "22222222-2222-4222-8222-222222222222";
const curp = "TEST001231MDFXXX01";
const password = "test-only-role-password";
const salt = Buffer.alloc(16, 39);
const passwordHash = `pbkdf2_sha256$100000$${salt.toString("base64url")}$${pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("base64url")}`;
const previewPath = "/api/registration/admin/releve-voting/preview";

test('the report page runs authentication before SPA asset handling in production', () => {
  const configuration = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  for (const route of ['/jueceo/dictamen', '/jueceo/dictamen/']) {
    assert.ok(configuration.assets.run_worker_first.includes(route), route);
  }
});

function fixture(t) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL("../db/registration_d1_schema.sql", import.meta.url), "utf8"));
  sqlite.exec("INSERT INTO registration_academies(id,name,contact_name,email) VALUES ('staff','Private academy fixture','Fixture','staff@example.invalid')");
  for (const [username, role, isJudge, isJudgingAdmin, isViewer = 0] of [
    ["adminjueceo", "academy", 0, 1],
    ["academy", "academy", 0, 0],
    ["judge", "academy", 1, 0],
    ["globaladmin", "admin", 0, 0],
    ["mixed", "admin", 1, 1],
    ["viewer", "academy", 0, 0, 1],
  ]) {
    sqlite.prepare(`INSERT INTO registration_users(id,academy_id,name,username,email,role,password_hash,email_confirmed_at,is_judge,is_judging_admin,is_judging_viewer)
      VALUES (?,'staff',?,?,?,?,?,datetime('now'),?,?,?)`).run(username, username, username, `${username}@users.levitate.invalid`, role, passwordHash, isJudge, isJudgingAdmin, isViewer);
  }
  sqlite.prepare(`INSERT INTO registration_participants(id,academy_id,full_name,curp,division,shirt_size)
    VALUES ('private-participant','staff','Sensitive staff participant fixture',?,'junior','s')`).run(curp);
  sqlite.prepare(`INSERT INTO registration_inscription_orders(id,curp,participant_name,academy_id,academy_name,venue,reference,amount)
    VALUES ('private-order',?,'Sensitive staff participant fixture','staff','Private academy fixture','edomex','TEST-PRIVATE-ORDER',1750)`).run(curp);

  const queries = [];
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      const bound = {
        bind(...input) { values = input; return bound; },
        async first() { queries.push(sql); return statement.get(...values) || null; },
        async all() { queries.push(sql); return { results: statement.all(...values) }; },
        async run() { queries.push(sql); return { success: true, meta: statement.run(...values) }; },
      };
      return bound;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  sqlite.prepare('INSERT INTO registration_judging_report_access(user_id,event_id) VALUES(?,?)').run('viewer', eventId);
  const externalCalls = [];
  let coreData = {};
  let allowCore = false;
  t.mock.method(globalThis, "fetch", async (input, options = {}) => {
    const url = new URL(input);
    externalCalls.push({ url, ...options });
    if (!allowCore || url.origin !== "https://testing.supabase.co" || options.method !== "GET") {
      throw new Error("External network is forbidden in this fixture");
    }
    let rows = url.pathname === "/rest/v1/events" && Number(url.searchParams.get("offset")) === 0
      ? [{ id: eventId, name: "Levitate fixture", event_type: "event", competition_config: {} }]
      : [];
    const table = url.pathname.split('/').at(-1);
    if (table !== 'events' && Number(url.searchParams.get('offset')) === 0) rows = coreData[table] || [];
    const idFilter = url.searchParams.get("id");
    if (idFilter?.startsWith("eq.")) rows = rows.filter(row => row.id === idFilter.slice(3));
    return Response.json(rows);
  });
  const assetCalls = [];
  const env = {
    DB: db,
    JUDGING_SUPABASE_URL: "https://testing.supabase.co",
    JUDGING_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
    JUDGING_LEVITATE_EVENT_IDS: eventId,
    PASSPORT_ADMIN_TOKEN: "test-only-unshared-passport-token",
    GOOGLE_DRIVE_OAUTH_CLIENT_ID: "test-only-client",
    GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: "test-only-secret",
    GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "test-only-refresh",
    ASSETS: { fetch: async request => { assetCalls.push(request.url); return new Response("authenticated judging interface"); } },
  };
  async function request(path, { cookie, body, method = body === undefined ? "GET" : "POST", headers = {} } = {}) {
    return worker.fetch(new Request(`https://levitate.mx${path}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { origin: "https://levitate.mx", "content-type": "application/json" }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), env);
  }
  async function login(username = "adminjueceo", extra = {}) {
    const response = await request("/api/registration/auth/login", { body: { username, password, ...extra } });
    assert.equal(response.status, 200, username);
    return { response, state: await response.json(), cookie: response.headers.get("set-cookie").split(";")[0] };
  }
  function assertIdentityOnly() {
    for (const sql of queries) {
      assert.ok(/\bFROM registration_sessions\b|\bUPDATE registration_sessions\b/i.test(sql), `Unauthorized data access: ${sql}`);
    }
    assert.equal(externalCalls.length, 0, "No external service may be contacted before authorization");
  }
  return { sqlite, env, queries, externalCalls, assetCalls, request, login, assertIdentityOnly, allowCore() { allowCore = true; }, setCoreRows(rows) { coreData = rows; } };
}

test("username login and me expose the effective judging role while preserving the legacy academy role", async t => {
  const f = fixture(t);
  const { response, state, cookie } = await f.login();
  assert.equal(state.user.username, "adminjueceo");
  assert.equal(state.user.role, "judging_admin");
  assert.match(response.headers.get("set-cookie"), /levitate_registration_session=.*HttpOnly.*SameSite=Lax.*Secure/);
  assert.deepEqual({ ...f.sqlite.prepare("SELECT role,is_judge,is_judging_admin FROM registration_users WHERE id='adminjueceo'").get() }, { role: "academy", is_judge: 0, is_judging_admin: 1 });
  const me = await f.request("/api/registration/me", { cookie });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.role, "judging_admin");
  assert.equal(f.externalCalls.length, 0);
});

test("revoking the D1 flag immediately removes privileges from an existing session", async t => {
  const f = fixture(t);
  const { cookie } = await f.login();
  assert.equal((await f.request(previewPath, { cookie })).status, 200);
  f.sqlite.prepare("UPDATE registration_users SET is_judging_admin=0 WHERE id='adminjueceo'").run();
  const me = await f.request("/api/registration/me", { cookie });
  assert.equal((await me.json()).user.role, "academy");
  const denied = await f.request(previewPath, { cookie });
  assert.equal(denied.status, 403);
  const page = await f.request("/jueceo/admin", { cookie });
  assert.equal(page.status, 302);
  assert.equal(page.headers.get("location"), "/login");
  assert.equal(f.assetCalls.length, 0);
});

test("judge flags take precedence over both judging-admin flags and the legacy admin role", async t => {
  const f = fixture(t);
  const { cookie, state } = await f.login("mixed");
  assert.equal(state.user.role, "judge");
  assert.equal((await (await f.request("/api/registration/me", { cookie })).json()).user.role, "judge");
  assert.equal((await f.request(previewPath, { cookie })).status, 403);
  f.sqlite.prepare("UPDATE registration_users SET is_judging_admin=0 WHERE id='mixed'").run();
  assert.equal((await (await f.request("/api/registration/me", { cookie })).json()).user.role, "judge");
  assert.equal((await f.request("/api/registration/admin/program", { cookie })).status, 403);
  assert.equal(f.externalCalls.length, 0);
});

test("password recovery for the internal no-email account creates no token and sends nothing", async t => {
  const f = fixture(t);
  for (const identifier of ["ADMINJUECEO", "adminjueceo@users.levitate.invalid"]) {
    const response = await f.request("/api/registration/auth/forgot-password", { body: { identifier } });
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(await response.json()).sort(), ["message", "ok"]);
  }
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) total FROM registration_password_reset_tokens").get().total, 0);
  assert.equal(f.sqlite.prepare("SELECT password_hash FROM registration_users WHERE id='adminjueceo'").get().password_hash, passwordHash);
  assert.equal(f.externalCalls.length, 0);
});

test("the Releve preview authorizes only global or judging admins and never publishes voting", async t => {
  const f = fixture(t);
  for (const [username, status] of [[null, 401], ["academy", 403], ["judge", 403], ["adminjueceo", 200], ["globaladmin", 200]]) {
    const cookie = username ? (await f.login(username)).cookie : undefined;
    f.queries.length = 0;
    const response = await f.request(previewPath, { cookie });
    assert.equal(response.status, status, username || "anonymous");
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("vary"), "Cookie");
    const body = await response.json();
    if (status === 200) {
      assert.equal(body.mode, "preview");
      assert.equal(body.publicVotingEnabled, false);
      assert.ok(body.candidates.every(candidate => candidate.id.startsWith("preview-")));
    }
    f.assertIdentityOnly();
  }
  const { cookie } = await f.login();
  const forbiddenWrite = await f.request(previewPath, { cookie, body: { candidateId: "preview-motion-1" } });
  assert.equal(forbiddenWrite.status, 405);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) total FROM registration_participants").get().total, 1);
});

test("judging pages enforce private HTML access and send each role to its correct entry point", async t => {
  const f = fixture(t);
  for (const username of ["adminjueceo", "globaladmin"]) {
    const { cookie } = await f.login(username);
    for (const path of ["/jueceo/admin", "/jueceo/admin/", "/jueceo/app/?mode=admin-editor"]) {
      const page = await f.request(path, { cookie });
      assert.equal(page.status, 200, `${username} ${path}`);
      assert.equal(await page.text(), "authenticated judging interface");
      assert.match(page.headers.get("cache-control"), /no-store/);
      assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
    }
    for (const path of ["/jueceo", "/jueceo/", "/jueceo/app", "/jueceo/app/"]) {
      const page = await f.request(path, { cookie });
      assert.equal(page.status, 302);
      assert.equal(page.headers.get("location"), "/jueceo/admin");
    }
  }
  for (const username of [null, "academy", "judge"]) {
    const cookie = username ? (await f.login(username)).cookie : undefined;
    const assetsBefore = f.assetCalls.length;
    for (const path of ["/jueceo/admin", "/jueceo/app/?mode=admin-editor"]) {
      const page = await f.request(path, { cookie });
      assert.equal(page.status, 302, `${username} ${path}`);
      assert.equal(page.headers.get("location"), "/login");
    }
    assert.equal(f.assetCalls.length, assetsBefore);
    const entry = await f.request("/jueceo", { cookie });
    assert.equal(entry.status, 302);
    assert.equal(entry.headers.get("location"), username === "judge" ? "/jueceo/app/" : "/login");
  }
  assert.equal(f.externalCalls.length, 0);
});

test("the unlisted Relevé page and its former judging links work without a session for every role", async t => {
  const f = fixture(t);
  for (const username of [null, "academy", "judge", "adminjueceo", "globaladmin"]) {
    const cookie = username ? (await f.login(username)).cookie : undefined;
    const changesBefore = f.sqlite.prepare("SELECT total_changes() total").get().total;
    f.queries.length = 0;
    for (const [path, destination] of [
      ["/jueceo/releve", "/votacion-releve"],
      ["/jueceo/releve/", "/votacion-releve"],
      ["/jueceo/releve?from=shared%20link&mode=admin-editor", "/votacion-releve?from=shared%20link&mode=admin-editor"],
    ]) {
      const assetsBefore = f.assetCalls.length;
      const page = await f.request(path, { cookie });
      assert.equal(page.status, 302, `${username || "anonymous"} ${path}`);
      assert.equal(page.headers.get("location"), destination);
      assert.match(page.headers.get("cache-control"), /no-store/);
      assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
      assert.equal(page.headers.get("set-cookie"), null);
      assert.equal(f.assetCalls.length, assetsBefore, "the old URL redirects before serving assets");
    }
    for (const path of ["/votacion-releve", "/votacion-releve/", "/votacion-releve?mode=admin-editor"]) {
      const assetsBefore = f.assetCalls.length;
      const page = await f.request(path, { cookie });
      assert.equal(page.status, 200, `${username || "anonymous"} ${path}`);
      assert.equal(await page.text(), "authenticated judging interface");
      assert.equal(page.headers.get("location"), null);
      assert.match(page.headers.get("cache-control"), /no-store/);
      assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
      assert.equal(page.headers.get("set-cookie"), null);
      assert.equal(f.assetCalls.length, assetsBefore + 1);
    }
    assert.equal(f.queries.length, 0, "reading the demo must not query sessions or registration data");
    assert.equal(f.sqlite.prepare("SELECT total_changes() total").get().total, changesBefore,
      "reading the demo must not change registrations, votes or session timestamps");
  }
  assert.equal(f.externalCalls.length, 0);
});

test("anonymous Relevé links remain available when registration storage is unavailable", async () => {
  let assetCalls = 0;
  const env = {
    get DB() { throw new Error("the public demonstration must not access registration storage"); },
    ASSETS: { fetch: async () => { assetCalls++; return new Response("public Relevé demo"); } },
  };
  const legacy = await worker.fetch(new Request("https://levitate.mx/jueceo/releve/"), env);
  assert.equal(legacy.status, 302);
  assert.equal(legacy.headers.get("location"), "/votacion-releve");
  assert.equal(assetCalls, 0);
  const page = await worker.fetch(new Request("https://levitate.mx/votacion-releve"), env);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "public Relevé demo");
  assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(assetCalls, 1);
});

test("the dedicated account cannot read or change global registration, payment, scanning or Drive administration", async t => {
  const f = fixture(t);
  const { cookie } = await f.login();
  f.queries.length = 0;
  for (const [path, body, method] of [
    ["/api/registration/admin/payment-orders"],
    ["/api/registration/admin/payment-order?id=private-order&orderType=registration"],
    ["/api/registration/admin/inscription-orders"],
    ["/api/registration/admin/participants"],
    ["/api/registration/admin/program"],
    ["/api/registration/admin/workshops"],
    ["/api/registration/admin/media-drive/connection"],
    ["/api/registration/admin/media-drive/folder", { folderId: "test-folder" }],
    ["/api/registration/admin/participant-portal?storage=1"],
    ["/api/registration/admin/participant-portal?judging=1&eventId=edomex-2026-otono"],
    ["/api/registration/admin/participant-portal", { action: "judging.source.save" }],
    ["/api/registration/admin/attendance"],
    ["/api/registration/admin/ticket-sales-summary"],
    ["/api/registration/admin/scanner/pairing-code", {}],
    ["/api/registration/admin/ticket/scan", {}],
    ["/api/registration/admin/inscription-order/status", { id: "private-order", status: "paid" }],
    ["/api/registration/admin/delete", { entityType: "participant", id: "private-participant" }, "DELETE"],
    ["/api/registration/admin/pending-report.pdf", {}],
  ]) {
    const response = await f.request(path, { cookie, ...(body === undefined ? {} : { body }), ...(method ? { method } : {}) });
    assert.equal(response.status, 403, path);
    assert.doesNotMatch(await response.text(), /Sensitive staff participant|TEST-PRIVATE-ORDER/);
  }
  f.assertIdentityOnly();
  assert.equal(f.sqlite.prepare("SELECT status FROM registration_inscription_orders WHERE id='private-order'").get().status, "pending_payment");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) total FROM registration_participants").get().total, 1);
});

test("the scoped role cannot mutate academy data or use the staff academy as a CURP lookup grant", async t => {
  const f = fixture(t);
  const { cookie } = await f.login();
  f.queries.length = 0;
  for (const [path, body] of [
    ["/api/registration/bootstrap"],
    ["/api/registration/participants"],
    ["/api/registration/choreographers"],
    ["/api/registration/dances"],
    ["/api/registration/participants", { fullName: "Injected", curp }],
    ["/api/registration/choreographers", { fullName: "Injected" }],
    ["/api/registration/dances", { title: "Injected" }],
    ["/api/registration/music", { danceId: "private-dance" }],
    ["/api/registration/inscription/lookup", { curp }],
    ["/api/registration/inscription/payment-lookup", { curp }],
  ]) {
    const response = await f.request(path, { cookie, ...(body === undefined ? {} : { body }) });
    assert.equal(response.status, 403, path);
    assert.doesNotMatch(await response.text(), /Sensitive staff participant|TEST-PRIVATE-ORDER/);
  }
  f.assertIdentityOnly();
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) total FROM registration_participants").get().total, 1);
});

test("judging login never grants the independent passport token or participant session", async t => {
  const f = fixture(t);
  const { cookie } = await f.login();
  f.queries.length = 0;
  for (const path of ["/api/passport/admin/summary", "/api/passport/admin/export.csv", "/api/participant/me"]) {
    const response = await f.request(path, { cookie });
    assert.equal(response.status, 401, path);
    assert.doesNotMatch(await response.text(), /Sensitive staff participant|TEST-PRIVATE-ORDER/);
  }
  f.assertIdentityOnly();
});

test("browser-provided roles, flags, bearer headers and query tokens cannot elevate a login or bypass guards", async t => {
  const f = fixture(t);
  const { cookie, state } = await f.login("academy", { role: "admin", is_judge: 0, is_judging_admin: 1, user: { role: "judging_admin" } });
  assert.equal(state.user.role, "academy");
  f.queries.length = 0;
  const injectedHeaders = { authorization: "Bearer test-only-forged-token", "x-admin-token": "test-only-forged-token", "x-user-role": "admin" };
  const suffix = "?role=admin&is_judging_admin=1&adminToken=test-only-forged-token";
  assert.equal((await f.request(`${previewPath}${suffix}`, { headers: injectedHeaders })).status, 401);
  assert.equal((await f.request(`${previewPath}${suffix}`, { cookie, headers: injectedHeaders })).status, 403);
  assert.equal((await f.request(`/api/registration/admin/program${suffix}`, { cookie, headers: injectedHeaders })).status, 403);
  f.assertIdentityOnly();
});

test("legacy judging read APIs accept the dedicated role and reject unauthorized roles before Core access", async t => {
  const f = fixture(t);
  for (const username of [null, "academy", "judge"]) {
    const cookie = username ? (await f.login(username)).cookie : undefined;
    f.queries.length = 0;
    for (const path of ["/api/registration/admin/judging/events", `/api/registration/admin/judging/scores?eventId=${eventId}`]) {
      const response = await f.request(path, { cookie });
      assert.equal(response.status, username ? 403 : 401, path);
      assert.match(response.headers.get("cache-control"), /no-store/);
    }
    f.assertIdentityOnly();
  }
  const { cookie } = await f.login();
  f.allowCore();
  const events = await f.request("/api/registration/admin/judging/events", { cookie });
  assert.equal(events.status, 200);
  assert.deepEqual((await events.json()).events.map(event => event.id), [eventId]);
  const scores = await f.request(`/api/registration/admin/judging/scores?eventId=${eventId}`, { cookie });
  assert.equal(scores.status, 200);
  const callsBefore = f.externalCalls.length;
  const denied = await f.request(`/api/registration/admin/judging/scores?eventId=${foreignId}`, { cookie });
  assert.equal(denied.status, 404);
  assert.equal(f.externalCalls.length, callsBefore);
});

test("logout expires and invalidates only the selected session", async t => {
  const f = fixture(t);
  const { cookie } = await f.login();
  const other = await f.login("judge");
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) total FROM registration_sessions").get().total, 2);
  const response = await f.request("/api/registration/auth/logout", { cookie, body: {} });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /levitate_registration_session=;.*Max-Age=0/);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) total FROM registration_sessions").get().total, 1);
  assert.equal((await f.request("/api/registration/me", { cookie })).status, 401);
  assert.equal((await f.request(previewPath, { cookie })).status, 401);
  assert.equal((await (await f.request("/api/registration/me", { cookie: other.cookie })).json()).user.role, "judge");
  assert.equal(f.externalCalls.length, 0);
});

test('a report viewer signs in with its own role and reads only its assigned final report', async t => {
  const f = fixture(t); f.allowCore();
  const { state, cookie } = await f.login('viewer');
  assert.equal(state.user.role, 'judging_viewer');
  assert.deepEqual({ ...f.sqlite.prepare("SELECT role,is_judge,is_judging_admin,is_judging_viewer FROM registration_users WHERE id='viewer'").get() },
    { role: 'academy', is_judge: 0, is_judging_admin: 0, is_judging_viewer: 1 });
  const events = await f.request('/api/registration/judging-report/events', { cookie });
  assert.equal(events.status, 200); assert.match(events.headers.get('cache-control'), /no-store/);
  assert.deepEqual((await events.json()).events.map(event => event.id), [eventId]);
  f.setCoreRows({
    blocks: [{ event_id: eventId, block_id: 'b1', name: 'Block 1' }],
    routines: [{ event_id: eventId, routine_id: 'r1', name: 'Routine', genre: 'TELA', block_id: 'b1', participant: 'PRIVATE PARTICIPANT' }],
    judges: ['DANIEL HERRERA', 'RENATA PINAL', 'ANA KAREN ROJAS'].map((name, index) => ({ event_id: eventId, judge_id: 'j' + (index + 1), name, role: 'judge', assigned_block_ids: ['b1'] })),
    criteria_templates: [{ event_id: eventId, template_id: 'test', genre: 'TELA', max_score: 5 }],
    criteria: [{ event_id: eventId, template_id: 'test', criterion_id: 1, label: 'PRIVATE CRITERION', max_score: 5 }],
    scores: ['j1', 'j2', 'j3'].map(judge_id => ({ event_id: eventId, routine_id: 'r1', judge_id, criterion_id: 1, value: 5 })),
    feedback: [{ event_id: eventId, routine_id: 'r1', judge_id: 'j1', body: 'PRIVATE FEEDBACK' }],
  });
  const report = await f.request('/api/registration/judging-report/snapshot?eventId=' + eventId, { cookie });
  assert.equal(report.status, 200);
  const payload = await report.json();
  assert.equal(payload.event.id, eventId); assert.equal(payload.snapshot.rows[0].name, 'Routine');
  assert.deepEqual(payload.snapshot.rows[0].judges, []);
  const standing = payload.snapshot.report.blocks[0].sections[0].categories[0].rows[0];
  assert.equal(standing.score, 15, 'the report viewer receives the three actual 5-point totals');
  assert.equal(standing.maximumScore, 15, 'the routine exposes its own total maximum without exposing judge sheets');
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE|password|access_code|criterion_id|curp/i);
});

test('report viewers cannot read or modify other private sections even with direct URLs', async t => {
  const f = fixture(t), { cookie } = await f.login('viewer');
  const paths = ['/api/registration/admin/judging/workspace/events', '/api/registration/admin/judging/workspace/snapshot?eventId=' + eventId,
    '/api/registration/admin/judging/editor/session', '/api/registration/judge/session', '/api/registration/judge/scores',
    '/api/registration/admin/releve-voting', '/api/registration/admin/releve-voting/preview', '/api/registration/admin/participants',
    '/api/registration/admin/program', '/api/registration/admin/payment-orders', '/api/registration/admin/payment-order',
    '/api/registration/admin/media-drive/connection', '/api/registration/admin/participant-portal',
    '/api/registration/participants', '/api/registration/dances', '/api/registration/bootstrap'];
  for (const path of paths) for (const method of ['GET', 'POST']) {
    f.queries.length = 0;
    const response = await f.request(path, { cookie, method, ...(method === 'POST' ? { body: {} } : {}) });
    assert.ok((method === 'POST' ? [403, 405] : [403]).includes(response.status), method + ' ' + path + ': ' + response.status);
    f.assertIdentityOnly();
  }
  assert.equal((await f.request('/api/registration/judging-report/snapshot?eventId=' + eventId, { cookie, body: {} })).status, 405);
  for (const path of ['/jueceo', '/jueceo/admin', '/jueceo/app/?mode=admin-editor']) {
    const page = await f.request(path, { cookie });
    assert.equal(page.status, 302); assert.equal(page.headers.get('location'), '/jueceo/dictamen');
  }
  const page = await f.request('/jueceo/dictamen', { cookie });
  assert.equal(page.status, 200); assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('viewer grants and role revocation take effect immediately; unauthorized events never reach Core', async t => {
  const f = fixture(t), { cookie } = await f.login('viewer');
  for (const username of [null, 'academy', 'judge']) {
    const otherCookie = username ? (await f.login(username)).cookie : undefined;
    assert.equal((await f.request('/api/registration/judging-report/events', { cookie: otherCookie })).status, username ? 403 : 401);
  }
  assert.equal((await f.request('/api/registration/judging-report/snapshot?eventId=' + foreignId, { cookie })).status, 403);
  assert.equal(f.externalCalls.length, 0);
  f.sqlite.exec("UPDATE registration_judging_report_access SET enabled=0 WHERE user_id='viewer'");
  assert.equal((await f.request('/api/registration/judging-report/snapshot?eventId=' + eventId, { cookie })).status, 403);
  assert.equal(f.externalCalls.length, 0);
  f.sqlite.exec("UPDATE registration_users SET is_judging_viewer=0 WHERE id='viewer'");
  assert.equal((await (await f.request('/api/registration/me', { cookie })).json()).user.role, 'academy');
  assert.equal((await f.request('/api/registration/judging-report/events', { cookie })).status, 403);
});
