import assert from "node:assert/strict";
import test from "node:test";
import { getParticipantDriveHierarchy, PARTICIPANT_PHOTO_ACCOUNT } from "../worker/participant-drive-hierarchy.js";

const owner = PARTICIPANT_PHOTO_ACCOUNT, secret = "SYNTHETIC_PRIVATE_ATI_TOKEN";
const rootId = "my_drive_root_00000001", folderMime = "application/vnd.google-apps.folder";
const input = { eventId: "edomex-2026", academies: [{ id: "academy-a", name: "Academia Águila",
  dances: [{ id: "dance-a", title: "Amanecer" }, { id: "dance-b", title: "Amanecer" }] }] };
function folder(id, parent, name, appProperties) {
  return { id, name, appProperties, mimeType: folderMime, parents: [parent], trashed: false, shared: false,
    owners: [{ emailAddress: owner }], permissions: [{ type: "user", role: "owner", emailAddress: owner }],
    capabilities: { canListChildren: true, canAddChildren: true } };
}
function fixture({ aboutOwner = owner, intercept } = {}) {
  const files = new Map([
    ["old_music_folder_00001", folder("old_music_folder_00001", rootId, "Música", { levitatePhotoAlbum: "source_root_v1" })],
    ["old_music_track_000001", { id: "old_music_track_000001", name: "Canción.mp3", mimeType: "audio/mpeg", parents: ["old_music_folder_00001"], appProperties: {}, bytes: [1, 2, 3] }],
    ["unmarked_same_name_001", folder("unmarked_same_name_001", rootId, "Mi Levitate · Fotos · Estado de México 2026", {})],
  ]), calls = [];
  const state = { files, intercept, nextId: 0 };
  const fetchImpl = async (urlText, options) => {
    const url = new URL(urlText), call = { url, options }; calls.push(call);
    assert.equal(url.origin, "https://www.googleapis.com");
    assert.equal(options.redirect, "manual"); assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.authorization, `Bearer ${secret}`);
    assert.ok(["GET", "POST"].includes(options.method), "no mutation of preexisting files or permissions");
    assert.doesNotMatch(url.pathname, /permissions|upload/);
    const overridden = await state.intercept?.(call, state);
    if (overridden !== undefined) return overridden;
    if (url.pathname === "/drive/v3/about") return Response.json({ user: { emailAddress: aboutOwner } });
    if (url.pathname === "/drive/v3/files/root") return Response.json({ id: rootId });
    if (url.pathname === "/drive/v3/files" && options.method === "GET") {
      const q = url.searchParams.get("q"), parent = q.match(/^'([^']+)' in parents/)?.[1]; assert.ok(parent);
      assert.match(q, /'me' in owners/); assert.match(q, /trashed = false/);
      const properties = [...q.matchAll(/appProperties has \{ key='([^']+)' and value='([^']+)' \}/g)].map(([, key, value]) => [key, value]);
      return Response.json({ files: [...files.values()].filter(file => file.mimeType === folderMime && file.trashed === false
        && file.parents.includes(parent === "root" ? rootId : parent)
        && properties.every(([key, value]) => file.appProperties[key] === value)).map(file => ({ id: file.id })) });
    }
    if (url.pathname === "/drive/v3/files" && options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.deepEqual(Object.keys(body).sort(), ["appProperties", "mimeType", "name", "parents"]);
      assert.equal(body.mimeType, folderMime); assert.equal(body.parents.length, 1);
      const fileId = `new_photo_folder_${String(++state.nextId).padStart(10, "0")}`;
      files.set(fileId, folder(fileId, body.parents[0] === "root" ? rootId : body.parents[0], body.name, body.appProperties));
      return Response.json({ id: fileId });
    }
    const found = url.pathname.match(/^\/drive\/v3\/files\/([A-Za-z0-9_-]+)$/);
    if (found && options.method === "GET") {
      const file = files.get(found[1]);
      return file ? Response.json(file) : new Response("SYNTHETIC_SECRET_PROVIDER_DETAIL", { status: 404 });
    }
    throw new Error("Unexpected synthetic route");
  };
  const create = changes => getParticipantDriveHierarchy({ expectedEmail: owner, getConfig: async () => ({ authType: "oauth_refresh_token" }),
    getAccessToken: async (config, { signal }) => { assert.ok(signal instanceof AbortSignal); return secret; }, fetchImpl, ...changes });
  return { files, calls, state, create };
}
const writes = f => f.calls.filter(call => call.options.method !== "GET");
const controlled = (code, statusCode = 503) => error => {
  assert.equal(error.code, code); assert.equal(error.statusCode, statusCode);
  assert.doesNotMatch(error.message, /SYNTHETIC|Bearer|https:\/\//); return true;
};

test("hierarchy creates only private photo folders with stable edition, academy and choreography markers", async () => {
  const f = fixture(), before = structuredClone([...f.files]);
  const result = await (await f.create()).ensure(input);
  assert.equal(result.created, 4); assert.equal(result.accountEmail, owner);
  assert.equal(result.rootFolderName, "Mi Levitate · Fotos · Estado de México 2026");
  assert.equal(result.academies[0].folderName, input.academies[0].name);
  assert.deepEqual(result.academies[0].dances.map(dance => dance.folderName), ["Amanecer", "Amanecer"]);
  assert.notEqual(result.academies[0].dances[0].folderId, result.academies[0].dances[1].folderId);
  const root = f.files.get(result.rootFolderId), academy = f.files.get(result.academies[0].folderId);
  assert.deepEqual(root.appProperties, { levitatePhotoAlbum: "source_root_v2", levitateEventId: input.eventId });
  assert.deepEqual(academy.appProperties, { levitatePhotoAlbum: "academy_v2", levitateEventId: input.eventId, levitateAcademyId: "academy-a" });
  for (const dance of result.academies[0].dances) {
    const album = f.files.get(dance.folderId);
    assert.deepEqual(album.parents, [academy.id]);
    assert.deepEqual(album.appProperties, { levitatePhotoAlbum: "source_album_v2", levitateEventId: input.eventId, levitateAcademyId: "academy-a", levitateDanceId: dance.danceId });
  }
  for (const [key, original] of before) assert.deepEqual(f.files.get(key), original);
  assert.equal(writes(f).length, 4);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC|googleapis|curp|participantId|permission/i);
});

