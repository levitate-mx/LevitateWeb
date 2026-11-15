import { enrichParticipantJudging } from "./participant-judging.js";
import { getReleasedJudgingSheetJudgeIds } from "./judging-sheet-release.js";

const keyPattern = /^[A-Za-z0-9_-]{1,200}$/;
const maxRoutinesPerSnapshot = 50;
const text = (value) => (typeof value === "string" ? value.trim() : "");
const fail = (code, message, statusCode = 400) => {
  throw Object.assign(new Error(message), { code, statusCode });
};
const all = async (db, sql, ...bindings) =>
  (await db.prepare(sql).bind(...bindings).all()).results || [];

function scopedKey(value, code, message, statusCode = 400) {
  const result = text(value);
  if (!keyPattern.test(result)) fail(code, message, statusCode);
  return result;
}

function academyKey(value) {
  return scopedKey(
    value,
    "registration_academy_judging_forbidden",
    "No pudimos comprobar la academia de esta sesión.",
    403,
  );
}

function danceKey(value) {
  return scopedKey(
    value,
    "registration_academy_judging_not_found",
    "No se encontró esa coreografía.",
    404,
  );
}

function pendingSheet(row, status = "pending") {
  return {
    danceId: row.registration_dance_id,
    title: row.registration_title,
    status,
    judgeCount: 0,
  };
}

function candidate(row) {
  return Boolean(
    row.id &&
      row.event_id &&
      row.registration_event_id === row.event_id &&
      row.event_published === 1 &&
      row.source_enabled === 1 &&
      row.publication_blocked === 0 &&
      text(row.source_event_id) &&
      row.source_event_id === row.edition_source_event_id &&
      text(row.source_routine_id),
  );
}

function selectDanceRows(rows) {
  const selected = new Map();
  for (const row of rows) {
    const prior = selected.get(row.registration_dance_id);
    if (!prior || (!candidate(prior) && candidate(row))) {
      selected.set(row.registration_dance_id, row);
    }
  }
  return [...selected.values()];
}

async function ownedRows(db, academyId, danceId = "") {
  const danceFilter = danceId ? "AND d.id=?" : "";
  return all(
    db,
    `SELECT d.id AS registration_dance_id,d.title AS registration_title,d.created_at AS registration_created_at,
      CASE WHEN json_valid(d.program_json) THEN json_extract(d.program_json,'$.eventId') ELSE NULL END AS registration_event_id,
      r.id,r.event_id,r.dance_id,r.source_event_id,r.source_routine_id,r.status,r.publication_blocked,r.updated_at,
      e.title AS event_title,e.season AS event_season,e.starts_at AS event_starts_at,e.published AS event_published,
      s.source_event_id AS edition_source_event_id,s.enabled AS source_enabled
    FROM registration_dances d
    LEFT JOIN participant_portal_routines r ON r.dance_id=d.id
    LEFT JOIN participant_portal_events e ON e.id=r.event_id
    LEFT JOIN participant_portal_judging_sources s ON s.event_id=e.id
    WHERE d.academy_id=? ${danceFilter}
    ORDER BY d.created_at,d.id,
      CASE WHEN e.published=1 AND s.enabled=1 THEN 0 ELSE 1 END,
      e.starts_at DESC,e.id DESC`,
    academyId,
    ...(danceId ? [danceId] : []),
  );
}

function summary(row, judging) {
  const available = judging?.status === "available"
    && judging.preview === false && judging.pdf?.preview === false;
  const judgeCount = available ? judging.judges.length : 0;
  return {
    ...pendingSheet(row, available ? "available"
      : judging?.sourceStatus === "unavailable" ? "unavailable" : "pending"),
    ...(candidate(row)
      ? { eventId: row.event_id, eventTitle: row.event_title }
      : {}),
    judgeCount,
  };
}

function pendingJudging(sourceStatus = "pending") {
  return { source: "jueceocore", sourceStatus, status: "pending", judges: [] };
}

