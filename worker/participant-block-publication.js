const encoder = new TextEncoder();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const routineIdentifier = /^[A-Za-z0-9_-]{1,100}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const text = value => typeof value === 'string' ? value.trim() : '';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const plainObject = value => value !== null && typeof value === 'object'
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fault = (code, message, statusCode = 400) => { throw Object.assign(new Error(message), { code, statusCode }); };
const all = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results || [];
const first = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');

function key(value, label, maximum = 200) {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/u.test(value)) {
    fault('portal_invalid_publication', `Revisa ${label}.`);
  }
  return value;
}

function actor(value) { return key(value, 'la sesión del administrador', 100); }

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(name => value[name] !== undefined).map(name => [name, canonical(value[name])]));
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid publication value');
  return value;
}
const stableJson = value => JSON.stringify(canonical(value));
const sortBy = (rows, field) => [...rows].sort((left, right) => String(left[field]) < String(right[field]) ? -1 : String(left[field]) > String(right[field]) ? 1 : 0);

async function context(db, eventId) {
  eventId = key(eventId, 'la edición', 100);
  const edition = await first(db, `SELECT e.id,e.venue,s.mode,s.operation_nonce AS settings_nonce,j.source_event_id,j.enabled
    FROM participant_portal_events e LEFT JOIN participant_portal_publication_settings s ON s.event_id=e.id
    LEFT JOIN participant_portal_judging_sources j ON j.event_id=e.id WHERE e.id=?`, eventId);
  if (!edition) fault('portal_event_not_found', 'No se encontró la edición de Mi Levitate.', 404);
  const mode = edition.mode || 'individual';
  if (!['individual', 'block_close'].includes(mode)) fault('portal_invalid_publication', 'La política de publicación necesita revisión.', 409);
  const sourceEventId = edition.enabled === 1 && uuid.test(text(edition.source_event_id)) ? edition.source_event_id.toLowerCase() : '';
  return { ...edition, eventId, mode, sourceEventId };
}

async function mappings(db, edition) {
  return all(db, `SELECT r.id,r.dance_id,r.source_event_id,r.source_routine_id,d.venue
    FROM participant_portal_routines r LEFT JOIN registration_dances d ON d.id=r.dance_id
    WHERE r.event_id=?`, edition.eventId);
}

function mappingManifest(edition, sourceIds, rows) {
  const manifest = [];
  for (const sourceRoutineId of sourceIds) {
    const matches = rows.filter(row => row.source_event_id === edition.sourceEventId && row.source_routine_id === sourceRoutineId);
    if (matches.length !== 1 || !text(matches[0].id) || !text(matches[0].dance_id) || matches[0].venue !== edition.venue) return null;
    const row = matches[0];
    manifest.push({ id: row.id, danceId: row.dance_id, sourceRoutineId, sourceEventId: edition.sourceEventId });
  }
  if (new Set(manifest.map(row => row.id)).size !== manifest.length || new Set(manifest.map(row => row.danceId)).size !== manifest.length) return null;
  return sortBy(manifest, 'sourceRoutineId');
}

function completeRoutine(row) {
  if (row?.status !== 'complete' || !Number.isInteger(row.expectedJudges) || row.expectedJudges < 1 || row.expectedJudges > 20
    || row.completedJudges !== row.expectedJudges || !Array.isArray(row.judges) || row.judges.length !== row.expectedJudges) return false;
  const judgeIds = new Set();
  let recorded = 0;
  for (const judge of row.judges) {
    const judgeId = text(judge?.id);
    if (!judgeId || judgeIds.has(judgeId) || !text(judge.name) || judge.status !== 'complete'
      || !finite(judge.subtotal) || judge.subtotal < 0 || !finite(judge.total) || judge.total < 0
      || !finite(judge.maximumScore) || judge.maximumScore <= 0 || !finite(judge.penalty) || judge.penalty < -100 || judge.penalty > 0
      || !Array.isArray(judge.criteria) || !judge.criteria.length || judge.criteria.length > 100) return false;
    judgeIds.add(judgeId);
    const criterionIds = new Set();
    for (const criterion of judge.criteria) {
      if (!Number.isInteger(criterion?.id) || criterion.id < 0 || criterionIds.has(criterion.id) || !text(criterion.label)
        || !finite(criterion.maximumScore) || criterion.maximumScore < 0 || !finite(criterion.value)
        || criterion.value < 0 || criterion.value > criterion.maximumScore) return false;
      criterionIds.add(criterion.id); recorded += 1;
    }
  }
  return recorded === row.recordedScores;
}

