import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const refreshSource = await readFile(new URL("../src/components/participant/participantRefresh.ts", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../src/components/participant/ParticipantPage.tsx", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../src/components/participant/participantApi.ts", import.meta.url), "utf8");
const syntax = ts.createSourceFile("ParticipantPage.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let refreshEffect;
const functions = new Map();
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(syntax) === "useEffect"
    && node.arguments[0]?.getText(syntax).includes("return startParticipantRefresh")) refreshEffect = node.arguments[0].getText(syntax);
  if (ts.isFunctionDeclaration(node) && ["cancelParticipantDownloads", "download"].includes(node.name?.text)) {
    functions.set(node.name.text, node.getText(syntax));
  }
  ts.forEachChild(node, visit);
}
visit(syntax);
assert.ok(refreshEffect);
assert.equal(functions.size, 2);
const compile = code => ts.transpileModule(code, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText;
const clone = value => JSON.parse(JSON.stringify(value));
function profile(overrides = {}) {
  return { participant: { id: "person-one", name: "Nombre Uno", academy: "Academia" },
    events: [{ id: "edition-one", title: "Levitate", season: "Otoño", venue: "edomex", startsAt: null }],
    selectedEventId: "edition-one", diploma: { status: "available", assetId: null, url: null },
    routines: ["first", "selected"].map(id => ({ id, eventId: "edition-one", title: id,
      result: { status: "pending", score: null }, judging: { status: "pending", judges: [] },
      photos: { status: "pending", items: [], count: 0 } })), ...overrides };
}
class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(callback); }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  fire(name) { for (const callback of this.listeners.get(name) || []) void callback(); }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(options = {}) {
  let now = 0, sequence = 0;
  const intervals = new Map(), timeouts = new Map(), requests = [], updates = [];
  const windowTarget = new Events(), documentTarget = Object.assign(new Events(), { visibilityState: "visible" });
  const timers = {
    setInterval(callback, delay) { const id = ++sequence; intervals.set(id, { callback, delay }); return id; },
    clearInterval(id) { intervals.delete(id); },
    setTimeout(callback, delay) { const id = ++sequence; timeouts.set(id, { callback() { timeouts.delete(id); callback(); }, delay }); return id; },
    clearTimeout(id) { timeouts.delete(id); },
  };
  const refreshScope = { exports: {}, AbortController, Date: { now: () => now }, ...timers };
  vm.runInNewContext(compile(refreshSource), refreshScope);
  const data = profile();
  const scope = { exports: {}, AbortController, window: windowTarget, document: documentTarget,
    preview: false, isInternalPreview: false, phase: "ready", changingEvent: false, data,
    refreshContext: { current: { data, phase: "ready", changingEvent: false } }, accessNavigation: { current: 0 },
    selected: "selected", photo: 0, cancelled: 0, error: "",
    ...refreshScope.exports,
    cancelParticipantDownloads() { scope.cancelled++; },
    eventRequest: { current: null },
    setData(value) { scope.data = value; scope.refreshContext.current.data = value; updates.push(value); },
    setSelectedRoutineId(value) { scope.selected = typeof value === "function" ? value(scope.selected) : value; },
    setPhotoIndex(value) { scope.photo = value; },
    setError(value) { scope.error = value; },
    setPhase(value) { scope.phase = value; scope.refreshContext.current.phase = value; },
    participantRequest(path, { signal }) {
      assert.equal(path, "/api/participant/me?eventId=edition-one", "refresh never exchanges a QR or opens a different identity");
      return new Promise((resolve, reject) => requests.push({ path, signal, resolve, reject }));
    },
    ...options,
  };
  vm.runInNewContext(compile(`exports.mount=${refreshEffect};`), scope);
  const stop = scope.exports.mount();
  return { scope, stop, intervals, timeouts, requests, updates, windowTarget, documentTarget,
    at(time) { now = time; }, tick() { for (const { callback } of intervals.values()) void callback(); } };
}

test("only a stable real participant starts one 60-second refresher", () => {
  for (const options of [{ preview: true }, { isInternalPreview: true }, { phase: "loading" }, { changingEvent: true }, { data: null }]) {
    const view = harness(options);
    assert.equal(view.intervals.size, 0);
    assert.equal(view.requests.length, 0);
  }
  const view = harness();
  assert.equal(view.intervals.size, 1);
  assert.equal([...view.intervals.values()][0].delay, 60_000);
  assert.equal(view.requests.length, 0, "the initial authenticated request is not duplicated");
  view.stop();
  assert.equal(view.intervals.size, 0);
});

test("focus and restored visibility are throttled and never overlap a pending request", async () => {
  const view = harness();
  view.at(29_999); view.windowTarget.fire("focus"); assert.equal(view.requests.length, 0);
  view.at(30_000); view.windowTarget.fire("focus"); assert.equal(view.requests.length, 1);
  view.at(90_000); view.tick(); view.windowTarget.fire("focus"); assert.equal(view.requests.length, 1);
  view.requests[0].resolve(profile()); await flush();
  assert.equal(view.scope.cancelled, 0, "an unchanged publication does not cancel active downloads");
  assert.equal(view.scope.selected, "selected");
  view.documentTarget.visibilityState = "hidden";
  view.tick(); view.windowTarget.fire("focus"); assert.equal(view.requests.length, 1);
  view.documentTarget.visibilityState = "visible"; view.documentTarget.fire("visibilitychange");
  assert.equal(view.requests.length, 2);
  view.stop();
});

