import assert from "node:assert/strict";
import test from "node:test";
import { buildJudgingScoreSnapshot } from "../worker/judging-score-data.js";

const eventId = "event-one";
const at = "2026-11-02T18:20:00.000Z";
const row = (fields) => ({ event_id: eventId, ...fields });
const score = (criterion_id, value, extra = {}) => row({ routine_id: "routine-1", judge_id: "judge-1", criterion_id, value, ...extra });
function fixture() {
  return {
    event: { id: eventId, name: "Levitate Noviembre", source_name: "Programa.xlsx", is_active: true, starts_at: "2026-11-13" },
    blocks: [row({ block_id: "block-1", name: "Bloque Aéreo", title: "Aéreo principal", sort_order: 1 })],
    routines: [row({ routine_id: "routine-1", block_id: "block-1", block: "Bloque Aéreo", name: "Vuelo", academy: "Academia Uno",
      genre: "Aro", division: "Teen", category: "Solo", level: "Intermedio", sort_order: 1 })],
    judges: [row({ judge_id: "judge-1", name: "Jueza Uno", role: "judge", assigned_block_ids: [], sort_order: 1 })],
    templates: [row({ template_id: "aerial", genre: "DANZA AEREA", title: "Hoja Aérea", max_score: 15, sort_order: 1 })],
    criteria: [
      row({ template_id: "aerial", criterion_id: 1, label: "Técnica", section: "Ejecución", max_score: 10, sort_order: 1 }),
      row({ template_id: "aerial", criterion_id: 2, label: "Expresión", section: "Arte", max_score: 5, sort_order: 2 }),
    ],
    scores: [score(1, 8), score(2, 4)],
    penalties: [row({ routine_id: "routine-1", judge_id: "judge-1", value: -1 })],
    feedback: [row({ routine_id: "routine-1", judge_id: "judge-1", body: "Buen trabajo." })],
  };
}
const snapshot = (input) => buildJudgingScoreSnapshot(input, at);
const first = (input) => snapshot(input).rows[0];

function freezeDeep(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) freezeDeep(nested);
  }
  return value;
}

test("judging snapshot preserves exact per-judge sheets alongside the separate block report", () => {
  const result = snapshot(fixture());
  assert.deepEqual(result.event, { id: eventId, name: "Levitate Noviembre", sourceName: "Programa.xlsx", isActive: true, startsAt: "2026-11-13" });
  assert.equal(result.fetchedAt, at);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.rows[0], {
    id: "routine-1", name: "Vuelo", academy: "Academia Uno", state: "", genre: "Aro", division: "Teen", category: "Solo", level: "Intermedio",
    blockId: "block-1", blockName: "Bloque Aéreo", status: "complete", completedJudges: 1, expectedJudges: 1, recordedScores: 2,
    judges: [{ id: "judge-1", name: "Jueza Uno", status: "complete", subtotal: 12, penalty: -1, total: 11, maximumScore: 15, sheetMaximumScore: 15,
      criteria: [{ id: 1, label: "Técnica", section: "Ejecución", value: 8, maximumScore: 10 },
        { id: 2, label: "Expresión", section: "Arte", value: 4, maximumScore: 5 }], feedback: "Buen trabajo." }],
  });
  for (const field of ["total", "aggregateTotal", "rank", "placement", "award"]) assert.equal(Object.hasOwn(result.rows[0], field), false);
  assert.equal(result.report.blocks[0].sections[0].categories[0].rows[0].score, 11);
  assert.equal(result.report.blocks[0].sections[0].categories[0].rows[0].maximumScore, 15);
  assert.equal(result.report.maximumScore, 15);
});

test("original programme numbers are display metadata and never replace score or report identities", () => {
  const input = fixture();
  const before = snapshot(input);
  for (const programNumber of ["194 a", "237"]) {
    input.routines[0].program_number = ` ${programNumber} `;
    const result = snapshot(input);
    assert.equal(result.rows[0].id, "routine-1");
    assert.equal(result.rows[0].programNumber, programNumber);
    assert.deepEqual(result.rows[0].judges, before.rows[0].judges);
    assert.deepEqual(result.report, before.report, "programme numbers cannot alter scoring or placements");
  }
  input.routines[0].program_number = null;
  assert.deepEqual(snapshot(input), before, "legacy routines retain the previous display fallback");
});

