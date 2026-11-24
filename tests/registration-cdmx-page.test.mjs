import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("CDMX is a discoverable public sede with open academy registration and no unconfirmed map link", async () => {
  const [app, sede, home, footer, header, events, imageCredits] = await Promise.all([
    source("../src/App.tsx"),
    source("../src/components/sedes/SedesPage.tsx"),
    source("../src/components/home/HomePage.tsx"),
    source("../src/components/home/LevitateFooter.tsx"),
    source("../src/components/home/LevitateHeader.tsx"),
    source("../src/data/homeContent.ts"),
    source("../public/creditos-de-imagen.html"),
  ]);

  assert.match(app, /venueSlug === "cdmx"/);
  assert.match(app, /<SedesPage venueKey="cdmx" \/>/);
  assert.match(sede, /cdmx: \{\s*heroTitle: "CDMX"/);
  assert.match(sede, /eventName: "Lugar por definir"/);
  assert.match(sede, /location: "Por definir"/);
  assert.match(sede, /date: "16, 17 y 18 de\\nabril 2027"/);
  assert.match(sede, /metaValue: "Inscripciones abiertas"/);
  assert.match(sede, /registrationVenueKey: "cdmx-2027"/);
  assert.match(sede, /heroImage: "\/assets\/sedes-cdmx-angel-independencia\.jpg"/);
  assert.match(sede, /\{venue\.mapsUrl \? \(/);
  assert.doesNotMatch(sede.match(/cdmx: \{[\s\S]*?\n  \},\n\};/)?.[0] ?? "", /mapsUrl:/);
  assert.doesNotMatch(home, /Teatro Gran Recinto/);
  assert.match(home, /title: "CDMX",\s*city: "Lugar por definir"/);
  assert.match(home, /href: "\/sedes\/cdmx"/);
  assert.match(home, /image: "\/assets\/sedes-cdmx-angel-independencia\.jpg"/);
  assert.match(home, /value: "2", label: "sedes actuales"/);
  assert.match(header, /label: "CDMX", href: "\/sedes\/cdmx"/);
  assert.match(events, /slug: "cdmx"/);
  assert.match(events, /image: "\/assets\/sedes-cdmx-angel-independencia\.jpg"/);
  assert.match(footer, /href="\/creditos-de-imagen\.html"/);
  assert.match(imageCredits, /Carl Campbell/);
  assert.match(imageCredits, /creativecommons\.org\/licenses\/by-sa\/2\.0/);
  assert.match(imageCredits, /File:Monumental_Reforma_\(1\)_\(10225717804\)\.jpg/);
  const image = await stat(new URL("../public/assets/sedes-cdmx-angel-independencia.jpg", import.meta.url));
  assert.ok(image.size <= 1_500_000, `CDMX hero image exceeds the 1.5 MB budget: ${image.size}`);
  assert.doesNotMatch(events, /slug: "estado-de-mexico"/);
  assert.match(sede, /const registrationVenueKey = venue\.registrationVenueKey \?\? venueKey/);
  assert.match(sede, /isVenueAcquisitionClosed\(registrationVenueKey\)/);
});

test("CDMX 2027 is a separate registration edition without relabeling CDMX 2026 history", async () => {
  const [admin, inscription, participantAdmin, shop, worker] = await Promise.all([
    source("../src/components/admin/RegistrationScreens.tsx"),
    source("../src/components/inscripciones/InscripcionesPage.tsx"),
    source("../src/components/participant-admin/ParticipantAdminPage.tsx"),
    source("../src/components/shop/ShopPage.tsx"),
    source("../worker/index.js"),
  ]);

  assert.match(admin, /\{ value: "cdmx-2027", label: "CDMX - 16, 17 y 18 de abril 2027" \}/);
  assert.match(admin, /"cdmx-2027": "2027-04-16"/);
  assert.match(admin, /"cdmx-2027": "Inscripciones abiertas"/);
  for (const content of [inscription, shop, worker]) {
    assert.match(content, /cdmx: "CDMX - 29 \/31 mayo 2026"/);
    assert.match(content, /"cdmx-2027": "CDMX - 16, 17 y 18 de abril 2027"/);
  }
  assert.match(participantAdmin, /\{ value: "cdmx", label: "CDMX" \}/);
  assert.doesNotMatch(participantAdmin, /\{ value: "cdmx-2027"/);
  assert.match(inscription, /Para Orizaba, la preventa general es aplicable/);
  assert.match(worker, /cdmx-2027/);
});
