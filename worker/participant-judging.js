const text = value => typeof value === "string" ? value.trim() : "";
const finite = value => typeof value === "number" && Number.isFinite(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const eventKey = value => uuid.test(text(value)) ? text(value).toLowerCase() : text(value);
const routineKey = row => row?.id || `registration:${text(row?.registration_dance_id)}`;
const pending = sourceStatus => ({ source: "jueceocore", sourceStatus, status: "pending", judges: [] });

function sourceFor(row, editionSource) {
  const explicitEvent = text(row?.source_event_id), explicitRoutine = text(row?.source_routine_id);
  // An incomplete explicit link must never fall through to an unrelated
  // edition-wide source. Names and program numbers are not identities.
  if (explicitEvent || explicitRoutine) return {
    eventId: eventKey(explicitEvent), routineId: explicitRoutine, explicit: true,
    valid: Boolean(explicitEvent && explicitRoutine),
  };
  const editionEvent = eventKey(editionSource), danceId = text(row?.registration_dance_id);
  return editionEvent ? { eventId: editionEvent, routineId: danceId, explicit: false, valid: Boolean(danceId) } : null;
}

function sheetJudges(row) {
  if (!Array.isArray(row?.judges) || !row.judges.length || row.judges.length > 20
    || !Number.isInteger(row.expectedJudges) || row.expectedJudges !== row.judges.length) return null;
  const judgeIds = new Set();
  let recorded = 0;
  const judges = [];
  for (const judge of row.judges) {
    const judgeId = text(judge?.id), name = text(judge?.name);
    if (!judgeId || judgeIds.has(judgeId) || !name || !["complete", "partial", "pending"].includes(judge.status)
      || !Array.isArray(judge.criteria) || !judge.criteria.length || judge.criteria.length > 100) return null;
    judgeIds.add(judgeId);
    const criterionIds = new Set();
    const criteria = [];
    let subtotal = 0, maximum = 0, judgeRecorded = 0;
    for (const criterion of judge.criteria) {
      if (!Number.isInteger(criterion?.id) || criterion.id < 0 || criterionIds.has(criterion.id)
        || !text(criterion.label) || !finite(criterion.maximumScore) || criterion.maximumScore < 0) return null;
      criterionIds.add(criterion.id);
      const value = criterion.value;
      if (value !== null && (!finite(value) || value < 0 || value > criterion.maximumScore)) return null;
      if (value !== null) { subtotal += value; judgeRecorded += 1; }
      maximum += criterion.maximumScore;
      criteria.push({ id: criterion.id, section: text(criterion.section), label: text(criterion.label), value, maximumScore: criterion.maximumScore });
    }
    if (!finite(subtotal) || !finite(maximum) || maximum <= 0 || !finite(judge.penalty)
      || judge.penalty < -100 || judge.penalty > 100
      || (judge.status === "complete" && judgeRecorded !== criteria.length)) return null;
    // The app's individual sheets use the plain criterion sum. The weighted
    // official result report is separate and must not replace this subtotal.
    const sheetMaximum = judge.sheetMaximumScore == null ? maximum : judge.sheetMaximumScore;
    if (!finite(sheetMaximum) || sheetMaximum <= 0) return null;
    const total = subtotal > 0 ? Math.max(0, subtotal + judge.penalty) : 0;
    recorded += judgeRecorded;
    judges.push({ id: judgeId, name, status: judge.status,
      subtotal: judgeRecorded ? subtotal : null, penalty: judge.penalty,
      total: judgeRecorded ? total : null, maximumScore: sheetMaximum, sheetMaximumScore: sheetMaximum,
      criteria, feedback: text(judge.feedback) });
  }
  return { judges, recorded, complete: row.status === "complete" && judges.every(judge => judge.status === "complete") };
}

function projectedJudging(snapshot, row, adminPreview) {
  if (!["complete", "partial", "pending"].includes(row?.status)) return pending("unavailable");
  const sheet = sheetJudges(row);
  if (!sheet) return pending("unavailable");
  if ((!adminPreview && !sheet.complete) || (adminPreview && !sheet.recorded)) return pending("pending");
  const judges = sheet.judges.map(judge => ({
    id: judge.id, name: judge.name, status: judge.status, score: judge.total, maxScore: judge.maximumScore,
    penalty: judge.penalty, subtotal: judge.subtotal,
    criteria: judge.criteria.map(criterion => ({ id: criterion.id, section: criterion.section,
      label: criterion.label, score: criterion.value, maxScore: criterion.maximumScore })), feedback: judge.feedback,
  }));
  return { source: "jueceocore", sourceStatus: "available", status: "available",
    preview: Boolean(adminPreview), judges,
    pdf: {
      eventTitle: text(snapshot.event?.name),
      routine: { id: text(row.id), title: text(row.name), academy: text(row.academy), genre: text(row.genre),
        category: text(row.category), division: text(row.division), level: text(row.level), block: text(row.blockName) },
      judges: sheet.judges, preview: Boolean(adminPreview),
    } };
}

/** Enrich already-authorized participant data without mutating D1, Drive, or
 * JueceoCore. The caller supplies only the participant's registration rows and
 * performs session/admin authentication before invoking this function.
 */
export async function enrichParticipantJudging({ data, rows, event, adminPreview = false, getSnapshot, sourceEventId } = {}) {
  if (!Array.isArray(data?.routines)) return data;
  const byId = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = routineKey(row);
    // Duplicate ownership rows are ambiguous; do not pick one silently.
    byId.set(id, byId.has(id) ? null : row);
  }
  const canRead = (row,source) => Boolean(row && source?.valid && (adminPreview
    || (event?.published && (event.automatic_judging === true
      || (row.id ? row.status === "published" : !source.explicit)))));
  let selectedEvent = "", snapshotPromise;
  const readSnapshot = eventId => {
    if (selectedEvent && selectedEvent !== eventId) return null;
    selectedEvent = eventId;
    snapshotPromise ||= Promise.resolve().then(() => {
      if (typeof getSnapshot !== "function") throw new Error("Judging source unavailable");
      const routineIds = [...new Set(data.routines.flatMap(routine => {
        const row=byId.get(routine?.id), source=sourceFor(row,sourceEventId);
        return source?.eventId===eventId && canRead(row,source) ? [source.routineId] : [];
      }))];
      return getSnapshot(eventId,{routineIds});
    }).catch(() => null);
    return snapshotPromise;
  };
  const routines = [];
  for (const routine of data.routines) {
    const row = byId.get(routine?.id), source = sourceFor(row, sourceEventId);
    if (!source) {
      routines.push({ ...routine, judging: { ...routine.judging, sourceStatus: "unlinked" } });
      continue;
    }
    let judging;
    if (!row || !source.valid) judging = pending("unlinked");
    // Only the caller's authenticated edition binding enables automatic
    // release. Photo/result drafts remain independent; hidden editions always
    // stay hidden, and projectedJudging still requires complete evaluations.
    else if (!canRead(row,source)) judging = pending("pending");
    else {
      const snapshot = await readSnapshot(source.eventId);
      if (!snapshot || eventKey(snapshot.event?.id) !== source.eventId || !Array.isArray(snapshot.rows)) judging = pending("unavailable");
      else {
        const matched = snapshot.rows.filter(value => value?.id === source.routineId);
        judging = matched.length !== 1 ? pending(matched.length ? "unavailable" : "unlinked")
          : projectedJudging(snapshot, matched[0], adminPreview);
      }
    }
    routines.push({ ...routine, judging });
  }
  return { ...data, routines };
}
