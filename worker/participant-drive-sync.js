import { PHOTO_WATERMARK_VERSION } from '../shared/participant-photo-watermark.js';
import { PHOTO_PREVIEW_LIMIT, prioritizedPhotoDances } from './participant-photo-priority.js';

const pending = (participantId, eventId, status = 'pending', extra = {}) => ({ status, hasMore: false, imported: 0, participantId, eventId, ...extra });
const first = (db, sql, ...bindings) => db.prepare(sql).bind(...bindings).first();
const all = async (db, sql, ...bindings) => (await db.prepare(sql).bind(...bindings).all()).results || [];
const normalized = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toUpperCase();
const parsedBindings = value => {
  try { const result = JSON.parse(value); return result && typeof result === 'object' && !Array.isArray(result) ? result : {}; }
  catch { return {}; }
};
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
const safeError = cause => typeof cause?.code === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(cause.code) ? cause.code : 'photo_sync_unavailable';
const unavailable = () => Object.assign(new Error('No pudimos preparar las vistas previas por el momento.'), { code: 'portal_photo_sync_unavailable', statusCode: 503 });

async function context(db, env, participantId, eventId, adminPreview) {
  const participant = await first(db, `SELECT p.id,p.full_name,p.academy_id,a.name AS academy_name FROM registration_participants p
    JOIN registration_academies a ON a.id=p.academy_id WHERE p.id=?`, participantId);
  const event = await first(db, 'SELECT id,venue,published FROM participant_portal_events WHERE id=?', eventId);
  if (!participant || !event || (!adminPreview && !event.published)) return null;
  const registration = String(env.PARTICIPANT_REGISTRATION_EVENT_IDS || '').split(',').map(value => value.trim()).includes(event.id);
  const dances = await all(db, `SELECT d.id,d.title,
    (SELECT COUNT(*) FROM registration_dance_participants members WHERE members.dance_id=d.id) AS participant_count
    FROM registration_dances d
    JOIN registration_dance_participants dp ON dp.dance_id=d.id
    LEFT JOIN participant_portal_routines r ON r.event_id=? AND r.dance_id=d.id
    WHERE dp.participant_id=? AND d.academy_id=? AND d.venue=? AND (?=1 OR r.id IS NOT NULL)
    ORDER BY d.title,d.id`, event.id, participant.id, participant.academy_id, event.venue, registration ? 1 : 0);
  const peers = await all(db, 'SELECT id,full_name FROM registration_participants WHERE academy_id=?', participant.academy_id);
  return { participant, dances: prioritizedPhotoDances(dances), ambiguousName: peers.filter(row => normalized(row.full_name) === normalized(participant.full_name)).length !== 1 };
}

function sameDances(initial, current) {
  return current?.participant?.academy_id === initial.participant.academy_id
    && JSON.stringify(current?.dances) === JSON.stringify(initial.dances);
}

async function ownedLease(db, eventId, participantId, nonce, file) {
  const sync = await first(db, `SELECT lease_token FROM participant_portal_drive_sync WHERE event_id=? AND participant_id=?
    AND lease_token=? AND lease_until>datetime('now')`, eventId, participantId, nonce);
  if (!sync) return false;
  if (!file) return true;
  return Boolean(await first(db, `SELECT lease_token FROM participant_portal_drive_files
    WHERE event_id=? AND dance_id=? AND source_file_id=? AND source_version=? AND lease_token=? AND lease_until>datetime('now')`,
  eventId, file.danceId, file.photo.id, file.photo.revision, nonce));
}

function membershipGuard({ eventId, participantId, danceId, nonce, adminPreview }) {
  return { sql: `EXISTS(SELECT 1 FROM participant_portal_drive_sync s
    JOIN participant_portal_events e ON e.id=s.event_id JOIN registration_dances d ON d.id=?
    JOIN registration_dance_participants dp ON dp.dance_id=d.id AND dp.participant_id=s.participant_id
    JOIN registration_participants p ON p.id=dp.participant_id
    WHERE s.event_id=? AND s.participant_id=? AND s.lease_token=? AND s.lease_until>datetime('now')
      AND d.venue=e.venue AND d.academy_id=p.academy_id AND (?=1 OR e.published=1))`,
  args: [danceId, eventId, participantId, nonce, adminPreview ? 1 : 0] };
}

