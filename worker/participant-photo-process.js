import { Buffer } from "node:buffer";
import { addPreparedPhotoMarker, validatePreparedParticipantPhoto, watermarkStampPng } from "../shared/participant-photo-watermark.js";

const maximumSourceBytes = 8 * 1024 * 1024;
const maximumPreviewBytes = 1024 * 1024;
const maximumEdge = 800;
const maximumSourcePixels = 40 * 1000 * 1000;
const serviceTimeoutMs = 20000;
const stampBytes = new Uint8Array(Buffer.from(watermarkStampPng, "base64"));

function fault(message = "No pudimos preparar esta vista previa. Intenta nuevamente.", code = "portal_photo_processing_unavailable", statusCode = 503) {
  return Object.assign(new Error(message), { code, statusCode });
}

const sourceFormats = new Map([["image/jpeg", "jpeg"], ["image/png", "png"], ["image/webp", "webp"]]);
function imageType(value) { return typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : ""; }
function checkedInfo(info, format, edge = 50000, pixels = maximumSourcePixels) {
  const normalized = String(info?.format || "").toLowerCase().replace(/^image\//, "").replace(/^jpg$/, "jpeg");
  if (normalized !== format || !Number.isInteger(info?.width) || !Number.isInteger(info?.height)
    || info.width < 1 || info.height < 1 || info.width > edge || info.height > edge || info.width * info.height > pixels) throw fault();
  return { width: info.width, height: info.height };
}
function sourceSignature(bytes, type) {
  return type === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : type === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
      : type === "image/webp" && new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF"
        && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP";
}
async function service(operation) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([operation(controller.signal), new Promise((resolve, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(fault()); }, serviceTimeoutMs);
    })]);
  } catch (error) {
    if (error?.code?.startsWith("portal_")) throw error;
    // Provider details may include private image data. Never return its body,
    // original input, URL or error text as a fallback to the participant.
    throw fault();
  } finally { clearTimeout(timer); }
}
async function boundedJpeg(response, signal) {
  if (!response?.ok || imageType(response.headers?.get("content-type")) !== "image/jpeg" || !response.body?.getReader) throw fault();
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximumPreviewBytes)) throw fault();
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  let received = 0, complete = false;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || (received += value.byteLength) > maximumPreviewBytes) throw fault();
      chunks.push(value);
    }
    if (signal.aborted || !received || (declared !== null && received !== Number(declared))) throw fault();
    const bytes = new Uint8Array(received); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    complete = true;
    return bytes;
  } finally {
    signal.removeEventListener("abort", cancel);
    if (!complete) void reader.cancel().catch(() => undefined);
    try { reader.releaseLock(); } catch { /* Cancellation may still own the lock. */ }
  }
}

/** Native Images transformations operate on private server-side bytes. Only
 * the reduced, rasterized, marked JPEG can leave this processor. This uses the
 * Images Free transformations binding, not hosted storage or a paid plan.
 */
export async function processParticipantPhoto({ images, bytes, contentType, blur = false } = {}) {
  const type = imageType(contentType), format = sourceFormats.get(type);
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > maximumSourceBytes) {
    throw fault("Usa una fotografía de hasta 8 MB.", "portal_photo_source_too_large", 413);
  }
  if (!format || !sourceSignature(bytes, type) || typeof blur !== "boolean") {
    throw fault("Usa una fotografía JPEG, PNG o WebP válida.", "portal_photo_source_invalid", 400);
  }
  if (typeof images?.input !== "function" || typeof images?.info !== "function") throw fault();
  return service(async signal => {
    const original = checkedInfo(await images.info(new Response(bytes).body), format);
    if (signal.aborted) throw fault();
    const scale = Math.min(1, maximumEdge / original.width, maximumEdge / original.height);
    const width = Math.max(1, Math.round(original.width * scale));
    const height = Math.max(1, Math.round(original.height * scale));
    const stampWidth = Math.max(48, Math.min(360, Math.round(Math.min(width, height) * 0.7)));
    // Each chain receives a fresh stream. The repeated PNG's translucent text
    // is composited into the pixels before JPEG encoding, including blurred
    // previews, rather than being a removable HTML/CSS overlay.
    let photo = images.input(new Response(bytes).body).transform({ width: maximumEdge, height: maximumEdge,
      fit: "scale-down", metadata: "none", ...(blur ? { blur: 18 } : {}) });
    photo = photo.draw(images.input(new Response(stampBytes).body).transform({ width: stampWidth }),
      { repeat: true, opacity: 1 });
    const output = await photo.output({ format: "image/jpeg", quality: 78, anim: false });
    if (signal.aborted) throw fault();
    const jpeg = await boundedJpeg(await output.response(), signal);
    const preview = checkedInfo(await images.info(new Response(jpeg).body), "jpeg", maximumEdge, maximumEdge * maximumEdge);
    if (signal.aborted) throw fault();
    const prepared = await addPreparedPhotoMarker(jpeg, preview.width, preview.height);
    return validatePreparedParticipantPhoto(prepared);
  });
}