function scoreEntries(block, maximumScore, sourceIds) {
  if (!Array.isArray(block?.sections) || !block.sections.length) return false;
  const seen = new Set();
  for (const section of block.sections) {
    if (!Array.isArray(section?.categories) || !section.categories.length) return false;
    for (const category of section.categories) {
      if (!Array.isArray(category?.rows) || !category.rows.length) return false;
      for (const entry of category.rows) {
        const id = text(entry?.routineId);
        if (!sourceIds.includes(id) || seen.has(id) || !finite(entry.score) || entry.score < 0 || entry.score > maximumScore) return false;
        seen.add(id);
      }
    }
  }
  return seen.size === sourceIds.length;
}

function reportFingerprint(block) {
  const { isActive, ...rest } = block;
  return { ...rest, sections: sortBy(block.sections, 'id').map(section => ({ ...section,
    categories: sortBy(section.categories, 'id').map(category => ({ ...category, rows: sortBy(category.rows, 'routineId') })) })),
    specialAwards: Array.isArray(block.specialAwards) ? sortBy(block.specialAwards, 'id') : [] };
}

async function analyzeBlock(edition, blockId, snapshot, mappingRows, expectedIds) {
  const unavailable = { complete: false, completedRoutines: 0, totalRoutines: expectedIds?.length || 0, fingerprint: '', manifest: null };
  if (text(snapshot?.event?.id).toLowerCase() !== edition.sourceEventId || snapshot?.resultScope?.complete !== true
    || text(snapshot.resultScope.eventId).toLowerCase() !== edition.sourceEventId || !Array.isArray(snapshot.resultScope.blockIds)
    || !snapshot.resultScope.blockIds.includes(blockId) || !Array.isArray(snapshot.rows) || !Array.isArray(snapshot.report?.blocks)
    || !Object.hasOwn(snapshot, 'publicationContext') || !plainObject(snapshot.publicationContext)
    || !Object.hasOwn(snapshot.publicationContext, 'competitionConfig') || !plainObject(snapshot.publicationContext.competitionConfig)) return unavailable;
  const rows = snapshot.rows.filter(row => text(row?.blockId) === blockId);
  const sourceIds = sortBy(rows, 'id').map(row => row?.id);
  unavailable.totalRoutines = expectedIds?.length || sourceIds.length;
  unavailable.completedRoutines = rows.filter(completeRoutine).length;
  if (!sourceIds.length || sourceIds.some(id => typeof id !== 'string' || !routineIdentifier.test(id)) || new Set(sourceIds).size !== sourceIds.length
    || sourceIds.some(id => snapshot.rows.filter(row => row?.id === id).length !== 1)
    || (expectedIds && (sourceIds.length !== expectedIds.length || sourceIds.some(id => !expectedIds.includes(id))))) return unavailable;
  const blocks = snapshot.report.blocks.filter(block => text(block?.id) === blockId);
  const maximumScore = snapshot.report.maximumScore;
  if (blocks.length !== 1 || !finite(maximumScore) || maximumScore <= 0 || !scoreEntries(blocks[0], maximumScore, sourceIds)) return unavailable;
  const manifest = mappingManifest(edition, sourceIds, mappingRows);
  if (!manifest || unavailable.completedRoutines !== sourceIds.length) return unavailable;
  const { isActive, ...event } = snapshot.event;
  const payload = { version: 1, editionId: edition.eventId, venue: edition.venue, sourceEventId: edition.sourceEventId, blockId,
    event, competitionConfig: snapshot.publicationContext?.competitionConfig || {}, maximumScore,
    rows: sortBy(rows, 'id').map(row => ({ ...row, judges: sortBy(row.judges, 'id').map(judge => ({ ...judge, criteria: sortBy(judge.criteria, 'id') })) })),
    block: reportFingerprint(blocks[0]), manifest };
  let fingerprint;
  try { fingerprint = await hash(stableJson(payload)); } catch { return unavailable; }
  return { complete: true, completedRoutines: rows.length, totalRoutines: rows.length, fingerprint, manifest };
}

