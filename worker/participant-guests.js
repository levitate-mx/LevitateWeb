const fail = (code, message, statusCode = 400) => { throw Object.assign(new Error(message), { code, statusCode }); };
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();
const names = value => String(value ?? '').split(/[,;\n]+/).map(value => normalize(value.replaceAll('"', ''))).filter(Boolean);
const all = async (db, sql, ...values) => (await db.prepare(sql).bind(...values).all()).results || [];
const first = (db, sql, ...values) => db.prepare(sql).bind(...values).first();
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');

/** Called by the authenticated global-admin route or an authenticated D1 operator.
 * Creates an event identity, never a registration, student account, or CURP. */
export async function ensureParticipantGuest({ db, input, actorId }) {
  if (typeof actorId !== 'string' || !actorId) fail('portal_guest_actor_missing', 'Identifica al administrador que prepara el acceso.', 401);
  if (!['participant', 'releve', 'choreographer'].includes(input.role)) fail('portal_guest_invalid', 'Selecciona el tipo de invitado.');
  for (const field of ['eventId', 'academyId', ...(input.role === 'participant' ? [] : ['choreographerId'])]) {
    if (typeof input[field] !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input[field])) fail('portal_guest_invalid', 'Revisa las referencias del invitado.');
  }
  const event = await first(db, 'SELECT id,venue FROM participant_portal_events WHERE id=?', input.eventId);
  if (!event) fail('portal_event_not_found', 'No se encontró la edición.', 404);
  let name, sourceKey;
  if (input.role === 'participant') {
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 300) fail('portal_guest_invalid', 'Revisa el nombre del invitado.');
    name = input.name.trim();
    sourceKey = `program:${input.academyId}:${await digest(normalize(name))}`;
  } else {
    const person = await first(db, 'SELECT id,full_name,academy_id FROM registration_choreographers WHERE id=?', input.choreographerId);
    if (!person || person.academy_id !== input.academyId) fail('portal_guest_invalid', 'Selecciona un coreógrafo de esta academia.');
    name = person.full_name;
    sourceKey = `choreographer:${person.id}`;
  }
  const registered = await all(db, 'SELECT id,full_name FROM registration_participants WHERE academy_id=?', input.academyId);
  if (registered.some(person => normalize(person.full_name) === normalize(name))) {
    fail('portal_guest_registered', 'Esta persona ya tiene ficha de participante. Conserva su acceso existente.', 409);
  }
  if (!Array.isArray(input.danceIds) || !input.danceIds.length || input.danceIds.length > 100
    || input.danceIds.some(value => typeof value !== 'string' || !value || value.length > 100)
    || new Set(input.danceIds).size !== input.danceIds.length) fail('portal_guest_invalid', 'Selecciona las presentaciones del invitado.');
  const dances = await all(db, `SELECT d.id,d.program_json,d.is_releve,
    EXISTS(SELECT 1 FROM registration_dance_choreographers dc WHERE dc.dance_id=d.id AND dc.choreographer_id=?) AS is_choreographer
    FROM registration_dances d WHERE d.academy_id=? AND d.venue=?`, input.choreographerId || '', input.academyId, event.venue);
  const selected = input.danceIds.map(id => {
    const dance = dances.find(row => row.id === id);
    let program;
    try { program = JSON.parse(dance?.program_json); } catch { /* Reject unassigned registrations. */ }
    if (!program || program.eventId !== event.id) fail('portal_guest_invalid', 'Una presentación no pertenece al programa de esta edición.');
    const performer = names(program.participants).includes(normalize(name));
    const associated = input.role === 'participant' ? performer
      : input.role === 'releve' ? performer || (dance.is_releve === 1 && dance.is_choreographer === 1)
      : dance.is_choreographer === 1;
    if (!associated) fail('portal_guest_invalid', 'La persona no figura en los créditos de esta presentación.');
    return { ...dance, program };
  });
  const existing = await first(db, 'SELECT * FROM participant_portal_guests WHERE event_id=? AND source_key=?', event.id, sourceKey);
  if (existing) {
    const links = await all(db, 'SELECT dance_id FROM participant_portal_guest_dances WHERE guest_id=? ORDER BY dance_id', existing.id);
    if (existing.academy_id !== input.academyId || existing.role !== input.role || normalize(existing.full_name) !== normalize(name)
      || JSON.stringify(links.map(row => row.dance_id).sort()) !== JSON.stringify([...input.danceIds].sort())) {
      fail('portal_guest_exists', 'El invitado ya tiene otro perfil. Revisa sus presentaciones antes de cambiar su acceso.', 409);
    }
    return { guestId: existing.id, name: existing.full_name, reused: true };
  }
  const guestId = crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT INTO participant_portal_guests(id,event_id,academy_id,full_name,source_key,role,division,created_by) VALUES(?,?,?,?,?,?,?,?)')
      .bind(guestId, event.id, input.academyId, name, sourceKey, input.role, input.role === 'releve' ? 'releve' : selected[0].program.division || null, actorId),
    ...selected.map(dance => db.prepare('INSERT INTO participant_portal_guest_dances(guest_id,dance_id) VALUES(?,?)').bind(guestId, dance.id)),
  ]);
  return { guestId, name, reused: false };
}

