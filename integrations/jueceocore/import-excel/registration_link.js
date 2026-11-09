const callbackUrl = "https://levitate.mx/api/integrations/jueceocore/program";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const eventPattern = /^[A-Za-z0-9_-]{1,100}$/;
const dancePattern = /^[A-Za-z0-9_-]{8,100}$/;
const sourceEventPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const routinePattern = /^[A-Za-z0-9_-]{1,100}$/;
const registrationFields = ["registrationDanceID", "registrationEventID", "registrationToken"];
const text = value => typeof value === "string" ? value.trim() : "";

export const REGISTRATION_COLUMN_ALIASES = {
  registrationDanceID: ["ID INSCRIPCIÓN", "ID INSCRIPCION", "REGISTRATION DANCE ID"],
  registrationEventID: ["ID EDICIÓN", "ID EDICION", "REGISTRATION EVENT ID"],
  registrationToken: ["TOKEN VINCULACIÓN", "TOKEN VINCULACION", "REGISTRATION LINK TOKEN"],
};

export class RegistrationLinkError extends Error {
  constructor(message, status = 400) { super(message); this.name = "RegistrationLinkError"; this.status = status; }
}

function invalid(message = "El programa contiene datos incompletos o inválidos de vinculación con Mi Levitate. Vuelve a exportarlo desde la web.") {
  throw new RegistrationLinkError(message);
}

/** Read optional reserved columns without changing the app's routine number. */
export function registrationMetadataForRow(row, columns) {
  if (!registrationFields.some(field => Number.isInteger(columns[field]))) return {};
  return {
    registrationMetadataPresent: true,
    ...Object.fromEntries(registrationFields.filter(field => Number.isInteger(columns[field]))
      .map(field => [field, text(String(row[columns[field]] ?? ""))])),
  };
}

/** Validate the complete mapping before the importer can mutate source data. */
export function collectRegistrationLink(routines, { replaceEvent = false, forceReplace = false } = {}) {
  if (!Array.isArray(routines)) invalid();
  // Older web exports already carried ID INSCRIPCIÓN but had no edition or
  // capability column. Keep those files usable as legacy, unlinked imports.
  // A present-but-empty edition/token column still signals the new contract.
  const hasMetadata = routines.some(row => row && (Object.hasOwn(row,"registrationEventID")
    || Object.hasOwn(row,"registrationToken")));
  if (!hasMetadata) return null;
  if (replaceEvent || forceReplace) invalid("Los programas vinculados con Mi Levitate no admiten reemplazo forzado de eventos o evaluaciones.");
  if (!routines.length || routines.length > 600) invalid("El programa vinculado debe contener entre 1 y 600 coreografías.");
  let token = "", registrationEventId = "";
  const danceIds = new Set(), sourceIds = new Set();
  const links = [];
  for (const row of routines) {
    const danceId = text(row?.registrationDanceID), eventId = text(row?.registrationEventID);
    const candidateToken = text(row?.registrationToken), sourceRoutineId = text(row?.id);
    if (!dancePattern.test(danceId) || !eventPattern.test(eventId) || !tokenPattern.test(candidateToken)
      || !routinePattern.test(sourceRoutineId)) invalid();
    if (token && (candidateToken !== token || eventId !== registrationEventId)) {
      invalid("El archivo mezcla ediciones o autorizaciones de Mi Levitate. Exporta una sola edición por programa.");
    }
    if (danceIds.has(danceId) || sourceIds.has(sourceRoutineId)) invalid("El programa contiene identificadores de coreografía repetidos.");
    token = candidateToken; registrationEventId = eventId;
    danceIds.add(danceId); sourceIds.add(sourceRoutineId);
    links.push({ danceId, sourceRoutineId });
  }
  return { token, registrationEventId, routines: links };
}

/** Prevent reserved capability cells from leaking through a custom public alias. */
export function assertRegistrationTokenPrivate(value, token) {
  const visit = input => {
    if (typeof input === "string" && input.includes(token)) invalid("La autorización de vinculación aparece fuera de su columna reservada. Revisa el archivo y vuelve a exportarlo.");
    if (Array.isArray(input)) { for (const item of input) visit(item); }
    else if (input && typeof input === "object") {
      for (const item of Object.values(input)) visit(item);
    }
  };
  visit(value);
}

/** The token is scoped to one exported programme; never forward app/admin keys. */
export async function postRegistrationLink(link, sourceEventId, { fetcher = fetch, timeoutMs = 15000 } = {}) {
  if (!link || !sourceEventPattern.test(sourceEventId)) invalid();
  const verified = collectRegistrationLink(link.routines.map(row => ({ id: row.sourceRoutineId,
    registrationDanceID: row.danceId, registrationEventID: link.registrationEventId, registrationToken: link.token })));
  if (!verified) invalid();
  const duration = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(15000, Math.floor(timeoutMs))) : 15000;
  const controller = new AbortController(); let timer;
  const failure = () => new RegistrationLinkError("El programa se importó en jueceo, pero no se pudo confirmar su vinculación con Mi Levitate. Reintenta la conexión sin reemplazar las evaluaciones existentes.", 502);
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(callbackUrl, { method: "POST", redirect: "manual", signal: controller.signal,
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ ...verified, sourceEventId }) });
        if (!response?.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json")) throw failure();
        const reader = response.body?.getReader();
        if (!reader) throw failure();
        const chunks = []; let size = 0;
        try {
          for (;;) {
            const { value, done } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > 4096) { await reader.cancel(); throw failure(); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
        const acknowledgement = JSON.parse(new TextDecoder().decode(bytes));
        if (acknowledgement?.ok !== true || (acknowledgement.linked !== undefined
          && acknowledgement.linked !== verified.routines.length)) throw failure();
        return true;
      })(),
      new Promise((resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(failure()); }, duration); }),
    ]);
  } catch { throw failure(); }
  finally { clearTimeout(timer); }
}
