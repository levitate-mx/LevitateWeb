import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { parseParticipantJudgingProgram } from "../shared/participant-judging-program.js";

const source = await readFile(new URL("../src/components/admin/RegistrationScreens.tsx", import.meta.url), "utf8");
const syntax = ts.createSourceFile("RegistrationScreens.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functionNames = [
  "buildProgramRows", "formatMusicDuration", "getProgramHeaders", "getProgramRowDisplay",
  "getProgramMusicDurationLabel", "isAerialProgramBlock", "toProgramUpper", "toProgramHtmlValue",
  "createUtf8EncodedBlob", "downloadProgramXls",
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

const issuedToken = "aBcD_eF-gH".repeat(5).slice(0, 43);
const issuedEdition = "edomex-2026-otono";
function environment({ issue = (_path, options) => ({ registrationEventId: issuedEdition, token: issuedToken, links: JSON.parse(options.body).links }) } = {}) {
  const downloads = [];
  const blobs = [];
  const requests = [];
  const scope = {
    Blob,
    URL: {
      createObjectURL(blob) { blobs.push(blob); return "blob:test-program"; },
      revokeObjectURL() {},
    },
    document: { createElement() { const link = { click() { downloads.push({ ...this }); } }; return link; } },
    async requestRegistrationApi(path, options) { requests.push({ path, options }); return issue(path, options); },
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
  return { ...scope.program, downloads, blobs, requests };
}

function dance(overrides = {}) {
  return {
    id: "dance-01", title: "Pieza", academyName: "Academia", category: "solo", division: "junior",
    genre: "motion", subgenre: "jazz", level: null, venue: "edomex", participants: [{ fullName: "Persona" }],
    choreographers: [{ fullName: "Docente" }], blockId: 1, blockTitle: "BLOQUE 1: MOTION", ...overrides,
  };
}

test("the generated program XLS includes each song duration and preserves Motion and Aerial column alignment", async () => {
  const app = environment();
  const input = [
    dance({ title: "Aérea <brillante>", genre: "aereo", blockId: 2, blockTitle: "BLOQUE 2: AERIAL", level: "intermedio", musicUpload: { durationSeconds: 179.6 } }),
    dance({ id: "dance-02", title: "Jazz & luz", musicUpload: { durationSeconds: 127.2 } }),
  ];
  const before = structuredClone(input);
  const rows = app.buildProgramRows(input);
  await app.downloadProgramXls([
    { id: 1, title: "BLOQUE 1: MOTION", rows: rows.filter((row) => row.genre === "motion") },
    { id: 2, title: "BLOQUE 2: AERIAL", rows: rows.filter((row) => row.genre === "aereo") },
  ]);
  const html = await app.blobs[0].text();
  const bytes = new Uint8Array(await app.blobs[0].arrayBuffer());

  assert.equal(app.blobs[0].type, "application/vnd.ms-excel;charset=utf-8");
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "Excel export starts with a UTF-8 BOM");
  assert.equal(app.downloads[0].download, "levitate-programa.xls");
  assert.equal((html.match(/DURACIÓN CANCIÓN \(MM:SS\)/g) || []).length, 2);
  assert.match(html, /colspan="10"[^>]*>BLOQUE 1: MOTION/);
  assert.match(html, /colspan="11"[^>]*>BLOQUE 2: AERIAL/);
  assert.match(html, /JAZZ &amp; LUZ<\/td>[\s\S]*?<td>02:07<\/td><td>1<\/td><td[^>]*>dance-02<\/td>/);
  assert.match(html, /AÉREA &lt;BRILLANTE&gt;<\/td>[\s\S]*?<td>03:00<\/td><td>2<\/td><td[^>]*>dance-01<\/td>/);
  assert.equal((html.match(/<th[^>]*>ID EDICIÓN<\/th>/g) || []).length, 2);
  assert.equal((html.match(/<th[^>]*>TOKEN VINCULACIÓN<\/th>/g) || []).length, 2);
  assert.equal((html.match(new RegExp(`<td[^>]*>${issuedEdition}<\\/td>`, "g")) || []).length, 2);
  assert.ok(html.includes(`<td style="display:none;mso-hide:all">${issuedToken}</td>`), "the file capability keeps its exact mixed case");
  const dataRows = [...html.matchAll(/<tr>(<td>.*?)<\/tr>/gs)].map((match) => match[1]);
  assert.deepEqual(dataRows.map((row) => (row.match(/<td(?:\s[^>]*)?>/g) || []).length), [13, 14]);
  assert.deepEqual(parseParticipantJudgingProgram(html), [
    { danceId: "dance-02", sourceRoutineId: "1" },
    { danceId: "dance-01", sourceRoutineId: "2" },
  ], "the same file links exact registration identifiers while retaining numeric app routine IDs");
  assert.equal(app.requests.length, 1); assert.equal(app.requests[0].path, "/api/registration/admin/participant-portal");
  assert.equal(app.requests[0].options.method, "POST");
  assert.deepEqual(JSON.parse(app.requests[0].options.body), { action: "judging.program.issue", links: [
    { danceId: "dance-02", sourceRoutineId: "1" }, { danceId: "dance-01", sourceRoutineId: "2" },
  ] });
  assert.doesNotMatch(app.requests[0].options.body, /token|music|duration|participant|curp/i);
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
  await app.downloadProgramXls([{ id: 1, title: "Programa", rows }]);
  const html = await app.blobs[0].text();

  assert.equal((html.match(/SIN MÚSICA/g) || []).length, 1);
  assert.equal((html.match(/DURACIÓN PENDIENTE/g) || []).length, 6);
  assert.doesNotMatch(html, />00:00</);
  assert.equal(app.getProgramHeaders(false).length, 8, "on-screen program columns remain unchanged");
  assert.equal(app.getProgramHeaders(true, true).length, 10, "Aerial level and delete action stay in their existing positions");
  assert.equal(app.getProgramRowDisplay(rows[0]).length, 8);
});

test("reexports use stable routine numbers returned by the server rather than the visible order", async () => {
  const app = environment({ issue: () => ({ registrationEventId: issuedEdition, token: issuedToken,
    links: [{ danceId: "dance-02", sourceRoutineId: "107" }, { danceId: "dance-01", sourceRoutineId: "42" }] }) });
  const rows = app.buildProgramRows([dance({ title: "Segunda" }), dance({ id: "dance-02", title: "Primera" })]);
  await app.downloadProgramXls([{ id: 1, title: "Programa", rows }]);
  const html = await app.blobs[0].text();
  assert.deepEqual(parseParticipantJudgingProgram(html), [{ danceId: "dance-02", sourceRoutineId: "107" }, { danceId: "dance-01", sourceRoutineId: "42" }]);
  assert.equal(app.downloads.length, 1);
});

test("failed issuance never produces an unlinked file or a capability-bearing URL", async () => {
  const app = environment({ issue: async () => { throw new Error("Vuelve a iniciar sesión."); } });
  const rows = app.buildProgramRows([dance()]);
  await assert.rejects(() => app.downloadProgramXls([{ id: 1, title: "Programa", rows }]), /Vuelve a iniciar sesión/);
  assert.equal(app.blobs.length, 0); assert.equal(app.downloads.length, 0);
  assert.doesNotMatch(app.requests[0].path, /token|access|\?/);
});

test("ambiguous, missing or malformed issuance responses cannot create a programme download", async () => {
  const base = { registrationEventId: issuedEdition, token: issuedToken, links: [{ danceId: "dance-01", sourceRoutineId: "1" }] };
  for (const change of [
    { registrationEventId: "../other" }, { registrationEventId: "" }, { token: "not-a-token" },
    { links: [] }, { links: [{ danceId: "other-id", sourceRoutineId: "1" }] },
    { links: [{ danceId: "dance-01", sourceRoutineId: "01" }] },
    { links: [{ danceId: "dance-01", sourceRoutineId: 1 }] },
    { links: [{ danceId: "dance-01", sourceRoutineId: "1)" }] },
  ]) {
    const app = environment({ issue: () => ({ ...base, ...change }) });
    await assert.rejects(() => app.downloadProgramXls([{ id: 1, title: "Programa", rows: app.buildProgramRows([dance()]) }]), /No se pudo verificar/);
    assert.equal(app.blobs.length, 0); assert.equal(app.downloads.length, 0);
  }
  for (const links of [
    [{ danceId: "dance-01", sourceRoutineId: "1" }, { danceId: "dance-01", sourceRoutineId: "2" }],
    [{ danceId: "dance-01", sourceRoutineId: "1" }, { danceId: "dance-02", sourceRoutineId: "1" }],
  ]) {
    const app = environment({ issue: () => ({ ...base, links }) });
    await assert.rejects(() => app.downloadProgramXls([{ id: 1, title: "Programa", rows: app.buildProgramRows([dance(), dance({ id: "dance-02" })]) }]), /No se pudo verificar/);
    assert.equal(app.blobs.length, 0);
  }
});

test("empty, duplicate or mixed-venue programmes fail before requesting an issuance", async () => {
  for (const input of [[], [dance(), dance()], [dance(), dance({ id: "dance-02", venue: "puebla" })]]) {
    const app = environment();
    await assert.rejects(() => app.downloadProgramXls([{ id: 1, title: "Programa", rows: app.buildProgramRows(input) }]));
    assert.equal(app.requests.length, 0); assert.equal(app.downloads.length, 0);
  }
});