async function promoteReadyPreview(db, { eventId, participantId, nonce, danceId, photo, assetId }) {
  const member = membershipGuard({ eventId, participantId, danceId, nonce, adminPreview: false });
  const guard = `EXISTS(SELECT 1 FROM participant_portal_drive_files f
    JOIN participant_portal_assets a ON a.id=f.asset_id AND a.event_id=f.event_id
    JOIN participant_portal_routines r ON r.id=a.routine_id AND r.event_id=f.event_id AND r.dance_id=f.dance_id
    WHERE f.event_id=? AND f.dance_id=? AND f.source_file_id=? AND f.source_version=? AND f.asset_id=?
      AND f.status='ready' AND f.publication_policy='draft' AND coalesce(r.publication_blocked,0)=0
      AND NOT EXISTS(SELECT 1 FROM participant_portal_drive_album_settings settings
        WHERE settings.event_id=f.event_id AND settings.dance_id=f.dance_id AND settings.publication_paused=1)
      AND ${member.sql})`;
  const args = [eventId, danceId, photo.id, photo.revision, assetId, ...member.args];
  await db.batch([
    db.prepare(`UPDATE participant_portal_assets SET published=1 WHERE id=? AND kind='photo' AND ${guard}`).bind(assetId, ...args),
    db.prepare(`UPDATE participant_portal_routines SET photos_published=1,updated_at=datetime('now')
      WHERE event_id=? AND dance_id=? AND ${guard}`).bind(eventId, danceId, ...args),
    db.prepare(`UPDATE participant_portal_drive_files SET publication_policy='automatic',updated_at=datetime('now')
      WHERE event_id=? AND dance_id=? AND source_file_id=? AND source_version=? AND ${guard}`)
      .bind(eventId, danceId, photo.id, photo.revision, ...args),
  ]);
}

/** Called by authenticated POSTs when a passport opens. GETs remain read-only.
 * One new image per call bounds CPU, memory and Drive work on the free runtime.
 * Only metadata lives in D1; source bytes and signed URLs never leave the server.
 */
