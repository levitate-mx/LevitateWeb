import assert from "node:assert/strict";
import test from "node:test";
import { enrichParticipantJudging } from "../worker/participant-judging.js";

const sourceEvent = "core-event";
const judge = (overrides = {}) => ({ id: "judge-1", name: "Jueza Uno", status: "complete", subtotal: 99,
  penalty: -1, total: 98, maximumScore: 100, feedback: "Buen trabajo.",
  criteria: [{ id: 1, label: "Técnica", section: "Ejecución", value: 8, maximumScore: 10 },
    { id: 2, label: "Expresión", section: "Arte", value: 4, maximumScore: 5 }], ...overrides });
const nativeRoutine = (overrides = {}) => ({ id: "source-routine", name: "Vuelo", academy: "Academia Uno",
  genre: "Aro", category: "Solo", division: "Teen", level: "Intermedio", blockName: "Bloque 1",
  expectedJudges: 1, completedJudges: 1, recordedScores: 2, status: "complete", judges: [judge()], ...overrides });
const portalRow = (overrides = {}) => ({ id: "portal-routine", registration_dance_id: "dance-uuid", status: "published",
  source_event_id: sourceEvent, source_routine_id: "source-routine", ...overrides });
const snapshot = (rows = [nativeRoutine()], id = sourceEvent) => ({ event: { id, name: "Levitate Noviembre", competition_config: { secret: "not-for-participant" } },
  rows, warnings: ["Private warning"], report: { private: true } });
const manual = { status: "available", judges: [{ name: "Obsolete manual" }], url: "/api/participant/assets/old-sheet" };
function fixture({ rows = [portalRow()], snapshots = { [sourceEvent]: snapshot() }, event = { published: 1 }, adminPreview = false, sourceEventId, data } = {}) {
  const calls = [];
  const input = data || { participant: { id: "participant-one" }, routines: rows.map(row => ({ id: row.id || `registration:${row.registration_dance_id}`,
    title: "Own choreography", result: { status: "published", score: 138 }, judging: structuredClone(manual), photos: { status: "available" } })) };
  return { calls, input, run: (extra = {}) => enrichParticipantJudging({ data: input, rows, event, adminPreview, sourceEventId,
    getSnapshot: async id => { calls.push(id); if (snapshots[id] instanceof Error) throw snapshots[id]; return snapshots[id]; }, ...extra }) };
}

test("authoritative complete sheets replace stale manual assets without changing results or other chapters", async () => {
  const f = fixture(); const result = await f.run(); const value = result.routines[0];
  assert.deepEqual(f.calls, [sourceEvent]);
  assert.equal(value.judging.source, "jueceocore"); assert.equal(value.judging.sourceStatus, "available");
  assert.equal(value.judging.status, "available"); assert.equal(value.judging.preview, false);
  assert.equal(value.judging.url, undefined); assert.equal(value.judging.assetId, undefined);
  assert.deepEqual(value.result, f.input.routines[0].result); assert.deepEqual(value.photos, f.input.routines[0].photos);
  assert.equal(value.judging.judges[0].subtotal, 12, "individual sheets use the plain sum, not weighted official subtotals");
  assert.equal(value.judging.judges[0].score, 11); assert.equal(value.judging.judges[0].maxScore, 15);
  assert.deepEqual(value.judging.pdf.routine, { id: "source-routine", title: "Vuelo", academy: "Academia Uno", genre: "Aro", category: "Solo", division: "Teen", level: "Intermedio", block: "Bloque 1" });
  assert.equal(value.judging.pdf.judges[0].criteria[0].value, 8);
  assert.equal(f.input.routines[0].judging.url, manual.url, "input remains untouched");
});

test("participant PDF descriptors carry the programme number separately from the verified source identity", async () => {
  const f = fixture({ snapshots: { [sourceEvent]: snapshot([nativeRoutine({ programNumber: "194 a" })]) } });
  const result = await f.run();
  assert.deepEqual(f.calls, [sourceEvent]);
  assert.equal(result.routines[0].judging.pdf.routine.id, "source-routine");
  assert.equal(result.routines[0].judging.pdf.routine.programNumber, "194 a");
  assert.equal(result.routines[0].judging.pdf.routine.title, "Vuelo");
});

