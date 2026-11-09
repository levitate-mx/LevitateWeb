import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';
import { handleParticipantPortal } from '../worker/participant-portal.js';
const photoSource = await readFile(new URL('./fixtures/participant-photo-source.png', import.meta.url));

class PortalD1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); this.queries = []; }
  prepare(sql) {
    this.queries.push(sql);
    assert.doesNotMatch(sql, /^\s*(CREATE|ALTER|DROP|PRAGMA)\b/i, 'No schema mutation in HTTP handlers');
    const statement=this.sqlite.prepare(sql); let args=[];
    const query={bind(...values) {args=values;return query;},async first(){const row=statement.get(...args);return row ? {...row}:null;},
      async all(){return {results:statement.all(...args).map(row=>({...row}))};},
      sync(){const result=statement.run(...args);return {success:true,meta:{changes:result.changes}};},async run(){return query.sync();}};
    return query;
  }
  async batch(statements) { this.sqlite.exec('BEGIN');try {const result=statements.map(statement=>statement.sync());this.sqlite.exec('COMMIT');return result;}catch(error){this.sqlite.exec('ROLLBACK');throw error;} }
}
class Bucket {
  constructor(){this.objects=new Map();this.reads=[];}
  async put(key,bytes,options={}){this.objects.set(key,{bytes:new Uint8Array(bytes),...options});}
  async get(key){this.reads.push(key);const object=this.objects.get(key);return object ? {body:object.bytes,size:object.bytes.length,customMetadata:object.customMetadata}:null;}
  async delete(key){this.objects.delete(key);}
}
async function digest(value){return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');}
async function fixture(t) {
  const db=new PortalD1(),bucket=new Bucket();t.after(()=>db.sqlite.close());
  db.sqlite.exec(await readFile(new URL('../db/registration_d1_schema.sql',import.meta.url),'utf8'));
  db.sqlite.exec(await readFile(new URL('../db/registration_participant_portal.sql',import.meta.url),'utf8'));
  db.sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES('academy','Academia Prueba','Responsable','test@example.test');
    INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,email_confirmed_at)
      VALUES('admin','academy','Admin','admin','admin@example.test','not-used','admin',datetime('now'));
    INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,email_confirmed_at)
      VALUES('academy-user','academy','Academia','academy','academy@example.test','not-used','academy',datetime('now'));
    INSERT INTO registration_participants(id,academy_id,full_name,curp,division,shirt_size)
      VALUES('person-a','academy','Mariana Prueba','PRUA000000MXXAAA00','teen','s'),('person-b','academy','Otra Persona','PRUB000000MXXAAA00','teen','m');
    INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue)
      VALUES('dance-a','academy','Vuelo','aereo','tela','solo','intermedio','edomex'),('dance-b','academy','Otra rutina','aereo','aro','solo','intermedio','edomex');
    INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-a','person-a'),('dance-b','person-b');`);
  for(const actor of ['admin','academy-user'])db.sqlite.prepare("INSERT INTO registration_sessions(id,user_id,session_token_hash,expires_at) VALUES(?,?,?,datetime('now','+1 day'))").run(actor,actor,await digest(actor+'-session'));
  const env={DB:db,PARTICIPANT_MEDIA:bucket,PARTICIPANT_REGISTRATION_EVENT_IDS:'test-event'};
  async function request(path,{method='GET',body,cookie,origin,expected=200,rawBody,extraHeaders={}}={}){
    const response=await worker.fetch(new Request('https://levitate.test'+path,{method,
      headers:{...(cookie?{cookie}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...(origin?{origin}:{}),...extraHeaders},
      ...(body!==undefined?{body:JSON.stringify(body)}:rawBody!==undefined?{body:rawBody}:{})}),env);
    const type=response.headers.get('content-type') || '';
    const data=type.includes('application/json')?await response.json():new Uint8Array(await response.arrayBuffer());
    assert.equal(response.status,expected,`${path}: ${JSON.stringify(data)}`);
    return {data,headers:response.headers,status:response.status};
  }
  const admin=(body,expected=200)=>request('/api/registration/admin/participant-portal',{method:'POST',body,cookie:'levitate_registration_session=admin-session',expected});
  await admin({action:'event.upsert',event:{id:'test-event',title:'Levitate Estado de México',season:'Otoño 2026',venue:'edomex',startsAt:'2026-11-14',published:true}});
  async function access(participantId='person-a'){
    const {data}=await admin({action:'access.create',eventId:'test-event',participantId});
    const exchange=await request('/api/participant/access/exchange',{method:'POST',body:{token:data.token}});
    return {grant:data,cookie:exchange.headers.get('set-cookie').split(';')[0],headers:exchange.headers};
  }
  return {db,bucket,env,request,admin,access};
}
const result=(overrides={})=>({score:138.5,maxScore:150,medal:'oro',directCompetition:true,eligibleCount:4,place:1,...overrides});
const judging={judges:[{name:'Juez de prueba',score:47,maxScore:50,criteria:[{label:'Técnica',score:47,maxScore:50}],feedback:'Observación privada de prueba.'}]};
const previewPath=(participantId='person-a',eventId='test-event')=>`/api/registration/admin/participant-portal?preview=1&eventId=${encodeURIComponent(eventId)}&participantId=${encodeURIComponent(participantId)}`;
const adminCookie='levitate_registration_session=admin-session';
const totalChanges=(db)=>db.sqlite.prepare('SELECT total_changes() AS count').get().count;

