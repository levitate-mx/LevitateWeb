const legacyPrefix = "google_drive:";
const photoPrefix = "google_drive_photo:";
const fileIdPattern = /^[A-Za-z0-9_-]{10,200}$/;

function fault(message = "No pudimos acceder al almacenamiento privado de Mi Levitate.", code = "portal_storage_unavailable", statusCode = 503) {
  return Object.assign(new Error(message), { code, statusCode });
}
function keyParts(objectKey) {
  if (typeof objectKey !== "string") throw fault("El archivo no está disponible.", "portal_asset_not_found", 404);
  const photo = objectKey.startsWith(photoPrefix);
  const prefix = photo ? photoPrefix : legacyPrefix;
  if (!objectKey.startsWith(prefix) || !fileIdPattern.test(objectKey.slice(prefix.length))) {
    throw fault("El archivo no está disponible.", "portal_asset_not_found", 404);
  }
  return { photo, internalKey: `${legacyPrefix}${objectKey.slice(prefix.length)}` };
}
function photoResult(result) {
  const { photo, internalKey } = keyParts(result?.objectKey);
  if (photo) throw fault();
  return { ...result, objectKey: `${photoPrefix}${internalKey.slice(legacyPrefix.length)}` };
}

/** Route only new JPEG writes to the separately authorized photo Drive.
 * Old keys and every PDF continue to use the unchanged legacy connection.
 * Both factories are lazy and memoized; an unavailable photo account never
 * prevents the router from reading a historical file or writing a PDF.
 */
export async function getParticipantMediaStorageRouter({ getLegacyStore, getPhotoStore, photoConfigured = false } = {}) {
  let legacyPromise, photoPromise;
  const resolveStore = async factory => {
    if (typeof factory !== "function") throw fault();
    const storage = await factory();
    if (storage?.info?.provider !== "google_drive") throw fault();
    return storage;
  };
  const legacy = () => legacyPromise ||= resolveStore(getLegacyStore);
  const photos = () => {
    if (!photoConfigured) throw fault("La conexión independiente de fotografías no está configurada.", "portal_photo_drive_not_configured");
    return photoPromise ||= resolveStore(getPhotoStore);
  };
  const photoTarget = () => photoConfigured ? photos() : legacy();
  const invoke = async (store, method, ...args) => {
    const storage = await store;
    if (typeof storage[method] !== "function") throw fault();
    return storage[method](...args);
  };
  const router = {
    // Call getInfo() for a verified status. This placeholder declares only the
    // adapter protocol and cannot claim a staged connection is ready.
    info: { provider: "google_drive", ready: false },
    async getInfo() {
      const storage = await photoTarget();
      const info = { provider: "google_drive", ready: storage.info.ready === true };
      for (const key of ["accountEmail", "folderId", "folderName"]) {
        if (typeof storage.info[key] === "string") info[key] = storage.info[key];
      }
      router.info = info;
      return info;
    },
    async put(storageKey, bytes, options = {}) {
      const type = options?.httpMetadata?.contentType;
      if (!["image/jpeg", "application/pdf"].includes(type)) {
        throw fault("Usa una vista JPEG preparada o un documento PDF.", "portal_invalid_asset_type", 400);
      }
      if (type === "image/jpeg" && photoConfigured) {
        return photoResult(await invoke(photos(), "put", storageKey, bytes, options));
      }
      return invoke(legacy(), "put", storageKey, bytes, options);
    },
    async get(objectKey, ...args) {
      const { photo, internalKey } = keyParts(objectKey);
      return invoke(photo ? photos() : legacy(), "get", internalKey, ...args);
    },
    async delete(objectKey) {
      const { photo, internalKey } = keyParts(objectKey);
      return invoke(photo ? photos() : legacy(), "delete", internalKey);
    },
    async getByStorageKey(storageKey) {
      return invoke(photoTarget(), "getByStorageKey", storageKey);
    },
    async prepareDemoAlbum(input) {
      return invoke(photoTarget(), "prepareDemoAlbum", input);
    },
  };
  return router;
}
