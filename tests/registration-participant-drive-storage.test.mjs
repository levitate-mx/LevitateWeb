import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getParticipantDriveStorage } from "../worker/participant-drive-storage.js";
import { participantDemoMediaDefinitions } from "../shared/participant-demo-media.js";

const owner = "ati@example.test";
const token = "SYNTHETIC_PRIVATE_ACCESS_TOKEN";
const folderId = "folder_private_1234567890";
const marker = { levitateParticipantStorage: "participant_previews_v1" };
const version = "levitate-preview-v2";
const prepared = Buffer.from("\xff\xd8\xffprepared JPEG preview\xff\xd9", "latin1");
const options = { httpMetadata: { contentType: "image/jpeg" }, customMetadata: { watermarkVersion: version } };
const md5 = bytes => createHash("md5").update(bytes).digest("hex");

function privateMetadata(id, extra = {}) {
  return { id, name: "Private app content", mimeType: "application/vnd.google-apps.folder", trashed: false,
    parents: ["root_actual_1234567890"], owners: [{ emailAddress: owner }],
    permissions: [{ type: "user", role: "owner", emailAddress: owner }], shared: false,
    capabilities: { canDownload: true, canAddChildren: true }, appProperties: { ...marker }, ...extra };
}
function fixture({ hasFolder = true, aboutOwner = owner, timeoutMs, intercept } = {}) {
  const calls = [], files = new Map(), sessions = new Map();
  const state = { quota: { limit: "15000000000", usage: "1000000" }, aboutOwner, tokenCalls: 0, nextId: 0, intercept };
  if (hasFolder) files.set(folderId, privateMetadata(folderId));
  const fetchImpl = async (input, request) => {
    const url = new URL(input), call = { url, request };
    calls.push(call);
    assert.equal(url.origin, "https://www.googleapis.com");
    assert.equal(request.redirect, "manual");
    assert.ok(request.signal instanceof AbortSignal);
    assert.notEqual(request.method, "DELETE", "storage rollback never permanently deletes files");
    const overridden = await state.intercept?.(call, { state, files, sessions });
    if (overridden !== undefined) {
      if (overridden instanceof Error) throw overridden;
      return overridden;
    }
    if (request.method !== "PUT") assert.equal(request.headers.authorization, `Bearer ${token}`);
    if (url.pathname === "/drive/v3/about") return Response.json({ user: { emailAddress: state.aboutOwner }, storageQuota: state.quota });
    if (url.pathname === "/drive/v3/files/generateIds") {
      state.nextId += 1;
      return Response.json({ ids: [`new_private_file_${String(state.nextId).padStart(10, "0")}`] });
    }
    if (url.pathname === "/drive/v3/files" && request.method === "GET") {
      const q = url.searchParams.get("q");
      assert.match(q, /appProperties has/);
      assert.doesNotMatch(q, /photo_video|music|QR/);
      const properties = [...q.matchAll(/appProperties has \{ key='([^']+)' and value='([^']+)' \}/g)];
      const parent = q.match(/^'([^']+)' in parents/)?.[1];
      assert.ok(parent);
      return Response.json({ files: [...files.values()].filter(value => !value.trashed
        && (!q.includes("mimeType") || value.mimeType === "application/vnd.google-apps.folder")
        && (parent === "root" ? value.parents?.includes("root_actual_1234567890") : value.parents?.includes(parent))
        && properties.every(([, key, expected]) => value.appProperties?.[key] === expected)).map(({ id }) => ({ id })) });
    }
    if (url.pathname === "/drive/v3/files" && request.method === "POST") {
      const body = JSON.parse(request.body);
      assert.equal(body.mimeType, "application/vnd.google-apps.folder");
      let id;
      if (body.appProperties.levitateParticipantStorage) {
        assert.equal(body.name, "Mi Levitate · Vistas previas privadas");
        assert.equal(body.parents, undefined, "a new preview folder goes directly into My Drive root");
        assert.deepEqual(body.appProperties, marker);
        id = folderId;
      } else {
        assert.match(body.appProperties.levitatePhotoAlbum, /^demo_(root|album)_v1$/);
        assert.equal(body.appProperties.demo, "true");
        state.nextId++;
        id = `new_album_folder_${String(state.nextId).padStart(10, "0")}`;
      }
      files.set(id, privateMetadata(id, { ...body, parents: body.parents || ["root_actual_1234567890"], webViewLink: `https://drive.google.com/drive/folders/${id}` }));
      return Response.json({ id });
    }
    if (url.pathname === "/upload/drive/v3/files" && request.method === "POST") {
      const metadata = JSON.parse(request.body);
      assert.equal(metadata.permissions, undefined);
      if (metadata.appProperties.levitatePhotoAlbum) {
        assert.equal(metadata.parents.length, 1);
        assert.notEqual(metadata.parents[0], folderId);
        assert.equal(files.get(metadata.parents[0]).appProperties.levitatePhotoAlbum, "demo_album_v1");
        assert.match(metadata.name, /^DEMO-foto-[12]\.jpg$/);
      } else {
        assert.deepEqual(metadata.parents, [folderId]);
        assert.match(metadata.name, /^lv-[a-f0-9]{32}\.(jpg|pdf)$/);
      }
      const session = `session_${sessions.size + 1}`;
      sessions.set(session, metadata);
      return new Response(null, { status: 200, headers: { location: `https://www.googleapis.com/upload/drive/v3/files?upload_id=${session}` } });
    }
    if (url.pathname === "/upload/drive/v3/files" && request.method === "PUT") {
      assert.equal(request.headers.authorization, undefined, "the upload capability is kept on the exact Google API origin");
      const metadata = sessions.get(url.searchParams.get("upload_id"));
      assert.ok(metadata);
      const bytes = new Uint8Array(request.body);
      files.set(metadata.id, privateMetadata(metadata.id, { ...metadata, bytes,
        size: String(bytes.length), md5Checksum: md5(bytes), sha256Checksum: createHash("sha256").update(bytes).digest("hex") }));
      return Response.json({ id: metadata.id });
    }
    const match = url.pathname.match(/^\/drive\/v3\/files\/([A-Za-z0-9_-]+)$/);
    if (match) {
      const metadata = files.get(match[1]);
      if (!metadata) return new Response("SYNTHETIC_PROVIDER_DETAIL", { status: 404 });
      if (request.method === "PATCH") {
        assert.deepEqual(JSON.parse(request.body), { trashed: true });
        metadata.trashed = true;
        return Response.json({ id: metadata.id, trashed: true });
      }
      if (url.searchParams.get("alt") === "media") return new Response(metadata.bytes, {
        headers: { "content-type": metadata.mimeType, "content-length": metadata.size },
      });
      assert.equal(url.searchParams.get("supportsAllDrives"), "true");
      if (metadata.appProperties?.levitatePhotoAlbum) assert.match(url.searchParams.get("fields"), /webViewLink/);
      else assert.doesNotMatch(url.searchParams.get("fields"), /webViewLink|webContentLink|thumbnailLink/);
      const { bytes: _bytes, ...safe } = metadata;
      return Response.json(safe);
    }
    throw new Error(`Unexpected fixture route ${url.pathname}`);
  };
  const store = (overrides = {}) => getParticipantDriveStorage({
    db: { prepare() { throw new Error("No schema/settings writes or queries are required for appProperties discovery"); } },
    getConfig: () => ({ authType: "oauth_refresh_token", refreshToken: "SYNTHETIC_PRIVATE_REFRESH_TOKEN" }),
    getAccessToken: async (config, { signal }) => { assert.ok(signal instanceof AbortSignal); state.tokenCalls++; return token; },
    expectedEmail: owner, fetchImpl, ...(timeoutMs ? { timeoutMs, streamTimeoutMs: timeoutMs } : {}), ...overrides,
  });
  return { store, state, calls, files, sessions };
}
const writeCalls = calls => calls.filter(({ request }) => request.method !== "GET");
const mediaCalls = calls => calls.filter(({ url }) => url.searchParams.get("alt") === "media");
const controlled = (code, status = 503) => error => {
  assert.equal(error.code, code); assert.equal(error.statusCode, status);
  assert.doesNotMatch(error.message, /SYNTHETIC_|https:\/\//);
  return true;
};

test("an absent preview folder remains unavailable until an admin explicitly prepares it", async () => {
  const f = fixture({ hasFolder: false });
  await assert.rejects(f.store(), controlled("portal_storage_unavailable"));
  assert.equal(writeCalls(f.calls).length, 0);
  const store = await f.store({ create: true });
  assert.deepEqual(store.info, { provider: "google_drive", accountEmail: owner, folderId, folderName: "Mi Levitate · Vistas previas privadas", ready: true });
  await f.store({ create: true });
  assert.equal(writeCalls(f.calls).length, 1, "reuse the app-owned folder instead of creating another");
  assert.doesNotMatch(JSON.stringify(store.info), /SYNTHETIC_|refreshToken|accessToken/);
});

test("the expected account is verified before folder creation or upload", async () => {
  const f = fixture({ hasFolder: false, aboutOwner: "other@example.test" });
  await assert.rejects(f.store({ create: true }), controlled("portal_storage_wrong_account"));
  assert.equal(f.calls.length, 1);
  assert.equal(writeCalls(f.calls).length, 0);
});

test("missing config, malformed account and duplicate folder discoveries fail safely", async () => {
  const f = fixture();
  await assert.rejects(f.store({ getConfig: () => null }), controlled("portal_storage_unavailable"));
  await assert.rejects(f.store({ expectedEmail: "" }), controlled("portal_storage_unavailable"));
  await assert.rejects(f.store({ getConfig: () => { throw new Error(token); } }), controlled("portal_storage_unavailable"));
  assert.equal(f.calls.length, 0);
  const duplicate = fixture({ intercept: ({ url }) => url.pathname === "/drive/v3/files" ? Response.json({ files: [{ id: folderId }, { id: "other_private_folder_123456" }] }) : undefined });
  await assert.rejects(duplicate.store(), controlled("portal_storage_conflict", 409));
});

test("public, shared, foreign-owner and unmarked folders are never used", async () => {
  for (const change of [
    { shared: true }, { permissions: [{ type: "anyone", role: "reader" }] },
    { permissions: [{ type: "domain", role: "reader", domain: "example.test" }] },
    { permissions: [{ type: "user", role: "writer", emailAddress: "staff@example.test" }] },
    { permissions: undefined }, { owners: [{ emailAddress: "other@example.test" }] },
    { driveId: "shared_drive_1234567890" }, { trashed: true }, { appProperties: {} },
  ]) {
    const f = fixture(); Object.assign(f.files.get(folderId), change);
    await assert.rejects(f.store(), error => error.statusCode === 503);
    assert.equal(writeCalls(f.calls).length, 0);
  }
});

test("prepared previews upload privately, stream through the adapter, and cache the token only within this store", async () => {
  const f = fixture(), store = await f.store();
  const uploaded = await store.put("participant-portal/event/asset-key", prepared, options);
  assert.match(uploaded.objectKey, /^google_drive:new_private_file_/);
  const object = await store.get(uploaded.objectKey);
  assert.equal(object.size, prepared.length);
  assert.deepEqual(object.customMetadata, { watermarkVersion: version });
  assert.deepEqual(object.httpMetadata, { contentType: "image/jpeg" });
  assert.deepEqual(Buffer.from(await new Response(object.body).arrayBuffer()), prepared);
  assert.equal(f.state.tokenCalls, 1);
  assert.ok(writeCalls(f.calls).every(({ url }) => !url.pathname.includes("permissions")));
  assert.equal(f.files.size, 2);
  await f.store(); assert.equal(f.state.tokenCalls, 2, "no global authorization cache crosses requests");
});

test("same-key retries reuse a verified identical file and conflicting bytes do not replace it", async () => {
  const f = fixture(), firstStore = await f.store();
  const uploaded = await firstStore.put("stable-storage-key", prepared, options);
  const secondStore = await f.store();
  assert.deepEqual(await secondStore.put("stable-storage-key", prepared, options), uploaded);
  assert.equal(f.sessions.size, 1);
  await assert.rejects(secondStore.put("stable-storage-key", Buffer.from("different bytes"), options), controlled("portal_upload_conflict", 409));
  assert.equal(f.sessions.size, 1);
  assert.equal(await secondStore.delete(uploaded.objectKey), false, "a historical/deduplicated file is not an orphan of this request");
});

test("an internal server-verified SHA can be reused and invalid digest options never upload", async () => {
  const f = fixture(), store = await f.store();
  const verifiedSha256 = createHash("sha256").update(prepared).digest("hex");
  const uploaded = await store.put("server-verified-file", prepared, { ...options, verifiedSha256 });
  const stored = f.files.get(uploaded.objectKey.split(":")[1]);
  assert.equal(stored.appProperties.levitateSha256, verifiedSha256);
  const writesBefore = writeCalls(f.calls).length;
  for (const invalid of ["", "not-a-digest", "A".repeat(64), null, {}]) {
    await assert.rejects(store.put("invalid-digest-file", prepared, { ...options, verifiedSha256: invalid }), controlled("portal_invalid_asset", 400));
  }
  assert.equal(writeCalls(f.calls).length, writesBefore);
});

test("storage-key lookup returns verified bytes without revealing the Drive identifier", async () => {
  const f = fixture(), store = await f.store();
  const key = "participant-demo/v2/foto-1/" + createHash("sha256").update(prepared).digest("hex");
  assert.equal(await store.getByStorageKey(key), null);
  const uploaded = await store.put(key, prepared, options);
  const object = await store.getByStorageKey(key);
  assert.equal(object.size, prepared.length);
  assert.deepEqual(object.customMetadata, { watermarkVersion: version });
  assert.deepEqual(Buffer.from(await new Response(object.body).arrayBuffer()), prepared);
  assert.equal(object.objectKey, undefined); assert.equal(object.id, undefined);
  assert.doesNotMatch(JSON.stringify(object), new RegExp(uploaded.objectKey.split(":")[1]));
  assert.equal(await store.getByStorageKey(uploaded.objectKey), null, "an object ID is not interpreted as a storage key");
});

test("storage-key lookup validates bounds and never treats opaque keys as URLs", async () => {
  const f = fixture(), store = await f.store(), before = f.calls.length;
  for (const key of [undefined, null, {}, "", "  ", "a".repeat(2049), "line\nbreak", "bad\u0000key", "bad\u007fkey"]) {
    await assert.rejects(store.getByStorageKey(key), controlled("portal_invalid_asset", 400));
  }
  assert.equal(f.calls.length, before);
  assert.equal(await store.getByStorageKey("https://evil.test/never-requested"), null);
  assert.ok(f.calls.every(({ url }) => url.origin === "https://www.googleapis.com"));
  assert.equal(mediaCalls(f.calls).length, 0);
});

test("storage-key lookup rechecks live ownership, privacy and key hash before reading media", async () => {
  for (const change of [
    { permissions: [{ type: "anyone", role: "reader" }] },
    { owners: [{ emailAddress: "other@example.test" }] },
    { parents: ["other_private_folder_123456"] },
  ]) {
    const f = fixture(), store = await f.store();
    const uploaded = await store.put("approved-demo-key", prepared, options);
    Object.assign(f.files.get(uploaded.objectKey.split(":")[1]), change);
    if (change.parents) f.state.intercept = ({ url }) => url.pathname === "/drive/v3/files" && !url.searchParams.get("q").includes("mimeType")
      ? Response.json({ files: [{ id: uploaded.objectKey.split(":")[1] }] }) : undefined;
    await assert.rejects(store.getByStorageKey("approved-demo-key"), error => error.statusCode === 503);
    assert.equal(mediaCalls(f.calls).length, 0);
  }
  const f = fixture(), store = await f.store();
  const uploaded = await store.put("some-other-key", prepared, options);
  const id = uploaded.objectKey.split(":")[1];
  f.state.intercept = ({ url }) => url.pathname === "/drive/v3/files" && !url.searchParams.get("q").includes("mimeType")
    ? Response.json({ files: [{ id }] }) : undefined;
  await assert.rejects(store.getByStorageKey("approved-demo-key"), error => error.statusCode === 503);
  assert.equal(mediaCalls(f.calls).length, 0, "even an incorrect list result cannot bypass the exact key association");
});

test("quota is checked before writing, including unknown quota and explicit setup", async () => {
  const f = fixture(), store = await f.store();
  f.state.quota = { limit: "100", usage: "100" };
  await assert.rejects(store.put("quota-file", prepared, options), controlled("portal_storage_quota_exceeded", 507));
  assert.equal(writeCalls(f.calls).length, 0);
  f.state.quota = { usage: "100" };
  await assert.rejects(store.put("quota-file", prepared, options), controlled("portal_storage_quota_unknown"));
  await assert.rejects(f.store({ create: true }), controlled("portal_storage_quota_unknown"));
  assert.equal(writeCalls(f.calls).length, 0);
});

test("the adapter accepts bounded PDFs but rejects oversized or unprepared photos before uploading", async () => {
  const f = fixture(), store = await f.store();
  for (const [bytes, putOptions] of [
    [prepared, { httpMetadata: { contentType: "image/png" } }],
    [prepared, { httpMetadata: { contentType: "image/jpeg" } }],
    [new Uint8Array(1024 * 1024 + 1), options],
    [new Uint8Array(8 * 1024 * 1024 + 1), { httpMetadata: { contentType: "application/pdf" } }],
  ]) await assert.rejects(store.put("invalid-file", bytes, putOptions), error => error.statusCode === 400);
  assert.equal(writeCalls(f.calls).length, 0);
  const pdf = Buffer.from("%PDF-1.7\nprivate example");
  const uploaded = await store.put("private-pdf", pdf, { httpMetadata: { contentType: "application/pdf" } });
  const object = await store.get(uploaded.objectKey);
  assert.deepEqual(Buffer.from(await new Response(object.body).arrayBuffer()), pdf);
  assert.equal(object.httpMetadata.contentType, "application/pdf");
});

test("foreign, shared, moved, changed or unmarked file metadata blocks media bytes", async () => {
  const changes = [
    { parents: ["music_folder_1234567890"] }, { parents: [folderId, "other_folder_1234567890"] },
    { owners: [{ emailAddress: "other@example.test" }] }, { permissions: [{ type: "anyone", role: "reader" }] },
    { permissions: [{ type: "domain", role: "reader", domain: "example.test" }] },
    { shared: true }, { trashed: true }, { appProperties: {} }, { size: String(1024 * 1024 + 1) },
    { md5Checksum: "0".repeat(32) }, { sha256Checksum: "0".repeat(64) }, { capabilities: { canDownload: false } },
  ];
  for (const change of changes) {
    const f = fixture(), store = await f.store();
    const uploaded = await store.put("private-source", prepared, options);
    Object.assign(f.files.get(uploaded.objectKey.split(":")[1]), change);
    await assert.rejects(store.get(uploaded.objectKey), error => error.statusCode === 503);
    assert.equal(mediaCalls(f.calls).length, 0);
  }
});

test("malicious storage IDs fail before any upstream file request", async () => {
  const f = fixture(), store = await f.store(), before = f.calls.length;
  for (const key of ["https://evil.test/file", "google_drive:root", "google_drive:abc/../private_file_123456", "google_drive:private_file_123456?alt=media", null]) {
    await assert.rejects(store.get(key), controlled("portal_asset_not_found", 404));
  }
  assert.equal(f.calls.length, before);
});

test("resumable upload redirects never transmit bytes or credentials to another origin", async () => {
  for (const location of ["https://evil.test/upload", "http://www.googleapis.com/upload/drive/v3/files", "https://www.googleapis.com/drive/v3/files", "https://user:pass@www.googleapis.com/upload/drive/v3/files"]) {
    const f = fixture({ intercept: ({ url, request }) => url.pathname === "/upload/drive/v3/files" && request.method === "POST"
      ? new Response(null, { headers: { location } }) : undefined });
    const store = await f.store();
    await assert.rejects(store.put("unsafe-location", prepared, options), controlled("portal_storage_unavailable"));
    assert.equal(f.calls.some(({ request }) => request.method === "PUT"), false);
  }
});

test("media redirects, wrong lengths and extra stream bytes fail closed", async () => {
  const failures = [
    () => new Response("SYNTHETIC_PRIVATE_PROVIDER_DETAIL", { status: 302, headers: { location: "https://evil.test" } }),
    () => new Response(prepared, { headers: { "content-type": "image/jpeg", "content-length": String(prepared.length + 1) } }),
    () => new Response(prepared, { headers: { "content-type": "text/html" } }),
  ];
  for (const failure of failures) {
    const f = fixture(), store = await f.store();
    const uploaded = await store.put("private-file", prepared, options);
    f.state.intercept = ({ url }) => url.searchParams.get("alt") === "media" ? failure() : undefined;
    await assert.rejects(store.get(uploaded.objectKey), controlled("portal_storage_unavailable"));
  }
  const f = fixture(), store = await f.store();
  const uploaded = await store.put("private-file", prepared, options);
  f.state.intercept = ({ url }) => url.searchParams.get("alt") === "media"
    ? new Response(Buffer.concat([prepared, Buffer.from("extra")]), { headers: { "content-type": "image/jpeg" } }) : undefined;
  const object = await store.get(uploaded.objectKey);
  await assert.rejects(new Response(object.body).arrayBuffer(), error => error.code === "portal_storage_unavailable");
});

test("orphan rollback only soft-trashes a newly created, app-owned file", async () => {
  const f = fixture(), store = await f.store();
  const uploaded = await store.put("new-orphan", prepared, options);
  assert.equal(await store.delete(uploaded.objectKey), true);
  assert.equal(f.files.get(uploaded.objectKey.split(":")[1]).trashed, true);
  assert.equal(f.files.size, 2, "the file stays recoverable in Drive Trash");
  assert.equal(await store.delete(uploaded.objectKey), false);
  assert.equal(f.calls.filter(({ request }) => request.method === "PATCH").length, 1);
});

test("a newly created file that was moved or transferred cannot be trashed by rollback", async () => {
  for (const change of [{ parents: ["other_folder_1234567890"] }, { owners: [{ emailAddress: "other@example.test" }] }]) {
    const f = fixture(), store = await f.store();
    const uploaded = await store.put("new-orphan", prepared, options);
    Object.assign(f.files.get(uploaded.objectKey.split(":")[1]), change);
    await assert.rejects(store.delete(uploaded.objectKey), error => error.statusCode === 503);
    assert.equal(f.calls.filter(({ request }) => request.method === "PATCH").length, 0);
  }
});

test("an eight-MiB PDF uses a resumable upload and remains bounded when read", async () => {
  const f = fixture(), store = await f.store();
  const pdf = Buffer.alloc(8 * 1024 * 1024);
  pdf.write("%PDF-1.7\n");
  const uploaded = await store.put("large-private-pdf", pdf, { httpMetadata: { contentType: "application/pdf" } });
  const object = await store.get(uploaded.objectKey);
  assert.equal(object.size, pdf.length);
  assert.equal(md5(Buffer.from(await new Response(object.body).arrayBuffer())), md5(pdf));
  assert.equal(f.sessions.size, 1);
});

test("a stalled media body is aborted within the request timeout", async () => {
  const f = fixture({ timeoutMs: 15 }), store = await f.store();
  const uploaded = await store.put("private-file", prepared, options);
  let signal, cancelled = false;
  f.state.intercept = ({ url, request }) => {
    if (url.searchParams.get("alt") !== "media") return undefined;
    signal = request.signal;
    return new Response(new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { cancelled = true; } }), {
      headers: { "content-type": "image/jpeg", "content-length": String(prepared.length) },
    });
  };
  const object = await store.get(uploaded.objectKey);
  await assert.rejects(new Response(object.body).arrayBuffer(), error => error.code === "portal_storage_unavailable");
  assert.equal(signal.aborted, true); assert.equal(cancelled, true);
});

