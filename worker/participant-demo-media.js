import { getParticipantDemoMediaByPath, getParticipantDemoMediaBySlot } from "../shared/participant-demo-media.js";
import { PHOTO_WATERMARK_VERSION, validatePreparedParticipantPhoto } from "../shared/participant-photo-watermark.js";

const genericMessage = "Esta imagen de ejemplo no está disponible por el momento.";
const processingTimeoutMs = 8000;

function fault(message = genericMessage, code = "portal_demo_media_unavailable", statusCode = 503) {
  return Object.assign(new Error(message), { code, statusCode });
}

function jpegType(value) {
  return typeof value === "string" && value.split(";")[0].trim().toLowerCase() === "image/jpeg";
}

async function boundedBytes(body, expectedSize) {
  if (!body?.getReader) throw fault();
  const reader = body.getReader();
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(fault()), processingTimeoutMs);
  });
  let complete = false;
  try {
    const chunks = [];
    let size = 0;
    for (;;) {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      if (!(value instanceof Uint8Array)) throw fault();
      size += value.byteLength;
      if (size > expectedSize) throw fault();
      chunks.push(value);
    }
    if (size !== expectedSize) throw fault();
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    complete = true;
    return bytes;
  } finally {
    clearTimeout(timer);
    if (!complete) void reader.cancel().catch(() => undefined);
    try { reader.releaseLock(); } catch { /* A pending cancellation owns the lock. */ }
  }
}

async function verifyResponse(response, photo) {
  if (!response?.ok || !jpegType(response.headers.get("content-type"))) throw fault();
  const length = response.headers.get("content-length");
  if (length !== null && length !== String(photo.byteSize)) throw fault();
  const bytes = await boundedBytes(response.body, photo.byteSize);
  const prepared = await validatePreparedParticipantPhoto(bytes);
  if (prepared.sha256 !== photo.sha256 || prepared.width !== photo.width || prepared.height !== photo.height) throw fault();
  return prepared;
}

async function driveStore(getMediaStore) {
  if (typeof getMediaStore !== "function") throw fault();
  const storage = await getMediaStore();
  if (storage?.info?.provider !== "google_drive") throw fault();
  return storage;
}

/** Internal helper, called only after the existing admin POST route authenticates.
 * This accepts a fixed archival slot, never uploaded bytes or arbitrary paths.
 */
export async function prepareParticipantDemoPhoto(env, { slot, getMediaStore } = {}) {
  const photo = getParticipantDemoMediaBySlot(slot);
  if (!photo) throw fault("Selecciona una de las dos imágenes de ejemplo.", "portal_demo_photo_invalid", 400);
  try {
    if (typeof env?.ASSETS?.fetch !== "function") throw fault();
    const source = await env.ASSETS.fetch(new Request(`https://levitate.mx${photo.sourcePath}`, { redirect: "manual" }));
    const prepared = await verifyResponse(source, photo);
    const storage = await driveStore(getMediaStore);
    if (typeof storage.put !== "function") throw fault();
    await storage.put(photo.storageKey, prepared.bytes, {
      verifiedSha256: photo.sha256,
      httpMetadata: { contentType: "image/jpeg" },
      customMetadata: { watermarkVersion: PHOTO_WATERMARK_VERSION },
    });
    return { slot: photo.slot, previewUrl: photo.publicPath };
  } catch { throw fault("No pudimos guardar la imagen de ejemplo en Drive. Comprueba el almacenamiento e intenta nuevamente."); }
}

function imageResponse(photo, bytes, head = false) {
  return new Response(head ? null : bytes, { headers: {
    "content-type": "image/jpeg",
    "content-length": String(photo.byteSize),
    "content-disposition": `inline; filename="mi-levitate-demo-${photo.slot}.jpg"`,
    "cache-control": "public, max-age=300",
    "x-content-type-options": "nosniff",
    "x-levitate-media-source": "google-drive",
    etag: `"${photo.sha256}"`,
  } });
}

function errorResponse(request, status, code, message, extra = {}) {
  return new Response(request.method === "HEAD" ? null : JSON.stringify({ error: { code, message } }), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra,
  } });
}

/** Public access is limited to the two pre-approved archival demo snapshots.
 * Real participant assets continue to use the authenticated portal endpoints.
 */
export async function serveParticipantDemoPhoto(request, { getMediaStore, cache, waitUntil } = {}) {
  const url = new URL(request.url);
  const photo = !url.search ? getParticipantDemoMediaByPath(url.pathname) : null;
  if (!photo) return errorResponse(request, 404, "demo_media_not_found", "No se encontró esta imagen de ejemplo.");
  if (!["GET", "HEAD"].includes(request.method)) return errorResponse(request, 405, "demo_media_method_not_allowed", "Método no permitido.", { allow: "GET, HEAD" });
  const cacheUrl = new URL(photo.publicPath, url.origin);
  cacheUrl.searchParams.set("demo-media-version", photo.sha256);
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  if (typeof cache?.match === "function") {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const prepared = await verifyResponse(cached, photo);
        return imageResponse(photo, prepared.bytes, request.method === "HEAD");
      }
    } catch { /* A cache miss or invalid entry falls through to verified Drive. */ }
  }
  try {
    const storage = await driveStore(getMediaStore);
    if (typeof storage.getByStorageKey !== "function") throw fault();
    const object = await storage.getByStorageKey(photo.storageKey);
    if (!object) return errorResponse(request, 404, "demo_media_not_found", genericMessage);
    if (object.size !== photo.byteSize || object.customMetadata?.watermarkVersion !== PHOTO_WATERMARK_VERSION
      || !jpegType(object.httpMetadata?.contentType)) throw fault();
    const prepared = await verifyResponse(new Response(object.body, { headers: {
      "content-type": "image/jpeg", "content-length": String(object.size),
    } }), photo);
    const response = imageResponse(photo, prepared.bytes);
    if (typeof cache?.put === "function") {
      const store = Promise.resolve().then(() => cache.put(cacheKey, response.clone())).catch(() => undefined);
      if (typeof waitUntil === "function") waitUntil(store);
      else await store;
    }
    return request.method === "HEAD" ? imageResponse(photo, prepared.bytes, true) : response;
  } catch { return errorResponse(request, 503, "demo_media_unavailable", genericMessage); }
}
