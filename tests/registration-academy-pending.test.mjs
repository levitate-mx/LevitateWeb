import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAcademyPendingReport,
  buildAcademyPendingMessage,
  pendingCategories,
} from "../src/components/admin/academyPendingReport.ts";

const person = (overrides = {}) => ({
  id: "p1",
  academyId: "a1",
  fullName: "Ana Pérez",
  curp: "CURP-ANA",
  birthDate: "2012-01-01",
  age: 14,
  shirtSize: "M",
  ...overrides,
});
const dance = (overrides = {}) => ({
  id: "d1",
  academyId: "a1",
  title: "Luz",
  venue: "edomex",
  venueLabel: "Estado de México",
  categoryLabel: "Solo",
  isReleve: false,
  hasMusic: true,
  participantIds: ["p1"],
  choreographerCount: 1,
  ...overrides,
});
const order = (overrides = {}) => ({
  id: "r1",
  academyId: "a1",
  curp: "CURP-ANA",
  participantName: "Ana Pérez",
  venue: "edomex",
  venueLabel: "Estado de México",
  reference: "REF-1",
  status: "paid",
  kind: "registration",
  amount: 1000,
  paidAmount: 1000,
  currency: "MXN",
  hasProof: true,
  ticketCount: 0,
  cancelledTicketCount: 0,
  danceIds: ["d1"],
  concept: "Luz",
  ...overrides,
});
const tickets = (overrides = {}) =>
  order({
    id: "t1",
    kind: "shop",
    ticketCount: 2,
    danceIds: [],
    concept: "Acceso general",
    ...overrides,
  });
const source = (overrides = {}) => ({
  academy: {
    id: "a1",
    name: "Academia del Sol",
    contactName: "María",
    phone: "+525555555555",
    email: "test@example.test",
  },
  participants: [person()],
  dances: [dance()],
  orders: [order(), tickets()],
  ticketMinimum: 3,
  portalUrl: "https://levitate.example/inscripciones",
  ...overrides,
});

test("two paid tickets leave one missing; report and warm message agree", () => {
  const report = buildAcademyPendingReport(source());
  assert.equal(report.items.length, 1);
  assert.match(report.items[0].detail, /2 de 3 boletos confirmados; falta 1/);
  const message = buildAcademyPendingMessage(report, ["tickets"]);
  assert.match(message, /¡Hola, María!/);
  assert.match(message, /Ana Pérez/);
  assert.match(message, /Luz/);
  assert.match(message, /completar 1 boleto/i);
});

test("reported and proof-bearing payments are in review and do not request a second payment", () => {
  for (const status of ["payment_reported", "pending_payment"]) {
    const report = buildAcademyPendingReport(
      source({
        orders: [
          order(),
          tickets(),
          tickets({ id: "t2", ticketCount: 1, status, hasProof: true }),
        ],
      }),
    );
    const progress = report.items.find((item) =>
      item.id.startsWith("tickets:"),
    );
    assert.match(progress.detail, /1 está en revisión/);
    assert.doesNotMatch(progress.detail, /completar 1 boleto/i);
    assert.equal(
      report.items.filter((item) => item.category === "review").length,
      1,
    );
  }
});

test("requirements count once per person per event, never across events or academies", () => {
  const report = buildAcademyPendingReport(
    source({
      dances: [
        dance(),
        dance({ id: "d2", title: "Aire" }),
        dance({ id: "d3", venue: "veracruz", venueLabel: "Veracruz" }),
        dance({ id: "other", academyId: "a2", hasMusic: false }),
      ],
      orders: [
        order({ danceIds: ["d1", "d2", "d3"] }),
        tickets(),
        tickets({ id: "foreign", academyId: "a2", ticketCount: 9 }),
        tickets({ id: "v", venue: "veracruz", ticketCount: 3 }),
      ],
      participants: [
        person(),
        person({ id: "other", academyId: "a2", shirtSize: "" }),
      ],
    }),
  );
  assert.equal(report.items.length, 1);
  assert.match(report.items[0].context, /Luz, Aire/);
  assert.match(report.items[0].detail, /2 de 3/);
});

