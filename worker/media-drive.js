const driveApiBase = "https://www.googleapis.com/drive/v3";
const aboutFields = "user(displayName,emailAddress),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)";
const folderFields = "id,name,mimeType,trashed,driveId,capabilities(canListChildren,canAddChildren)";
const folderMimeType = "application/vnd.google-apps.folder";
const driveIdPattern = /^[A-Za-z0-9_-]{10,200}$/;
const defaultTimeoutMs = 8000;

function invalidFolder() {
  return Object.assign(new Error("Ingresa el enlace o identificador de una carpeta de Google Drive."), {
    code: "media_drive_invalid_folder",
    statusCode: 400,
  });
}

/** Extract only an ID; a supplied URL is never used as an upstream endpoint. */
export function parseMediaDriveFolderId(input) {
  if (input == null || input === "") return "";
  if (typeof input !== "string") throw invalidFolder();
  const value = input.trim();
  if (!value) return "";
  if (driveIdPattern.test(value)) return value;
  if (!/^https:\/\//i.test(value) || value.includes("\\")) throw invalidFolder();

  let url;
  try { url = new URL(value); } catch { throw invalidFolder(); }
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com" || url.port
    || url.username || url.password) throw invalidFolder();

  const folderPath = url.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([^/]+)\/?$/);
  let id = folderPath?.[1];
  if (!id && url.pathname === "/open" && url.searchParams.getAll("id").length === 1) {
    id = url.searchParams.get("id");
  }
  if (!id || !driveIdPattern.test(id)) throw invalidFolder();
  return id;
}

function safeString(value, maximum = 1024) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maximum) : "";
}

function byteString(value) {
  // Drive returns int64 strings. Missing quota is unknown/unlimited, never zero.
  return typeof value === "string" && /^\d{1,20}$/.test(value) ? value : null;
}

function diagnosticError(code) {
  return Object.assign(new Error("Google Drive diagnostic failed"), { diagnosticCode: code });
}

async function withTimeout(operation, timeoutMs) {
  const controller = new AbortController();
  const duration = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.min(Math.max(1, Math.floor(timeoutMs)), 15000) : defaultTimeoutMs;
  let timer;
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(diagnosticError("timeout"));
    }, duration);
  });
  try { return await Promise.race([operation(controller.signal), deadline]); }
  finally { clearTimeout(timer); }
}

async function readMetadata(path, fields, token, { fetchImpl, timeoutMs, folder = false }) {
  const url = new URL(`${driveApiBase}/${path}`);
  url.searchParams.set("fields", fields);
  if (folder) url.searchParams.set("supportsAllDrives", "true");
  return withTimeout(async (signal) => {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      redirect: "manual",
      signal,
    });
    if (!response.ok) {
      // Error bodies may contain credentials or private provider details.
      throw diagnosticError(response.status === 401 ? "authentication"
        : response.status === 403 ? "forbidden" : response.status === 404 ? "not_found" : "unavailable");
    }
    let data;
    try { data = await response.json(); } catch { throw diagnosticError("invalid_response"); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw diagnosticError("invalid_response");
    return data;
  }, timeoutMs);
}

function connectionErrorMessage(error) {
  if (error?.diagnosticCode === "timeout") return "Google Drive tardó demasiado en responder. Vuelve a comprobar la conexión.";
  if (error?.diagnosticCode === "forbidden") return "La autorización actual no permite consultar Google Drive.";
  if (error?.diagnosticCode === "invalid_response") return "Google Drive devolvió una respuesta que no pudimos validar.";
  return "No pudimos validar la conexión con Google Drive. Revisa la autorización existente y vuelve a intentarlo.";
}

function emptyFolder(id = "") {
  return { id, name: "", driveId: null, status: "error", validated: false, canAddChildren: false };
}

async function checkFolder(id, token, options) {
  const folder = emptyFolder(id);
  try {
    const data = await readMetadata(`files/${encodeURIComponent(id)}`, folderFields, token, { ...options, folder: true });
    if (data.id !== id || data.mimeType !== folderMimeType) {
      return { ...folder, message: "El elemento seleccionado no es una carpeta válida de Google Drive." };
    }
    folder.name = safeString(data.name);
    if (!folder.name) {
      return { ...folder, message: "Google Drive no devolvió un nombre válido para esa carpeta. Vuelve a comprobarla." };
    }
    folder.driveId = typeof data.driveId === "string" && driveIdPattern.test(data.driveId) ? data.driveId : null;
    folder.canAddChildren = data.capabilities?.canAddChildren === true;
    if (data.trashed !== false) return { ...folder, message: "La carpeta no está disponible o está en la papelera." };
    if (data.capabilities?.canListChildren !== true) {
      return { ...folder, message: "La cuenta conectada no tiene permiso para consultar esa carpeta." };
    }
    return { ...folder, status: "ready", validated: true };
  } catch (error) {
    return { ...folder, message: error?.diagnosticCode === "timeout"
      ? "Google Drive tardó demasiado en responder al consultar la carpeta. Vuelve a intentarlo."
      : "No pudimos acceder a esa carpeta con la cuenta conectada. Revisa el enlace y sus permisos." };
  }
}

/** GET-only metadata diagnostic. The caller must authenticate an admin first. */
export async function getMediaDriveDiagnostic({
  getConfig,
  getAccessToken,
  folderId = "",
  fetchImpl = fetch,
  timeoutMs = defaultTimeoutMs,
}) {
  const connection = {
    status: "missing_configuration",
    credentialsPresent: false,
    validated: false,
    checkedAt: new Date().toISOString(),
    message: "La autorización de Google Drive todavía no está configurada para esta conexión.",
    folder: null,
  };
  let parsedFolderId = "";
  let folderInputInvalid = false;
  try { parsedFolderId = parseMediaDriveFolderId(folderId); }
  catch { folderInputInvalid = true; }

  let config;
  try { config = await getConfig(); }
  catch { return { connection }; }
  if (!config) return { connection };
  connection.credentialsPresent = true;
  if (["oauth_refresh_token", "service_account"].includes(config.authType)) connection.authType = config.authType;

  let token;
  try {
    token = await withTimeout((signal) => getAccessToken(config, { signal }), timeoutMs);
    if (typeof token !== "string" || !token.trim()) throw diagnosticError("authentication");
    const about = await readMetadata("about", aboutFields, token, { fetchImpl, timeoutMs });
    const displayName = safeString(about.user?.displayName, 320);
    const emailAddress = safeString(about.user?.emailAddress, 320);
    if (!displayName && !emailAddress) throw diagnosticError("invalid_response");
    connection.status = "connected";
    connection.validated = true;
    connection.account = { displayName, emailAddress };
    connection.storage = {
      limitBytes: byteString(about.storageQuota?.limit),
      usageBytes: byteString(about.storageQuota?.usage),
      usageInDriveBytes: byteString(about.storageQuota?.usageInDrive),
      usageInDriveTrashBytes: byteString(about.storageQuota?.usageInDriveTrash),
    };
    connection.message = "Conexión con Google Drive verificada.";
  } catch (error) {
    connection.status = "error";
    connection.message = connectionErrorMessage(error);
    return { connection };
  }

  if (folderInputInvalid) {
    connection.folder = { ...emptyFolder(), message: invalidFolder().message };
  } else if (parsedFolderId) {
    connection.folder = await checkFolder(parsedFolderId, token, { fetchImpl, timeoutMs });
  }
  return { connection };
}