test('private portal requires its own QR grant and actual admin session; no CURP entry',async t=>{
  const {request,access,db}=await fixture(t);
  await request('/api/participant/me',{expected:401});
  await request('/api/participant/me',{cookie:'levitate_registration_student_session=anything',expected:401});
  await request('/api/registration/admin/participant-portal',{expected:401});
  await request('/api/registration/admin/participant-portal',{cookie:'levitate_registration_session=academy-user-session',expected:403});
  const {grant,cookie,headers}=await access();
  assert.match(headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.match(grant.entryUrl,/^\/mi-levitate#access=/);
  const stored=db.sqlite.prepare('SELECT token_hash FROM participant_portal_access').get();assert.notEqual(stored.token_hash,grant.token);
  const {data,headers:responseHeaders}=await request('/api/participant/me',{cookie});
  assert.equal(data.participant.name,'Mariana Prueba');assert.equal(data.diploma.status,'pending');
  assert.equal(data.routines.length,1);assert.equal(data.routines[0].id,'registration:dance-a');assert.equal(data.routines[0].result.status,'pending');
  assert.doesNotMatch(JSON.stringify(data),/PRUA|folio|token_hash/);assert.equal(responseHeaders.get('cache-control'),'private, no-store');
  await request('/api/participant/me?eventId=another-event',{cookie,expected:404});
  await request('/api/participant/access/exchange',{method:'POST',body:{token:grant.token},origin:'https://evil.test',expected:403});
});

test('draft results and judging remain pending; publishing uses authoritative score scale and direct ranking only',async t=>{
  const {admin,request,access}=await fixture(t);const {cookie}=await access();
  for(const bad of [result({directCompetition:false}),result({eligibleCount:1}),result({place:4}),result({score:151})]){
    await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:bad},400);
  }
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result(),judging});
  let response=await request('/api/participant/me',{cookie});
  assert.equal(response.data.routines[0].result.status,'pending');assert.equal(response.data.routines[0].judging.status,'pending');
  assert.doesNotMatch(JSON.stringify(response.data),/Observación privada/);
  await admin({action:'routine.publish',routineId:saved.data.routineId});
  response=await request('/api/participant/me',{cookie});
  assert.equal(response.data.routines[0].result.score,138.5);assert.equal(response.data.routines[0].result.maxScore,150);
  assert.equal(response.data.routines[0].result.place,1);assert.equal(response.data.routines[0].judging.judges[0].feedback,judging.judges[0].feedback);
  await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result({directCompetition:false,eligibleCount:1,place:null}),judging});
  response=await request('/api/participant/me',{cookie});assert.equal(response.data.routines[0].result.status,'pending','saving a revision unpublishes it');
  await admin({action:'routine.publish',routineId:saved.data.routineId});
  response=await request('/api/participant/me',{cookie});assert.equal(response.data.routines[0].result.place,null);
});

test('asset bytes require event, album, asset publication AND matching membership',async t=>{
  const {admin,request,access,db}=await fixture(t);const a=await access(),b=await access('person-b');
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result(),photosPublished:false});
  const photo={action:'asset.upload',uploadId:'photo-upload-test',eventId:'test-event',kind:'photo',routineId:saved.data.routineId,fileName:'preview.png',contentType:'image/png',base64Data:photoSource.toString('base64'),width:1200,height:800};
  const uploaded=await admin(photo);const assetId=uploaded.data.assetId;
  const retry=await admin(photo);assert.equal(retry.data.assetId,assetId);assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM participant_portal_assets').get().n,1);
  await request('/api/participant/assets/'+assetId,{cookie:a.cookie,expected:404});
  await admin({action:'asset.publish',assetId,published:true});
  await admin({action:'routine.publish',routineId:saved.data.routineId});
  await request('/api/participant/assets/'+assetId,{cookie:a.cookie,expected:404});
  await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result(),photosPublished:true});
  await admin({action:'routine.publish',routineId:saved.data.routineId});
  await request('/api/participant/assets/'+assetId,{expected:401});
  await request('/api/participant/assets/'+assetId,{cookie:b.cookie,expected:404});
  const image=await request('/api/participant/assets/'+assetId,{cookie:a.cookie});assert.ok(image.data.length>100);assert.equal(image.headers.get('content-type'),'image/jpeg');
  assert.notDeepEqual(image.data,new Uint8Array(photoSource));
  await request('/api/participant/assets/'+assetId+'?download=1',{cookie:a.cookie,expected:403});
  let me=await request('/api/participant/me',{cookie:a.cookie});assert.equal(me.data.routines[0].photos.count,1);assert.equal(me.data.routines[0].photos.items[0].downloadUrl,undefined);
  me=await request('/api/participant/me',{cookie:b.cookie});assert.equal(me.data.routines.length,1);
  assert.equal(me.data.routines[0].id,'registration:dance-b');assert.equal(me.data.routines[0].photos.count,0);
  await admin({action:'event.upsert',event:{id:'test-event',title:'Levitate',season:'Otoño 2026',venue:'edomex',published:false}});
  await request('/api/participant/assets/'+assetId,{cookie:a.cookie,expected:404});
});

