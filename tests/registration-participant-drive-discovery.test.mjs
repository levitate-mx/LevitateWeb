import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { getParticipantDriveDiscovery } from "../worker/participant-drive-discovery.js";
import { PARTICIPANT_PHOTO_ACCOUNT } from "../worker/participant-drive-hierarchy.js";

const owner = "photos@example.test", secret = "SYNTHETIC_PRIVATE_DRIVE_TOKEN";
const rootId = "photo_root_00000001", albumId = "photo_album_0000001", sourceId = "photo_source_000001";
const sourceBytes = new Uint8Array([255, 216, 255, 1, 2, 3, 255, 217]);
const thumbnailBytes = new Uint8Array([255, 216, 255, 4, 5, 6, 255, 217]);
const hash = (bytes, algorithm = "sha256") => createHash(algorithm).update(bytes).digest("hex");
const context = { eventId: "edition-1", participantId: "person-1", participantName: "Alison Like Mancilla Morales",
  academyId: "academy-1", academyName: "Academia Danzarale", dances: [{ id: "dance-1", title: "Beyond the strings" }] };
const albumName = "Beyond the strings · Alison Like Mancilla Morales · Academia Danzarale";
const scopeProperties = { levitateEventId: context.eventId, levitateDanceId: "dance-1", levitateParticipantId: context.participantId, levitateAcademyId: context.academyId };

