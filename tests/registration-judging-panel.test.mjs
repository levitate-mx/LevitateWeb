import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { normalizeAdminSearch } from "../src/components/admin/adminNavigation.ts";

const source = await readFile(new URL("../src/components/admin/JudgingScoresPanel.tsx", import.meta.url), "utf8");
const syntax = ts.createSourceFile("JudgingScoresPanel.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functionNames = ["scoreValue", "disciplineName", "blockKey", "blockLabel", "JudgeBreakdown"];
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
const scope = { require: createRequire(import.meta.url), exports: {}, normalizeAdminSearch };
vm.runInNewContext(javascript, scope);
const { scoreValue, disciplineName, blockKey, blockLabel, JudgeBreakdown } = scope.helpers;

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
