import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { participantDemoMediaDefinitions, getParticipantDemoMediaByPath, getParticipantDemoMediaBySlot } from "../shared/participant-demo-media.js";
import { PHOTO_WATERMARK_VERSION, addPreparedPhotoMarker, validatePreparedParticipantPhoto } from "../shared/participant-photo-watermark.js";
import { prepareParticipantDemoPhoto, serveParticipantDemoPhoto } from "../worker/participant-demo-media.js";

const bytesBySlot = new Map(await Promise.all(participantDemoMediaDefinitions.map(async photo => [photo.slot,
  await fs.readFile(new URL(`../public${photo.sourcePath}`, import.meta.url))])));
const first = participantDemoMediaDefinitions[0];
const second = participantDemoMediaDefinitions[1];
const request = (photo = first, method = "GET") => new Request(`https://levitate.test${photo.publicPath}`, { method });

function object(photo, bytes = bytesBySlot.get(photo.slot)) {
  return { body: bytes, size: bytes.byteLength, httpMetadata: { contentType: "image/jpeg" },
    customMetadata: { watermarkVersion: PHOTO_WATERMARK_VERSION } };
}

function sourceEnvironment(overrides = {}) {
  const calls = [];
  return { calls, env: { ASSETS: { async fetch(source) {
    calls.push(source);
    const photo = participantDemoMediaDefinitions.find(row => row.sourcePath === new URL(source.url).pathname);
    assert.ok(photo, "only a fixed approved local asset may be loaded");
    const bytes = bytesBySlot.get(photo.slot);
    return new Response(overrides.bytes || bytes, { status: overrides.status || 200,
      headers: { "content-type": overrides.contentType || "image/jpeg", "content-length": String(overrides.size ?? bytes.length) } });
  } } } };
}

function provider(photo = first, stored = object(photo)) {
  const calls = [];
  return { calls, getMediaStore: async () => ({ info: { provider: "google_drive" },
    async getByStorageKey(key) { calls.push(key); return stored; },
  }) };
}

async function changedPreparedPhoto(photo) {
  const source = bytesBySlot.get(photo.slot);
  const markerEnd = 4 + source.readUInt16BE(4);
  const unmarked = Buffer.concat([source.subarray(0, 2), source.subarray(markerEnd)]);
  let offset = unmarked.length - 20;
  while (offset > unmarked.length / 2 && (unmarked[offset] < 10 || unmarked[offset] > 200)) offset--;
  unmarked[offset] ^= 1;
  return addPreparedPhotoMarker(unmarked, photo.width, photo.height);
}

test("demo allowlist describes exactly two frozen archival snapshots without Drive identities", async () => {
  assert.equal(participantDemoMediaDefinitions.length, 2);
  assert.ok(Object.isFrozen(participantDemoMediaDefinitions));
  for (const photo of participantDemoMediaDefinitions) {
    assert.ok(Object.isFrozen(photo));
    assert.equal(getParticipantDemoMediaByPath(photo.publicPath), photo);
    assert.equal(getParticipantDemoMediaBySlot(photo.slot), photo);
    const bytes = bytesBySlot.get(photo.slot);
    const prepared = await validatePreparedParticipantPhoto(bytes);
    assert.equal(prepared.sha256, photo.sha256);
    assert.equal(bytes.length, photo.byteSize);
    assert.equal(prepared.width, photo.width); assert.equal(prepared.height, photo.height);
    assert.equal(photo.storageKey, `participant-demo/v2/${photo.slot}/${photo.sha256}`);
    assert.doesNotMatch(JSON.stringify(photo), /googleapis|drive\.google|google_drive:|participantId|eventId|curp/i);
    const originalName = photo.slot === "foto-1" ? "participant-demo-photo-watermarked.jpg" : "participant-demo-photo-blurred-watermarked.jpg";
    const original = await fs.readFile(new URL(`../public/assets/${originalName}`, import.meta.url));
    const markerEnd = 4 + bytes.readUInt16BE(4);
    assert.deepEqual(Buffer.concat([bytes.subarray(0, 2), bytes.subarray(markerEnd)]), original,
      "preparing a demo snapshot must not redraw, recompress or add a second visible watermark");
  }
  assert.equal(getParticipantDemoMediaByPath("/api/participant/assets/private-asset"), null);
  assert.equal(getParticipantDemoMediaBySlot("foto-3"), null);
});

test("authenticated admin helper stores only an approved static snapshot and returns a public demo URL", async () => {
  const fixture = sourceEnvironment();
  const writes = [];
  const result = await prepareParticipantDemoPhoto(fixture.env, { slot: first.slot, getMediaStore: async () => ({
    info: { provider: "google_drive" },
    async put(...args) { writes.push(args); return { objectKey: "google_drive:private-provider-id" }; },
  }) });
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].url, `https://levitate.mx${first.sourcePath}`);
  assert.equal(fixture.calls[0].redirect, "manual");
  assert.equal(writes[0][0], first.storageKey);
  assert.deepEqual(writes[0][1], new Uint8Array(bytesBySlot.get(first.slot)));
  assert.deepEqual(writes[0][2], { verifiedSha256: first.sha256, httpMetadata: { contentType: "image/jpeg" },
    customMetadata: { watermarkVersion: PHOTO_WATERMARK_VERSION } });
  assert.deepEqual(result, { slot: first.slot, previewUrl: first.publicPath });
  assert.doesNotMatch(JSON.stringify(result), /private-provider-id|google_drive|drive\.google|token|sha256/i);
});

