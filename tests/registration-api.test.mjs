import assert from "node:assert/strict";
import test from "node:test";
import { RegistrationApiError, requestRegistrationApi } from "../src/components/admin/registrationApi.ts";

const invalidResponseMessage = "No se pudo leer la respuesta del servidor. Actualiza los datos antes de volver a intentar.";
const unavailableMessage = "El servidor no pudo responder. Actualiza los datos antes de volver a intentar.";

test("registration requests return valid objects and preserve request headers and cancellation signals", async t => {
  const controller = new AbortController();
  const payload = { order: { id: "order-1", status: "paid" } };
  const fetch = t.mock.method(globalThis, "fetch", async (path, options) => {
    assert.equal(path, "/api/registration/admin/inscription-order/status");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.signal, controller.signal);
    assert.equal(options.headers.get("content-type"), "application/json");
    assert.equal(options.headers.get("x-request-id"), "test-request");
    assert.equal(options.body, '{"id":"order-1","status":"paid"}');
    return Response.json(payload);
  });

  const result = await requestRegistrationApi("/api/registration/admin/inscription-order/status", {
    method: "POST",
    headers: { "x-request-id": "test-request" },
    signal: controller.signal,
    body: JSON.stringify({ id: "order-1", status: "paid" }),
  });

  assert.deepEqual(result, payload);
  assert.equal(fetch.mock.callCount(), 1);
});

for (const [label, body] of [
  ["HTML", "<!doctype html><title>Unavailable</title>"],
  ["empty body", ""],
  ["malformed JSON", '{"order":'],
  ["null", "null"],
  ["array", "[]"],
  ["string", '"unexpected"'],
  ["number", "42"],
  ["boolean", "false"],
]) {
  test(`successful HTTP response with ${label} rejects before accessing order`, async t => {
    const fetch = t.mock.method(globalThis, "fetch", async () => new Response(body));
    let opened = false;
    await assert.rejects(
      requestRegistrationApi("/api/registration/admin/payment-order?id=order-1")
        .then(payload => { opened = true; return payload.order; }),
      error => error instanceof RegistrationApiError && error.status === 200 &&
        error.code === "invalid_response" && error.message === invalidResponseMessage,
    );
    assert.equal(opened, false);
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test("structured unauthorized errors preserve the class, status, code and server message", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    error: { code: "registration_session_required", message: "Inicia sesión para continuar." },
  }, { status: 401 }));

  await assert.rejects(requestRegistrationApi("/api/registration/me"), error => {
    assert.ok(error instanceof RegistrationApiError);
    assert.equal(error.name, "RegistrationApiError");
    assert.equal(error.status, 401);
    assert.equal(error.code, "registration_session_required");
    assert.equal(error.message, "Inicia sesión para continuar.");
    return true;
  });
});

for (const status of [401, 502, 503]) {
  test(`non-JSON HTTP ${status} preserves its status with an appropriate fallback`, async t => {
    const fetch = t.mock.method(globalThis, "fetch", async () => new Response("<h1>Unavailable</h1>", { status }));

    await assert.rejects(requestRegistrationApi("/api/registration/admin/payment-order"), error =>
      error instanceof RegistrationApiError && error.status === status && error.code === "request_error" &&
      error.message === (status >= 500 ? unavailableMessage : "No se pudo completar la solicitud."),
    );
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test("server failures preserve a valid backend message and replace invalid messages", async t => {
  let message;
  t.mock.method(globalThis, "fetch", async () => Response.json({
    error: { code: "server_unavailable", message },
  }, { status: 503 }));

  for (message of ["No se pudo consultar el pago.", "", "   ", null, 42]) {
    await assert.rejects(requestRegistrationApi("/api/registration/admin/payment-order"), error =>
      error instanceof RegistrationApiError && error.status === 503 && error.code === "server_unavailable" &&
      error.message === (typeof message === "string" && message.trim() ? message : unavailableMessage),
    );
  }
});

for (const phase of ["fetch", "body"]) {
  test(`cancellation during ${phase} preserves AbortError`, async t => {
    const aborted = new DOMException("The request was aborted.", "AbortError");
    t.mock.method(globalThis, "fetch", async () => {
      if (phase === "fetch") throw aborted;
      const response = Response.json({ order: { id: "order-1" } });
      t.mock.method(response, "json", async () => { throw aborted; });
      return response;
    });

    await assert.rejects(requestRegistrationApi("/api/registration/admin/payment-order"), error => error === aborted);
  });
}

test("a POST with an unreadable response is never retried or reported as successful", async t => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(""));
  let updated = false;

  await assert.rejects(requestRegistrationApi("/api/registration/admin/inscription-order/status", {
    method: "POST",
    body: JSON.stringify({ id: "order-1", status: "paid" }),
  }).then(() => { updated = true; }), { code: "invalid_response" });

  assert.equal(updated, false);
  assert.equal(fetch.mock.callCount(), 1);
});
