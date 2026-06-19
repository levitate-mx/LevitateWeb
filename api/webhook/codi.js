import { getWebhookSecret } from "../_lib/config.js";
import { normalizeProviderStatus } from "../_lib/codi-provider.js";
import { sql } from "../_lib/db.js";
import { assertMethod, readJsonBody, requireString, sendError, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  try {
    assertMethod(req, ["POST"]);
    validateWebhookSecret(req);

    const body = await readJsonBody(req);
    const provider = String(body.provider || process.env.CODI_PROVIDER || "mock");
    const paymentAttemptId = requireString(body.paymentAttemptId, "paymentAttemptId");
    const providerEventId = body.eventId || `${provider}_${paymentAttemptId}_${body.status || "unknown"}`;
    const normalizedStatus = normalizeProviderStatus(body.status);
    const db = sql();

    const [attempt] = await db`
      SELECT *
      FROM codi_payment_attempts
      WHERE id = ${paymentAttemptId}
      LIMIT 1
    `;

    if (!attempt) {
      const error = new Error("Payment attempt not found");
      error.statusCode = 404;
      error.code = "payment_attempt_not_found";
      throw error;
    }

    const [order] = await db`
      SELECT *
      FROM codi_orders
      WHERE id = ${attempt.order_id}
      LIMIT 1
    `;

    const amountCents = body.amount ? Math.round(Number(body.amount) * 100) : attempt.amount_cents;
    const nextStatus = amountCents === attempt.amount_cents ? normalizedStatus : "manual_review";

    await db`
      INSERT INTO codi_payment_events (
        provider,
        provider_event_id,
        event_type,
        payment_attempt_id,
        order_id,
        raw_payload
      )
      VALUES (
        ${provider},
        ${providerEventId},
        ${String(body.type || "payment.updated")},
        ${attempt.id},
        ${attempt.order_id},
        ${JSON.stringify(body)}::jsonb
      )
      ON CONFLICT (provider, provider_event_id) DO NOTHING
    `;

    const [updatedAttempt] = await db`
      UPDATE codi_payment_attempts
      SET
        status = ${nextStatus},
        paid_at = CASE WHEN ${nextStatus} = 'paid' THEN now() ELSE paid_at END,
        updated_at = now()
      WHERE id = ${attempt.id}
      RETURNING *
    `;

    const [updatedOrder] = await db`
      UPDATE codi_orders
      SET
        status = ${nextStatus},
        paid_at = CASE WHEN ${nextStatus} = 'paid' THEN now() ELSE paid_at END,
        updated_at = now()
      WHERE id = ${order.id}
        AND status <> 'paid'
      RETURNING *
    `;

    sendJson(res, 200, {
      received: true,
      paymentAttempt: {
        id: updatedAttempt.id,
        status: updatedAttempt.status,
      },
      order: {
        id: (updatedOrder || order).id,
        status: (updatedOrder || order).status,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}

function validateWebhookSecret(req) {
  const secret = getWebhookSecret();

  if (!secret) {
    return;
  }

  const received = req.headers["x-codi-webhook-secret"];

  if (received !== secret) {
    const error = new Error("Invalid webhook secret");
    error.statusCode = 401;
    error.code = "invalid_webhook_secret";
    throw error;
  }
}