function item(id, parent, extra = {}) {
  return { id, name: "Private item", mimeType: "application/vnd.google-apps.folder", trashed: false, parents: [parent],
    owners: [{ emailAddress: owner }], permissions: [{ type: "user", role: "owner", emailAddress: owner }], shared: false,
    capabilities: { canDownload: true, canListChildren: true, canAddChildren: true }, ...extra };
}
const publicMetadata = value => { const { bytes, ...metadata } = value; return structuredClone(metadata); };
function fixture({ demo = false, intercept, hierarchy = false, aboutOwner = hierarchy ? PARTICIPANT_PHOTO_ACCOUNT : owner } = {}) {
  const files = new Map(), calls = [], sessions = new Map();
  const state = { files, intercept, next: 0, tokenCalls: 0, thumbnailBytes, quota: { limit: "15000000000", usage: "1000" } };
  files.set(rootId, item(rootId, "my_drive_root_000001", { appProperties: { levitatePhotoAlbum: demo ? "demo_root_v1" : "source_root_v1", ...(demo ? { demo: "true" } : {}) } }));
  files.set(albumId, item(albumId, rootId, { name: albumName + (demo ? " · DEMO" : ""),
    webViewLink: `https://drive.google.com/drive/folders/${albumId}`, appProperties: { levitatePhotoAlbum: demo ? "demo_album_v1" : "source_album_v1", ...scopeProperties, ...(demo ? { demo: "true" } : {}) } }));
  files.set(sourceId, item(sourceId, albumId, { name: "Performance.jpg", mimeType: "image/jpeg", size: String(sourceBytes.length),
    imageMediaMetadata: { width: 2000, height: 3000, rotation: 0 }, md5Checksum: hash(sourceBytes, "md5"),
    version: "1", thumbnailLink: "https://lh3.googleusercontent.com/drive-storage/synthetic-thumbnail=s220", bytes: sourceBytes, appProperties: {} }));
  const academyFolderId = "academy_folder_000001";
  if (hierarchy) {
    files.get(rootId).appProperties = { levitatePhotoAlbum: "source_root_v2", levitateEventId: context.eventId };
    files.set(academyFolderId, item(academyFolderId, rootId, { name: context.academyName,
      appProperties: { levitatePhotoAlbum: "academy_v2", levitateEventId: context.eventId, levitateAcademyId: context.academyId } }));
    Object.assign(files.get(albumId), { name: context.dances[0].title, parents: [academyFolderId],
      appProperties: { levitatePhotoAlbum: "source_album_v2", levitateEventId: context.eventId, levitateAcademyId: context.academyId, levitateDanceId: context.dances[0].id } });
    for (const file of files.values()) {
      file.owners = [{ emailAddress: PARTICIPANT_PHOTO_ACCOUNT }];
      file.permissions = [{ type: "user", role: "owner", emailAddress: PARTICIPANT_PHOTO_ACCOUNT }];
    }
  }
  const fetchImpl = async (input, options) => {
    const url = new URL(input), call = { url, options }; calls.push(call);
    assert.equal(options.redirect, "manual"); assert.ok(options.signal instanceof AbortSignal);
    assert.notEqual(options.method, "DELETE");
    const overridden = await state.intercept?.(call, state);
    if (overridden !== undefined) return overridden;
    if (url.hostname.endsWith("googleusercontent.com")) {
      assert.equal(url.hostname, "lh3.googleusercontent.com");
      assert.equal(options.headers.authorization, `Bearer ${secret}`);
      assert.match(url.pathname, /=s640$/);
      return new Response(state.thumbnailBytes, { headers: { "content-type": "image/jpeg", "content-length": String(state.thumbnailBytes.length) } });
    }
    assert.equal(url.origin, "https://www.googleapis.com");
    if (options.method !== "PUT") assert.equal(options.headers.authorization, `Bearer ${secret}`);
    if (url.pathname === "/drive/v3/about") return Response.json({ user: { emailAddress: aboutOwner }, storageQuota: state.quota });
    if (url.pathname === "/drive/v3/files/generateIds") return Response.json({ ids: [`new_photo_source_${String(++state.next).padStart(10, "0")}`] });
    if (url.pathname === "/drive/v3/files") {
      assert.equal(options.method, "GET");
      const q = url.searchParams.get("q");
      const parent = q.match(/^'([^']+)' in parents/)?.[1]; assert.ok(parent);
      assert.match(q, /'me' in owners/); assert.match(q, /trashed = false/);
      const props = new Map();
      for (const [, name, value] of q.matchAll(/appProperties has \{ key='([^']+)' and value='([^']+)' \}/g)) {
        const expected = props.get(name) || []; expected.push(value); props.set(name, expected);
      }
      const types = [...q.matchAll(/mimeType\s*=\s*'([^']+)'/g)].map(match => match[1]);
      const result = [...files.values()].filter(value => !value.trashed
        && value.parents.includes(parent === "root" ? "my_drive_root_000001" : parent)
        && (!types.length || types.includes(value.mimeType))
        && [...props].every(([name, values]) => values.includes(value.appProperties?.[name])));
      return Response.json({ files: result.map(publicMetadata) });
    }
    if (url.pathname === "/upload/drive/v3/files" && options.method === "POST") {
      const metadata = JSON.parse(options.body);
      assert.deepEqual(metadata.parents, [albumId]); assert.equal(metadata.permissions, undefined);
      const upload = `upload_${sessions.size + 1}`; sessions.set(upload, metadata);
      return new Response(null, { headers: { location: `https://www.googleapis.com/upload/drive/v3/files?upload_id=${upload}` } });
    }
    if (url.pathname === "/upload/drive/v3/files" && options.method === "PUT") {
      assert.equal(options.headers.authorization, undefined);
      const metadata = sessions.get(url.searchParams.get("upload_id")); assert.ok(metadata);
      const bytes = new Uint8Array(options.body);
      files.set(metadata.id, item(metadata.id, albumId, { ...metadata, bytes, size: String(bytes.length),
        imageMediaMetadata: { width: 640, height: 480 }, md5Checksum: hash(bytes, "md5"), version: "1" }));
      return Response.json({ id: metadata.id });
    }
    const matched = url.pathname.match(/^\/drive\/v3\/files\/([A-Za-z0-9_-]+)$/);
    if (matched) {
      const value = files.get(matched[1]); if (!value) return new Response("SYNTHETIC_PROVIDER_DETAIL", { status: 404 });
      if (options.method === "PATCH") {
        assert.equal(value.id, albumId, "only the verified source album may be renamed");
        const update = JSON.parse(options.body); assert.deepEqual(Object.keys(update).sort(), ["appProperties", "name"]);
        Object.assign(value, update); return Response.json({ id: value.id });
      }
      assert.equal(options.method, "GET");
      if (url.searchParams.get("alt") === "media") return new Response(value.bytes, { headers: { "content-type": value.mimeType, "content-length": value.size } });
      return Response.json(publicMetadata(value));
    }
    throw new Error(`Unexpected fixture route ${url.pathname}`);
  };
  const reader = () => getParticipantDriveDiscovery({ expectedEmail: hierarchy ? PARTICIPANT_PHOTO_ACCOUNT : owner,
    ...(hierarchy ? { layout: "academy_dance" } : {}), getConfig: () => ({ authType: "oauth_refresh_token" }),
    getAccessToken: async (config, { signal }) => { assert.ok(signal instanceof AbortSignal); state.tokenCalls++; return secret; }, fetchImpl });
  return { files, calls, state, reader, academyFolderId };
}
const imageReads = f => f.calls.filter(({ url }) => url.hostname.includes("googleusercontent") || url.searchParams.get("alt") === "media");
const writes = f => f.calls.filter(({ options }) => options.method !== "GET");
const controlled = (code, status = 503) => error => {
  assert.equal(error.code, code); assert.equal(error.statusCode, status);
  assert.doesNotMatch(error.message, /SYNTHETIC|https:\/\//); return true;
};

test("discovery matches normalized full names and academy only inside its own source root", async () => {
  const f = fixture();
  f.files.get(albumId).name = "  BEYOND THE STRINGS·ÁLISON   LIKE MANCILLA MORALES · academia DANZARALE ";
  f.files.set("music_album_0000001", item("music_album_0000001", "music_root_000001", { name: albumName, appProperties: { levitatePhotoAlbum: "source_album_v1", ...scopeProperties } }));
  const reader = await f.reader(), result = await reader.discover(context);
  assert.equal(result.albums.length, 1); assert.equal(result.albums[0].trusted, true);
  assert.equal(result.albums[0].photos.length, 1);
  assert.equal(imageReads(f).length, 0, "listing never downloads original images");
  const photo = await result.albums[0].photos[0].read();
  assert.deepEqual(photo.bytes, thumbnailBytes); assert.equal(photo.sourceKind, "thumbnail");
  assert.equal(imageReads(f).length, 1); assert.equal(writes(f).length, 0); assert.equal(f.state.tokenCalls, 1);
  assert.doesNotMatch(JSON.stringify(result), /googleusercontent|SYNTHETIC_PRIVATE|thumbnailLink|webViewLink/);
  assert.ok(f.calls.filter(({ url }) => url.pathname === "/drive/v3/files").every(({ url }) => /^'[^']+' in parents/.test(url.searchParams.get("q"))));
});

test("different names, academies or editions do not match and never load image bytes", async () => {
  for (const changes of [{ participantName: "Alison Otra Persona" }, { academyName: "Otra academia" }, { eventId: "other-edition" }]) {
    const f = fixture(), reader = await f.reader();
    assert.deepEqual(await reader.discover({ ...context, ...changes }), { albums: [] });
    assert.equal(imageReads(f).length, 0); assert.equal(writes(f).length, 0);
  }
});

test("discovery verifies its OAuth account before looking for photo folders", async () => {
  const f = fixture({ aboutOwner: "other@example.test" });
  await assert.rejects((await f.reader()).discover(context), controlled("portal_storage_wrong_account"));
  assert.equal(f.calls.length, 1); assert.equal(imageReads(f).length, 0);
});

test("ambiguous album matches fail closed before photo reads", async () => {
  const f = fixture();
  f.files.set("duplicate_album_0001", { ...structuredClone(f.files.get(albumId)), id: "duplicate_album_0001" });
  const reader = await f.reader();
  await assert.rejects(reader.discover(context), controlled("portal_photo_source_ambiguous", 409));
  assert.equal(imageReads(f).length, 0);
});

test("known folder bindings survive display-name edits but still validate exact participant and academy IDs", async () => {
  const f = fixture(); f.files.get(albumId).name = "Nombre corregido por el operador";
  const reader = await f.reader(), bound = { ...context, knownBindings: { "dance-1": { folderId: albumId } } };
  assert.equal((await reader.discover(bound)).albums[0].id, albumId);
  f.files.get(albumId).appProperties.levitateAcademyId = "other-academy";
  await assert.rejects(reader.discover(bound), controlled("portal_photo_source_mismatch", 409));
  assert.equal(imageReads(f).length, 0);
});

test("root, album and source must each retain owner-only permissions", async () => {
  for (const changedId of [rootId, albumId, sourceId]) {
    const f = fixture(); f.files.get(changedId).shared = true;
    const reader = await f.reader();
    await assert.rejects(reader.discover(context), controlled("portal_photo_source_not_private"));
    assert.equal(imageReads(f).length, 0);
  }
});

test("demo albums stay unavailable to participant reads and are permitted only in the admin projection", async () => {
  const f = fixture({ demo: true }), reader = await f.reader();
  assert.deepEqual(await reader.discover(context), { albums: [] });
  assert.equal((await reader.discover({ ...context, adminPreview: true })).albums.length, 1);
  assert.equal(imageReads(f).length, 0);
});

test("existing watermarked demo copies are excluded from raw-source discovery", async () => {
  const f = fixture();
  for (const [id, appProperties] of [["prepared_photo_0001", { watermarkVersion: "levitate-preview-v2" }], ["prepared_photo_0002", { levitatePhotoAlbum: "demo_photo_v1" }]]) {
    f.files.set(id, { ...structuredClone(f.files.get(sourceId)), id, appProperties });
  }
  const result = await (await f.reader()).discover(context);
  assert.deepEqual(result.albums[0].photos.map(photo => photo.id), [sourceId]);
});

test("thumbnail URLs and redirects cannot send credentials to unrelated hosts", async () => {
  for (const unsafe of ["https://lh3.googleusercontent.com.attacker.test/photo=s220", "https://attacker.test/", "http://lh3.googleusercontent.com/photo", "https://user:password@lh3.googleusercontent.com/photo"]) {
    const f = fixture(); f.files.get(sourceId).thumbnailLink = unsafe;
    const reader = await f.reader(), result = await reader.discover(context);
    await assert.rejects(result.albums[0].photos[0].read(), controlled("portal_photo_source_unavailable"));
    assert.equal(imageReads(f).length, 0);
  }
  const f = fixture({ intercept({ url }) { if (url.hostname === "lh3.googleusercontent.com") return new Response(null, { status: 302, headers: { location: "https://attacker.test/capture" } }); } });
  const result = await (await f.reader()).discover(context);
  await assert.rejects(result.albums[0].photos[0].read(), controlled("portal_photo_source_unavailable"));
  assert.ok(f.calls.every(({ url }) => url.hostname !== "attacker.test"));
});

test("a private original is a bounded server-only fallback when no thumbnail exists", async () => {
  const f = fixture(); delete f.files.get(sourceId).thumbnailLink;
  const result = await (await f.reader()).discover(context), photo = await result.albums[0].photos[0].read();
  assert.equal(photo.sourceKind, "original"); assert.deepEqual(photo.bytes, sourceBytes);
  assert.equal(imageReads(f).length, 1); assert.equal(imageReads(f)[0].url.origin, "https://www.googleapis.com");
  assert.equal(writes(f).length, 0);
});

test("content or privacy changes during thumbnail reading invalidate the source", async () => {
  for (const changed of ["content", "privacy"]) {
    const f = fixture({ intercept({ url }, state) {
      if (url.hostname === "lh3.googleusercontent.com") {
        if (changed === "content") state.files.get(sourceId).md5Checksum = "a".repeat(32);
        else state.files.get(albumId).shared = true;
      }
    } });
    const result = await (await f.reader()).discover(context);
    await assert.rejects(result.albums[0].photos[0].read(), controlled(changed === "content" ? "portal_photo_source_changed" : "portal_photo_source_not_private", changed === "content" ? 409 : 503));
  }
});

test("oversized sources and thumbnail responses are rejected before transformation", async () => {
  const f = fixture(); f.files.get(sourceId).size = String(9 * 1024 * 1024);
  await assert.rejects((await f.reader()).discover(context), controlled("portal_photo_source_too_large", 413));
  const g = fixture({ intercept({ url }) { if (url.hostname === "lh3.googleusercontent.com") return new Response(thumbnailBytes, { headers: { "content-type": "image/jpeg", "content-length": String(2 * 1024 * 1024) } }); } });
  const result = await (await g.reader()).discover(context);
  await assert.rejects(result.albums[0].photos[0].read(), controlled("portal_photo_source_unavailable"));
});

test("demo preparation updates only the grounded album identity and adds one reusable unmarked source", async () => {
  const f = fixture({ demo: true });
  f.files.get(albumId).name = "Beyond the strings · Alison Like Mancilla Morales · DEMO";
  delete f.files.get(albumId).appProperties.levitateParticipantId; delete f.files.get(albumId).appProperties.levitateAcademyId;
  f.files.get(sourceId).appProperties = { levitatePhotoAlbum: "demo_photo_v1", watermarkVersion: "levitate-preview-v2" };
  const oldPhoto = structuredClone(f.files.get(sourceId));
  const reader = await f.reader();
  const input = { ...context, danceId: "dance-1", danceTitle: "Beyond the strings", bytes: sourceBytes,
    contentType: "image/jpeg", fileName: "DEMO-original-sin-marca.jpg", sha256: hash(sourceBytes) };
  const prepared = await reader.prepareDemoSource(input), repeated = await reader.prepareDemoSource(input);
  assert.equal(prepared.folderName, albumName + " · DEMO"); assert.equal(prepared.folderId, albumId);
  assert.equal(prepared.folderUrl, `https://drive.google.com/drive/folders/${albumId}`);
  assert.equal(prepared.sourceId, repeated.sourceId);
  assert.equal(f.files.size, 4); assert.deepEqual(f.files.get(sourceId), oldPhoto);
  assert.equal(writes(f).filter(({ options }) => options.method === "PATCH").length, 1);
  const result = await reader.discover({ ...context, adminPreview: true });
  assert.deepEqual(result.albums[0].photos.map(photo => photo.id), [prepared.sourceId]);
  assert.equal(result.albums[0].trusted, true);
});

test("demo preparation refuses another participant binding or mismatching source bytes", async () => {
  const input = { ...context, danceId: "dance-1", danceTitle: "Beyond the strings", bytes: sourceBytes,
    contentType: "image/jpeg", fileName: "source.jpg", sha256: hash(sourceBytes) };
  const f = fixture({ demo: true }); f.files.get(albumId).appProperties.levitateParticipantId = "other-person";
  await assert.rejects((await f.reader()).prepareDemoSource(input), controlled("portal_photo_source_mismatch", 409));
  assert.equal(writes(f).length, 0);
  const g = fixture({ demo: true });
  await assert.rejects((await g.reader()).prepareDemoSource({ ...input, sha256: "a".repeat(64) }), controlled("portal_photo_source_invalid", 400));
  assert.equal(g.calls.length, 0);
});

test("academy/dance hierarchy identifies albums by database IDs for every member, independent of names and legacy bindings", async () => {
  const f = fixture({ hierarchy: true }), reader = await f.reader();
  assert.equal(reader.identityScope, "dance");
  f.files.get(albumId).name = "Nombre de coreografía corregido";
  f.files.get(f.academyFolderId).name = "Academia corregida";
  const first = await reader.discover({ ...context, participantName: "Nombre diferente", academyName: "Nombre diferente",
    knownBindings: { "dance-1": { folderId: "old_music_album_0001" } } });
  const second = await reader.discover({ ...context, participantId: "person-2", participantName: "Otro miembro" });
  assert.equal(first.albums[0].id, albumId); assert.equal(first.albums[0].trusted, true);
  assert.equal(second.albums[0].photos[0].id, sourceId);
  assert.deepEqual((await first.albums[0].photos[0].read()).bytes, thumbnailBytes);
  assert.equal(writes(f).length, 0);
  assert.ok(f.calls.every(({ url }) => !url.pathname.includes("old_music_album")));
  assert.doesNotMatch(JSON.stringify(first), /googleusercontent|thumbnailLink|webViewLink|SYNTHETIC_PRIVATE/);
});

test("hierarchy album names and stale bindings never grant access outside the database edition, academy and dance", async () => {
  for (const changes of [{ eventId: "other-edition" }, { academyId: "other-academy" }, { dances: [{ id: "other-dance", title: context.dances[0].title }] }]) {
    const f = fixture({ hierarchy: true });
    const result = await (await f.reader()).discover({ ...context, ...changes, knownBindings: { "other-dance": { folderId: albumId } } });
    assert.deepEqual(result, { albums: [] }); assert.equal(imageReads(f).length, 0);
  }
});

test("hierarchy rejects duplicate ID markers, personal album bindings, moved folders and unsafe permissions", async () => {
  for (const change of ["duplicate-academy", "duplicate-album", "personal-album", "moved-album", "shared-academy", "wrong-account"]) {
    const f = fixture({ hierarchy: true, ...(change === "wrong-account" ? { aboutOwner: "musica.levitate@gmail.com" } : {}) });
    if (change === "duplicate-academy") f.files.set("duplicate_academy_0001", { ...structuredClone(f.files.get(f.academyFolderId)), id: "duplicate_academy_0001" });
    if (change === "duplicate-album") f.files.set("duplicate_album_00001", { ...structuredClone(f.files.get(albumId)), id: "duplicate_album_00001" });
    if (change === "personal-album") f.files.get(albumId).appProperties.levitateParticipantId = "other-person";
    if (change === "moved-album") f.files.get(albumId).parents = ["foreign_academy_0001"];
    if (change === "shared-academy") f.files.get(f.academyFolderId).permissions.push({ type: "anyone", role: "reader" });
    if (change === "moved-album") assert.deepEqual(await (await f.reader()).discover(context), { albums: [] });
    else await assert.rejects((await f.reader()).discover(context), controlled(change.startsWith("duplicate") ? "portal_photo_source_ambiguous"
      : change === "wrong-account" ? "portal_storage_wrong_account" : change === "personal-album" ? "portal_photo_source_mismatch" : "portal_photo_source_not_private", change.startsWith("duplicate") || change === "personal-album" ? 409 : 503));
    assert.equal(imageReads(f).length, 0); assert.equal(writes(f).length, 0);
  }
});

test("hierarchy rechecks academy, album and photo scope around a thumbnail read", async () => {
  for (const change of ["academy-privacy", "academy-scope", "album-scope", "photo-scope"]) {
    const f = fixture({ hierarchy: true, intercept({ url }, state) {
      if (url.hostname !== "lh3.googleusercontent.com") return;
      if (change === "academy-privacy") state.files.get("academy_folder_000001").shared = true;
      if (change === "academy-scope") state.files.get("academy_folder_000001").appProperties.levitateAcademyId = "foreign-academy";
      if (change === "album-scope") state.files.get(albumId).appProperties.levitateDanceId = "foreign-dance";
      if (change === "photo-scope") state.files.get(sourceId).appProperties.levitateDanceId = "foreign-dance";
    } });
    const result = await (await f.reader()).discover(context);
    await assert.rejects(result.albums[0].photos[0].read(), controlled(change === "academy-privacy" ? "portal_photo_source_not_private" : "portal_photo_source_mismatch", change === "academy-privacy" ? 503 : 409));
  }
});

test("hierarchy is explicit, limited to Ati, and cannot invoke the legacy demo mutator", async () => {
  await assert.rejects(getParticipantDriveDiscovery({ expectedEmail: owner, layout: "academy_dance", getConfig: () => ({}), getAccessToken: () => secret }), controlled("portal_storage_wrong_account"));
  const f = fixture({ hierarchy: true });
  await assert.rejects((await f.reader()).prepareDemoSource({}), controlled("portal_photo_source_invalid", 400));
  assert.equal(f.calls.length, 0);
  assert.equal((await fixture().reader()).identityScope, "participant");
});