async function retainCurrentRelease({
  db,
  row,
  snapshot,
  judging,
  getReleasedJudgeIds,
}) {
  if (
    judging?.source !== "jueceocore" ||
    judging.status !== "available" ||
    judging.preview !== false ||
    judging.pdf?.preview !== false ||
    !Array.isArray(judging.judges) ||
    !Array.isArray(judging.pdf.judges)
  ) {
    return judging;
  }
  let released;
  try {
    const resolveReleased =
      typeof getReleasedJudgeIds === "function"
        ? getReleasedJudgeIds
        : (options) => getReleasedJudgingSheetJudgeIds({ ...options, db });
    released = await resolveReleased({
      sourceEventId: row.source_event_id,
      sourceRoutineId: row.source_routine_id,
      snapshot,
    });
  } catch {
    return pendingJudging("unavailable");
  }
  if (!Array.isArray(released)) return pendingJudging("unavailable");
  const approved = new Set(released.filter((id) => typeof id === "string" && id));
  const pdfIds = new Set(
    judging.pdf.judges
      .filter((judge) => judge?.status === "complete" && approved.has(judge.id))
      .map((judge) => judge.id),
  );
  const judges = judging.judges.filter(
    (judge) => judge?.status === "complete" && pdfIds.has(judge.id),
  );
  if (!judges.length) return pendingJudging();
  const ids = new Set(judges.map((judge) => judge.id));
  return {
    ...judging,
    judges,
    pdf: {
      ...judging.pdf,
      judges: judging.pdf.judges.filter((judge) => ids.has(judge.id)),
    },
  };
}

async function projectRows({ db, rows, getJudgingSnapshot, getReleasedJudgeIds }) {
  const projected = new Map();
  const bySource = new Map();
  for (const row of rows.filter(candidate)) {
    const group = bySource.get(row.source_event_id) || [];
    group.push(row);
    bySource.set(row.source_event_id, group);
  }
  for (const [sourceEventId, sourceRows] of bySource) {
    for (let offset = 0; offset < sourceRows.length; offset += maxRoutinesPerSnapshot) {
      const chunk = sourceRows.slice(offset, offset + maxRoutinesPerSnapshot);
      const allowedRoutineIds = new Set(chunk.map(row => row.source_routine_id));
      const data = { routines: chunk.map(row => ({ id: row.id,
        result: { status: "pending" }, judging: { status: "pending", judges: [] } })) };
      let snapshot = null;
      const enriched = await enrichParticipantJudging({
        data, rows: chunk, event: { published: 1, automatic_judging: true }, sourceEventId,
        getSnapshot: async (trustedEventId, options) => {
          if (trustedEventId !== sourceEventId || typeof getJudgingSnapshot !== "function"
            || !Array.isArray(options?.routineIds) || options.routineIds.length > maxRoutinesPerSnapshot
            || options.routineIds.some(id => !allowedRoutineIds.has(id))) throw new Error("Judging source unavailable");
          snapshot = await getJudgingSnapshot(trustedEventId, { ...options, trustedEventId: sourceEventId });
          return snapshot;
        },
        getReleasedJudgeIds: typeof getReleasedJudgeIds === "function" ? getReleasedJudgeIds
          : options => getReleasedJudgingSheetJudgeIds({ ...options, db }),
      });
      await Promise.all((enriched.routines || []).map(async (routine) => {
        const row = chunk.find((value) => value.id === routine.id);
        projected.set(routine.id, await retainCurrentRelease({
          db,
          row,
          snapshot,
          judging: routine.judging,
          getReleasedJudgeIds,
        }));
      }));
    }
  }
  return projected;
}

function sameBinding(before, after) {
  return [
    "registration_dance_id",
    "registration_event_id",
    "id",
    "event_id",
    "source_event_id",
    "source_routine_id",
    "edition_source_event_id",
    "source_enabled",
    "event_published",
    "publication_blocked",
  ].every((field) => before[field] === after[field]);
}