test("hidden editions and draft curated routines do not consult the source at all", async () => {
  for (const f of [fixture({ event: { published: 0 } }), fixture({ rows: [portalRow({ status: "draft" })] })]) {
    const result = await f.run(); assert.deepEqual(f.calls, []);
    assert.deepEqual(result.routines[0].judging, { source: "jueceocore", sourceStatus: "pending", status: "pending", judges: [] });
  }
});

test("an authenticated automatic edition releases complete sheets independently of photo or result drafts", async () => {
  for (const source of [
    { rows: [portalRow({ status: "draft" })] },
    { rows: [portalRow({ status: "draft", source_event_id: null, source_routine_id: null })], sourceEventId: sourceEvent,
      snapshots: { [sourceEvent]: snapshot([nativeRoutine({ id: "dance-uuid" })]) } },
  ]) {
    const f = fixture({ ...source, event: { published: 1, automatic_judging: true } });
    const result = await f.run(); assert.equal(result.routines[0].judging.status, "available");
    assert.deepEqual(f.calls, [sourceEvent]);
    assert.deepEqual(result.routines[0].result, f.input.routines[0].result);
    assert.deepEqual(result.routines[0].photos, f.input.routines[0].photos);
    assert.equal(result.routines[0].judging.preview, false);
  }
});

test("automatic release cannot expose hidden editions or incomplete evaluations", async () => {
  const hidden = fixture({ rows: [portalRow({ status: "draft" })], event: { published: 0, automatic_judging: true } });
  assert.equal((await hidden.run()).routines[0].judging.status, "pending"); assert.deepEqual(hidden.calls, []);
  const partial = fixture({ rows: [portalRow({ status: "draft" })], event: { published: 1, automatic_judging: true },
    snapshots: { [sourceEvent]: snapshot([nativeRoutine({ status: "partial", completedJudges: 0,
      judges: [judge({ status: "partial", criteria: [judge().criteria[0], { ...judge().criteria[1], value: null }] })] })]) } });
  const result = await partial.run(); assert.equal(result.routines[0].judging.status, "pending");
  assert.equal(result.routines[0].judging.pdf, undefined); assert.deepEqual(result.routines[0].judging.judges, []);
});

test("legacy explicit links retain routine publication gates without the trusted automatic flag", async () => {
  for (const flag of [undefined, false, 1, "true"]) {
    const f = fixture({ rows: [portalRow({ status: "draft" })], event: { published: 1, automatic_judging: flag } });
    f.input.automatic_judging = true;
    const result = await f.run(); assert.equal(result.routines[0].judging.status, "pending"); assert.deepEqual(f.calls, []);
  }
});

test("an administrator may inspect recorded partial sheets without publishing them", async () => {
  const partial = nativeRoutine({ status: "partial", completedJudges: 0, recordedScores: 1,
    judges: [judge({ status: "partial", criteria: [judge().criteria[0], { ...judge().criteria[1], value: null }] })] });
  const f = fixture({ rows: [portalRow({ status: "draft" })], event: { published: 0 }, adminPreview: true, snapshots: { [sourceEvent]: snapshot([partial]) } });
  const result = await f.run(); const value = result.routines[0].judging;
  assert.equal(value.status, "available"); assert.equal(value.sourceStatus, "available");
  assert.equal(value.preview, true); assert.equal(value.pdf.preview, true);
  assert.equal(value.judges[0].criteria[1].score, null); assert.equal(value.judges[0].subtotal, 8);
});

test("participants cannot read partial sheets even when they have a numeric official score", async () => {
  const f = fixture({ snapshots: { [sourceEvent]: snapshot([nativeRoutine({ status: "partial", judges: [judge({ status: "partial" })] })]) } });
  const result = await f.run(); assert.equal(result.routines[0].judging.status, "pending");
  assert.equal(result.routines[0].judging.pdf, undefined); assert.deepEqual(result.routines[0].judging.judges, []);
});