export async function syncParticipantDrivePhotos({ db, env, participantId, eventId, adminPreview = false,
  assertAuthorized, getDiscovery, getMediaStore, processPhoto, uploadPreview } = {}) {
  if (!db || !env || !identifier(participantId) || !identifier(eventId) || typeof assertAuthorized !== 'function') throw unavailable();
  await assertAuthorized();
  const initial = await context(db, env, participantId, eventId, adminPreview);
  if (!initial?.dances.length) return pending(participantId, eventId);
  if ([getDiscovery, getMediaStore, processPhoto, uploadPreview].some(value => typeof value !== 'function')) throw unavailable();
  const nonce = crypto.randomUUID();
  const claimed = await first(db, `INSERT INTO participant_portal_drive_sync(event_id,participant_id,lease_token,lease_until)
    VALUES(?,?,?,datetime('now','+120 seconds'))
    ON CONFLICT(event_id,participant_id) DO UPDATE SET lease_token=excluded.lease_token,lease_until=excluded.lease_until,updated_at=datetime('now')
    WHERE (participant_portal_drive_sync.lease_until IS NULL OR participant_portal_drive_sync.lease_until<=datetime('now'))
      AND (participant_portal_drive_sync.next_check_at IS NULL OR participant_portal_drive_sync.next_check_at<=datetime('now'))
    RETURNING bindings_json`, eventId, participantId, nonce);
  if (!claimed) {
    const state = await first(db, `SELECT lease_token,last_error,lease_until>datetime('now') AS active_lease
      FROM participant_portal_drive_sync WHERE event_id=? AND participant_id=?`, eventId, participantId);
    if (state?.lease_token && state.active_lease) return pending(participantId, eventId, 'checking', { hasMore: true });
    if (state?.last_error) return pending(participantId, eventId, 'unavailable');
    // Throttling avoids another Drive read; it is not evidence that a preview
    // exists. Count only prepared assets of this participant's member dances.
    const ready = await first(db, `SELECT 1 AS available FROM participant_portal_drive_files f
      JOIN participant_portal_assets a ON a.id=f.asset_id AND a.event_id=f.event_id AND a.kind='photo'
      JOIN participant_portal_routines r ON r.id=a.routine_id AND r.event_id=f.event_id AND r.dance_id=f.dance_id
      JOIN registration_dances d ON d.id=f.dance_id
      JOIN registration_dance_participants dp ON dp.dance_id=d.id
      WHERE f.event_id=? AND dp.participant_id=? AND d.academy_id=? AND d.venue=(SELECT venue FROM participant_portal_events WHERE id=f.event_id)
        AND f.status='ready' AND f.source_version LIKE ?
        AND (?=1 OR (f.publication_policy='automatic' AND a.published=1 AND r.photos_published=1
          AND coalesce(r.publication_blocked,0)=0 AND NOT EXISTS(SELECT 1 FROM participant_portal_drive_album_settings settings
            WHERE settings.event_id=f.event_id AND settings.dance_id=f.dance_id AND settings.publication_paused=1))) LIMIT 1`,
    eventId, participantId, initial.participant.academy_id, `${PHOTO_WATERMARK_VERSION}:%`, adminPreview ? 1 : 0);
    return pending(participantId, eventId, ready ? 'ready' : 'pending');
  }
  let file, finished = false;
  const release = async ({ bindings, error = null, delay = 60 } = {}) => {
    await db.prepare(`UPDATE participant_portal_drive_sync SET bindings_json=coalesce(?,bindings_json),lease_token=NULL,lease_until=NULL,
      next_check_at=CASE WHEN ?=0 THEN NULL ELSE datetime('now',?) END,last_checked_at=datetime('now'),last_error=?,updated_at=datetime('now')
      WHERE event_id=? AND participant_id=? AND lease_token=?`)
      .bind(bindings ? JSON.stringify(bindings) : null, delay, `+${delay} seconds`, error, eventId, participantId, nonce).run();
    finished = true;
  };
  try {
    const knownBindings = parsedBindings(claimed.bindings_json);
    const discovery = await getDiscovery();
    if (typeof discovery?.discover !== 'function') throw unavailable();
    // Legacy albums contain an individual participant name. The new hierarchy
    // binds academy + choreography IDs; membership came from the database above.
    if (initial.ambiguousName && discovery.identityScope !== 'dance'
      && initial.dances.some(dance => !identifier(knownBindings[dance.id]?.folderId))) {
      await release({ error: 'ambiguous_participant' });
      return pending(participantId, eventId);
    }
    const discovered = await discovery.discover({ eventId, participantId, participantName: initial.participant.full_name,
      academyId: initial.participant.academy_id, academyName: initial.participant.academy_name, dances: initial.dances.map(({ id, title }) => ({ id, title })), maxPhotos: PHOTO_PREVIEW_LIMIT, knownBindings, adminPreview });
    await assertAuthorized();
    const current = await context(db, env, participantId, eventId, adminPreview);
    if (!sameDances(initial, current) || !await ownedLease(db, eventId, participantId, nonce)) throw unavailable();
    const albums = Array.isArray(discovered?.albums) ? discovered.albums : [];
    const bindings = { ...knownBindings }, candidates = [];
    let readyCount = 0;
    const seenPhotos = new Set();
    for (const dance of initial.dances) {
      if (seenPhotos.size >= PHOTO_PREVIEW_LIMIT) break;
      const danceId = dance.id;
      const trustedAlbums = albums.filter(album => album && identifier(album.id) && album.danceId === danceId
        && album.trusted === true && (!album.demo || adminPreview) && Array.isArray(album.photos));
      if (trustedAlbums.length > 1) throw Object.assign(unavailable(), { code: 'ambiguous_photo_album' });
      const [album] = trustedAlbums;
      if (!album) continue;
      bindings[danceId] = { folderId: album.id };
      for (const sourcePhoto of album.photos) {
        if (seenPhotos.size >= PHOTO_PREVIEW_LIMIT) break;
        if (!sourcePhoto || !identifier(sourcePhoto.id) || typeof sourcePhoto.revision !== 'string' || !sourcePhoto.revision || sourcePhoto.revision.length > 300
          || !['image/jpeg','image/png','image/webp'].includes(sourcePhoto.mimeType) || typeof sourcePhoto.read !== 'function' || seenPhotos.has(sourcePhoto.id)) continue;
        const photo = { ...sourcePhoto, revision: `${PHOTO_WATERMARK_VERSION}:${sourcePhoto.revision}` };
        seenPhotos.add(photo.id);
        const prior = await first(db, `SELECT status,asset_id,publication_policy,
          CASE WHEN status='failed' AND updated_at>datetime('now','-60 seconds') THEN 1 ELSE 0 END AS cooling_down
          FROM participant_portal_drive_files
          WHERE event_id=? AND dance_id=? AND source_file_id=? AND source_version=?`, eventId, danceId, photo.id, photo.revision);
        if (prior?.status === 'ready' && prior.asset_id) {
          readyCount++;
          if (!adminPreview && !album.demo && prior.publication_policy === 'draft') {
            await assertAuthorized();
            const valid = await context(db, env, participantId, eventId, false);
            if (!sameDances(initial, valid)) throw unavailable();
            await promoteReadyPreview(db, { eventId, participantId, nonce, danceId, photo, assetId: prior.asset_id });
          }
        } else if (!prior?.cooling_down) candidates.push({ album, photo, danceId });
      }
    }
    if (!candidates.length) {
      await release({ bindings });
      return pending(participantId, eventId, readyCount ? 'ready' : 'pending');
    }
    for (const candidate of candidates) {
      const claim = await first(db, `INSERT INTO participant_portal_drive_files(event_id,dance_id,source_file_id,source_version,source_folder_id,lease_token,lease_until)
        VALUES(?,?,?,?,?,?,datetime('now','+120 seconds'))
        ON CONFLICT(event_id,dance_id,source_file_id,source_version) DO UPDATE SET source_folder_id=excluded.source_folder_id,
          status='pending',lease_token=excluded.lease_token,lease_until=excluded.lease_until,last_error=NULL,updated_at=datetime('now')
        WHERE (participant_portal_drive_files.status<>'ready' OR participant_portal_drive_files.asset_id IS NULL)
          AND (participant_portal_drive_files.lease_until IS NULL OR participant_portal_drive_files.lease_until<=datetime('now'))
        RETURNING source_file_id`, eventId, candidate.danceId, candidate.photo.id, candidate.photo.revision, candidate.album.id, nonce);
      if (claim) { file = candidate; break; }
    }
    if (!file) {
      await release({ bindings, delay: 0 });
      return pending(participantId, eventId, 'checking', { hasMore: true });
    }
    const source = await file.photo.read();
    await assertAuthorized();
    if (!(source?.bytes instanceof Uint8Array) || !source.bytes.length) throw unavailable();
    const prepared = await processPhoto({ bytes: source.bytes, contentType: source.contentType || file.photo.mimeType, blur: file.photo.blur === true });
    if (!(prepared?.bytes instanceof Uint8Array) || !prepared.bytes.length || prepared.bytes.length > 1024 * 1024
      || !Number.isInteger(prepared.width) || !Number.isInteger(prepared.height) || prepared.width < 1 || prepared.height < 1
      || prepared.width > 1600 || prepared.height > 1600) throw unavailable();
    await assertAuthorized();
    const valid = await context(db, env, participantId, eventId, adminPreview);
    if (!sameDances(initial, valid) || !await ownedLease(db, eventId, participantId, nonce, file)) throw unavailable();
    let routine = await first(db, 'SELECT id FROM participant_portal_routines WHERE event_id=? AND dance_id=?', eventId, file.danceId);
    if (!routine) {
      await db.prepare('INSERT INTO participant_portal_routines(id,event_id,dance_id) VALUES(?,?,?) ON CONFLICT(event_id,dance_id) DO NOTHING')
        .bind(crypto.randomUUID(), eventId, file.danceId).run();
      routine = await first(db, 'SELECT id FROM participant_portal_routines WHERE event_id=? AND dance_id=?', eventId, file.danceId);
    }
    if (!routine) throw unavailable();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([eventId, file.danceId, file.photo.id, file.photo.revision])));
    const uploadId = 'auto-drive-' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
    const storage = await getMediaStore();
    if (storage?.info?.provider !== 'google_drive') throw unavailable();
    const uploaded = await uploadPreview({ eventId, routineId: routine.id, uploadId, bytes: prepared.bytes,
      width: prepared.width, height: prepared.height, caption: file.album.demo
        ? 'Foto de demostración — no corresponde a esta participante.' : 'Vista previa de tu presentación.', storage });
    if (!identifier(uploaded?.assetId)) throw unavailable();
    await assertAuthorized();
    const afterUpload = await context(db, env, participantId, eventId, adminPreview);
    if (!sameDances(initial, afterUpload) || !await ownedLease(db, eventId, participantId, nonce, file)) throw unavailable();
    const canApprove = !adminPreview && !file.album.demo && file.album.trusted === true;
    const member = membershipGuard({ eventId, participantId, danceId: file.danceId, nonce, adminPreview });
    const guard = `EXISTS(SELECT 1 FROM participant_portal_drive_files f JOIN participant_portal_drive_sync s ON s.event_id=f.event_id
      WHERE f.event_id=? AND f.dance_id=? AND f.source_file_id=? AND f.source_version=? AND f.lease_token=?
        AND f.lease_until>datetime('now') AND s.participant_id=? AND s.lease_token=? AND s.lease_until>datetime('now')
        AND f.publication_policy<>'held' AND NOT EXISTS(SELECT 1 FROM participant_portal_drive_album_settings settings
          WHERE settings.event_id=f.event_id AND settings.dance_id=f.dance_id AND settings.publication_paused=1))
      AND ${member.sql}`;
    const guardArgs = [eventId, file.danceId, file.photo.id, file.photo.revision, nonce, participantId, nonce, ...member.args];
    const statements = [];
    if (canApprove) {
      statements.push(db.prepare(`UPDATE participant_portal_assets SET published=1 WHERE id=? AND event_id=? AND routine_id=? AND ${guard}`)
        .bind(uploaded.assetId, eventId, routine.id, ...guardArgs));
      statements.push(db.prepare(`UPDATE participant_portal_routines SET photos_published=1,updated_at=datetime('now')
        WHERE id=? AND event_id=? AND coalesce(publication_blocked,0)=0 AND ${guard}`).bind(routine.id, eventId, ...guardArgs));
    }
    statements.push(db.prepare(`UPDATE participant_portal_drive_files SET asset_id=?,status='ready',
      publication_policy=CASE WHEN publication_policy='held' THEN 'held' WHEN ?=1
        AND NOT EXISTS(SELECT 1 FROM participant_portal_drive_album_settings settings
          WHERE settings.event_id=participant_portal_drive_files.event_id AND settings.dance_id=participant_portal_drive_files.dance_id AND settings.publication_paused=1)
        THEN 'automatic' ELSE 'draft' END,
      lease_token=NULL,lease_until=NULL,last_error=NULL,updated_at=datetime('now')
      WHERE event_id=? AND dance_id=? AND source_file_id=? AND source_version=? AND lease_token=? AND lease_until>datetime('now') AND ${member.sql}`)
      .bind(uploaded.assetId, canApprove ? 1 : 0, eventId, file.danceId, file.photo.id, file.photo.revision, nonce, ...member.args));
    const committed = await db.batch(statements);
    const changed = committed.at(-1)?.meta?.changes;
    if (changed === 0) throw unavailable();
    file = null;
    const hasMore = candidates.length > 1;
    await release({ bindings, delay: hasMore ? 0 : 60 });
    await assertAuthorized();
    return pending(participantId, eventId, 'ready', { hasMore, imported: 1 });
  } catch (cause) {
    if (file) await db.prepare(`UPDATE participant_portal_drive_files SET status='failed',lease_token=NULL,lease_until=NULL,last_error=?,updated_at=datetime('now')
      WHERE event_id=? AND dance_id=? AND source_file_id=? AND source_version=? AND lease_token=?`)
      .bind(safeError(cause), eventId, file.danceId, file.photo.id, file.photo.revision, nonce).run();
    if (!finished) await release({ error: safeError(cause), delay: 15 });
    if ([401,403,404,410].includes(cause?.statusCode || cause?.status)) throw cause;
    return pending(participantId, eventId, 'unavailable');
  }
}
