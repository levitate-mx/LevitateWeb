import { createHash } from "node:crypto";

const api = "https://www.googleapis.com/drive/v3";
const uploadApi = "https://www.googleapis.com/upload/drive/v3/files";
const folderMime = "application/vnd.google-apps.folder";
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const roots = new Set(["demo_root_v1", "source_root_v1"]);
const albums = new Set(["demo_album_v1", "source_album_v1"]);
const idPattern = /^[A-Za-z0-9_-]{10,200}$/;
const scopePattern = /^[A-Za-z0-9_-]{1,100}$/;
const maximumSourceBytes = 8 * 1024 * 1024;
const maximumThumbnailBytes = 1024 * 1024;
const maximumPixels = 40_000_000;
const baseFields = "id,name,mimeType,trashed,parents,owners(emailAddress),permissions(type,role,emailAddress,domain),shared,driveId,appProperties,capabilities(canDownload,canListChildren,canAddChildren)";
const fileFields = `${baseFields},size,md5Checksum,sha256Checksum,headRevisionId,version,thumbnailLink,thumbnailVersion,imageMediaMetadata(width,height,rotation)`;

function fail(code = "portal_photo_source_unavailable", message = "No pudimos consultar las fotografías de Drive.", statusCode = 503) {
  return Object.assign(new Error(message), { code, statusCode });
}
const email = value => typeof value === "string" ? value.trim().toLowerCase() : "";
const key = value => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").replace(/\s*·\s*/g, " · ").trim();
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const md5 = bytes => createHash("md5").update(bytes).digest("hex");
function identifier(value) {
  if (typeof value !== "string" || !idPattern.test(value)) throw fail();
  return value;
}
function text(value, max = 400) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw fail("portal_photo_source_invalid", "Revisa los datos de la carpeta de fotos.", 400);
  return value.trim();
}
function privateItem(value, owner, parentId) {
  if (!value || value.trashed !== false || value.driveId || value.shared !== false
    || !Array.isArray(value.owners) || value.owners.length !== 1 || email(value.owners[0]?.emailAddress) !== owner
    || !Array.isArray(value.permissions) || value.permissions.length !== 1
    || value.permissions[0]?.type !== "user" || value.permissions[0]?.role !== "owner"
    || email(value.permissions[0]?.emailAddress) !== owner || value.permissions[0]?.domain
    || !Array.isArray(value.parents) || value.parents.length !== 1 || (parentId && value.parents[0] !== parentId)) {
    throw fail("portal_photo_source_not_private", "La carpeta y sus fotos deben permanecer privadas en Drive.");
  }
  identifier(value.id);
}
function scope(input) {
  for (const field of ["eventId", "participantId", "academyId"]) if (typeof input?.[field] !== "string" || !scopePattern.test(input[field])) throw fail("portal_photo_source_invalid", "Revisa la edición y el participante.", 400);
  const participantName = text(input.participantName), academyName = text(input.academyName);
  if (!Array.isArray(input.dances) || input.dances.length > 200) throw fail("portal_photo_source_invalid", "Revisa las coreografías.", 400);
  const dances = input.dances.map(dance => {
    if (!scopePattern.test(dance?.id || "")) throw fail("portal_photo_source_invalid", "Revisa las coreografías.", 400);
    return { id: dance.id, title: text(dance.title) };
  });
  if (new Set(dances.map(dance => dance.id)).size !== dances.length) throw fail("portal_photo_source_invalid", "Revisa las coreografías.", 400);
  return { ...input, participantName, academyName, dances, adminPreview: input.adminPreview === true };
}
function revision(value) {
  if (typeof value.md5Checksum === "string" && /^[a-f0-9]{32}$/i.test(value.md5Checksum)) return value.md5Checksum.toLowerCase();
  if (typeof value.headRevisionId === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value.headRevisionId)) return value.headRevisionId;
  if (typeof value.version === "string" && /^\d{1,20}$/.test(value.version)) return value.version;
  throw fail("portal_photo_source_invalid", "Drive todavía no terminó de preparar una de las fotos.", 409);
}
function dimensions(value) {
  const width = value.imageMediaMetadata?.width, height = value.imageMediaMetadata?.height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > maximumPixels) {
    throw fail("portal_photo_source_too_large", "La foto supera las dimensiones admitidas para una vista previa.", 413);
  }
  return { width, height };
}
function contentSize(value) {
  const size = typeof value.size === "string" && /^\d{1,20}$/.test(value.size) ? Number(value.size) : NaN;
  if (!Number.isSafeInteger(size) || size < 1 || size > maximumSourceBytes) throw fail("portal_photo_source_too_large", "La foto debe pesar hasta 8 MB.", 413);
  return size;
}
function thumbnailUrl(value, resize = false) {
  let url;
  try { url = new URL(value); } catch { throw fail(); }
  if (url.protocol !== "https:" || !/^lh[3-6]\.googleusercontent\.com$/.test(url.hostname)
    || url.port || url.username || url.password || url.hash || !url.pathname.startsWith("/")) throw fail();
  if (resize) url.pathname = url.pathname.replace(/=s\d+(?:-[A-Za-z0-9]+)*$/, "=s640");
  return url;
}