function selectedView(block, analysis, publication) {
  const closed = publication?.state === 'closed';
  return { id: block.id, name: block.name, state: closed ? (analysis.complete && analysis.fingerprint === publication.fingerprint ? 'closed' : 'changed') : 'open',
    complete: analysis.complete, completedRoutines: analysis.completedRoutines, totalRoutines: analysis.totalRoutines,
    closedAt: publication?.closed_at || null, fingerprint: analysis.fingerprint };
}

async function loadBlock({ db, eventId, blockId, getDirectory, getSnapshot }) {
  const edition = await context(db, eventId);
  const empty = { mode: edition.mode, sourceEventId: edition.sourceEventId, blocks: [], selectedBlock: null };
  if (!edition.sourceEventId) return { edition, response: empty };
  if (typeof getDirectory !== 'function' || typeof getSnapshot !== 'function') fault('portal_judging_unavailable', 'No pudimos consultar los bloques de jueceo.', 503);
  const directory = await getDirectory(edition.sourceEventId, { trustedEventId: edition.sourceEventId });
  if (text(directory?.event?.id).toLowerCase() !== edition.sourceEventId || !Array.isArray(directory.blocks) || directory.blocks.length > 1000) {
    fault('portal_judging_invalid_response', 'No pudimos comprobar los bloques del programa.', 502);
  }
  const seenBlocks = new Set(), seenRoutines = new Set();
  const blocks = directory.blocks.map(block => {
    const id = key(block?.id, 'el bloque');
    if (seenBlocks.has(id) || !Array.isArray(block.routineIds) || block.routineIds.some(id => typeof id !== 'string' || !routineIdentifier.test(id) || seenRoutines.has(id))) {
      fault('portal_judging_invalid_response', 'El programa tiene bloques o coreografías ambiguos.', 502);
    }
    seenBlocks.add(id);
    for (const routineId of block.routineIds) seenRoutines.add(routineId);
    if (new Set(block.routineIds).size !== block.routineIds.length) fault('portal_judging_invalid_response', 'El programa tiene coreografías repetidas.', 502);
    return { id, name: text(block.name) || id, routineIds: [...block.routineIds] };
  });
  const selectedId = blockId === undefined || blockId === null || blockId === '' ? blocks[0]?.id : key(blockId, 'el bloque');
  const block = blocks.find(block => block.id === selectedId);
  if (selectedId && !block) fault('portal_block_not_found', 'No se encontró el bloque de esta edición.', 404);
  const response = { ...empty, blocks: blocks.map(block => ({ id: block.id, name: block.name, routineCount: block.routineIds.length })) };
  if (!block) return { edition, response };
  const publication = await first(db, 'SELECT * FROM participant_portal_block_publications WHERE event_id=? AND source_event_id=? AND block_id=?', edition.eventId, edition.sourceEventId, block.id);
  const snapshot = block.routineIds.length ? await getSnapshot(edition.sourceEventId, { routineIds: [block.routineIds[0]], trustedEventId: edition.sourceEventId }) : null;
  const mappingRows = await mappings(db, edition);
  const analysis = await analyzeBlock(edition, block.id, snapshot, mappingRows, block.routineIds);
  response.selectedBlock = selectedView(block, analysis, publication);
  return { edition, response, block, analysis, publication };
}