test("provider failures and timeouts produce controlled errors without credential details", async () => {
  for (const response of [new Response(token, { status: 403 }), new Response(token, { status: 429 }), new Response(token, { status: 500 }), Response.json([])]) {
    const f = fixture({ intercept: () => response });
    await assert.rejects(f.store(), controlled("portal_storage_unavailable"));
    assert.equal(writeCalls(f.calls).length, 0);
  }
  let signal;
  const f = fixture({ timeoutMs: 5, intercept: ({ request }) => { signal = request.signal; return new Promise(() => {}); } });
  await assert.rejects(f.store(), controlled("portal_storage_unavailable"));
  assert.equal(signal.aborted, true);
  const auth = fixture();
  await assert.rejects(auth.store({ getAccessToken: async () => { throw new Error(token); } }), controlled("portal_storage_unavailable"));
  assert.equal(auth.calls.length, 0);
});

async function demoAlbumInput() {
  return { eventId: "edomex-2026-otono", danceId: "dance_demo_1234567890", folderName: "Aire Norte · Ana Pérez",
    photos: await Promise.all(participantDemoMediaDefinitions.map(async photo => ({
      slot: photo.slot, sha256: photo.sha256, width: photo.width, height: photo.height,
      bytes: new Uint8Array(await readFile(new URL(`../public${photo.sourcePath}`, import.meta.url))),
    }))) };
}
const albumFiles = f => [...f.files.values()].filter(value => value.appProperties?.levitatePhotoAlbum === "demo_photo_v1");
const albumFolder = f => [...f.files.values()].find(value => value.appProperties?.levitatePhotoAlbum === "demo_album_v1");
const albumRoot = f => [...f.files.values()].find(value => value.appProperties?.levitatePhotoAlbum === "demo_root_v1");

