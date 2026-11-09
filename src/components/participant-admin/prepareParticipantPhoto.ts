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
};

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

/** Resize camera originals before upload; the server applies the watermark. */
export async function prepareParticipantPhoto(file: Blob, fileName: string): Promise<PreparedParticipantPhoto> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Usa fotos JPEG, PNG o WebP.');
  }
  const decoded = await decodePhoto(file);
  const canvas = document.createElement('canvas');
  try {
    if (!decoded.width || !decoded.height) throw new Error('No pudimos leer las dimensiones de esta foto.');
    const scale = Math.min(1, 1600 / decoded.width, 1600 / decoded.height);
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Tu navegador no pudo preparar esta foto. Prueba de nuevo con otro navegador.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('No pudimos preparar esta foto. Intenta cargarla de nuevo.')), 'image/jpeg', 0.82);
    });
    if (blob.size > 2 * 1024 * 1024) throw new Error('No pudimos reducir esta foto a 2 MB. Intenta con una copia más pequeña.');
    return { blob, width, height, fileName: `${fileName.replace(/\.[^/.\\]+$/, '').trim() || 'foto'}.jpg` };
  } catch (cause) {
    if (cause instanceof Error && (cause.message.startsWith('No pudimos') || cause.message.startsWith('Tu navegador'))) throw cause;
    throw new Error('No pudimos preparar esta foto. Intenta cargarla de nuevo.');
  } finally {
    decoded.close();
    canvas.width = 1;
    canvas.height = 1;
  }
}