/** The HTTP caller authenticates an administrator before invoking any operation. */
export async function getBlockPublication(options) { return (await loadBlock(options)).response; }

export async function saveBlockPublicationMode({ db, input, actorId }) {
  const edition = await context(db, input?.eventId), by = actor(actorId), mode = input?.mode;
  if (!['individual', 'block_close'].includes(mode)) fault('portal_invalid_publication', 'Selecciona cómo se publica esta edición.');
  const nonce = crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO participant_portal_publication_settings(event_id,mode,operation_nonce,updated_by) VALUES(?,?,?,?)
      ON CONFLICT(event_id) DO UPDATE SET mode=excluded.mode,operation_nonce=excluded.operation_nonce,updated_by=excluded.updated_by,updated_at=datetime('now')`).bind(edition.eventId, mode, nonce, by),
    db.prepare(`INSERT INTO participant_portal_publication_history(id,event_id,action,details_json,actor_id,operation_nonce) VALUES(?,?,'mode',?,?,?)`)
      .bind(crypto.randomUUID(), edition.eventId, JSON.stringify({ before: edition.mode, mode }), by, nonce),
  ]);
  return { mode, sourceEventId: edition.sourceEventId };
}

const conflict = () => fault('portal_block_changed', 'El bloque cambió mientras lo revisabas. Actualiza y vuelve a comprobarlo antes de publicar.', 409);

export async function closeParticipantBlock({ db, input, actorId, getDirectory, getSnapshot }) {
  const loaded = await loadBlock({ db, eventId: input?.eventId, blockId: input?.blockId, getDirectory, getSnapshot });
  const { edition, block, analysis, publication } = loaded, by = actor(actorId);
  if (edition.mode !== 'block_close') fault('portal_block_mode_required', 'Activa la publicación al cerrar cada bloque antes de cerrarlo.', 409);
  if (!edition.sourceEventId || !block) fault('portal_block_unlinked', 'Primero vincula el programa real de esta edición.', 409);
  if (!analysis.complete) fault('portal_block_incomplete', 'El bloque necesita todas las evaluaciones completas y sus coreografías vinculadas antes de publicarse.', 409);
  if (input.fingerprint !== undefined && (!digestPattern.test(input.fingerprint) || input.fingerprint !== analysis.fingerprint)) conflict();
  const nonce = crypto.randomUUID(), manifest = JSON.stringify(analysis.manifest);
  const statements = [db.prepare(`INSERT INTO participant_portal_block_publications(event_id,source_event_id,block_id,state,fingerprint,manifest_json,closed_at,updated_by,operation_nonce)
    SELECT ?,?,?,'closed',?,?,datetime('now'),?,? WHERE
      EXISTS(SELECT 1 FROM participant_portal_events WHERE id=? AND venue=?)
      AND EXISTS(SELECT 1 FROM participant_portal_publication_settings WHERE event_id=? AND mode='block_close' AND operation_nonce=?)
      AND EXISTS(SELECT 1 FROM participant_portal_judging_sources WHERE event_id=? AND source_event_id=? AND enabled=1)
      AND ((? IS NULL AND NOT EXISTS(SELECT 1 FROM participant_portal_block_publications WHERE event_id=? AND source_event_id=? AND block_id=?))
        OR EXISTS(SELECT 1 FROM participant_portal_block_publications WHERE event_id=? AND source_event_id=? AND block_id=? AND operation_nonce=?))
      AND NOT EXISTS(SELECT 1 FROM json_each(?) m WHERE
        (SELECT count(*) FROM participant_portal_routines r JOIN registration_dances d ON d.id=r.dance_id
          WHERE r.id=json_extract(m.value,'$.id') AND r.event_id=? AND r.dance_id=json_extract(m.value,'$.danceId')
            AND r.source_event_id=? AND r.source_routine_id=json_extract(m.value,'$.sourceRoutineId') AND d.venue=?)<>1)
    ON CONFLICT(event_id,source_event_id,block_id) DO UPDATE SET state='closed',fingerprint=excluded.fingerprint,manifest_json=excluded.manifest_json,
      closed_at=excluded.closed_at,updated_by=excluded.updated_by,operation_nonce=excluded.operation_nonce,updated_at=datetime('now')`)
    .bind(edition.eventId, edition.sourceEventId, block.id, analysis.fingerprint, manifest, by, nonce,
      edition.eventId, edition.venue, edition.eventId, edition.settings_nonce, edition.eventId, edition.sourceEventId,
      publication?.operation_nonce || null, edition.eventId, edition.sourceEventId, block.id,
      edition.eventId, edition.sourceEventId, block.id, publication?.operation_nonce || null,
      manifest, edition.eventId, edition.sourceEventId, edition.venue),
    db.prepare(`UPDATE participant_portal_routines SET status='published',updated_at=datetime('now') WHERE event_id=?
      AND id IN(SELECT json_extract(m.value,'$.id') FROM participant_portal_block_publications p,json_each(p.manifest_json) m
        WHERE p.event_id=? AND p.source_event_id=? AND p.block_id=? AND p.operation_nonce=? AND p.state='closed')`)
      .bind(edition.eventId, edition.eventId, edition.sourceEventId, block.id, nonce),
    db.prepare(`INSERT INTO participant_portal_publication_history(id,event_id,source_event_id,block_id,action,details_json,actor_id,operation_nonce)
      SELECT ?,event_id,source_event_id,block_id,'close',?,?,operation_nonce FROM participant_portal_block_publications
      WHERE event_id=? AND source_event_id=? AND block_id=? AND operation_nonce=?`)
      .bind(crypto.randomUUID(), JSON.stringify({ fingerprint: analysis.fingerprint, manifest: analysis.manifest }), by, edition.eventId, edition.sourceEventId, block.id, nonce),
  ];
  try { await db.batch(statements); } catch { conflict(); }
  const saved = await first(db, 'SELECT * FROM participant_portal_block_publications WHERE event_id=? AND source_event_id=? AND block_id=? AND operation_nonce=?', edition.eventId, edition.sourceEventId, block.id, nonce);
  if (!saved) conflict();
  return { ...loaded.response, selectedBlock: selectedView(block, analysis, saved) };
}

export async function reopenParticipantBlock({ db, input, actorId }) {
  const edition = await context(db, input?.eventId), blockId = key(input?.blockId, 'el bloque'), by = actor(actorId);
  if (edition.mode !== 'block_close') fault('portal_block_mode_required', 'La edición no usa la publicación por cierre de bloque.', 409);
  if (!edition.sourceEventId) fault('portal_block_unlinked', 'Primero vincula el programa de esta edición.', 409);
  const publication = await first(db, 'SELECT * FROM participant_portal_block_publications WHERE event_id=? AND source_event_id=? AND block_id=?', edition.eventId, edition.sourceEventId, blockId);
  if (!publication) fault('portal_block_not_found', 'Este bloque todavía no tiene un cierre registrado.', 404);
  const nonce = crypto.randomUUID();
  await db.batch([
    db.prepare(`UPDATE participant_portal_block_publications SET state='open',fingerprint=NULL,closed_at=NULL,operation_nonce=?,updated_by=?,updated_at=datetime('now')
      WHERE event_id=? AND source_event_id=? AND block_id=? AND operation_nonce=?
        AND EXISTS(SELECT 1 FROM participant_portal_publication_settings WHERE event_id=? AND mode='block_close' AND operation_nonce=?)
        AND EXISTS(SELECT 1 FROM participant_portal_judging_sources WHERE event_id=? AND source_event_id=? AND enabled=1)`)
      .bind(nonce, by, edition.eventId, edition.sourceEventId, blockId, publication.operation_nonce, edition.eventId, edition.settings_nonce, edition.eventId, edition.sourceEventId),
    db.prepare(`INSERT INTO participant_portal_publication_history(id,event_id,source_event_id,block_id,action,details_json,actor_id,operation_nonce)
      SELECT ?,event_id,source_event_id,block_id,'reopen',?,?,operation_nonce FROM participant_portal_block_publications
      WHERE event_id=? AND source_event_id=? AND block_id=? AND operation_nonce=?`)
      .bind(crypto.randomUUID(), JSON.stringify({ previousFingerprint: publication.fingerprint }), by, edition.eventId, edition.sourceEventId, blockId, nonce),
  ]);
  const saved = await first(db, 'SELECT * FROM participant_portal_block_publications WHERE event_id=? AND source_event_id=? AND block_id=? AND operation_nonce=?', edition.eventId, edition.sourceEventId, blockId, nonce);
  if (!saved) conflict();
  let totalRoutines = 0; try { totalRoutines = JSON.parse(saved.manifest_json).length; } catch { /* Preserve a readable open state for malformed historical metadata. */ }
  return { mode: edition.mode, sourceEventId: edition.sourceEventId, blocks: [], selectedBlock: { id: blockId, name: blockId, state: 'open', complete: false,
    completedRoutines: 0, totalRoutines, closedAt: null, fingerprint: '' } };
}

function requestAuthorizationCheck(db, edition, mappingRows = null, publications = null) {
  const scoped = Array.isArray(mappingRows) && Array.isArray(publications);
  const publicationJson = scoped ? JSON.stringify(publications.map(row => ({
    block_id: row.block_id, state: row.state, fingerprint: row.fingerprint,
    manifest_json: row.manifest_json, operation_nonce: row.operation_nonce,
  }))) : '';
  const mappingJson = scoped ? JSON.stringify(mappingRows) : '';
  return async () => {
    try {
      const args = [edition.eventId, edition.venue, edition.mode, edition.settings_nonce ?? null,
        edition.source_event_id ?? null, edition.enabled ?? null];
      const extra = scoped ? `
        AND (SELECT count(*) FROM participant_portal_block_publications p WHERE p.event_id=e.id AND p.source_event_id=?)=?
        AND NOT EXISTS(SELECT 1 FROM json_each(?) expected WHERE NOT EXISTS(
          SELECT 1 FROM participant_portal_block_publications p WHERE p.event_id=e.id AND p.source_event_id=?
            AND p.block_id IS json_extract(expected.value,'$.block_id') AND p.state IS json_extract(expected.value,'$.state')
            AND p.operation_nonce IS json_extract(expected.value,'$.operation_nonce') AND p.fingerprint IS json_extract(expected.value,'$.fingerprint')
            AND p.manifest_json IS json_extract(expected.value,'$.manifest_json')))
        AND (SELECT count(*) FROM participant_portal_routines r WHERE r.event_id=e.id)=?
        AND NOT EXISTS(SELECT 1 FROM json_each(?) expected WHERE
          (SELECT count(*) FROM participant_portal_routines r LEFT JOIN registration_dances d ON d.id=r.dance_id
            WHERE r.event_id=e.id AND r.id IS json_extract(expected.value,'$.id') AND r.dance_id IS json_extract(expected.value,'$.dance_id')
              AND r.source_event_id IS json_extract(expected.value,'$.source_event_id') AND r.source_routine_id IS json_extract(expected.value,'$.source_routine_id')
              AND d.venue IS json_extract(expected.value,'$.venue'))<>1)` : '';
      if (scoped) args.push(edition.sourceEventId, publications.length, publicationJson, edition.sourceEventId, mappingRows.length, mappingJson);
      const fresh = await first(db, `SELECT 1 AS allowed FROM participant_portal_events e
        LEFT JOIN participant_portal_publication_settings s ON s.event_id=e.id
        LEFT JOIN participant_portal_judging_sources j ON j.event_id=e.id
        WHERE e.id=? AND e.venue=? AND coalesce(s.mode,'individual')=? AND s.operation_nonce IS ?
          AND j.source_event_id IS ? AND j.enabled IS ? ${extra}`, ...args);
      return Boolean(fresh?.allowed);
    } catch { return false; }
  };
}

/** A fresh request-local gate. Only persisted source bindings authorize reads;
 * cached hashes never outlive the request. The caller still authenticates the
 * participant, enforces edition visibility and each asset's approval flags, and
 * invokes confirm() after every other awaited read before returning a response.
 */
export async function createBlockPublicationGate({ db, eventId }) {
  const edition = await context(db, eventId);
  if (edition.mode === 'individual') return { mode: edition.mode, allowsRoutine: async () => true, confirm: requestAuthorizationCheck(db, edition) };
  if (!edition.sourceEventId) return { mode: edition.mode, allowsRoutine: async () => false, confirm: requestAuthorizationCheck(db, edition) };
  const [mappingRows, publications] = await Promise.all([
    mappings(db, edition), all(db, 'SELECT * FROM participant_portal_block_publications WHERE event_id=? AND source_event_id=?', edition.eventId, edition.sourceEventId),
  ]);
  const snapshots = new WeakMap();
  const confirm = requestAuthorizationCheck(db, edition, mappingRows, publications);
  let freshPromise;
  const allowsRoutine = async ({ sourceEventId, sourceRoutineId, danceId, snapshot } = {}) => {
    if (sourceEventId !== edition.sourceEventId || typeof sourceRoutineId !== 'string' || !routineIdentifier.test(sourceRoutineId) || !text(danceId)
      || !snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.rows)) return false;
    const own = snapshot.rows.filter(row => row?.id === sourceRoutineId);
    if (own.length !== 1 || !text(own[0].blockId)) return false;
    const blockId = own[0].blockId, publication = publications.find(row => row.block_id === blockId && row.state === 'closed');
    if (!publication || !digestPattern.test(publication.fingerprint)) return false;
    let manifest;
    try { manifest = JSON.parse(publication.manifest_json); } catch { return false; }
    if (!Array.isArray(manifest) || !manifest.length || manifest.length > 5000
      || manifest.some(row => !row || row.sourceEventId !== edition.sourceEventId || !routineIdentifier.test(row.sourceRoutineId))
      || new Set(manifest.map(row => row.sourceRoutineId)).size !== manifest.length
      || !manifest.some(row => row.sourceRoutineId === sourceRoutineId && row.danceId === danceId)) return false;
    let blocks = snapshots.get(snapshot);
    if (!blocks) { blocks = new Map(); snapshots.set(snapshot, blocks); }
    if (!blocks.has(blockId)) blocks.set(blockId, (async () => {
      const analysis = await analyzeBlock(edition, blockId, snapshot, mappingRows, manifest.map(row => row.sourceRoutineId));
      return Boolean(analysis.complete && analysis.fingerprint === publication.fingerprint && stableJson(analysis.manifest) === stableJson(manifest));
    })().catch(() => false));
    if (!(await blocks.get(blockId))) return false;
    // One bounded recheck covers every captured closure and association, even
    // for a participant with many blocks. The final confirm() deliberately
    // does not reuse this promise: Drive/body reads can await after this point.
    freshPromise ||= confirm();
    return freshPromise;
  };
  return { mode: edition.mode, allowsRoutine, confirm };
}

export async function blockAllowsRoutine({ db, eventId, ...routine }) {
  const gate = await createBlockPublicationGate({ db, eventId });
  return Boolean(await gate.allowsRoutine(routine) && await gate.confirm());
}
