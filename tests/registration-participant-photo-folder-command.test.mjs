import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {loadPhotoFolderManifest,photoFolderBatches,parsePhotoFolderArguments,loadPhotoFolderCredentials,preparePhotoFolders} from '../scripts/prepare-participant-photo-folders.mjs';
import {getJudgingRoutineDirectory} from '../worker/judging-reader.js';

const sourceEventId='f3c2e100-1234-4567-8abc-123456789abc';
const photoCredentials={PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID:'SYNTHETIC_PHOTO_CLIENT',
  PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_SECRET:'SYNTHETIC_PHOTO_SECRET',
  PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN:'SYNTHETIC_PHOTO_REFRESH',PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL:'ati.levitatemx@gmail.com'};
const judgingCredentials={JUDGING_SUPABASE_URL:'https://judgingfixture.supabase.co',JUDGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_read_key'};

function fixture(t) {
  const sqlite=new DatabaseSync(':memory:');t.after(()=>sqlite.close());
  sqlite.exec(readFileSync(new URL('../db/registration_d1_schema.sql',import.meta.url),'utf8'));
  sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES('a','Academia Uno','Staff','a@example.invalid'),('b','Academia Dos','Staff','b@example.invalid');
    INSERT INTO participant_portal_events(id,title,season,venue) VALUES('edition','Levitate','2026','edomex');
    INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue) VALUES
      ('d1','a','Primera','aereo','tela','solo','intermedio','edomex'),
      ('d2','a','Segunda','aereo','aro','solo','intermedio','edomex'),
      ('d3','b','Otra sede','aereo','tela','solo','intermedio','cdmx');
    INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id) VALUES
      ('r1','edition','d1','${sourceEventId}','1'),('r2','edition','d2','${sourceEventId}','2');`);
  const queries=[];
  const db={async read(statements){return statements.map(sql=>{queries.push(sql);assert.match(sql,/^\s*SELECT/);return sqlite.prepare(sql).all().map(row=>({...row}));});}};
  return {db,queries,sqlite};
}

const directory=async id=>({event:{id},rows:[
  {id:'1',programNumber:'194 a',name:'Primera',academy:'Academia Uno'},
  {id:'2',programNumber:'237',name:'Segunda',academy:'Academia Uno'},
  {id:'unlinked',programNumber:null,name:'Exhibición ajena',academy:''},
]});

test('folder manifest resolves the real presentation number for every dance in the selected Mi Levitate venue',async t=>{
  const f=fixture(t), result=await loadPhotoFolderManifest(f.db,'edition',directory);
  assert.equal(result.eventId,'edition');
  assert.equal(result.sourceEventId,sourceEventId);
  assert.deepEqual(result.presentations,[{id:'d1',number:'194 a'},{id:'d2',number:'237'}]);
  assert.deepEqual(result.omitted,[]);
  assert.deepEqual(result.counts,{registered:2,eligible:2,omitted:0});
  assert.doesNotMatch(f.queries.join('\n'),/registration_music|registration_participants|curp|password|INSERT|UPDATE|DELETE/);
});
test('invalid event IDs stop before any database query',async t=>{
  const f=fixture(t);
  for(const eventId of ["edition' OR 1=1--",'',undefined,'x'.repeat(101)]) await assert.rejects(loadPhotoFolderManifest(f.db,eventId,directory));
  assert.equal(f.queries.length,0);
});
test('missing Mi Levitate events stop before reading registrations',async t=>{
  const f=fixture(t);await assert.rejects(loadPhotoFolderManifest(f.db,'missing',directory));
  assert.equal(f.queries.length,1);
});
test('folder batches preserve every presentation identity with at most eight numbered folders per request',()=>{
  const presentations=Array.from({length:234},(_,i)=>({id:`d${i}`,number:String(i+1)}));
  const batches=photoFolderBatches(presentations);
  assert.deepEqual(batches.flat(),presentations);
  assert.ok(batches.every(batch=>batch.length<=8));
  assert.equal(batches.length,Math.ceil(presentations.length/8));
});
test('empty folder manifests produce no operational batches',()=>assert.deepEqual(photoFolderBatches([]),[]));

function staleFixture(t) {
  const f=fixture(t);
  f.sqlite.exec(`INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue) VALUES
    ('missing-134','a','Rutina retirada 134','aereo','tela','solo','intermedio','edomex'),
    ('missing-49','a','Rutina retirada 49','aereo','tela','solo','intermedio','edomex'),
    ('unlinked-a','a','El Sinsajo','aereo','tela','solo','intermedio','edomex'),
    ('unlinked-b','a','El Sinsajo','aereo','tela','solo','intermedio','edomex'),
    ('unlinked-c','b','Reino Salvaje','aereo','tela','solo','intermedio','edomex');
    INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id) VALUES
    ('missing-r134','edition','missing-134','${sourceEventId}','134'),
    ('missing-r49','edition','missing-49','${sourceEventId}','49');`);
  return f;
}

test('current-program-only explicitly omits three unlinked registrations and two deleted source IDs with an exact audit list',async t=>{
  const f=staleFixture(t);
  let directoryCalls=0;
  await assert.rejects(loadPhotoFolderManifest(f.db,'edition',async id=>{directoryCalls++;return directory(id);}),/Every presentation must be linked/);
  assert.equal(directoryCalls,0,'strict mode rejects missing links before consulting any upstream');
  const result=await loadPhotoFolderManifest(f.db,'edition',directory,{currentProgramOnly:true});
  assert.deepEqual(result.presentations,[{id:'d1',number:'194 a'},{id:'d2',number:'237'}]);
  assert.equal(result.currentProgramOnly,true);
  assert.deepEqual(result.counts,{registered:7,eligible:2,omitted:5});
  assert.deepEqual(result.omitted,[
    {reason:'source_routine_missing',danceId:'missing-134',title:'Rutina retirada 134',sourceEventId,sourceRoutineId:'134'},
    {reason:'source_routine_missing',danceId:'missing-49',title:'Rutina retirada 49',sourceEventId,sourceRoutineId:'49'},
    {reason:'unlinked',danceId:'unlinked-a',title:'El Sinsajo',sourceEventId:null,sourceRoutineId:null},
    {reason:'unlinked',danceId:'unlinked-b',title:'El Sinsajo',sourceEventId:null,sourceRoutineId:null},
    {reason:'unlinked',danceId:'unlinked-c',title:'Reino Salvaje',sourceEventId:null,sourceRoutineId:null},
  ]);
  f.sqlite.exec("DELETE FROM registration_dances WHERE id LIKE 'unlinked-%'");
  await assert.rejects(loadPhotoFolderManifest(f.db,'edition',directory),/Presentation numbers must be present and unique/,
    'strict mode also refuses existing links to deleted source routines');
});

test('current-program-only preserves event, directory identity, programme number and registration association guards',async t=>{
  const f=fixture(t),valid=await directory(sourceEventId);
  for(const invalid of [
    {...valid,event:{id:'another-event'}},
    {...valid,rows:[...valid.rows,valid.rows[0]]},
    {...valid,rows:[{...valid.rows[0],programNumber:'237'},valid.rows[1]]},
    {...valid,rows:[{...valid.rows[0],programNumber:''},valid.rows[1]]},
  ]) await assert.rejects(loadPhotoFolderManifest(f.db,'edition',async()=>invalid,{currentProgramOnly:true}));
  f.sqlite.exec("UPDATE participant_portal_routines SET source_event_id='another-event' WHERE id='r2'");
  let calls=0;
  await assert.rejects(loadPhotoFolderManifest(f.db,'edition',async()=>{calls++;return valid;},{currentProgramOnly:true}),/one judging programme/);
  assert.equal(calls,0);
  assert.throws(()=>f.sqlite.exec(`UPDATE participant_portal_routines SET source_event_id='${sourceEventId}',source_routine_id='1' WHERE id='r2'`),/UNIQUE constraint/,
    'the existing database constraint also prevents assigning one source presentation to two registrations');
});

test('empty current programmes stop preparation before OAuth or Drive even with current-program-only',async t=>{
  const f=staleFixture(t);let fetchCalls=0;
  await assert.rejects(preparePhotoFolders({db:f.db,env:photoCredentials,eventId:'edition',currentProgramOnly:true,
    getJudgingDirectory:async id=>({event:{id},rows:[]}),fetchImpl:async()=>{fetchCalls++;throw new Error('must not fetch');},log(){}}),/programme is empty/);
  assert.equal(fetchCalls,0);
});

test('preparation prints every explicit omission and counts before any photo authorization',async t=>{
  const f=staleFixture(t),logs=[];let fetchCalls=0;
  await assert.rejects(preparePhotoFolders({db:f.db,env:photoCredentials,eventId:'edition',currentProgramOnly:true,
    getJudgingDirectory:directory,fetchImpl:async input=>{fetchCalls++;assert.equal(new URL(input).origin,'https://oauth2.googleapis.com');return new Response(null,{status:403});},
    log:message=>logs.push(message)}),error=>error.code==='portal_photo_hierarchy_unavailable');
  assert.equal(fetchCalls,1);
  assert.equal(logs[0],'Photo folders: 2 eligible of 7 registered; 5 omitted.');
  assert.equal(logs.length,6);
  assert.deepEqual(logs.slice(1).map(message=>JSON.parse(message.slice('Omitted presentation: '.length))),
    (await loadPhotoFolderManifest(f.db,'edition',directory,{currentProgramOnly:true})).omitted);
});

async function credentialFiles(t,photo=photoCredentials,judging=judgingCredentials) {
  const directory=await mkdtemp(join(tmpdir(),'levitate-photo-command-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const photoFile=join(directory,'photo.json'),judgingFile=join(directory,'judging.json');
  await writeFile(photoFile,JSON.stringify(photo),{mode:0o600});
  await writeFile(judgingFile,JSON.stringify(judging),{mode:0o600});
  return {photoFile,judgingFile};
}

test('CLI requires explicit separate photo and judging credential files',async t=>{
  const {photoFile,judgingFile}=await credentialFiles(t);
  const args=['--remote','--credentials-file',photoFile,'--judging-credentials-file',judgingFile,'--event-id','edition'];
  const values=parsePhotoFolderArguments(args);
  const credentials=await loadPhotoFolderCredentials(values['credentials-file'],values['judging-credentials-file']);
  assert.deepEqual(credentials,{env:photoCredentials,judgingEnv:judgingCredentials});
  assert.equal(values['current-program-only'],undefined,'strict mode is the default');
  assert.equal(parsePhotoFolderArguments([...args,'--current-program-only'])['current-program-only'],true);
  assert.throws(()=>parsePhotoFolderArguments(['--remote','--credentials-file',photoFile,'--event-id','edition']),/separate judging credentials file/);
  assert.throws(()=>parsePhotoFolderArguments(args.slice(1)),/remote event/);
  assert.throws(()=>parsePhotoFolderArguments([...args,'--unknown-option','value']));
  assert.equal(parsePhotoFolderArguments(['--help']).help,true);
});

test('credential files reject mixed, malformed or privileged configuration without disclosing contents',async t=>{
  const files=await credentialFiles(t);
  const invalidCases=[
    {photo:{...photoCredentials,...judgingCredentials},judging:judgingCredentials},
    {photo:photoCredentials,judging:{...judgingCredentials,PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN:'SYNTHETIC_PRIVATE_EXTRA'}},
    {photo:photoCredentials,judging:{JUDGING_SUPABASE_URL:judgingCredentials.JUDGING_SUPABASE_URL}},
    {photo:photoCredentials,judging:{...judgingCredentials,JUDGING_SUPABASE_PUBLISHABLE_KEY:'sb_secret_SYNTHETIC_PRIVATE'}},
    {photo:photoCredentials,judging:{...judgingCredentials,JUDGING_SUPABASE_URL:'https://SYNTHETIC_PRIVATE@example.invalid'}},
    {photo:photoCredentials,judging:[]},
  ];
  for(const {photo,judging} of invalidCases) {
    await writeFile(files.photoFile,JSON.stringify(photo));await writeFile(files.judgingFile,JSON.stringify(judging));
    await assert.rejects(loadPhotoFolderCredentials(files.photoFile,files.judgingFile),error=>{
      assert.doesNotMatch(error.message,/SYNTHETIC|sb_secret|refresh|https:\/\//);return true;
    });
  }
  await writeFile(files.photoFile,JSON.stringify(photoCredentials));await writeFile(files.judgingFile,'{SYNTHETIC_PRIVATE_INVALID_JSON');
  await assert.rejects(loadPhotoFolderCredentials(files.photoFile,files.judgingFile),/Could not read the judging credentials file/);
  await assert.rejects(loadPhotoFolderCredentials(files.photoFile,join(tmpdir(),'missing-judging-credentials.json')),/Could not read the judging credentials file/);
});

function realDirectoryUpstream() {
  const calls=[];
  return {calls,async fetchImpl(input,options) {
    const url=new URL(input);calls.push({url,options});
    if(url.origin==='https://oauth2.googleapis.com')return new Response(null,{status:403});
    assert.equal(url.origin,judgingCredentials.JUDGING_SUPABASE_URL);
    assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');
    assert.equal(options.headers.apikey,judgingCredentials.JUDGING_SUPABASE_PUBLISHABLE_KEY);
    assert.doesNotMatch(JSON.stringify(options),/SYNTHETIC_PHOTO/);
    if(url.searchParams.get('offset')!=='0')return Response.json([]);
    if(url.pathname==='/rest/v1/events')return Response.json([{id:sourceEventId,name:'Programa',event_type:'event'}]);
    assert.equal(url.pathname,'/rest/v1/routines');
    assert.equal(url.searchParams.get('select'),'event_id,routine_id,program_number,name,academy');
    return Response.json([
      {event_id:sourceEventId,routine_id:'1',program_number:'194 a',name:'Primera',academy:'Academia Uno'},
      {event_id:sourceEventId,routine_id:'2',program_number:'237',name:'Segunda',academy:'Academia Uno'},
    ]);
  }};
}

test('the real judging reader maps upstream programme numbers onto registration dance identities',async t=>{
  const f=fixture(t),upstream=realDirectoryUpstream();
  const result=await loadPhotoFolderManifest(f.db,'edition',id=>getJudgingRoutineDirectory(judgingCredentials,id,
    {trustedEventId:id,fetcher:upstream.fetchImpl}));
  assert.deepEqual(result.presentations,[{id:'d1',number:'194 a'},{id:'d2',number:'237'}]);
  assert.equal(upstream.calls.length,4);
  assert.ok(upstream.calls.every(({url})=>['/rest/v1/events','/rest/v1/routines'].includes(url.pathname)));
});

test('preparation loads separate CLI files and resolves the real directory before photo authorization',async t=>{
  const f=fixture(t),files=await credentialFiles(t),upstream=realDirectoryUpstream();
  const values=parsePhotoFolderArguments(['--remote','--credentials-file',files.photoFile,'--judging-credentials-file',files.judgingFile,'--event-id','edition']);
  const credentials=await loadPhotoFolderCredentials(values['credentials-file'],values['judging-credentials-file']);
  await assert.rejects(preparePhotoFolders({db:f.db,...credentials,eventId:values['event-id'],fetchImpl:upstream.fetchImpl,log(){}}),
    error=>error.code==='portal_photo_hierarchy_unavailable'&&!/SYNTHETIC|sb_publishable/.test(error.message));
  assert.equal(upstream.calls.length,5);
  const authorization=upstream.calls.at(-1);
  assert.equal(authorization.url.origin,'https://oauth2.googleapis.com');
  assert.equal(authorization.options.body.get('client_id'),photoCredentials.PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID);
  assert.doesNotMatch(authorization.options.body.toString(),/sb_publishable|JUDGING/);
  assert.ok(upstream.calls.every(({url})=>url.origin!=='https://www.googleapis.com'),'no Drive tree is changed by the fixture');
});