test("recorded zero is complete data while an absent criterion remains null and incomplete", () => {
  const input = fixture();
  input.scores = [score(1, 0)];
  let result = first(input);
  assert.equal(result.status, "partial");
  assert.equal(result.recordedScores, 1);
  assert.equal(result.completedJudges, 0);
  assert.deepEqual(result.judges[0].criteria.map((item) => item.value), [0, null]);
  assert.equal(result.judges[0].subtotal, 0);
  assert.equal(result.judges[0].total, 0);
  input.scores.push(score(2, 0));
  result = first(input);
  assert.equal(result.status, "complete");
  assert.equal(result.completedJudges, 1);
  assert.equal(result.recordedScores, 2);
  assert.equal(result.judges[0].total, 0);
});

test("penalties do not fabricate a scored sheet, and a valid negative penalty never makes totals negative", () => {
  const input = fixture();
  input.scores = [];
  let result = first(input);
  assert.equal(result.status, "pending");
  assert.equal(result.judges[0].subtotal, null);
  assert.equal(result.judges[0].total, null);
  assert.equal(result.judges[0].penalty, -1);
  assert.equal(result.judges[0].maximumScore, 15);
  input.scores = [score(1, 2)];
  input.penalties[0].value = -10;
  result = first(input);
  assert.equal(result.status, "partial");
  assert.equal(result.judges[0].subtotal, 2);
  assert.equal(result.judges[0].total, 0);
});

test("strict event isolation prevents same-ID rows from other events entering progress or sheets", () => {
  const input = fixture();
  input.scores = [score(1, 2)];
  for (const table of ["routines", "blocks", "judges", "templates", "criteria", "scores", "penalties", "feedback"]) {
    const foreign = { ...input[table][0], event_id: "another-event" };
    if (table === "scores") { foreign.criterion_id = 2; foreign.value = 5; }
    input[table].push(foreign);
    input[table].push({ ...foreign, event_id: undefined });
  }
  const result = snapshot(input);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].recordedScores, 1);
  assert.equal(result.rows[0].expectedJudges, 1);
  assert.equal(result.rows[0].judges[0].subtotal, 2);
  assert.equal(result.rows[0].judges[0].criteria[1].value, null);
  assert.equal(result.rows[0].judges[0].feedback, "Buen trabajo.");
  assert.equal(result.warnings.filter((message) => /no corresponden al evento/.test(message)).length, 8);
});

test("template specificity and criterion scope choose the relevant sheet without combining same-number criteria", () => {
  const input = fixture();
  input.templates.push(row({ template_id: "intermediate-aro", genre: "Aro", sort_order: 2,
    applies_to: { primary_categories: ["Áro"], levels: ["intermedio"], divisions: ["TEEN"] } }));
  input.criteria.push(row({ template_id: "intermediate-aro", criterion_id: 1, label: "Obligatorios", section: "Específica", max_score: 10 }));
  input.criteria.push(row({ template_id: "unknown", criterion_id: 99, label: "Huérfano", max_score: 10 }));
  const result = snapshot(input);
  const judge = result.rows[0].judges[0];
  assert.deepEqual(judge.criteria, [{ id: 1, label: "Obligatorios", section: "Específica", maximumScore: 10, value: 8 }]);
  assert.equal(judge.subtotal, 8);
  assert.equal(judge.maximumScore, 10);
  assert.equal(judge.status, "complete");
  assert.equal(result.rows[0].recordedScores, 1);
  assert.ok(result.warnings.some((message) => /no pertenecen a una plantilla/.test(message)));
  assert.ok(result.warnings.some((message) => /criterios o jueces esperados/.test(message)));
});

