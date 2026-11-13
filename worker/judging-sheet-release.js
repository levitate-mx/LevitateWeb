import { isCompleteJudgingRoutine } from './participant-block-publication.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const fail = (code, message, statusCode = 400) => { throw Object.assign(new Error(message), { code, statusCode }); };
const first = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
const sortBy = (rows, field) => [...rows].sort((a, b) => String(a[field]).localeCompare(String(b[field]), 'en'));
const stable = value => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, stable(value[key])])) : value;
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable(value)))))]
  .map(value => value.toString(16).padStart(2, '0')).join('');

function routineMetadata(row) {
  return { id: row.id, programNumber: row.programNumber, name: row.name, academy: row.academy,
    genre: row.genre, division: row.division, level: row.level, category: row.category,
    blockName: row.blockName, expectedJudges: row.expectedJudges };
}

function validRoster(row) {
  return ['complete', 'partial', 'pending'].includes(row?.status)
    && Number.isInteger(row.expectedJudges) && row.expectedJudges > 0 && row.expectedJudges <= 20
    && Array.isArray(row.judges) && row.judges.length === row.expectedJudges
    && row.judges.every(judge => key(judge?.id) && text(judge.name))
    && new Set(row.judges.map(judge => judge.id)).size === row.judges.length;
}

function completeJudge(row, judge) {
  return isCompleteJudgingRoutine({ ...row, status: 'complete', expectedJudges: 1,
    completedJudges: 1, recordedScores: judge?.criteria?.length, judges: [judge] });
}

export async function analyzeJudgingSheetRelease({ sourceEventId, blockId, snapshot, routineIds } = {}) {
  const pending = { complete: false, routines: Array.isArray(routineIds) ? routineIds.length : 0,
    availableRoutines: 0, availableSheets: 0, fingerprint: '', routineIds: [], sheets: [] };
  if (!key(sourceEventId) || !key(blockId) || text(snapshot?.event?.id) !== sourceEventId || !Array.isArray(snapshot.rows)) return pending;
  const blockRows = snapshot.rows.filter(row => text(row?.blockId) === blockId);
  const ids = blockRows.map(row => row.id);
  pending.routines = ids.length;
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !key(id)
    || snapshot.rows.filter(row => row?.id === id).length !== 1)
    || (routineIds && (!Array.isArray(routineIds) || new Set(routineIds).size !== routineIds.length
      || routineIds.length !== ids.length || ids.some(id => !routineIds.includes(id))))) return pending;

  // Each authorization covers one complete judge sheet. Another judge's new
  // scores never change it; the routine metadata and jury identities still do.
  const sheets = [];
  for (const row of sortBy(blockRows, 'id')) {
    if (!validRoster(row)) continue;
    const roster = sortBy(row.judges, 'id').map(judge => ({ id: judge.id, name: judge.name }));
    for (const judge of sortBy(row.judges, 'id')) {
      if (!completeJudge(row, judge)) continue;
      const fingerprint = await hash({ sourceEventId, blockId, routine: routineMetadata(row), roster,
        judge: { ...judge, criteria: sortBy(judge.criteria, 'id') } });
      sheets.push({ routineId: row.id, judgeId: judge.id, fingerprint });
    }
  }
  const complete = blockRows.every(isCompleteJudgingRoutine);
  // Retain the exact historical full-block digest for releases made before
  // per-sheet manifests existed. An old release can never approve new sheets.
  const fingerprint = complete ? await hash({ sourceEventId, blockId, rows: sortBy(blockRows, 'id').map(row => ({
    ...routineMetadata(row), judges: sortBy(row.judges, 'id').map(judge => ({ ...judge, criteria: sortBy(judge.criteria, 'id') })),
  })) }) : '';
  return { complete, routines: ids.length, availableRoutines: new Set(sheets.map(sheet => sheet.routineId)).size,
    availableSheets: sheets.length, fingerprint, routineIds: [...ids].sort(), sheets };
}

function approvedSheets(record, analysis) {
  if (!record) return [];
  if (record.manifest_json == null) {
    return analysis.complete && record.fingerprint === analysis.fingerprint ? analysis.sheets : [];
  }
  if (record.manifestIntegrity !== true) return [];
  let manifest;
  try { manifest = JSON.parse(record.manifest_json); } catch { return []; }
  if (manifest?.version !== 1 || !Array.isArray(manifest.routineIds) || !manifest.routineIds.length
    || manifest.routineIds.some(id => !key(id) || !analysis.routineIds.includes(id))
    || new Set(manifest.routineIds).size !== manifest.routineIds.length || !Array.isArray(manifest.sheets)
    || manifest.sheets.some(sheet => !key(sheet?.routineId) || !manifest.routineIds.includes(sheet.routineId)
      || !key(sheet.judgeId) || !/^[a-f0-9]{64}$/.test(sheet.fingerprint))
    || new Set(manifest.sheets.map(sheet => `${sheet.routineId}:${sheet.judgeId}`)).size !== manifest.sheets.length) return [];
  const saved = new Map(manifest.sheets.map(sheet => [`${sheet.routineId}:${sheet.judgeId}`, sheet.fingerprint]));
  return analysis.sheets.filter(sheet => saved.get(`${sheet.routineId}:${sheet.judgeId}`) === sheet.fingerprint);
}

