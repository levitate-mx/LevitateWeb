import { sql } from "../_lib/db.js";
import { assertMethod, requireString, sendError } from "../_lib/http.js";

const mediaKeyPattern = /^[a-z0-9.-]+$/;

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    assertMethod(req, ["GET", "HEAD"]);

    const key = requireMediaKey(req.query.key);
    const db = sql();
    await ensureMediaAssetsTable(db);

    const [asset] = await db`
      SELECT content_type, data_base64, updated_at
      FROM levitate_media_assets
      WHERE media_key = ${key}
    `;

    if (!asset) {
      const error = new Error("media asset not found");
      error.statusCode = 404;
      error.code = "not_found";
      throw error;
    }

    const buffer = Buffer.from(asset.data_base64, "base64");

    res.statusCode = 200;
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
    res.setHeader("content-type", asset.content_type);
    res.setHeader("content-length", String(buffer.length));
    res.setHeader("etag", JSON.stringify(`${key}:${serializeDate(asset.updated_at)}`));

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    res.end(buffer);
  } catch (error) {
    sendError(res, error);
  }
}

async function ensureMediaAssetsTable(db) {
  await db`
    CREATE TABLE IF NOT EXISTS levitate_media_assets (
      media_key text PRIMARY KEY,
      content_type text NOT NULL,
      data_base64 text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
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

function setCorsHeaders(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, HEAD, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-max-age", "86400");
}

function serializeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
