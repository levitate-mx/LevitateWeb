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
      ('d3','b','Otra sede','aereo','tela','solo','intermedio','cdmx');`);
  const queries=[];
  const db={async read(statements){return statements.map(sql=>{queries.push(sql);assert.match(sql,/^\s*SELECT/);return sqlite.prepare(sql).all().map(row=>({...row}));});}};
  return {db,queries,sqlite};
}

test('folder manifest uses only academies and choreographies in the selected Mi Levitate venue',async t=>{
  const f=fixture(t), result=await loadPhotoFolderManifest(f.db,'edition');
  assert.equal(result.eventId,'edition');
  assert.deepEqual(result.academies,[{id:'a',name:'Academia Uno',dances:[{id:'d1',title:'Primera'},{id:'d2',title:'Segunda'}]}]);
  assert.doesNotMatch(f.queries.join('\n'),/registration_music|registration_participants|curp|password|INSERT|UPDATE|DELETE/);
});
test('invalid event IDs stop before any database query',async t=>{
  const f=fixture(t);
  for(const eventId of ["edition' OR 1=1--",'',undefined,'x'.repeat(101)]) await assert.rejects(loadPhotoFolderManifest(f.db,eventId));
  assert.equal(f.queries.length,0);
});
test('missing Mi Levitate events stop before reading registrations',async t=>{
  const f=fixture(t);await assert.rejects(loadPhotoFolderManifest(f.db,'missing'));
  assert.equal(f.queries.length,1);
});
test('folder batches preserve every academy and choreography identity with at most eight dances per request',()=>{
  const academies=Array.from({length:46},(_,i)=>({id:`a${i}`,name:`Academia ${i}`,dances:Array.from({length:i<4?6:5},(_,j)=>({id:`d${i}-${j}`,title:`Coreografía ${j}`}))}));
  const batches=photoFolderBatches(academies);
  const expected=academies.flatMap(a=>a.dances.map(d=>[a.id,d.id]));
  assert.deepEqual(batches.flatMap(b=>b.flatMap(a=>a.dances.map(d=>[a.id,d.id]))),expected);
  assert.ok(batches.every(b=>b.reduce((n,a)=>n+a.dances.length,0)<=8&&new Set(b.map(a=>a.id)).size===b.length));
  assert.equal(new Set(expected.map(([,id])=>id)).size,expected.length);
  assert.equal(batches.length,Math.ceil(expected.length/8));
});
test('empty folder manifests produce no operational batches',()=>assert.deepEqual(photoFolderBatches([]),[]));
