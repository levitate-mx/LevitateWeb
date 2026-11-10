import { createHash } from "node:crypto";
import { PHOTO_WATERMARK_VERSION } from "../shared/participant-photo-watermark.js";
import { participantDemoMediaDefinitions } from "../shared/participant-demo-media.js";

const apiBase = "https://www.googleapis.com/drive/v3";
const uploadBase = "https://www.googleapis.com/upload/drive/v3/files";
const folderMime = "application/vnd.google-apps.folder";
const markerKey = "levitateParticipantStorage";
const markerValue = "participant_previews_v1";
const keyProperty = "levitateStorageKey";
const hashProperty = "levitateSha256";
const md5Property = "levitateMd5";
const watermarkVersion = PHOTO_WATERMARK_VERSION;
const folderName = "Mi Levitate · Vistas previas privadas";
const idPattern = /^[A-Za-z0-9_-]{10,200}$/;
const aboutFields = "user(emailAddress),storageQuota(limit,usage)";
const metadataFields = "id,name,mimeType,size,trashed,parents,owners(emailAddress),permissions(type,role,emailAddress,domain),shared,driveId,appProperties,md5Checksum,sha256Checksum,capabilities(canDownload,canAddChildren)";
const encoder = new TextEncoder();
const albumMarkerKey = "levitatePhotoAlbum";
const albumRootMarker = "demo_root_v1";
const albumMarker = "demo_album_v1";
const albumPhotoMarker = "demo_photo_v1";
const albumRootName = "Mi Levitate · Fotos por coreografía";

