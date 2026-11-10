import assert from "node:assert/strict";
import test from "node:test";
import { getParticipantMediaStorageRouter } from "../worker/participant-media-storage-router.js";
import { getParticipantPhotoDriveConfig, hasParticipantPhotoDriveConfig } from "../worker/participant-photo-drive-config.js";

const photoOptions = { httpMetadata: { contentType: "image/jpeg" }, customMetadata: { watermarkVersion: "levitate-preview-v2" }, verifiedSha256: "a".repeat(64) };
const pdfOptions = { httpMetadata: { contentType: "application/pdf" } };
const oldPdf = "google_drive:historical_pdf_123456";
const oldPhoto = "google_drive:historical_photo_123456";

function storageFixture(name) {
  const calls = [], saved = new Map(), created = new Set();
  const store = {
    info: { provider: "google_drive", ready: true, accountEmail: `${name}@example.test`, folderId: `${name}_folder_123456`, folderName: `${name} private`, clientSecret: "never-serialize-this" },
    async put(key, bytes, options) {
      calls.push({ method: "put", key, bytes, options });
      if (!saved.has(key)) {
        const objectKey = `google_drive:${name}_file_${String(saved.size + 1).padStart(10, "0")}`;
        saved.set(key, { objectKey, bytes, options }); created.add(objectKey);
      }
      return { objectKey: saved.get(key).objectKey };
    },
    async get(key, ...args) { calls.push({ method: "get", key, args }); return { owner: name, key }; },
    async delete(key) {
      calls.push({ method: "delete", key });
      if (!created.has(key)) return false;
      created.delete(key); return true;
    },
    async getByStorageKey(key) { calls.push({ method: "getByStorageKey", key }); return { owner: name, key }; },
    async prepareDemoAlbum(input) { calls.push({ method: "prepareDemoAlbum", input }); return { owner: name, ...input }; },
  };
  return { store, calls, saved };
}
async function fixture({ configured = true, photoFailure, legacyFailure } = {}) {
  const legacy = storageFixture("music"), photo = storageFixture("ati");
  const counts = { legacy: 0, photo: 0 };
  const router = await getParticipantMediaStorageRouter({
    photoConfigured: configured,
    getLegacyStore: async () => { counts.legacy += 1; if (legacyFailure) throw legacyFailure; return legacy.store; },
    getPhotoStore: async () => { counts.photo += 1; if (photoFailure) throw photoFailure; return photo.store; },
  });
  return { router, legacy, photo, counts };
}

test("new photo writes use Ati while old PDFs and old photos keep their original Drive", async () => {
  const f = await fixture(), bytes = new Uint8Array([1, 2, 3]);
  assert.deepEqual(f.counts, { legacy: 0, photo: 0 }, "creating a router has no provider side effects");
  assert.deepEqual(f.router.info, { provider: "google_drive", ready: false });
  const result = await f.router.put("new-photo", bytes, photoOptions);
  assert.match(result.objectKey, /^google_drive_photo:ati_file_/);
  assert.equal(f.legacy.calls.length, 0);
  assert.equal((await f.router.get(oldPdf)).owner, "music");
  assert.equal((await f.router.get(oldPhoto)).owner, "music");
  assert.equal((await f.router.get(result.objectKey)).owner, "ati");
  assert.equal(f.photo.calls.at(-1).key, result.objectKey.replace("google_drive_photo:", "google_drive:"));
  assert.equal(f.photo.calls[0].options, photoOptions, "integrity and watermark options are preserved");
  const pdf = await f.router.put("new-diploma", bytes, pdfOptions);
  assert.match(pdf.objectKey, /^google_drive:music_file_/);
  assert.deepEqual(f.counts, { legacy: 1, photo: 1 });
});

test("an unavailable photo account does not block historical reads or PDF creation", async () => {
  const failure = Object.assign(new Error("wrong photo owner"), { code: "portal_storage_wrong_account" });
  const f = await fixture({ photoFailure: failure });
  await assert.rejects(f.router.getInfo(), { code: failure.code });
  await assert.rejects(f.router.put("new-photo", new Uint8Array([1]), photoOptions), { code: failure.code });
  await assert.rejects(f.router.get("google_drive_photo:unavailable_photo_123456"), { code: failure.code });
  assert.equal((await f.router.get(oldPdf)).owner, "music");
  assert.equal((await f.router.get(oldPhoto)).owner, "music");
  assert.match((await f.router.put("new-sheet", new Uint8Array([1]), pdfOptions)).objectKey, /^google_drive:/);
  assert.deepEqual(f.counts, { legacy: 1, photo: 1 }, "failed photo initialization is not retried or downgraded to music");
  assert.ok(f.legacy.calls.every(call => call.method !== "put" || call.options.httpMetadata.contentType === "application/pdf"));
});

