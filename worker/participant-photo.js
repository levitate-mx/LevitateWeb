import { watermarkStampPng, watermarkStampFontSize } from "./participant-photo/watermark-stamp.js";

export const PHOTO_WATERMARK_VERSION = "levitate-preview-v1";
const maxPixels = 1600 * 1600;
const maxBytes = 2 * 1024 * 1024;
const maxEdge = 1600;
let photonPromise;
let stampPixels;

function invalid(message = "No pudimos leer la foto. Usa un archivo JPEG, PNG o WebP válido.", code = "portal_invalid_photo", statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw invalid();
  if (width * height > maxPixels || width > 20000 || height > 20000) {
    throw invalid("Reduce la foto a un máximo de 1600 píxeles por lado antes de cargarla.", "portal_photo_too_large", 413);
  }
  return { width, height };
}

function exifOrientation(bytes, start, end) {
  if (end - start < 6 || String.fromCharCode(...bytes.subarray(start, start + 6)) !== "Exif\0\0") return 1;
  const tiff = start + 6;
  const view = new DataView(bytes.buffer, bytes.byteOffset + tiff, end - tiff);
  if (view.byteLength < 8) throw invalid();
  const order = view.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) throw invalid();
  const little = order === 0x4949;
  if (view.getUint16(2, little) !== 42) throw invalid();
  const offset = view.getUint32(4, little);
  if (offset < 8 || offset + 2 > view.byteLength) throw invalid();
  const count = view.getUint16(offset, little);
  if (offset + 2 + count * 12 > view.byteLength) throw invalid();
  for (let index = 0; index < count; index++) {
    const entry = offset + 2 + index * 12;
    if (view.getUint16(entry, little) !== 0x0112) continue;
    if (view.getUint16(entry + 2, little) !== 3 || view.getUint32(entry + 4, little) !== 1) throw invalid();
    const orientation = view.getUint16(entry + 8, little);
    if (orientation < 1 || orientation > 8) throw invalid();
    return orientation;
  }
  return 1;
}

// Bound decoded allocations before invoking WASM. Compressed byte limits alone
// do not protect a Worker from a very large, highly compressible image.
function readHeader(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) throw invalid();
  if (bytes.length > maxBytes) throw invalid("La vista previa debe pesar hasta 2 MB.", "portal_photo_too_large", 413);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset, count) => String.fromCharCode(...bytes.subarray(offset, offset + count));
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) {
    if (bytes.length < 33 || view.getUint32(8) !== 13 || ascii(12, 4) !== "IHDR") throw invalid();
    return dimensions(view.getUint32(16), view.getUint32(20));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let position = 2;
    let found;
    let orientation = 1;
    while (position < bytes.length) {
      if (bytes[position++] !== 0xff) throw invalid();
      while (position < bytes.length && bytes[position] === 0xff) position++;
      if (position >= bytes.length) throw invalid();
      const marker = bytes[position++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (position + 2 > bytes.length) throw invalid();
      const length = view.getUint16(position);
      const end = position + length;
      if (length < 2 || end > bytes.length) throw invalid();
      if (marker === 0xe1) {
        const value = exifOrientation(bytes, position + 2, end);
        if (value !== 1) orientation = value;
      }
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (length < 8) throw invalid();
        const current = dimensions(view.getUint16(position + 5), view.getUint16(position + 3));
        if (found && (found.width !== current.width || found.height !== current.height)) throw invalid();
        found = current;
      }
      position = end;
    }
    if (!found) throw invalid();
    if (orientation !== 1) {
      throw invalid("Prepara la orientación de la foto antes de cargarla.", "portal_photo_orientation");
    }
    return found;
  }
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const fileEnd = view.getUint32(4, true) + 8;
    if (fileEnd !== bytes.length) throw invalid();
    let position = 12;
    let found;
    let frame;
    while (position + 8 <= fileEnd) {
      const kind = ascii(position, 4);
      const length = view.getUint32(position + 4, true);
      const start = position + 8;
      const end = start + length;
      if (end > fileEnd) throw invalid();
      if (kind === "VP8X") {
        if (length !== 10 || (bytes[start] & 0x02)) throw invalid("Usa una fotografía estática JPEG, PNG o WebP.");
        found = dimensions(1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16),
          1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16));
      } else if (kind === "VP8 ") {
        if (length < 10 || bytes[start] & 1 || ascii(start + 3, 3) !== "\x9d\x01\x2a") throw invalid();
        frame = dimensions(view.getUint16(start + 6, true) & 0x3fff, view.getUint16(start + 8, true) & 0x3fff);
      } else if (kind === "VP8L") {
        if (length < 5 || bytes[start] !== 0x2f) throw invalid();
        const bits = view.getUint32(start + 1, true);
        frame = dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      }
      position = end + (length & 1);
    }
    if (position !== fileEnd || !frame || (found && (found.width !== frame.width || found.height !== frame.height))) throw invalid();
    return found || frame;
  }
  throw invalid();
}