test('diploma assignment is personal and published separately; revoked access invalidates existing cookies',async t=>{
  const {admin,request,access}=await fixture(t);const a=await access(),b=await access('person-b');
  const pdf=await admin({action:'asset.upload',eventId:'test-event',kind:'diploma',participantId:'person-a',fileName:'diploma.pdf',contentType:'application/pdf',base64Data:Buffer.from('%PDF-1.7\nfixture').toString('base64')});
  const assetId=pdf.data.assetId;
  await admin({action:'document.assign',eventId:'test-event',participantId:'person-b',assetId,published:true},400);
  await admin({action:'document.assign',eventId:'test-event',participantId:'person-a',assetId,published:true});
  await request('/api/participant/assets/'+assetId,{cookie:a.cookie,expected:404});
  await admin({action:'asset.publish',assetId,published:true});
  const document=await request('/api/participant/assets/'+assetId,{cookie:a.cookie});assert.match(document.headers.get('content-disposition'),/^attachment/);
  await request('/api/participant/assets/'+assetId,{cookie:b.cookie,expected:404});
  const me=await request('/api/participant/me',{cookie:a.cookie});assert.equal(me.data.diploma.assetId,assetId);
  await admin({action:'access.create',eventId:'test-event',participantId:'person-a'},409);
  const rotated=await admin({action:'access.create',eventId:'test-event',participantId:'person-a',rotate:true});
  await request('/api/participant/me',{cookie:a.cookie,expected:401});
  await request('/api/participant/access/exchange',{method:'POST',body:{token:a.grant.token},expected:401});
  const exchange=await request('/api/participant/access/exchange',{method:'POST',body:{token:rotated.data.token}});
  const newCookie=exchange.headers.get('set-cookie').split(';')[0];
  await admin({action:'access.revoke',accessId:rotated.data.id});await request('/api/participant/me',{cookie:newCookie,expected:401});
});

test('invalid file types and oversized requests are rejected; storage missing reports a bounded unavailable state',async t=>{
  const {admin,request,access,env}=await fixture(t);const {cookie}=await access();
  await admin({action:'asset.upload',eventId:'test-event',kind:'diploma',participantId:'person-a',fileName:'fake.pdf',contentType:'application/pdf',base64Data:Buffer.from('<html>bad</html>').toString('base64')},400);
  await request('/api/registration/admin/participant-portal',{method:'POST',cookie:'levitate_registration_session=admin-session',rawBody:'{}',extraHeaders:{'content-type':'application/json','content-length':String(19*1024*1024)},expected:413});
  delete env.PARTICIPANT_MEDIA;
  await admin({action:'asset.upload',eventId:'test-event',kind:'diploma',participantId:'person-a',fileName:'valid.pdf',contentType:'application/pdf',base64Data:Buffer.from('%PDF-1.7').toString('base64')},503);
  const me=await request('/api/participant/me',{cookie});assert.equal(me.data.diploma.status,'pending');
});

test('admin updates preserve publication when omitted and mapping lookup avoids clearing results',async t=>{
  const {admin,request,db}=await fixture(t);
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result()});
  await admin({action:'routine.publish',routineId:saved.data.routineId});
  await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result({score:139})});
  await admin({action:'event.upsert',event:{id:'test-event',title:'Levitate actualizado',season:'Otoño 2026',venue:'edomex'}});
  const listing=await request('/api/registration/admin/participant-portal?eventId=test-event&danceId=dance-a',{cookie:'levitate_registration_session=admin-session'});
  assert.equal(listing.data.events[0].published,true);assert.equal(listing.data.routines.length,1);assert.equal(listing.data.routines[0].id,saved.data.routineId);
  assert.equal(listing.data.routines[0].result.score,139);assert.equal(listing.data.routines[0].revision,2);assert.equal(listing.data.routinePagination.hasMore,false);
  const revisions=db.sqlite.prepare('SELECT revision,action,snapshot_json,actor_id FROM participant_portal_routine_revisions ORDER BY rowid').all();
  assert.deepEqual(revisions.map(row=>[row.revision,row.action,row.actor_id]),[[1,'save','admin'],[1,'publish','admin'],[2,'save','admin']]);
  assert.equal(JSON.parse(revisions[0].snapshot_json).result.score,138.5,'original approved input survives later revisions');
  assert.equal(JSON.parse(revisions[2].snapshot_json).result.score,139);
});

test('group members inherit one routine gallery and losing membership immediately removes access',async t=>{
  const {admin,request,access,db}=await fixture(t);const a=await access(),b=await access('person-b');
  db.sqlite.prepare("INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-a','person-b')").run();
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result(),photosPublished:true});
  const photo=await admin({action:'asset.upload',eventId:'test-event',kind:'photo',routineId:saved.data.routineId,fileName:'group.jpg',contentType:'image/png',base64Data:photoSource.toString('base64')});
  await admin({action:'asset.publish',assetId:photo.data.assetId,published:true});
  await admin({action:'routine.publish',routineId:saved.data.routineId});
  for(const cookie of [a.cookie,b.cookie]) {
    const me=await request('/api/participant/me',{cookie});
    assert.equal(me.data.routines.find(routine=>routine.id===saved.data.routineId).photos.items[0].id,photo.data.assetId);
    await request('/api/participant/assets/'+photo.data.assetId,{cookie});
  }
  db.sqlite.prepare("DELETE FROM registration_dance_participants WHERE dance_id='dance-a' AND participant_id='person-b'").run();
  await request('/api/participant/assets/'+photo.data.assetId,{cookie:b.cookie,expected:404});
  const me=await request('/api/participant/me',{cookie:b.cookie});assert.equal(me.data.routines.length,1);
  assert.equal(me.data.routines[0].id,'registration:dance-b');assert.equal(me.data.routines[0].photos.count,0);
});

