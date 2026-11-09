import assert from "node:assert/strict";
import test from "node:test";
import { getJudgingRoutineDirectory } from "../worker/judging-reader.js";

const eventId = "f3c2e100-1234-4567-8abc-123456789abc";
const foreignId = "f3c2e100-1234-4567-8abc-987654321abc";
const env = { JUDGING_SUPABASE_URL: "https://judgingfixture.supabase.co", JUDGING_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_test_key", JUDGING_LEVITATE_EVENT_IDS: eventId };
const event = (overrides = {}) => ({ id: eventId, name: "Levitate Noviembre", event_type: "event", ...overrides });
const routine = (id = "routine-1", overrides = {}) => ({ event_id: eventId, routine_id: id, name: "Vuelo", academy: "Academia Uno", ...overrides });
function upstream({ events = [event()], routines = [routine()], cap = 1000 } = {}) {
  const calls = [];
  return { calls, fetcher: async (input, options) => {
    const url = new URL(input), table = url.pathname.split("/").at(-1);
    calls.push({ url, options });
    assert.equal(url.origin, env.JUDGING_SUPABASE_URL); assert.equal(options.method, "GET");
    assert.equal(options.redirect, "manual"); assert.equal(options.body, undefined);
    assert.ok(options.signal instanceof AbortSignal); assert.equal(options.headers.apikey, env.JUDGING_SUPABASE_PUBLISHABLE_KEY);
    assert.ok(["events", "routines"].includes(table), "the directory must never read scoring tables");
    assert.equal(url.searchParams.get("select"), table === "events" ? "id,name,event_type" : "event_id,routine_id,name,academy");
    assert.equal(url.searchParams.get("limit"), "1000");
    if (table === "events") {
      assert.equal(url.searchParams.get("id"), `eq.${eventId}`);
      assert.equal(url.searchParams.get("or"), "(event_type.is.null,event_type.eq.event)");
      assert.equal(url.searchParams.get("order"), "id.asc");
    } else {
      assert.equal(url.searchParams.get("event_id"), `eq.${eventId}`);
      assert.equal(url.searchParams.get("order"), "sort_order.asc,routine_id.asc");
    }
    const rows = table === "events" ? events : routines, offset = Number(url.searchParams.get("offset"));
    return Response.json(rows.slice(offset, offset + cap));
  } };
}

test("routine directory reads only minimal event and programme identities with GET", async () => {
  const server = upstream();
  const result = await getJudgingRoutineDirectory(env, eventId, server);
  assert.deepEqual(result, { event: { id: eventId, name: "Levitate Noviembre" }, rows: [{ id: "routine-1", name: "Vuelo", academy: "Academia Uno" }] });
  assert.deepEqual(server.calls.map(call => call.url.pathname), ["/rest/v1/events", "/rest/v1/events", "/rest/v1/routines", "/rest/v1/routines"]);
});

test("directory output cannot carry unrelated scoring or private configuration fields", async () => {
  const server = upstream({ events: [event({ competition_config: { private: "PRIVATE CONFIG" }, access_code: "PRIVATE EVENT CODE" })],
    routines: [routine("routine-1", { scores: ["PRIVATE SCORE"], comments: "PRIVATE FEEDBACK", event: "PRIVATE EVENT", raw: { token: "PRIVATE TOKEN" } })] });
  const result = await getJudgingRoutineDirectory(env, eventId, server);
  assert.deepEqual(Object.keys(result.event), ["id", "name"]);
  assert.deepEqual(Object.keys(result.rows[0]), ["id", "name", "academy"]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|scores|comments|access_code|token|competition_config/);
});

test("invalid or unconfigured event IDs fail before any upstream request", async () => {
  for (const [id, code] of [["not-an-event-id", "judging_invalid_event"], [foreignId, "judging_event_not_found"], [null, "judging_invalid_event"]]) {
    const server = upstream();
    await assert.rejects(() => getJudgingRoutineDirectory(env, id, server), error => error.code === code);
    assert.equal(server.calls.length, 0);
  }
  const server = upstream();
  const result = await getJudgingRoutineDirectory({ ...env, JUDGING_LEVITATE_EVENT_IDS: ` ${eventId.toUpperCase()}, ${eventId}` }, eventId.toUpperCase(), server);
  assert.equal(result.event.id, eventId);
});

test("missing, foreign, duplicate, and archived event responses fail before programme reads", async () => {
  for (const events of [[], [event({ id: foreignId })], [event(), event()], [event({ event_type: "archived" })], [event({ event_type: "legacy" })]]) {
    const server = upstream({ events });
    await assert.rejects(() => getJudgingRoutineDirectory(env, eventId, server), error => error.code === "judging_event_not_found");
    assert.ok(server.calls.every(call => call.url.pathname === "/rest/v1/events"));
  }
});

test("an existing legacy-null event type and an empty programme are valid", async () => {
  const server = upstream({ events: [event({ event_type: null })], routines: [] });
  const result = await getJudgingRoutineDirectory(env, eventId, server);
  assert.deepEqual(result.rows, []); assert.equal(result.event.id, eventId);
  assert.equal(server.calls.at(-1).url.pathname, "/rest/v1/routines");
});

test("directory pagination continues through server caps smaller than the requested page size", async () => {
  const routines = Array.from({ length: 5 }, (_, index) => routine(`routine-${index + 1}`));
  const server = upstream({ routines, cap: 2 });
  const result = await getJudgingRoutineDirectory(env, eventId, server);
  assert.deepEqual(result.rows.map(row => row.id), routines.map(row => row.routine_id));
  assert.deepEqual(server.calls.filter(call => call.url.pathname.endsWith("/routines")).map(call => call.url.searchParams.get("offset")), ["0", "2", "4", "5"]);
});

test("foreign scope and ambiguous or missing routine IDs reject the whole directory", async () => {
  for (const routines of [
    [routine(), routine("foreign", { event_id: foreignId })],
    [routine(), routine()], [routine("routine-1"), routine(" routine-1 ")],
    [routine("")], [routine(null)], [routine(1)],
  ]) {
    const server = upstream({ routines });
    await assert.rejects(() => getJudgingRoutineDirectory(env, eventId, server), error => error.code === "judging_invalid_response" && error.statusCode === 502);
  }
});

test("zero-like string IDs and sparse metadata are preserved without inventing associations", async () => {
  const server = upstream({ routines: [routine("0", { name: null, academy: null }), routine("dance-uuid", { name: " Vuelo ", academy: " Academia Uno " })] });
  const result = await getJudgingRoutineDirectory(env, eventId, server);
  assert.deepEqual(result.rows, [{ id: "0", name: "", academy: "" }, { id: "dance-uuid", name: "Vuelo", academy: "Academia Uno" }]);
});

test("upstream failures remain sanitized and never return a partially read programme", async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; throw new Error("PRIVATE CREDENTIAL"); };
  await assert.rejects(() => getJudgingRoutineDirectory(env, eventId, { fetcher }), error => error.code === "judging_unavailable" && !/PRIVATE/.test(error.message));
  assert.equal(calls, 1);
  const server = upstream();
  await assert.rejects(() => getJudgingRoutineDirectory({ ...env, JUDGING_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private" }, eventId, server), error => error.code === "judging_not_configured");
  assert.equal(server.calls.length, 0);
});
