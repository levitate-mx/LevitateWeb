import { randomUUID } from "node:crypto";

import { createCodiCharge } from "../_lib/codi-provider.js";
import { sql } from "../_lib/db.js";
import { assertMethod, readJsonBody, requirePositiveAmount, sendError, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  try {
    assertMethod(req, ["POST"]);

    const body = await readJsonBody(req);
    const amountCents = requirePositiveAmount(body.amount);
    const currency = String(body.currency || "MXN").toUpperCase();

    if (currency !== "MXN") {
      const error = new Error("CoDi payments must use MXN");
      error.statusCode = 400;
      error.code = "unsupported_currency";
      throw error;
    }

    const db = sql();
    const now = new Date();
    const orderId = body.orderId || randomUUID();
    const attemptId = randomUUID();
    const expiresAt = new Date(now.getTime() + Number(body.expiresInMinutes || 10) * 60 * 1000);

    const [order] = await db`
      INSERT INTO codi_orders (
        id,
        status,
        amount_cents,
        currency,
        description,
        customer_email,
        customer_phone,
        metadata
      )
      VALUES (
        ${orderId},
        'pending_payment',
        ${amountCents},
        ${currency},
        ${body.description || null},
        ${body.customer?.email || null},
        ${body.customer?.phone || null},
        ${JSON.stringify(body.metadata || {})}::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        updated_at = now()
      RETURNING *
    `;

    if (order.status === "paid") {
      const error = new Error("Order is already paid");
      error.statusCode = 409;
      error.code = "order_already_paid";
      throw error;
    }

    if (order.amount_cents !== amountCents || order.currency !== currency) {
      const error = new Error("Existing order amount or currency does not match");
      error.statusCode = 409;
      error.code = "order_amount_mismatch";
      throw error;
    }

    const [attempt] = await db`
      INSERT INTO codi_payment_attempts (
        id,
        order_id,
        provider,
        status,
        amount_cents,
        currency,
        expires_at,
        raw_request
      )
      VALUES (
        ${attemptId},
        ${order.id},
        ${process.env.CODI_PROVIDER || "mock"},
        'pending_payment',
        ${amountCents},
        ${currency},
        ${expiresAt.toISOString()},
        ${JSON.stringify(body)}::jsonb
      )
      RETURNING *
    `;

    const charge = await createCodiCharge({ req, order, attempt });

    const [updatedAttempt] = await db`
      UPDATE codi_payment_attempts
      SET
        provider = ${charge.provider},
        provider_payment_id = ${charge.providerPaymentId},
        method = ${charge.method},
        qr_payload = ${charge.qrPayload},
        qr_image_url = ${charge.qrImageUrl},
        redirect_url = ${charge.redirectUrl},
        raw_response = ${JSON.stringify(charge.rawResponse || {})}::jsonb,
        updated_at = now()
      WHERE id = ${attempt.id}
      RETURNING *
    `;

    sendJson(res, 201, {
      order: serializeOrder(order),
      paymentAttempt: serializeAttempt(updatedAttempt),
      checkout: {
        method: updatedAttempt.method,
        qrPayload: updatedAttempt.qr_payload,
        qrImageUrl: updatedAttempt.qr_image_url,
        redirectUrl: updatedAttempt.redirect_url,
        expiresAt: updatedAttempt.expires_at,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}

function serializeOrder(order) {
  return {
    id: order.id,
    status: order.status,
    amount: order.amount_cents / 100,
    currency: order.currency,
    description: order.description,
  };
}

function serializeAttempt(attempt) {
  return {
    id: attempt.id,
    provider: attempt.provider,
    providerPaymentId: attempt.provider_payment_id,
    status: attempt.status,
    method: attempt.method,
    expiresAt: attempt.expires_at,
  };
}
