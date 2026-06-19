import { getProviderName, getPublicSiteUrl } from "./config.js";

export async function createCodiCharge({ req, order, attempt }) {
  const provider = getProviderName();

  if (provider !== "mock") {
    const error = new Error(`Provider ${provider} is not implemented yet`);
    error.statusCode = 501;
    error.code = "provider_not_implemented";
    throw error;
  }

  return createMockCharge({ req, order, attempt });
}

function createMockCharge({ req, order, attempt }) {
  const publicUrl = getPublicSiteUrl(req);
  const amount = (order.amount_cents / 100).toFixed(2);
  const payload = {
    type: "mock-codi-charge",
    orderId: order.id,
    paymentAttemptId: attempt.id,
    amount,
    currency: order.currency,
  };

  return {
    provider: "mock",
    providerPaymentId: `mock_${attempt.id}`,
    method: "qr",
    qrPayload: JSON.stringify(payload),
    qrImageUrl: null,
    redirectUrl: `${publicUrl}/checkout/codi?orderId=${encodeURIComponent(order.id)}`,
    rawResponse: payload,
  };
}

export function normalizeProviderStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (["paid", "approved", "confirmed", "succeeded", "success"].includes(normalized)) {
    return "paid";
  }

  if (["expired", "timeout"].includes(normalized)) {
    return "expired";
  }

  if (["failed", "rejected", "cancelled", "canceled", "error"].includes(normalized)) {
    return "failed";
  }

  return "pending_payment";
}