test("the demo source album is separate from preview/music folders and returns bytes actually read from Drive", async () => {
  const f = fixture(), store = await f.store(), input = await demoAlbumInput();
  f.files.set("music_folder_1234567890", privateMetadata("music_folder_1234567890", {
    name: "Existing music", appProperties: { purpose: "music" },
  }));
  const oldFiles = [...f.files].map(([id, metadata]) => [id, structuredClone(metadata)]);
  const result = await store.prepareDemoAlbum(input);
  const root = albumRoot(f), album = albumFolder(f);
  assert.equal(root.name, "Mi Levitate · Fotos por coreografía");
  assert.equal(root.parents[0], "root_actual_1234567890");
  assert.deepEqual(album.parents, [root.id]);
  assert.equal(album.name, `${input.folderName} · DEMO`);
  assert.equal(album.appProperties.levitateEventId, input.eventId);
  assert.equal(album.appProperties.levitateDanceId, input.danceId);
  assert.equal(result.folderId, album.id);
  assert.equal(result.folderUrl, album.webViewLink);
  assert.equal(result.accountEmail, owner);
  assert.equal(result.photos.length, 2);
  assert.equal(mediaCalls(f.calls).length, 2, "each photo must be downloaded from actual Drive after creating its source copy");
  for (const photo of result.photos) {
    assert.deepEqual(photo.bytes, input.photos.find(value => value.slot === photo.slot).bytes);
    assert.deepEqual(Object.keys(photo).sort(), ["bytes", "height", "sha256", "slot", "width"]);
  }
  for (const [id, metadata] of oldFiles) assert.deepEqual(f.files.get(id), metadata, "existing music and preview files remain untouched");
  assert.equal(f.sessions.size, 2);
  assert.equal(f.files.size, oldFiles.length + 4);
  assert.ok(writeCalls(f.calls).every(({ request, url }) => ["POST", "PUT"].includes(request.method) && !url.pathname.includes("permissions")));
  assert.doesNotMatch(JSON.stringify({ ...result, photos: [] }), /SYNTHETIC_|accessToken|refreshToken/);
});

