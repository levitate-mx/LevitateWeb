import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/components/participant/ParticipantPage.tsx", import.meta.url), "utf8");
const syntax = ts.createSourceFile("ParticipantPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let operation;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "downloadJudgingSheets") operation = node.getText(syntax);
  ts.forEachChild(node, visit);
}
visit(syntax);
assert.ok(operation, "the participant download handler exists");
const compiled = ts.transpileModule(`${operation}\nexports.download = downloadJudgingSheets;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function descriptor(overrides = {}) {
  return {
    eventTitle: "Levitate MX",
    routine: { id: "dance/123", title: "Volar", academy: "Academia", genre: "TELA", category: "Solo", division: "Junior", level: "Inicial", block: "1" },
    judges: [{ id: "judge-1", name: "Juez Uno", status: "complete", criteria: [{ id: 1, section: "Técnica", label: "Control", value: 0, maximumScore: 10 }], penalty: 0, feedback: "" }],
    preview: false,
    ...overrides,
  };
}
function harness({ pdf = descriptor(), internal = false, available = true, generate = async () => new Uint8Array([37, 80, 68, 70]), busy = false, changing = false } = {}) {
  const generated = [], downloads = [], messages = [], errors = [], busyChanges = [];
  const scope = {
    exports: {}, Error, Blob, Uint8Array,
    routine: { judging: { pdf, status: available ? "available" : "pending" } },
    judgingDownloadBusy: busy, changingEvent: changing, isInternalPreview: internal,
    judgingGeneration: { current: 0 },
    setJudgingDownloadBusy: value => busyChanges.push(value),
    setJudgingDownloadMessage: value => messages.push(value),
    setJudgingDownloadError: value => errors.push(value),
    prepareBrowserDownload(blob, fileName) { return { blob, fileName }; },
    startBrowserDownload(download) { downloads.push(download); },
    require(path) {
      assert.equal(path, "../../../shared/participant-judging-sheet.js");
      return { generateParticipantJudgingPdf: async input => { generated.push(input); return generate(input); } };
    },
  };
  vm.runInNewContext(compiled, scope);
  return { download: scope.exports.download, scope, generated, downloads, messages, errors, busyChanges };
}

test("participant judging downloads generate a PDF locally with the already authenticated descriptor", async () => {
  const view = harness();
  await view.download();
  assert.equal(view.generated.length, 1);
  assert.equal(view.generated[0].preview, false);
  assert.equal(view.generated[0].judges[0].criteria[0].value, 0, "zero scores remain actual scores");
  assert.equal(view.downloads.length, 1);
  assert.equal(view.downloads[0].blob.type, "application/pdf");
  assert.equal(view.downloads[0].fileName, "levitate-jueceo-dance-123.pdf");
  assert.match(view.messages.at(-1), /hojas de jueceo están listas/);
  assert.equal(view.errors.at(-1), false);
  assert.deepEqual(view.busyChanges, [true, false]);
});

test("participant mode cannot download internal drafts, incomplete judges, or unavailable evaluations", async () => {
  for (const options of [
    { pdf: descriptor({ preview: true }) },
    { pdf: descriptor({ judges: [{ ...descriptor().judges[0], status: "partial" }] }) },
    { available: false },
    { pdf: descriptor({ judges: [] }) },
    { pdf: undefined, busy: true },
    { changing: true },
  ]) {
    const view = harness(options);
    await view.download();
    assert.equal(view.generated.length, 0);
    assert.equal(view.downloads.length, 0);
  }
});

test("authenticated admin previews are always labelled as internal even if the input flag is missing", async () => {
  const view = harness({ internal: true, available: false, pdf: descriptor({ judges: [{ ...descriptor().judges[0], status: "partial" }] }) });
  await view.download();
  assert.equal(view.generated[0].preview, true);
  assert.match(view.downloads[0].fileName, /^revision-interna-/);
});

test("switching participant, edition, or routine cancels a pending PDF before any download", async () => {
  let finish;
  const view = harness({ generate: () => new Promise(resolve => { finish = resolve; }) });
  const operation = view.download();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(view.generated.length, 1);
  ++view.scope.judgingGeneration.current;
  finish(new Uint8Array([37, 80, 68, 70]));
  await operation;
  assert.equal(view.downloads.length, 0);
  assert.deepEqual(view.messages, [""]);
});

test("generation failures are reported without starting a download", async () => {
  const view = harness({ generate: async () => { throw new Error("No pudimos preparar estas hojas."); } });
  await view.download();
  assert.equal(view.downloads.length, 0);
  assert.equal(view.errors.at(-1), true);
  assert.equal(view.messages.at(-1), "No pudimos preparar estas hojas.");
  assert.deepEqual(view.busyChanges, [true, false]);
});
