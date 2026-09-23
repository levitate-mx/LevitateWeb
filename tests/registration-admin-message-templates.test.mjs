import assert from "node:assert/strict";
import test from "node:test";
import { buildAcademyMessageTemplates, buildOrderMessageTemplates } from "../src/components/admin/adminMessageTemplates.ts";

const order = Object.freeze({
  status: "pending_payment", participantName: "Participante Ejemplo", academyName: "Academia Ejemplo",
  reference: "BOL-TEST", venueLabel: "Evento de prueba", amountLabel: "$450", hasProof: false,
  correctionUrl: "https://example.test/taquilla?accessKey=private&orderId=demo&upload=proof",
  approvalBody: "Tu pago está aprobado.", rejectionBody: "El comprobante no es legible; vuelve a cargarlo.",
  ticketDeliveryUrl: "https://example.test/taquilla?accessKey=private&orderId=demo&tickets=1",
  ticketLabels: Object.freeze(["Day pass · Domingo"]),
});

test("messages never offer approved payment or ticket delivery for unpaid orders", () => {
  for (const status of ["pending_payment", "payment_reported", "rejected"]) {
    const templates = buildOrderMessageTemplates({ ...order, status });
    assert.ok(templates.length);
    assert.ok(templates.every((template) => !["payment-approved", "tickets-ready"].includes(template.id)));
    assert.ok(templates.every((template) => !template.body.includes(order.ticketDeliveryUrl)));
  }
  assert.equal(order.status, "pending_payment");
});

test("an existing proof produces a review notice instead of asking the buyer to pay again", () => {
  const [template] = buildOrderMessageTemplates({ ...order, hasProof: true });
  assert.equal(template.id, "payment-in-review");
  assert.match(template.body, /Recibimos el comprobante/);
  assert.doesNotMatch(template.body, /completar el pago|no tiene un comprobante/);
});

test("QR messages reuse the provided delivery URL and explain that downloading does not reactivate a used QR", () => {
  const templates = buildOrderMessageTemplates({ ...order, status: "paid" });
  const delivery = templates.find((template) => template.id === "tickets-ready");
  assert.match(delivery.body, /Day pass · Domingo/);
  assert.ok(delivery.body.includes(order.ticketDeliveryUrl));
  assert.match(delivery.body, /no lo reactiva/);
  assert.equal(buildOrderMessageTemplates({ ...order, status: "paid", ticketLabels: [] }).length, 1);
  assert.equal(buildOrderMessageTemplates({ ...order, status: "paid", ticketDeliveryUrl: "" }).length, 1);
});

test("academy messages distinguish customer action from internal review and omit completed records", () => {
  const templates = buildAcademyMessageTemplates({
    academyName: "Academia Ejemplo", contactName: "Responsable", portalUrl: "https://example.test/inscripciones",
    orders: [
      { reference: "PAID", participantName: "Completo", status: "paid" },
      { reference: "REVIEW", participantName: "En revisión", status: "payment_reported" },
      { reference: "CORRECTION", participantName: "Corregir", status: "rejected", rejectionMessage: "Imagen ilegible." },
    ],
    dances: [{ title: "Vuelo", venueLabel: "Evento", hasMusic: false }, { title: "Lista", venueLabel: "Evento", hasMusic: true }],
    participants: [{ fullName: "Persona", missingFields: ["talla de playera"] }],
  });
  const body = templates[0].body;
  assert.match(body, /Vuelo · Evento: cargar la música/);
  assert.match(body, /Persona: completar talla de playera/);
  assert.match(body, /CORRECTION · Corregir: Imagen ilegible/);
  assert.match(body, /En revisión por nuestro equipo:\n• REVIEW/);
  assert.doesNotMatch(body, /PAID|Lista · Evento/);
});

test("an academy with no pending records does not generate an empty reminder", () => {
  assert.deepEqual(buildAcademyMessageTemplates({ academyName: "Lista", contactName: "", portalUrl: "https://example.test", orders: [], dances: [], participants: [] }), []);
});
