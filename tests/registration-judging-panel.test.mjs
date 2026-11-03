import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { Building2, ChevronDown, MapPin } from "lucide-react";
import { normalizeAdminSearch } from "../src/components/admin/adminNavigation.ts";

const source = await readFile(new URL("../src/components/admin/JudgingScoresPanel.tsx", import.meta.url), "utf8");
const syntax = ts.createSourceFile("JudgingScoresPanel.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functionNames = ["scoreValue", "reportScoreValue", "disciplineName", "blockKey", "blockLabel", "JudgeBreakdown", "filterReportSections", "DictamenEntry"];
const declarations = functionNames.map((name) => {
  const declaration = syntax.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `missing application function ${name}`);
  return declaration.getText(syntax);
});
for (const name of ["statusLabels", "scoreFormatter"]) {
  const declaration = syntax.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((entry) => entry.name.getText(syntax) === name));
  assert.ok(declaration, `missing application constant ${name}`);
  declarations.unshift(declaration.getText(syntax));
}
const javascript = ts.transpileModule(`${declarations.join("\n")}\nglobalThis.helpers = { ${functionNames.join(",")} };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const scope = { require: createRequire(import.meta.url), exports: {}, normalizeAdminSearch, Building2, ChevronDown, MapPin };
vm.runInNewContext(javascript, scope);
const { scoreValue, reportScoreValue, disciplineName, blockKey, blockLabel, JudgeBreakdown, filterReportSections, DictamenEntry } = scope.helpers;

const judge = (overrides = {}) => ({
  id: "judge-1", name: "Jueza de prueba", status: "complete", subtotal: 98.25, penalty: 1.5,
  total: 96.75, maximumScore: 100, criteria: [{ id: 1, label: "Técnica", section: "Ejecución", value: 18.25, maximumScore: 20 }],
  feedback: "", ...overrides,
});

test("score display preserves an actual zero and fractional scores without replacing pending data", () => {
  assert.equal(scoreValue(null), "Pendiente");
  assert.equal(scoreValue(0), "0");
  assert.equal(scoreValue(7.1234567), "7.1234567");
  assert.equal(scoreValue(Infinity), "No disponible");
  assert.equal(scoreValue(NaN), "No disponible");
});

test("judge detail renders the exact server-provided breakdown, maximum, and escaped feedback", () => {
  const html = renderToStaticMarkup(JudgeBreakdown({ judge: judge({ feedback: "Buen trabajo <b>equipo</b>\nSigan practicando." }) }));
  assert.match(html, /Completa/);
  assert.match(html, /Técnica/);
  assert.match(html, /Ejecución/);
  assert.match(html, /<td>18.25<\/td>/);
  assert.match(html, /Subtotal registrado<\/dt><dd>98.25<\/dd>/);
  assert.match(html, /Penalización<\/dt><dd>1.5<\/dd>/);
  assert.match(html, /Total del juez<\/dt><dd>96.75<small> \/ 100<\/small>/);
  assert.match(html, /Buen trabajo &lt;b&gt;equipo&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>equipo<\/b>/);
  assert.doesNotMatch(html, /resultado general|posición|ranking/i);
});

test("incomplete evaluations keep missing criteria and totals pending while valid zero criteria remain visible", () => {
  const html = renderToStaticMarkup(JudgeBreakdown({ judge: judge({
    status: "partial", subtotal: null, penalty: 0, total: null, maximumScore: null,
    criteria: [
      { id: 1, label: "Criterio evaluado", section: "Técnica", value: 0, maximumScore: 20 },
      { id: 2, label: "Criterio pendiente", section: "Técnica", value: null, maximumScore: 20 },
    ],
  }) }));
  assert.match(html, /Incompleta/);
  assert.match(html, /Criterio evaluado[\s\S]*?<td>0<\/td>/);
  assert.match(html, /Criterio pendiente[\s\S]*?<td>Pendiente<\/td>/);
  assert.match(html, /Penalización<\/dt><dd>0<\/dd>/);
  assert.match(html, /Total registrado \(parcial\)<\/dt><dd>Pendiente<\/dd>/);
  assert.doesNotMatch(html, /\/ Pendiente|>NaN<|>null</);
});

test("pending judges have an explicit empty-criteria state and no invented score", () => {
  const html = renderToStaticMarkup(JudgeBreakdown({ judge: judge({ status: "pending", criteria: [], subtotal: null, total: null }) }));
  assert.match(html, /Todavía no hay criterios registrados/);
  assert.match(html, /Total del juez<\/dt><dd>Pendiente<\/dd>/);
});

test("block and discipline labels preserve supplied values and distinguish an unassigned block", () => {
  assert.equal(disciplineName("aéreo"), "Aerial");
  assert.equal(disciplineName("MOTION"), "Motion");
  assert.equal(disciplineName("Otra disciplina"), "Otra disciplina");
  assert.equal(blockKey({ blockId: null }), "unassigned");
  assert.equal(blockLabel({ blockId: null, blockName: "" }), "Sin bloque");
  for (const blockId of ["", "   "]) {
    assert.equal(blockKey({ blockId }), "unassigned");
    assert.equal(blockLabel({ blockId, blockName: "   " }), "Sin bloque");
  }
  assert.equal(blockKey({ blockId: 0 }), "0");
  assert.equal(blockLabel({ blockId: 0, blockName: "" }), "Bloque 0");
  assert.equal(blockLabel({ blockId: 3, blockName: "Final" }), "Final");
});

const choreography = (id, overrides = {}) => ({
  id, name: `Vuelo ${id}`, academy: "Academia Águila", state: "Estado de México", genre: "Aro", division: "Teen",
  category: "Solo", level: "Intermedio", blockId: "b1", blockName: "Bloque 1", status: "complete",
  completedJudges: 1, expectedJudges: 1, recordedScores: 1, judges: [judge()], ...overrides,
});
const standing = (routineId, rank, score) => ({ routineId, score,
  placement: { rank, label: `${rank}°`, isFirstPlace: rank === 1, isParticipation: false } });

test("dictamen filters preserve the complete block's places and server announcement order", () => {
  const announced = [standing("2", 3, 112), standing("1", 2, 125), standing("3", 1, 140)];
  const block = { sections: [{ id: "ARO", label: "Aro", categories: [{ id: "teen-solo", title: "Teen Intermedio Solo", rows: announced }] }] };
  const rows = [choreography("1"), choreography("2", { name: "Danza Áurea", status: "partial" }), choreography("3")];
  const all = filterReportSections(block, rows, { query: "", discipline: "all", status: "all" });
  assert.deepEqual(Array.from(all[0].categories[0].rows, entry => entry.standing.routineId), ["2", "1", "3"]);
  const filtered = filterReportSections(block, rows, { query: "aurea", discipline: "ARO", status: "partial" });
  assert.equal(filtered[0].categories[0].rows.length, 1);
  assert.equal(filtered[0].categories[0].rows[0].standing, announced[0], "retain server values, never rerank a filtered subset");
  assert.equal(filtered[0].categories[0].rows[0].standing.placement.rank, 3);
  assert.equal(filterReportSections(block, rows, { query: "", discipline: "TELA", status: "all" }).length, 0);
  assert.equal(filterReportSections(null, rows, { query: "", discipline: "all", status: "all" }).length, 0);
});

test("dictamen cards show app score precision, position, academy and state with expandable judge sheets", () => {
  assert.equal(reportScoreValue(129.285714285), "129.3");
  assert.equal(reportScoreValue(0), "0");
  assert.equal(reportScoreValue(null), "Pendiente");
  const html = renderToStaticMarkup(DictamenEntry({
    standing: standing("3", 1, 129.285714285), row: choreography("3", { name: "Vuelo <final>" }), maximumScore: 150,
    eventId: "levitate-event", blockId: "b1", expanded: true, onToggle() {},
  }));
  assert.match(html, /judging-scores__entry is-first/);
  assert.match(html, /#3/);
  assert.match(html, /Vuelo &lt;final&gt;/);
  assert.match(html, /Academia Águila/);
  assert.match(html, /Estado de México/);
  assert.match(html, />129.3</);
  assert.match(html, /pts \/ 150/);
  assert.match(html, />1°</);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /Subtotal registrado/);
  assert.match(html, /judging-score-detail-levitate-event-b1-3/);
});

test("unavailable dictamen cards do not invent zero points or a placement", () => {
  const html = renderToStaticMarkup(DictamenEntry({ standing: { routineId: "3", score: null, placement: null },
    row: choreography("3", { status: "unavailable" }), maximumScore: 150, eventId: "levitate-event", blockId: "b1",
    expanded: false, onToggle() {},
  }));
  assert.match(html, /No disponible/);
  assert.match(html, /Pendiente/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /pts \/ 150|>0<|>1°<|is-first|Subtotal registrado/);
});
