export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function sendError(res, error) {
  const statusCode = error.statusCode || 500;
  sendJson(res, statusCode, {
    error: {
      code: error.code || "internal_error",
      message: error.message || "Unexpected error",
    },
  });
}

export function assertMethod(req, allowed) {
  if (allowed.includes(req.method)) {
    return;
  }

  const error = new Error(`Method ${req.method} not allowed`);
  error.statusCode = 405;
  error.code = "method_not_allowed";
  throw error;
}

export async function readJsonBody(req) {
  if (Buffer.isBuffer(req.body)) {
    return parseJson(req.body.toString("utf8"));
  }

  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.length > 0) {
    return parseJson(req.body);
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? parseJson(raw) : {};
}

export function requireString(value, fieldName) {
  if (Array.isArray(value)) {
    value = value[0];
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    error.code = "validation_error";
    throw error;
  }

  return value.trim();
}

export function requirePositiveAmount(value, fieldName = "amount") {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error(`${fieldName} must be a positive number`);
    error.statusCode = 400;
    error.code = "validation_error";
    throw error;
  }

  return Math.round(amount * 100);
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    error.code = "invalid_json";
    throw error;
  }
}