test('admin searches and pages large event metadata without reading every asset by default',async t=>{
  const {db,request}=await fixture(t);
  const dance=db.sqlite.prepare("INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue) VALUES(?,'academy',?,'aereo','tela','solo','intermedio','edomex')");
  for(let i=0;i<205;i++)dance.run(`extra-dance-${i}`,`Routine${String(i).padStart(3,'0')}`);
  const asset=db.sqlite.prepare(`INSERT INTO participant_portal_assets(id,event_id,participant_id,kind,object_key,file_name,content_type,sha256,byte_size)
    VALUES(?,'test-event','person-a','diploma',?,'diploma.pdf','application/pdf','hash-fixture',12)`);
  for(let i=0;i<501;i++)asset.run(`asset-fixture-${i}`,`object-${i}`);
  const opts={cookie:'levitate_registration_session=admin-session'};
  let page=await request('/api/registration/admin/participant-portal?eventId=test-event',opts);
  assert.equal(page.data.routines.length,200);assert.equal(page.data.routinePagination.hasMore,true);assert.deepEqual(page.data.assets,[]);
  page=await request('/api/registration/admin/participant-portal?eventId=test-event&routineOffset=200',opts);
  assert.equal(page.data.routines.length,7);assert.equal(page.data.routinePagination.hasMore,false);
  page=await request('/api/registration/admin/participant-portal?eventId=test-event&routineQ=Routine204&participantId=person-a',opts);
  assert.equal(page.data.routines.length,1);assert.equal(page.data.routines[0].title,'Routine204');
  assert.equal(page.data.assets.length,500);assert.equal(page.data.assetPagination.hasMore,true);assert.equal(page.data.assetPagination.limit,500);
  page=await request('/api/registration/admin/participant-portal?eventId=test-event&participantId=person-a&assetOffset=500',opts);
  assert.equal(page.data.assets.length,1);assert.equal(page.data.assetPagination.hasMore,false);
});

test('approved result revisions preserve omitted judging crosswalks and require an explicit pair to clear them',async t=>{
  const {admin,db}=await fixture(t);
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',sourceEventId:'judging-event',sourceRoutineId:'routine-42',result:result()});
  await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result({score:139})});
  let routine=db.sqlite.prepare('SELECT source_event_id,source_routine_id FROM participant_portal_routines WHERE id=?').get(saved.data.routineId);
  assert.deepEqual({...routine},{source_event_id:'judging-event',source_routine_id:'routine-42'});
  const revision=db.sqlite.prepare('SELECT snapshot_json FROM participant_portal_routine_revisions WHERE routine_id=? AND revision=2').get(saved.data.routineId);
  assert.equal(JSON.parse(revision.snapshot_json).sourceRoutineId,'routine-42');
  await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',sourceEventId:'',result:result()},400);
  await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',sourceEventId:'',sourceRoutineId:'',result:result()});
  routine=db.sqlite.prepare('SELECT source_event_id,source_routine_id FROM participant_portal_routines WHERE id=?').get(saved.data.routineId);
  assert.deepEqual({...routine},{source_event_id:null,source_routine_id:null});
});

test('admin preview authenticates before participant queries and GET does not touch session activity',async t=>{
  let queries=0,calls=0;
  const db={prepare(){queries+=1;throw new Error('participant data must not be read');}};
  for(const suffix of ['?preview=1&eventId=missing&participantId=missing','?assetId=photo-fixture']) {
    const response=await handleParticipantPortal(new Request('https://levitate.test/api/registration/admin/participant-portal'+suffix),{DB:db},{
      requireAdmin:async (request,env,receivedDb,options)=>{
        calls+=1;assert.equal(receivedDb,db);assert.deepEqual(options,{touchLastSeen:false});
        throw Object.assign(new Error('Solo administración.'),{code:'registration_admin_forbidden',statusCode:403});
      },
    });
    assert.equal(response.status,403);assert.equal(queries,0);
  }
  assert.equal(calls,2);
  const {request}=await fixture(t);
  await request(previewPath('missing','missing'),{expected:401});
  await request(previewPath('missing','missing'),{cookie:'levitate_registration_session=academy-user-session',expected:403});
  await request(previewPath('missing'),{cookie:adminCookie,expected:404});
  await request(previewPath('person-a','missing'),{cookie:adminCookie,expected:404});
  await request('/api/registration/admin/participant-portal?preview=1&eventId=test-event',{cookie:adminCookie,expected:400});
  await request('/api/registration/admin/participant-portal?preview=1&participantId=person-a',{cookie:adminCookie,expected:400});
  for(const value of ['0','true','false','2']) {
    const response=await request('/api/registration/admin/participant-portal?preview='+value,{cookie:adminCookie});
    assert.ok(Array.isArray(response.data.participants));assert.equal(response.data.adminPreview,undefined);
  }
});