test("repeated demo album preparation reuses its folder/files and tolerates human renaming", async () => {
  const f = fixture(), input = await demoAlbumInput();
  const first = await (await f.store()).prepareDemoAlbum(input);
  const writes = writeCalls(f.calls).length;
  albumFolder(f).name = "Aire Norte · Ana Pérez · Renombrada DEMO";
  const again = await (await f.store()).prepareDemoAlbum(input);
  assert.equal(again.folderId, first.folderId);
  assert.equal(again.folderName, albumFolder(f).name);
  assert.equal(writeCalls(f.calls).length, writes);
  assert.equal(f.sessions.size, 2);
  assert.equal(mediaCalls(f.calls).length, 4);
  assert.equal((await f.store()).info.folderId, folderId, "source album markers never pollute private-preview discovery");
});

test("demo album input is bounded and only permits both known archival snapshots before any Drive writes", async () => {
  const f = fixture(), store = await f.store(), input = await demoAlbumInput(), callsBefore = f.calls.length;
  const mutations = [
    { eventId: "bad'query" }, { danceId: "https://evil.test/id" }, { folderName: "bad\nname" },
    { folderName: "a".repeat(221) }, { photos: [input.photos[0]] }, { photos: [input.photos[0], input.photos[0]] },
    { photos: [{ ...input.photos[0], slot: "foto-3" }, input.photos[1]] },
    { photos: [{ ...input.photos[0], sha256: "0".repeat(64) }, input.photos[1]] },
    { photos: [{ ...input.photos[0], width: 1 }, input.photos[1]] },
    { photos: [{ ...input.photos[0], bytes: new Uint8Array(input.photos[0].bytes.length) }, input.photos[1]] },
  ];
  for (const change of mutations) await assert.rejects(store.prepareDemoAlbum({ ...input, ...change }), controlled("portal_demo_album_invalid", 400));
  assert.equal(f.calls.length, callsBefore);
});

