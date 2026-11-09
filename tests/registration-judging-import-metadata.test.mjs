import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as registration from '../integrations/jueceocore/import-excel/registration_link.js';

const source = await readFile(new URL('../integrations/jueceocore/import-excel/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source+'\nexports.parseBlocks=parseBlocks;exports.aliases=mergedEntryColumnAliases;exports.columns=entryColumnMap;',{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const token='t'.repeat(43), sourceEventId='25cf168b-4bf1-423f-b2c2-42897d3f8110';
const routine=(id='1',overrides={})=>({id,registrationMetadataPresent:true,registrationDanceID:'dance-0001',registrationEventID:'edomex-2026-otono',registrationToken:token,...overrides});
const headers=['COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA','ID','ID INSCRIPCIÓN','ID EDICIÓN','TOKEN VINCULACIÓN'];
const row=['Aire','Academia Una','Junior','Jazz','Solo','1','dance-0001','edomex-2026-otono',token];
function harness(rows=[headers,row],{callbackFailure=false}={}){
  const calls=[],callbacks=[],sheet={'!ref':'fixture'};let handler;
  rows.forEach((cells,r)=>cells.forEach((v,c)=>{sheet[`${r}_${c}`]={v};}));
  const scope={exports:{},console,Response,Request,URL,URLSearchParams,AbortSignal,AbortController,TextEncoder,TextDecoder,atob,btoa,crypto,Uint8Array,
    Deno:{serve(value){handler=value;},env:{get(name){return name==='SUPABASE_URL'?'https://fixture.supabase.co':'synthetic-secret';}}},
    fetch:async(input,options={})=>{
      const url=new URL(input);calls.push({url,options});
      assert.equal(url.origin,'https://fixture.supabase.co');
      if(options.method==='POST' && url.pathname==='/rest/v1/events')return Response.json([{id:sourceEventId}]);
      if(url.pathname==='/rest/v1/judges' && options.method==='GET')return Response.json([{judge_id:'admin',name:'Admin',role:'admin'}]);
      return Response.json([]);
    },
    require(path){
      if(path==='npm:xlsx@0.18.5')return {read:()=>({SheetNames:['Programa'],Sheets:{Programa:sheet}}),utils:{
        decode_range:()=>({s:{r:0,c:0},e:{r:rows.length-1,c:Math.max(...rows.map(row=>row.length))-1}}),
        encode_cell:({r,c})=>`${r}_${c}`,
      }};
      if(path==='./default_templates.ts')return {DEFAULT_TEMPLATES:[{genre:'Jazz',title:'Jazz',maxScore:10,criteria:[{id:1,section:'Técnica',label:'Control',maxScore:10}]}]};
      if(path==='./registration_link.js')return {...registration,postRegistrationLink:async(link,eventId)=>{
        callbacks.push({link,eventId});if(callbackFailure)throw new registration.RegistrationLinkError('El programa se importó, pero no se pudo vincular.',502);return true;
      }};
      throw new Error('Unexpected module');
    },
  };
  vm.runInNewContext(compiled,scope);
  return {scope,calls,callbacks,sheet,handler,parse:()=>scope.exports.parseBlocks('Programa',sheet,scope.exports.aliases()),
    request:async(overrides={})=>handler(new Request('https://fixture.supabase.co/functions/v1/import-excel',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({payload_base64:'fixture',filename:'programa.xls',activate:false,...overrides}),
    }))};
}

test('fully legacy programmes remain unlinked and are not subject to new force policy',()=>{
  assert.equal(registration.collectRegistrationLink([{id:'1',name:'Aire'}],{forceReplace:true,replaceEvent:true}),null);
  const legacy=harness([headers.slice(0,6),row.slice(0,6)]).parse();
  assert.equal(legacy[0].routines[0].id,'1');
  assert.equal(legacy[0].routines[0].registrationMetadataPresent,undefined);
});

test('previous web exports with ID INSCRIPCIÓN alone remain legacy and import without a callback',async()=>{
  const view=harness([headers.slice(0,7),row.slice(0,7)]);
  const item=view.parse()[0].routines[0];
  assert.equal(item.id,'1');assert.equal(item.registrationDanceID,'dance-0001');
  assert.equal(Object.hasOwn(item,'registrationEventID'),false);assert.equal(Object.hasOwn(item,'registrationToken'),false);
  assert.equal(registration.collectRegistrationLink([item],{forceReplace:true}),null);
  const response=await view.request();assert.equal(response.status,200);
  assert.equal((await response.json()).registration_linked,undefined);assert.equal(view.callbacks.length,0);
  const routineWrite=view.calls.find(call=>call.url.pathname==='/rest/v1/routines' && call.options.method==='POST');
  assert.equal(JSON.parse(routineWrite.options.body)[0].routine_id,'1');
  assert.throws(()=>registration.collectRegistrationLink([item,routine('2',{registrationDanceID:'dance-0002'})]),error=>error.status===400);
});

test('reserved metadata is read without replacing the native numeric ID',()=>{
  const parsed=harness().parse(), item=parsed[0].routines[0];
  assert.equal(item.id,'1');assert.equal(item.registrationDanceID,'dance-0001');
  assert.equal(item.registrationEventID,'edomex-2026-otono');assert.equal(item.registrationToken,token);
  const link=registration.collectRegistrationLink(parsed[0].routines);
  assert.deepEqual(link,{token,registrationEventId:'edomex-2026-otono',routines:[{danceId:'dance-0001',sourceRoutineId:'1'}]});
});

test('dedicated aliases do not match or override the app ID column',()=>{
  const view=harness();const columns=view.scope.exports.columns(headers,view.scope.exports.aliases());
  assert.equal(columns.entryID,5);assert.equal(columns.registrationDanceID,6);assert.equal(columns.registrationEventID,7);assert.equal(columns.registrationToken,8);
  const aliases=view.scope.exports.aliases({registrationToken:['ACADEMIA'],registrationDanceID:['ID']});
  assert.deepEqual([...aliases.registrationToken],registration.REGISTRATION_COLUMN_ALIASES.registrationToken);
  assert.deepEqual([...aliases.registrationDanceID],registration.REGISTRATION_COLUMN_ALIASES.registrationDanceID);
  const hostileAliases=view.scope.exports.aliases({entryID:['TOKEN VINCULACIÓN'],name:['ID INSCRIPCIÓN']});
  const hostileColumns=view.scope.exports.columns(['ID INSCRIPCIÓN','TOKEN VINCULACIÓN','ID','COREOGRAFÍA','ACADEMIA'],hostileAliases);
  assert.equal(hostileColumns.entryID,2);assert.equal(hostileColumns.name,3);assert.equal(hostileColumns.registrationToken,1);
});

test('linked HTML programmes skip block separators and refresh changing repeated headers',()=>{
  const aerialHeaders=[...headers.slice(0,5),'NIVEL',...headers.slice(5)];
  const aerialRow=['Orbita','Academia Una','Junior','Jazz','Solo','Inicial','2','dance-0002','edomex-2026-otono',token];
  const view=harness([['BLOQUE 1: MOTION'],headers,row,['BLOQUE 2: AERIAL'],aerialHeaders,aerialRow]);
  const blocks=view.parse();
  assert.equal(blocks.length,2);assert.equal(blocks[0].name,'BLOQUE 1: MOTION');assert.equal(blocks[1].name,'BLOQUE 2: AERIAL');
  assert.deepEqual(Array.from(blocks.flatMap(block=>block.routines),item=>item.id),['1','2']);
  assert.equal(blocks[1].routines[0].level,'Inicial');assert.equal(blocks[1].routines[0].registrationDanceID,'dance-0002');
  assert.equal(registration.collectRegistrationLink(blocks.flatMap(block=>block.routines)).routines.length,2);
});

test('partial, blank or mixed registration metadata fails before an import can write',()=>{
  for(const change of [{registrationDanceID:''},{registrationEventID:''},{registrationToken:''},{registrationToken:'short'},{registrationDanceID:'../escape'}]){
    assert.throws(()=>registration.collectRegistrationLink([routine('1',change)]),error=>error.status===400);
  }
  assert.throws(()=>registration.collectRegistrationLink([routine(),{id:'2'}]),/incompletos/);
  for(const change of [{registrationEventID:'puebla-2027'},{registrationToken:'x'.repeat(43)}]){
    assert.throws(()=>registration.collectRegistrationLink([routine(),routine('2',{registrationDanceID:'dance-0002',...change})]),/mezcla/);
  }
});

test('duplicate IDs and destructive import flags are rejected for linked programmes',()=>{
  assert.throws(()=>registration.collectRegistrationLink([routine(),routine('2')]),/repetidos/);
  assert.throws(()=>registration.collectRegistrationLink([routine(),routine('1',{registrationDanceID:'dance-0002'})]),/repetidos/);
  for(const option of [{replaceEvent:true},{forceReplace:true}])assert.throws(()=>registration.collectRegistrationLink([routine()],option),/reemplazo forzado/);
  assert.throws(()=>registration.collectRegistrationLink(Array.from({length:601},(_,i)=>routine(String(i+1),{registrationDanceID:`dance-${String(i).padStart(5,'0')}`}))),/600/);
});

test('capability values cannot be copied into public fields, including custom config keys',()=>{
  assert.doesNotThrow(()=>registration.assertRegistrationTokenPrivate({name:'Aire',config:{brand:'Levitate'}},token));
  for(const value of [{name:token},{templates:[{label:`before ${token} after`}]},{config:{registrationToken:token}}]){
    assert.throws(()=>registration.assertRegistrationTokenPrivate(value,token),error=>error.status===400 && !error.message.includes(token));
  }
});

test('successful callback posts only the scoped token to the fixed website endpoint',async()=>{
  const link=registration.collectRegistrationLink([routine()]);let calls=0;
  assert.equal(await registration.postRegistrationLink(link,sourceEventId,{fetcher:async(url,options)=>{
    calls++;assert.equal(url,'https://levitate.mx/api/integrations/jueceocore/program');assert.equal(options.method,'POST');assert.equal(options.redirect,'manual');
    assert.deepEqual(Object.keys(options.headers).sort(),['accept','content-type']);assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body),{...link,sourceEventId});return Response.json({ok:true,linked:1});
  }}),true);
  assert.equal(calls,1);
});

