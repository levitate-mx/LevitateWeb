import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { main, normalizeBaseUrl, normalizeCookie, normalizeManifest, parseArgs, resolveEntryUrl, toPrivateCsv } from "../scripts/participant-portal-batch.mjs";

const baseUrl = "https://portal.example";
const token = "a".repeat(43);
const sample = () => ({ version: 1, event: { id: "event-example", title: "Edición de prueba", season: "Otoño", venue: "edomex", startsAt: "2026-11-14" },
  participants: [{ participantId: "participant-example", name: "Etiqueta local de ejemplo" }],
  routines: [{ danceId: "dance-example", approved: true, photosPublished: false,
    result: { score: 0, maxScore: 100, medal: "participacion", directCompetition: false, eligibleCount: 1, place: null }, judging: null }] });

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "participant-batch-test-"));
  const manifestFile = path.join(directory, "manifest.json");
  const output = path.join(directory, "private-output");
  const manifest = sample();
  await fs.writeFile(manifestFile, JSON.stringify(manifest));
  const previousCookie = process.env.LEVITATE_ADMIN_COOKIE;
  process.env.LEVITATE_ADMIN_COOKIE = "levitate_registration_session=test-session-example";
  t.after(async () => {
    if (previousCookie === undefined) delete process.env.LEVITATE_ADMIN_COOKIE;
    else process.env.LEVITATE_ADMIN_COOKIE = previousCookie;
    await fs.rm(directory, { recursive: true, force: true });
  });
  const actions = [];
  const grants = [];
  const transport = async (url, options) => {
    assert.equal(options.headers.Cookie, "levitate_registration_session=test-session-example");
    if (!options.method) return Response.json({ participants: [{ id: "participant-example", name: "Nombre oficial de ejemplo", academy: "Academia de ejemplo", accesses: grants }], routines: [] });
    const body = JSON.parse(options.body);
    actions.push(body);
    switch (body.action) {
      case "event.upsert": return Response.json({ eventId: body.event.id });
      case "routine.save": return Response.json({ routineId: "routine-example" });
      case "access.create": {
        grants.push({ id: "access-example", eventId: "event-example", active: true });
        return Response.json({ id: "access-example", token, entryUrl: `/mi-levitate#access=${token}` });
      }
      case "asset.upload": return Response.json({ assetId: body.uploadId });
      default: return Response.json({ ok: true });
    }
  };
  const logs = [];
  const run = (extra = [], customTransport = transport) => main(["--manifest", manifestFile, "--base-url", baseUrl, "--out", output, ...extra],
    { transport: customTransport, log: (message) => logs.push(message) });
  return { directory, manifestFile, manifest, output, run, transport, logs, actions, grants };
}

test("batch requires explicit apply and separate publication, with no cookie argument", () => {
  assert.equal(parseArgs(["--manifest", "example.json"]).apply, false);
  assert.throws(() => parseArgs(["--manifest", "example.json", "--publish"]), /requiere --apply/);
  assert.throws(() => parseArgs(["--manifest", "example.json", "--apply"]), /--out/);
  assert.throws(() => parseArgs(["--manifest", "example.json", "--cookie", "sensitive"]), /Opción desconocida/);
});

test("batch snapshots require approval and preserve the server's real scoring rules and zero", () => {
  const manifest = sample();
  assert.equal(normalizeManifest(manifest).routines[0].result.score, 0);
  manifest.routines[0].approved = false;
  assert.throws(() => normalizeManifest(manifest), /approved/);
  manifest.routines[0].approved = true;
  manifest.routines[0].result.place = 1;
  assert.throws(() => normalizeManifest(manifest), /competencia directa/);
  manifest.routines[0].result.place = null;
  manifest.routines[0].sourceEventId = "source-example";
  assert.throws(() => normalizeManifest(manifest), /asignarse juntos/);
  delete manifest.routines[0].sourceEventId;
  manifest.event.published = true;
  assert.throws(() => normalizeManifest(manifest), /--publish/);
});

test("batch requires assigned watermarked photos and matching diploma ownership", () => {
  const manifest = sample();
  manifest.assets = [{ key: "photo-example", kind: "photo", file: "example.jpg", danceId: "dance-example" }];
  assert.throws(() => normalizeManifest(manifest), /watermarked/);
  manifest.assets[0].watermarked = true;
  assert.equal(normalizeManifest(manifest).assets[0].allowDownload, false);
  manifest.assets = [{ key: "diploma-example", kind: "diploma", file: "example.pdf", participantId: "participant-example" }];
  manifest.documents = [{ assetKey: "diploma-example", participantId: "other-example" }];
  assert.throws(() => normalizeManifest(manifest), /mismo participante/);
});