/** Request-scoped, server-only reader. The caller authenticates the passport
 * and supplies identities and membership loaded from its database, never HTTP
 * query values. No method returns an upstream URL or credential to a client.
 */
export async function getParticipantDriveDiscovery({ getConfig, getAccessToken, expectedEmail, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const owner = email(expectedEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner) || typeof getConfig !== "function" || typeof getAccessToken !== "function") throw fail();
  let config;
  try { config = await getConfig(); } catch { throw fail(); }
  if (!config) throw fail();
  let tokenPromise, calls = 0;
  const duration = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(15000, Math.floor(timeoutMs))) : 10000;
  const timebox = async operation => {
    const controller = new AbortController(); let timer;
    try {
      return await Promise.race([operation(controller.signal), new Promise((resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(fail()); }, duration);
      })]);
    } catch (error) {
      if (error?.code?.startsWith("portal_")) throw error;
      throw fail();
    } finally { clearTimeout(timer); }
  };
  const token = () => tokenPromise ||= timebox(async signal => {
    const result = await getAccessToken(config, { signal });
    if (typeof result !== "string" || !result.trim()) throw fail();
    return result;
  });
  const fetchBounded = async (url, options) => {
    if (++calls > 40) throw fail("portal_photo_source_budget", "Hay muchas fotos para revisar de una vez. Vuelve a consultar el pasaporte.", 429);
    return fetchImpl(url, { ...options, redirect: "manual" });
  };
  const json = async (path, { query = {}, method = "GET", body } = {}) => {
    const access = await token(), url = new URL(`${api}/${path}`);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, String(value));
    return timebox(async signal => {
      const response = await fetchBounded(url.toString(), { method, signal,
        headers: { authorization: `Bearer ${access}`, accept: "application/json", ...(body ? { "content-type": "application/json; charset=utf-8" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw fail();
      const value = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) throw fail();
      return value;
    });
  };
  const metadata = (id, fields = fileFields) => json(`files/${identifier(id)}`, { query: { fields, supportsAllDrives: "true" } });
  const list = async (q, fields = baseFields, pageSize = 1000) => {
    const value = await json("files", { query: { q, fields: `nextPageToken,files(${fields})`, spaces: "drive", pageSize, orderBy: "name" } });
    if (!Array.isArray(value.files) || value.files.length > pageSize) throw fail();
    return value;
  };
  let account;
  const verifyAccount = () => account ||= json("about", { query: { fields: "user(emailAddress),storageQuota(limit,usage)" } }).then(value => {
    if (email(value.user?.emailAddress) !== owner) throw fail("portal_storage_wrong_account", "La conexión debe pertenecer a la cuenta de Levitate configurada.");
    return value;
  });
  const rootFolder = async () => {
    await verifyAccount();
    const result = await list(`'root' in parents and 'me' in owners and trashed = false and mimeType = '${folderMime}' and (appProperties has { key='levitatePhotoAlbum' and value='demo_root_v1' } or appProperties has { key='levitatePhotoAlbum' and value='source_root_v1' })`, "id", 2);
    if (result.nextPageToken || result.files.length > 1) throw fail("portal_photo_source_ambiguous", "Hay más de una carpeta de fotos configurada. Revisa la asociación.", 409);
    if (!result.files.length) return null;
    const root = await metadata(result.files[0].id, baseFields);
    privateItem(root, owner);
    if (root.mimeType !== folderMime || !roots.has(root.appProperties?.levitatePhotoAlbum) || root.capabilities?.canListChildren !== true) throw fail();
    return root;
  };
  const validateRoot = (value, expectedParent) => {
    privateItem(value, owner, expectedParent);
    if (value.mimeType !== folderMime || !roots.has(value.appProperties?.levitatePhotoAlbum) || value.capabilities?.canListChildren !== true) throw fail();
  };
  const validateAlbum = (album, root, context, dance, exactName = true) => {
    privateItem(album, owner, root.id);
    const properties = album.appProperties || {}, demo = properties.demo === "true";
    if (album.mimeType !== folderMime || !albums.has(properties.levitatePhotoAlbum) || album.capabilities?.canListChildren !== true
      || properties.levitateEventId !== context.eventId || properties.levitateDanceId !== dance.id
      || (properties.levitateParticipantId && properties.levitateParticipantId !== context.participantId)
      || (properties.levitateAcademyId && properties.levitateAcademyId !== context.academyId)
      || (demo && !context.adminPreview)) throw fail("portal_photo_source_mismatch", "La carpeta no corresponde a esta participación.", 409);
    const name = text(album.name, 1200), expected = `${dance.title} · ${context.participantName} · ${context.academyName}`;
    const unlabelled = demo ? name.replace(/\s*·\s*(DEMO|PRUEBA)\s*$/iu, "") : name;
    if (exactName && key(unlabelled) !== key(expected)) throw fail("portal_photo_source_mismatch", "La carpeta no corresponde a esta participación.", 409);
    return { demo, trusted: properties.levitateParticipantId === context.participantId && properties.levitateAcademyId === context.academyId };
  };
  const validatePhoto = (photo, albumId) => {
    privateItem(photo, owner, albumId);
    if (!imageTypes.has(photo.mimeType) || photo.capabilities?.canDownload !== true
      || photo.appProperties?.watermarkVersion || photo.appProperties?.levitatePhotoAlbum === "demo_photo_v1") throw fail();
    dimensions(photo);
    contentSize(photo);
    revision(photo);
  };
  const bytesFrom = async (response, maximum, signal, expectedSize) => {
    const length = response.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum || (expectedSize && Number(length) !== expectedSize))) {
      void response.body?.cancel().catch(() => {});
      throw fail();
    }
    if (!response.body?.getReader) throw fail();
    const reader = response.body.getReader(), chunks = []; let size = 0, complete = false;
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array) || (size += value.length) > maximum) throw fail();
        chunks.push(value);
      }
      if (signal.aborted || size < 1 || (expectedSize && size !== expectedSize)) throw fail();
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      complete = true; return bytes;
    } finally {
      signal.removeEventListener("abort", cancel);
      if (!complete) await reader.cancel().catch(() => {});
      try { reader.releaseLock(); } catch { /* The cancellation may own the lock. */ }
    }
  };
  const discover = async input => {
    const context = scope(input), root = await rootFolder();
    if (!root || !context.dances.length) return { albums: [] };
    const folders = await list(`'${root.id}' in parents and 'me' in owners and trashed = false and mimeType = '${folderMime}'`);
    if (folders.nextPageToken) throw fail("portal_photo_source_ambiguous", "Hay muchas carpetas de fotos. Revisa la asociación antes de continuar.", 409);
    const result = [];
    for (const dance of context.dances) {
      const binding = context.knownBindings instanceof Map ? context.knownBindings.get(dance.id) : context.knownBindings?.[dance.id];
      const boundId = typeof binding === "string" ? binding : binding?.folderId;
      if (boundId !== undefined) identifier(boundId);
      const expected = key(`${dance.title} · ${context.participantName} · ${context.academyName}`);
      const candidates = folders.files.filter(folder => {
        const properties = folder.appProperties || {};
        if (properties.levitateEventId !== context.eventId || properties.levitateDanceId !== dance.id
          || !albums.has(properties.levitatePhotoAlbum) || (properties.demo === "true" && !context.adminPreview)) return false;
        const name = typeof folder.name === "string" ? folder.name : "";
        return boundId ? folder.id === boundId : key(properties.demo === "true" ? name.replace(/\s*·\s*(DEMO|PRUEBA)\s*$/iu, "") : name) === expected;
      });
      if (candidates.length > 1) throw fail("portal_photo_source_ambiguous", "Hay dos carpetas para la misma participación. Revisa la asociación.", 409);
      if (!candidates.length) continue;
      const album = await metadata(candidates[0].id, baseFields);
      const albumState = validateAlbum(album, root, context, dance, !boundId);
      const images = await list(`'${album.id}' in parents and 'me' in owners and trashed = false and (mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/webp')`, fileFields, 100);
      const photos = [];
      for (const listed of images.files) {
        if (listed.appProperties?.watermarkVersion || listed.appProperties?.levitatePhotoAlbum === "demo_photo_v1") continue;
        validatePhoto(listed, album.id);
        const expectedRevision = revision(listed);
        photos.push({ id: listed.id, revision: expectedRevision, name: text(listed.name, 1000), mimeType: listed.mimeType, ...dimensions(listed),
          read: async () => {
            const freshRoot = await metadata(root.id, baseFields);
            validateRoot(freshRoot, root.parents[0]);
            validateAlbum(await metadata(album.id, baseFields), freshRoot, context, dance, !boundId);
            const current = await metadata(listed.id);
            validatePhoto(current, album.id);
            if (revision(current) !== expectedRevision) throw fail("portal_photo_source_changed", "La foto cambió mientras se preparaba. Vuelve a consultar el pasaporte.", 409);
            const access = await token();
            const loaded = await timebox(async signal => {
              if (current.thumbnailLink) {
                let url = thumbnailUrl(current.thumbnailLink, true);
                for (let redirects = 0; redirects < 3; redirects++) {
                  const response = await fetchBounded(url.toString(), { method: "GET", signal, headers: { authorization: `Bearer ${access}` } });
                  if ([301, 302, 303, 307, 308].includes(response.status)) {
                    void response.body?.cancel().catch(() => {});
                    url = thumbnailUrl(new URL(response.headers.get("location"), url).toString());
                    continue;
                  }
                  if (response.ok) {
                    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
                    if (!imageTypes.has(contentType)) throw fail();
                    return { bytes: await bytesFrom(response, maximumThumbnailBytes, signal), contentType, sourceKind: "thumbnail" };
                  }
                  break;
                }
              }
              const response = await fetchBounded(`${api}/files/${identifier(current.id)}?alt=media`, { method: "GET", signal, headers: { authorization: `Bearer ${access}` } });
              const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
              if (!response.ok || contentType !== current.mimeType) throw fail();
              const bytes = await bytesFrom(response, maximumSourceBytes, signal, contentSize(current));
              if (current.md5Checksum && md5(bytes) !== current.md5Checksum.toLowerCase()) throw fail("portal_photo_source_changed", "La foto cambió mientras se preparaba. Vuelve a consultar el pasaporte.", 409);
              return { bytes, contentType, sourceKind: "original" };
            });
            const after = await metadata(listed.id);
            validatePhoto(after, album.id);
            if (revision(after) !== expectedRevision) throw fail("portal_photo_source_changed", "La foto cambió mientras se preparaba. Vuelve a consultar el pasaporte.", 409);
            validateAlbum(await metadata(album.id, baseFields), freshRoot, context, dance, !boundId);
            const finalRoot = await metadata(root.id, baseFields);
            validateRoot(finalRoot, root.parents[0]);
            return loaded;
          } });
      }
      result.push({ id: album.id, danceId: dance.id, name: album.name, ...albumState, photos, truncated: Boolean(images.nextPageToken) });
    }
    return { albums: result };
  };

  const prepareDemoSource = async input => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw fail("portal_photo_source_invalid", "Revisa los datos de la foto de prueba.", 400);
    const context = scope({ ...input, adminPreview: true, dances: [{ id: input.danceId, title: input.danceTitle }] });
    const dance = context.dances[0], bytes = input.bytes;
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > maximumSourceBytes || !imageTypes.has(input.contentType)
      || !/^[a-f0-9]{64}$/.test(input.sha256 || "") || digest(bytes) !== input.sha256) throw fail("portal_photo_source_invalid", "Usa la foto de demostración indicada.", 400);
    const root = await rootFolder();
    if (!root || root.appProperties?.levitatePhotoAlbum !== "demo_root_v1") throw fail();
    const found = await list(`'${root.id}' in parents and 'me' in owners and trashed = false and mimeType='${folderMime}' and appProperties has { key='levitatePhotoAlbum' and value='demo_album_v1' } and appProperties has { key='levitateEventId' and value='${context.eventId}' } and appProperties has { key='levitateDanceId' and value='${dance.id}' }`, "id", 2);
    if (found.nextPageToken || found.files.length !== 1) throw fail("portal_photo_source_ambiguous", "Prepara primero una única carpeta de prueba para esta coreografía.", 409);
    let album = await metadata(found.files[0].id, `${baseFields},webViewLink`);
    privateItem(album, owner, root.id);
    if (album.mimeType !== folderMime || album.appProperties?.levitatePhotoAlbum !== "demo_album_v1"
      || album.appProperties.demo !== "true" || album.appProperties.levitateEventId !== context.eventId || album.appProperties.levitateDanceId !== dance.id
      || album.capabilities?.canAddChildren !== true) throw fail();
    const properties = { ...album.appProperties, levitateParticipantId: context.participantId, levitateAcademyId: context.academyId };
    if ((album.appProperties.levitateParticipantId && album.appProperties.levitateParticipantId !== context.participantId)
      || (album.appProperties.levitateAcademyId && album.appProperties.levitateAcademyId !== context.academyId)) throw fail("portal_photo_source_mismatch", "La carpeta ya pertenece a otra persona.", 409);
    const name = `${dance.title} · ${context.participantName} · ${context.academyName} · DEMO`;
    if (name.length > 1200) throw fail("portal_photo_source_invalid", "El nombre de la carpeta es demasiado largo.", 400);
    if (album.name !== name || JSON.stringify(album.appProperties) !== JSON.stringify(properties)) {
      await json(`files/${album.id}`, { method: "PATCH", query: { fields: "id" }, body: { name, appProperties: properties } });
      album = await metadata(album.id, `${baseFields},webViewLink`);
    }
    validateAlbum(album, root, context, dance);
    const slot = "auto-raw-demo";
    const sources = await list(`'${album.id}' in parents and 'me' in owners and trashed = false and appProperties has { key='levitateSourceSlot' and value='${slot}' }`, fileFields, 2);
    if (sources.nextPageToken || sources.files.length > 1) throw fail("portal_photo_source_ambiguous", "Hay más de una foto de demostración para esta prueba.", 409);
    let source = sources.files[0];
    if (!source) {
      const quota = await verifyAccount(), limit = Number(quota.storageQuota?.limit), usage = Number(quota.storageQuota?.usage);
      if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(usage) || usage + bytes.length > limit) throw fail("portal_storage_quota_exceeded", "No queda espacio verificado en Drive para la foto de prueba.", 507);
      const generated = await json("files/generateIds", { query: { count: 1, space: "drive", type: "files" } });
      if (!Array.isArray(generated.ids) || generated.ids.length !== 1) throw fail();
      const sourceId = identifier(generated.ids[0]), access = await token();
      await timebox(async signal => {
        const start = await fetchBounded(`${uploadApi}?uploadType=resumable&fields=id`, { method: "POST", signal,
          headers: { authorization: `Bearer ${access}`, "content-type": "application/json; charset=utf-8",
            "x-upload-content-type": input.contentType, "x-upload-content-length": String(bytes.length) },
          body: JSON.stringify({ id: sourceId, name: text(input.fileName || "DEMO-original-sin-marca.jpg", 200), mimeType: input.contentType,
            parents: [album.id], appProperties: { levitatePhotoAlbum: "source_photo_v1", levitateSourceSlot: slot, levitateSha256: input.sha256,
              levitateEventId: context.eventId, levitateDanceId: dance.id, levitateParticipantId: context.participantId, levitateAcademyId: context.academyId, demo: "true" } }) });
        if (!start.ok) throw fail();
        let uploadUrl;
        try { uploadUrl = new URL(start.headers.get("location")); } catch { throw fail(); }
        if (uploadUrl.origin !== "https://www.googleapis.com" || uploadUrl.pathname !== "/upload/drive/v3/files"
          || uploadUrl.username || uploadUrl.password || uploadUrl.hash) throw fail();
        const response = await fetchBounded(uploadUrl.toString(), { method: "PUT", signal, headers: { "content-type": input.contentType }, body: bytes });
        if (!response.ok || (await response.json())?.id !== sourceId) throw fail();
      });
      source = await metadata(sourceId);
    }
    validatePhoto(source, album.id);
    if (source.appProperties?.levitateSourceSlot !== slot || source.appProperties.levitateSha256 !== input.sha256
      || source.md5Checksum?.toLowerCase() !== md5(bytes) || contentSize(source) !== bytes.length) throw fail("portal_photo_source_changed", "La foto de prueba guardada tiene otro contenido.", 409);
    const finalAlbum = await metadata(album.id, `${baseFields},webViewLink`);
    validateAlbum(finalAlbum, root, context, dance);
    validateRoot(await metadata(root.id, baseFields), root.parents[0]);
    let folderUrl = null;
    try {
      const url = new URL(finalAlbum.webViewLink);
      if (url.origin === "https://drive.google.com" && url.pathname === `/drive/folders/${album.id}` && !url.username && !url.password && !url.hash) folderUrl = url.href;
    } catch { /* Google may omit its UI link; the verified folder ID remains. */ }
    return { folderId: album.id, folderName: finalAlbum.name, folderUrl, accountEmail: owner, sourceId: source.id, revision: revision(source) };
  };
  return { discover, prepareDemoSource };
}
