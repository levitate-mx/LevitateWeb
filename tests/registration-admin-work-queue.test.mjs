import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminWorkQueue, getAdminWorkQueueAge, getAdminWorkQueueTimestamp } from "../src/components/admin/adminWorkQueueData.ts";

const now = Date.parse("2026-09-23T12:00:00Z");
const order = (overrides = {}) => ({ id: "order-1", status: "pending_payment", participantName: "Participante", academyName: "Academia", venue: "edomex", reference: "REF-1", createdAt: "2026-09-20T12:00:00Z", updatedAt: "2026-09-21T12:00:00Z", ...overrides });
const participant = (overrides = {}) => ({ id: "person-1", fullName: "Participante", academyName: "Academia", eventVenues: ["edomex"], createdAt: "2026-09-18T12:00:00Z", birthDate: "2014-01-01", age: 12, shirtSize: "12_14", ...overrides });
const dance = (overrides = {}) => ({ id: "dance-1", title: "Pieza", academyName: "Academia", venue: "edomex", createdAt: "2026-09-19T12:00:00Z", ...overrides });

test("queue includes only unresolved cases and preserves exact record IDs without changing source data", () => {
  const input = {
    orders: [order(), order({ id: "paid", status: "paid" }), order({ id: "review", status: "payment_reported", proof: { uploadedAt: "2026-09-22T12:00:00Z" } }), order({ id: "reject", status: "rejected" })],
    dances: [dance(), dance({ id: "music-ready", musicUpload: { fileName: "song.mp3" } })],
    participants: [participant(), participant({ id: "missing", shirtSize: "" }), participant({ id: "zero-age", age: 0 })],
  };
  const before = structuredClone(input);
  const queue = buildAdminWorkQueue(input, now);
  assert.deepEqual(new Set(queue.map((item) => item.id)), new Set(["order:order-1", "order:review", "order:reject", "dance:dance-1", "participant:missing"]));
  assert.deepEqual(queue.find((item) => item.id === "dance:dance-1").target, { type: "dance", id: "dance-1" });
  assert.deepEqual(queue.find((item) => item.id === "participant:missing").target, { type: "participant", id: "missing" });
  assert.deepEqual(queue.find((item) => item.id === "order:review").target, { type: "order", id: "review" });
  assert.deepEqual(input, before);
});

test("old reported payments take priority using proof upload time, not the order creation date", () => {
  const queue = buildAdminWorkQueue({
    orders: [
      order({ id: "recent-proof", status: "payment_reported", createdAt: "2026-08-01T12:00:00Z", proof: { uploadedAt: "2026-09-23T11:00:00Z" } }),
      order({ id: "old-proof", status: "payment_reported", proof: { uploadedAt: "2026-09-20T12:00:00Z" } }),
      order({ id: "rejected", status: "rejected", reviewedAt: "2026-09-19T12:00:00Z" }),
    ], dances: [], participants: [],
  }, now);
  assert.deepEqual(queue.map((item) => item.id), ["order:old-proof", "order:recent-proof", "order:rejected"]);
  assert.equal(queue[0].urgent, true);
  assert.equal(queue[1].urgent, false);
  assert.equal(queue[0].dateLabel, "Comprobante recibido");
  assert.equal(queue[2].dateLabel, "Pago revisado");
});

test("dates retain their actual meaning and missing timestamps do not become urgent", () => {
  const queue = buildAdminWorkQueue({ orders: [order({ status: "payment_reported", createdAt: "", updatedAt: "" })], dances: [dance()], participants: [participant({ birthDate: "", age: null, shirtSize: " " })] }, now);
  assert.equal(queue.find((item) => item.category === "payments").urgent, false);
  assert.equal(queue.find((item) => item.category === "music").dateLabel, "Coreografía registrada");
  assert.equal(queue.find((item) => item.category === "participants").detail, "Falta: fecha de nacimiento, edad, talla.");
  assert.equal(getAdminWorkQueueAge("", now), "Fecha no disponible");
  assert.equal(getAdminWorkQueueTimestamp("2026-09-20 12:00:00"), Date.parse("2026-09-20T12:00:00Z"));
  assert.equal(getAdminWorkQueueAge("2026-09-20 12:00:00", now), "Hace 3 días");
});

test("reported orders without a dated proof are not classified as overdue proof reviews", () => {
  const queue = buildAdminWorkQueue({
    orders: [
      order({ id: "no-proof", status: "payment_reported", createdAt: "2026-08-01T12:00:00Z", updatedAt: "2026-08-02T12:00:00Z" }),
      order({ id: "proof-no-date", status: "payment_reported", proof: { uploadedAt: "" } }),
      order({ id: "created-only", status: "payment_reported", updatedAt: "" }),
    ], dances: [], participants: [],
  }, now);
  assert.ok(queue.every((item) => !item.urgent));
  const withoutProof = queue.find((item) => item.target.id === "no-proof");
  assert.equal(withoutProof.title, "Pago por revisar sin comprobante");
  assert.equal(withoutProof.actionLabel, "Ver orden");
  assert.equal(withoutProof.dateLabel, "Última actualización");
  assert.equal(queue.find((item) => item.target.id === "created-only").dateLabel, "Orden creada");
});

test("all supplied scoped cases remain reachable and no unprovided case is fabricated", () => {
  const input = { orders: Array.from({ length: 37 }, (_, index) => order({ id: String(index) })), dances: [], participants: [] };
  const queue = buildAdminWorkQueue(input, now);
  assert.equal(queue.length, 37);
  assert.equal(new Set(queue.map((item) => item.id)).size, 37);
  assert.deepEqual(buildAdminWorkQueue({ orders: [], dances: [], participants: [] }, now), []);
});