test("partial new configuration fails only photo operations and never falls back to music", async () => {
  const env = { PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL: "ati@example.test", GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: "existing-music-token" };
  const legacy = storageFixture("music"), calls = { legacy: 0, photo: 0 };
  const router = await getParticipantMediaStorageRouter({ photoConfigured: hasParticipantPhotoDriveConfig(env),
    getLegacyStore: async () => { calls.legacy += 1; return legacy.store; },
    getPhotoStore: async () => { calls.photo += 1; return getParticipantPhotoDriveConfig(env); },
  });
  assert.equal((await router.get(oldPhoto)).owner, "music");
  await assert.rejects(router.put("new-photo", new Uint8Array([1]), photoOptions), { code: "portal_photo_drive_not_configured" });
  await assert.rejects(router.getByStorageKey("participant-demo/photo-1"), { code: "portal_photo_drive_not_configured" });
  assert.equal(legacy.calls.filter(call => call.method === "put").length, 0);
  assert.deepEqual(calls, { legacy: 1, photo: 1 });
});

test("the unconfigured deployment preserves legacy behavior but rejects new photo-prefixed keys", async () => {
  const f = await fixture({ configured: false });
  const saved = await f.router.put("photo-before-activation", new Uint8Array([1]), photoOptions);
  assert.match(saved.objectKey, /^google_drive:music_file_/);
  assert.equal((await f.router.getByStorageKey("demo/photo-1")).owner, "music");
  assert.equal((await f.router.getInfo()).accountEmail, "music@example.test");
  await assert.rejects(f.router.get("google_drive_photo:photo_after_activation_123456"), { code: "portal_photo_drive_not_configured" });
  assert.equal(f.counts.photo, 0);
});

test("photo idempotency and rollback stay in the photo provider", async () => {
  const f = await fixture(), bytes = new Uint8Array([1]);
  const [a, b] = await Promise.all([f.router.put("same-photo-key", bytes, photoOptions), f.router.put("same-photo-key", bytes, photoOptions)]);
  assert.equal(a.objectKey, b.objectKey);
  assert.equal(f.photo.saved.size, 1);
  assert.equal(await f.router.delete(a.objectKey), true);
  assert.equal(await f.router.delete(a.objectKey), false);
  assert.equal(f.legacy.calls.length, 0);
  assert.equal(await f.router.delete(oldPhoto), false, "historical rollback behavior is retained");
  assert.equal(f.legacy.calls.at(-1).key, oldPhoto);
  assert.deepEqual(f.counts, { legacy: 1, photo: 1 });
});

test("status and demo lookup use only Ati after activation without exposing credentials", async () => {
  const f = await fixture({ legacyFailure: new Error("music unavailable") });
  const info = await f.router.getInfo();
  assert.deepEqual(info, { provider: "google_drive", ready: true, accountEmail: "ati@example.test", folderId: "ati_folder_123456", folderName: "ati private" });
  assert.equal(f.router.info, info);
  assert.doesNotMatch(JSON.stringify(info), /never-serialize|clientSecret/);
  assert.equal((await f.router.getByStorageKey("demo-photo-key")).owner, "ati");
  const input = { eventId: "event-1", danceId: "dance-1", folderName: "Demo", photos: [] };
  const album = await f.router.prepareDemoAlbum(input);
  assert.equal(album.owner, "ati");
  assert.equal(f.photo.calls.at(-1).input, input);
  assert.equal(f.counts.legacy, 0);
});

test("a missing photo lookup result is returned without checking music", async () => {
  const f = await fixture(); f.photo.store.getByStorageKey = async () => null;
  assert.equal(await f.router.getByStorageKey("missing-photo-key"), null);
  assert.equal(f.counts.legacy, 0);
});

test("invalid prefixes, malformed IDs and unsupported types never contact either provider", async () => {
  const f = await fixture();
  for (const key of [null, "", "google_drive:short", "google_drive_photo:short", "google_drive_photo:../secret", "https://drive.google.com/file/123", "other:historical_pdf_123456", "google_drive_photo:long_photo_id_123456?secret=1"]) {
    await assert.rejects(f.router.get(key), { code: "portal_asset_not_found" });
    await assert.rejects(f.router.delete(key), { code: "portal_asset_not_found" });
  }
  await assert.rejects(f.router.put("audio", new Uint8Array([1]), { httpMetadata: { contentType: "audio/mpeg" } }), { code: "portal_invalid_asset_type" });
  assert.deepEqual(f.counts, { legacy: 0, photo: 0 });
});
