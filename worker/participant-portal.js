import { Buffer } from "node:buffer";
import { PHOTO_WATERMARK_VERSION, validatePreparedParticipantPhoto } from "./participant-photo.js";
import { prepareParticipantDemoPhoto, readParticipantDemoPhotos } from "./participant-demo-media.js";
import { participantDemoMediaDefinitions } from "../shared/participant-demo-media.js";
import { syncParticipantDrivePhotos } from "./participant-drive-sync.js";
import { PHOTO_PREVIEW_LIMIT, preferredPhotoDance } from "./participant-photo-priority.js";
import { processParticipantPhoto } from "./participant-photo-process.js";
import { enrichParticipantJudging } from "./participant-judging.js";
import { issueParticipantProgramLink, completeParticipantProgramLink } from "./participant-program-link.js";
import { createBlockPublicationGate, getBlockPublication, saveBlockPublicationMode, closeParticipantBlock, reopenParticipantBlock } from "./participant-block-publication.js";
import { getReleasedJudgingSheetJudgeIds } from './judging-sheet-release.js';
import { ensureParticipantGuest, issueParticipantGuestAccess, linkRegisteredReleve } from "./participant-guests.js";

const cookieName = "levitate_participant_session";
const sessionSeconds = 60 * 60 * 24 * 7;
const fileLimit = 8 * 1024 * 1024;
const photoFileLimit = 1024 * 1024;
const bodyLimit = 18 * 1024 * 1024;
const venues = new Set(["cdmx", "puebla", "edomex", "veracruz"]);
const medals = new Set(["oro", "plata", "bronce", "participacion"]);
const assetKinds = new Set(["photo", "diploma", "judge_sheet"]);
const encoder = new TextEncoder();
const fault = (code, message, status = 400) => { throw Object.assign(new Error(message), { code, statusCode: status }); };
const str = (value, name, maximum = 300, optional = false) => {
  if (optional && (value == null || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) fault("portal_invalid_input", `Revisa ${name}.`);
  return value.trim();
};
const bool = (value) => value === true;
const parsed = (value) => { try { return JSON.parse(value); } catch { return null; } };
const assetUrl = (id) => `/api/participant/assets/${encodeURIComponent(id)}`;
const adminAssetUrl = (id) => `/api/registration/admin/participant-portal?assetId=${encodeURIComponent(id)}`;
const pendingJudging = () => ({ source: 'jueceocore', sourceStatus: 'pending', status: 'pending', judges: [] });
function retainReleasedJudging(judging, releasedJudgeIds) {
  if (judging?.source !== 'jueceocore' || judging.status !== 'available' || judging.preview !== false
    || judging.pdf?.preview !== false || !Array.isArray(judging.judges) || !Array.isArray(judging.pdf.judges)) return pendingJudging();
  const approved = new Set(releasedJudgeIds);
  const completePdfIds = new Set(judging.pdf.judges.filter(judge => judge.status === 'complete' && approved.has(judge.id)).map(judge => judge.id));
  const judges = judging.judges.filter(judge => judge.status === 'complete' && completePdfIds.has(judge.id));
  if (!judges.length) return pendingJudging();
  const ids = new Set(judges.map(judge => judge.id));
  return { ...judging, judges, pdf: { ...judging.pdf, judges: judging.pdf.judges.filter(judge => ids.has(judge.id)) } };
}
const headers = { "cache-control": "private, no-store", vary: "Cookie", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" };
const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), {
  status, headers: { ...headers, "content-type": "application/json; charset=utf-8", ...extra },
});
const id = () => crypto.randomUUID();
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
async function hash(value) {
  const buffer = typeof value === "string" ? encoder.encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function cookie(token, expires = false) {
  return `${cookieName}=${token}; Path=/api/participant; HttpOnly; Secure; SameSite=Strict; Max-Age=${expires ? 0 : sessionSeconds}`;
}
function readCookie(request) {
  const entry = (request.headers.get("cookie") || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${cookieName}=`));
  return entry?.slice(cookieName.length + 1) || "";
}
function method(request, allowed) {
  if (!allowed.includes(request.method)) fault("portal_method_not_allowed", "Método no permitido.", 405);
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) fault("portal_origin_forbidden", "Esta solicitud no está permitida.", 403);
  }
}
async function body(request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") fault("portal_invalid_input", "Envía los datos en formato JSON.", 415);
  if (Number(request.headers.get("content-length")) > bodyLimit) fault("portal_file_too_large", "El archivo supera el tamaño permitido.", 413);
  const reader = request.body?.getReader();
  if (!reader) fault("portal_invalid_input", "Faltan los datos.");
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > bodyLimit) { await reader.cancel(); fault("portal_file_too_large", "El archivo supera el tamaño permitido.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const value = parsed(new TextDecoder().decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) fault("portal_invalid_input", "No pudimos leer los datos.");
  return value;
}
async function all(db, sql, ...bindings) { return (await db.prepare(sql).bind(...bindings).all()).results || []; }
async function first(db, sql, ...bindings) { return db.prepare(sql).bind(...bindings).first(); }
async function eventById(db, eventId) {
  const event = await first(db, "SELECT * FROM participant_portal_events WHERE id = ?", eventId);
  if (!event) fault("portal_event_not_found", "No se encontró la edición.", 404);
  return event;
}
async function participantById(db, participantId) {
  const participant = await first(db, `SELECT p.*, a.name AS academy_name FROM participant_portal_people p
    JOIN registration_academies a ON a.id = p.academy_id WHERE p.id = ?`, participantId);
  if (!participant) fault("portal_participant_not_found", "No se encontró al participante.", 404);
  return participant;
}
async function routineById(db, routineId) {
  const routine = await first(db, "SELECT * FROM participant_portal_routines WHERE id = ?", routineId);
  if (!routine) fault("portal_routine_not_found", "No se encontró la participación.", 404);
  return routine;
}
async function session(db, request) {
  const token = readCookie(request);
  if (!token || !/^[\w-]{43}$/.test(token)) fault("portal_session_missing", "Abre el enlace personal de tu diploma.", 401);
  const grant = await first(db, `SELECT * FROM participant_portal_authenticated_access
    WHERE session_token_hash = ? AND expires_at > datetime('now') AND active = 1`, await hash(token));
  if (!grant) fault("portal_session_invalid", "Tu acceso expiró o fue reemplazado. Abre tu enlace personal.", 401);
  return grant;
}
function score(value, maximum, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0
    || typeof maximum !== "number" || !Number.isFinite(maximum) || maximum <= 0 || value > maximum) {
    fault("portal_invalid_score", `Revisa el puntaje de ${label}.`);
  }
  return value;
}
export function normalizePortalResult(input) {
  if (input == null) return null;
  const value = score(input.score, input.maxScore, "la participación");
  if (!medals.has(input.medal)) fault("portal_invalid_medal", "Selecciona la medalla oficial.");
  if (typeof input.directCompetition !== "boolean" || !Number.isInteger(input.eligibleCount) || input.eligibleCount < 1) {
    fault("portal_invalid_competition", "Revisa los datos de competencia directa.");
  }
  const place = input.place ?? null;
  if (place !== null && (![1, 2, 3].includes(place) || !input.directCompetition || input.eligibleCount < 2 || place > input.eligibleCount)) {
    fault("portal_invalid_placement", "Los lugares 1, 2 y 3 requieren competencia directa.");
  }
  return { score: value, maxScore: input.maxScore, medal: input.medal, directCompetition: input.directCompetition, eligibleCount: input.eligibleCount, place };
}
export function normalizePortalJudging(input) {
  if (input == null) return null;
  if (!Array.isArray(input.judges) || !input.judges.length || input.judges.length > 20) fault("portal_invalid_judging", "Revisa las hojas de jueceo.");
  return { judges: input.judges.map((judge) => {
    if (!Array.isArray(judge.criteria) || !judge.criteria.length || judge.criteria.length > 100) fault("portal_invalid_judging", "Revisa los criterios de jueceo.");
    return { name: str(judge.name, "el nombre del juez", 200), score: score(judge.score, judge.maxScore, "jueceo"), maxScore: judge.maxScore,
      criteria: judge.criteria.map((criterion) => ({ label: str(criterion.label, "el criterio", 200), score: score(criterion.score, criterion.maxScore, "un criterio"), maxScore: criterion.maxScore })),
      feedback: str(judge.feedback, "las observaciones", 5000, true) };
  }) };
}
function pendingResult() { return { status: "pending", score: null, maxScore: null, medal: null, directCompetition: false, eligibleCount: null, place: null }; }
function portalResult(row, event, adminPreview) {
  if ((!adminPreview && (!event.published || row.status !== "published")) || !row.result_json) return pendingResult();
  try { const result = normalizePortalResult(parsed(row.result_json)); return result ? { status: "published", ...result } : pendingResult(); } catch { return pendingResult(); }
}
async function me(db, env, request, getJudgingSnapshot) {
  const grant = await session(db, request);
  const requested = new URL(request.url).searchParams.get("eventId");
  if (requested && requested !== grant.event_id) fault("portal_event_not_found", "No se encontró la edición.", 404);
  const data = await participantData(db, env, grant.participant_id, grant.event_id, false, getJudgingSnapshot);
  await session(db, request); // An access replaced while Core responded cannot finish the old request.
  return json(data);
}
// The preview flag is supplied only by the authenticated admin route. Participant
// requests always derive both IDs from their grant and use publication checks.
async function participantData(db, env, participantId, eventId, adminPreview = false, getJudgingSnapshot) {
  const participant = await participantById(db, participantId);
  const event = await eventById(db, eventId);
  if (participant.is_guest && participant.portal_event_id !== event.id) fault("portal_event_not_found", "No se encontró la edición.", 404);
  const link = adminPreview ? adminAssetUrl : assetUrl;
  const publication = adminPreview ? null : await createBlockPublicationGate({ db, eventId: event.id });
  const automaticCompletion = publication?.mode === "block_complete";
  const routineVisibility = automaticCompletion ? "coalesce(r.publication_blocked,0)=0" : "r.status='published'";
  // Registration has a venue but no edition field. Never infer that a future
  // edition at the same venue should inherit the current registration roster.
  const registrationEvents = typeof env.PARTICIPANT_REGISTRATION_EVENT_IDS === "string"
    ? env.PARTICIPANT_REGISTRATION_EVENT_IDS.split(",").map((value) => value.trim()).filter(Boolean) : [];
  const registrationFallback = registrationEvents.includes(event.id);
  // Registration membership already identifies the participant's presentations.
  // An edition-specific curated record adds results/assets; its absence should
  // not hide the registered presentation or create records during this GET.
  const rows = await all(db, `SELECT r.*, d.id AS registration_dance_id, d.academy_id AS registration_academy_id,
    d.venue AS registration_venue, d.program_json AS registration_program_json, d.title, d.genre, d.subgenre, d.category, d.level, p.division,
    (SELECT COUNT(*) FROM registration_dance_participants members WHERE members.dance_id = d.id) AS participant_count
    FROM participant_portal_memberships dp JOIN registration_dances d ON d.id = dp.dance_id
    JOIN participant_portal_people p ON p.id = dp.participant_id
    LEFT JOIN participant_portal_routines r ON r.dance_id = d.id AND r.event_id = ?
    WHERE dp.participant_id = ? AND (r.id IS NOT NULL OR (? = 1 AND d.venue = ?))
    ORDER BY d.title, d.id`, event.id, participant.id, registrationFallback ? 1 : 0, event.venue);
  const photoDances = rows.filter(row => row.registration_academy_id === participant.academy_id && row.registration_venue === event.venue);
  const photoDanceId = preferredPhotoDance(photoDances)?.registration_dance_id ?? null;
  const assets = adminPreview || event.published ? await all(db, `SELECT a.* FROM participant_portal_assets a
    JOIN participant_portal_routines r ON r.id = a.routine_id AND r.event_id = a.event_id
    JOIN participant_portal_memberships dp ON dp.dance_id = r.dance_id
    WHERE a.event_id = ? AND dp.participant_id = ?
      AND (a.kind = 'judge_sheet' OR (a.kind = 'photo' AND r.dance_id = ?))
      ${adminPreview ? "" : `AND a.published = 1 AND ${routineVisibility} AND (a.kind = 'judge_sheet' OR r.photos_published = 1)`}
    ORDER BY a.created_at DESC,a.id DESC`, event.id, participant.id, photoDanceId) : [];
  const document = await first(db, `SELECT d.asset_id FROM participant_portal_documents d
    JOIN participant_portal_assets a ON a.id = d.asset_id
    WHERE d.participant_id = ? AND d.event_id = ? ${adminPreview ? "" : "AND d.published = 1 AND a.published = 1"}
      AND a.kind = 'diploma' AND a.participant_id = d.participant_id AND a.event_id = d.event_id`, participant.id, event.id);
  const diplomaAvailable = Boolean((adminPreview || event.published) && document);
  // Existing issued QR grants also explicitly associate records without a
  // choreography to this edition; keep those participants in the automation.
  const issuedParticipant = registrationFallback && !rows.length && (adminPreview || event.published)
    ? await first(db,'SELECT id FROM participant_portal_grants WHERE participant_id=? AND event_id=? AND active=1 LIMIT 1',participant.id,event.id) : null;
  const automaticDiploma = Boolean(!document && (adminPreview || event.published) && registrationFallback && (rows.length || issuedParticipant));
  const data = { ...(adminPreview ? { adminPreview: true } : {}),
    participant: { id: participant.id, name: participant.full_name, academy: participant.academy_name },
    events: [{ id: event.id, title: event.title, season: event.season, venue: event.venue, startsAt: event.starts_at }], selectedEventId: event.id,
    diploma: diplomaAvailable ? { status: "available", assetId: document.asset_id, url: link(document.asset_id) }
      : automaticDiploma ? { status: "available", assetId: null, url: null, generator: {
        name: participant.full_name, academy: participant.academy_name, eventTitle: event.title,
        season: event.season, venue: event.venue, dateLabel: event.starts_at?.slice(0,10) || '',
        preview: Boolean(adminPreview), templateUrl: '/assets/participant-recognition-template.pdf',
      } } : { status: "pending", assetId: null, url: null },
    routines: rows.map((row) => {
      const program = parsed(row.registration_program_json);
      const division = program?.eventId === event.id && typeof program.division === "string" ? program.division : row.division;
      const visible = Boolean(adminPreview || (event.published && (automaticCompletion ? !row.publication_blocked : row.status === "published")));
      const judging = visible ? parsed(row.judging_json) : null;
      const sheet = visible ? assets.find((asset) => asset.routine_id === row.id && asset.kind === "judge_sheet") : null;
      const photos = visible && (adminPreview || row.photos_published)
        ? assets.filter((asset) => asset.routine_id === row.id && asset.kind === "photo").slice(0, PHOTO_PREVIEW_LIMIT) : [];
      return { id: row.id || `registration:${row.registration_dance_id}`, eventId: event.id, title: row.title, genre: row.genre, subgenre: row.subgenre, category: row.category, division, level: row.level,
        result: portalResult(row, event, adminPreview),
        judging: { status: judging || sheet ? "available" : "pending", judges: judging?.judges || [], ...(sheet ? { assetId: sheet.id, url: link(sheet.id) } : {}) },
        photos: { status: photos.length ? "available" : "pending", count: photos.length,
          items: photos.map((asset) => ({ id: asset.id, previewUrl: link(asset.id), ...(asset.allow_download ? { downloadUrl: `${link(asset.id)}${adminPreview ? "&" : "?"}download=1` } : {}), width: asset.width, height: asset.height, caption: asset.caption })) } };
    }) };
  let enriched = data;
  const snapshots = new Map();
  let source;
  if (getJudgingSnapshot) {
    source = await first(db, "SELECT source_event_id,enabled FROM participant_portal_judging_sources WHERE event_id=?", event.id);
    enriched = await enrichParticipantJudging({ data, rows, event: { ...event, automatic_judging: source?.enabled === 1, automatic_results: source?.enabled === 1 }, adminPreview,
      sourceEventId: source?.source_event_id,
      getReleasedJudgeIds: options => getReleasedJudgingSheetJudgeIds({ ...options, db }),
      getSnapshot: source && !source.enabled ? undefined : (sourceEventId,options) => {
        const snapshot = Promise.resolve().then(() => getJudgingSnapshot(sourceEventId,{...options,trustedEventId:source?.source_event_id}));
        snapshots.set(sourceEventId.toLowerCase(), snapshot);
        return snapshot;
      } });
  }
  if (!adminPreview) {
    const sourceJudging = new Map(enriched.routines.map(routine => [routine.id, routine.judging]));
    if (publication.mode === "block_close" || automaticCompletion) {
      enriched = { ...enriched, routines: await Promise.all(enriched.routines.map(async routine => {
        const row = rows.find(value => (value.id || `registration:${value.registration_dance_id}`) === routine.id);
        const sourceEventId = row?.source_event_id || source?.source_event_id || "";
        const sourceRoutineId = row?.source_routine_id || row?.registration_dance_id || "";
        let allowed = false;
        if (event.published && row && (automaticCompletion ? !row.publication_blocked : row.status === "published") && sourceEventId && sourceRoutineId) {
          try {
            const snapshot = await snapshots.get(sourceEventId.toLowerCase());
            allowed = await publication.allowsRoutine({ sourceEventId, sourceRoutineId,
              danceId: row.registration_dance_id, snapshot });
          } catch { /* A missing or changed evaluation keeps the block private. */ }
        }
        return allowed ? routine : { ...routine, result: pendingResult(),
          judging: { source: "jueceocore", sourceStatus: "pending", status: "pending", judges: [] },
          photos: { status: "pending", count: 0, items: [] } };
      })) };
      // Recheck publication flags after every upstream read/hash. These two
      // bounded reads also cover withdrawals made while Core was responding.
      const [currentRows, currentAssets] = await Promise.all([
        all(db, `SELECT r.id,r.photos_published FROM participant_portal_routines r
          JOIN participant_portal_events e ON e.id=r.event_id
          JOIN participant_portal_memberships dp ON dp.dance_id=r.dance_id
          WHERE r.event_id=? AND dp.participant_id=? AND e.published=1 AND ${routineVisibility}`, event.id, participant.id),
        all(db, `SELECT a.id,a.allow_download FROM participant_portal_assets a
          JOIN participant_portal_routines r ON r.id=a.routine_id AND r.event_id=a.event_id
          JOIN participant_portal_memberships dp ON dp.dance_id=r.dance_id
          WHERE a.event_id=? AND dp.participant_id=? AND a.published=1`, event.id, participant.id),
      ]);
      const confirmed = await publication.confirm();
      const permissions = new Map(currentRows.map(row => [row.id, row]));
      const approved = new Map(currentAssets.map(asset => [asset.id, asset]));
      enriched = { ...enriched, routines: enriched.routines.map(routine => {
        const permission = confirmed ? permissions.get(routine.id) : null;
        if (!permission) return { ...routine, result: pendingResult(),
          judging: { source: "jueceocore", sourceStatus: "pending", status: "pending", judges: [] },
          photos: { status: "pending", count: 0, items: [] } };
        const items = permission.photos_published ? routine.photos.items.filter(photo => approved.has(photo.id)).map(photo => {
          if (approved.get(photo.id).allow_download) return photo;
          const { downloadUrl, ...preview } = photo;
          return preview;
        }) : [];
        let judging = routine.judging;
        if (judging.assetId && !approved.has(judging.assetId)) {
          const { assetId, url, ...inline } = judging;
          judging = { ...inline, status: inline.judges?.length ? "available" : "pending" };
        }
        return { ...routine, judging, photos: { ...routine.photos, status: items.length ? "available" : "pending", count: items.length, items } };
      }) };
    } else if (!await publication.confirm()) {
      enriched = { ...enriched, routines: enriched.routines.map(routine => ({ ...routine, result: pendingResult(),
        judging: { sourceStatus: "pending", status: "pending", judges: [] }, photos: { status: "pending", count: 0, items: [] } })) };
    }
    // Recheck the individual approvals after the awaited publication checks.
    // Keep only their intersection with the already projected sheets: another
    // judge's surviving approval cannot authorize a withdrawn or changed sheet.
    enriched = { ...enriched, routines: await Promise.all(enriched.routines.map(async routine => {
      const row = rows.find(value => (value.id || `registration:${value.registration_dance_id}`) === routine.id);
      const sourceEventId = row?.source_event_id || source?.source_event_id || '';
      const sourceRoutineId = row?.source_routine_id || row?.registration_dance_id || '';
      let releasedJudgeIds = [];
      try {
        const snapshot = await snapshots.get(sourceEventId.toLowerCase());
        releasedJudgeIds = await getReleasedJudgingSheetJudgeIds({ db, sourceEventId, sourceRoutineId, snapshot });
      } catch { /* Missing releases and incomplete source reads keep sheets private. */ }
      return { ...routine, judging: event.published && row && !row.publication_blocked
        ? retainReleasedJudging(sourceJudging.get(routine.id), releasedJudgeIds) : pendingJudging() };
    })) };
    const currentMemberships = await all(db, `SELECT m.dance_id,r.publication_blocked,r.source_event_id,r.source_routine_id
      FROM participant_portal_memberships m LEFT JOIN participant_portal_routines r ON r.dance_id=m.dance_id AND r.event_id=?
      WHERE m.participant_id=?`, event.id, participant.id);
    enriched = { ...enriched, routines: enriched.routines.flatMap(routine => {
      const original = rows.find(value => (value.id || `registration:${value.registration_dance_id}`) === routine.id);
      const matches = currentMemberships.filter(value => value.dance_id === original?.registration_dance_id);
      if (matches.length !== 1) return [];
      const current = matches[0];
      const sameSource = (current.source_event_id || '') === (original?.source_event_id || '')
        && (current.source_routine_id || '') === (original?.source_routine_id || '');
      return current.publication_blocked || !sameSource ? [{ ...routine,
        judging: { source: 'jueceocore', sourceStatus: 'pending', status: 'pending', judges: [] } }] : [routine];
    }) };
    const visibleNow = await first(db, "SELECT published FROM participant_portal_events WHERE id=?", event.id);
    const stillAuthorized = await publication.confirm();
    if (!stillAuthorized || (event.published && !visibleNow?.published)) enriched = { ...enriched, diploma: { status: "pending", assetId: null, url: null },
      routines: enriched.routines.map(routine => ({ ...routine, result: pendingResult(),
        judging: { sourceStatus: "pending", status: "pending", judges: [] }, photos: { status: "pending", count: 0, items: [] } })) };
  }
  return enriched;
}
function photoFileName(name) {
  return `${name.replace(/\.[^.]+$/, "").slice(0, 190)}.jpg`;
}
async function resolveMediaStore(env, getMediaStore, options = {}) {
  if (env.PARTICIPANT_MEDIA) return env.PARTICIPANT_MEDIA;
  if (getMediaStore) return getMediaStore(options);
  fault("portal_storage_unavailable", "Prepara el almacenamiento privado de Drive desde administración.", 503);
}
async function photoResponse(asset, object) {
  if (object.customMetadata?.watermarkVersion !== PHOTO_WATERMARK_VERSION || object.size > photoFileLimit) {
    fault("portal_photo_unprepared", "Esta foto debe prepararse de nuevo desde administración.", 409);
  }
  const source = new Uint8Array(await new Response(object.body).arrayBuffer());
  if (source.length > photoFileLimit) fault("portal_file_too_large", "La foto debe prepararse de nuevo desde administración.", 413);
  const preview = await validatePreparedParticipantPhoto(source);
  if (preview.sha256 !== asset.sha256 || preview.width !== asset.width || preview.height !== asset.height) {
    fault("portal_photo_changed", "La foto guardada cambió. Vuelve a cargarla desde administración.", 409);
  }
  return { body: source, size: source.length };
}
async function serveAsset(db, env, request, assetId, admin = false, getMediaStore, getJudgingSnapshot) {
  const grant = admin ? null : await session(db, request);
  const asset = await first(db, "SELECT * FROM participant_portal_assets WHERE id = ?", assetId);
  // Historical uploaded PDFs cannot be tied to the current source grades.
  // Participants receive freshly generated sheets after the manual block release.
  if (!admin && asset?.kind === 'judge_sheet') fault('portal_asset_not_found', 'El archivo no está disponible.', 404);
  let publication;
  if (!admin) {
    if (!asset || asset.event_id !== grant.event_id || !asset.published) fault("portal_asset_not_found", "El archivo no está disponible.", 404);
    const event = await eventById(db, asset.event_id);
    if (!event.published) fault("portal_asset_not_found", "El archivo no está disponible.", 404);
    if (asset.kind === "diploma") {
      const document = await first(db, `SELECT asset_id FROM participant_portal_documents WHERE participant_id = ? AND event_id = ? AND asset_id = ? AND published = 1`, grant.participant_id, grant.event_id, asset.id);
      if (asset.participant_id !== grant.participant_id || !document) fault("portal_asset_not_found", "El archivo no está disponible.", 404);
    } else {
      publication = await createBlockPublicationGate({ db, eventId: event.id });
      const routineVisibility = publication.mode === "block_complete" ? "coalesce(r.publication_blocked,0)=0" : "r.status='published'";
      const membership = await first(db, `SELECT r.id,r.dance_id,r.source_event_id,r.source_routine_id,r.photos_published FROM participant_portal_routines r
        JOIN participant_portal_memberships dp ON dp.dance_id = r.dance_id
        WHERE r.id = ? AND r.event_id = ? AND ${routineVisibility} AND dp.participant_id = ?`, asset.routine_id, grant.event_id, grant.participant_id);
      if (!membership || (asset.kind === "photo" && !membership.photos_published)) fault("portal_asset_not_found", "El archivo no está disponible.", 404);
      if (publication.mode === "block_close" || publication.mode === "block_complete") {
        const source = await first(db, "SELECT source_event_id FROM participant_portal_judging_sources WHERE event_id=? AND enabled=1", event.id);
        let allowed = false;
        if (getJudgingSnapshot && source?.source_event_id && membership.source_event_id === source.source_event_id && membership.source_routine_id) {
          try {
            const snapshot = await getJudgingSnapshot(source.source_event_id, {
              routineIds: [membership.source_routine_id], trustedEventId: source.source_event_id,
            });
            allowed = await publication.allowsRoutine({ sourceEventId: source.source_event_id,
              sourceRoutineId: membership.source_routine_id, danceId: membership.dance_id, snapshot });
          } catch { /* Direct URLs must obey the same release gate as the page. */ }
        }
        if (!allowed) fault("portal_asset_not_found", "El archivo no está disponible.", 404);
      }
    }
    if (asset.kind === "photo" && new URL(request.url).searchParams.get("download") === "1" && !asset.allow_download) {
      fault("portal_download_unavailable", "Esta imagen está disponible como vista previa.", 403);
    }
  }
  if (!asset) fault("portal_asset_not_found", "El archivo no está disponible.", 404);
  const storage = await resolveMediaStore(env, getMediaStore);
  const object = await storage.get(asset.object_key);
  if (!object) fault("portal_asset_not_found", "El archivo no está disponible.", 404);
  const photo = asset.kind === "photo" ? await photoResponse(asset, object) : null;
  if (publication) {
    const routineVisibility = publication.mode === "block_complete" ? "coalesce(r.publication_blocked,0)=0" : "r.status='published'";
    const current = await first(db, `SELECT a.id FROM participant_portal_assets a
      JOIN participant_portal_events e ON e.id=a.event_id
      JOIN participant_portal_routines r ON r.id=a.routine_id AND r.event_id=a.event_id
      JOIN participant_portal_memberships dp ON dp.dance_id=r.dance_id
      JOIN participant_portal_grants g ON g.event_id=e.id AND g.participant_id=dp.participant_id
      WHERE a.id=? AND g.id=? AND g.active=1 AND e.published=1 AND ${routineVisibility} AND a.published=1
        AND (a.kind='judge_sheet' OR (a.kind='photo' AND r.photos_published=1 AND (?=0 OR a.allow_download=1)))`,
      asset.id, grant.id, new URL(request.url).searchParams.get("download") === "1" ? 1 : 0);
    if (!current || !await publication.confirm()) fault("portal_asset_not_found", "El archivo no está disponible.", 404);
  }
  const disposition = asset.kind === "diploma" || new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(photo?.body ?? object.body, { headers: { ...headers, "content-type": photo ? "image/jpeg" : asset.content_type,
    "content-disposition": `${disposition}; filename="${(photo ? photoFileName(asset.file_name) : asset.file_name).replace(/[^a-zA-Z0-9._-]/g, "_")}"`, "content-length": String(photo?.size ?? asset.byte_size) } });
}
async function adminList(db, request) {
  const params = new URL(request.url).searchParams;
  const eventId = params.get("eventId") || "";
  const events = await all(db, "SELECT * FROM participant_portal_events ORDER BY starts_at DESC, id");
  const q = (params.get("q") || "").slice(0, 100);
  const participantId = (params.get("participantId") || "").slice(0, 100);
  const offset = Math.max(0, Math.min(1000000, Number.parseInt(params.get("offset") || "0", 10) || 0));
  const people = await all(db, `SELECT p.id, p.full_name AS name, a.name AS academy FROM participant_portal_people p
    JOIN registration_academies a ON a.id = p.academy_id WHERE (p.full_name LIKE ? OR a.name LIKE ?) AND (? = '' OR p.id = ?)
      AND (p.portal_event_id IS NULL OR p.portal_event_id=?) ORDER BY p.full_name, p.id LIMIT 101 OFFSET ?`, `%${q}%`, `%${q}%`, participantId, participantId, eventId, offset);
  const visiblePeople = people.slice(0, 100);
  const accesses = visiblePeople.length ? await all(db, `SELECT id, participant_id, event_id, active FROM participant_portal_grants
    WHERE participant_id IN (${visiblePeople.map(() => "?").join(",")}) ORDER BY created_at DESC`, ...visiblePeople.map((person) => person.id)) : [];
  const selected = eventId ? await eventById(db, eventId) : null;
  const routineOffset = Math.max(0, Math.min(1000000, Number.parseInt(params.get("routineOffset") || "0", 10) || 0));
  const danceId = params.get("danceId") || "";
  const routineQ = (params.get("routineQ") || "").slice(0,100);
  const routines = selected ? await all(db, `SELECT r.*, d.id AS registration_dance_id, d.title, d.category, d.level, d.genre, d.subgenre,
    (SELECT p.division FROM registration_dance_participants dp JOIN registration_participants p ON p.id = dp.participant_id WHERE dp.dance_id = d.id ORDER BY p.id LIMIT 1) AS division
    FROM registration_dances d LEFT JOIN participant_portal_routines r ON r.dance_id = d.id AND r.event_id = ?
    WHERE d.venue = ? AND (? = '' OR d.id = ?) AND d.title LIKE ? ORDER BY d.title, d.id LIMIT 201 OFFSET ?`, selected.id, selected.venue, danceId, danceId, `%${routineQ}%`, routineOffset) : [];
  const assetOffset = Math.max(0, Math.min(1000000, Number.parseInt(params.get("assetOffset") || "0", 10) || 0));
  const routineId = (params.get("routineId") || "").slice(0,100);
  const assets = selected && (routineId || participantId) ? await all(db, `SELECT id,event_id,routine_id,participant_id,kind,file_name,content_type,byte_size,width,height,caption,allow_download,published
    FROM participant_portal_assets WHERE event_id = ? AND (routine_id = ? OR participant_id = ?)
    ORDER BY created_at DESC,id LIMIT 501 OFFSET ?`, selected.id,routineId || null,participantId || null,assetOffset) : [];
  return json({ events: events.map((event) => ({ id: event.id, title: event.title, season: event.season, venue: event.venue, startsAt: event.starts_at, published: Boolean(event.published) })),
    participants: visiblePeople.map((person) => ({ ...person, accesses: accesses.filter((access) => access.participant_id === person.id).map((access) => ({ id: access.id, eventId: access.event_id, active: Boolean(access.active) })) })),
    pagination: { offset, limit: 100, hasMore: people.length > 100 },
    routinePagination: { offset: routineOffset, limit: 200, hasMore: routines.length > 200 },
    assetPagination: { offset: assetOffset, limit: 500, hasMore: assets.length > 500 },
    routines: routines.slice(0,200).map((row) => ({ id: row.id || null, danceId: row.registration_dance_id, eventId: selected.id, title: row.title, genre: row.genre, subgenre: row.subgenre, category: row.category, division: row.division, level: row.level,
      sourceEventId: row.source_event_id || "", sourceRoutineId: row.source_routine_id || "", status: row.status || "unassigned", publicationBlocked: Boolean(row.publication_blocked), revision: row.revision || 0, result: parsed(row.result_json), judging: parsed(row.judging_json), photosPublished: Boolean(row.photos_published) })),
    assets: assets.slice(0,500).map((asset) => ({ id: asset.id, eventId: asset.event_id, routineId: asset.routine_id, participantId: asset.participant_id, kind: asset.kind, fileName: asset.file_name, contentType: asset.content_type, byteSize: asset.byte_size, width: asset.width, height: asset.height, caption: asset.caption, allowDownload: Boolean(asset.allow_download), published: Boolean(asset.published) })) });
}
function detectType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137,80,78,71,13,10,26,10].every((byte, i) => bytes[i] === byte)) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}
async function uploadAsset(db, env, input, getMediaStore) {
  const event = await eventById(db, str(input.eventId, "la edición", 100));
  if (!assetKinds.has(input.kind)) fault("portal_invalid_asset", "Revisa el tipo de archivo.");
  const routine = input.kind !== "diploma" ? await routineById(db, str(input.routineId, "la participación", 100)) : null;
  const participant = input.kind === "diploma" ? await participantById(db, str(input.participantId, "el participante", 100)) : null;
  if (participant?.is_guest) fault("portal_guest_document", "Los invitados utilizan su reconocimiento automático.");
  if (routine && routine.event_id !== event.id) fault("portal_invalid_asset", "El archivo no corresponde a esta edición.");
  if (typeof input.base64Data !== "string" || input.base64Data.length > Math.ceil(fileLimit / 3) * 4 || input.base64Data.length % 4 !== 0) fault("portal_invalid_asset", "No pudimos leer el archivo.");
  if (input.kind === "photo" && input.base64Data.length > Math.ceil(photoFileLimit / 3) * 4) fault("portal_file_too_large", "Prepara la foto desde administración antes de cargarla.", 413);
  let bytes;
  try { bytes = Buffer.from(input.base64Data, "base64"); } catch { fault("portal_invalid_asset", "No pudimos leer el archivo."); }
  if (bytes.toString("base64") !== input.base64Data) fault("portal_invalid_asset", "No pudimos leer el archivo.");
  if (!bytes.length || bytes.length > fileLimit) fault("portal_file_too_large", "El documento debe pesar hasta 8 MB.", 413);
  let type = detectType(bytes);
  if (type !== input.contentType || (input.kind === "photo" ? !type?.startsWith("image/") : type !== "application/pdf")) fault("portal_invalid_asset_type", "Usa JPEG, PNG o WebP para fotos y PDF para documentos.");
  let fileName = str(input.fileName, "el nombre del archivo", 200);
  const assetId = input.uploadId == null ? id() : str(input.uploadId, "la clave de carga", 100);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(assetId)) fault("portal_invalid_asset", "Revisa la clave de carga.");
  const preparedPhoto = input.kind === "photo" ? await validatePreparedParticipantPhoto(bytes) : null;
  const digest = preparedPhoto?.sha256 || await hash(bytes);
  const prior = await first(db, "SELECT * FROM participant_portal_assets WHERE id = ?", assetId);
  if (prior) {
    if (prior.sha256 !== digest || prior.event_id !== event.id || prior.kind !== input.kind || prior.routine_id !== (routine?.id || null) || prior.participant_id !== (participant?.id || null)) fault("portal_upload_conflict", "Esa clave corresponde a otro archivo.", 409);
    return json({ assetId: prior.id });
  }
  if (routine && input.kind === "photo") {
    const count = await first(db, "SELECT COUNT(*) AS count FROM participant_portal_assets WHERE routine_id = ? AND kind = 'photo'", routine.id);
    if (count.count >= 100) fault("portal_photo_limit", "Esta participación ya tiene el máximo de imágenes.");
  }
  let width = input.width == null ? null : input.width;
  let height = input.height == null ? null : input.height;
  if ([width, height].some((value) => value !== null && (!Number.isInteger(value) || value < 1 || value > 50000))) fault("portal_invalid_asset", "Revisa las dimensiones del archivo.");
  if (input.kind === "photo") {
    type = preparedPhoto.contentType;
    width = preparedPhoto.width;
    height = preparedPhoto.height;
    fileName = photoFileName(fileName);
  }
  // Trusted administrators prepare marked copies in the browser or offline.
  // The Worker checks their marker/hash and stores those exact immutable bytes.
  const storage = await resolveMediaStore(env, getMediaStore);
  const storageKey = `participant-portal/${event.id}/${assetId}-${digest}${input.kind === "photo" ? `.${PHOTO_WATERMARK_VERSION}` : ""}`;
  const saved = await storage.put(storageKey, bytes, { verifiedSha256: digest, httpMetadata: { contentType: type },
    ...(input.kind === "photo" ? { customMetadata: { watermarkVersion: PHOTO_WATERMARK_VERSION } } : {}) });
  const key = saved?.objectKey || storageKey;
  try {
    await db.prepare(`INSERT INTO participant_portal_assets(id,event_id,routine_id,participant_id,kind,object_key,file_name,content_type,sha256,byte_size,width,height,caption,allow_download)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(assetId,event.id,routine?.id || null,participant?.id || null,input.kind,key,fileName,type,digest,bytes.length,width,height,str(input.caption,"la descripción",500,true),bool(input.allowDownload) ? 1 : 0).run();
  } catch (error) {
    const stored = await first(db,"SELECT * FROM participant_portal_assets WHERE id=?",assetId);
    if (stored?.sha256 === digest && stored.event_id === event.id && stored.kind === input.kind && stored.routine_id === (routine?.id || null) && stored.participant_id === (participant?.id || null)) return json({assetId});
    // Keep recoverable Drive drafts on uncertain D1 writes; retries reuse them.
    if (storage.info?.provider !== "google_drive" && stored?.object_key !== key) await storage.delete(key);
    if (stored) fault("portal_upload_conflict","Esa clave corresponde a otro archivo.",409);
    if (String(error?.message).includes("participant_portal_photo_limit")) fault("portal_photo_limit","Esta participación ya tiene el máximo de imágenes.");
    throw error;
  }
  return json({ assetId });
}
function revisionStatement(db,{routineId,eventId,revision,action,snapshot,actorId}) {
  return db.prepare(`INSERT INTO participant_portal_routine_revisions(id,routine_id,event_id,revision,action,snapshot_json,actor_id)
    VALUES(?,?,?,?,?,?,?)`).bind(id(),routineId,eventId,revision,action,JSON.stringify(snapshot),actorId || null);
}
async function linkJudgingProgram(db, input, actorId, getJudgingSnapshot) {
  const event = await eventById(db, str(input.eventId, "la edición", 100));
  const sourceEventId = str(input.sourceEventId, "el evento de jueceo", 100);
  if (!Array.isArray(input.links) || !input.links.length || input.links.length > 600) fault("portal_invalid_judging_links", "Selecciona un programa válido de hasta 600 coreografías.");
  const danceIds = new Set(), sourceIds = new Set();
  const links = input.links.map(value => {
    const danceId = str(value?.danceId, "la coreografía", 100), sourceRoutineId = str(value?.sourceRoutineId, "la rutina de jueceo", 100);
    if (danceIds.has(danceId) || sourceIds.has(sourceRoutineId)) fault("portal_invalid_judging_links", "El programa contiene coreografías o números duplicados.");
    danceIds.add(danceId); sourceIds.add(sourceRoutineId);
    return { danceId, sourceRoutineId };
  });
  if (!getJudgingSnapshot) fault("portal_judging_unavailable", "La conexión de jueceo no está disponible.", 503);
  const snapshot = await getJudgingSnapshot(sourceEventId);
  if (snapshot?.event?.id !== sourceEventId || !Array.isArray(snapshot.rows)) fault("portal_invalid_judging_links", "No se pudo comprobar el programa de jueceo.");
  const dances = await all(db, `SELECT d.id,d.title,a.name AS academy FROM registration_dances d
    JOIN registration_academies a ON a.id=d.academy_id WHERE d.venue=?`, event.venue);
  const existing = await all(db, "SELECT * FROM participant_portal_routines WHERE event_id=?", event.id);
  const source = await first(db, "SELECT source_event_id FROM participant_portal_judging_sources WHERE event_id=?", event.id);
  if (source && source.source_event_id !== sourceEventId && existing.some(row => row.source_event_id)) fault("portal_judging_link_conflict", "Esta edición ya está vinculada a otro programa. Revisa la conexión antes de reemplazarla.", 409);
  const comparable = value => String(value || "").normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toUpperCase();
  for (const link of links) {
    const dance = dances.find(row => row.id === link.danceId), matching = snapshot.rows.filter(row => row.id === link.sourceRoutineId);
    if (!dance || matching.length !== 1 || comparable(dance.title) !== comparable(matching[0].name) || comparable(dance.academy) !== comparable(matching[0].academy)) {
      fault("portal_invalid_judging_links", "El programa no coincide con las coreografías de esta edición. Usa el mismo archivo que importaste en la aplicación.");
    }
    const current = existing.find(row => row.dance_id === link.danceId);
    if ((current?.source_event_id && (current.source_event_id !== sourceEventId || current.source_routine_id !== link.sourceRoutineId))
      || existing.some(row => row.dance_id !== link.danceId && row.source_event_id === sourceEventId && row.source_routine_id === link.sourceRoutineId)) {
      fault("portal_judging_link_conflict", "Una coreografía ya tiene otra asociación de jueceo. No se modificó el programa.", 409);
    }
  }
  // One atomic batch after every ID, ownership and source row has been checked.
  // Link only; existing scores, drafts, photos, QR grants and source data stay intact.
  const statements = [];
  // D1 accepts at most 100 bound parameters per statement. Group associations
  // into statements of 20 rows while preserving one atomic transaction.
  for (let offset=0; offset<links.length; offset+=20) {
    const group=links.slice(offset,offset+20);
    statements.push(db.prepare(`INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id)
      VALUES ${group.map(()=>"(?,?,?,?,?)").join(",")} ON CONFLICT(event_id,dance_id) DO UPDATE SET source_event_id=excluded.source_event_id,
      source_routine_id=excluded.source_routine_id,updated_at=datetime('now')`)
      .bind(...group.flatMap(link=>[existing.find(row=>row.dance_id===link.danceId)?.id || id(),event.id,link.danceId,sourceEventId,link.sourceRoutineId])));
  }
  statements.push(db.prepare(`INSERT INTO participant_portal_judging_sources(event_id,source_event_id,enabled,updated_by) VALUES(?,?,1,?)
    ON CONFLICT(event_id) DO UPDATE SET source_event_id=excluded.source_event_id,enabled=1,updated_by=excluded.updated_by,updated_at=datetime('now')`)
    .bind(event.id, sourceEventId, actorId || null));
  await db.batch(statements);
  return json({ ok: true, linked: links.length });
}
async function photoTrialContext(db, input) {
  const event = await eventById(db, str(input.eventId, "la edición", 100));
  const participant = await participantById(db, str(input.participantId, "el participante", 100));
  const dances = await all(db, `SELECT d.id,d.title FROM registration_dances d
    JOIN registration_dance_participants dp ON dp.dance_id=d.id
    WHERE dp.participant_id=? AND d.academy_id=? AND d.venue=? ORDER BY d.title,d.id`, participant.id, participant.academy_id, event.venue);
  return { event, participant, dances };
}

async function runPhotoSync(db, env, { participantId, eventId, adminPreview, assertAuthorized, getPhotoDiscovery, getMediaStore }) {
  await assertAuthorized();
  const guest = await first(db, 'SELECT event_id FROM participant_portal_guests WHERE id=?', participantId);
  if (guest) {
    if (guest.event_id !== eventId) fault('portal_event_not_found', 'No se encontró la edición.', 404);
    // Guests can read approved photos of their explicitly assigned dances. Do
    // not run registration-only Drive discovery or create registration records.
    return json({ participantId, eventId, status: 'unavailable', hasMore: false, imported: 0 });
  }
  return json(await syncParticipantDrivePhotos({ db, env, participantId, eventId, adminPreview,
    assertAuthorized, getDiscovery: getPhotoDiscovery, getMediaStore: () => resolveMediaStore(env, getMediaStore),
    processPhoto: ({ bytes, contentType, blur }) => processParticipantPhoto({ images: env.IMAGES, bytes, contentType, blur }),
    uploadPreview: async ({ eventId: edition, routineId, uploadId, bytes, caption, width, height, storage }) => {
      await assertAuthorized();
      const response = await uploadAsset(db, env, { eventId: edition, routineId, uploadId, kind: 'photo',
        fileName: `${uploadId}.jpg`, contentType: 'image/jpeg', base64Data: Buffer.from(bytes).toString('base64'),
        caption, width, height, allowDownload: false }, () => storage);
      return response.json();
    },
  }));
}

/** Seeds one unmarked, approved archival source; generation happens on passport opening. */
async function prepareAutomaticPhotoDemo(db, env, input, getPhotoDiscovery) {
  const { event, participant, dances } = await photoTrialContext(db, input);
  const dance = dances.find(value => value.id === str(input.danceId, 'la coreografía', 100));
  if (!dance) fault('portal_invalid_routine', 'Selecciona una coreografía de este participante y esta sede.');
  if (!getPhotoDiscovery || typeof env.ASSETS?.fetch !== 'function') fault('portal_storage_unavailable', 'La conexión de fotos no está disponible.', 503);
  const source = await env.ASSETS.fetch(new Request('https://levitate.mx/assets/visuals/community-blue-silks.jpg'));
  if (!source.ok) fault('portal_demo_media_unavailable', 'No pudimos abrir la fotografía de prueba.', 503);
  const bytes = new Uint8Array(await source.arrayBuffer());
  if (bytes.length > fileLimit || await hash(bytes) !== 'e4a8b68368dc3c4a8c831bc50798fe128bf874e6c44bb41ed91eafbc937957c2') {
    fault('portal_demo_media_unavailable', 'No pudimos verificar la fotografía de prueba.', 503);
  }
  const discovery = await getPhotoDiscovery();
  const album = await discovery.prepareDemoSource({ eventId: event.id, danceId: dance.id, danceTitle: dance.title,
    participantId: participant.id, participantName: participant.full_name, academyId: participant.academy_id,
    academyName: participant.academy_name, bytes, contentType: 'image/jpeg', fileName: 'AUTO-RAW-DEMO.jpg',
    sha256: 'e4a8b68368dc3c4a8c831bc50798fe128bf874e6c44bb41ed91eafbc937957c2' });
  await db.prepare('UPDATE participant_portal_drive_sync SET next_check_at=NULL WHERE event_id=? AND participant_id=?')
    .bind(event.id, participant.id).run();
  return json({ folder: { id: album.folderId, name: album.folderName, url: album.folderUrl,
    accountEmail: env.PARTICIPANT_MEDIA_DRIVE_ACCOUNT_EMAIL }, participantId: participant.id, eventId: event.id,
    danceId: dance.id, imported: 0, reused: 0,
    previewUrl: `/admin/mi-levitate/resumen?${new URLSearchParams({ eventId: event.id, participantId: participant.id })}` });
}

/** An authenticated, explicit trial. No publication, QR rotation or judging writes. */
async function runPhotoDemoTrial(db, env, input, actorId, getMediaStore) {
  const { event, participant, dances } = await photoTrialContext(db, input);
  const danceId = str(input.danceId, "la coreografía", 100);
  const dance = dances.find(row => row.id === danceId);
  if (!dance) fault("portal_invalid_routine", "Selecciona una coreografía de este participante y esta sede.");
  const storage = await resolveMediaStore(env, getMediaStore);
  if (storage.info?.provider !== "google_drive" || typeof storage.prepareDemoAlbum !== "function") {
    fault("portal_storage_unavailable", "Comprueba la carpeta privada de Drive antes de preparar la prueba.", 503);
  }
  const photos = await readParticipantDemoPhotos(env);
  const album = await storage.prepareDemoAlbum({ eventId: event.id, danceId: dance.id,
    folderName: `${dance.title} · ${participant.full_name}`, photos });
  // The album method returns bytes downloaded from Drive, not the static input.
  if (!Array.isArray(album.photos) || album.photos.length !== participantDemoMediaDefinitions.length) {
    fault("portal_demo_media_unavailable", "No pudimos verificar las fotos de prueba en Drive.", 503);
  }
  const verified = [];
  for (const definition of participantDemoMediaDefinitions) {
    const matches = album.photos.filter(photo => photo.slot === definition.slot);
    if (matches.length !== 1) fault("portal_demo_media_unavailable", "No pudimos verificar las fotos de prueba en Drive.", 503);
    const prepared = await validatePreparedParticipantPhoto(matches[0].bytes);
    if (prepared.sha256 !== definition.sha256 || prepared.width !== definition.width || prepared.height !== definition.height) {
      fault("portal_demo_media_unavailable", "No pudimos verificar las fotos de prueba en Drive.", 503);
    }
    verified.push({ ...definition, bytes: prepared.bytes });
  }
  const current = await photoTrialContext(db, input);
  if (!current.dances.some(row => row.id === dance.id)) fault("portal_invalid_routine", "La participación cambió. Actualiza el panel antes de continuar.", 409);
  let routine = await first(db, "SELECT * FROM participant_portal_routines WHERE event_id=? AND dance_id=?", event.id, dance.id);
  if (!routine) {
    const candidate = id();
    const snapshot = JSON.stringify({ danceId: dance.id, sourceEventId: null, sourceRoutineId: null,
      result: null, judging: null, photosPublished: false, publicationBlocked: false, status: "draft", origin: "drive_demo_trial" });
    await db.batch([
      db.prepare("INSERT INTO participant_portal_routines(id,event_id,dance_id) VALUES(?,?,?) ON CONFLICT(event_id,dance_id) DO NOTHING")
        .bind(candidate, event.id, dance.id),
      db.prepare(`INSERT INTO participant_portal_routine_revisions(id,routine_id,event_id,revision,action,snapshot_json,actor_id)
        SELECT ?,id,event_id,revision,'save',?,? FROM participant_portal_routines WHERE id=?`)
        .bind(id(), snapshot, actorId || null, candidate),
    ]);
    routine = await first(db, "SELECT * FROM participant_portal_routines WHERE event_id=? AND dance_id=?", event.id, dance.id);
  }
  if (!routine) fault("portal_routine_not_found", "No pudimos preparar la participación de prueba.", 409);
  let reused = 0;
  for (const photo of verified) {
    const uploadId = `demo-drive-${await hash(JSON.stringify([event.id, dance.id, photo.slot, photo.sha256]))}`;
    const prior = await first(db, "SELECT id FROM participant_portal_assets WHERE id=?", uploadId);
    await uploadAsset(db, env, { eventId: event.id, routineId: routine.id, kind: "photo", uploadId,
      fileName: `DEMO-${photo.slot}.jpg`, contentType: "image/jpeg", base64Data: Buffer.from(photo.bytes).toString("base64"),
      caption: "Foto de demostración — no corresponde a esta participante.", allowDownload: false }, () => storage);
    if (prior) reused++;
  }
  return json({ folder: { id: album.folderId, name: album.folderName, url: album.folderUrl, accountEmail: album.accountEmail },
    participantId: participant.id, eventId: event.id, danceId: dance.id, routineId: routine.id, imported: verified.length, reused,
    previewUrl: `/admin/mi-levitate/resumen?${new URLSearchParams({ eventId: event.id, participantId: participant.id })}` });
}

async function adminAction(db, env, input, actorId, getMediaStore, getJudgingEventList, getJudgingDirectory, getJudgingSnapshot, getJudgingBlockDirectory) {
  switch (input.action) {
    case "photo.demo.trial": return runPhotoDemoTrial(db, env, input, actorId, getMediaStore);
    case "publication.mode.save": return json(await saveBlockPublicationMode({ db, input, actorId }));
    case "block.close": return json(await closeParticipantBlock({ db, input, actorId, getDirectory: getJudgingBlockDirectory, getSnapshot: getJudgingSnapshot }));
    case "block.reopen": return json(await reopenParticipantBlock({ db, input, actorId }));
    case "judging.program.issue": return json(await issueParticipantProgramLink({db,env,input,actorId}));
    case "judging.program.link": return linkJudgingProgram(db,input,actorId,getJudgingDirectory);
    case "judging.source.save": {
      const event = await eventById(db, str(input.eventId, "la edición", 100));
      const sourceEventId = str(input.sourceEventId, "el evento de jueceo", 100, true);
      if (!sourceEventId) {
        await db.prepare("UPDATE participant_portal_judging_sources SET enabled=0,updated_by=?,updated_at=datetime('now') WHERE event_id=?")
          .bind(actorId || null, event.id).run();
        return json({ ok: true });
      }
      if (!getJudgingEventList) fault("portal_judging_unavailable", "La conexión de jueceo no está disponible.", 503);
      const available = await getJudgingEventList();
      const trusted=await first(db,"SELECT source_event_id FROM participant_portal_judging_sources WHERE event_id=?",event.id);
      if (!available.events?.some(source => source.id === sourceEventId)&&trusted?.source_event_id!==sourceEventId) fault("portal_invalid_judging_source", "Selecciona un evento de Levitate disponible.");
      const previousLinks = await first(db, "SELECT id FROM participant_portal_routines WHERE event_id=? AND source_event_id IS NOT NULL AND source_event_id<>? LIMIT 1", event.id, sourceEventId);
      if (previousLinks) fault("portal_judging_link_conflict", "Esta edición tiene coreografías vinculadas a otro evento de jueceo.", 409);
      await db.prepare(`INSERT INTO participant_portal_judging_sources(event_id,source_event_id,enabled,updated_by) VALUES(?,?,1,?)
        ON CONFLICT(event_id) DO UPDATE SET source_event_id=excluded.source_event_id,enabled=1,updated_by=excluded.updated_by,updated_at=datetime('now')`)
        .bind(event.id, sourceEventId, actorId || null).run();
      return json({ ok: true });
    }
    case "storage.prepare": {
      const storage = await resolveMediaStore(env, getMediaStore, { create: true });
      return json({ mediaStorage: storage.getInfo ? await storage.getInfo() : storage.info || { provider: "configured", ready: true } });
    }
    case "demo.photo.prepare":
      return json(await prepareParticipantDemoPhoto(env, {
        slot: input.slot,
        getMediaStore: () => resolveMediaStore(env, getMediaStore),
      }));
    case "event.upsert": {
      const event = input.event || {};
      const eventId = str(event.id, "la edición", 100);
      if (!/^[a-zA-Z0-9_-]+$/.test(eventId) || !venues.has(event.venue)) fault("portal_invalid_event", "Revisa los datos de la edición.");
      const startsAt = str(event.startsAt, "la fecha", 50, true);
      if (startsAt && Number.isNaN(Date.parse(startsAt))) fault("portal_invalid_event", "Revisa la fecha de la edición.");
      const previous = await first(db,"SELECT published,venue FROM participant_portal_events WHERE id=?",eventId);
      if (previous && previous.venue !== event.venue) {
        const mapping = await first(db,"SELECT id FROM participant_portal_routines WHERE event_id=? LIMIT 1",eventId);
        if (mapping) fault("portal_event_has_routines","Esta edición tiene participaciones vinculadas; conserva su sede.",409);
      }
      await db.prepare(`INSERT INTO participant_portal_events(id,title,season,venue,starts_at,published) VALUES(?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title,season=excluded.season,venue=excluded.venue,starts_at=excluded.starts_at,published=excluded.published,updated_at=datetime('now')`)
        .bind(eventId,str(event.title,"el título"),str(event.season,"la temporada",100),event.venue,startsAt || null,event.published === undefined ? (previous?.published || 0) : bool(event.published) ? 1 : 0).run();
      if (event.published === true && previous?.published === 0) {
        await db.prepare('UPDATE participant_portal_drive_sync SET next_check_at=NULL WHERE event_id=?').bind(eventId).run();
      }
      return json({ eventId });
    }
    case "guest.create":
      return json(await ensureParticipantGuest({ db, input, actorId }));
    case "releve.link":
      return json(await linkRegisteredReleve({ db, input, actorId }));
    case "access.create": {
      const event = await eventById(db, str(input.eventId,"la edición",100));
      const participant = await participantById(db,str(input.participantId,"el participante",100));
      if (participant.is_guest) return json(await issueParticipantGuestAccess({ db, guestId: participant.id, eventId: event.id, rotate: input.rotate === true }));
      const previous = await first(db,"SELECT id FROM participant_portal_access WHERE participant_id = ? AND event_id = ? AND active = 1",participant.id,event.id);
      if (previous && input.rotate !== true) fault("portal_access_exists","Ya existe un enlace activo. Elige reemplazarlo para crear otro.",409);
      const accessId = id(), token = randomToken();
      const insert=db.prepare("INSERT INTO participant_portal_access(id,participant_id,event_id,token_hash) VALUES(?,?,?,?)").bind(accessId,participant.id,event.id,await hash(token));
      if (input.rotate === true) await db.batch([
        db.prepare("UPDATE participant_portal_access SET active=0,revoked_at=datetime('now') WHERE participant_id=? AND event_id=? AND active=1").bind(participant.id,event.id),insert,
      ]);
      else try { await insert.run(); } catch (error) {
        const active = await first(db,"SELECT id FROM participant_portal_access WHERE participant_id=? AND event_id=? AND active=1",participant.id,event.id);
        if (active) fault("portal_access_exists","Ya existe un enlace activo. Elige reemplazarlo para crear otro.",409);
        throw error;
      }
      return json({ id: accessId, token, entryUrl: `/mi-levitate#access=${token}` });
    }
    case "access.revoke": {
      const accessId = str(input.accessId,"el acceso",100);
      const access = await first(db, 'SELECT is_guest FROM participant_portal_grants WHERE id=?', accessId);
      const table = access?.is_guest ? 'participant_portal_guest_access' : 'participant_portal_access';
      await db.prepare(`UPDATE ${table} SET active=0,revoked_at=datetime('now') WHERE id=?`).bind(accessId).run();
      return json({ ok:true });
    }
    case "routine.save": {
      const event = await eventById(db,str(input.eventId,"la edición",100));
      const dance = await first(db,"SELECT id,venue FROM registration_dances WHERE id=?",str(input.danceId,"la coreografía",100));
      if (!dance || dance.venue !== event.venue) fault("portal_invalid_routine","La coreografía no corresponde a esta sede.");
      const result = normalizePortalResult(input.result), judging = normalizePortalJudging(input.judging);
      const previous = await first(db,"SELECT id,revision,source_event_id,source_routine_id,publication_blocked FROM participant_portal_routines WHERE event_id=? AND dance_id=?",event.id,dance.id);
      const hasSourceEvent = Object.hasOwn(input,"sourceEventId"), hasSourceRoutine = Object.hasOwn(input,"sourceRoutineId");
      if (hasSourceEvent !== hasSourceRoutine) fault("portal_invalid_routine","Vincula el evento y la rutina de jueceo juntos.");
      const sourceEvent = hasSourceEvent ? str(input.sourceEventId,"el evento de jueceo",100,true) : previous?.source_event_id || "";
      const sourceRoutine = hasSourceRoutine ? str(input.sourceRoutineId,"la rutina de jueceo",100,true) : previous?.source_routine_id || "";
      if (Boolean(sourceEvent) !== Boolean(sourceRoutine)) fault("portal_invalid_routine","Vincula el evento y la rutina de jueceo juntos.");
      const routineId = previous?.id || id();
      const revision = (previous?.revision || 0) + 1;
      const snapshot = {danceId:dance.id,sourceEventId:sourceEvent || null,sourceRoutineId:sourceRoutine || null,result,judging,photosPublished:bool(input.photosPublished),publicationBlocked:Boolean(previous?.publication_blocked),status:'draft'};
      await db.batch([
        db.prepare(`INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id,result_json,judging_json,photos_published,revision)
          VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(event_id,dance_id) DO UPDATE SET source_event_id=excluded.source_event_id,source_routine_id=excluded.source_routine_id,
          result_json=excluded.result_json,judging_json=excluded.judging_json,photos_published=excluded.photos_published,status='draft',revision=excluded.revision,updated_at=datetime('now')`)
          .bind(routineId,event.id,dance.id,sourceEvent || null,sourceRoutine || null,result ? JSON.stringify(result) : null,judging ? JSON.stringify(judging) : null,bool(input.photosPublished) ? 1 : 0,revision),
        revisionStatement(db,{routineId,eventId:event.id,revision,action:'save',snapshot,actorId}),
        db.prepare(`INSERT INTO participant_portal_drive_album_settings(event_id,dance_id,publication_paused) VALUES(?,?,?)
          ON CONFLICT(event_id,dance_id) DO UPDATE SET publication_paused=excluded.publication_paused`)
          .bind(event.id,dance.id,bool(input.photosPublished) ? 0 : 1),
        db.prepare(`UPDATE participant_portal_drive_sync SET next_check_at=NULL WHERE event_id=?
          AND participant_id IN(SELECT participant_id FROM registration_dance_participants WHERE dance_id=?)`)
          .bind(event.id,dance.id),
      ]);
      return json({ routineId });
    }
    case "routine.publish":
    case "routine.unpublish": {
      const routine = await routineById(db,str(input.routineId,"la participación",100));
      if (input.action === "routine.publish") {
        normalizePortalResult(parsed(routine.result_json)); normalizePortalJudging(parsed(routine.judging_json));
      }
      const status = input.action === "routine.publish" ? "published" : "draft";
      const blocked = input.action === "routine.unpublish" ? 1 : 0;
      const snapshot = {danceId:routine.dance_id,sourceEventId:routine.source_event_id,sourceRoutineId:routine.source_routine_id,result:parsed(routine.result_json),judging:parsed(routine.judging_json),photosPublished:Boolean(routine.photos_published),publicationBlocked:Boolean(blocked),status};
      await db.batch([
        db.prepare("UPDATE participant_portal_routines SET status=?,publication_blocked=?,updated_at=datetime('now') WHERE id=?").bind(status,blocked,routine.id),
        revisionStatement(db,{routineId:routine.id,eventId:routine.event_id,revision:routine.revision,action:status==='published'?'publish':'unpublish',snapshot,actorId}),
      ]);
      return json({ ok:true });
    }
    case "asset.upload": return uploadAsset(db,env,input,getMediaStore);
    case "asset.publish": {
      const asset = await first(db,"SELECT id FROM participant_portal_assets WHERE id=?",str(input.assetId,"el archivo",100));
      if (!asset) fault("portal_asset_not_found","No se encontró el archivo.",404);
      await db.batch([
        db.prepare("UPDATE participant_portal_assets SET published=? WHERE id=?").bind(bool(input.published) ? 1 : 0,asset.id),
        db.prepare('UPDATE participant_portal_drive_files SET publication_policy=? WHERE asset_id=?')
          .bind(bool(input.published) ? 'automatic' : 'held',asset.id),
      ]);
      return json({ ok:true });
    }
    case "document.assign": {
      const event = await eventById(db,str(input.eventId,"la edición",100));
      const participant = await participantById(db,str(input.participantId,"el participante",100));
      const asset = await first(db,"SELECT * FROM participant_portal_assets WHERE id=?",str(input.assetId,"el archivo",100));
      if (!asset || asset.kind !== "diploma" || asset.event_id !== event.id || asset.participant_id !== participant.id) fault("portal_invalid_document","El diploma no corresponde al participante y la edición.");
      await db.prepare(`INSERT INTO participant_portal_documents(participant_id,event_id,asset_id,published) VALUES(?,?,?,?)
        ON CONFLICT(participant_id,event_id) DO UPDATE SET asset_id=excluded.asset_id,published=excluded.published,updated_at=datetime('now')`)
        .bind(participant.id,event.id,asset.id,bool(input.published) ? 1 : 0).run();
      return json({ ok:true });
    }
    default: fault("portal_invalid_action","Selecciona una acción válida.");
  }
}
export async function handleParticipantPortal(request, env, { requireAdmin, getMediaStore, getPhotoDiscovery, getJudgingSnapshot, getJudgingEventList, getJudgingDirectory, getJudgingBlockDirectory } = {}) {
  try {
    const db = env.DB;
    if (!db) fault("portal_unavailable","El portal no está disponible por el momento.",503);
    const url = new URL(request.url), path = url.pathname;
    if(path==='/api/integrations/jueceocore/program'){
      method(request,['POST']);
      return json(await completeParticipantProgramLink({db,env,input:await body(request),getJudgingDirectory}));
    }
    if (path === "/api/registration/admin/participant-portal") {
      method(request,["GET","POST"]);
      if (!requireAdmin) fault("portal_admin_forbidden","Inicia sesión como administrador.",401);
      const admin = request.method === "GET"
        ? await requireAdmin(request,env,db,{touchLastSeen:false})
        : await requireAdmin(request,env,db);
      if (request.method === "GET") {
        if (url.searchParams.get("photoTrial") === "1") {
          const context = await photoTrialContext(db, { eventId: url.searchParams.get("eventId"), participantId: url.searchParams.get("participantId") });
          return json({ routines: context.dances.map(dance => ({ danceId: dance.id, title: dance.title })) });
        }
        if (url.searchParams.get("publication") === "1") return json(await getBlockPublication({ db,
          eventId: str(url.searchParams.get("eventId"), "la edición", 100),
          blockId: str(url.searchParams.get("blockId"), "el bloque", 200, true),
          getDirectory: getJudgingBlockDirectory, getSnapshot: getJudgingSnapshot }));
        if (url.searchParams.get("judging") === "1") {
          const event = await eventById(db, str(url.searchParams.get("eventId"), "la edición", 100));
          if (!getJudgingEventList) fault("portal_judging_unavailable", "La conexión de jueceo no está disponible.", 503);
          const source = await first(db, "SELECT source_event_id,enabled FROM participant_portal_judging_sources WHERE event_id=?", event.id);
          const available = await getJudgingEventList();
          if(source?.source_event_id&&!available.events.some(item=>item.id===source.source_event_id)&&getJudgingDirectory){
            const linked=await getJudgingDirectory(source.source_event_id,{trustedEventId:source.source_event_id});
            available.events.push(linked.event);
          }
          return json({ events: available.events, sourceEventId: source?.enabled ? source.source_event_id : "" });
        }
        if (url.searchParams.has("assetId")) return await serveAsset(db,env,request,str(url.searchParams.get("assetId"),"el archivo",100),true,getMediaStore);
        if (url.searchParams.get("storage") === "1") {
          const storage = await resolveMediaStore(env,getMediaStore);
          return json({ mediaStorage: storage.getInfo ? await storage.getInfo() : storage.info || { provider: "configured", ready: true } });
        }
        if (url.searchParams.get("preview") === "1") return json(await participantData(db,env,
          str(url.searchParams.get("participantId"),"el participante",100),str(url.searchParams.get("eventId"),"la edición",100),true,getJudgingSnapshot));
        return await adminList(db,request);
      }
      const input = await body(request);
      if (input.action === 'photo.source.demo.prepare') return await prepareAutomaticPhotoDemo(db, env, input, getPhotoDiscovery);
      if (input.action === 'photo.sync') return await runPhotoSync(db, env, {
        participantId: str(input.participantId, 'el participante', 100), eventId: str(input.eventId, 'la edición', 100), adminPreview: true,
        assertAuthorized: () => requireAdmin(request, env, db, { touchLastSeen: false }), getPhotoDiscovery, getMediaStore,
      });
      return await adminAction(db,env,input,admin?.session?.user?.id,getMediaStore,getJudgingEventList,getJudgingDirectory,getJudgingSnapshot,getJudgingBlockDirectory);
    }
    if (path === "/api/participant/access/exchange") {
      method(request,["POST"]);
      const input = await body(request);
      if (typeof input.token !== "string" || !/^[\w-]{43}$/.test(input.token)) fault("portal_access_invalid","El enlace personal no es válido.",401);
      const grant = await first(db,"SELECT id,is_guest FROM participant_portal_grants WHERE token_hash=? AND active=1",await hash(input.token));
      if (!grant) fault("portal_access_invalid","El enlace personal expiró o fue reemplazado.",401);
      const token = randomToken();
      const table = grant.is_guest ? 'participant_portal_guest_sessions' : 'participant_portal_sessions';
      await db.batch([
        db.prepare(`DELETE FROM ${table} WHERE expires_at <= datetime('now')`),
        db.prepare(`INSERT INTO ${table}(token_hash,access_id,expires_at) VALUES(?,?,datetime('now','+7 days'))`).bind(await hash(token),grant.id),
      ]);
      return json({ ok:true },200,{"set-cookie":cookie(token)});
    }
    if (path === "/api/participant/logout" || path === "/api/participant/access/logout") {
      method(request,["POST"]);
      const token=readCookie(request);
      if (token) await db.batch([
        db.prepare("DELETE FROM participant_portal_sessions WHERE token_hash=?").bind(await hash(token)),
        db.prepare("DELETE FROM participant_portal_guest_sessions WHERE token_hash=?").bind(await hash(token)),
      ]);
      return json({ok:true},200,{"set-cookie":cookie("",true)});
    }
    if (path === '/api/participant/photos/sync') {
      method(request, ['POST']);
      const grant = await session(db, request);
      const input = await body(request);
      if (input.eventId && input.eventId !== grant.event_id) fault('portal_event_not_found', 'No se encontró la edición.', 404);
      if (Object.hasOwn(input, 'participantId') && input.participantId !== grant.participant_id) fault('portal_participant_not_found', 'No se encontró al participante.', 404);
      return await runPhotoSync(db, env, { participantId: grant.participant_id, eventId: grant.event_id, adminPreview: false,
        assertAuthorized: async () => {
          const current = await session(db, request);
          if (current.id !== grant.id || current.participant_id !== grant.participant_id || current.event_id !== grant.event_id) {
            fault('portal_session_invalid', 'Tu sesión cambió. Abre nuevamente tu enlace personal.', 401);
          }
        }, getPhotoDiscovery, getMediaStore,
      });
    }
    if (path === "/api/participant/me") { method(request,["GET"]); return await me(db,env,request,getJudgingSnapshot); }
    const assetMatch=path.match(/^\/api\/participant\/assets\/([a-zA-Z0-9_-]{8,100})$/);
    if (assetMatch) { method(request,["GET"]); return await serveAsset(db,env,request,assetMatch[1],false,getMediaStore,getJudgingSnapshot); }
    return json({error:{code:"portal_not_found",message:"No se encontró esta página."}},404);
  } catch (error) {
    const status=Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    return json({error:{code:error?.code || "portal_unavailable",message:status===500 ? "No pudimos completar la solicitud. Intenta de nuevo." : error.message}},status);
  }
}