/** beforeInsert lets a private issuance job durably save the random QR before
 * its database write, so a lost network reply never requires QR rotation. */
export async function issueParticipantGuestAccess({ db, guestId, eventId, rotate = false, beforeInsert }) {
  const guest = await first(db, 'SELECT id,event_id FROM participant_portal_guests WHERE id=?', guestId);
  if (!guest || guest.event_id !== eventId) fail('portal_participant_not_found', 'No se encontró al invitado en esta edición.', 404);
  const previous = await first(db, 'SELECT id FROM participant_portal_guest_access WHERE guest_id=? AND event_id=? AND active=1', guestId, eventId);
  if (previous && !rotate) fail('portal_access_exists', 'Ya existe un enlace activo. Conserva el QR emitido.', 409);
  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const accessId = crypto.randomUUID(), tokenHash = await digest(token);
  const grant = { id: accessId, token, entryUrl: `/mi-levitate#access=${token}` };
  if (beforeInsert) await beforeInsert({ ...grant, guestId, eventId, tokenHash });
  const insert = db.prepare('INSERT INTO participant_portal_guest_access(id,guest_id,event_id,token_hash) VALUES(?,?,?,?)').bind(accessId, guestId, eventId, tokenHash);
  if (rotate) await db.batch([
    db.prepare("UPDATE participant_portal_guest_access SET active=0,revoked_at=datetime('now') WHERE guest_id=? AND event_id=? AND active=1").bind(guestId, eventId), insert,
  ]);
  else {
    try { await insert.run(); }
    catch (error) {
      if (await first(db, 'SELECT id FROM participant_portal_guest_access WHERE guest_id=? AND event_id=? AND active=1', guestId, eventId)) {
        fail('portal_access_exists', 'Ya existe un enlace activo. Conserva el QR emitido.', 409);
      }
      throw error;
    }
  }
  return grant;
}

/** Preserve an existing participant QR when its holder also performs Relevé. */
export async function linkRegisteredReleve({ db, input, actorId }) {
  if (typeof actorId !== 'string' || !actorId) fail('portal_guest_actor_missing', 'Identifica al administrador.', 401);
  for (const field of ['participantId', 'eventId', 'danceId', 'choreographerId']) {
    if (typeof input[field] !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input[field])) fail('portal_guest_invalid', 'Revisa las referencias de Relevé.');
  }
  const row = await first(db, `SELECT p.full_name AS participant_name,c.full_name AS choreographer_name,d.program_json
    FROM registration_participants p JOIN registration_choreographers c ON c.academy_id=p.academy_id AND c.id=?
    JOIN registration_dance_choreographers dc ON dc.choreographer_id=c.id
    JOIN registration_dances d ON d.id=dc.dance_id AND d.academy_id=p.academy_id AND d.is_releve=1
    JOIN participant_portal_events e ON e.id=? AND e.venue=d.venue
    WHERE p.id=? AND d.id=?`, input.choreographerId, input.eventId, input.participantId, input.danceId);
  let program;
  try { program = JSON.parse(row?.program_json); } catch { /* Reject missing programme metadata. */ }
  if (!row || normalize(row.participant_name) !== normalize(row.choreographer_name) || program?.eventId !== input.eventId) {
    fail('portal_guest_invalid', 'La presentación Relevé no corresponde a esta persona y edición.');
  }
  await db.prepare('INSERT OR IGNORE INTO participant_portal_additional_dances(participant_id,event_id,dance_id,created_by) VALUES(?,?,?,?)')
    .bind(input.participantId, input.eventId, input.danceId, actorId).run();
  return { linked: true };
}
