import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';

class PortalD1 {
  constructor() { this.sqlite = new DatabaseSync(':memory:'); }
  prepare(sql) {
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
  constructor(){this.objects=new Map();}
  async put(key,bytes){this.objects.set(key,new Uint8Array(bytes));}
  async get(key){const bytes=this.objects.get(key);return bytes ? {body:bytes}:null;}
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
  const env={DB:db,PARTICIPANT_MEDIA:bucket};
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
  assert.equal(data.participant.name,'Mariana Prueba');assert.equal(data.diploma.status,'pending');assert.deepEqual(data.routines,[]);
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
  const photo={action:'asset.upload',uploadId:'photo-upload-test',eventId:'test-event',kind:'photo',routineId:saved.data.routineId,fileName:'preview.png',contentType:'image/png',base64Data:Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64'),width:1200,height:800};
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
  const image=await request('/api/participant/assets/'+assetId,{cookie:a.cookie});assert.equal(image.data.length,12);assert.equal(image.headers.get('content-type'),'image/png');
  await request('/api/participant/assets/'+assetId+'?download=1',{cookie:a.cookie,expected:403});
  let me=await request('/api/participant/me',{cookie:a.cookie});assert.equal(me.data.routines[0].photos.count,1);assert.equal(me.data.routines[0].photos.items[0].downloadUrl,undefined);
  me=await request('/api/participant/me',{cookie:b.cookie});assert.equal(me.data.routines.length,0);
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
  const photo=await admin({action:'asset.upload',eventId:'test-event',kind:'photo',routineId:saved.data.routineId,fileName:'group.jpg',contentType:'image/jpeg',base64Data:Buffer.from([255,216,255,0,0,0]).toString('base64')});
  await admin({action:'asset.publish',assetId:photo.data.assetId,published:true});
  await admin({action:'routine.publish',routineId:saved.data.routineId});
  for(const cookie of [a.cookie,b.cookie]) {
    const me=await request('/api/participant/me',{cookie});assert.equal(me.data.routines.length,1);assert.equal(me.data.routines[0].photos.items[0].id,photo.data.assetId);
    await request('/api/participant/assets/'+photo.data.assetId,{cookie});
  }
  db.sqlite.prepare("DELETE FROM registration_dance_participants WHERE dance_id='dance-a' AND participant_id='person-b'").run();
  await request('/api/participant/assets/'+photo.data.assetId,{cookie:b.cookie,expected:404});
  const me=await request('/api/participant/me',{cookie:b.cookie});assert.equal(me.data.routines.length,0);
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