test("a released or reopened block replaces the old content and preserves the selected routine", async () => {
  const view = harness(); view.at(60_000); view.tick();
  const released = profile(); released.routines[1].result = { status: "published", score: 98 };
  released.routines[1].judging = { status: "available", judges: [{ name: "Juez" }] };
  view.requests[0].resolve(released); await flush();
  assert.equal(view.scope.selected, "selected"); assert.equal(view.scope.cancelled, 1); assert.equal(view.scope.photo, null);
  assert.equal(view.scope.data.routines[1].result.status, "published");
  view.at(120_000); view.tick(); view.requests[1].resolve(profile()); await flush();
  assert.equal(view.scope.cancelled, 2);
  assert.equal(view.scope.data.routines[1].result.status, "pending");
  assert.deepEqual(clone(view.scope.data.routines[1].judging.judges), []);
  view.stop();
});

test("a disappeared selected routine falls back to a currently authorized routine", async () => {
  const view = harness(); view.at(60_000); view.tick();
  const next = profile(); next.routines.pop(); view.requests[0].resolve(next); await flush();
  assert.equal(view.scope.selected, "first");
  view.stop();
});

test("a new QR, edition change or cleanup makes an older refresh response unusable", async () => {
  for (const invalidate of [view => ++view.scope.accessNavigation.current,
    view => { view.scope.refreshContext.current.changingEvent = true; },
    view => { view.scope.refreshContext.current.data = profile({ selectedEventId: "edition-two" }); },
    view => view.stop()]) {
    const view = harness(); view.at(60_000); view.tick(); invalidate(view);
    view.requests[0].resolve(profile()); await flush();
    assert.equal(view.updates.length, 0); assert.equal(view.scope.cancelled, 0);
    view.stop();
  }
});

test("an expired session or mismatched authenticated profile clears all displayed material", async () => {
  for (const failure of ["unauthorized", "different-person", "different-edition"]) {
    const view = harness(); view.at(60_000); view.tick();
    if (failure === "unauthorized") view.requests[0].reject({ status: 401 });
    else view.requests[0].resolve(failure === "different-person" ? profile({ participant: { id: "another-person" } }) : profile({ selectedEventId: "edition-two" }));
    await flush();
    assert.equal(view.scope.data, null); assert.equal(view.scope.phase, "access");
    assert.equal(view.scope.cancelled, 1); assert.equal(view.scope.photo, null); assert.equal(view.intervals.size, 0);
  }
});

test("transient server errors retain the profile and allow the next bounded refresh", async () => {
  const view = harness(); const before = clone(view.scope.data);
  view.at(60_000); view.tick(); view.requests[0].reject({ status: 503 }); await flush();
  assert.deepEqual(clone(view.scope.data), before); assert.equal(view.scope.phase, "ready");
  view.at(90_000); view.windowTarget.fire("focus"); assert.equal(view.requests.length, 2);
  view.requests[1].resolve(profile()); await flush(); view.stop();
});

test("timed-out and disposed refreshes cannot apply their delayed responses", async () => {
  const view = harness(); view.at(60_000); view.tick();
  const timeout = [...view.timeouts.values()][0]; assert.equal(timeout.delay, 20_000); timeout.callback();
  assert.equal(view.requests[0].signal.aborted, true);
  view.at(120_000); view.tick(); assert.equal(view.requests.length, 2);
  view.requests[0].resolve(profile()); await flush(); assert.equal(view.updates.length, 0);
  view.stop(); view.requests[1].resolve(profile()); await flush(); assert.equal(view.updates.length, 0);
  assert.equal(view.timeouts.size, 0);
  assert.equal(view.windowTarget.listeners.get("focus").size, 0);
  assert.equal(view.documentTarget.listeners.get("visibilitychange").size, 0);
});

test("publication withdrawal cancels a stored PDF even while its response body is arriving", async () => {
  const apiSyntax = ts.createSourceFile("participantApi.ts", apiSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let apiDownload;
  apiSyntax.forEachChild(node => { if (ts.isFunctionDeclaration(node) && node.name?.text === "downloadParticipantPdf") apiDownload = node.getText(apiSyntax); });
  let finishBlob;
  const downloads = [], states = [];
  const scope = { exports: {}, AbortController,
    preview: false, changingEvent: false, downloadBusy: null,
    assetGeneration: { current: 0 }, accessNavigation: { current: 0 }, judgingGeneration: { current: 0 }, diplomaGeneration: { current: 0 },
    assetRequest: { current: null }, diplomaRequest: { current: null }, judgingRequest: { current: null }, assetKind: { current: null },
    setDownloadBusy: value => states.push(value), setDownloadMessage() {}, setJudgingDownloadBusy() {}, setJudgingDownloadMessage() {}, setJudgingDownloadError() {},
    prepareBrowserDownload(blob, name) { return { blob, name }; }, startBrowserDownload: value => downloads.push(value),
    async fetch(url, options) {
      assert.equal(options.credentials, "same-origin"); assert.equal(options.cache, "no-store"); assert.ok(options.signal);
      return { ok: true, headers: new Headers({ "content-type": "application/pdf" }), blob: () => new Promise(resolve => { finishBlob = resolve; }) };
    },
  };
  vm.runInNewContext(compile(`${apiDownload}\n${[...functions.values()].join("\n")}\nexports.download=download;exports.cancel=cancelParticipantDownloads;`), scope);
  const operation = scope.exports.download("/api/participant/assets/existing-sheet", "jueceo"); await flush();
  scope.exports.cancel(); finishBlob(new Blob(["%PDF-"])); await operation;
  assert.equal(scope.assetRequest.current.signal.aborted, true);
  assert.equal(downloads.length, 0); assert.equal(states.at(-1), null);
});
