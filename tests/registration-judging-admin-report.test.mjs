import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ChevronDown, Trophy, X } from "lucide-react";
import ts from "typescript";
import { normalizeAdminSearch } from "../src/components/admin/adminNavigation.ts";

function declarations(source, functions, constants) {
  const syntax = ts.createSourceFile("report.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return [
    ...constants.map((name) => syntax.statements.find((node) => ts.isVariableStatement(node)
      && node.declarationList.declarations.some((entry) => entry.name.getText(syntax) === name))),
    ...functions.map((name) => syntax.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name)),
  ].map((node) => {
    assert.ok(node, "the test must use an existing application declaration");
    return node.getText(syntax);
  }).join("\n");
}
const previous = await readFile(new URL("../src/components/admin/JudgingScoresPanel.tsx", import.meta.url), "utf8");
const workspace = await readFile(new URL("../src/components/judging/JudgingAdminWorkspace.tsx", import.meta.url), "utf8");
const javascript = ts.transpileModule([
  declarations(previous, ["scoreValue", "reportScoreValue", "blockKey", "blockLabel", "JudgeBreakdown", "filterReportSections", "DictamenEntry"], ["statusLabels", "scoreFormatter"]),
  declarations(workspace, ["Empty", "ReportPanel"], ["labels", "number"]),
  "globalThis.renderReport = ReportPanel;",
].join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function fixture() {
  const judge = {
    id: "daniel", name: "DANIEL", status: "complete", subtotal: 98.25, penalty: -1.5,
    total: 96.75, maximumScore: 100,
    criteria: [{ id: 1, label: "Técnica", section: "Ejecución", value: 18.25, maximumScore: 20 }],
    feedback: "Buen trabajo <b>equipo</b>\nSigan practicando.",
  };
  const row = (id, fields = {}) => ({
    id, name: `Vuelo ${id}`, academy: "Academia Águila", state: "Estado de México", genre: "Aro",
    division: "Teen", level: "Intermedio", category: "Solo", blockId: "b1", blockName: "Bloque 1",
    status: "complete", completedJudges: 1, expectedJudges: 1, recordedScores: 1, judges: [judge], ...fields,
  });
  const standing = (routineId, score, rank) => ({ routineId, score,
    placement: rank == null ? null : { rank, label: `${rank}.º lugar`, isFirstPlace: rank === 1, isParticipation: false } });
  const rows = [
    row("1"),
    row("2", { name: "Danza Áurea", genre: "Tela", status: "partial", completedJudges: 0,
      judges: [{ ...judge, status: "partial", subtotal: 0, total: 0, penalty: 0,
        criteria: [...judge.criteria, { id: 2, label: "Pendiente", section: "Técnica", value: null, maximumScore: 20 }] }] }),
    row("3", { name: "Cero registrado" }),
    row("4", { name: "Sin notas", status: "pending", completedJudges: 0, recordedScores: 0, judges: [] }),
    row("5", { name: "No disponible", status: "unavailable", judges: [] }),
  ];
  const report = {
    id: "b1", name: "Bloque 1", title: "Final de prueba", isActive: true,
    sections: [
      { id: "ARO", label: "Aro", categories: [{ id: "aro-teen", title: "Teen Intermedio Solo",
        rows: [standing("4", 0, null), standing("5", null, null), standing("3", 0, 2), standing("1", 140, 1)] }] },
      { id: "TELA", label: "Tela", categories: [{ id: "tela-teen", title: "Teen Intermedio Solo", rows: [standing("2", 110, 3)] }] },
    ],
    counts: { disciplines: 2, categories: 2, scored: 3, total: 5 },
    specialAwards: [{ id: "award_1", title: "Mejor vestuario", displayValue: "Academia premiada", isAssigned: true, routineId: null }],
    topScore: { routineId: "1", score: 140 },
  };
  return { event: { id: "levitate-fixture", name: "Levitate de prueba" }, snapshot: { rows, report: { maximumScore: 150, blocks: [report] } } };
}

function findElement(element, predicate) {
  if (!element || typeof element !== "object") return null;
  if (Array.isArray(element)) {
    for (const child of element) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  return predicate(element) ? element : findElement(element.props?.children, predicate);
}

function harness(bundle = fixture(), ranking = false) {
  const state = [];
  let cursor = 0;
  const scope = { require: createRequire(import.meta.url), exports: {}, normalizeAdminSearch, ChevronDown, Trophy, X,
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    },
  };
  vm.runInNewContext(javascript, scope);
  const tree = () => {
    cursor = 0;
    return scope.renderReport({ report: bundle.snapshot.report.blocks[0], bundle, ranking });
  };
  return {
    html: () => renderToStaticMarkup(tree()),
    change(field, value) {
      const element = findElement(tree(), (node) => field === "query" ? node.type === "input"
        : node.type === "select" && node.props.value === state[field === "discipline" ? 1 : 2]
          && findElement(node.props.children, (option) => option.type === "option" && option.props.value === (field === "discipline" ? "TELA" : "partial")));
      assert.ok(element, `missing filter ${field}`);
      element.props.onChange({ target: { value } });
    },
    toggle(id) {
      const entry = findElement(tree(), (node) => node.props?.standing?.routineId === id);
      assert.ok(entry, `missing entry ${id}`);
      entry.props.onToggle();
    },
    clear() {
      const button = findElement(tree(), (node) => node.type === "button");
      assert.ok(button, "missing clear filters button");
      button.props.onClick();
    },
  };
}

test("the new admin reuses the existing read-only entry and filter implementations", () => {
  assert.match(workspace, /import \{ DictamenEntry, filterReportSections \} from "\.\.\/admin\/JudgingScoresPanel"/);
  assert.match(workspace, /key=\{`\$\{eventId\}:\$\{blockId\}:\$\{view\}`\}/, "event, block and view changes reset local report filters and expanded details");
  const ui = harness().html();
  assert.match(ui, /Filtros del dictamen/);
  assert.match(ui, /Buscar coreografía/);
  assert.match(ui, /Estado de evaluación/);
  assert.match(ui, /Ver detalle de Vuelo 1/);
  assert.match(ui, />#1</);
  assert.match(ui, />Intermedio</);
  assert.match(ui, />Solo</);
  assert.match(ui, /judging-scores__status is-complete/);
  assert.match(ui, /TOP SCORE/);
  assert.match(ui, /Mejor vestuario/);
});

test("combined search, discipline and evaluation filters retain official places and do not mutate the bundle", () => {
  const bundle = fixture(), before = structuredClone(bundle), view = harness(bundle);
  view.change("query", "aurea");
  view.change("discipline", "TELA");
  view.change("status", "partial");
  const ui = view.html();
  assert.match(ui, /Danza Áurea/);
  assert.match(ui, /1 de 5 coreografías/);
  assert.match(ui, /3\.º lugar/);
  assert.doesNotMatch(ui, /Ver detalle de Vuelo 1|Ver detalle de Cero registrado/);
  assert.match(ui, /TOP SCORE/);
  assert.match(ui, /Academia premiada/);
  assert.deepEqual(bundle, before);
  view.clear();
  assert.match(view.html(), /Ver detalle de Vuelo 1/);
  assert.doesNotMatch(view.html(), /Limpiar filtros/);
});

test("search includes state, ID, level and division without recalculating scores", () => {
  for (const query of ["estado de mexico", "intermedio", "teen", "aguila"]) {
    const view = harness();
    view.change("query", query);
    assert.match(view.html(), /5 de 5 coreografías/);
  }
  const view = harness();
  view.change("query", "2");
  assert.match(view.html(), /1 de 5 coreografías/);
  assert.match(view.html(), /3\.º lugar/);
});

test("expanding a choreography shows the original criterion values, penalties, totals and escaped comments", () => {
  const view = harness();
  assert.doesNotMatch(view.html(), /Subtotal registrado/);
  view.toggle("1");
  const ui = view.html();
  assert.match(ui, /aria-expanded="true"/);
  assert.match(ui, /judging-score-detail-levitate-fixture-b1-1/);
  assert.match(ui, /DANIEL/);
  assert.match(ui, /<td>18.25<\/td>/);
  assert.match(ui, /Subtotal registrado<\/dt><dd>98.25<\/dd>/);
  assert.match(ui, /Penalización<\/dt><dd>-1.5<\/dd>/);
  assert.match(ui, /Total del juez<\/dt><dd>96.75/);
  assert.match(ui, /Escala de 150 puntos/);
  assert.match(ui, /Buen trabajo &lt;b&gt;equipo&lt;\/b&gt;/);
  assert.doesNotMatch(ui, /<b>equipo<\/b>/);
  view.toggle("1");
  assert.doesNotMatch(view.html(), /Subtotal registrado/);
});

test("changing filters closes details and incomplete sheets preserve zero versus pending criteria", () => {
  const view = harness();
  view.toggle("1");
  view.change("status", "partial");
  assert.doesNotMatch(view.html(), /Subtotal registrado/);
  view.toggle("2");
  const ui = view.html();
  assert.match(ui, /Incompleta/);
  assert.match(ui, /<td>Pendiente<\/td>/);
  assert.match(ui, /Total registrado \(parcial\)<\/dt><dd>0/);
  assert.match(ui, /0\/1 jueces completos/);
});

test("refreshing an expanded sheet reads fresh server values without changing its selection or placement", () => {
  const bundle = fixture(), view = harness(bundle);
  view.change("query", "Vuelo 1");
  view.toggle("1");
  bundle.snapshot.rows[0].judges[0].total = 95.5;
  bundle.snapshot.rows[0].judges[0].feedback = "Devolución actualizada";
  const ui = view.html();
  assert.match(ui, /aria-expanded="true"/);
  assert.match(ui, /Total del juez<\/dt><dd>95.5/);
  assert.match(ui, /Devolución actualizada/);
  assert.match(ui, /1 de 5 coreografías/);
  assert.match(ui, /1\.º lugar/);
});

test("no-note, unavailable and explicitly recorded zero routines retain distinct displays", () => {
  const view = harness();
  view.change("status", "pending");
  assert.match(view.html(), /Sin notas/);
  assert.match(view.html(), /Sin lugar asignado/);
  assert.doesNotMatch(view.html(), />0<|[123]\.º lugar/);
  view.change("status", "unavailable");
  assert.match(view.html(), /No disponible/);
  assert.doesNotMatch(view.html(), />0<|[123]\.º lugar/);
  view.change("status", "complete");
  view.change("query", "cero registrado");
  assert.match(view.html(), />0</);
  assert.match(view.html(), /2\.º lugar/);
});

test("empty filters show an explicit state without hiding block-wide top score and awards", () => {
  const view = harness();
  view.change("query", "No existe esta coreografía");
  const ui = view.html();
  assert.match(ui, /0 de 5 coreografías/);
  assert.match(ui, /No hay coreografías que coincidan/);
  assert.match(ui, /TOP SCORE/);
  assert.match(ui, /Academia premiada/);
  assert.doesNotMatch(ui, /aria-expanded/);
});

test("live ranking keeps descending server scores, filters and the original category places", () => {
  const view = harness(fixture(), true);
  let ui = view.html();
  assert.match(ui, /Ranking en vivo/);
  assert.ok(ui.indexOf("Ver detalle de Vuelo 1") < ui.indexOf("Ver detalle de Danza Áurea"));
  view.change("discipline", "TELA");
  ui = view.html();
  assert.match(ui, /Ver detalle de Danza Áurea/);
  assert.match(ui, /3\.º lugar/);
  assert.doesNotMatch(ui, /Ver detalle de Vuelo 1/);
});
