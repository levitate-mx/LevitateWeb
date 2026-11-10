import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/components/participant/ParticipantPage.tsx", import.meta.url), "utf8");
const syntax = ts.createSourceFile("ParticipantPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const operations = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && ["participantDiplomaGenerator", "downloadGeneratedDiploma"].includes(node.name?.text)) {
    operations.set(node.name.text, node.getText(syntax));
  }
  ts.forEachChild(node, visit);
}
visit(syntax);
assert.equal(operations.size, 2);
function compile(code) {
  return ts.transpileModule(code, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
}
const descriptors = { exports: {} };
vm.runInNewContext(compile(`${operations.get("participantDiplomaGenerator")}\nexports.descriptor=participantDiplomaGenerator;`), descriptors);
const selectedEvent = { id: "event-one", title: "Levitate MX · Otoño 2026", season: "Otoño 2026", venue: "edomex", startsAt: "2026-11-13" };
function profile(changes = {}) {
  return { selectedEventId: selectedEvent.id, participant: { id: "person-one", name: "Mariana López", academy: "Academia Uno" },
    diploma: { status: "available", assetId: null, url: null, generator: {
      name: "Mariana López", academy: "Academia Uno", eventTitle: selectedEvent.title, season: selectedEvent.season,
      venue: selectedEvent.venue, dateLabel: "2026-11-13", preview: false, templateUrl: "/assets/participant-recognition-template.pdf", ...changes,
    } } };
}
const descriptor = (data = profile(), internal = false) => descriptors.exports.descriptor(data, selectedEvent, internal);
const compiledDownload = compile(`${operations.get("downloadGeneratedDiploma")}\nexports.download=downloadGeneratedDiploma;`);
function harness({ input = descriptor(), internal = false, busy = false, changing = false,
  fetcher = async () => new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } }),
  generate = async () => new Uint8Array([37, 80, 68, 70]),
} = {}) {
  const generated = [], downloads = [], messages = [], requests = [], busyChanges = [];
  const scope = {
    exports: {}, Error, Blob, Uint8Array, AbortController,
    generatedDiploma: input, downloadBusy: busy ? "diploma" : null, changingEvent: changing, isInternalPreview: internal,
    diplomaGeneration: { current: 0 }, diplomaRequest: { current: null },
    setDownloadBusy: value => busyChanges.push(value),
    setDownloadMessage: value => messages.push(value),
    async fetch(path, options) { requests.push({ path, options }); return fetcher(path, options); },
    prepareBrowserDownload(blob, fileName) { return { blob, fileName }; },
    startBrowserDownload(value) { downloads.push(value); },
    require(path) {
      assert.equal(path, "../../../shared/participant-diploma.js");
      return { generateParticipantDiploma: async value => { generated.push(value); return generate(value); } };
    },
  };
  vm.runInNewContext(compiledDownload, scope);
  return { scope, generated, downloads, messages, requests, busyChanges, download: scope.exports.download };
}

test("automatic diploma uses only this authenticated participant and selected edition", () => {
  const valid = descriptor(profile({ entryUrl: "https://other.test/private-token", participantId: "someone-else", id: "untrusted" }));
  assert.equal(valid.name, "Mariana López"); assert.equal(valid.academy, "Academia Uno");
  assert.equal(valid.eventTitle, selectedEvent.title); assert.equal(valid.preview, false);
  assert.deepEqual(Object.keys(valid).sort(), ["academy", "dateLabel", "eventTitle", "name", "preview", "season", "templateUrl", "venue"]);
  assert.equal(valid.entryUrl, undefined, "no access URL is invented, imported from extra fields or rotated");
  for (const change of [
    { name: "Otra Persona" }, { academy: "Otra Academia" }, { eventTitle: "Otra Edición" },
    { season: "Otoño 2027" }, { venue: "puebla" }, { dateLabel: "2026-11-14" },
    { preview: true }, { preview: null }, { templateUrl: "https://external.test/template.pdf" },
    { templateUrl: "/assets/participant-recognition-template.pdf?person=other" },
  ]) assert.equal(descriptor(profile(change)), undefined);
  const hidden = profile(); hidden.diploma.status = "pending";
  assert.equal(descriptor(hidden), undefined);
  assert.equal(descriptors.exports.descriptor(profile(), { ...selectedEvent, id: "another-event" }, false), undefined);
  assert.equal(descriptors.exports.descriptor(null, selectedEvent, false), undefined);
});

