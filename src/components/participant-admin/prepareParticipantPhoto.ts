import {
  PHOTO_WATERMARK_VERSION,
  addPreparedPhotoMarker,
  validatePreparedParticipantPhoto,
  watermarkStampFontSize,
  watermarkStampPng,
} from '../../../shared/participant-photo-watermark.js';

type DecodedPhoto = {
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

export type PreparedParticipantPhoto = {
  blob: Blob;
  width: number;
  height: number;
  fileName: string;
  watermarkVersion: typeof PHOTO_WATERMARK_VERSION;
};

let stampPromise: Promise<HTMLImageElement> | null = null;

function loadStamp(): Promise<HTMLImageElement> {
  stampPromise ||= new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      stampPromise = null;
      reject(new Error('No pudimos preparar la marca de agua. Intenta cargar la foto de nuevo.'));
    };
    image.src = `data:image/png;base64,${watermarkStampPng}`;
  });
  return stampPromise;
}

async function burnWatermark(context: CanvasRenderingContext2D, width: number, height: number) {
  const stamp = await loadStamp();
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.043));
  const ratio = fontSize / watermarkStampFontSize;
  const stampWidth = Math.max(1, Math.round(stamp.naturalWidth * ratio));
  const stampHeight = Math.max(1, Math.round(stamp.naturalHeight * ratio));
  const stepX = stampWidth + Math.max(24, Math.floor(width / 10));
  const stepY = Math.max(55, Math.floor(height / 4));
  const margin = Math.ceil(Math.max(width, height) / Math.min(stepX, stepY)) + 2;
  const radians = 24 * Math.PI / 180;
  const cosine = Math.cos(radians), sine = Math.sin(radians);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  for (let row = -margin; row <= margin; row++) {
    for (let column = -margin; column <= margin; column++) {
      const x = column * stepX + (Math.abs(row) % 2 ? stepX / 2 : 0);
      const y = row * stepY;
      const left = Math.round(cosine * x + sine * y + width / 2 - stampWidth / 2);
      const top = Math.round(-sine * x + cosine * y + height / 2 - stampHeight / 2);
      if (left >= width || top >= height || left + stampWidth <= 0 || top + stampHeight <= 0) continue;
      context.drawImage(stamp, left, top, stampWidth, stampHeight);
    }
  }
}

async function decodePhoto(file: Blob): Promise<DecodedPhoto> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Older browsers can decode the same photo with their native image element.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('No pudimos abrir esta foto. Usa un archivo JPEG, PNG o WebP válido.'));
      image.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = ''; } };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Burn the watermark into a reduced copy before uploading any image bytes. */
export async function prepareParticipantPhoto(file: Blob, fileName: string): Promise<PreparedParticipantPhoto> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Usa fotos JPEG, PNG o WebP.');
  }
  const normalizedName = `${fileName.replace(/\.[^/.\\]+$/, '').trim() || 'foto'}.jpg`;
  const firstBytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (firstBytes[0] === 0xff && firstBytes[1] === 0xd8 && firstBytes[2] === 0xff && firstBytes[3] === 0xef
    && new TextDecoder().decode(firstBytes.subarray(6)).startsWith('LEVITATE_PREVIEW\n')) {
    const prepared = await validatePreparedParticipantPhoto(new Uint8Array(await file.arrayBuffer()));
    return { blob: new Blob([new Uint8Array(prepared.bytes).buffer], { type: 'image/jpeg' }),
      width: prepared.width, height: prepared.height, fileName: normalizedName, watermarkVersion: PHOTO_WATERMARK_VERSION };
  }
  const decoded = await decodePhoto(file);
  const canvas = document.createElement('canvas');
  try {
    if (!decoded.width || !decoded.height) throw new Error('No pudimos leer las dimensiones de esta foto.');
    let previousDimensions = '';
    for (const maximumEdge of [1600, 1280, 1024]) {
      const scale = Math.min(1, maximumEdge / decoded.width, maximumEdge / decoded.height);
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const dimensions = `${width}x${height}`;
      if (dimensions === previousDimensions) continue;
      previousDimensions = dimensions;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Tu navegador no pudo preparar esta foto. Prueba de nuevo con otro navegador.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      // Each size starts from the original decoded photo, never a marked JPEG.
      context.drawImage(decoded.image, 0, 0, width, height);
      await burnWatermark(context, width, height);
      for (const quality of [0.82, 0.72, 0.62]) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(value => value ? resolve(value) : reject(new Error('No pudimos preparar esta foto. Intenta cargarla de nuevo.')), 'image/jpeg', quality);
        });
        if (blob.size > 1024 * 1024) continue;
        try {
          const prepared = await addPreparedPhotoMarker(new Uint8Array(await blob.arrayBuffer()), width, height);
          return { blob: new Blob([new Uint8Array(prepared).buffer], { type: 'image/jpeg' }), width, height,
            fileName: normalizedName, watermarkVersion: PHOTO_WATERMARK_VERSION };
        } catch (cause) {
          if (!(cause && typeof cause === 'object' && 'code' in cause && cause.code === 'portal_photo_too_large')) throw cause;
        }
      }
    }
    throw new Error('No pudimos reducir esta foto a 1 MB. Intenta con una copia más pequeña.');
  } catch (cause) {
    if (cause instanceof Error && (cause.message.startsWith('No pudimos') || cause.message.startsWith('Tu navegador'))) throw cause;
    throw new Error('No pudimos preparar esta foto. Intenta cargarla de nuevo.');
  } finally {
    decoded.close();
    canvas.width = 1;
    canvas.height = 1;
  }
}