test("batch restricts credentials and returned access links, and CSV escapes formulas", () => {
  assert.equal(normalizeBaseUrl(baseUrl), baseUrl);
  assert.throws(() => normalizeBaseUrl("http://untrusted.example"), /HTTPS/);
  assert.throws(() => normalizeBaseUrl("https://portal.example/?token=secret"), /parámetros/);
  assert.equal(normalizeCookie("unrelated=ignored; levitate_registration_session=example-token"), "levitate_registration_session=example-token");
  assert.throws(() => normalizeCookie("levitate_registration_session=value\r\nInjected: yes"), /válida/);
  assert.equal(resolveEntryUrl(`/mi-levitate#access=${token}`, baseUrl), `${baseUrl}/mi-levitate#access=${token}`);
  assert.throws(() => resolveEntryUrl(`https://other.example/mi-levitate#access=${token}`, baseUrl), /inesperado/);
  assert.equal(toPrivateCsv([["=HYPERLINK(1)", 'O"Brien, Ejemplo']]), '"\'=HYPERLINK(1)","O""Brien, Ejemplo"\r\n');
});

test("batch dry run validates without network calls or private output", async (t) => {
  const f = await fixture(t);
  await f.run([], () => { throw new Error("Dry run must never contact the API"); });
  await assert.rejects(fs.stat(f.output), { code: "ENOENT" });
  assert.equal(f.logs.some((line) => line.includes("Nombre") || line.includes(token)), false);
});

test("batch writes private QR/CSV once and reuses the access when explicitly publishing", async (t) => {
  const f = await fixture(t);
  await f.run(["--apply"]);
  assert.equal(f.actions.some((action) => action.action.endsWith(".publish") || action.event?.published), false);
  const state = JSON.parse(await fs.readFile(path.join(f.output, "estado-privado.json"), "utf8"));
  assert.equal(state.operations["access:participant-example"].result.token, undefined);
  const csv = await fs.readFile(path.join(f.output, "accesos-privados.csv"), "utf8");
  assert.match(csv, /Nombre oficial de ejemplo/);
  assert.doesNotMatch(csv, /Etiqueta local/);
  assert.match(csv, /#access=/);
  for (const file of [path.join(f.output, "estado-privado.json"), path.join(f.output, "accesos-privados.csv"),
    ...((await fs.readdir(path.join(f.output, "qr"))).map((name) => path.join(f.output, "qr", name)))]) {
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
  }
  assert.equal((await fs.stat(f.output)).mode & 0o777, 0o700);
  await f.run(["--apply", "--publish"]);
  assert.equal(f.actions.filter((action) => action.action === "access.create").length, 1);
  assert.equal(f.actions.filter((action) => action.action === "routine.publish").length, 1);
  assert.equal(f.actions.at(-1).event.published, true);
  assert.equal(f.logs.some((line) => line.includes(token)), false);
});

test("batch stops after uncertain token creation instead of issuing or rotating another", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const uncertain = async (url, options) => {
    if (options.method && JSON.parse(options.body).action === "access.create") {
      calls += 1;
      throw new Error("Uncertain transport failure");
    }
    return f.transport(url, options);
  };
  await assert.rejects(f.run(["--apply"], uncertain), /sin confirmar/);
  await assert.rejects(f.run(["--apply"], uncertain), /Un acceso quedó sin confirmar/);
  assert.equal(calls, 1);
});

test("batch refuses reprinting a revoked access and republishes a corrected routine", async (t) => {
  const f = await fixture(t);
  await f.run(["--apply", "--publish"]);
  f.manifest.routines[0].result.score = 15;
  await fs.writeFile(f.manifestFile, JSON.stringify(f.manifest));
  await f.run(["--apply", "--publish"]);
  assert.equal(f.actions.filter((action) => action.action === "routine.save").length, 2);
  assert.equal(f.actions.filter((action) => action.action === "routine.publish").length, 2);
  f.grants[0].active = false;
  await assert.rejects(f.run(["--apply"]), /revocado o reemplazado/);
});

test("batch generates and assigns a private diploma with authoritative identity and reuses its upload", async (t) => {
  const f = await fixture(t);
  await f.run(["--apply", "--diplomas"]);
  const upload = f.actions.find((action) => action.action === "asset.upload");
  assert.equal(upload.kind, "diploma");
  assert.equal(upload.participantId, "participant-example");
  assert.equal(upload.contentType, "application/pdf");
  assert.equal(Buffer.from(upload.base64Data, "base64").subarray(0, 5).toString(), "%PDF-");
  const files = await fs.readdir(path.join(f.output, "diplomas"));
  assert.equal(files.length, 1);
  assert.equal((await fs.stat(path.join(f.output, "diplomas", files[0]))).mode & 0o777, 0o600);
  assert.equal(f.actions.find((action) => action.action === "document.assign").published, false);
  await f.run(["--apply", "--diplomas", "--publish"]);
  assert.equal(f.actions.filter((action) => action.action === "asset.upload").length, 1);
  assert.equal(f.actions.filter((action) => action.action === "document.assign").at(-1).published, true);
  await f.run(["--apply", "--diplomas"]);
  assert.equal(f.actions.filter((action) => action.action === "document.assign").length, 2);
});