test("internal diploma previews are forced to example mode without changing identity", () => {
  const internal = descriptor(profile(), true);
  assert.equal(internal.preview, true); assert.equal(internal.name, profile().participant.name);
  assert.equal(descriptor(profile({ preview: true }), true).preview, true);
});

test("automatic download builds the approved PDF in the browser without Drive or access-grant requests", async () => {
  const view = harness(); await view.download();
  assert.equal(view.requests.length, 1); assert.equal(view.requests[0].path, "/assets/participant-recognition-template.pdf");
  assert.equal(view.requests[0].options.credentials, "same-origin"); assert.equal(view.requests[0].options.cache, "force-cache");
  assert.ok(view.requests[0].options.signal instanceof AbortSignal);
  assert.equal(view.generated.length, 1); assert.equal(view.generated[0].name, profile().participant.name);
  assert.equal(view.generated[0].entryUrl, undefined); assert.equal(view.generated[0].templateUrl, undefined);
  assert.equal(view.generated[0].templateBytes.byteLength, 4); assert.equal(view.generated[0].preview, false);
  assert.equal(view.downloads.length, 1); assert.equal(view.downloads[0].blob.type, "application/pdf");
  assert.equal(view.downloads[0].fileName, "levitate-reconocimiento.pdf");
  assert.match(view.messages.at(-1), /reconocimiento está listo/); assert.deepEqual(view.busyChanges, ["diploma", null]);
});

test("Unicode diplomas fetch the fixed bundled font once and retry without changing participant data", async () => {
  const view = harness({
    fetcher: async path => new Response(new Uint8Array([0, 1, 0, 0]), { headers: { 'content-type': path.endsWith('.ttf') ? 'font/ttf' : 'application/pdf' } }),
    generate: async input => {
      if (!input.unicodeFontBytes) throw Object.assign(new Error('Necesita Unicode'), { code: 'diploma_unicode_font_required' });
      return new Uint8Array([37, 80, 68, 70]);
    },
  });
  await view.download();
  assert.deepEqual(view.requests.map(request => request.path), ['/assets/participant-recognition-template.pdf', '/assets/participant-recognition-unicode.ttf']);
  assert.equal(view.generated.length, 2); assert.equal(view.generated[1].unicodeFontBytes.byteLength, 4);
  assert.equal(view.generated[0].name, view.generated[1].name); assert.equal(view.generated[0].academy, view.generated[1].academy);
  assert.equal(view.generated[1].entryUrl, undefined); assert.equal(view.downloads.length, 1);
});

