import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePortalJudging, normalizePortalResult } from "../worker/participant-portal.js";

const endpointPath = "/api/registration/admin/participant-portal";
const maxFileBytes = 12 * 1024 * 1024;
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function text(value, label, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${label} debe ser texto no vacío de hasta ${max} caracteres.`);
  }
  return value.trim();
}

function optionalText(value, label, max = 200) {
  return value === undefined || value === null || value === "" ? undefined : text(value, label, max);
}

function array(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} debe ser una lista.`);
  return value;
}

function number(value, label, maximum = Infinity) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`${label} debe ser un número válido entre 0 y ${maximum}.`);
  }
  return value;
}

function boolean(value, label, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} debe ser true o false.`);
  return value;
}

function unique(items, key, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item[key])) throw new Error(`${label} contiene identificadores duplicados.`);
    seen.add(item[key]);
  }
  return items;
}

function approvedRoutine(value) {
  const result = value.result ?? null;
  const judging = value.judging ?? null;
  if ((result !== null || judging !== null) && value.approved !== true) {
    throw new Error("Cada resultado o evaluación necesita approved: true en el manifiesto revisado.");
  }
  const sourceProvided = Object.hasOwn(value, "sourceEventId") || Object.hasOwn(value, "sourceRoutineId");
  if (sourceProvided && (!Object.hasOwn(value, "sourceEventId") || !Object.hasOwn(value, "sourceRoutineId"))) {
    throw new Error("sourceEventId y sourceRoutineId deben asignarse juntos.");
  }
  const sourceEventId = optionalText(value.sourceEventId, "routine.sourceEventId", 100) ?? (sourceProvided ? "" : undefined);
  const sourceRoutineId = optionalText(value.sourceRoutineId, "routine.sourceRoutineId", 100) ?? (sourceProvided ? "" : undefined);
  if (Boolean(sourceEventId) !== Boolean(sourceRoutineId)) throw new Error("sourceEventId y sourceRoutineId deben asignarse juntos.");
  return { danceId: text(value.danceId, "routine.danceId", 100), sourceEventId, sourceRoutineId,
    result: normalizePortalResult(result), judging: normalizePortalJudging(judging),
    photosPublished: boolean(value.photosPublished, "routine.photosPublished", false) };
}

export function normalizeManifest(value, directory = process.cwd()) {
  if (!value || value.version !== 1 || typeof value.event !== "object") {
    throw new Error("Se requiere un manifiesto version: 1 con event explícito.");
  }
  if (value.event.published !== undefined) {
    throw new Error("La publicación se controla con --publish, no con event.published.");
  }
  const event = { id: text(value.event.id, "event.id", 100), title: text(value.event.title, "event.title", 300),
    season: text(value.event.season, "event.season", 100), venue: text(value.event.venue, "event.venue"),
    startsAt: text(value.event.startsAt, "event.startsAt", 50) };
  if (!/^[a-zA-Z0-9_-]+$/.test(event.id) || !["cdmx", "puebla", "edomex", "veracruz"].includes(event.venue) || Number.isNaN(Date.parse(event.startsAt))) {
    throw new Error("Revisa event.id, la sede oficial y la fecha del evento.");
  }
  const participants = unique(array(value.participants, "participants").map((participant) => ({
    participantId: text(participant.participantId, "participant.participantId", 100),
    name: optionalText(participant.name, "participant.name"),
  })), "participantId", "participants");
  const routines = unique(array(value.routines, "routines").map(approvedRoutine), "danceId", "routines");
  const assets = unique(array(value.assets, "assets").map((asset) => {
    const kind = text(asset.kind, "asset.kind");
    if (!["photo", "diploma", "judge_sheet"].includes(kind)) throw new Error("asset.kind desconocido.");
    const danceId = optionalText(asset.danceId, "asset.danceId", 100);
    const participantId = optionalText(asset.participantId, "asset.participantId", 100);
    if (kind === "photo" && (!danceId || asset.watermarked !== true)) {
      throw new Error("Las fotos requieren danceId y watermarked: true. Prepara las vistas con participant-portal-media.py.");
    }
    if (kind === "diploma" && !participantId) throw new Error("Un diploma requiere participantId.");
    if (kind === "judge_sheet" && !danceId) throw new Error("Una hoja de jueceo requiere danceId.");
    for (const dimension of [asset.width, asset.height]) {
      if (dimension !== undefined && (!Number.isInteger(dimension) || dimension < 1 || dimension > 50000)) throw new Error("Las dimensiones deben ser enteros de 1 a 50000.");
    }
    return { key: text(asset.key, "asset.key"), kind, danceId, participantId,
      file: path.resolve(directory, text(asset.file, "asset.file", 4096)),
      caption: optionalText(asset.caption, "asset.caption", 500),
      width: asset.width === undefined ? undefined : number(asset.width, "asset.width"),
      height: asset.height === undefined ? undefined : number(asset.height, "asset.height"),
      allowDownload: boolean(asset.allowDownload, "asset.allowDownload", false) };
  }), "key", "assets");
  const assetKeys = new Set(assets.map((asset) => asset.key));
  const documents = unique(array(value.documents, "documents").map((document) => {
    const assetKey = text(document.assetKey, "document.assetKey");
    if (!assetKeys.has(assetKey)) throw new Error("document.assetKey no existe en assets.");
    const participantId = text(document.participantId, "document.participantId", 100);
    const asset = assets.find((item) => item.key === assetKey);
    if (asset.kind !== "diploma" || asset.participantId !== participantId) {
      throw new Error("El documento debe apuntar al diploma del mismo participante.");
    }
    return { assetKey, participantId };
  }), "participantId", "documents");
  const diploma = { dateLabel: optionalText(value.diploma?.dateLabel, "diploma.dateLabel"),
    venueLabel: optionalText(value.diploma?.venueLabel, "diploma.venueLabel") };
  return { version: 1, event, participants, routines, assets, documents, diploma };
}

export function parseArgs(argumentsList) {
  const options = { apply: false, publish: false, cookieStdin: false, diplomas: false };
  const booleans = new Map([["--apply", "apply"], ["--publish", "publish"], ["--cookie-stdin", "cookieStdin"], ["--diplomas", "diplomas"], ["--help", "help"]]);
  const values = new Map([["--manifest", "manifest"], ["--media", "media"], ["--base-url", "baseUrl"], ["--out", "out"]]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (booleans.has(argument)) options[booleans.get(argument)] = true;
    else if (values.has(argument)) {
      const value = argumentsList[++index];
      if (!value || value.startsWith("--")) throw new Error(`Falta el valor de ${argument}.`);
      options[values.get(argument)] = value;
    } else throw new Error("Opción desconocida. Consulta --help.");
  }
  if (options.publish && !options.apply) throw new Error("--publish requiere --apply.");
  if (!options.help && !options.manifest) throw new Error("Especifica --manifest.");
  if (options.apply && (!options.baseUrl || !options.out)) throw new Error("--apply requiere --base-url y --out explícitos.");
  return options;
}

export function normalizeBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("--base-url no es una URL válida."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("--base-url debe ser un origen HTTPS sin ruta, credenciales ni parámetros; HTTP solo se admite en localhost.");
  }
  return url.origin;
}

export function normalizeCookie(value) {
  if (typeof value !== "string" || /[\r\n]/.test(value) || value.length > 16384) throw new Error("La sesión no es válida.");
  const cookie = value.split(";").map((part) => part.trim()).find((part) => part.startsWith("levitate_registration_session="));
  if (!cookie || !/^levitate_registration_session=[A-Za-z0-9._~-]+$/.test(cookie)) {
    throw new Error("Se requiere la cookie levitate_registration_session de un administrador autenticado.");
  }
  return cookie;
}

export function toPrivateCsv(rows) {
  const cell = (value) => {
    let normalized = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(normalized)) normalized = `'${normalized}`;
    return `"${normalized.replaceAll('"', '""')}"`;
  };
  return `${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fileId(value) {
  return `${value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 55)}-${digest(value).slice(0, 12)}`;
}

export function resolveEntryUrl(entryUrl, baseUrl) {
  const url = new URL(entryUrl, baseUrl);
  if (url.origin !== baseUrl || url.pathname !== "/mi-levitate" || !/^#access=[A-Za-z0-9_-]{24,256}$/.test(url.hash)) {
    throw new Error("La API devolvió un enlace de acceso inesperado. Revisa el estado privado antes de continuar.");
  }
  return url.href;
}

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch { throw new Error("No se pudo leer un archivo JSON requerido. Revisa las rutas y su formato."); }
}

async function privateWrite(file, contents) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, contents, { mode: 0o600, flag: "wx" });
    const handle = await fs.open(temporary, "r+");
    try { await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temporary, file);
    await fs.chmod(file, 0o600);
  } finally { await fs.rm(temporary, { force: true }); }
}

function fileType(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return ["image/jpeg", "jpg"];
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ["image/png", "png"];
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return ["image/webp", "webp"];
  if (bytes.subarray(0, 5).toString() === "%PDF-") return ["application/pdf", "pdf"];
  throw new Error("Solo se admiten JPEG, PNG, WebP o PDF con cabecera válida.");
}

async function inspectAsset(asset) {
  const stat = await fs.stat(asset.file).catch(() => null);
  if (!stat?.isFile() || stat.size === 0 || stat.size > maxFileBytes) throw new Error("Un archivo falta, está vacío o supera 12 MB.");
  const bytes = await fs.readFile(asset.file);
  if (!bytes.length || bytes.length > maxFileBytes) throw new Error("Un archivo está vacío o supera 12 MB.");
  const [contentType, extension] = fileType(bytes);
  if (asset.kind === "photo" && contentType === "application/pdf") throw new Error("Una foto debe ser JPEG, PNG o WebP.");
  if (asset.kind !== "photo" && contentType !== "application/pdf") throw new Error("Los diplomas y hojas de jueceo requieren PDF.");
  return { bytes, contentType, extension, contentHash: digest(bytes) };
}

async function readCookie(options) {
  let value = process.env.LEVITATE_ADMIN_COOKIE ?? "";
  if (options.cookieStdin) {
    if (process.stdin.isTTY) throw new Error("Pasa la cookie por entrada estándar sin mostrarla en los argumentos.");
    value = "";
    for await (const chunk of process.stdin) {
      value += chunk;
      if (value.length > 16384) throw new Error("La sesión excede el tamaño permitido.");
    }
    value = value.trim();
  }
  return normalizeCookie(value);
}

async function outputDirectory(value) {
  const directory = path.resolve(value);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const real = await fs.realpath(directory);
  const publicDirectory = path.join(rootDirectory, "public");
  if (real === publicDirectory || real.startsWith(`${publicDirectory}${path.sep}`)) {
    throw new Error("Guarda el lote privado fuera de public/.");
  }
  await fs.chmod(directory, 0o700);
  return directory;
}

async function apiClient(baseUrl, cookie, transport) {
  return async (action, payload = {}) => {
    let response;
    try {
      const url = new URL(endpointPath, baseUrl);
      if (action === "read") {
        for (const [key, value] of Object.entries(payload)) url.searchParams.set(key, String(value));
        response = await transport(url, { headers: { Cookie: cookie }, redirect: "error", signal: AbortSignal.timeout(90000) });
      } else {
        response = await transport(url, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...payload }), redirect: "error", signal: AbortSignal.timeout(90000) });
      }
    } catch { throw new Error(`La solicitud ${action} quedó sin confirmar. Revisa el estado privado antes de reintentar.`); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = typeof body.error?.code === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(body.error.code) ? body.error.code : "request_failed";
      const error = new Error(`La API rechazó ${action} (${response.status}, ${code}).`);
      error.confirmedRejection = true;
      throw error;
    }
    return body;
  };
}

export async function main(argumentsList = process.argv.slice(2), { transport = fetch, log = console.log } = {}) {
  const options = parseArgs(argumentsList);
  if (options.help) {
    log("Uso: node scripts/participant-portal-batch.mjs --manifest lote.json [--media previews.json] [--diplomas] [--apply --base-url https://sitio.example --out /ruta/privada] [--publish] [--cookie-stdin]\nLa opción predeterminada valida y muestra conteos, sin red ni escritura. La sesión se lee de LEVITATE_ADMIN_COOKIE o de entrada estándar.");
    return;
  }
  const manifestPath = path.resolve(options.manifest);
  const raw = await readJson(manifestPath);
  if (options.media) {
    const mediaPath = path.resolve(options.media);
    const media = await readJson(mediaPath);
    if (media.version !== 1 || media.eventId !== raw.event?.id) throw new Error("El manifiesto de vistas pertenece a otro evento o versión.");
    raw.assets = [...array(raw.assets, "assets"), ...array(media.assets, "media.assets").map((asset) => ({
      ...asset, file: path.resolve(path.dirname(mediaPath), text(asset.file, "asset.file", 4096)),
    }))];
  }
  const manifest = normalizeManifest(raw, path.dirname(manifestPath));
  if (options.diplomas && manifest.documents.some((document) => manifest.participants.some((participant) => participant.participantId === document.participantId))) {
    throw new Error("Elige generar el diploma o suministrar un PDF para cada participante.");
  }
  for (const asset of manifest.assets) await inspectAsset(asset);
  const photoCount = manifest.assets.filter((asset) => asset.kind === "photo").length;
  log(`${options.apply ? "Aplicación" : "Simulación"}: 1 evento, ${manifest.participants.length} accesos, ${manifest.routines.length} coreografías, ${photoCount} fotos y ${manifest.documents.length + (options.diplomas ? manifest.participants.length : 0)} diplomas asignados.`);
  if (!options.apply) {
    log("Validación terminada. Añade --apply para guardar borradores y --publish para publicarlos después de revisarlos.");
    return;
  }
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const cookie = await readCookie(options);
  const directory = await outputDirectory(options.out);
  const lockFile = path.join(directory, ".batch.lock");
  let lock;
  try { lock = await fs.open(lockFile, "wx", 0o600); }
  catch { throw new Error("El lote tiene un bloqueo. Confirma que el proceso anterior terminó antes de retirar .batch.lock."); }
  try {
    const stateFile = path.join(directory, "estado-privado.json");
    const state = await fs.stat(stateFile).then(() => readJson(stateFile), () => ({ version: 1, baseUrl, eventId: manifest.event.id, operations: {} }));
    if (state.version !== 1 || state.baseUrl !== baseUrl || state.eventId !== manifest.event.id) throw new Error("La carpeta privada pertenece a otro sitio o evento.");
    const saveState = () => privateWrite(stateFile, JSON.stringify(state, null, 2));
    const api = await apiClient(baseUrl, cookie, transport);
    const run = async (key, action, payload, clean = (value) => value) => {
      const fingerprint = digest(JSON.stringify(payload));
      const previous = state.operations[key];
      const publication = action === "routine.publish" || action === "asset.publish" || (action === "event.upsert" && payload.event.published === true);
      if (!publication && previous?.status === "done" && previous.fingerprint === fingerprint) return previous.result;
      if (previous?.status === "pending" && action === "access.create") {
        throw new Error("Un acceso quedó sin confirmar. Recupera su QR guardado o renueva ese acceso desde administración antes de continuar.");
      }
      state.operations[key] = { status: "pending", action, fingerprint };
      await saveState();
      let response;
      try { response = clean(await api(action, payload)); }
      catch (error) {
        if (error.confirmedRejection) { state.operations[key].status = "rejected"; await saveState(); }
        throw error;
      }
      state.operations[key] = { status: "done", action, fingerprint, result: response };
      await saveState();
      return response;
    };
    await run("event", "event.upsert", { event: manifest.event });
    let snapshot = await api("read", { eventId: manifest.event.id });
    const peopleById = new Map(array(snapshot.participants, "API.participants").map((person) => [person.id, person]));
    const existingRoutines = [...array(snapshot.routines, "API.routines")];
    let routineOffset = 0;
    while (snapshot.routinePagination?.hasMore === true) {
      routineOffset += snapshot.routinePagination.limit;
      if (!Number.isSafeInteger(routineOffset) || routineOffset < 1) throw new Error("La API devolvió una paginación inesperada.");
      snapshot = await api("read", { eventId: manifest.event.id, routineOffset });
      existingRoutines.push(...array(snapshot.routines, "API.routines"));
    }
    const routineIds = new Map(existingRoutines.filter((routine) => routine.id).map((routine) => [routine.danceId, routine.id]));
    const routineRecords = new Map(existingRoutines.map((routine) => [routine.danceId, routine]));
    for (const routine of manifest.routines) {
      const existing = routineRecords.get(routine.danceId);
      const payload = { eventId: manifest.event.id, ...routine,
        sourceEventId: routine.sourceEventId ?? existing?.sourceEventId,
        sourceRoutineId: routine.sourceRoutineId ?? existing?.sourceRoutineId };
      const response = await run(`routine:${routine.danceId}`, "routine.save", payload);
      if (typeof response.routineId !== "string") throw new Error("La API no devolvió routineId.");
      routineIds.set(routine.danceId, response.routineId);
      routineRecords.set(routine.danceId, { ...routine, id: response.routineId });
    }
    if (options.publish && manifest.assets.some((asset) => asset.kind === "photo" && routineRecords.get(asset.danceId)?.photosPublished !== true)) {
      throw new Error("Un álbum tiene photosPublished desactivado. Actívalo en la ficha revisada antes de publicar sus fotos.");
    }
    const { default: QRCode } = await import("qrcode");
    const qrDirectory = path.join(directory, "qr");
    await fs.mkdir(qrDirectory, { recursive: true, mode: 0o700 });
    await fs.chmod(qrDirectory, 0o700);
    state.accessRows ??= {};
    for (const participant of manifest.participants) {
      if (!peopleById.has(participant.participantId)) {
        const page = await api("read", { eventId: manifest.event.id, participantId: participant.participantId });
        for (const person of array(page.participants, "API.participants")) peopleById.set(person.id, person);
      }
      const person = peopleById.get(participant.participantId);
      if (!person || typeof person.name !== "string") throw new Error("Un participantId del manifiesto no existe en el registro.");
      const previousAccess = state.operations[`access:${participant.participantId}`];
      if (previousAccess?.status === "done" && !array(person.accesses, "API.accesses").some((grant) => grant.id === previousAccess.result.id && grant.active && grant.eventId === manifest.event.id)) {
        throw new Error("Un acceso guardado fue revocado o reemplazado. Revisa ese participante en administración antes de reimprimir su QR.");
      }
      const access = await run(`access:${participant.participantId}`, "access.create", { eventId: manifest.event.id, participantId: participant.participantId }, (response) => {
        if (typeof response.id !== "string" || typeof response.entryUrl !== "string") throw new Error("La API no devolvió el enlace privado esperado.");
        return { id: response.id, entryUrl: resolveEntryUrl(response.entryUrl, baseUrl) };
      });
      const qrFile = `qr/${fileId(participant.participantId)}.svg`;
      const svg = await QRCode.toString(access.entryUrl, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: { dark: "#111111", light: "#ffffff" } });
      await privateWrite(path.join(directory, qrFile), svg);
      state.accessRows[participant.participantId] = [participant.participantId, person.name, access.id, access.entryUrl, qrFile];
      await saveState();
      const rows = [["participant_id", "nombre", "access_id", "url_privada", "archivo_qr"], ...Object.values(state.accessRows)];
      await privateWrite(path.join(directory, "accesos-privados.csv"), toPrivateCsv(rows));
    }
    if (options.diplomas) {
      const { generateParticipantDiploma } = await import("../shared/participant-diploma.js");
      const logoBytes = await fs.readFile(path.join(rootDirectory, "public/assets/levitate-logo-mx.png"));
      const diplomaDirectory = path.join(directory, "diplomas");
      await fs.mkdir(diplomaDirectory, { recursive: true, mode: 0o700 });
      await fs.chmod(diplomaDirectory, 0o700);
      state.generatedDiplomas ??= {};
      for (const participant of manifest.participants) {
        const person = peopleById.get(participant.participantId);
        const access = state.operations[`access:${participant.participantId}`].result;
        const input = { name: person.name, academy: person.academy, eventTitle: manifest.event.title, season: manifest.event.season,
          venue: manifest.diploma.venueLabel ?? manifest.event.venue, dateLabel: manifest.diploma.dateLabel ?? manifest.event.startsAt,
          entryUrl: access.entryUrl };
        const fingerprint = digest(JSON.stringify({ input, logo: digest(logoBytes) }));
        const diplomaFile = path.join(diplomaDirectory, `${fileId(participant.participantId)}.pdf`);
        const previous = state.generatedDiplomas[participant.participantId];
        const exists = await fs.stat(diplomaFile).then((stat) => stat.isFile(), () => false);
        if (!exists || previous?.fingerprint !== fingerprint) {
          await privateWrite(diplomaFile, await generateParticipantDiploma({ ...input, logoBytes }));
          state.generatedDiplomas[participant.participantId] = { fingerprint };
          await saveState();
        }
        const key = `diploma-${participant.participantId}`;
        if (manifest.assets.some((asset) => asset.key === key)) throw new Error("Una clave de archivo coincide con un diploma generado.");
        manifest.assets.push({ key, kind: "diploma", participantId: participant.participantId, file: diplomaFile, allowDownload: true });
        manifest.documents.push({ assetKey: key, participantId: participant.participantId });
      }
    }
    const assetIds = new Map();
    for (const asset of manifest.assets) {
      const file = await inspectAsset(asset);
      const routineId = asset.danceId ? routineIds.get(asset.danceId) : undefined;
      if (asset.danceId && !routineId) throw new Error("Una foto o archivo referencia una coreografía sin ficha guardada en este evento.");
      const uploadId = `batch-${digest(JSON.stringify([manifest.event.id, asset.key, asset.kind, asset.danceId, asset.participantId, file.contentHash])).slice(0, 56)}`;
      const payload = { eventId: manifest.event.id, kind: asset.kind, routineId, participantId: asset.participantId,
        fileName: `${fileId(asset.key)}.${file.extension}`, contentType: file.contentType, base64Data: file.bytes.toString("base64"),
        width: asset.width, height: asset.height, caption: asset.caption, allowDownload: asset.allowDownload, uploadId };
      const response = await run(`asset:${asset.key}`, "asset.upload", payload);
      if (typeof response.assetId !== "string") throw new Error("La API no devolvió assetId.");
      assetIds.set(asset.key, response.assetId);
    }
    for (const document of manifest.documents) {
      const key = `document:${document.participantId}`;
      const payload = { eventId: manifest.event.id, participantId: document.participantId,
        assetId: assetIds.get(document.assetKey), published: options.publish };
      const previous = state.operations[key];
      const alreadyPublished = previous?.status === "done" && previous.fingerprint === digest(JSON.stringify({ ...payload, published: true }));
      if (!options.publish && alreadyPublished) continue;
      await run(key, "document.assign", payload);
    }
    if (options.publish) {
      for (const asset of manifest.assets) await run(`publish-asset:${asset.key}`, "asset.publish", { assetId: assetIds.get(asset.key), published: true });
      const publishIds = new Set([...manifest.routines.map((routine) => routineIds.get(routine.danceId)),
        ...manifest.assets.filter((asset) => asset.kind !== "diploma").map((asset) => routineIds.get(asset.danceId))]);
      for (const routineId of publishIds) await run(`publish-routine:${routineId}`, "routine.publish", { routineId });
      await run("publish-event", "event.upsert", { event: { ...manifest.event, published: true } });
    }
    log(`Lote terminado. Archivos privados guardados en ${directory}. ${options.publish ? "Se solicitó la publicación explícita." : "Los cambios nuevos quedaron en borrador."}`);
  } finally {
    await lock.close();
    await fs.rm(lockFile, { force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