test("complete source status cannot bypass an incomplete expected judge", async () => {
  const f = fixture({ snapshots: { [sourceEvent]: snapshot([nativeRoutine({ expectedJudges: 2,
    judges: [judge(), judge({ id: "judge-2", status: "pending", criteria: judge().criteria.map(value => ({ ...value, value: null })) })] })]) } });
  const result = await f.run(); assert.equal(result.routines[0].judging.status, "pending");
  assert.equal(result.routines[0].judging.pdf, undefined);
});

test("valid completed zero-valued sheets remain available and never gain points from penalties", async () => {
  const zero = nativeRoutine({ judges: [judge({ penalty: 10, criteria: judge().criteria.map(value => ({ ...value, value: 0 })) })] });
  const f = fixture({ snapshots: { [sourceEvent]: snapshot([zero]) } });
  const result = await f.run(); assert.equal(result.routines[0].judging.status, "available");
  assert.equal(result.routines[0].judging.judges[0].score, 0); assert.equal(result.routines[0].judging.judges[0].subtotal, 0);
});

test("a source with no recorded values remains pending even in administrative preview", async () => {
  const empty = nativeRoutine({ status: "pending", recordedScores: 0, completedJudges: 0,
    judges: [judge({ status: "pending", criteria: judge().criteria.map(value => ({ ...value, value: null })) })] });
  const f = fixture({ adminPreview: true, snapshots: { [sourceEvent]: snapshot([empty]) } });
  const result = await f.run(); assert.equal(result.routines[0].judging.status, "pending");
  assert.equal(result.routines[0].judging.pdf, undefined);
});

test("source errors fail closed for sheets while photographs and diplomas still load", async () => {
  const f = fixture({ snapshots: { [sourceEvent]: new Error("private upstream credentials") } });
  f.input.diploma = { status: "available", url: "/api/participant/assets/diploma" };
  const result = await f.run(); assert.equal(result.routines[0].judging.sourceStatus, "unavailable");
  assert.equal(result.routines[0].judging.url, undefined); assert.deepEqual(result.diploma, f.input.diploma);
  assert.deepEqual(result.routines[0].photos, f.input.routines[0].photos);
  assert.doesNotMatch(JSON.stringify(result), /credentials|Obsolete manual|old-sheet/);
});

test("unconfigured routines retain approved manual judging for compatibility", async () => {
  const f = fixture({ rows: [portalRow({ source_event_id: null, source_routine_id: null })] });
  const result = await f.run(); assert.deepEqual(f.calls, []);
  assert.deepEqual(result.routines[0].judging, { ...manual, sourceStatus: "unlinked" });
});

test("an edition binding matches exact registration IDs and enables uncurated registered routines", async () => {
  const rows = [portalRow({ id: null, status: null, source_event_id: null, source_routine_id: null })];
  const f = fixture({ rows, sourceEventId: sourceEvent, snapshots: { [sourceEvent]: snapshot([nativeRoutine({ id: "dance-uuid" })]) } });
  const result = await f.run(); assert.equal(result.routines[0].id, "registration:dance-uuid");
  assert.equal(result.routines[0].judging.status, "available"); assert.deepEqual(f.calls, [sourceEvent]);
});

test("an edition binding never infers identity by title, number, case folding, or an adjacent event", async () => {
  for (const id of ["1", "DANCE-UUID", "different-routine"]) {
    const f = fixture({ rows: [portalRow({ source_event_id: null, source_routine_id: null })], sourceEventId: sourceEvent,
      snapshots: { [sourceEvent]: snapshot([nativeRoutine({ id, name: "Own choreography" })]) } });
    const result = await f.run(); assert.equal(result.routines[0].judging.sourceStatus, "unlinked");
    assert.equal(result.routines[0].judging.url, undefined);
  }
  const f = fixture({ snapshots: { [sourceEvent]: snapshot([nativeRoutine()], "another-event") } });
  assert.equal((await f.run()).routines[0].judging.sourceStatus, "unavailable");
});