test("batch retries an interrupted upload with the same content key and never saves base64 in state", async (t) => {
  const f = await fixture(t);
  const file = path.join(f.directory, "judge-example.pdf");
  await fs.writeFile(file, "%PDF-example");
  f.manifest.assets = [{ key: "sheet-example", kind: "judge_sheet", danceId: "dance-example", file }];
  await fs.writeFile(f.manifestFile, JSON.stringify(f.manifest));
  const uploadIds = [];
  const interrupted = async (url, options) => {
    if (options.method) {
      const action = JSON.parse(options.body);
      if (action.action === "asset.upload") {
        uploadIds.push(action.uploadId);
        if (uploadIds.length === 1) throw new Error("Simulated lost response");
      }
    }
    return f.transport(url, options);
  };
  await assert.rejects(f.run(["--apply"], interrupted), /sin confirmar/);
  await f.run(["--apply"], interrupted);
  assert.equal(uploadIds.length, 2);
  assert.equal(uploadIds[0], uploadIds[1]);
  assert.doesNotMatch(await fs.readFile(path.join(f.output, "estado-privado.json"), "utf8"), /base64Data/);
});

test("batch preserves omitted source mappings and clears them only when both are explicitly empty", async (t) => {
  const f = await fixture(t);
  const transport = async (url, options) => {
    if (!options.method) return Response.json({ participants: [], routines: [{ id: "routine-example", danceId: "dance-example",
      sourceEventId: "source-event-example", sourceRoutineId: "source-routine-example" }] });
    return f.transport(url, options);
  };
  f.manifest.participants = [];
  await fs.writeFile(f.manifestFile, JSON.stringify(f.manifest));
  await f.run(["--apply"], transport);
  assert.equal(f.actions.find((action) => action.action === "routine.save").sourceEventId, "source-event-example");
  assert.equal(f.actions.find((action) => action.action === "routine.save").sourceRoutineId, "source-routine-example");
  f.manifest.routines[0].sourceEventId = "";
  f.manifest.routines[0].sourceRoutineId = "";
  await fs.writeFile(f.manifestFile, JSON.stringify(f.manifest));
  await f.run(["--apply"], transport);
  const save = f.actions.filter((action) => action.action === "routine.save").at(-1);
  assert.equal(save.sourceEventId, "");
  assert.equal(save.sourceRoutineId, "");
});

test("batch publishes the routine for a judge-sheet-only batch with scoped asset lists", async (t) => {
  const f = await fixture(t);
  const file = path.join(f.directory, "judge-example.pdf");
  await fs.writeFile(file, "%PDF-example");
  f.manifest.participants = [];
  f.manifest.routines = [];
  f.manifest.assets = [{ key: "sheet-example", kind: "judge_sheet", danceId: "dance-example", file }];
  await fs.writeFile(f.manifestFile, JSON.stringify(f.manifest));
  const transport = async (url, options) => {
    if (!options.method) return Response.json({ participants: [], assets: [],
      routines: [{ id: "routine-example", danceId: "dance-example", photosPublished: false }] });
    return f.transport(url, options);
  };
  await f.run(["--apply", "--publish"], transport);
  assert.equal(f.actions.find((action) => action.action === "routine.publish").routineId, "routine-example");
  assert.equal(f.actions.filter((action) => action.action === "asset.publish").length, 1);
});

test("batch stops photo publication if the existing album is disabled", async (t) => {
  const f = await fixture(t);
  const file = path.join(f.directory, "preview-example.jpg");
  await fs.writeFile(file, Buffer.from([0xff, 0xd8, 0xff, 0, 0]));
  f.manifest.participants = [];
  f.manifest.routines = [];
  f.manifest.assets = [{ key: "photo-example", kind: "photo", danceId: "dance-example", file, watermarked: true }];
  await fs.writeFile(f.manifestFile, JSON.stringify(f.manifest));
  const transport = async (url, options) => {
    if (!options.method) return Response.json({ participants: [],
      routines: [{ id: "routine-example", danceId: "dance-example", photosPublished: false }] });
    return f.transport(url, options);
  };
  await assert.rejects(f.run(["--apply", "--publish"], transport), /photosPublished desactivado/);
  assert.equal(f.actions.some((action) => action.action.endsWith(".publish") || action.action === "asset.upload"), false);
});