test('admin preview reads every draft without publishing it, regardless of all publication flags',async t=>{
  const {db,bucket,request,admin,access}=await fixture(t);
  const participantAccess=await access();
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result(),judging,photosPublished:false});
  const photo=await admin({action:'asset.upload',eventId:'test-event',kind:'photo',routineId:saved.data.routineId,fileName:'preview.jpg',contentType:'image/png',base64Data:photoSource.toString('base64'),width:1200,height:800,caption:'Vista revisable'});
  const sheet=await admin({action:'asset.upload',eventId:'test-event',kind:'judge_sheet',routineId:saved.data.routineId,fileName:'jueceo.pdf',contentType:'application/pdf',base64Data:Buffer.from('%PDF-fixture-sheet').toString('base64')});
  const diploma=await admin({action:'asset.upload',eventId:'test-event',kind:'diploma',participantId:'person-a',fileName:'diploma.pdf',contentType:'application/pdf',base64Data:Buffer.from('%PDF-fixture-diploma').toString('base64')});
  const sheetPreview=await request(`/api/registration/admin/participant-portal?assetId=${sheet.data.assetId}`,{cookie:adminCookie});
  assert.equal(sheetPreview.headers.get('content-disposition'),'inline; filename="jueceo.pdf"');
  await admin({action:'document.assign',eventId:'test-event',participantId:'person-a',assetId:diploma.data.assetId,published:false});
  const storedObjects=bucket.objects.size;
  for(let mask=0;mask<32;mask++) {
    const eventPublished=Boolean(mask&1),routinePublished=Boolean(mask&2),photosPublished=Boolean(mask&4),assetsPublished=Boolean(mask&8),documentPublished=Boolean(mask&16);
    db.sqlite.prepare('UPDATE participant_portal_events SET published=? WHERE id=?').run(Number(eventPublished),'test-event');
    db.sqlite.prepare('UPDATE participant_portal_routines SET status=?,photos_published=? WHERE id=?').run(routinePublished?'published':'draft',Number(photosPublished),saved.data.routineId);
    db.sqlite.prepare('UPDATE participant_portal_assets SET published=?').run(Number(assetsPublished));
    db.sqlite.prepare('UPDATE participant_portal_documents SET published=?').run(Number(documentPublished));
    const before=totalChanges(db);
    const preview=await request(previewPath(),{cookie:adminCookie});
    assert.equal(totalChanges(db),before,'preview GET must not write, including registration session activity');
    assert.equal(preview.headers.get('set-cookie'),null);
    assert.equal(preview.headers.get('cache-control'),'private, no-store');
    assert.equal(preview.headers.get('vary'),'Cookie');
    assert.equal(preview.data.adminPreview,true,'draft values are explicitly marked as an admin preview');
    assert.equal(preview.data.participant.id,'person-a');
    assert.equal(preview.data.diploma.assetId,diploma.data.assetId);
    assert.equal(preview.data.diploma.url,`/api/registration/admin/participant-portal?assetId=${diploma.data.assetId}`);
    const routine=preview.data.routines[0];
    assert.equal(routine.result.score,138.5);assert.equal(routine.result.maxScore,150);assert.equal(routine.result.medal,'oro');
    assert.deepEqual(routine.judging.judges,judging.judges);
    assert.equal(routine.judging.url,`/api/registration/admin/participant-portal?assetId=${sheet.data.assetId}`);
    assert.equal(routine.photos.count,1);assert.equal(routine.photos.items[0].id,photo.data.assetId);
    assert.equal(routine.photos.items[0].previewUrl,`/api/registration/admin/participant-portal?assetId=${photo.data.assetId}`);
    assert.equal(routine.photos.items[0].downloadUrl,undefined);
    assert.doesNotMatch(JSON.stringify(preview.data),/PRUA|token_hash|object_key|sha256|drive_file|googleapis|drive\.google|\/api\/participant\/assets/);
    const publicView=await request('/api/participant/me?preview=1&participantId=person-b&adminPreview=true',{cookie:participantAccess.cookie});
    assert.equal(publicView.data.participant.id,'person-a','public IDs still come only from the QR grant');
    assert.equal(publicView.data.adminPreview,undefined);
    assert.equal(publicView.data.routines[0].result.score,eventPublished&&routinePublished?138.5:null);
    assert.equal(publicView.data.routines[0].judging.status,eventPublished&&routinePublished?'available':'pending');
    assert.equal(publicView.data.routines[0].photos.count,eventPublished&&routinePublished&&photosPublished&&assetsPublished?1:0);
    assert.equal(publicView.data.diploma.status,eventPublished&&documentPublished&&assetsPublished?'available':'pending');
    assert.doesNotMatch(JSON.stringify(publicView.data),/\/api\/registration\/admin|adminPreview|googleapis|drive\.google/);
    assert.equal(totalChanges(db),before,'the participant query must not publish or create data either');
  }
  assert.equal(bucket.objects.size,storedObjects);
});