test("explicit pairs override the edition binding, and incomplete explicit pairs never fall through", async () => {
  const f = fixture({ sourceEventId: "another-event" });
  assert.equal((await f.run()).routines[0].judging.status, "available"); assert.deepEqual(f.calls, [sourceEvent]);
  const broken = fixture({ rows: [portalRow({ source_routine_id: null })], sourceEventId: "another-event" });
  assert.equal((await broken.run()).routines[0].judging.sourceStatus, "unlinked"); assert.deepEqual(broken.calls, []);
});

test("one source snapshot is reused and additional distinct source events are not queried", async () => {
  const rows = [portalRow(), portalRow({ id: "portal-second", registration_dance_id: "dance-second", source_routine_id: "source-second" }),
    portalRow({ id: "portal-third", registration_dance_id: "dance-third", source_event_id: "another-event", source_routine_id: "source-third" })];
  const f = fixture({ rows, snapshots: { [sourceEvent]: snapshot([nativeRoutine(), nativeRoutine({ id: "source-second" }), nativeRoutine({ id: "unrelated-private-row", name: "PRIVATE CHOREOGRAPHY" })]),
    "another-event": snapshot([nativeRoutine({ id: "source-third" })], "another-event") } });
  const result = await f.run(); assert.deepEqual(f.calls, [sourceEvent]);
  assert.deepEqual(result.routines.map(value => value.judging.status), ["available", "available", "pending"]);
  assert.equal(result.routines[2].judging.sourceStatus, "unavailable");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE CHOREOGRAPHY|unrelated-private-row|Private warning|competition_config|not-for-participant|source_event_id/);
});

test("ambiguous or malformed authoritative sheets fail closed instead of falling back to old PDFs", async () => {
  for (const sourceRows of [
    [nativeRoutine(), nativeRoutine()],
    [nativeRoutine({ judges: [judge({ criteria: [judge().criteria[0], judge().criteria[0]] })] })],
    [nativeRoutine({ expectedJudges: 2 })],
    [nativeRoutine({ status: "unavailable" })],
    [nativeRoutine({ judges: [judge({ criteria: [{ ...judge().criteria[0], value: 11 }] })] })],
    [nativeRoutine({ judges: [judge({ status: "complete", criteria: [{ ...judge().criteria[0], value: null }] })] })],
  ]) {
    const f = fixture({ snapshots: { [sourceEvent]: snapshot(sourceRows) } });
    const result = await f.run(); assert.equal(result.routines[0].judging.sourceStatus, "unavailable");
    assert.deepEqual(result.routines[0].judging.judges, []); assert.equal(result.routines[0].judging.pdf, undefined);
  }
});

test("an available native sheetMaximumScore overrides weighted snapshot maximum for the PDF", async () => {
  const f = fixture({ snapshots: { [sourceEvent]: snapshot([nativeRoutine({ judges: [judge({ maximumScore: 500, sheetMaximumScore: 20 })] })]) } });
  const result = await f.run(); assert.equal(result.routines[0].judging.judges[0].maxScore, 20);
  assert.equal(result.routines[0].judging.pdf.judges[0].maximumScore, 20);
  assert.equal(result.routines[0].judging.pdf.judges[0].sheetMaximumScore, 20);
});

test("missing or duplicate portal ownership rows cannot cause source queries", async () => {
  for (const rows of [[], [portalRow(), portalRow()]]) {
    const f = fixture({ rows, sourceEventId: sourceEvent, data: { routines: [{ id: "portal-routine", judging: manual }] } });
    const result = await f.run(); assert.deepEqual(f.calls, []); assert.equal(result.routines[0].judging.sourceStatus, "unlinked");
  }
});

test('source query receives only this participant’s released routine identities',async()=>{
  const rows=[portalRow(),portalRow({id:'hidden-portal',registration_dance_id:'hidden-dance',source_routine_id:'hidden-routine',status:'draft'})];
  const f=fixture({rows}); let queries=0;
  const result=await f.run({getSnapshot:async(id,options)=>{
    queries++;assert.equal(id,sourceEvent);assert.deepEqual(options,{routineIds:['source-routine']});return snapshot();
  }});
  assert.equal(queries,1);assert.equal(result.routines[0].judging.status,'available');
  assert.equal(result.routines[1].judging.status,'pending');
});
