import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { createElement, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const readSource = path => readFile(new URL(path, import.meta.url), "utf8");
const source = await readSource("../src/components/participant/ParticipantPage.tsx");
const apiSource = await readSource("../src/components/participant/participantApi.ts");
const previewSource = await readSource("../src/components/participant/participantPreview.ts");
function evaluate(code, globals = {}, imports = {}) {
  const scope = { exports: {}, Error, URLSearchParams, URL, AbortController, ...globals,
    require(name) {
      if (name in imports) return imports[name];
      if (name.endsWith(".css")) return {};
      return nativeRequire(name);
    },
  };
  const js = ts.transpileModule(code, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(js, scope);
  return scope.exports;
}
const browser = { location: { origin: "https://levitate.test" } };
function api(fetch = () => { throw new Error("unexpected network request"); }) {
  return evaluate(apiSource, { window: browser, fetch, Headers }, {
    "../../utils/browserDownload": { prepareBrowserDownload() {}, startBrowserDownload() {} },
  });
}
const preview = evaluate(previewSource).previewParticipantData;
const syntax = ts.createSourceFile("ParticipantPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ["participantPageMode", "registrationLabel", "PhotoImage", "PortalState", "InternalPreviewBanner"];
const declarations = syntax.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
  || (ts.isVariableStatement(node) && node.declarationList.declarations.some(entry => entry.name.getText(syntax) === "registrationLabels")),
).map(node => node.getText(syntax));
const helpers = evaluate(`${declarations.join("\n")}\nexports.helpers = { ${names.join(",")} };`, {
  ...icons, useState,
}).helpers;

test("public asset validation stays separate from authenticated administrator asset URLs", () => {
  const { participantAssetUrl, participantAdminAssetUrl } = api();
  const adminAsset = "/api/registration/admin/participant-portal?assetId=photo-asset-123";
  assert.equal(participantAssetUrl(adminAsset), undefined);
  assert.equal(participantAssetUrl(adminAsset, true), undefined);
  assert.equal(participantAdminAssetUrl(adminAsset), adminAsset);
  assert.equal(participantAdminAssetUrl(adminAsset + "&download=1"), adminAsset + "&download=1");
  for (const query of ["&download=0", "&download=2", "&download=1&download=1", "&assetId=another-asset"]) {
    assert.equal(participantAdminAssetUrl(adminAsset + query), undefined);
  }
  assert.equal(participantAdminAssetUrl("https://other.test" + adminAsset), undefined);
  assert.equal(participantAdminAssetUrl(adminAsset + "&token=secret"), undefined);
  assert.equal(participantAdminAssetUrl(adminAsset + "#token"), undefined);
  assert.equal(participantAdminAssetUrl("/api/participant/assets/photo-asset-123"), undefined);
  assert.equal(participantAdminAssetUrl("/assets/example.jpg"), undefined);
  assert.equal(participantAssetUrl("https://drive.google.com/file/d/example"), undefined);
  assert.equal(participantAssetUrl("/assets/example.jpg"), undefined);
  assert.equal(participantAssetUrl("/assets/example.jpg", true), "/assets/example.jpg");
});

test("admin preview requires the explicit server flag and the requested person and edition", async () => {
  const calls = [];
  let payload = { ...preview, participant: { ...preview.participant, id: "person-123" }, selectedEventId: "event-123", adminPreview: true };
  const client = api(async (path, options) => {
    calls.push({ path, options });
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  });
  const search = "?eventId=event-123&participantId=person-123&access=discarded";
  const response = await client.openParticipantAdminPreview(search);
  assert.equal(response.adminPreview, true);
  assert.equal(calls[0].path, "/api/registration/admin/participant-portal?preview=1&eventId=event-123&participantId=person-123");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.method, undefined);
  assert.doesNotMatch(calls[0].path, /exchange|access|token/);
  for (const change of [{ adminPreview: undefined }, { participant: { id: "another-person" } }, { selectedEventId: "another-event" }]) {
    payload = { ...response, ...change };
    await assert.rejects(client.openParticipantAdminPreview(search), /No pudimos verificar la vista interna/);
  }
  const requestCount = calls.length;
  await assert.rejects(client.openParticipantAdminPreview("?eventId=event-123"), /Selecciona una edición y un participante/);
  assert.equal(calls.length, requestCount, "an incomplete selection never requests another person's data");
});

test("the public demo and its punctuation alias stay isolated from the private and admin modes", () => {
  const mode = helpers.participantPageMode;
  for (const path of ["/mi-levitate/demo", "/mi-levitate/demo/", "/mi-levitate/demo.", "/mi-levitate/demo./"]) {
    assert.equal(mode(path, "?eventId=real&participantId=real", true, false), "demo");
  }
  assert.equal(mode("/mi-levitate", "?preview=1", false, false), "participant");
  assert.equal(mode("/mi-levitate", "?preview=1", false, true), "demo");
  assert.equal(mode("/admin/mi-levitate/resumen", "?preview=1", false, true), "internal");
  assert.equal(mode("/mi-levitate", "?internalPreview=1", false, false), "participant");
  assert.equal(preview.routines[0].photos.items.length, 2);
  assert.equal(preview.routines[0].photos.items[1].previewUrl, "/assets/participant-demo-photo-blurred.jpg");
  assert.match(preview.routines[0].photos.items[1].caption, /vista previa desenfocada/);
  assert.ok(preview.routines[0].photos.items.every(photo => photo.previewUrl.startsWith("/assets/") && !photo.downloadUrl));
});

test("the portal moves directly from its hero to the three detail chapters", () => {
  assert.doesNotMatch(source, /ParticipantSummary|Todo en un vistazo|participant-chapter-nav/);
  assert.match(source, /id="tu-diploma"/);
  assert.match(source, /id="tu-jueceo"/);
  assert.match(source, /id="tus-fotos"/);
});

test("the photo chapter sells the media package with exactly two cross-routine previews", () => {
  const galleryStart = source.indexOf('className="participant-chapter participant-gallery"');
  const galleryEnd = source.indexOf('className="participant-community"', galleryStart);
  const gallery = source.slice(galleryStart, galleryEnd);

  assert.ok(galleryStart >= 0 && galleryEnd > galleryStart);
  assert.doesNotMatch(gallery, /ParticipantRoutineSelector/);
  assert.match(source, /\.flatMap\(\(routineItem\).*\.slice\(0, 2\)/s);
  assert.doesNotMatch(source, /photoLimit|Ver más fotografías/);
  assert.match(gallery, /href="\/tienda\/foto-video"/);
  assert.match(gallery, /¿Ya adquiriste tu paquete\?/);
  assert.match(gallery, /5 a 10 días hábiles/);
});

test("an unauthorized internal preview directs administrators to login without requesting a participant QR", () => {
  const html = renderToStaticMarkup(createElement(helpers.PortalState, {
    mode: "access", internalPreview: true, message: "Inicia sesión como administrador para revisar este participante.", onRetry() {},
  }));
  assert.match(html, /Vista interna de administración/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /href="\/admin\/mi-levitate"/);
  assert.doesNotMatch(html, /escanea tu QR|Abre tu enlace personal|access=|token=/);
});
