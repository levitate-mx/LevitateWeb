import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {loadPhotoFolderManifest,photoFolderBatches} from '../scripts/prepare-participant-photo-folders.mjs';

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
      ('r1','edition','d1','source-event','1'),('r2','edition','d2','source-event','2');`);
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
  assert.equal(result.sourceEventId,'source-event');
  assert.deepEqual(result.presentations,[{id:'d1',number:'194 a'},{id:'d2',number:'237'}]);
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