function fault(message = "No pudimos acceder al almacenamiento privado de Mi Levitate.", code = "portal_storage_unavailable", statusCode = 503) {
  return Object.assign(new Error(message), { code, statusCode });
}
function identifier(value) {
  if (typeof value !== "string" || !idPattern.test(value)) throw fault();
  return value;
}
function fileId(objectKey) {
  if (typeof objectKey !== "string" || !objectKey.startsWith("google_drive:")) throw fault("El archivo no está disponible.", "portal_asset_not_found", 404);
  try { return identifier(objectKey.slice("google_drive:".length)); }
  catch { throw fault("El archivo no está disponible.", "portal_asset_not_found", 404); }
}
function email(value) { return typeof value === "string" ? value.trim().toLowerCase() : ""; }
function integerBytes(value) {
  return typeof value === "string" && /^\d{1,20}$/.test(value) ? BigInt(value) : null;
}
function limitFor(type) {
  if (type === "image/jpeg") return 1024 * 1024;
  if (type === "application/pdf") return 8 * 1024 * 1024;
  throw fault("Usa una vista JPEG preparada o un documento PDF.", "portal_invalid_asset_type", 400);
}
async function sha256(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function ownFile(metadata, ownerEmail, expectedMarkerKey = markerKey, expectedMarkerValue = markerValue) {
  if (!metadata || metadata.trashed !== false || metadata.driveId || metadata.appProperties?.[expectedMarkerKey] !== expectedMarkerValue
    || !Array.isArray(metadata.owners) || metadata.owners.length !== 1 || email(metadata.owners[0]?.emailAddress) !== ownerEmail) throw fault();
}
function privateFile(metadata, ownerEmail, expectedMarkerKey = markerKey, expectedMarkerValue = markerValue) {
  ownFile(metadata, ownerEmail, expectedMarkerKey, expectedMarkerValue);
  if (metadata.shared === true || !Array.isArray(metadata.permissions) || !metadata.permissions.length
    || metadata.permissions.some(permission => permission.type !== "user" || permission.role !== "owner"
      || email(permission.emailAddress) !== ownerEmail || permission.domain)) throw fault("La carpeta y sus archivos deben permanecer privados en Drive.", "portal_storage_not_private");
}

/** Private Drive storage using the web's existing authorization. The caller
 * authenticates the admin/participant before creating this request-scoped store.
 * Folder identity lives in appProperties, independently of photo_video/music.
 */
export async function getParticipantDriveStorage({
  db: _db, getConfig, getAccessToken, expectedEmail, create = false, fetchImpl = fetch, timeoutMs = 8000, streamTimeoutMs = 60000,
} = {}) {
  const ownerEmail = email(expectedEmail);
  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)
    || typeof getConfig !== "function" || typeof getAccessToken !== "function") throw fault();
  const duration = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(15000, Math.floor(timeoutMs))) : 8000;
  const streamDuration = Number.isFinite(streamTimeoutMs) ? Math.max(1, Math.min(120000, Math.floor(streamTimeoutMs))) : 60000;
  let config;
  try { config = await getConfig(); } catch { throw fault(); }
  if (!config) throw fault();
  let tokenPromise;
  const createdFiles = new Set();
  const timebox = async (operation) => {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([operation(controller.signal), new Promise((resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(fault("Drive tardó demasiado en responder. Intenta nuevamente.")); }, duration);
      })]);
    } catch (error) {
      if (error?.code?.startsWith("portal_")) throw error;
      throw fault();
    } finally { clearTimeout(timer); }
  };
  const accessToken = () => {
    tokenPromise ||= timebox(async signal => {
      const value = await getAccessToken(config, { signal });
      if (typeof value !== "string" || !value.trim()) throw fault();
      return value;
    });
    return tokenPromise;
  };
  const requestJson = async (path, { method = "GET", body, query = {} } = {}) => {
    const token = await accessToken();
    const url = new URL(`${apiBase}/${path}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    return timebox(async signal => {
      const response = await fetchImpl(url.toString(), { method, redirect: "manual", signal,
        headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(body ? { "content-type": "application/json; charset=utf-8" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw fault();
      const value = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) throw fault();
      return value;
    });
  };
  const about = async () => {
    const value = await requestJson("about", { query: { fields: aboutFields } });
    if (email(value.user?.emailAddress) !== ownerEmail) throw fault("La conexión debe pertenecer a la cuenta de Levitate configurada.", "portal_storage_wrong_account");
    return value;
  };
  const requireSpace = (value, bytes) => {
    const limit = integerBytes(value.storageQuota?.limit), usage = integerBytes(value.storageQuota?.usage);
    // A missing limit may mean unlimited, but it cannot prove the bounded
    // capacity requested for this deployment. Never assume missing quota is zero.
    if (limit === null || usage === null) throw fault("No pudimos verificar el espacio disponible en Drive.", "portal_storage_quota_unknown");
    if (usage + BigInt(bytes) > limit) throw fault("No queda espacio suficiente en Drive. Libera espacio antes de cargar más archivos.", "portal_storage_quota_exceeded", 507);
  };
  const metadata = id => requestJson(`files/${identifier(id)}`, { query: { fields: metadataFields, supportsAllDrives: "true" } });
  const listIds = async q => {
    const value = await requestJson("files", { query: { q, spaces: "drive", pageSize: "2", fields: "nextPageToken,files(id)" } });
    if (!Array.isArray(value.files) || value.files.length > 1 || value.nextPageToken) throw fault("Hay más de una carpeta o archivo de vistas con la misma identificación. Revisa la configuración.", "portal_storage_conflict", 409);
    return value.files.map(file => identifier(file.id));
  };

  const initialAbout = await about(); // Verify the account before any write.
  if (create) requireSpace(initialAbout, 1);
  const folders = await listIds(`'root' in parents and 'me' in owners and trashed = false and mimeType = '${folderMime}' and appProperties has { key='${markerKey}' and value='${markerValue}' }`);
  let folderId = folders[0];
  if (!folderId) {
    if (!create) throw fault("Prepara primero el almacenamiento privado desde administración.");
    const folder = await requestJson("files", { method: "POST", query: { fields: "id" }, body: {
      name: folderName, mimeType: folderMime, appProperties: { [markerKey]: markerValue },
      // No parent: Google places this new, owner-only folder in My Drive root.
    } });
    folderId = identifier(folder.id);
  }
  const folder = await metadata(folderId);
  privateFile(folder, ownerEmail);
  if (folder.id !== folderId || folder.mimeType !== folderMime || typeof folder.name !== "string" || !folder.name.trim()) throw fault();
  if (create && folder.capabilities?.canAddChildren !== true) throw fault("La carpeta privada no permite cargar archivos.");

  const verifyStoredFile = (value) => {
    privateFile(value, ownerEmail);
    if (!Array.isArray(value.parents) || value.parents.length !== 1 || value.parents[0] !== folderId
      || value.capabilities?.canDownload !== true || !/^[a-f0-9]{64}$/.test(value.appProperties?.[keyProperty] || "")
      || !/^[a-f0-9]{64}$/.test(value.appProperties?.[hashProperty] || "")
      || !/^[a-f0-9]{32}$/.test(value.appProperties?.[md5Property] || "")
      || value.md5Checksum !== value.appProperties[md5Property]
      || (value.sha256Checksum != null && value.sha256Checksum !== value.appProperties[hashProperty])) throw fault();
    if (!["image/jpeg", "application/pdf"].includes(value.mimeType)) throw fault();
    const maxBytes = limitFor(value.mimeType), size = integerBytes(value.size);
    if (size === null || size < 1 || size > BigInt(maxBytes)) throw fault();
    if (value.mimeType === "image/jpeg" && value.appProperties.watermarkVersion !== watermarkVersion) throw fault();
    return Number(size);
  };
  const matches = (value, keyHash, hash, md5, bytes, type) => {
    const size = verifyStoredFile(value);
    if (value.appProperties[keyProperty] !== keyHash || value.appProperties[hashProperty] !== hash
      || value.appProperties[md5Property] !== md5 || size !== bytes || value.mimeType !== type) {
      throw fault("La identificación de carga ya corresponde a otro archivo.", "portal_upload_conflict", 409);
    }
  };
  const put = async (storageKey, bytes, { httpMetadata = {}, customMetadata = {}, verifiedSha256 } = {}) => {
    if (folder.capabilities?.canAddChildren !== true) throw fault("La carpeta privada no permite cargar archivos.");
    const type = httpMetadata.contentType;
    const maxBytes = limitFor(type);
    if (typeof storageKey !== "string" || !storageKey.trim() || storageKey.length > 2048 || /[\u0000-\u001f\u007f]/.test(storageKey)
      || !(bytes instanceof Uint8Array) || !bytes.length || bytes.length > maxBytes) throw fault("El archivo supera el tamaño permitido o no es válido.", "portal_invalid_asset", 400);
    if (type === "image/jpeg" && customMetadata.watermarkVersion !== watermarkVersion) throw fault("Prepara la foto con la marca de agua antes de cargarla.", "portal_invalid_asset", 400);
    // This option is internal: only a digest already computed from these bytes
    // by the server validator may be reused. Never forward a client's claim.
    if (verifiedSha256 !== undefined && (typeof verifiedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(verifiedSha256))) {
      throw fault("No pudimos validar el archivo preparado.", "portal_invalid_asset", 400);
    }
    const keyHash = await sha256(storageKey), hash = verifiedSha256 ?? await sha256(bytes);
    const md5 = createHash("md5").update(bytes).digest("hex");
    const prior = await listIds(`'${folderId}' in parents and trashed = false and appProperties has { key='${markerKey}' and value='${markerValue}' } and appProperties has { key='${keyProperty}' and value='${keyHash}' }`);
    if (prior.length) {
      matches(await metadata(prior[0]), keyHash, hash, md5, bytes.length, type);
      return { objectKey: `google_drive:${prior[0]}` };
    }
    requireSpace(await about(), bytes.length);
    const generated = await requestJson("files/generateIds", { query: { count: "1", space: "drive", type: "files" } });
    if (!Array.isArray(generated.ids) || generated.ids.length !== 1) throw fault();
    const id = identifier(generated.ids[0]);
    const token = await accessToken();
    const properties = { [markerKey]: markerValue, [keyProperty]: keyHash, [hashProperty]: hash, [md5Property]: md5,
      ...(type === "image/jpeg" ? { watermarkVersion } : {}) };
    const uploaded = await timebox(async signal => {
      const url = new URL(uploadBase);
      url.searchParams.set("uploadType", "resumable"); url.searchParams.set("fields", "id");
      const start = await fetchImpl(url.toString(), { method: "POST", redirect: "manual", signal,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8",
          "x-upload-content-length": String(bytes.length), "x-upload-content-type": type },
        body: JSON.stringify({ id, name: `lv-${keyHash.slice(0, 32)}.${type === "application/pdf" ? "pdf" : "jpg"}`,
          mimeType: type, parents: [folderId], appProperties: properties }) });
      if (!start.ok) throw fault();
      let location;
      try { location = new URL(start.headers.get("location")); } catch { throw fault(); }
      if (location.origin !== "https://www.googleapis.com" || location.pathname !== "/upload/drive/v3/files"
        || location.username || location.password || location.hash) throw fault();
      const response = await fetchImpl(location.toString(), { method: "PUT", redirect: "manual", signal,
        headers: { "content-type": type }, body: bytes });
      if (!response.ok) throw fault();
      const value = await response.json();
      if (value?.id !== id) throw fault();
      return value;
    });
    const result = await metadata(uploaded.id);
    matches(result, keyHash, hash, md5, bytes.length, type);
    createdFiles.add(id);
    return { objectKey: `google_drive:${id}` };
  };
  const get = async (objectKey, expectedStorageKeyHash) => {
    const id = fileId(objectKey);
    const value = await metadata(id);
    const size = verifyStoredFile(value);
    if (value.id !== id) throw fault();
    if (expectedStorageKeyHash !== undefined && value.appProperties[keyProperty] !== expectedStorageKeyHash) throw fault();
    const token = await accessToken();
    const controller = new AbortController();
    let timer;
    let rejectTimeout;
    const expire = () => { controller.abort(); rejectTimeout(fault("Drive tardó demasiado en responder. Intenta nuevamente.")); };
    const timeout = new Promise((resolve, reject) => {
      rejectTimeout = reject;
      timer = setTimeout(expire, duration);
    });
    let reader;
    try {
      const url = new URL(`${apiBase}/files/${id}`); url.searchParams.set("alt", "media");
      const response = await Promise.race([fetchImpl(url.toString(), { method: "GET", redirect: "manual", signal: controller.signal,
        headers: { authorization: `Bearer ${token}` } }), timeout]);
      const length = response.headers.get("content-length");
      if (!response.ok || !response.body || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== value.mimeType
        || (length !== null && (!/^\d+$/.test(length) || Number(length) !== size))) throw fault();
      reader = response.body.getReader();
      // Header requests stay short; the marked file can stream for longer on
      // a mobile connection without any image work or extra memory allocation.
      clearTimeout(timer); timer = setTimeout(expire, streamDuration);
    } catch (error) {
      clearTimeout(timer); controller.abort();
      if (error?.code?.startsWith("portal_")) throw error;
      throw fault();
    }
    let received = 0;
    const close = () => { clearTimeout(timer); };
    const body = new ReadableStream({
      async pull(output) {
        try {
          const { value: chunk, done } = await Promise.race([reader.read(), timeout]);
          if (done) {
            close();
            if (received !== size) throw fault();
            output.close(); return;
          }
          received += chunk.byteLength;
          if (received > size) throw fault();
          output.enqueue(chunk);
        } catch {
          close(); controller.abort();
          await reader.cancel().catch(() => {});
          output.error(fault());
        }
      },
      async cancel() { close(); controller.abort(); await reader.cancel().catch(() => {}); },
    });
    return { body, size, customMetadata: { watermarkVersion: value.appProperties.watermarkVersion || "" },
      httpMetadata: { contentType: value.mimeType } };
  };
  const getByStorageKey = async (storageKey) => {
    if (typeof storageKey !== "string" || !storageKey.trim() || storageKey.length > 2048 || /[\u0000-\u001f\u007f]/.test(storageKey)) {
      throw fault("La identificación del archivo no es válida.", "portal_invalid_asset", 400);
    }
    const keyHash = await sha256(storageKey);
    const matches = await listIds(`'${folderId}' in parents and trashed = false and appProperties has { key='${markerKey}' and value='${markerValue}' } and appProperties has { key='${keyProperty}' and value='${keyHash}' }`);
    return matches.length ? get(`google_drive:${matches[0]}`, keyHash) : null;
  };
  const remove = async (objectKey) => {
    const id = fileId(objectKey);
    // Only the request that created a new file may roll it back. A deduplicated
    // or historical file can already belong to a committed D1 asset.
    if (!createdFiles.has(id)) return false;
    const value = await metadata(id);
    verifyStoredFile(value);
    if (value.id !== id) throw fault();
    const result = await requestJson(`files/${id}`, { method: "PATCH", query: { fields: "id,trashed" }, body: { trashed: true } });
    if (result.id !== id || result.trashed !== true) throw fault();
    createdFiles.delete(id);
    return true;
  };
  /** A deliberately limited admin trial: copy only the two archival demo
   * snapshots to a human-readable source album, then read them back from Drive.
   * It does not watch folders, accept Drive IDs, publish content or touch the
   * independently managed preview/music/originals folders.
   */
  const prepareDemoAlbum = async ({ eventId, danceId, folderName: requestedName, photos } = {}) => {
    if (![eventId, danceId].every(value => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value))
      || typeof requestedName !== "string" || !requestedName.trim() || requestedName.trim().length > 220
      || /[\u0000-\u001f\u007f]/.test(requestedName)
      || !Array.isArray(photos) || photos.length !== participantDemoMediaDefinitions.length) {
      throw fault("Revisa los datos del álbum de demostración.", "portal_demo_album_invalid", 400);
    }
    const normalizedPhotos = [];
    for (const expected of participantDemoMediaDefinitions) {
      const matching = photos.filter(photo => photo?.slot === expected.slot);
      const photo = matching[0];
      if (matching.length !== 1 || !(photo.bytes instanceof Uint8Array) || photo.bytes.length !== expected.byteSize
        || photo.bytes.length > limitFor("image/jpeg") || photo.sha256 !== expected.sha256
        || photo.width !== expected.width || photo.height !== expected.height || await sha256(photo.bytes) !== expected.sha256) {
        throw fault("Usa únicamente las dos fotos preparadas de demostración.", "portal_demo_album_invalid", 400);
      }
      normalizedPhotos.push({ ...expected, bytes: photo.bytes, md5: createHash("md5").update(photo.bytes).digest("hex") });
    }
    const name = /\bDEMO\b/i.test(requestedName) ? requestedName.trim() : `${requestedName.trim()} · DEMO`;
    const albumMetadata = id => requestJson(`files/${identifier(id)}`, {
      query: { fields: `${metadataFields},webViewLink`, supportsAllDrives: "true" },
    });
    const scopedProperties = { levitateEventId: eventId, levitateDanceId: danceId, demo: "true" };
    const markerQuery = value => `appProperties has { key='${albumMarkerKey}' and value='${value}' }`;
    const scopeQuery = Object.entries(scopedProperties).map(([key, value]) => `appProperties has { key='${key}' and value='${value}' }`).join(" and ");
    const validateFolder = (value, id, kind, parentId) => {
      privateFile(value, ownerEmail, albumMarkerKey, kind);
      if (value.id !== id || value.mimeType !== folderMime || typeof value.name !== "string" || !value.name.trim()
        || value.name.length > 300 || /[\u0000-\u001f\u007f]/.test(value.name)
        || value.capabilities?.canAddChildren !== true || value.appProperties.demo !== "true"
        || (parentId && (!Array.isArray(value.parents) || value.parents.length !== 1 || value.parents[0] !== parentId))
        || (kind === albumMarker && Object.entries(scopedProperties).some(([key, expected]) => value.appProperties[key] !== expected))) throw fault();
      return value;
    };
    const createFolder = async (folderLabel, properties, parentId) => {
      requireSpace(await about(), 1);
      const created = await requestJson("files", { method: "POST", query: { fields: "id" }, body: {
        name: folderLabel, mimeType: folderMime, appProperties: properties, ...(parentId ? { parents: [parentId] } : {}),
      } });
      return identifier(created.id);
    };
    const roots = await listIds(`'root' in parents and 'me' in owners and trashed = false and mimeType = '${folderMime}' and ${markerQuery(albumRootMarker)}`);
    const sourceRootId = roots[0] || await createFolder(albumRootName, { [albumMarkerKey]: albumRootMarker, demo: "true" });
    validateFolder(await albumMetadata(sourceRootId), sourceRootId, albumRootMarker);
    if (sourceRootId === folderId) throw fault();
    const albums = await listIds(`'${sourceRootId}' in parents and 'me' in owners and trashed = false and mimeType = '${folderMime}' and ${markerQuery(albumMarker)} and ${scopeQuery}`);
    const albumId = albums[0] || await createFolder(name, { [albumMarkerKey]: albumMarker, ...scopedProperties }, sourceRootId);
    let album = validateFolder(await albumMetadata(albumId), albumId, albumMarker, sourceRootId);
    if (albumId === folderId || albumId === sourceRootId) throw fault();

    const validatePhoto = (value, id, expected) => {
      privateFile(value, ownerEmail, albumMarkerKey, albumPhotoMarker);
      if (value.id !== id || value.mimeType !== "image/jpeg" || value.size !== String(expected.byteSize)
        || !Array.isArray(value.parents) || value.parents.length !== 1 || value.parents[0] !== albumId
        || value.capabilities?.canDownload !== true || value.md5Checksum !== expected.md5
        || (value.sha256Checksum != null && value.sha256Checksum !== expected.sha256)
        || value.appProperties[hashProperty] !== expected.sha256 || value.appProperties[md5Property] !== expected.md5
        || value.appProperties.watermarkVersion !== watermarkVersion || value.appProperties.slot !== expected.slot
        || Object.entries(scopedProperties).some(([key, expectedValue]) => value.appProperties[key] !== expectedValue)) throw fault();
    };
    const verifiedPhotos = [];
    for (const photo of normalizedPhotos) {
      const matches = await listIds(`'${albumId}' in parents and 'me' in owners and trashed = false and ${markerQuery(albumPhotoMarker)} and ${scopeQuery} and appProperties has { key='slot' and value='${photo.slot}' }`);
      let photoId = matches[0];
      if (!photoId) {
        requireSpace(await about(), photo.byteSize);
        const generated = await requestJson("files/generateIds", { query: { count: "1", space: "drive", type: "files" } });
        if (!Array.isArray(generated.ids) || generated.ids.length !== 1) throw fault();
        photoId = identifier(generated.ids[0]);
        const token = await accessToken();
        await timebox(async signal => {
          const url = new URL(uploadBase);
          url.searchParams.set("uploadType", "resumable"); url.searchParams.set("fields", "id");
          const start = await fetchImpl(url.toString(), { method: "POST", redirect: "manual", signal,
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json; charset=utf-8",
              "x-upload-content-length": String(photo.byteSize), "x-upload-content-type": "image/jpeg" },
            body: JSON.stringify({ id: photoId, name: `DEMO-${photo.slot}.jpg`, mimeType: "image/jpeg", parents: [albumId],
              appProperties: { [albumMarkerKey]: albumPhotoMarker, ...scopedProperties, slot: photo.slot,
                [hashProperty]: photo.sha256, [md5Property]: photo.md5, watermarkVersion } }) });
          if (!start.ok) throw fault();
          let uploadUrl;
          try { uploadUrl = new URL(start.headers.get("location")); } catch { throw fault(); }
          if (uploadUrl.origin !== "https://www.googleapis.com" || uploadUrl.pathname !== "/upload/drive/v3/files"
            || uploadUrl.username || uploadUrl.password || uploadUrl.hash) throw fault();
          const response = await fetchImpl(uploadUrl.toString(), { method: "PUT", redirect: "manual", signal,
            headers: { "content-type": "image/jpeg" }, body: photo.bytes });
          if (!response.ok || (await response.json())?.id !== photoId) throw fault();
        });
      }
      validatePhoto(await albumMetadata(photoId), photoId, photo);
      const bytes = await timebox(async signal => {
        const url = new URL(`${apiBase}/files/${photoId}`); url.searchParams.set("alt", "media");
        const token = await accessToken();
        const response = await fetchImpl(url.toString(), { method: "GET", redirect: "manual", signal,
          headers: { authorization: `Bearer ${token}` } });
        const length = response.headers.get("content-length");
        if (!response.ok || !response.body || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/jpeg"
          || (length !== null && length !== String(photo.byteSize))) throw fault();
        const reader = response.body.getReader(), chunks = [];
        let received = 0, complete = false;
        const cancel = () => { void reader.cancel().catch(() => {}); };
        signal.addEventListener("abort", cancel, { once: true });
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!(value instanceof Uint8Array) || (received += value.byteLength) > photo.byteSize) throw fault();
            chunks.push(value);
          }
          if (signal.aborted || received !== photo.byteSize) throw fault();
          const data = new Uint8Array(received); let offset = 0;
          for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
          if (await sha256(data) !== photo.sha256) throw fault();
          complete = true;
          return data;
        } finally {
          signal.removeEventListener("abort", cancel);
          if (!complete) await reader.cancel().catch(() => {});
          try { reader.releaseLock(); } catch { /* Pending cancellation owns the lock. */ }
        }
      });
      validatePhoto(await albumMetadata(photoId), photoId, photo);
      verifiedPhotos.push({ slot: photo.slot, bytes, sha256: photo.sha256, width: photo.width, height: photo.height });
    }
    validateFolder(await albumMetadata(sourceRootId), sourceRootId, albumRootMarker);
    album = validateFolder(await albumMetadata(albumId), albumId, albumMarker, sourceRootId);
    let folderUrl = null;
    if (typeof album.webViewLink === "string") {
      try {
        const url = new URL(album.webViewLink);
        if (url.origin === "https://drive.google.com" && !url.username && !url.password && !url.hash
          && url.pathname === `/drive/folders/${albumId}`) folderUrl = url.href;
      } catch { /* The identifier is still available if Google omits its UI link. */ }
    }
    return { folderId: albumId, folderName: album.name, folderUrl, accountEmail: ownerEmail, photos: verifiedPhotos };
  };
  return { info: { provider: "google_drive", accountEmail: ownerEmail, folderId, folderName: folder.name, ready: true },
    put, get, getByStorageKey, delete: remove, prepareDemoAlbum };
}
