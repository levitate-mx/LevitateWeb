import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Orizaba is the open public venue while the Veracruz route remains an alias", async () => {
  const [app, home, header, events, sede] = await Promise.all([
    source("../src/App.tsx"),
    source("../src/components/home/HomePage.tsx"),
    source("../src/components/home/LevitateHeader.tsx"),
    source("../src/data/homeContent.ts"),
    source("../src/components/sedes/SedesPage.tsx"),
  ]);

  assert.match(app, /venueSlug === "orizaba" \|\| venueSlug === "veracruz"/);
  assert.match(sede, /heroTitle: "Orizaba"/);
  assert.match(sede, /eventName: "Teatro Ignacio de la Llave"/);
  assert.match(sede, /date: "27 y 28 de\\nfebrero 2027"/);
  assert.match(sede, /metaValue: "Inscripciones abiertas"/);
  assert.match(sede, /acquisitionClosedLabel: "Finalizada"/);
  assert.match(sede, /acquisitionClosedMessage: "¡Gracias por ser parte de Levitate! Nos vemos en tu sede favorita de Primavera 2027\."/);
  assert.match(sede, /venue\.acquisitionClosedLabel \?\? "Edición concluida"/);
  assert.match(sede, /venue\.acquisitionClosedMessage \?\? policy\.acquisitionsMessage/);
  assert.match(sede, /SedesPage\(\{ venueKey = "veracruz" \}/);
  assert.match(sede, /hasRegistrationAction = venueKey === "edomex" \|\| venueKey === "veracruz" \|\| venueKey === "cdmx"/);
  assert.doesNotMatch(sede, /Descargar convocatoria/);
  assert.match(home, /href="\/sedes\/orizaba"/);
  assert.match(header, /label: "Convocatoria",\s*href: "\/sedes\/veracruz"/);
  assert.match(header, /title: "Convocatoria",\s*href: "\/sedes\/veracruz"/);
  assert.match(header, /label: "Orizaba", href: "\/sedes\/orizaba"/);
  assert.match(events, /slug: "orizaba"/);
  assert.doesNotMatch(events, /slug: "veracruz",\s*date: "Próximamente"/);
  for (const content of [home, events, sede]) {
    assert.match(content, /\/assets\/sedes-orizaba-teatro-ignacio-de-la-llave\.webp/);
    assert.doesNotMatch(content, /\/assets\/sedes-veracruz-primavera-2027\.png/);
  }
});

test("Orizaba keeps the established Veracruz storage key without renaming the Mexican state", async () => {
  const [admin, inscription, participantAdmin, shop, worker] = await Promise.all([
    source("../src/components/admin/RegistrationScreens.tsx"),
    source("../src/components/inscripciones/InscripcionesPage.tsx"),
    source("../src/components/participant-admin/ParticipantAdminPage.tsx"),
    source("../src/components/shop/ShopPage.tsx"),
    source("../worker/index.js"),
  ]);

  for (const content of [inscription, shop, worker]) {
    assert.match(content, /veracruz: "Orizaba - 27 y 28 de febrero 2027"/);
  }
  assert.match(admin, /\{ value: "veracruz", label: "Orizaba - 27 y 28 de febrero 2027" \}/);
  assert.match(admin, /veracruz: "2027-02-27"/);
  assert.match(admin, /\{ value: "veracruz", label: "Veracruz" \}/);
  assert.match(participantAdmin, /\{ value: "veracruz", label: "Orizaba" \}/);
  assert.match(worker, /registrationVenues = new Set\(\["cdmx", "cdmx-2027", "puebla", "edomex", "veracruz"\]\)/);
});

test("academy choreography forms honor the final acquisition closure independently of the historical pause", async () => {
  const admin = await source("../src/components/admin/RegistrationScreens.tsx");
  const releveStart = admin.indexOf("function ReleveRegistrationPanel");
  const releveEnd = admin.indexOf("function RelevePaymentsPanel", releveStart);
  const danceStart = admin.indexOf("function DanceRegistrationPanel");
  const danceEnd = admin.indexOf("function ProgramPanel", danceStart);

  assert.ok(releveStart >= 0 && releveEnd > releveStart);
  assert.ok(danceStart >= 0 && danceEnd > danceStart);

  for (const form of [
    admin.slice(releveStart, releveEnd),
    admin.slice(danceStart, danceEnd),
  ]) {
    assert.match(form, /const \{ policy, isVenueAcquisitionClosed, isVenuePaused \} = useRegistrationPolicy\(\)/);
    assert.match(form, /disabled: acquisitionClosed \|\| registrationPaused/);
    assert.match(form, /isVenueAcquisitionClosed\(selectedVenue\)/);
    assert.match(form, /if \(isVenueAcquisitionClosed\(venue\)\)/);
    assert.match(form, /setErrorMessage\(policy\.acquisitionsMessage\)/);
    assert.match(form, /<AdminStatusMessage message=\{registrationClosureMessage\} \/>/);
  }
});

test("Orizaba hides only the Relevé academy tab and advertises the correct general presale dates", async () => {
  const [admin, inscription, worker] = await Promise.all([
    source("../src/components/admin/RegistrationScreens.tsx"),
    source("../src/components/inscripciones/InscripcionesPage.tsx"),
    source("../worker/index.js"),
  ]);
  const sidebarStart = admin.indexOf("function AdminSidebar");
  const sidebarEnd = admin.indexOf("function RegistrationDashboardMetricCard", sidebarStart);

  assert.ok(sidebarStart >= 0 && sidebarEnd > sidebarStart);
  assert.match(admin.slice(sidebarStart, sidebarEnd), /adminMenuItems\.filter\(\(item\) => item\.screen !== "releve"\)/);
  assert.match(admin, /if \(screen === "releve"\)/, "the historical Relevé screen remains available outside the menu");
  assert.match(inscription, /10 de enero de 2027/);
  assert.match(inscription, /11 de enero de 2027/);
  assert.doesNotMatch(inscription, /25 de octubre de 2026/);
  assert.doesNotMatch(inscription, /Relevé: preventa/);
  assert.match(inscription, /Precio vigente aplicado/);
  assert.doesNotMatch(inscription, /Precio preventa respetado/);
  assert.match(worker, /registrationOrizabaInscriptionPresaleEndsAt = Date\.parse\("2027-01-11T06:00:00\.000Z"\)/);
  assert.match(worker, /eventId === "orizaba-2027"/);
});
