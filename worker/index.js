const mediaKeyPattern = /^[a-z0-9.-]+$/;
const maxMediaValueLength = 4_500_000;
const mediaStoragePrefix = "media:";

export class MediaOverridesStore {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    try {
      if (!["GET", "PUT", "DELETE"].includes(request.method)) {
        return sendJson(
          {
            error: {
              code: "method_not_allowed",
              message: `Method ${request.method} not allowed`,
            },
          },
          405,
        );
      }

      if (request.method === "GET") {
        return this.sendOverrides();
      }

      if (request.method === "PUT") {
        const body = await readJsonBody(request);
        const key = requireMediaKey(body.key);
        const value = requireMediaValue(body.value);

        await this.state.storage.put(`${mediaStoragePrefix}${key}`, {
          value,
          updatedAt: new Date().toISOString(),
        });

        return this.sendOverrides();
      }

      const key = requireMediaKey(url.searchParams.get("key"));
      await this.state.storage.delete(`${mediaStoragePrefix}${key}`);

      return this.sendOverrides();
    } catch (error) {
      return sendError(error);
    }
  }

  async sendOverrides() {
    const rows = await this.state.storage.list({ prefix: mediaStoragePrefix });
    const items = Array.from(rows.entries())
      .map(([storageKey, item]) => ({
        key: storageKey.slice(mediaStoragePrefix.length),
        value: item.value,
        updatedAt: item.updatedAt,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));

    return sendJson(
      {
        overrides: Object.fromEntries(items.map((item) => [item.key, item.value])),
        items,
      },
      200,
      { "cache-control": "no-store" },
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return sendJson({ ok: true, storage: "durable-object" });
    }

    if (url.pathname === "/api/media/overrides") {
      if (request.method !== "GET") {
        assertMediaAdminToken(request, env);
      }

      const id = env.MEDIA_OVERRIDES.idFromName("global");
      const store = env.MEDIA_OVERRIDES.get(id);

      return store.fetch(request);
    }

    if (url.pathname.startsWith("/api/")) {
      return sendJson({ error: { code: "not_found", message: "API route not found" } }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

function assertMediaAdminToken(request, env) {
  const expectedToken = env.MEDIA_ADMIN_TOKEN || "";

  if (!expectedToken) {
    return;
  }

  const receivedToken = request.headers.get("x-levitate-admin-token") || "";

  if (receivedToken !== expectedToken) {
    const error = new Error("Invalid media admin token");
    error.statusCode = 401;
    error.code = "invalid_media_admin_token";
    throw error;
  }
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    error.code = "invalid_json";
    throw error;
  }
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    error.code = "validation_error";
    throw error;
  }

  return value.trim();
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
    const error = new Error("value must be an image URL, /assets path or data:image payload");
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
    value.startsWith("data:image/")
  );
}

function sendJson(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function sendError(error) {
  return sendJson(
    {
      error: {
        code: error.code || "internal_error",
        message: error.message || "Unexpected error",
      },
    },
    error.statusCode || 500,
  );
}
