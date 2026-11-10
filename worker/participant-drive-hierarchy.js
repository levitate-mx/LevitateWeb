const api = "https://www.googleapis.com/drive/v3";
const folderMime = "application/vnd.google-apps.folder";
const folderFields = "id,name,mimeType,trashed,parents,owners(emailAddress),permissions(type,role,emailAddress,domain),shared,driveId,appProperties,capabilities(canListChildren,canAddChildren)";
const idPattern = /^[A-Za-z0-9_-]{10,200}$/;
const scopePattern = /^[A-Za-z0-9_-]{1,100}$/;
export const PARTICIPANT_PHOTO_ACCOUNT = "ati.levitatemx@gmail.com";
export const PARTICIPANT_PHOTO_HIERARCHY = Object.freeze({ root: "source_root_v2", academy: "academy_v2", album: "source_album_v2" });

const email = value => typeof value === "string" ? value.trim().toLowerCase() : "";
function fail(code = "portal_photo_hierarchy_unavailable", message = "No pudimos preparar las carpetas de fotografías.", statusCode = 503) {
  return Object.assign(new Error(message), { code, statusCode });
}
function id(value, pattern = idPattern) {
  if (typeof value !== "string" || !pattern.test(value)) throw fail("portal_photo_source_invalid", "Revisa los datos de las carpetas de fotos.", 400);
  return value;
}
function label(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 400 || /[\u0000-\u001f\u007f]/.test(value)) throw fail("portal_photo_source_invalid", "Revisa los nombres de las carpetas de fotos.", 400);
  return value.trim().replace(/\s+/g, " ");
}
function manifest(input) {
  const eventId = id(input?.eventId, scopePattern);
  const rootName = label(input.rootName || "Mi Levitate · Fotos · Estado de México 2026");
  if (!Array.isArray(input.academies) || input.academies.length > 8) throw fail("portal_photo_source_invalid", "Prepara hasta ocho coreografías por lote.", 400);
  const academyIds = new Set(), danceIds = new Set();
  const academies = input.academies.map(academy => {
    const academyId = id(academy?.id, scopePattern), name = label(academy.name);
    if (academyIds.has(academyId) || !Array.isArray(academy.dances) || !academy.dances.length) throw fail("portal_photo_source_invalid", "Revisa las academias del lote.", 400);
    academyIds.add(academyId);
    const dances = academy.dances.map(dance => {
      const danceId = id(dance?.id, scopePattern), title = label(dance.title);
      if (danceIds.has(danceId)) throw fail("portal_photo_source_invalid", "Hay una coreografía repetida en el lote.", 400);
      danceIds.add(danceId); return { id: danceId, title };
    });
    return { id: academyId, name, dances };
  });
  if (danceIds.size > 8) throw fail("portal_photo_source_invalid", "Prepara hasta ocho coreografías por lote.", 400);
  return { eventId, rootName, academies };
}
function validateFolder(value, owner, parent, properties, actualRootId) {
  if (!value || value.mimeType !== folderMime || value.trashed !== false || value.shared !== false || value.driveId
    || !Array.isArray(value.owners) || value.owners.length !== 1 || email(value.owners[0]?.emailAddress) !== owner
    || !Array.isArray(value.permissions) || value.permissions.length !== 1 || value.permissions[0]?.type !== "user"
    || value.permissions[0]?.role !== "owner" || email(value.permissions[0]?.emailAddress) !== owner || value.permissions[0]?.domain
    || !Array.isArray(value.parents) || value.parents.length !== 1 || value.parents[0] !== (parent === "root" ? actualRootId : parent)
    || value.capabilities?.canListChildren !== true || value.capabilities?.canAddChildren !== true) {
    throw fail("portal_photo_source_not_private", "Las carpetas de fotos deben pertenecer a Ati y permanecer privadas.");
  }
  id(value.id); label(value.name);
  const actual = value.appProperties || {};
  if (Object.entries(properties).some(([key, expected]) => actual[key] !== expected)
    || ["levitateEventId", "levitateAcademyId", "levitateDanceId", "levitateParticipantId"].some(key => actual[key] !== undefined && actual[key] !== properties[key])) {
    throw fail("portal_photo_source_mismatch", "La carpeta no corresponde a esta edición, academia y coreografía.", 409);
  }
  return value;
}

/** Operational/server-only writer. The caller authenticates the administrator
 * and builds the manifest from registration_academies + registration_dances.
 * Never adopts folders by display name, modifies existing files, or changes
 * permissions. Serialize operational batches; duplicate markers fail closed.
 */