async function readRelease(db, sourceEventId, blockId) {
  const record = await first(db,
    'SELECT fingerprint,manifest_json,released_at,operation_nonce FROM registration_judging_sheet_releases WHERE source_event_id=? AND block_id=?', sourceEventId, blockId);
  if (record?.manifest_json != null) {
    try { return { ...record, manifestIntegrity: await hash(JSON.parse(record.manifest_json)) === record.fingerprint }; }
    catch { return { ...record, manifestIntegrity: false }; }
  }
  return record;
}

function releaseStatus(blockId, analysis, record) {
  const approved = approvedSheets(record, analysis);
  const canRelease = analysis.availableSheets > approved.length;
  return { blockId, state: !analysis.availableSheets ? 'pending' : canRelease ? record ? 'changed' : 'ready' : 'released',
    complete: analysis.complete, canRelease, routines: analysis.routines, availableRoutines: analysis.availableRoutines,
    availableSheets: analysis.availableSheets, releasedSheets: approved.length,
    releasedRoutines: new Set(approved.map(sheet => sheet.routineId)).size, releasedAt: record?.released_at || null };
}

export async function getJudgingSheetRelease({ db, sourceEventId, blockId, snapshot, routineIds }) {
  const analysis = await analyzeJudgingSheetRelease({ sourceEventId, blockId, snapshot, routineIds });
  return releaseStatus(blockId, analysis, await readRelease(db, sourceEventId, blockId));
}

/** Caller must authenticate an admin and verify the source event and block. */
export async function releaseJudgingSheets({ db, sourceEventId, blockId, snapshot, routineIds, actorId }) {
  if (!key(sourceEventId) || !key(blockId) || !key(actorId)) fail('judging_sheet_release_invalid', 'Revisa el bloque y la sesión del administrador.');
  const analysis = await analyzeJudgingSheetRelease({ sourceEventId, blockId, snapshot, routineIds });
  if (!analysis.availableSheets) fail('judging_sheet_release_incomplete', 'Guarda al menos una hoja completa de un juez para habilitarla en Mi Levitate.', 409);
  const current = await readRelease(db, sourceEventId, blockId);
  const status = releaseStatus(blockId, analysis, current);
  if (!status.canRelease) return { ...status, released: true };
  const manifest = { version: 1, routineIds: analysis.routineIds, sheets: analysis.sheets };
  const fingerprint = await hash(manifest);
  await db.prepare(`INSERT INTO registration_judging_sheet_releases(source_event_id,block_id,fingerprint,manifest_json,released_by,operation_nonce)
    VALUES(?,?,?,?,?,?) ON CONFLICT(source_event_id,block_id) DO UPDATE SET fingerprint=excluded.fingerprint,manifest_json=excluded.manifest_json,
      released_by=excluded.released_by,released_at=datetime('now'),operation_nonce=excluded.operation_nonce`)
    .bind(sourceEventId, blockId, fingerprint, JSON.stringify(manifest), actorId, crypto.randomUUID()).run();
  return { ...releaseStatus(blockId, analysis, await readRelease(db, sourceEventId, blockId)), released: true };
}

/** Read-only authorization: return only unchanged sheets approved by a click. */
export async function getReleasedJudgingSheetJudgeIds({ db, sourceEventId, sourceRoutineId, snapshot }) {
  if (!key(sourceEventId) || !key(sourceRoutineId) || text(snapshot?.event?.id) !== sourceEventId || !Array.isArray(snapshot.rows)) return [];
  const own = snapshot.rows.filter(row => row?.id === sourceRoutineId);
  if (own.length !== 1 || !key(own[0].blockId)) return [];
  const blockId = own[0].blockId;
  // Participant readers must attest that this is a full-block snapshot.
  if (snapshot.resultScope?.complete !== true || text(snapshot.resultScope.eventId) !== sourceEventId
    || !Array.isArray(snapshot.resultScope.blockIds) || !snapshot.resultScope.blockIds.includes(blockId)) return [];
  const analysis = await analyzeJudgingSheetRelease({ sourceEventId, blockId, snapshot });
  return approvedSheets(await readRelease(db, sourceEventId, blockId), analysis)
    .filter(sheet => sheet.routineId === sourceRoutineId).map(sheet => sheet.judgeId);
}

/** Compatibility for callers that only need to know whether any sheet exists. */
export async function judgingSheetsAreReleased(options) {
  return (await getReleasedJudgingSheetJudgeIds(options)).length > 0;
}