test('admin preview requires no QR and draft bytes use the existing authenticated admin asset route',async t=>{
  const {db,request,admin}=await fixture(t);
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',photosPublished:false});
  const photo=await admin({action:'asset.upload',eventId:'test-event',kind:'photo',routineId:saved.data.routineId,fileName:'preview.jpg',contentType:'image/png',base64Data:photoSource.toString('base64'),allowDownload:true});
  const before=totalChanges(db);
  const preview=await request(previewPath(),{cookie:adminCookie});
  assert.equal(preview.data.adminPreview,true);assert.equal(preview.data.routines[0].result.status,'pending');
  const item=preview.data.routines[0].photos.items[0];
  assert.equal(item.downloadUrl,`${item.previewUrl}&download=1`);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM participant_portal_access').get().count,0);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM participant_portal_sessions').get().count,0);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM participant_portal_routine_revisions').get().count,1);
  const bytes=await request(item.previewUrl,{cookie:adminCookie});
  assert.equal(bytes.headers.get('content-type'),'image/jpeg');
  assert.notDeepEqual(bytes.data,new Uint8Array(photoSource));
  assert.equal(bytes.headers.get('content-disposition'),'inline; filename="preview.jpg"');
  const download=await request(item.downloadUrl,{cookie:adminCookie});
  assert.deepEqual(download.data,bytes.data,'downloads also contain the marked derivative');
  assert.equal(download.headers.get('content-disposition'),'attachment; filename="preview.jpg"');
  await request(item.previewUrl,{expected:401});
  await request(item.previewUrl,{cookie:'levitate_registration_session=academy-user-session',expected:403});
  await request('/api/participant/assets/'+photo.data.assetId+'?preview=1',{cookie:adminCookie,expected:401});
  assert.equal(totalChanges(db),before,'no preview or asset GET may update session activity or data');
});

test('admin preview uses current participant IDs and group membership, independent of revoked QR grants',async t=>{
  const {db,request,admin,access}=await fixture(t);
  const a=await access(),b=await access('person-b');
  db.sqlite.prepare("UPDATE registration_participants SET full_name='Nombre compartido'").run();
  db.sqlite.prepare("INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-a','person-b')").run();
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result(),photosPublished:false});
  const photo=await admin({action:'asset.upload',eventId:'test-event',kind:'photo',routineId:saved.data.routineId,fileName:'grupo.jpg',contentType:'image/png',base64Data:photoSource.toString('base64')});
  await admin({action:'access.revoke',accessId:a.grant.id});
  await admin({action:'access.revoke',accessId:b.grant.id});
  const before=totalChanges(db);
  for(const participantId of ['person-a','person-b']) {
    const preview=await request(previewPath(participantId),{cookie:adminCookie});
    assert.equal(preview.data.participant.id,participantId);
    assert.equal(preview.data.routines.find(routine=>routine.id===saved.data.routineId).photos.items[0].id,photo.data.assetId);
  }
  await request('/api/participant/me?preview=1',{cookie:a.cookie,expected:401});
  await request('/api/participant/me?preview=1',{cookie:b.cookie,expected:401});
  assert.equal(totalChanges(db),before,'admin preview never reactivates participant grants');
  db.sqlite.prepare("DELETE FROM registration_dance_participants WHERE dance_id='dance-a' AND participant_id='person-b'").run();
  const removed=await request(previewPath('person-b'),{cookie:adminCookie});
  assert.deepEqual(removed.data.routines.map(routine=>routine.id),['registration:dance-b'],'same name and old grant do not provide membership in the shared routine');
});

test('public asset authentication happens before reading asset metadata or R2',async t=>{
  const {db,bucket,request}=await fixture(t);
  let reads=0;bucket.get=async()=>{reads+=1;throw new Error('unauthenticated R2 read');};
  for(const cookie of [undefined,'levitate_participant_session='+'x'.repeat(43)]) {
    db.queries.length=0;
    await request('/api/participant/assets/private-photo-fixture?preview=1',{cookie,expected:401});
    assert.equal(reads,0);
    assert.ok(db.queries.every(sql=>!sql.includes('participant_portal_assets')),'no asset-table query before a valid participant session');
  }
});

test('QR grants identify current registered presentations before portal curation without generating records',async t=>{
  const {db,request,admin,access}=await fixture(t);const {cookie}=await access();
  await admin({action:'event.upsert',event:{id:'test-event',title:'Edición sin publicar',season:'Otoño 2026',venue:'edomex',published:false}});
  db.sqlite.exec(`INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue)
    VALUES('dance-a-extra','academy','Vuelo','motion','jazz','solo',NULL,'edomex'),
      ('dance-other-venue','academy','Otra sede propia','aereo','tela','solo','intermedio','puebla');
    INSERT INTO registration_dance_participants(dance_id,participant_id)
      VALUES('dance-a-extra','person-a'),('dance-other-venue','person-a');
    UPDATE registration_dances SET title='Vuelo' WHERE id='dance-b';
    INSERT INTO registration_academies(id,name,contact_name,email)
      VALUES('other-academy','Otra academia ficticia','Responsable ficticio','other@example.test');
    INSERT INTO registration_participants(id,academy_id,full_name,curp,division,shirt_size)
      VALUES('other-registration','other-academy','Mariana Prueba','PRUA000000MXXAAA00','teen','s');
    INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-b','other-registration');`);
  const before=totalChanges(db);
  const {data}=await request('/api/participant/me?participantId=other-registration&preview=1',{cookie});
  assert.equal(data.participant.id,'person-a');
  assert.equal(data.participant.name,'Mariana Prueba');
  assert.deepEqual(data.routines.map(routine=>routine.id),['registration:dance-a','registration:dance-a-extra']);
  for(const routine of data.routines) {
    assert.equal(routine.eventId,'test-event');assert.equal(routine.title,'Vuelo');
    assert.deepEqual(routine.result,{status:'pending',score:null,maxScore:null,medal:null,directCompetition:false,eligibleCount:null,place:null});
    assert.deepEqual(routine.judging,{status:'pending',judges:[]});
    assert.deepEqual(routine.photos,{status:'pending',count:0,items:[]});
  }
  assert.deepEqual(data.diploma,{status:'pending',assetId:null,url:null});
  const preview=await request(previewPath(),{cookie:adminCookie});
  assert.equal(preview.data.adminPreview,true);
  assert.deepEqual(preview.data.routines,data.routines);
  assert.equal(totalChanges(db),before,'fallback projections are SELECT-only, even for an unpublished edition');
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM participant_portal_routines').get().count,0);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM participant_portal_assets').get().count,0);
  db.sqlite.prepare("UPDATE registration_dances SET title='Título actualizado' WHERE id='dance-a'").run();
  const renamed=await request('/api/participant/me',{cookie});
  assert.ok(renamed.data.routines.some(routine=>routine.id==='registration:dance-a'&&routine.title==='Título actualizado'),'fallback IDs never depend on mutable names');
});

