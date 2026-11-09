export const PHOTO_WATERMARK_VERSION: "levitate-preview-v2";
export const watermarkStampPng: string;
export const watermarkStampFontSize: number;

export interface PreparedParticipantPhotoBytes {
  bytes: Uint8Array;
  width: number;
  height: number;
  contentType: "image/jpeg";
  watermarkVersion: typeof PHOTO_WATERMARK_VERSION;
  sha256: string;
}

export function addPreparedPhotoMarker(bytes: Uint8Array, width: number, height: number): Promise<Uint8Array>;
export function validatePreparedParticipantPhoto(bytes: Uint8Array): Promise<PreparedParticipantPhotoBytes>;