test("template matching honors all applicability dimensions and generic matching does not invent unknown templates", () => {
  const input = fixture();
  input.routines[0].genre = "Contemporáneo";
  input.templates.push(row({ template_id: "contemporaneo", genre: "Contemporaneo", sort_order: 2 }));
  input.templates.push(row({ template_id: "wrong-level", genre: "Contemporáneo", sort_order: 1, applies_to: { levels: ["Elite"] } }));
  input.criteria.push(row({ template_id: "contemporaneo", criterion_id: 1, label: "Contempo", max_score: 10 }));
  input.criteria.push(row({ template_id: "wrong-level", criterion_id: 1, label: "No debe aparecer", max_score: 10 }));
  assert.equal(first(input).judges[0].criteria[0].label, "Contempo");
  input.routines[0].genre = "Disciplina desconocida";
  const result = snapshot(input);
  assert.equal(result.rows[0].status, "unavailable");
  assert.equal(result.rows[0].completedJudges, 0);
  assert.equal(result.rows[0].judges[0].total, null);
  assert.deepEqual(result.rows[0].judges[0].criteria, []);
  assert.ok(result.warnings.some((message) => /sin una plantilla/.test(message)));
});

test("expected judges honor block assignments and exclude admins while preserving missing-role judges", () => {
  const input = fixture();
  input.judges[0].assigned_block_ids = ["bloque-aereo"];
  input.judges.push(row({ judge_id: "judge-2", name: "Jueza Dos", assigned_block_ids: ["block-2"] }));
  input.judges.push(row({ judge_id: "admin", name: "Admin", role: "admin", assigned_block_ids: ["block-1"] }));
  input.scores.push(score(1, 10, { judge_id: "admin" }), score(2, 5, { judge_id: "admin" }));
  input.scores.push(score(1, 7, { judge_id: "judge-2" }));
  let result = first(input);
  assert.equal(result.expectedJudges, 1);
  assert.deepEqual(result.judges.map((judge) => judge.id), ["judge-1"]);
  assert.equal(result.status, "complete");
  assert.equal(result.recordedScores, 2);
  input.judges[0].assigned_block_ids = ["block-elsewhere"];
  result = first(input);
  assert.equal(result.expectedJudges, 2, "iOS falls back to editable judges if none match this block");
  assert.equal(result.completedJudges, 1);
  assert.equal(result.status, "partial");
  input.judges[0].assigned_block_ids = ["block-1"];
  input.blocks = [];
  result = first(input);
  assert.equal(result.expectedJudges, 1, "routine block ID still works when block metadata is absent");
});

test("criterion weights use configured ID and normalized label aliases without applying cross-judge rules", () => {
  const input = fixture();
  input.event.competition_config = { scoring_rules: { criterion_weights: { "1": 2, "EXPRESION": 0.5 }, evaluator_weights: { "Jueza Uno": 99 },
    score_aggregation: "sum", drop_highest_count: 1, official_missing_score_policy: "zero" } };
  let judge = first(input).judges[0];
  assert.equal(judge.subtotal, 18);
  assert.equal(judge.maximumScore, 22.5);
  assert.equal(judge.total, 17);
  assert.deepEqual(judge.criteria.map((criterion) => criterion.value), [8, 4], "raw criterion values remain exact");
  input.event.competition_config = { scoring: { criterionWeights: { tecnica: -5 } } };
  judge = first(input).judges[0];
  assert.equal(judge.subtotal, 4, "negative weights clamp to zero as in iOS");
  assert.equal(judge.maximumScore, 5);
});

test("invalid numeric scores never become zero or completed criteria", async (t) => {
  for (const value of [null, "", NaN, Infinity, "bad", -1, 11]) {
    await t.test(String(value), () => {
      const input = fixture();
      input.scores = [score(1, value), score(2, 4)];
      const result = snapshot(input);
      assert.equal(result.rows[0].status, "partial");
      assert.equal(result.rows[0].completedJudges, 0);
      assert.equal(result.rows[0].recordedScores, 1);
      assert.equal(result.rows[0].judges[0].criteria[0].value, null);
      assert.ok(result.warnings.some((message) => /notas inválidas/.test(message)));
    });
  }
});