test("cancelled tickets are excluded but completed requirements generate no pending item", () => {
  assert.equal(
    buildAcademyPendingReport(
      source({ orders: [order(), tickets({ ticketCount: 3 })] }),
    ).items.length,
    0,
  );
  const report = buildAcademyPendingReport(
    source({
      orders: [order(), tickets({ ticketCount: 3, cancelledTicketCount: 1 })],
    }),
  );
  assert.match(report.items[0].detail, /2 de 3/);
  assert.match(report.items[0].detail, /cancelados/);
});

test("missing orders and new dances absent from an existing paid order stay visible", () => {
  const report = buildAcademyPendingReport(
    source({
      dances: [dance(), dance({ id: "new", title: "Nueva", hasMusic: false })],
    }),
  );
  assert.equal(
    report.items.find((item) => item.category === "music").subject,
    "Nueva",
  );
  assert.match(
    report.items.find((item) => item.category === "registrations").context,
    /Nueva/,
  );
  const noOrder = buildAcademyPendingReport(source({ orders: [] }));
  assert.match(
    noOrder.items.find((item) => item.category === "registrations").detail,
    /Aún no vemos una orden/,
  );
});

test("Relevé is checked per dance without student ticket requirements", () => {
  const input = source({
    participants: [],
    dances: [dance({ isReleve: true, participantIds: [], hasMusic: false })],
    orders: [],
  });
  let report = buildAcademyPendingReport(input);
  assert.deepEqual(
    report.items.map((item) => item.category),
    ["music", "registrations"],
  );
  report = buildAcademyPendingReport({
    ...input,
    orders: [order({ curp: "RELEVE:d1" })],
  });
  assert.deepEqual(
    report.items.map((item) => item.category),
    ["music"],
  );
});

test("selected venue and categories consistently scope the message", () => {
  const input = source({
    dances: [
      dance({ hasMusic: false }),
      dance({
        id: "d2",
        venue: "veracruz",
        venueLabel: "Veracruz",
        title: "Mar",
        hasMusic: false,
      }),
    ],
  });
  const before = structuredClone(input);
  const report = buildAcademyPendingReport(input, "veracruz");
  const message = buildAcademyPendingMessage(report, ["music"]);
  assert.match(message, /Mar/);
  assert.doesNotMatch(
    message,
    /Luz|Estado de México|Boletos|Pagos de inscripciones/,
  );
  assert.deepEqual(input, before);
});

test("rejected partial amounts are described as recorded, preserve currency and correction, and omit internal data", () => {
  const report = buildAcademyPendingReport(
    source({
      orders: [
        order({
          status: "rejected",
          currency: "USD",
          paidAmount: 600,
          rejectionMessage: "Completar diferencia",
          notes: "PRIVATE",
          accessToken: "SECRET",
        }),
      ],
    }),
  );
  const item = report.items.find((item) => item.id === "order:registration:r1");
  assert.match(item.detail, /importe registrado de.*600/);
  assert.match(item.detail, /diferencia con el total es de.*400/);
  assert.match(item.detail, /USD/);
  assert.match(item.detail, /Completar diferencia/);
  const message = buildAcademyPendingMessage(
    report,
    pendingCategories.map((category) => category.id),
  );
  assert.doesNotMatch(message, /CURP-ANA|PRIVATE|SECRET/);
});

test("additional purchases are separated and incomplete records do not disappear", () => {
  const report = buildAcademyPendingReport(
    source({
      participants: [person({ shirtSize: "", age: null })],
      dances: [dance({ choreographerCount: 0 })],
      orders: [
        order(),
        tickets({ ticketCount: 3 }),
        order({
          id: "media",
          kind: "shop",
          status: "pending_payment",
          hasProof: false,
          concept: "Foto y video",
        }),
      ],
    }),
  );
  assert.ok(report.items.some((item) => item.category === "extras"));
  assert.match(
    report.items.find((item) => item.id === "person:p1").detail,
    /edad, talla/,
  );
  assert.ok(report.items.some((item) => item.id === "teacher:d1"));
});

test("paid legacy orders with no lines ask to verify coverage instead of charging again", () => {
  const report = buildAcademyPendingReport(
    source({ orders: [order({ danceIds: [] }), tickets({ ticketCount: 3 })] }),
  );
  assert.match(
    report.items[0].detail,
    /revisarlo juntos antes de realizar otro pago/,
  );
});