test("repeated batches reuse IDs and retain operator-edited names without PATCH or permission edits", async () => {
  const f = fixture(), hierarchy = await f.create();
  const result = await hierarchy.ensure(input), originalWrites = writes(f).length;
  f.files.get(result.academies[0].folderId).name = "Nombre corregido";
  const again = await (await f.create()).ensure({ ...input, rootName: "Nombre nuevo solicitado", academies: [{ ...input.academies[0], name: "Academia distinta" }] });
  assert.equal(again.rootFolderId, result.rootFolderId); assert.equal(again.created, 0);
  assert.equal(again.academies[0].folderName, "Nombre corregido");
  assert.deepEqual(again.academies[0].dances, result.academies[0].dances);
  assert.equal(writes(f).length, originalWrites);
});

test("duplicate display names across academies cannot merge their folders", async () => {
  const f = fixture(), result = await (await f.create()).ensure({ eventId: input.eventId, academies: [
    { id: "academy-a", name: "Academia", dances: [{ id: "dance-a", title: "Amanecer" }] },
    { id: "academy-b", name: "Academia", dances: [{ id: "dance-b", title: "Amanecer" }] },
  ] });
  assert.equal(result.created, 5);
  assert.notEqual(result.academies[0].folderId, result.academies[1].folderId);
  assert.notEqual(result.academies[0].dances[0].folderId, result.academies[1].dances[0].folderId);
});

test("invalid manifests and accounts fail before any folder creation", async () => {
  const f = fixture();
  await assert.rejects(f.create({ expectedEmail: "musica.levitate@gmail.com" }), controlled("portal_storage_wrong_account"));
  assert.equal(f.calls.length, 0);
  const hierarchy = await f.create();
  for (const invalid of [
    { ...input, eventId: "unsafe' and injected" },
    { ...input, academies: [{ ...input.academies[0], name: "bad\nname" }] },
    { ...input, academies: [...input.academies, input.academies[0]] },
    { ...input, academies: [{ ...input.academies[0], dances: [{ id: "dance-a", title: "A" }, { id: "dance-a", title: "B" }] }] },
    { ...input, academies: [{ ...input.academies[0], dances: Array.from({ length: 9 }, (_, i) => ({ id: `dance-${i}`, title: "A" })) }] },
  ]) await assert.rejects(hierarchy.ensure(invalid), controlled("portal_photo_source_invalid", 400));
  assert.equal(f.calls.length, 0);
  const wrong = fixture({ aboutOwner: "musica.levitate@gmail.com" });
  await assert.rejects((await wrong.create()).ensure(input), controlled("portal_storage_wrong_account"));
  assert.equal(wrong.calls.length, 1); assert.equal(writes(wrong).length, 0);
});

