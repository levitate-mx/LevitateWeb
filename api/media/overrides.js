import { sql } from "../_lib/db.js";
import { assertMethod, readJsonBody, requireString, sendError, sendJson } from "../_lib/http.js";

const mediaKeyPattern = /^[a-z0-9.-]+$/;
const maxMediaValueLength = 4_500_000;

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    assertMethod(req, ["GET", "PUT", "DELETE"]);

    const db = sql();
    await ensureMediaOverridesTable(db);

    if (req.method === "GET") {
      await sendOverrides(res, db);
      return;
    }

    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      const key = requireMediaKey(body.key);
      const value = requireMediaValue(body.value);

      await db`
        INSERT INTO levitate_media_overrides (media_key, media_value, updated_at)
        VALUES (${key}, ${value}, now())
        ON CONFLICT (media_key) DO UPDATE SET
          media_value = EXCLUDED.media_value,
          updated_at = now()
      `;

      await sendOverrides(res, db);
      return;
    }

    const key = requireMediaKey(req.query.key);
    await db`
      DELETE FROM levitate_media_overrides
      WHERE media_key = ${key}
    `;

    await sendOverrides(res, db);
  } catch (error) {
    sendError(res, error);
  }
}

async function ensureMediaOverridesTable(db) {
  await db`
    CREATE TABLE IF NOT EXISTS levitate_media_overrides (
      media_key text PRIMARY KEY,
      media_value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

async function sendOverrides(res, db) {
  const rows = await db`
    SELECT media_key, media_value, updated_at
    FROM levitate_media_overrides
    ORDER BY media_key
  `;

  const items = rows.map((row) => ({
    key: row.media_key,
    value: row.media_value,
    updatedAt: serializeDate(row.updated_at),
  }));

  res.setHeader("cache-control", "no-store");
  sendJson(res, 200, {
    overrides: Object.fromEntries(items.map((item) => [item.key, item.value])),
    items,
  });
}

function requireMediaKey(value) {
  const key = requireString(value, "key");

  if (!mediaKeyPattern.test(key)) {
    const error = new Error("key must contain only lowercase letters, numbers, dots or hyphens");
    error.statusCode = 400;
    error.code = "validation_error";
    throw error;
  }

  return key;
}

function requireMediaValue(value) {
  const mediaValue = requireString(value, "value");

  if (mediaValue.length > maxMediaValueLength) {
    const error = new Error("value is too large");
    error.statusCode = 413;
    error.code = "payload_too_large";
    throw error;
  }

  if (!isAllowedMediaValue(mediaValue)) {
    const error = new Error("value must be a media URL, /assets path, data:image payload or data:video payload");
    error.statusCode = 400;
    error.code = "validation_error";
    throw error;
  }

  return mediaValue;
}

function isAllowedMediaValue(value) {
  return (
    value.startsWith("/assets/") ||
    value.startsWith("https://") ||
    value.startsWith("http://") ||
    value.startsWith("data:image/") ||
    value.startsWith("data:video/")
  );
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigin = getAllowedOrigin(origin);

  if (allowedOrigin) {
    res.setHeader("access-control-allow-origin", allowedOrigin);
  }

  res.setHeader("vary", "Origin");
  res.setHeader("access-control-allow-methods", "GET, PUT, DELETE, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-max-age", "86400");
}

function getAllowedOrigin(origin) {
  const allowedOrigins = String(process.env.MEDIA_ALLOWED_ORIGINS || "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedOrigins.includes("*")) {
    return "*";
  }

  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  return "";
}

function serializeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