test("invalid penalties do not report a falsely completed total", async (t) => {
  for (const value of [null, "", NaN, Infinity, 2, -101]) {
    await t.test(String(value), () => {
      const input = fixture();
      input.penalties[0].value = value;
      const result = snapshot(input);
      assert.equal(result.rows[0].status, "partial");
      assert.equal(result.rows[0].judges[0].total, null);
      assert.equal(result.rows[0].completedJudges, 0);
      assert.ok(result.warnings.some((message) => /penalizaciones inválidas/.test(message)));
    });
  }
});

test("invalid or overflowing weights make calculation unavailable without changing exact notes", () => {
  for (const weights of [{ "1": Infinity }, { "1": "invalid" }, [2, 3], { "1": 1e308 }]) {
    const input = fixture();
    input.event.competition_config = { scoring_rules: { criterion_weights: weights } };
    const result = snapshot(input);
    assert.equal(result.rows[0].status, "unavailable");
    assert.equal(result.rows[0].completedJudges, 0);
    assert.equal(result.rows[0].judges[0].subtotal, null);
    assert.equal(result.rows[0].judges[0].total, null);
    assert.equal(result.rows[0].judges[0].maximumScore, null);
    assert.deepEqual(result.rows[0].judges[0].criteria.map((criterion) => criterion.value), [8, 4]);
    assert.ok(result.warnings.length);
    assert.doesNotMatch(JSON.stringify(result), /Infinity|NaN/);
  }
});

test("duplicate or invalid criterion metadata does not silently reduce required criteria", () => {
  for (const extra of [row({ template_id: "aerial", criterion_id: 1, label: "Duplicado", max_score: 10 }),
    row({ template_id: "aerial", criterion_id: 3, label: "Sin máximo", max_score: null })]) {
    const input = fixture();
    input.criteria.push(extra);
    const result = snapshot(input);
    assert.equal(result.rows[0].status, "unavailable");
    assert.equal(result.rows[0].completedJudges, 0);
    assert.ok(result.warnings.some((message) => /criterios de evaluación inválidos/.test(message)));
  }
  const input = fixture();
  input.scores.push(score(1, 9));
  const result = snapshot(input);
  assert.equal(result.rows[0].status, "partial");
  assert.equal(result.rows[0].judges[0].criteria[0].value, null);
  assert.ok(result.warnings.some((message) => /identificadores repetidos en scores/.test(message)));
});

test("orphan score records and missing judges do not produce phantom rows or completed results", () => {
  const input = fixture();
  input.scores.push(score(1, 10, { routine_id: "unknown" }), score(1, 10, { judge_id: "unknown" }));
  let result = snapshot(input);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].recordedScores, 2);
  assert.ok(result.warnings.some((message) => /no pertenecen a una rutina y juez/.test(message)));
  input.judges = [];
  result = snapshot(input);
  assert.equal(result.rows[0].status, "unavailable");
  assert.equal(result.rows[0].expectedJudges, 0);
  assert.equal(result.rows[0].completedJudges, 0);
  assert.deepEqual(result.rows[0].judges, []);
});

test("snapshot is nonmutating and allowlists data instead of exposing raw secrets or private identifiers", () => {
  const input = fixture();
  input.event.private_key = "private-secret";
  input.judges[0].access_code = "private-access";
  input.judges[0].photo_data = "private-photo";
  input.routines[0].registration_dance_id = "private-web-link";
  input.scores[0].device_id = "private-device";
  const before = structuredClone(input);
  freezeDeep(input);
  const result = buildJudgingScoreSnapshot(input, new Date(at));
  assert.deepEqual(input, before);
  assert.equal(result.fetchedAt, at);
  assert.doesNotMatch(JSON.stringify(result), /private-secret|private-access|private-photo|private-web-link|private-device/);
  const empty = snapshot({});
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.event.id, "");
  assert.ok(empty.warnings.length);
});
