import assert from "node:assert/strict";
import test from "node:test";
import { buildJudgingScoreSnapshot } from "../worker/judging-score-data.js";
import { participantMedalForScore, pendingParticipantResult, projectParticipantResult } from "../worker/participant-results.js";

const eventId = "levitate-event";
const scoped = value => ({ event_id: eventId, ...value });
function source({ totals = [48, 45, 40, 30], scoring, otherCategory = false } = {}) {
  const input = {
    event: { id: eventId, name: "Levitate", competition_config: { scoring } },
    blocks: [scoped({ block_id: "block-1", name: "Bloque 1" })],
    routines: totals.map((_, index) => scoped({ routine_id: String(index + 1), name: `Pieza ${index + 1}`, academy: "Academia",
      block_id: "block-1", block: "Bloque 1", genre: "Aro", division: otherCategory && index === totals.length - 1 ? "Adulto" : "Junior", level: "Intermedio", category: "Solo" })),
    judges: [scoped({ judge_id: "judge-1", name: "Juez Uno", role: "judge" })],
    templates: [scoped({ template_id: "aerial", genre: "DANZA AEREA", max_score: 50 })],
    criteria: [scoped({ template_id: "aerial", criterion_id: 1, label: "Técnica", max_score: 50 })],
    scores: totals.flatMap((value, index) => value === null ? [] : [scoped({ routine_id: String(index + 1), judge_id: "judge-1", criterion_id: 1, value })]),
    penalties: [], feedback: [],
  };
  return input;
}
function snapshot(options) {
  const value = buildJudgingScoreSnapshot(source(options), "2026-11-09T00:00:00Z");
  value.resultScope = { eventId, complete: true, blockIds: ["block-1"] };
  return value;
}
const project = (snapshot, routineId = "1") => projectParticipantResult({ snapshot, routineId });

test("medal tiers exactly follow native 181/210,161/210,141/210 thresholds on any valid scale", () => {
  for (const maximum of [150, 210, 50]) {
    for (const [numerator, medal, below] of [[181, "oro", "plata"], [161, "plata", "bronce"], [141, "bronce", "participacion"]]) {
      const threshold = maximum * (numerator / 210);
      assert.equal(participantMedalForScore(threshold, maximum), medal);
      assert.equal(participantMedalForScore(threshold - 1e-8, maximum), below);
    }
    assert.equal(participantMedalForScore(0, maximum), "participacion");
  }
  for (const values of [[-1, 150], [151, 150], [null, 150], [NaN, 150], [Infinity, 150], [1, 0], [1, null]]) {
    assert.equal(participantMedalForScore(...values), null);
  }
});

test("official report score, scale and category place are projected without leaking other participants", () => {
  const data = snapshot();
  assert.deepEqual(project(data), { status: "published", score: 144, maxScore: 150, medal: "oro", directCompetition: true, eligibleCount: 4, place: 1 });
  assert.deepEqual(project(data, "4"), { status: "published", score: 90, maxScore: 150, medal: "participacion", directCompetition: true, eligibleCount: 4, place: null });
  assert.deepEqual(Object.keys(project(data)), ["status", "score", "maxScore", "medal", "directCompetition", "eligibleCount", "place"]);
  assert.doesNotMatch(JSON.stringify(project(data)), /Pieza|Academia|judge|event|routine|block/);
});

test("medal is score-tier based rather than copied from the direct competition place", () => {
  const value = project(snapshot({ totals: [30, 25] }));
  assert.equal(value.place, 1); assert.equal(value.medal, "participacion");
});

test("singleton category has a score-tier medal but no fabricated direct podium", () => {
  assert.deepEqual(project(snapshot({ totals: [48] })), { status: "published", score: 144, maxScore: 150, medal: "oro", directCompetition: false, eligibleCount: 1, place: null });
  const value = project(snapshot({ totals: [48, 45], otherCategory: true }), "2");
  assert.equal(value.eligibleCount, 1); assert.equal(value.directCompetition, false); assert.equal(value.place, null);
});

test("equal official scores preserve competition ranks and top-three-only places", () => {
  const data = snapshot({ totals: [48, 48, 40, 30] });
  assert.deepEqual(["1", "2", "3", "4"].map(id => project(data, id).place), [1, 1, 3, null]);
});

test("own complete score is available while incomplete category peers withhold all final places", () => {
  const data = snapshot({ totals: [48, null, 40] });
  assert.equal(project(data).status, "published"); assert.equal(project(data).score, 144);
  assert.equal(project(data).eligibleCount, 3); assert.equal(project(data).place, null);
  assert.deepEqual(project(data, "2"), pendingParticipantResult());
});

test("explicit zero is a complete result with participation and no native podium position", () => {
  const data = snapshot({ totals: [0, 0] });
  assert.deepEqual(project(data), { status: "published", score: 0, maxScore: 150, medal: "participacion", directCompetition: true, eligibleCount: 2, place: null });
});

test("own-routine-only sheets cannot masquerade as complete category results", () => {
  for (const change of [data => delete data.resultScope, data => data.resultScope.complete = false,
    data => data.resultScope.eventId = "other-event", data => data.resultScope.blockIds = ["other-block"]]) {
    const data = snapshot(); change(data); assert.deepEqual(project(data), pendingParticipantResult());
  }
});

test("malformed or ambiguous routine and report data fail closed", () => {
  for (const change of [data => data.rows.push(structuredClone(data.rows[0])),
    data => data.report.blocks[0].sections[0].categories[0].rows.push(structuredClone(data.report.blocks[0].sections[0].categories[0].rows[0])),
    data => data.rows[0].judges[0].criteria[0].value = null,
    data => data.rows[0].judges[0].status = "partial",
    data => data.rows[0].completedJudges = 0,
    data => data.report.maximumScore = 0,
    data => data.report.blocks[0].sections[0].categories[0].rows.find(row => row.routineId === "1").score = 151,
    data => data.rows.splice(1, 1),
    data => data.rows[1].blockId = "different-block"]) {
    const data = snapshot(); change(data); assert.deepEqual(project(data), pendingParticipantResult());
  }
  assert.deepEqual(project(snapshot(), "unknown"), pendingParticipantResult());
  assert.deepEqual(projectParticipantResult(), pendingParticipantResult());
});

test("configured weighting, penalty and extreme-score rules are consumed from the official report", () => {
  const input = source({ totals: [40, 30], scoring: { aggregation: "sum", include_penalties: true, evaluator_weights: { "Juez Uno": 2 } } });
  input.penalties = [scoped({ routine_id: "1", judge_id: "judge-1", value: -5 })];
  const data = buildJudgingScoreSnapshot(input);
  data.resultScope = { eventId, complete: true, blockIds: ["block-1"] };
  assert.equal(project(data).score, 105); assert.equal(project(data).medal, "bronce");
});

test("projection does not modify authoritative snapshots", () => {
  const data = snapshot(), before = structuredClone(data);
  project(data); project(data, "2"); assert.deepEqual(data, before);
});