test('curated edition records override registration fallback without duplicating routines or weakening publication',async t=>{
  const {db,request,admin,access}=await fixture(t);const {cookie}=await access();
  db.sqlite.exec(`INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-b','person-a');`);
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',result:result(),judging,photosPublished:true});
  const photo=await admin({action:'asset.upload',eventId:'test-event',kind:'photo',routineId:saved.data.routineId,fileName:'curated.jpg',contentType:'image/png',base64Data:photoSource.toString('base64')});
  let response=await request('/api/participant/me',{cookie});
  assert.equal(response.data.routines.length,2);
  let curated=response.data.routines.find(routine=>routine.id===saved.data.routineId);
  assert.ok(curated);assert.equal(curated.result.status,'pending');assert.equal(curated.photos.count,0);
  assert.ok(!response.data.routines.some(routine=>routine.id==='registration:dance-a'));
  assert.equal(response.data.routines.find(routine=>routine.id==='registration:dance-b').result.status,'pending');
  await admin({action:'asset.publish',assetId:photo.data.assetId,published:true});
  await admin({action:'routine.publish',routineId:saved.data.routineId});
  const before=totalChanges(db);
  response=await request('/api/participant/me',{cookie});
  curated=response.data.routines.find(routine=>routine.id===saved.data.routineId);
  assert.equal(curated.result.score,138.5);assert.equal(curated.judging.judges[0].feedback,judging.judges[0].feedback);
  assert.equal(curated.photos.items[0].id,photo.data.assetId);
  assert.equal(response.data.routines.find(routine=>routine.id==='registration:dance-b').photos.count,0);
  assert.equal(totalChanges(db),before);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM participant_portal_routines').get().count,1);
  db.sqlite.prepare("DELETE FROM registration_dance_participants WHERE dance_id='dance-a' AND participant_id='person-a'").run();
  const removed=await request('/api/participant/me',{cookie});
  assert.deepEqual(removed.data.routines.map(routine=>routine.id),['registration:dance-b']);
  await request('/api/participant/assets/'+photo.data.assetId,{cookie,expected:404});
});

test('registration fallback never borrows results or private assets from another edition of the same routine',async t=>{
  const {db,request,admin,access}=await fixture(t);const {cookie}=await access();
  await admin({action:'event.upsert',event:{id:'other-edition',title:'Otra edición ficticia',season:'Otra temporada',venue:'edomex',published:true}});
  const saved=await admin({action:'routine.save',eventId:'other-edition',danceId:'dance-a',result:result(),judging,photosPublished:true});
  const photo=await admin({action:'asset.upload',eventId:'other-edition',kind:'photo',routineId:saved.data.routineId,fileName:'other-edition.jpg',contentType:'image/png',base64Data:photoSource.toString('base64')});
  await admin({action:'asset.publish',assetId:photo.data.assetId,published:true});
  await admin({action:'routine.publish',routineId:saved.data.routineId});
  const before=totalChanges(db);
  const response=await request('/api/participant/me',{cookie});
  assert.equal(response.data.routines.length,1);
  assert.equal(response.data.routines[0].id,'registration:dance-a');
  assert.equal(response.data.routines[0].result.status,'pending');
  assert.equal(response.data.routines[0].judging.status,'pending');
  assert.equal(response.data.routines[0].photos.count,0);
  assert.doesNotMatch(JSON.stringify(response.data),/Observación privada|other-edition/);
  assert.equal(totalChanges(db),before);
  await request('/api/participant/assets/'+photo.data.assetId,{cookie,expected:404});
});

