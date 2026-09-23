import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminWhatsAppMessageUrl, editAdminMessageDraft, normalizeAdminWhatsAppPhone, resolveAdminMessageDraft } from "../src/components/admin/adminMessage.ts";

test("WhatsApp phone formatting preserves the supplied country code without adding one", () => {
  for (const phone of ["+52 (55) 1234-5678", "0052 55 1234 5678", "525512345678", "  +52.55.1234.5678  "]) {
    assert.equal(normalizeAdminWhatsAppPhone(phone), "525512345678");
  }
  assert.equal(normalizeAdminWhatsAppPhone("+1 (202) 555-0123"), "12025550123");
});

test("missing, malformed and out-of-range phones cannot create WhatsApp URLs", () => {
  for (const phone of ["", "  ", "123", "1234567", "1".repeat(16), "0055", "05512345678",
    "+00525512345678", "+52+5512345678", "+52 55 ABCD 5678", "525512345678?text=otro",
    "https://wa.me/525512345678", "525512345678 ext 2"]) {
    assert.equal(normalizeAdminWhatsAppPhone(phone), null, phone);
    assert.equal(buildAdminWhatsAppMessageUrl(phone, "Mensaje de prueba"), null, phone);
  }
});

test("academy phones require an explicit international prefix without guessing a country", () => {
  const options = { requireCountryPrefix: true };
  assert.equal(normalizeAdminWhatsAppPhone("5512345678", options), null);
  assert.equal(buildAdminWhatsAppMessageUrl("5512345678", "Mensaje de prueba", options), null);
  assert.equal(normalizeAdminWhatsAppPhone("525512345678", options), null);
  for (const phone of ["+52 (55) 1234-5678", "0052 55 1234 5678"]) {
    assert.equal(normalizeAdminWhatsAppPhone(phone, options), "525512345678");
    assert.equal(new URL(buildAdminWhatsAppMessageUrl(phone, "Mensaje de prueba", options)).pathname, "/525512345678");
  }
  assert.equal(normalizeAdminWhatsAppPhone("525512345678"), "525512345678");
  assert.equal(normalizeAdminWhatsAppPhone("5512345678"), "5512345678");
});

test("the message round-trips with accents, newlines, links, punctuation and QR payloads unchanged", () => {
  const message = " Hola, María 👋\nMonto: $1,500.00\nAclaración: A&B + 50% #1\nhttps://levitate.mx/taquilla?accessKey=prueba&orderId=123\nLEVITATE:TICKET:LV-PRUEBA-1234\n ";
  const result = new URL(buildAdminWhatsAppMessageUrl("+52 55 1234 5678", message));
  assert.equal(result.origin, "https://wa.me");
  assert.equal(result.pathname, "/525512345678");
  assert.deepEqual([...result.searchParams.keys()], ["text"]);
  assert.equal(result.searchParams.get("text"), message);
  assert.equal(result.hash, "");
});

test("blank text cannot open WhatsApp and long drafts are not truncated", () => {
  assert.equal(buildAdminWhatsAppMessageUrl("525512345678", " \n\t "), null);
  const message = "Resumen de academia\n" + "Participante: José. Monto: $1,500.\n".repeat(200);
  assert.equal(new URL(buildAdminWhatsAppMessageUrl("525512345678", message)).searchParams.get("text"), message);
});

test("a refreshed record preserves edited text but requires review before sharing", () => {
  const before = "Falta el comprobante del pago.";
  const after = "Recibimos el comprobante. Está en revisión.";
  const draft = editAdminMessageDraft(undefined, "Hola, Ana. Falta el comprobante del pago.", before);
  assert.equal(resolveAdminMessageDraft(draft, before).requiresReview, false);
  assert.deepEqual(resolveAdminMessageDraft(draft, after), { message: draft.body, requiresReview: true });
  const editedAgain = editAdminMessageDraft(draft, "Hola, Ana. Confirmamos la recepción.", after);
  assert.equal(resolveAdminMessageDraft(editedAgain, after).requiresReview, true, "typing alone must not silently acknowledge changed data");
  assert.equal(resolveAdminMessageDraft({ ...editedAgain, sourceBody: after }, after).requiresReview, false);
  assert.deepEqual(resolveAdminMessageDraft({ body: after, sourceBody: after }, after), { message: after, requiresReview: false });
});

test("untouched templates follow refreshed data without creating a stale draft", () => {
  assert.deepEqual(resolveAdminMessageDraft(undefined, "La música ya fue cargada."), {
    message: "La música ya fue cargada.",
    requiresReview: false,
  });
});
