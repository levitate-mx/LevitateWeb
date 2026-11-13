import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { compactJudgingCategoryTitle } from "../shared/judging-category-title.js";

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
  const navigation = [];
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
    location: { search: "?event=event&view=scores", assign: url => navigation.push(url) },
    localStorage: { getItem: () => "dark" },
    require(name) {
      if (name === "react") return mockedReact;
      if (name.endsWith("registrationApi")) return { requestRegistrationApi() { throw new Error("Unexpected API call"); } };
      if (name.endsWith("JudgingScoresPanel")) return {};
      if (name.endsWith("judging-category-title.js")) return { compactJudgingCategoryTitle };
      if (name.endsWith("judgePortraits")) return { resolveJudgePortrait: () => undefined };
      if (name.endsWith('ReleveVotingAdminPanel')) return { ReleveVotingAdminPanel: () => null };
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
    navigation,
    activity(value) {state[7] = value;},
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

test("activity lives in score editing and iOS viewing_sheet presence marks only the current assigned cell", () => {
  const view = harness();
  const presence = (state, minutes=0) => ({judge_id: "j0", device_id: "ios", state, routine_id: "m1", updated_at: new Date(Date.now()-minutes*60000).toISOString()});
  view.activity([presence("viewing_sheet", 5)]);
  const cell = () => find(view.tree(), node => node.type === "button" && node.props.title === "Editar hoja de EVA CARRILLO · Jazz primero");
  assert.match(cell().props.className, /is-active/);
  assert.match(renderToStaticMarkup(cell()), /Hoja abierta/);
  const html = renderToStaticMarkup(view.tree());
  assert.match(html, /Actividad de jueces/);
  assert.doesNotMatch(html, /Ranking en vivo/);
  assert.ok(!find(view.tree(), node => node.props?.["aria-pressed"] !== undefined && /Actividad/.test(renderToStaticMarkup(node))));
  view.activity([presence("viewing_sheet", 11)]);
  assert.doesNotMatch(cell().props.className, /is-active/);
  view.activity([presence("viewing_sheet", 5), presence("home")]);
  assert.doesNotMatch(cell().props.className, /is-active/, "a newer home report ends the old sheet presence");
  view.activity([presence("left_sheet")]);
  assert.doesNotMatch(cell().props.className, /is-active/);
  view.activity([{...presence("viewing_sheet"),routine_id:"m2"}]);
  assert.doesNotMatch(cell().props.className, /is-active/);
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

test("programme numbers are visible and searchable while opening the editor uses the stable internal ID", () => {
  const bundle = fixture();
  bundle.routines[0].program_number = "194 a";
  bundle.snapshot.rows[0].programNumber = "194 a";
  const view = harness(bundle);
  view.query("194 a");
  const html = renderToStaticMarkup(view.tree());
  assert.match(html, />#194 a</);
  assert.match(html, /Jazz primero/);
  assert.doesNotMatch(html, /Lírico segundo/);
  const edit = find(view.tree(), element => element.type === "button"
    && element.props.title === "Editar hoja de EVA CARRILLO · Jazz primero");
  assert.ok(edit);
  edit.props.onClick();
  assert.equal(new URL(view.navigation[0], "https://levitate.mx").searchParams.get("routine"), "m1");
});

test("judge column headers show the actual open sheet even when filters hide it or it belongs to another block", () => {
  const bundle = fixture();
  bundle.routines[0].program_number = "194 a";
  bundle.blocks[0].title = "Bloque Motion";
  const view = harness(bundle);
  view.activity([{ judge_id: "j0", device_id: "ios", state: "viewing_sheet", routine_id: "m1", updated_at: new Date().toISOString() }]);
  let header = view.header();
  assert.match(header, /Hoja abierta/);
  assert.match(header, /#194 a · Jazz primero/);
  assert.doesNotMatch(header, /Calificando/);
  view.query("No coincide esta coreografía");
  view.status("complete");
  header = view.header();
  assert.match(header, /#194 a · Jazz primero/);
  view.block("mixed");
  header = view.header();
  assert.match(header, /#194 a · Jazz primero/);
  assert.match(header, /Bloque Motion/);
});

test("judge headers distinguish home, closed, stale and missing activity, using the latest device report", () => {
  const view = harness();
  const presence = (state, minutes = 0, device_id = "ios") => ({ judge_id: "j0", device_id, state, routine_id: "m1", updated_at: new Date(Date.now() - minutes * 60000).toISOString() });
  assert.match(view.header(), /Sin actividad registrada/);
  for (const state of ["viewing_sheet", "judging"]) {
    view.activity([presence(state)]);
    assert.match(view.header(), /Hoja abierta/);
    assert.match(view.header(), /#m1 · Jazz primero/);
    assert.doesNotMatch(view.header(), /Calificando/);
  }
  view.activity([presence("viewing_sheet", 5), presence("home", 0, "web")]);
  assert.match(view.header(), /En inicio/);
  assert.doesNotMatch(view.header(), /#m1 · Jazz primero/);
  view.activity([presence("viewing_sheet", 5), presence("left_sheet", 0, "web")]);
  assert.match(view.header(), /Hoja cerrada/);
  assert.doesNotMatch(view.header(), /#m1 · Jazz primero/);
  view.activity([presence("viewing_sheet", 11)]);
  assert.match(view.header(), /Sin actividad reciente/);
  assert.doesNotMatch(view.header(), /#m1 · Jazz primero/);
  view.activity([{ ...presence("viewing_sheet"), routine_id: "removed-routine" }]);
  assert.match(view.header(), /Coreografía no disponible/);
  assert.doesNotMatch(view.header(), /#removed-routine|#m1 · Jazz primero/);
});

test("the total column sums the recorded judge scores instead of displaying the normalized report score", () => {
  const bundle = fixture(), row = bundle.snapshot.rows[0];
  row.status = "partial"; row.completedJudges = 1;
  row.judges[0] = { ...row.judges[0], status: "complete", subtotal: 19, total: 19, maximumScore: 70 };
  bundle.snapshot.report.blocks = [{ id: "motion", sections: [{ categories: [{ rows: [{ routineId: "m1", score: 19 / 210 * 150 }] }] }] }];
  const before = structuredClone(bundle), view = harness(bundle);
  const matrixRow = find(view.tree(), node => node.type === "tr" && node.key === "m1");
  const total = find(matrixRow, node => node.type === "td" && node.props.className === "ja-total");
  const html = renderToStaticMarkup(total);
  assert.match(view.header(), /Puntaje total/);
  assert.doesNotMatch(view.header(), /Puntaje oficial|\/ 150/);
  assert.match(html, /<strong>19<\/strong>/);
  assert.match(html, /1\/3 jueces/);
  assert.match(html, /Provisional/);
  assert.doesNotMatch(html, /Oficial|13\.57/);
  const judgeCell = find(matrixRow, node => node.type === "button" && node.props.title === "Editar hoja de EVA CARRILLO · Jazz primero");
  assert.match(renderToStaticMarkup(judgeCell), /<strong>19<\/strong>/);
  assert.deepEqual(bundle, before);
});

test("matrix totals round only their display and distinguish an actual zero from pending or unavailable data", () => {
  for (const [status, score, expected, label] of [
    ["complete", 12.1, "12", "Oficial"], ["complete", 12.9, "13", "Oficial"],
    ["partial", 12.9, "13", "Provisional"], ["complete", 0, "0", "Oficial"],
    ["pending", 0, "—", "Pendiente"], ["unavailable", 12.9, "—", "No disponible"],
    ["complete", null, "—", "No disponible"],
  ]) {
    const bundle = fixture(), row = bundle.snapshot.rows[0];
    row.status = status; row.completedJudges = status === "complete" ? 3 : status === "partial" ? 1 : 0;
    row.judges[0].total = score;
    row.judges[0].status = status === "pending" ? "pending" : "complete";
    for (const judge of row.judges.slice(1)) { judge.total = status === "complete" && score !== null ? 0 : null; judge.status = status === "complete" && score !== null ? "complete" : "pending"; }
    bundle.snapshot.report.blocks = [{ id: "motion", sections: [{ categories: [{ rows: [{ routineId: "m1", score: 140 }] }] }] }];
    const before = structuredClone(bundle), view = harness(bundle);
    const matrixRow = find(view.tree(), node => node.type === "tr" && node.key === "m1");
    const total = renderToStaticMarkup(find(matrixRow, node => node.type === "td" && node.props.className === "ja-total"));
    assert.ok(total.includes(`<strong>${expected}</strong>`), `${status} with ${score}`);
    assert.ok(total.includes(label));
    assert.doesNotMatch(total, />12\.[19]</);
    if (score != null) assert.ok(renderToStaticMarkup(find(matrixRow, node => node.type === "button" && node.props.title === "Editar hoja de EVA CARRILLO · Jazz primero")).includes(`<strong>${score}</strong>`), "individual judge totals preserve their original precision");
    assert.deepEqual(bundle, before, "source scores retain their decimal precision");
  }
});


test("matrix totals sum all real judge totals, including zero and already-applied penalties, without altering report results", () => {
  for (const { status, totals, expected } of [
    { status: "partial", totals: [19, null, null], expected: "19" },
    { status: "partial", totals: [43, null, null], expected: "43" },
    { status: "partial", totals: [0, null, null], expected: "0" },
    { status: "partial", totals: [19, 43, null], expected: "62" },
    { status: "complete", totals: [19, 43, 50], expected: "112" },
    { status: "complete", totals: [70, 70, 70], expected: "210" },
    { status: "complete", totals: [0, 0, 0], expected: "0" },
    { status: "pending", totals: [0, 0, 0], expected: "—" },
    { status: "unavailable", totals: [19, 43, 50], expected: "—" },
    { status: "partial", totals: [19, NaN, null], expected: "19" },
  ]) {
    const bundle = fixture(), row = bundle.snapshot.rows[0];
    row.status = status;
    row.completedJudges = totals.filter(value => Number.isFinite(value)).length;
    row.judges = row.judges.map((judge, index) => ({ ...judge, total: totals[index],
      status: status === "pending" || totals[index] === null ? "pending" : "complete",
      subtotal: totals[index] === null ? null : totals[index] + index + 1, penalty: -(index + 1),
    }));
    bundle.snapshot.report.blocks = [{ id: "motion", sections: [{ categories: [{ rows: [{ routineId: "m1", score: 13.571428571 }] }] }] }];
    const before = structuredClone(bundle), view = harness(bundle);
    const matrixRow = find(view.tree(), node => node.type === "tr" && node.key === "m1");
    const html = renderToStaticMarkup(find(matrixRow, node => node.type === "td" && node.props.className === "ja-total"));
    assert.ok(html.includes(`<strong>${expected}</strong>`), `${status} ${totals.join("+")}`);
    assert.doesNotMatch(view.header(), /\/ 150/);
    if (status === "partial") assert.match(html, /Provisional/);
    if (status === "complete") assert.match(html, /Oficial/);
    assert.deepEqual(bundle, before, "the matrix must neither recompute penalties nor modify official report totals");
  }
});

test("home and score editing show one activity panel above their main content with every event judge", () => {
  const bundle = fixture(), view = harness(bundle);
  bundle.routines[0].program_number = "194 a";
  bundle.blocks[0].title = "Bloque Motion";
  view.activity([{ judge_id: "j0", device_id: "ios", state: "viewing_sheet", routine_id: "m1", updated_at: new Date().toISOString() }]);
  for (const screen of ["home", "scores"]) {
    view.view(screen);
    const tree = view.tree();
    const panel = find(tree, node => node.type?.name === "ActivityPanel");
    assert.ok(panel);
    assert.equal(panel.props.judges.length, 7);
    assert.equal(panel.props.routines.length, bundle.routines.length);
    for (const name of [...motion, ...aerial, "Otra jueza"]) assert.ok(panel.props.judges.some(judge => judge.name === name));
    assert.ok(!panel.props.judges.some(judge => judge.name === "Admin"));
    const panelHtml = renderToStaticMarkup(panel);
    assert.equal((panelHtml.match(/<article>/g) || []).length, 7);
    assert.match(panelHtml, /Hoja abierta · #194 a · Jazz primero/);
    assert.match(panelHtml, /Bloque Motion/);
    assert.doesNotMatch(panelHtml, /<details open/);
    const html = renderToStaticMarkup(tree);
    assert.equal((html.match(/aria-label="Actividad de jueces"/g) || []).length, 1);
    assert.match(html, /Todos los bloques · cada 10 s/);
    const content = screen === "home" ? 'class="ja-overview"' : 'class="ja-table-scroll"';
    assert.ok(html.indexOf('aria-label="Actividad de jueces"') < html.indexOf(content));
  }
});

test("the activity overview keeps all judges and their actual sheets across selected blocks and filters", () => {
  const bundle = fixture(), view = harness(bundle);
  bundle.routines.find(row => row.routine_id === "a1").program_number = "205";
  bundle.blocks.find(block => block.block_id === "aerial").title = "Bloque Aerial";
  view.activity([{ judge_id: "j3", device_id: "ios", state: "viewing_sheet", routine_id: "a1", updated_at: new Date().toISOString() }]);
  const panelHtml = () => renderToStaticMarkup(find(view.tree(), node => node.type?.name === "ActivityPanel"));
  const before = panelHtml();
  assert.match(before, /DANIEL HERRERA/);
  assert.match(before, /Hoja abierta · #205 · Tela/);
  assert.match(before, /Bloque Aerial/);
  assert.doesNotMatch(view.header(), /DANIEL HERRERA/);
  view.query("Ninguna coincidencia");
  view.status("complete");
  assert.equal(panelHtml(), before);
  view.block("empty");
  assert.equal(panelHtml(), before, "an empty selected block must not erase event-wide activity");
  view.view("home");
  assert.equal(panelHtml(), before);
});

test("activity cards expose explicit current states without inventing a sheet and keep technical details collapsed", () => {
  const view = harness();
  view.view("home");
  const presence = (state, minutes = 0) => ({ judge_id: "j0", device_id: "ios", state, routine_id: "m1", updated_at: new Date(Date.now() - minutes * 60000).toISOString() });
  const cardHtml = () => {
    const panel = find(view.tree(), node => node.type?.name === "ActivityPanel");
    const narrowed = { ...panel, props: { ...panel.props, judges: panel.props.judges.filter(judge => judge.judge_id === "j0") } };
    return renderToStaticMarkup(narrowed);
  };
  assert.match(cardHtml(), /Sin actividad registrada/);
  view.activity([presence("viewing_sheet")]);
  assert.match(cardHtml(), /Hoja abierta · #m1 · Jazz primero/);
  for (const [state, label] of [["home", "En inicio"], ["left_sheet", "Hoja cerrada"]]) {
    view.activity([presence(state)]);
    const html = cardHtml();
    assert.match(html, new RegExp(label));
    const summary = html.slice(html.indexOf("<summary>"), html.indexOf("</summary>"));
    assert.doesNotMatch(summary, /Hoja abierta|#m1|Jazz primero/);
    assert.doesNotMatch(html, /<details open/);
  }
  view.activity([presence("viewing_sheet", 11)]);
  const stale = cardHtml();
  const summary = stale.slice(stale.indexOf("<summary>"), stale.indexOf("</summary>"));
  assert.match(summary, /Sin actividad reciente/);
  assert.doesNotMatch(summary, /Hoja abierta|#m1|Jazz primero/);
  assert.doesNotMatch(stale, /<details open/);
});