test('registration fallback requires an explicitly configured edition while curated records work without it',async t=>{
  const {db,env,request,admin,access}=await fixture(t);const current=await access();
  delete env.PARTICIPANT_REGISTRATION_EVENT_IDS;
  let response=await request('/api/participant/me',{cookie:current.cookie});
  assert.deepEqual(response.data.routines,[],'absent configuration fails closed even for the current edition');
  env.PARTICIPANT_REGISTRATION_EVENT_IDS=' test-event , , test-event ';
  response=await request('/api/participant/me',{cookie:current.cookie});
  assert.equal(response.data.routines[0].id,'registration:dance-a');
  await admin({action:'event.upsert',event:{id:'future-edition',title:'Edición futura ficticia',season:'Otra temporada',venue:'edomex',published:false}});
  const grant=await admin({action:'access.create',eventId:'future-edition',participantId:'person-a'});
  const exchange=await request('/api/participant/access/exchange',{method:'POST',body:{token:grant.data.token}});
  const futureCookie=exchange.headers.get('set-cookie').split(';')[0];
  db.sqlite.prepare("INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES('dance-b','person-a')").run();
  let before=totalChanges(db);
  response=await request('/api/participant/me',{cookie:futureCookie});
  assert.deepEqual(response.data.routines,[],'the same venue never authorizes fallback into an unconfigured future edition');
  const preview=await request(previewPath('person-a','future-edition'),{cookie:adminCookie});
  assert.deepEqual(preview.data.routines,[],'admin preview uses the same explicit edition boundary');
  assert.equal(totalChanges(db),before);
  const curated=await admin({action:'routine.save',eventId:'future-edition',danceId:'dance-a',result:result(),judging,photosPublished:false});
  before=totalChanges(db);
  response=await request('/api/participant/me',{cookie:futureCookie});
  assert.deepEqual(response.data.routines.map(routine=>routine.id),[curated.data.routineId]);
  assert.equal(response.data.routines[0].result.status,'pending','curation does not bypass publication');
  const curatedPreview=await request(previewPath('person-a','future-edition'),{cookie:adminCookie});
  assert.equal(curatedPreview.data.routines[0].result.score,138.5,'explicitly curated data remains reviewable without registration fallback');
  assert.equal(totalChanges(db),before);
  env.PARTICIPANT_REGISTRATION_EVENT_IDS='test-event, future-edition, test-event';
  response=await request('/api/participant/me',{cookie:futureCookie});
  assert.deepEqual(new Set(response.data.routines.map(routine=>routine.id)),new Set([curated.data.routineId,'registration:dance-b']));
});

test('every photo upload is converted by the server even when a client claims it is watermarked',async t=>{
  const {admin,request,db,bucket}=await fixture(t);
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',photosPublished:true});
  const input={action:'asset.upload',uploadId:'mandatory-watermark-photo',eventId:'test-event',kind:'photo',routineId:saved.data.routineId,
    fileName:'original.png',contentType:'image/png',base64Data:photoSource.toString('base64'),width:1,height:1,watermarked:true};
  const uploaded=await admin(input);
  const asset=db.sqlite.prepare('SELECT * FROM participant_portal_assets WHERE id=?').get(uploaded.data.assetId);
  assert.equal(asset.content_type,'image/jpeg');assert.equal(asset.file_name,'original.jpg');
  assert.equal(asset.width,512);assert.equal(asset.height,320);
  const object=bucket.objects.get(asset.object_key);
  assert.equal(object.customMetadata.watermarkVersion,'levitate-preview-v1');
  assert.notDeepEqual(object.bytes,new Uint8Array(photoSource));
  assert.equal(asset.byte_size,object.bytes.length);
  const retry=await admin(input);assert.equal(retry.data.assetId,uploaded.data.assetId);assert.equal(bucket.objects.size,1);
  const preview=await request(`/api/registration/admin/participant-portal?assetId=${uploaded.data.assetId}`,{cookie:adminCookie});
  assert.deepEqual(preview.data,object.bytes);assert.equal(preview.headers.get('content-type'),'image/jpeg');
  assert.equal(Number(preview.headers.get('content-length')),object.bytes.length);
  await admin({...input,uploadId:'invalid-photo-source',base64Data:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')},400);
  assert.equal(bucket.objects.size,1,'malformed photos must not be stored');
});

test('old private photos receive a cached watermark after authorization without changing the source or D1',async t=>{
  const {admin,request,db,bucket,access}=await fixture(t);
  const saved=await admin({action:'routine.save',eventId:'test-event',danceId:'dance-a',photosPublished:true});
  await admin({action:'routine.publish',routineId:saved.data.routineId});
  const grant=await access();
  const uploaded=await admin({action:'asset.upload',eventId:'test-event',kind:'photo',routineId:saved.data.routineId,
    fileName:'legacy.png',contentType:'image/png',base64Data:photoSource.toString('base64')});
  await admin({action:'asset.publish',assetId:uploaded.data.assetId,published:true});
  const asset=db.sqlite.prepare('SELECT * FROM participant_portal_assets WHERE id=?').get(uploaded.data.assetId);
  await bucket.put(asset.object_key,photoSource); // Simulate an upload saved before mandatory processing.
  bucket.reads=[];
  await request(`/api/participant/assets/${uploaded.data.assetId}`,{expected:401});
  assert.equal(bucket.reads.length,0,'private storage is not read before authorization');
  const before=totalChanges(db);
  const first=await request(`/api/participant/assets/${uploaded.data.assetId}`,{cookie:grant.cookie});
  assert.equal(first.headers.get('content-type'),'image/jpeg');assert.notDeepEqual(first.data,new Uint8Array(photoSource));
  assert.deepEqual(bucket.objects.get(asset.object_key).bytes,new Uint8Array(photoSource),'preserve the private source');
  assert.equal(bucket.objects.size,2,'save a separate reusable derivative');
  const second=await request(`/api/participant/assets/${uploaded.data.assetId}`,{cookie:grant.cookie});
  assert.deepEqual(second.data,first.data);assert.equal(bucket.objects.size,2);assert.equal(totalChanges(db),before);
});
