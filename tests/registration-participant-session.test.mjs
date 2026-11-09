import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/components/participant/participantApi.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const nativeRequire = createRequire(import.meta.url);
const tokenA = "A".repeat(41) + "_-";
const tokenB = "B".repeat(41) + "_-";
const data = (person = "person-a") => ({
  participant: { id: person, name: "Participante de prueba", academy: "Academia de prueba" },
  events: [], selectedEventId: "test-event", diploma: null, routines: [],
});
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const deferred = () => {
  let resolve;
  const promise = new Promise(accept => { resolve = accept; });
  return { promise, resolve };
};
const settle = () => new Promise(resolve => setImmediate(resolve));

function client(hash, respond = path => json(path.endsWith("/me") ? data() : { ok: true })) {
  const calls = [], history = [];
  const browser = {
    location: new URL("https://levitate.test/mi-levitate" + hash),
    history: {
      state: { view: "participant" },
      replaceState(state, title, url) {
        history.push({ state, title, url });
        browser.location = new URL(url, browser.location);
      },
    },
  };
  const scope = {
    exports: {}, Error, URLSearchParams, URL, AbortController,
    window: browser,
    fetch(path, options) {
      const call = { path, options, hash: browser.location.hash };
      calls.push(call);
      return Promise.resolve(respond(path, options, calls.length));
    },
    require(name) {
      if (name === "../../utils/browserDownload") return { prepareBrowserDownload() {}, startBrowserDownload() {} };
      return nativeRequire(name);
    },
  };
  vm.runInNewContext(javascript, scope);
  return { api: scope.exports, browser, calls, history };
}

test("a valid QR is scrubbed before fetching and exchanged only through its POST body", async () => {
  const subject = client("#access=" + tokenA);
  const result = await subject.api.openParticipantSession();
  assert.equal(result.participant.id, "person-a");
  assert.equal(subject.browser.location.hash, "");
  assert.equal(subject.history.length, 1);
  assert.equal(subject.history[0].url, "/mi-levitate");
  assert.deepEqual(subject.calls.map(call => call.path), ["/api/participant/access/exchange", "/api/participant/me"]);
  assert.equal(subject.calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(subject.calls[0].options.body), { token: tokenA });
  for (const call of subject.calls) {
    assert.equal(call.hash, "", "private fragment is removed before any network request");
    assert.equal(call.options.credentials, "same-origin");
    assert.equal(call.options.cache, "no-store");
    assert.ok(!call.path.includes(tokenA));
    assert.ok(!JSON.stringify(call.options.headers).includes(tokenA));
  }
  await subject.api.openParticipantSession();
  assert.equal(subject.calls.length, 3, "settled data is not kept as a session cache");
  assert.equal(subject.calls[2].path, "/api/participant/me");
});

test("one closing quote or one matched wrapper is normalized after exactly one URL decode", async () => {
  const values = [tokenA + '"', tokenA + "%22", "%22" + tokenA + "%22", "%27" + tokenA + "%27",
    tokenA + "%E2%80%9D", "%E2%80%9C" + tokenA + "%E2%80%9D", "%E2%80%98" + tokenA + "%E2%80%99"];
  for (const value of values) {
    const subject = client("#access=" + value);
    await subject.api.openParticipantSession();
    assert.equal(JSON.parse(subject.calls[0].options.body).token, tokenA);
    assert.equal(subject.browser.location.hash, "");
    assert.equal(subject.calls.length, 2);
  }
  const alias = client("#token=" + tokenA + "%22");
  await alias.api.openParticipantSession();
  assert.equal(JSON.parse(alias.calls[0].options.body).token, tokenA);
});

test("malformed tokens and ambiguous fragments never fall back to another participant cookie", async () => {
  const invalid = ["", tokenA.slice(0, -1), tokenA + "A", tokenA.slice(0, 20) + "*" + tokenA.slice(21),
    "%22" + tokenA, tokenA + "%22%22", "%22" + tokenA + "%27", "%2522" + tokenA + "%2522",
    tokenA.slice(0, 20) + "%20" + tokenA.slice(20), tokenA + "&access=" + tokenB,
    tokenA + "&token=" + tokenB, tokenA + "&chapter=tus-fotos"];
  for (const value of invalid) {
    const subject = client("#access=" + value);
    const first = subject.api.openParticipantSession();
    const remounted = subject.api.openParticipantSession();
    assert.equal(first, remounted, "StrictMode cannot replace a rejected link with a previous participant cookie");
    await assert.rejects(first, error => error.code === "invalid_access");
    assert.equal(subject.calls.length, 0, "an invalid grant must not fetch /me using an unrelated cookie");
    assert.equal(subject.browser.location.hash, "");
  }
});

