const encoder = new TextEncoder();
const identifier = /^[A-Za-z0-9_-]{1,100}$/;
const sourceIdentifier = /^[1-9][0-9]{0,8}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fault = (code,message,statusCode=400) => { throw Object.assign(new Error(message),{code,statusCode}); };
const all = async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results||[];
const first = (db,sql,...args)=>db.prepare(sql).bind(...args).first();
const digest = async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const comparable = value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').replace(/\s+/g,' ').trim().toUpperCase();
const registrationEvents = env=>String(env.PARTICIPANT_REGISTRATION_EVENT_IDS||'').split(',').map(id=>id.trim()).filter(Boolean);

function linksFrom(input) {
  if(!Array.isArray(input)||!input.length||input.length>600) fault('portal_invalid_program','Selecciona un programa de hasta 600 coreografías.');
  const danceIds=new Set(),sourceIds=new Set();
  return input.map(link=>{
    const danceId=link?.danceId,sourceRoutineId=link?.sourceRoutineId;
    if(typeof danceId!=='string'||!identifier.test(danceId)||typeof sourceRoutineId!=='string'||!sourceIdentifier.test(sourceRoutineId)
      ||danceIds.has(danceId)||sourceIds.has(sourceRoutineId)) fault('portal_invalid_program','El programa contiene identificadores inválidos o repetidos.');
    danceIds.add(danceId);sourceIds.add(sourceRoutineId);return {danceId,sourceRoutineId};
  });
}

/** Called only after normal server-side administrator authentication. The file
 * capability authorizes one programme association, never administrator access.
 */
export async function issueParticipantProgramLink({db,env,input,actorId}) {
  const requested=linksFrom(input.links);
  const dances=await all(db,`SELECT d.id,d.venue,d.title,a.name AS academy FROM registration_dances d JOIN registration_academies a ON a.id=d.academy_id`);
  const byId=new Map(dances.map(dance=>[dance.id,dance]));
  const selected=requested.map(link=>byId.get(link.danceId));
  if(selected.some(dance=>!dance)||new Set(selected.map(dance=>dance.venue)).size!==1) fault('portal_invalid_program','Exporta el programa de una sola sede.');
  const allowed=registrationEvents(env);
  const editions=(await all(db,'SELECT id,venue FROM participant_portal_events WHERE venue=?',selected[0].venue)).filter(event=>allowed.includes(event.id));
  if(editions.length!==1) fault('portal_program_edition_ambiguous','La sede debe tener una edición de inscripciones identificada antes de exportar.',409);
  const eventId=editions[0].id;
  const stable=await all(db,'SELECT dance_id,source_routine_id FROM participant_portal_program_links WHERE event_id=?',eventId);
  const previous=await all(db,'SELECT dance_id,source_routine_id FROM participant_portal_routines WHERE event_id=? AND source_routine_id IS NOT NULL',eventId);
  const assignments=new Map(),used=new Set();
  for(const row of [...stable,...previous]){
    if(!sourceIdentifier.test(row.source_routine_id)|| (assignments.has(row.dance_id)&&assignments.get(row.dance_id)!==row.source_routine_id)
      ||(!assignments.has(row.dance_id)&&used.has(row.source_routine_id))) fault('portal_program_link_conflict','Hay una numeración de jueceo existente que requiere revisión antes de exportar.',409);
    assignments.set(row.dance_id,row.source_routine_id);used.add(row.source_routine_id);
  }
  let next=Math.max(0,...[...used].map(Number));
  const links=requested.map(link=>{
    let sourceRoutineId=assignments.get(link.danceId);
    if(!sourceRoutineId){
      if(next>=999999999) fault('portal_program_link_conflict','La numeración de jueceo requiere revisión antes de agregar más coreografías.',409);
      sourceRoutineId=String(++next);assignments.set(link.danceId,sourceRoutineId);
    }
    const dance=byId.get(link.danceId);
    return {danceId:link.danceId,sourceRoutineId,title:dance.title,academy:dance.academy};
  });
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const statements=[];
  for(let offset=0;offset<links.length;offset+=30){
    const group=links.slice(offset,offset+30);
    statements.push(db.prepare(`INSERT INTO participant_portal_program_links(event_id,dance_id,source_routine_id) VALUES ${group.map(()=>'(?,?,?)').join(',')}
      ON CONFLICT(event_id,dance_id) DO NOTHING`).bind(...group.flatMap(link=>[eventId,link.danceId,link.sourceRoutineId])));
  }
  statements.push(db.prepare(`INSERT INTO participant_portal_program_exports(id,event_id,token_hash,manifest_json,created_by,expires_at)
    VALUES(?,?,?,?,?,datetime('now','+14 days'))`).bind(crypto.randomUUID(),eventId,await digest(token),JSON.stringify(links),actorId||null));
  try{await db.batch(statements);}catch{fault('portal_program_link_conflict','Se actualizó la numeración mientras exportabas. Vuelve a intentar.',409);}
  const saved=await all(db,'SELECT dance_id,source_routine_id FROM participant_portal_program_links WHERE event_id=?',eventId);
  if(links.some(link=>!saved.some(row=>row.dance_id===link.danceId&&row.source_routine_id===link.sourceRoutineId))) fault('portal_program_link_conflict','Se actualizó el programa mientras exportabas. Vuelve a intentar.',409);
  return {registrationEventId:eventId,token,links:links.map(({danceId,sourceRoutineId})=>({danceId,sourceRoutineId}))};
}