test("existing duplicate, public, foreign, moved or personal markers are rejected without editing them", async () => {
  for (const change of ["duplicate", "shared", "foreign", "moved", "personal"]) {
    const f = fixture(), initial = await (await f.create()).ensure(input), before = writes(f).length;
    const root = f.files.get(initial.rootFolderId);
    if (change === "duplicate") f.files.set("duplicate_root_00001", { ...structuredClone(root), id: "duplicate_root_00001" });
    if (change === "shared") root.permissions.push({ type: "anyone", role: "reader" });
    if (change === "foreign") root.owners = [{ emailAddress: "other@example.test" }];
    if (change === "moved") root.parents = ["unexpected_parent_001", rootId];
    if (change === "personal") root.appProperties.levitateParticipantId = "person-a";
    await assert.rejects((await f.create()).ensure(input), controlled(change === "duplicate" ? "portal_photo_source_ambiguous" : change === "personal" ? "portal_photo_source_mismatch" : "portal_photo_source_not_private", change === "duplicate" || change === "personal" ? 409 : 503));
    assert.equal(writes(f).length, before);
  }
});

test("an operational interruption resumes without recreating verified root and academy folders", async () => {
  let failOnce = true;
  const f = fixture({ intercept({ options }) {
    if (options.method === "POST" && JSON.parse(options.body).appProperties.levitatePhotoAlbum === "source_album_v2" && failOnce) {
      failOnce = false; return new Response("SYNTHETIC_SECRET_PROVIDER_DETAIL", { status: 503 });
    }
  } });
  await assert.rejects((await f.create()).ensure(input), controlled("portal_photo_hierarchy_unavailable"));
  const result = await (await f.create()).ensure(input);
  assert.equal(result.created, 2); assert.equal(result.academies[0].dances.length, 2);
  assert.equal([...f.files.values()].filter(file => file.appProperties.levitatePhotoAlbum === "source_root_v2").length, 1);
  assert.equal([...f.files.values()].filter(file => file.appProperties.levitatePhotoAlbum === "academy_v2").length, 1);
});

test("duplicate creation races fail closed rather than picking or deleting an album", async () => {
  let duplicated = false;
  const f = fixture({ intercept({ options }, state) {
    if (!duplicated && options.method === "GET") {
      const root = [...state.files.values()].find(file => file.appProperties.levitatePhotoAlbum === "source_root_v2");
      if (root) { duplicated = true; state.files.set("racing_root_folder_01", { ...structuredClone(root), id: "racing_root_folder_01" }); }
    }
  } });
  await assert.rejects((await f.create()).ensure(input), controlled("portal_photo_source_ambiguous", 409));
  assert.equal(writes(f).length, 1);
  assert.equal([...f.files.values()].filter(file => file.appProperties.levitatePhotoAlbum === "source_root_v2").length, 2);
});

test("one hierarchy instance serializes batches and sanitizes redirects and timeouts", async () => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const f = fixture({ intercept: async ({ url }) => { if (url.pathname === "/drive/v3/about") await waiting; } });
  const hierarchy = await f.create(), first = hierarchy.ensure(input);
  await assert.rejects(hierarchy.ensure(input), controlled("portal_photo_hierarchy_busy", 409));
  release(); await first;
  const redirect = fixture({ intercept: () => new Response(null, { status: 302, headers: { location: "https://attacker.test/" } }) });
  await assert.rejects((await redirect.create()).ensure(input), controlled("portal_photo_hierarchy_unavailable"));
  const timed = fixture({ intercept: () => new Promise(() => {}) });
  await assert.rejects((await timed.create({ timeoutMs: 1 })).ensure(input), controlled("portal_photo_hierarchy_unavailable"));
});
