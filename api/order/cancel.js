import { sql } from "../_lib/db.js";
import { assertMethod, readJsonBody, requireString, sendError, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  try {
    assertMethod(req, ["POST"]);

    const body = await readJsonBody(req);
    const orderId = requireString(body.orderId, "orderId");
    const db = sql();

    const [attempt] = await db`
      UPDATE codi_payment_attempts
      SET
        status = 'expired',
        updated_at = now()
      WHERE order_id = ${orderId}
        AND status = 'pending_payment'
      RETURNING *
    `;

    const [order] = await db`
      UPDATE codi_orders
      SET
        status = CASE WHEN status = 'pending_payment' THEN 'expired' ELSE status END,
        updated_at = now()
      WHERE id = ${orderId}
      RETURNING *
    `;

    if (!order) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      error.code = "order_not_found";
      throw error;
    }

    sendJson(res, 200, {
      order: {
        id: order.id,
        status: order.status,
      },
      cancelledAttemptId: attempt?.id || null,
    });
  } catch (error) {
    sendError(res, error);
  }
}