/** Authenticate the bounded file capability before reading participant data or
 * resolving any source event outside the statically allowed judging catalogue.
 * The raw capability is never persisted or returned by this callback.
 */
export async function completeParticipantProgramLink({db,env,input,getJudgingDirectory}) {
  if(typeof input.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(input.token)) fault('portal_program_access_invalid','La referencia del programa no es válida.',401);
  const exported=await first(db,`SELECT * FROM participant_portal_program_exports WHERE token_hash=? AND expires_at>datetime('now')`,await digest(input.token));
  if(!exported) fault('portal_program_access_invalid','La referencia del programa venció. Vuelve a exportarlo desde administración.',401);
  if(input.registrationEventId!==exported.event_id||!registrationEvents(env).includes(exported.event_id)) fault('portal_program_access_forbidden','El programa no corresponde a esta edición.',403);
  if(typeof input.sourceEventId!=='string'||!uuid.test(input.sourceEventId)) fault('portal_invalid_program','El evento de jueceo no es válido.');
  const sourceEventId=input.sourceEventId.toLowerCase();
  if(exported.source_event_id&&exported.source_event_id!==sourceEventId) fault('portal_program_link_conflict','Este programa ya está vinculado a otro evento de jueceo.',409);
  let manifest;try{manifest=JSON.parse(exported.manifest_json);}catch{fault('portal_invalid_program','No se pudo comprobar la referencia del programa.',409);}
  const links=linksFrom(input.routines);
  if(links.length!==manifest.length||links.some(link=>!manifest.some(item=>item.danceId===link.danceId&&item.sourceRoutineId===link.sourceRoutineId))) fault('portal_program_link_mismatch','El programa importado no coincide con la exportación.',409);
  const source=await first(db,'SELECT source_event_id FROM participant_portal_judging_sources WHERE event_id=?',exported.event_id);
  if(source&&source.source_event_id!==sourceEventId) fault('portal_program_link_conflict','La edición ya está vinculada a otro evento de jueceo.',409);
  const previous=await all(db,'SELECT id,dance_id,source_event_id,source_routine_id FROM participant_portal_routines WHERE event_id=?',exported.event_id);
  for(const link of links){
    const row=previous.find(row=>row.dance_id===link.danceId);
    if(((row?.source_event_id||row?.source_routine_id)&&(row.source_event_id!==sourceEventId||row.source_routine_id!==link.sourceRoutineId))
      ||previous.some(row=>row.dance_id!==link.danceId&&row.source_event_id===sourceEventId&&row.source_routine_id===link.sourceRoutineId)) fault('portal_program_link_conflict','Una coreografía ya tiene una asociación diferente. No se reemplazó.',409);
  }
  if(typeof getJudgingDirectory!=='function') fault('portal_judging_unavailable','No se pudo comprobar el programa de jueceo.',503);
  const directory=await getJudgingDirectory(sourceEventId,{trustedEventId:sourceEventId});
  if(directory?.event?.id!==sourceEventId||!Array.isArray(directory.rows)||directory.rows.length!==manifest.length) fault('portal_program_link_mismatch','Las coreografías importadas no coinciden con el programa completo.',409);
  for(const item of manifest){
    const matches=directory.rows.filter(row=>row.id===item.sourceRoutineId);
    if(matches.length!==1||comparable(matches[0].name)!==comparable(item.title)||comparable(matches[0].academy)!==comparable(item.academy)) fault('portal_program_link_mismatch','Las coreografías importadas no coinciden con sus identificadores de inscripción.',409);
  }
  const statements=[
    // Recheck associations inside the atomic write, after the upstream read.
    // A concurrent edit violates this NOT NULL constraint and rolls back the
    // entire batch, instead of silently skipping only part of the programme.
    db.prepare(`UPDATE participant_portal_program_exports SET token_hash=CASE WHEN
      (source_event_id IS NOT NULL AND source_event_id<>?) OR EXISTS(
        SELECT 1 FROM participant_portal_judging_sources s WHERE s.event_id=participant_portal_program_exports.event_id AND s.source_event_id<>?) OR EXISTS(
        SELECT 1 FROM json_each(participant_portal_program_exports.manifest_json) m JOIN participant_portal_routines r ON r.event_id=participant_portal_program_exports.event_id
        WHERE (r.dance_id=json_extract(m.value,'$.danceId') AND (r.source_event_id IS NOT NULL OR r.source_routine_id IS NOT NULL) AND (r.source_event_id IS NOT ? OR r.source_routine_id IS NOT json_extract(m.value,'$.sourceRoutineId')))
          OR (r.dance_id<>json_extract(m.value,'$.danceId') AND r.source_event_id=? AND r.source_routine_id=json_extract(m.value,'$.sourceRoutineId')))
      THEN NULL ELSE token_hash END WHERE id=?`).bind(sourceEventId,sourceEventId,sourceEventId,sourceEventId,exported.id),
    db.prepare(`UPDATE participant_portal_program_exports SET source_event_id=? WHERE id=? AND (source_event_id IS NULL OR source_event_id=?)`).bind(sourceEventId,exported.id,sourceEventId),
    db.prepare(`INSERT INTO participant_portal_judging_sources(event_id,source_event_id,enabled,updated_by)
      SELECT event_id,?,1,created_by FROM participant_portal_program_exports WHERE id=? AND source_event_id=?
      ON CONFLICT(event_id) DO NOTHING`)
      .bind(sourceEventId,exported.id,sourceEventId)];
  for(let offset=0;offset<links.length;offset+=32){
    const group=links.slice(offset,offset+32);
    statements.push(db.prepare(`WITH authorized AS (SELECT e.event_id,e.source_event_id FROM participant_portal_program_exports e JOIN participant_portal_judging_sources s ON s.event_id=e.event_id AND s.source_event_id=e.source_event_id WHERE e.id=? AND e.source_event_id=?)
      INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id)
      ${group.map(()=>`SELECT ?,a.event_id,?,a.source_event_id,? FROM authorized a WHERE 1`).join(' UNION ALL ')}
      ON CONFLICT(event_id,dance_id) DO UPDATE SET source_event_id=excluded.source_event_id,source_routine_id=excluded.source_routine_id,updated_at=datetime('now')
      WHERE participant_portal_routines.source_event_id IS NULL OR (participant_portal_routines.source_event_id=excluded.source_event_id AND participant_portal_routines.source_routine_id=excluded.source_routine_id)`)
      .bind(exported.id,sourceEventId,...group.flatMap(link=>[previous.find(row=>row.dance_id===link.danceId)?.id||crypto.randomUUID(),link.danceId,link.sourceRoutineId])));
  }
  try{await db.batch(statements);}catch{fault('portal_program_link_conflict','La asociación cambió durante la importación. No se reemplazó el programa.',409);}
  const bound=await first(db,'SELECT source_event_id FROM participant_portal_judging_sources WHERE event_id=?',exported.event_id);
  const claimed=await first(db,'SELECT source_event_id FROM participant_portal_program_exports WHERE id=?',exported.id);
  if(bound?.source_event_id!==sourceEventId||claimed?.source_event_id!==sourceEventId) fault('portal_program_link_conflict','Otra importación ya vinculó esta edición.',409);
  const verified=await all(db,'SELECT dance_id,source_event_id,source_routine_id FROM participant_portal_routines WHERE event_id=?',exported.event_id);
  if(links.some(link=>!verified.some(row=>row.dance_id===link.danceId&&row.source_event_id===sourceEventId&&row.source_routine_id===link.sourceRoutineId))) fault('portal_program_link_conflict','No se pudo comprobar la asociación completa del programa.',409);
  return {ok:true,linked:links.length};
}
