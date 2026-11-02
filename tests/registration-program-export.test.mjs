import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/components/admin/RegistrationScreens.tsx", import.meta.url), "utf8");
const syntax = ts.createSourceFile("RegistrationScreens.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functionNames = [
  "buildProgramRows", "formatMusicDuration", "getProgramHeaders", "getProgramRowDisplay",
  "getProgramMusicDurationLabel", "isAerialProgramBlock", "toProgramUpper", "toProgramHtmlValue", "downloadProgramXls",
];
// Execute the real export functions without mounting the full admin application.
const functions = functionNames.map((name) => {
  const declaration = syntax.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `missing application function ${name}`);
  return declaration.getText(syntax);
}).join("\n");
const javascript = ts.transpileModule(`${functions}\nglobalThis.program = { ${functionNames.join(",")} };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function environment() {
  const downloads = [];
  const blobs = [];
  const scope = {
    Blob,
    URL: {
      createObjectURL(blob) { blobs.push(blob); return "blob:test-program"; },
      revokeObjectURL() {},
    },
    document: { createElement() { const link = { click() { downloads.push({ ...this }); } }; return link; } },
    getDanceProgramDivision: (dance) => dance.division,
    getProgramBlock: (dance) => ({ id: dance.blockId, title: dance.blockTitle }),
    compareProgramRows: (first, second) => first.danceTitle.localeCompare(second.danceTitle, "es"),
    normalizeProgramDivision: (division) => division,
    getProgramDivisionLabel: (division) => division,
    getDanceSubgenreLabel: (row) => row.subgenre,
    getOptionLabel: (_options, value) => value,
    getDanceLevelLabel: (level) => level,
    getAcademyOriginLabel: () => "México",
    danceCategories: [],
  };
  vm.runInNewContext(javascript, scope);
  return { ...scope.program, downloads, blobs };
}

function dance(overrides = {}) {
  return {
    id: "dance-1", title: "Pieza", academyName: "Academia", category: "solo", division: "junior",
    genre: "motion", subgenre: "jazz", level: null, venue: "edomex", participants: [{ fullName: "Persona" }],
    choreographers: [{ fullName: "Docente" }], blockId: 1, blockTitle: "BLOQUE 1: MOTION", ...overrides,
  };
}

test("the generated program XLS includes each song duration and preserves Motion and Aerial column alignment", async () => {
  const app = environment();
  const input = [
    dance({ title: "Aérea <brillante>", genre: "aereo", blockId: 2, blockTitle: "BLOQUE 2: AERIAL", level: "intermedio", musicUpload: { durationSeconds: 179.6 } }),
    dance({ id: "dance-2", title: "Jazz & luz", musicUpload: { durationSeconds: 127.2 } }),
  ];
  const before = structuredClone(input);
  const rows = app.buildProgramRows(input);
  app.downloadProgramXls([
    { id: 1, title: "BLOQUE 1: MOTION", rows: rows.filter((row) => row.genre === "motion") },
    { id: 2, title: "BLOQUE 2: AERIAL", rows: rows.filter((row) => row.genre === "aereo") },
  ]);
  const html = await app.blobs[0].text();

  assert.equal(app.blobs[0].type, "application/vnd.ms-excel;charset=utf-8");
  assert.equal(app.downloads[0].download, "levitate-programa.xls");
  assert.equal((html.match(/DURACIÓN CANCIÓN \(MM:SS\)/g) || []).length, 2);
  assert.match(html, /colspan="9"[^>]*>BLOQUE 1: MOTION/);
  assert.match(html, /colspan="10"[^>]*>BLOQUE 2: AERIAL/);
  assert.match(html, /JAZZ &amp; LUZ<\/td>[\s\S]*?<td>02:07<\/td><\/tr>/);
  assert.match(html, /AÉREA &lt;BRILLANTE&gt;<\/td>[\s\S]*?<td>03:00<\/td><\/tr>/);
  const dataRows = [...html.matchAll(/<tr>(<td>.*?)<\/tr>/gs)].map((match) => match[1]);
  assert.deepEqual(dataRows.map((row) => (row.match(/<td>/g) || []).length), [9, 10]);
  assert.deepEqual(input, before, "export must not alter registrations or music metadata");
});

test("missing music and unknown durations remain distinct and never become an invented zero duration", async () => {
  const app = environment();
  const input = [
    dance({ id: "none", title: "A sin canción", musicUpload: null }),
    ...[undefined, null, 0, -3, Infinity, NaN].map((durationSeconds, index) => dance({
      id: `unknown-${index}`, title: `B pendiente ${index}`, musicUpload: { durationSeconds },
    })),
  ];
  const rows = app.buildProgramRows(input);
  app.downloadProgramXls([{ id: 1, title: "Programa", rows }]);
  const html = await app.blobs[0].text();

  assert.equal((html.match(/SIN MÚSICA/g) || []).length, 1);
  assert.equal((html.match(/DURACIÓN PENDIENTE/g) || []).length, 6);
  assert.doesNotMatch(html, />00:00</);
  assert.equal(app.getProgramHeaders(false).length, 8, "on-screen program columns remain unchanged");
  assert.equal(app.getProgramHeaders(true, true).length, 10, "Aerial level and delete action stay in their existing positions");
  assert.equal(app.getProgramRowDisplay(rows[0]).length, 8);
});