test("an invalid replacement remains a rejection while preserving the queue for a later valid link", async () => {
  const exchange = deferred();
  let exchangeCount = 0;
  const subject = client("#access=" + tokenA, path => path.endsWith("/exchange")
    ? ++exchangeCount === 1 ? exchange.promise : json({ ok: true }) : json(data(exchangeCount === 1 ? "person-a" : "person-b")));
  const first = subject.api.openParticipantSession();
  subject.browser.location.hash = "#access=invalid";
  const invalid = subject.api.openParticipantSession();
  assert.equal(subject.api.openParticipantSession(), invalid);
  const outcome = invalid.catch(error => error);
  assert.equal(subject.calls.length, 1);
  subject.browser.location.hash = "#access=" + tokenB;
  const last = subject.api.openParticipantSession();
  assert.equal(subject.api.openParticipantSession(), last);
  assert.equal(subject.calls.length, 1);
  exchange.resolve(json({ ok: true }));
  assert.equal((await first).participant.id, "person-a");
  assert.equal((await outcome).code, "invalid_access");
  assert.equal((await last).participant.id, "person-b");
  assert.equal(subject.calls.length, 4, "only the two valid links are exchanged and read, in order");
});

test("StrictMode's second mount shares the same pending exchange after the hash has been removed", async () => {
  const exchange = deferred();
  const subject = client("#access=" + tokenA, path => path.endsWith("/exchange") ? exchange.promise : json(data()));
  const first = subject.api.openParticipantSession();
  const remounted = subject.api.openParticipantSession();
  assert.equal(first, remounted);
  assert.equal(subject.calls.length, 1);
  assert.equal(subject.history.length, 1);
  exchange.resolve(json({ ok: true }));
  await Promise.all([first, remounted]);
  assert.deepEqual(subject.calls.map(call => call.path), ["/api/participant/access/exchange", "/api/participant/me"]);
});

test("a different link arriving during a pending exchange is scrubbed and queued without cookie races", async () => {
  const firstExchange = deferred(), secondExchange = deferred();
  let exchangeCount = 0;
  const subject = client("#access=" + tokenA, path => {
    if (path.endsWith("/exchange")) return ++exchangeCount === 1 ? firstExchange.promise : secondExchange.promise;
    return json(data(exchangeCount === 1 ? "person-a" : "person-b"));
  });
  const first = subject.api.openParticipantSession();
  subject.browser.location.hash = "#access=" + tokenB + "%22";
  const second = subject.api.openParticipantSession();
  assert.equal(subject.browser.location.hash, "");
  assert.notEqual(first, second);
  assert.equal(subject.calls.length, 1, "the second exchange must wait for the first session to finish");
  assert.equal(subject.api.openParticipantSession(), second);
  firstExchange.resolve(json({ ok: true }));
  assert.equal((await first).participant.id, "person-a");
  await settle();
  assert.equal(subject.calls.length, 3);
  assert.equal(JSON.parse(subject.calls[2].options.body).token, tokenB);
  assert.equal(subject.api.openParticipantSession(), second, "the first request's cleanup cannot clear the second request's cache");
  secondExchange.resolve(json({ ok: true }));
  assert.equal((await second).participant.id, "person-b");
  assert.ok(subject.calls.every(call => call.hash === ""));
});

test("a rejected grant is shared while pending, then a reopened complete link can try again", async () => {
  let valid = false;
  const exchange = deferred();
  const subject = client("#access=" + tokenA, path => path.endsWith("/exchange")
    ? valid ? json({ ok: true }) : exchange.promise : json(data()));
  const first = subject.api.openParticipantSession();
  const second = subject.api.openParticipantSession();
  exchange.resolve(json({ error: { code: "portal_access_invalid", message: "El enlace personal expiró o fue reemplazado." } }, 401));
  const results = await Promise.allSettled([first, second]);
  assert.ok(results.every(result => result.status === "rejected" && result.reason.code === "portal_access_invalid"));
  assert.equal(subject.calls.length, 1, "failed exchange must not continue to /me");
  valid = true;
  subject.browser.location.hash = "#access=" + tokenA;
  await subject.api.openParticipantSession();
  assert.equal(subject.calls.length, 3);
});

test("opening after logout rechecks the server and cannot return a previously settled profile", async () => {
  let loggedOut = false;
  const subject = client("#access=" + tokenA, path => {
    if (path.endsWith("/logout")) { loggedOut = true; return json({ ok: true }); }
    if (path.endsWith("/me")) return loggedOut ? json({ error: { code: "portal_session_required", message: "Abre tu enlace personal." } }, 401) : json(data());
    return json({ ok: true });
  });
  await subject.api.openParticipantSession();
  await subject.api.participantRequest("/api/participant/logout", { method: "POST" });
  await assert.rejects(subject.api.openParticipantSession(), error => error.status === 401);
  assert.deepEqual(subject.calls.map(call => call.path), ["/api/participant/access/exchange", "/api/participant/me", "/api/participant/logout", "/api/participant/me"]);
});

test("a chapter hash without a private grant remains available and uses the existing session", async () => {
  const subject = client("#tus-fotos");
  await subject.api.openParticipantSession();
  assert.equal(subject.history.length, 0);
  assert.equal(subject.browser.location.hash, "#tus-fotos");
  assert.deepEqual(subject.calls.map(call => call.path), ["/api/participant/me"]);
});
