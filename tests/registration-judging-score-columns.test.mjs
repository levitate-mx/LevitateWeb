import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/judging/JudgingAdminWorkspace.tsx", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

const motion = ["EVA CARRILLO", "DANIEL MONTALVO", "JORGE DÍAZ"];
const aerial = ["DANIEL HERRERA", "RENATA PINAL", "ANA KAREN ROJAS"];

function fixture() {
  const judges = [...motion, ...aerial, "Otra jueza", "Admin"].map((name, index) => ({
    judge_id: `j${index}`, name, role: name === "Admin" ? "admin" : "judge", photo_data: "", assigned_block_ids: [],
  }));
  const routine = (id, block_id, name, genre, team) => ({
    routine: { routine_id: id, block_id, name, genre, academy: "Academia", division: "Teen", category: "Solo", level: "Intermedio", updated_at: "2026-11-11" },
    row: { id, name, genre, blockId: block_id, blockName: block_id, status: "pending", completedJudges: 0,
      expectedJudges: team.length, judges: team.map((name) => ({ id: judges.find((judge) => judge.name === name).judge_id,
        name, status: "pending", subtotal: null, total: null, penalty: 0, criteria: [], feedback: "" })) },
  });
  const entries = [
    routine("m1", "motion", "Jazz primero", "JAZZ", motion),
    routine("m2", "motion", "Lírico segundo", "LÍRICO", motion),
    routine("a1", "aerial", "Tela", "TELA", aerial),
    routine("x1", "mixed", "Jazz mixto", "JAZZ", motion),
    routine("x2", "mixed", "Aro mixto", "ARO", aerial),
  ];
  const event = { id: "event", name: "Levitate", event_type: "event", is_active: true };
  return {
    event, judges, routines: entries.map((item) => item.routine),
    blocks: ["motion", "aerial", "mixed", "empty"].map((block_id) => ({ block_id, name: block_id, title: block_id })),
    favorites: [], specialAwards: [], accounts: [],
    snapshot: { fetchedAt: "2026-11-11T12:00:00Z", warnings: [], rows: entries.map((item) => item.row), report: { maximumScore: 150, blocks: [] } },
  };
}

function find(element, predicate) {
  if (!element || typeof element !== "object") return null;
  if (Array.isArray(element)) {
    for (const child of element) {
      const result = find(child, predicate);
      if (result) return result;
    }
    return null;
  }
  return predicate(element) ? element : find(element.props?.children, predicate);
}

function harness(bundle = fixture()) {
  const state = [ [bundle.event], bundle.event.id, bundle, "scores", "motion", "", "all", [], false, "", "", "", "Admin", "judging_admin", null, "", [], "dark" ];
  let cursor = 0;
  const mockedReact = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useEffect() {},
    useRef(value) { return { current: value }; },
    useCallback(callback) { return callback; },
  };
  const scope = {
    exports: {}, URLSearchParams, Date, Map, Set,
    location: { search: "?event=event&view=scores" },
    localStorage: { getItem: () => "dark" },
    require(name) {
      if (name === "react") return mockedReact;
      if (name.endsWith("registrationApi")) return { requestRegistrationApi() { throw new Error("Unexpected API call"); } };
      if (name.endsWith("JudgingScoresPanel")) return {};
      if (name.endsWith("judgePortraits")) return { resolveJudgePortrait: () => undefined };
      if (name.endsWith("registrationAccess")) return { judgingRelevePath: "/jueceo/releve" };
      if (name.endsWith(".css")) return {};
      return require(name);
    },
  };
  vm.runInNewContext(javascript, scope);
  const tree = () => { cursor = 0; return scope.exports.JudgingAdminWorkspace(); };
  const change = (predicate, value) => {
    const element = find(tree(), predicate);
    assert.ok(element, "Expected workspace control");
    element.props.onChange({ target: { value } });
  };
  return {
    tree,
    header() {
      const matrix = find(tree(), (element) => element.type === "table" && element.props.className === "ja-matrix");
      return renderToStaticMarkup(find(matrix, (element) => element.type === "thead"));
    },
    block(value) { change((element) => element.type === "select" && element.props.value === state[4], value); },
    query(value) { change((element) => element.type === "input" && element.props["aria-label"] === "Buscar coreografía", value); },
    status(value) { change((element) => element.type === "select" && element.props.value === state[6], value); },
    view(value) { state[3] = value; },
  };
}

test("score columns follow the selected block's snapshot judges and preserve both Daniel identities", () => {
  const view = harness();
  let html = view.header();
  for (const name of motion) assert.ok(html.includes(name), name);
  for (const name of [...aerial, "Otra jueza", "Admin"]) assert.ok(!html.includes(name), name);
  view.block("aerial");
  html = view.header();
  for (const name of aerial) assert.ok(html.includes(name), name);
  for (const name of motion) assert.ok(!html.includes(name), name);
  view.block("empty");
  assert.doesNotMatch(view.header(), /ja-column-label/);
});

test("search and status filters do not remove the block's judge columns", () => {
  const view = harness(), original = view.header();
  view.query("No coincide");
  let filtered = view.header();
  for (const name of motion) assert.ok(filtered.includes(name), name);
  assert.equal((filtered.match(/ja-column-label/g) || []).length, 3);
  view.status("complete");
  filtered = view.header();
  for (const name of motion) assert.ok(filtered.includes(name), name);
  assert.equal((original.match(/ja-column-label/g) || []).length, 3);
});

test("a mixed block disables cells outside each routine's team despite empty source assignments", () => {
  const view = harness();
  view.block("mixed");
  const tree = view.tree();
  const button = (judge, routine) => find(tree, (element) => element.type === "button"
    && element.props.title === `Editar hoja de ${judge} · ${routine}`);
  assert.equal(button("EVA CARRILLO", "Jazz mixto").props.disabled, false);
  assert.equal(button("DANIEL HERRERA", "Jazz mixto").props.disabled, true);
  assert.equal(button("DANIEL HERRERA", "Aro mixto").props.disabled, false);
  assert.equal(button("DANIEL MONTALVO", "Aro mixto").props.disabled, true);
});

test("judge management retains the event roster when the score columns are narrower", () => {
  const bundle = fixture(), view = harness(bundle);
  view.view("judges");
  const panel = find(view.tree(), (element) => element.type?.name === "JudgesPanel");
  assert.ok(panel);
  assert.equal(panel.props.judges.length, 7);
  assert.ok(panel.props.judges.some((judge) => judge.name === "Otra jueza"));
  for (const name of [...motion, ...aerial]) assert.ok(panel.props.judges.some((judge) => judge.name === name));
  assert.ok(!panel.props.judges.some((judge) => judge.name === "Admin"));
});