test('callback failures, redirects and timeouts are bounded and never disclose upstream data',async()=>{
  const link=registration.collectRegistrationLink([routine()]);
  for(const fetcher of [async()=>new Response(`PRIVATE ${token}`,{status:403}),async()=>new Response(null,{status:302,headers:{location:'https://outside.test'}}),async()=>new Response('<html>fallback</html>',{status:200}),async()=>Response.json({ok:false}),async()=>Response.json({ok:true,linked:0}),async()=>Response.json({ok:true,padding:'x'.repeat(4096)}),async()=>{throw new Error(`PRIVATE ${token}`);},()=>new Promise(()=>{})]){
    await assert.rejects(()=>registration.postRegistrationLink(link,sourceEventId,{fetcher,timeoutMs:2}),error=>error.status===502 && !error.message.includes(token) && !/PRIVATE|403|outside/.test(error.message));
  }
});

test('import handler validates metadata before writes and skips callback on dry runs',async()=>{
  for(const options of [{force_replace:true},{replace_event:true}]){
    const view=harness();const response=await view.request(options);assert.equal(response.status,400);assert.equal(view.calls.length,0);assert.equal(view.callbacks.length,0);
  }
  const partial=harness([headers,[...row.slice(0,8),'']]);assert.equal((await partial.request()).status,400);assert.equal(partial.calls.length,0);
  const dry=harness();const dryResponse=await dry.request({dry_run:true});assert.equal(dryResponse.status,200);assert.equal(dry.calls.length,0);assert.equal(dry.callbacks.length,0);
  assert.equal((await dryResponse.json()).registration_linked,undefined);
});