test("demo folders fail on sharing, foreign ownership and incorrect parent without modifying or replacing them", async () => {
  const input = await demoAlbumInput();
  for (const [target, change] of [
    [albumRoot, { shared: true }], [albumFolder, { owners: [{ emailAddress: "other@example.test" }] }],
    [albumFolder, { permissions: [{ type: "anyone", role: "reader" }] }],
    [albumFolder, { parents: ["different_parent_1234567890"] }],
  ]) {
    const f = fixture(), store = await f.store();
    await store.prepareDemoAlbum(input);
    const value = target(f), writesBefore = writeCalls(f.calls).length, callsBefore = mediaCalls(f.calls).length;
    if (change.parents) {
      f.state.intercept = ({ url }) => url.pathname === `/drive/v3/files/${value.id}` && url.searchParams.get("alt") !== "media"
        ? Response.json({ ...value, ...change }) : undefined;
    } else Object.assign(value, change);
    await assert.rejects(store.prepareDemoAlbum(input), error => error.statusCode === 503);
    assert.equal(writeCalls(f.calls).length, writesBefore);
    assert.equal(mediaCalls(f.calls).length, callsBefore);
  }
});

test("demo photo checks reject checksum, permission and source-mapping mismatches before downloading media", async () => {
  const input = await demoAlbumInput();
  for (const change of [
    { md5Checksum: "0".repeat(32) }, { sha256Checksum: "0".repeat(64) },
    { permissions: [{ type: "user", role: "writer", emailAddress: "staff@example.test" }] },
    { owners: [{ emailAddress: "other@example.test" }] }, { parents: [folderId] },
    { appProperties: { levitatePhotoAlbum: "demo_photo_v1", demo: "true", levitateEventId: "wrong-edition" } },
  ]) {
    const f = fixture(), store = await f.store();
    await store.prepareDemoAlbum(input);
    const value = albumFiles(f)[0], before = mediaCalls(f.calls).length, writesBefore = writeCalls(f.calls).length;
    f.state.intercept = ({ url }) => url.pathname === `/drive/v3/files/${value.id}` && url.searchParams.get("alt") !== "media"
      ? Response.json({ ...value, ...change }) : undefined;
    await assert.rejects(store.prepareDemoAlbum(input), error => error.statusCode === 503);
    assert.equal(mediaCalls(f.calls).length, before);
    assert.equal(writeCalls(f.calls).length, writesBefore);
  }
});

test("the demo import verifies actual downloaded bytes and rechecks folder privacy after the read", async () => {
  const input = await demoAlbumInput();
  for (const corruption of ["body", "sharing"]) {
    const f = fixture(), store = await f.store();
    await store.prepareDemoAlbum(input);
    f.state.intercept = ({ url }) => {
      if (url.searchParams.get("alt") !== "media") return undefined;
      if (corruption === "sharing") { albumRoot(f).shared = true; return undefined; }
      const value = f.files.get(url.pathname.split("/").pop()), bytes = new Uint8Array(value.bytes);
      bytes[bytes.length - 1] ^= 1;
      return new Response(bytes, { headers: { "content-type": "image/jpeg", "content-length": value.size } });
    };
    await assert.rejects(store.prepareDemoAlbum(input), controlled(corruption === "sharing" ? "portal_storage_not_private" : "portal_storage_unavailable"));
  }
});

test("unsafe Drive folder links are omitted from the demo result", async () => {
  const f = fixture(), store = await f.store(), input = await demoAlbumInput();
  await store.prepareDemoAlbum(input);
  albumFolder(f).webViewLink = "https://evil.test/private-link";
  assert.equal((await store.prepareDemoAlbum(input)).folderUrl, null);
});