async function detail({
  db,
  academyId,
  danceId,
  getJudgingSnapshot,
  getReleasedJudgeIds,
}) {
  const initialRows = await ownedRows(db, academyId, danceId);
  if (!initialRows.length) {
    fail(
      "registration_academy_judging_not_found",
      "No se encontró esa coreografía.",
      404,
    );
  }
  const row = selectDanceRows(initialRows)[0];
  if (!candidate(row)) return { sheet: pendingSheet(row) };

  const data = {
    routines: [
      {
        id: row.id,
        result: { status: "pending" },
        judging: { status: "pending", judges: [] },
      },
    ],
  };
  const sourceEventId = row.source_event_id;
  let snapshot = null;
  const enriched = await enrichParticipantJudging({
    data,
    rows: [row],
    event: { published: 1, automatic_judging: true },
    sourceEventId,
    getSnapshot: async (trustedEventId, options) => {
      if (
        trustedEventId !== sourceEventId ||
        typeof getJudgingSnapshot !== "function"
      ) {
        throw new Error("Judging source unavailable");
      }
      snapshot = await getJudgingSnapshot(trustedEventId, {
        ...options,
        routineIds: [row.source_routine_id],
        trustedEventId: sourceEventId,
      });
      return snapshot;
    },
    getReleasedJudgeIds:
      typeof getReleasedJudgeIds === "function"
        ? getReleasedJudgeIds
        : (options) => getReleasedJudgingSheetJudgeIds({ ...options, db }),
  });

  const judging = await retainCurrentRelease({
    db,
    row,
    snapshot,
    judging: enriched.routines?.[0]?.judging,
    getReleasedJudgeIds,
  });

  // Recheck ownership, edition visibility and both persisted source identities
  // after the final release fingerprint await. A moved dance or withdrawn
  // release cannot finish an older academy request.
  const freshRows = await ownedRows(db, academyId, danceId);
  const fresh = selectDanceRows(freshRows)[0];
  if (!fresh || !candidate(fresh) || !sameBinding(row, fresh)) {
    return { sheet: pendingSheet(row, "unavailable") };
  }
  if (judging?.status === "available" && judging.preview === false && judging.pdf?.preview === false) {
    return {
      sheet: {
        danceId: row.registration_dance_id,
        title: row.registration_title,
        eventId: row.event_id,
        eventTitle: row.event_title,
        status: "available",
        judgeCount: judging.judges.length,
        judging,
      },
    };
  }
  return {
    sheet: pendingSheet(
      row,
      judging?.sourceStatus === "unavailable" ? "unavailable" : "pending",
    ),
  };
}

/**
 * Read-only academy projection of the exact judge sheets released to Mi
 * Levitate. The HTTP caller authenticates the academy first; this function
 * then follows academy-owned dance -> registration edition -> persisted Core
 * identities. Names, programme numbers and venue never establish ownership.
 */
export async function getAcademyJudgingSheets({
  db,
  academyId,
  danceId = "",
  getJudgingSnapshot,
  getReleasedJudgeIds,
} = {}) {
  if (!db) {
    fail(
      "registration_academy_judging_unavailable",
      "Las hojas de jueceo no están disponibles por el momento.",
      503,
    );
  }
  const ownedAcademy = academyKey(academyId);
  const selectedDance = danceId ? danceKey(danceId) : "";
  if (selectedDance) {
    return detail({
      db,
      academyId: ownedAcademy,
      danceId: selectedDance,
      getJudgingSnapshot,
      getReleasedJudgeIds,
    });
  }

  const rows = selectDanceRows(await ownedRows(db, ownedAcademy));
  if (!rows.length) return { sheets: [] };
  const projected = await projectRows({ db, rows, getJudgingSnapshot, getReleasedJudgeIds });
  const freshRows = new Map(selectDanceRows(await ownedRows(db, ownedAcademy))
    .map(row => [row.registration_dance_id, row]));
  return { sheets: rows.map((row) => {
    const fresh = freshRows.get(row.registration_dance_id);
    return summary(row, fresh && sameBinding(row, fresh) ? projected.get(row.id) : { sourceStatus: "unavailable" });
  }) };
}

export async function handleAcademyJudgingSheets(
  request,
  { db, academyId, getJudgingSnapshot } = {},
) {
  if (request.method !== "GET") {
    fail("method_not_allowed", "Método no permitido.", 405);
  }
  const danceId = new URL(request.url).searchParams.get("danceId") || "";
  const payload = await getAcademyJudgingSheets({
    db,
    academyId,
    danceId,
    getJudgingSnapshot,
  });
  return Response.json(payload, {
    headers: {
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
      vary: "Cookie",
      "x-content-type-options": "nosniff",
    },
  });
}
