import { sql } from "../_lib/db.js";
import { assertMethod, requireString, sendError, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  try {
    assertMethod(req, ["GET"]);

    const orderId = requireString(req.query.orderId, "orderId");
    const db = sql();

    const [order] = await db`
      SELECT *
      FROM codi_orders
      WHERE id = ${orderId}
      LIMIT 1
    `;

    if (!order) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      error.code = "order_not_found";
      throw error;
    }

    const attempts = await db`
      SELECT *
      FROM codi_payment_attempts
      WHERE order_id = ${orderId}
      ORDER BY created_at DESC
      LIMIT 5
    `;

    sendJson(res, 200, {
      order: {
        id: order.id,
        status: order.status,
        amount: order.amount_cents / 100,
        currency: order.currency,
        paidAt: order.paid_at,
        updatedAt: order.updated_at,
      },
      paymentAttempts: attempts.map((attempt) => ({
        id: attempt.id,
        provider: attempt.provider,
        providerPaymentId: attempt.provider_payment_id,
        status: attempt.status,
        method: attempt.method,
        expiresAt: attempt.expires_at,
        updatedAt: attempt.updated_at,
      })),
    });
  } catch (error) {
    sendError(res, error);
  }
}