test("admin helper rejects arbitrary slots before local assets or Google are contacted", async () => {
  let calls = 0;
  const getMediaStore = async () => { calls++; throw new Error("Unexpected provider access"); };
  const env = { ASSETS: { async fetch() { calls++; throw new Error("Unexpected asset access"); } } };
  for (const slot of ["foto-3", "../../private", "google_drive:provider-id", "foto-1?participantId=private", null]) {
    await assert.rejects(prepareParticipantDemoPhoto(env, { slot, getMediaStore }), error => error.statusCode === 400);
  }
  assert.equal(calls, 0);
});

test("admin helper rejects source size, type or approved hash changes before writing to Drive", async () => {
  let stores = 0;
  const getMediaStore = async () => { stores++; throw new Error("must not obtain storage for an invalid source"); };
  const changed = await changedPreparedPhoto(first);
  assert.equal(changed.length, first.byteSize);
  assert.notEqual((await validatePreparedParticipantPhoto(changed)).sha256, first.sha256);
  for (const overrides of [{ size: first.byteSize + 1 }, { contentType: "text/html" }, { bytes: changed }, { status: 302 }]) {
    const { env } = sourceEnvironment(overrides);
    await assert.rejects(prepareParticipantDemoPhoto(env, { slot: first.slot, getMediaStore }), error =>
      error.statusCode === 503 && !/must not obtain|token|googleapis/.test(error.message));
  }
  assert.equal(stores, 0);
});

test("public GET returns the exact verified archival bytes from the private Drive store", async () => {
  const storage = provider();
  const response = await serveParticipantDemoPhoto(request(), storage);
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array(bytesBySlot.get(first.slot)));
  assert.deepEqual(storage.calls, [first.storageKey]);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.equal(response.headers.get("content-length"), String(first.byteSize));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-levitate-media-source"), "google-drive");
  assert.equal(response.headers.get("cache-control"), "public, max-age=300");
  assert.doesNotMatch([...response.headers.values()].join(" "), /private-provider-id|googleapis|drive\.google|token/i);
});

test("HEAD verifies the same approved Drive snapshot and returns headers with no body", async () => {
  const storage = provider(second);
  const response = await serveParticipantDemoPhoto(request(second, "HEAD"), storage);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("content-length"), String(second.byteSize));
  assert.equal(response.headers.get("x-levitate-media-source"), "google-drive");
  assert.deepEqual(storage.calls, [second.storageKey]);
});

test("unknown paths, query parameters and methods never reach storage or cache", async () => {
  let calls = 0;
  const options = { getMediaStore: async () => { calls++; }, cache: { async match() { calls++; } } };
  for (const path of ["/media/mi-levitate-demo/foto-3.jpg", "/media/mi-levitate-demo/private-id.jpg",
    "/api/participant/assets/private-asset", `${first.publicPath}?fileId=private`, `${first.publicPath}?slot=foto-2`]) {
    const response = await serveParticipantDemoPhoto(new Request(`https://levitate.test${path}`), options);
    assert.equal(response.status, 404);
  }
  const method = await serveParticipantDemoPhoto(request(first, "POST"), options);
  assert.equal(method.status, 405); assert.equal(method.headers.get("allow"), "GET, HEAD");
  assert.equal(calls, 0);
});

test("public handler refuses unapproved Drive bytes and returns bounded provider errors", async () => {
  const changed = await changedPreparedPhoto(first);
  const variants = [object(first, changed), { ...object(first), size: first.byteSize + 1 },
    { ...object(first), customMetadata: {} }, { ...object(first), httpMetadata: { contentType: "application/pdf" } }];
  for (const stored of variants) {
    const response = await serveParticipantDemoPhoto(request(), provider(first, stored));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-levitate-media-source"), null);
    assert.doesNotMatch(await response.text(), /private-provider-id|token|googleapis|drive\.google|sha256/i);
  }
  const failed = await serveParticipantDemoPhoto(request(), { getMediaStore: async () => { throw new Error("token=private-provider-id https://www.googleapis.com/private"); } });
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private-provider-id|googleapis|token/);
  const missing = await serveParticipantDemoPhoto(request(), provider(first, null));
  assert.equal(missing.status, 404);
});

test("public handler requires Google Drive and has no local-source fallback", async () => {
  let reads = 0;
  const response = await serveParticipantDemoPhoto(request(), { getMediaStore: async () => ({ info: { provider: "other" },
    async getByStorageKey() { reads++; return object(first); },
  }) });
  assert.equal(response.status, 503);
  assert.equal(reads, 0);
});

test("verified demo cache reuses Drive bytes while invalid cached bytes are replaced", async () => {
  const entries = new Map();
  let puts = 0;
  const cache = {
    async match(key) { return entries.get(key.url)?.clone(); },
    async put(key, response) { puts++; entries.set(key.url, response.clone()); },
  };
  const storage = provider();
  const background = [];
  const firstResponse = await serveParticipantDemoPhoto(request(), { ...storage, cache, waitUntil: promise => background.push(promise) });
  assert.equal(firstResponse.status, 200);
  await Promise.all(background);
  assert.equal(puts, 1); assert.equal(storage.calls.length, 1);
  const head = await serveParticipantDemoPhoto(request(first, "HEAD"), { ...storage, cache });
  assert.equal(head.status, 200); assert.equal(await head.text(), ""); assert.equal(storage.calls.length, 1);
  const changed = await changedPreparedPhoto(first);
  const key = [...entries.keys()][0];
  entries.set(key, new Response(changed, { headers: { "content-type": "image/jpeg", "content-length": String(changed.length) } }));
  const repaired = await serveParticipantDemoPhoto(request(), { ...storage, cache });
  assert.equal(repaired.status, 200);
  assert.deepEqual(new Uint8Array(await repaired.arrayBuffer()), new Uint8Array(bytesBySlot.get(first.slot)));
  assert.equal(storage.calls.length, 2); assert.equal(puts, 2);
});