export async function getParticipantDriveHierarchy({ getConfig, getAccessToken, expectedEmail, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const owner = email(expectedEmail);
  if (owner !== PARTICIPANT_PHOTO_ACCOUNT) throw fail("portal_storage_wrong_account", "La carpeta de fotos debe crearse con la cuenta Ati Levitate.");
  if (typeof getConfig !== "function" || typeof getAccessToken !== "function") throw fail();
  let config;
  try { config = await getConfig(); } catch { throw fail(); }
  if (!config) throw fail();
  const duration = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(15000, Math.floor(timeoutMs))) : 10000;
  const timebox = async operation => {
    const controller = new AbortController(); let timer;
    try {
      return await Promise.race([operation(controller.signal), new Promise((resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(fail()); }, duration);
      })]);
    } catch (error) { if (error?.code?.startsWith("portal_")) throw error; throw fail(); }
    finally { clearTimeout(timer); }
  };
  let tokenPromise;
  const token = () => tokenPromise ||= timebox(async signal => {
    const value = await getAccessToken(config, { signal });
    if (typeof value !== "string" || !value.trim()) throw fail();
    return value;
  });
  let operationRunning = false;
  const ensure = async input => {
    const context = manifest(input);
    if (operationRunning) throw fail("portal_photo_hierarchy_busy", "Espera a que termine el lote de carpetas anterior.", 409);
    operationRunning = true;
    let calls = 0, created = 0;
    const request = async (path, { method = "GET", query = {}, body } = {}) => {
      if (++calls > 100) throw fail();
      const access = await token(), url = new URL(`${api}/${path}`);
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
      return timebox(async signal => {
        const response = await fetchImpl(url.toString(), { method, redirect: "manual", signal,
          headers: { authorization: `Bearer ${access}`, accept: "application/json", ...(body ? { "content-type": "application/json; charset=utf-8" } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}) });
        if (!response.ok) throw fail();
        const value = await response.json();
        if (!value || typeof value !== "object" || Array.isArray(value)) throw fail();
        return value;
      });
    };
    try {
      const account = await request("about", { query: { fields: "user(emailAddress)" } });
      if (email(account.user?.emailAddress) !== owner) throw fail("portal_storage_wrong_account", "La conexión de fotos debe pertenecer a Ati Levitate.");
      const driveRoot = await request("files/root", { query: { fields: "id" } });
      const actualRootId = id(driveRoot.id);
      const metadata = folderId => request(`files/${id(folderId)}`, { query: { fields: folderFields } });
      const find = async (parent, properties) => {
        const q = [`'${parent}' in parents`, "'me' in owners", "trashed = false", `mimeType = '${folderMime}'`,
          ...Object.entries(properties).map(([key, value]) => `appProperties has { key='${key}' and value='${value}' }`)].join(" and ");
        const value = await request("files", { query: { q, fields: "nextPageToken,files(id)", spaces: "drive", pageSize: 2 } });
        if (!Array.isArray(value.files)) throw fail();
        if (value.nextPageToken || value.files.length > 1) throw fail("portal_photo_source_ambiguous", "Hay dos carpetas con la misma asociación. Revisa el árbol de fotos.", 409);
        return value.files[0]?.id;
      };
      const ensureFolder = async (parent, name, properties) => {
        let folderId = await find(parent, properties);
        if (!folderId) {
          const value = await request("files", { method: "POST", query: { fields: "id" }, body: { name, mimeType: folderMime, parents: [parent], appProperties: properties } });
          folderId = id(value.id); created++;
          // A concurrent creator must never silently select a different album.
          const found = await find(parent, properties);
          if (found !== folderId) throw fail("portal_photo_source_ambiguous", "No se pudo confirmar una única carpeta para esta asociación.", 409);
        }
        return validateFolder(await metadata(folderId), owner, parent, properties, actualRootId);
      };
      const rootProperties = { levitatePhotoAlbum: PARTICIPANT_PHOTO_HIERARCHY.root, levitateEventId: context.eventId };
      const root = await ensureFolder("root", context.rootName, rootProperties);
      const academies = [];
      for (const academy of context.academies) {
        const academyProperties = { levitatePhotoAlbum: PARTICIPANT_PHOTO_HIERARCHY.academy, levitateEventId: context.eventId, levitateAcademyId: academy.id };
        const folder = await ensureFolder(root.id, academy.name, academyProperties), dances = [];
        for (const dance of academy.dances) {
          const properties = { levitatePhotoAlbum: PARTICIPANT_PHOTO_HIERARCHY.album, levitateEventId: context.eventId, levitateAcademyId: academy.id, levitateDanceId: dance.id };
          const album = await ensureFolder(folder.id, dance.title, properties);
          dances.push({ danceId: dance.id, folderId: album.id, folderName: album.name });
        }
        validateFolder(await metadata(folder.id), owner, root.id, academyProperties, actualRootId);
        academies.push({ academyId: academy.id, folderId: folder.id, folderName: folder.name, dances });
      }
      validateFolder(await metadata(root.id), owner, "root", rootProperties, actualRootId);
      return { rootFolderId: root.id, rootFolderName: root.name, accountEmail: owner, academies, created };
    } finally { operationRunning = false; }
  };
  return { ensure };
}