function photon() {
  photonPromise ||= import("@cf-wasm/photon").catch(() => {
    photonPromise = null;
    throw invalid("No pudimos preparar la foto. Intenta nuevamente.", "portal_photo_processing_unavailable", 503);
  });
  return photonPromise;
}

function scaledStamp(library, fontSize) {
  let image;
  let scaled;
  try {
    if (!stampPixels) {
      image = library.PhotonImage.new_from_byteslice(Uint8Array.from(atob(watermarkStampPng), character => character.charCodeAt(0)));
      stampPixels = { pixels: image.get_raw_pixels(), width: image.get_width(), height: image.get_height() };
      image.free();
      image = null;
    }
    const ratio = fontSize / watermarkStampFontSize;
    const width = Math.max(1, Math.round(stampPixels.width * ratio));
    const height = Math.max(1, Math.round(stampPixels.height * ratio));
    if (width === stampPixels.width && height === stampPixels.height) return stampPixels;
    image = new library.PhotonImage(stampPixels.pixels, stampPixels.width, stampPixels.height);
    scaled = library.resize(image, width, height, library.SamplingFilter.Lanczos3);
    return { pixels: scaled.get_raw_pixels(), width, height };
  } finally {
    scaled?.free();
    image?.free();
  }
}

function burnWatermark(pixels, width, height, stamp) {
  // JPEG previews have an opaque white background, including PNG/WebP inputs
  // with transparency. All stamps are composited into these final pixels.
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const alpha = pixels[offset + 3];
    if (alpha !== 255) for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round((pixels[offset + channel] * alpha + 255 * (255 - alpha)) / 255);
    pixels[offset + 3] = 255;
  }
  const radians = 24 * Math.PI / 180;
  const cosine = Math.cos(radians), sine = Math.sin(radians);
  const stepX = stamp.width + Math.max(24, Math.floor(width / 10));
  const stepY = Math.max(55, Math.floor(height / 4));
  const margin = Math.ceil(Math.max(width, height) / Math.min(stepX, stepY)) + 2;
  for (let row = -margin; row <= margin; row++) {
    for (let column = -margin; column <= margin; column++) {
      const x = column * stepX + (Math.abs(row) % 2 ? stepX / 2 : 0);
      const y = row * stepY;
      const left = Math.round(cosine * x + sine * y + width / 2 - stamp.width / 2);
      const top = Math.round(-sine * x + cosine * y + height / 2 - stamp.height / 2);
      const startX = Math.max(0, left), endX = Math.min(width, left + stamp.width);
      const startY = Math.max(0, top), endY = Math.min(height, top + stamp.height);
      if (startX >= endX || startY >= endY) continue;
      for (let yy = startY; yy < endY; yy++) {
        for (let xx = startX; xx < endX; xx++) {
          const source = ((yy - top) * stamp.width + xx - left) * 4;
          const alpha = stamp.pixels[source + 3];
          if (!alpha) continue;
          const destination = (yy * width + xx) * 4;
          for (let channel = 0; channel < 3; channel++) {
            pixels[destination + channel] = Math.round((stamp.pixels[source + channel] * alpha + pixels[destination + channel] * (255 - alpha)) / 255);
          }
        }
      }
    }
  }
}

export async function prepareParticipantPhoto(bytes) {
  const expected = readHeader(bytes);
  const library = await photon();
  let image;
  let resized;
  let encoded;
  try {
    image = library.PhotonImage.new_from_byteslice(bytes);
    if (image.get_width() !== expected.width || image.get_height() !== expected.height) throw invalid();
    const ratio = Math.min(1, maxEdge / Math.max(expected.width, expected.height));
    const width = Math.max(1, Math.round(expected.width * ratio));
    const height = Math.max(1, Math.round(expected.height * ratio));
    if (ratio < 1) {
      resized = library.resize(image, width, height, library.SamplingFilter.Lanczos3);
      image.free();
      image = null;
    }
    const working = resized || image;
    const pixels = working.get_raw_pixels();
    working.free();
    image = null;
    resized = null;
    const stamp = scaledStamp(library, Math.max(14, Math.round(Math.min(width, height) * 0.043)));
    burnWatermark(pixels, width, height, stamp);
    encoded = new library.PhotonImage(pixels, width, height);
    return { bytes: encoded.get_bytes_jpeg(82), width, height, contentType: "image/jpeg", watermarkVersion: PHOTO_WATERMARK_VERSION };
  } catch (error) {
    if (error?.code) throw error;
    throw invalid();
  } finally {
    encoded?.free();
    resized?.free();
    image?.free();
  }
}