test('import handler persists native data only then confirms linkage without leaking token',async()=>{
  const view=harness();const response=await view.request();assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.registration_linked,true);assert.equal(result.event_id,sourceEventId);
  assert.equal(view.callbacks.length,1);assert.equal(view.callbacks[0].eventId,sourceEventId);
  const stored=view.calls.filter(call=>call.options.body).map(call=>call.options.body).join('\n');
  assert.doesNotMatch(stored,/registrationDanceID|registrationToken|ID INSCRIPCIÓN/);assert.ok(!stored.includes(token));
  const routineWrite=view.calls.find(call=>call.url.pathname==='/rest/v1/routines' && call.options.method==='POST');
  assert.equal(JSON.parse(routineWrite.options.body)[0].routine_id,'1');
});

test('callback failure reports imported state without rolling back or deleting source data again',async()=>{
  const view=harness(undefined,{callbackFailure:true});const response=await view.request();assert.equal(response.status,502);
  assert.match((await response.json()).error,/programa se importó/);assert.equal(view.callbacks.length,1);
  const deletionCalls=view.calls.filter(call=>call.options.method==='DELETE');assert.equal(deletionCalls.length,1,'only pre-existing guarded block replacement happens before import');
  assert.equal(deletionCalls[0].url.pathname,'/rest/v1/routines');
});