test("font failures and stale font responses do not produce a diploma download", async () => {
  const needed = () => Object.assign(new Error('Necesita Unicode'), { code: 'diploma_unicode_font_required' });
  for (const fontResponse of [new Response('No disponible', { status: 503 }), new Response('<html>Error</html>', { headers: { 'content-type': 'text/html' } })]) {
    const failed = harness({ generate: async () => { throw needed(); }, fetcher: async path => path.endsWith('.ttf') ? fontResponse
      : new Response(new Uint8Array([37, 80]), { headers: { 'content-type': 'application/pdf' } }) });
    await failed.download(); assert.equal(failed.generated.length, 1); assert.equal(failed.downloads.length, 0);
    assert.match(failed.messages.at(-1), /No pudimos cargar la fuente/);
  }
  let finishFont;
  const stale = harness({ generate: async () => { throw needed(); }, fetcher: async path => path.endsWith('.ttf')
    ? new Promise(resolve => { finishFont = resolve; }) : new Response(new Uint8Array([37, 80]), { headers: { 'content-type': 'application/pdf' } }) });
  const operation = stale.download(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(stale.requests.length, 2); ++stale.scope.diplomaGeneration.current; stale.scope.diplomaRequest.current.abort();
  finishFont(new Response(new Uint8Array([0, 1, 0, 0]), { headers: { 'content-type': 'font/ttf' } }));
  await operation; assert.equal(stale.generated.length, 1); assert.equal(stale.downloads.length, 0);
});

test("only a missing Unicode-font error triggers a single retry", async () => {
  const view = harness({ generate: async () => { throw Object.assign(new Error('Carácter no incluido'), { code: 'diploma_unicode_glyph_missing' }); } });
  await view.download(); assert.equal(view.requests.length, 1); assert.equal(view.generated.length, 1); assert.equal(view.downloads.length, 0);
  assert.equal(view.messages.at(-1), 'Carácter no incluido');
});

test("pending, changing and duplicate diploma actions cannot generate or request files", async () => {
  for (const options of [{ input: undefined, busy: true }, { input: null }, { busy: true }, { changing: true }]) {
    const view = harness(options); await view.download();
    assert.equal(view.requests.length, 0); assert.equal(view.generated.length, 0); assert.equal(view.downloads.length, 0);
  }
});

test("internal download is clearly marked as a revision and uses the generator preview flag", async () => {
  const view = harness({ internal: true, input: descriptor(profile(), true) }); await view.download();
  assert.equal(view.generated[0].preview, true); assert.match(view.downloads[0].fileName, /^revision-interna-/);
});

test("invalid or oversized template responses do not produce a PDF download", async () => {
  for (const response of [
    new Response("No disponible", { status: 503 }),
    new Response("<html>Access denied</html>", { headers: { "content-type": "text/html" } }),
    new Response(new Uint8Array([37, 80]), { headers: { "content-type": "application/pdf", "content-length": String(8 * 1024 * 1024 + 1) } }),
  ]) {
    const view = harness({ fetcher: async () => response }); await view.download();
    assert.equal(view.generated.length, 0); assert.equal(view.downloads.length, 0);
    assert.match(view.messages.at(-1), /No pudimos preparar/); assert.deepEqual(view.busyChanges, ["diploma", null]);
  }
});

test("changing person or edition cancels an in-flight template and generated PDF", async () => {
  let resolveTemplate;
  const loading = harness({ fetcher: () => new Promise(resolve => { resolveTemplate = resolve; }) });
  const request = loading.download(); await new Promise(resolve => setImmediate(resolve));
  ++loading.scope.diplomaGeneration.current; loading.scope.diplomaRequest.current.abort();
  resolveTemplate(new Response(new Uint8Array([37, 80]), { headers: { "content-type": "application/pdf" } }));
  await request; assert.equal(loading.generated.length, 0); assert.equal(loading.downloads.length, 0);

  let finishPdf;
  const generating = harness({ generate: () => new Promise(resolve => { finishPdf = resolve; }) });
  const operation = generating.download(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(generating.generated.length, 1); ++generating.scope.diplomaGeneration.current;
  finishPdf(new Uint8Array([37, 80])); await operation; assert.equal(generating.downloads.length, 0);
});

test("PDF generation errors remain recoverable without creating or replacing an access", async () => {
  const view = harness({ generate: async () => { throw new Error("El nombre necesita otra fuente."); } });
  await view.download(); assert.equal(view.downloads.length, 0); assert.equal(view.messages.at(-1), "El nombre necesita otra fuente.");
  assert.deepEqual(view.busyChanges, ["diploma", null]);
});

test("the visible diploma uses the approved personalized art and labels internal drafts", async () => {
  const componentSource = await readFile(new URL("../src/components/participant/ParticipantDiplomaPreview.tsx", import.meta.url), "utf8");
  const scope = { exports: {}, require };
  vm.runInNewContext(compile(componentSource), scope);
  const html = renderToStaticMarkup(createElement(scope.exports.ParticipantDiplomaPreview, {
    name: "Mariana López", academy: "Academia Uno", season: "Otoño 2026", eventTitle: selectedEvent.title,
    preview: false, internalPreview: true,
  }));
  assert.match(html, /participant-recognition-template.png/); assert.match(html, /Mariana López/);
  assert.match(html, /Vista interna · No publicado/); assert.doesNotMatch(html, /access=|token=|drive\.google/);
});
