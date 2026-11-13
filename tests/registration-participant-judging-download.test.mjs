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
function profile(pdf = descriptor(), { available = true } = {}) {
  return { participant: { id: 'participant-a' }, selectedEventId: 'event-a', events: [{ id: 'event-a' }],
    routines: [{ id: 'portal-routine-a', eventId: 'event-a', judging: { pdf, status: available ? 'available' : 'pending',
      source: 'jueceocore', sourceStatus: available ? 'available' : 'pending',
      judges: pdf?.judges.map(judge => ({ id: judge.id, status: judge.status })) || [] } }] };
}
function harness({ pdf = descriptor(), internal = false, available = true, latest, read,
  generate = async () => new Uint8Array([37, 80, 68, 70]), busy = false, changing = false } = {}) {
  const generated = [], downloads = [], messages = [], errors = [], busyChanges = [], requests = [];
  const data = profile(pdf, { available });
  const scope = {
    exports: {}, Error, Blob, Uint8Array, AbortController, URLSearchParams,
    routine: data.routines[0], preview: false,
    refreshContext: { current: { data, phase: 'ready', changingEvent: changing } },
    accessNavigation: { current: 0 }, judgingRequest: { current: null },
    judgingDownloadBusy: busy, changingEvent: changing, isInternalPreview: internal,
    judgingGeneration: { current: 0 },
    setJudgingDownloadBusy: value => busyChanges.push(value),
    setJudgingDownloadMessage: value => messages.push(value),
    setJudgingDownloadError: value => errors.push(value),
    prepareBrowserDownload(blob, fileName) { return { blob, fileName }; },
    startBrowserDownload(download) { downloads.push(download); },
    async participantRequest(path, options) {
      requests.push({ path, options, mode: 'participant' });
      return read ? read(options.signal) : latest || profile(pdf, { available });
    },
    async openParticipantAdminPreview(search, signal) {
      requests.push({ search, options: { signal }, mode: 'admin' });
      return read ? read(signal) : latest || profile(pdf, { available });
    },
    require(path) {
      assert.equal(path, "../../../shared/participant-judging-sheet.js");
      return { generateParticipantJudgingPdf: async input => { generated.push(input); return generate(input); } };
    },
  };
  vm.runInNewContext(compiled, scope);
  return { download: scope.exports.download, scope, generated, downloads, messages, errors, busyChanges, requests };
}

test("participant judging downloads fetch and use the currently authorized descriptor before generating a PDF", async () => {
  const view = harness();
  await view.download();
  assert.equal(view.generated.length, 1);
  assert.equal(view.requests.length, 1);
  assert.equal(view.requests[0].path, '/api/participant/me?eventId=event-a');
  assert.ok(view.requests[0].options.signal instanceof AbortSignal);
  assert.equal(view.generated[0].preview, false);
  assert.equal(view.generated[0].judges[0].criteria[0].value, 0, "zero scores remain actual scores");
  assert.equal(view.downloads.length, 1);
  assert.equal(view.downloads[0].blob.type, "application/pdf");
  assert.equal(view.downloads[0].fileName, "levitate-jueceo-volar-dance-123.pdf");
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
  assert.equal(view.requests[0].mode, 'admin');
  assert.equal(new URLSearchParams(view.requests[0].search).get('participantId'), 'participant-a');
  assert.equal(new URLSearchParams(view.requests[0].search).get('eventId'), 'event-a');
  assert.match(view.downloads[0].fileName, /^revision-interna-/);
});

test('an already open page downloads refreshed criterion values and feedback, never its cached sheet', async () => {
  const fresh = descriptor();
  fresh.judges[0].criteria[0].value = 7;
  fresh.judges[0].feedback = 'Comentario actualizado';
  const view = harness({ latest: profile(fresh) });
  await view.download();
  assert.equal(view.generated[0].judges[0].criteria[0].value, 7);
  assert.equal(view.generated[0].judges[0].feedback, 'Comentario actualizado');
  assert.equal(view.scope.routine.judging.pdf.judges[0].criteria[0].value, 0);
});

test('download names use the refreshed choreography title and stable source ID with a bounded safe slug', async () => {
  const fresh = descriptor();
  fresh.routine.title = 'Ángel By The Wings';
  const view = harness({ latest: profile(fresh) });
  await view.download();
  assert.equal(view.downloads[0].fileName, 'levitate-jueceo-angel-by-the-wings-dance-123.pdf');
  fresh.routine.title = 'Presentación muy larga / con símbolos '.repeat(20);
  const long = harness({ latest: profile(fresh) });
  await long.download();
  assert.match(long.downloads[0].fileName, /^levitate-jueceo-[a-z0-9-]+-dance-123\.pdf$/);
  assert.ok(long.downloads[0].fileName.length < 120);
});

test('removed approvals, mismatched identities, incomplete sheets and ambiguous routines never fall back to the cached PDF', async () => {
  const cases = [
    value => { value.routines[0].judging.status = 'pending'; delete value.routines[0].judging.pdf; },
    value => { value.participant.id = 'other-person'; },
    value => { value.selectedEventId = 'other-event'; },
    value => { value.events = []; },
    value => { value.routines = []; },
    value => { value.routines.push(value.routines[0]); },
    value => { value.routines[0].eventId = 'other-event'; },
    value => { value.routines[0].judging.pdf.routine.id = 'other-source-routine'; },
    value => { value.routines[0].judging.pdf.preview = true; },
    value => { value.routines[0].judging.pdf.judges[0].status = 'partial'; },
    value => { value.routines[0].judging.judges = []; },
    value => { value.routines[0].judging.pdf.judges.push(value.routines[0].judging.pdf.judges[0]); },
    value => { value.routines[0].judging.pdf.judges[0].criteria[0].value = null; },
  ];
  for (const mutate of cases) {
    const latest = profile(); mutate(latest);
    const view = harness({ latest });
    await view.download();
    assert.equal(view.requests.length, 1); assert.equal(view.generated.length, 0); assert.equal(view.downloads.length, 0);
    assert.equal(view.errors.at(-1), true); assert.deepEqual(view.busyChanges, [true, false]);
  }
});

test('authorization and transient read failures never generate an old cached sheet', async () => {
  for (const status of [401, 403, 503]) {
    const view = harness({ read: async () => { throw Object.assign(new Error('No se pudieron actualizar las hojas.'), { status }); } });
    await view.download();
    assert.equal(view.generated.length, 0); assert.equal(view.downloads.length, 0); assert.equal(view.errors.at(-1), true);
    assert.deepEqual(view.busyChanges, [true, false]);
  }
});

test('navigation or an aborted request cancels a pending refresh before PDF generation', async () => {
  for (const cancel of [view => { ++view.scope.judgingGeneration.current; },
    view => { ++view.scope.accessNavigation.current; },
    view => { view.scope.judgingRequest.current.abort(); }]) {
    let finish;
    const view = harness({ read: () => new Promise(resolve => { finish = resolve; }) });
    const pending = view.download();
    assert.equal(view.requests.length, 1);
    cancel(view); finish(profile()); await pending;
    assert.equal(view.generated.length, 0); assert.equal(view.downloads.length, 0);
    assert.deepEqual(view.messages, ['']);
  }
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
