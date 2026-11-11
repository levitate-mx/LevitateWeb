import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as registration from '../integrations/jueceocore/import-excel/registration_link.js';

const source = await readFile(new URL('../integrations/jueceocore/import-excel/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source+'\nexports.parseBlocks=parseBlocks;exports.aliases=mergedEntryColumnAliases;exports.columns=entryColumnMap;exports.aliasBaseForGenre=aliasBaseForGenre;exports.ensureTemplatesForRoutines=ensureTemplatesForRoutines;',{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const token='t'.repeat(43), sourceEventId='25cf168b-4bf1-423f-b2c2-42897d3f8110';
const routine=(id='1',overrides={})=>({id,registrationMetadataPresent:true,registrationDanceID:'dance-0001',registrationEventID:'edomex-2026-otono',registrationToken:token,...overrides});
const headers=['COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA','ID','ID INSCRIPCIÓN','ID EDICIÓN','TOKEN VINCULACIÓN'];
const row=['Aire','Academia Una','Junior','Jazz','Solo','1','dance-0001','edomex-2026-otono',token];
function harness(rows=[headers,row],{callbackFailure=false,sheets:workbookRows}={}){
  const calls=[],callbacks=[];let handler;
  const sheets=Object.fromEntries(Object.entries(workbookRows ?? {Programa:rows}).map(([name,cells])=>{
    const sheet={'!ref':`fixture:${cells.length}:${Math.max(1,...cells.map(row=>row.length))}`};
    cells.forEach((values,r)=>values.forEach((v,c)=>{sheet[`${r}_${c}`]={v};}));
    return [name,sheet];
  }));
  const sheet=Object.values(sheets)[0];
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
      if(path==='npm:xlsx@0.18.5')return {read:()=>({SheetNames:Object.keys(sheets),Sheets:sheets}),utils:{
        decode_range:reference=>{const [,rows,columns]=reference.split(':').map(Number);return {s:{r:0,c:0},e:{r:rows-1,c:columns-1}};},
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
  return {scope,calls,callbacks,sheet,handler,parse:(sheetName='Programa')=>scope.exports.parseBlocks(sheetName,sheets[sheetName] ?? sheet,scope.exports.aliases()),
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

test('linked programmes retain the stable ID when an alphanumeric display order precedes it',()=>{
  const view=harness([
    ['#',...headers],
    ['194 a',...row],
  ]);
  const parsed=view.parse();
  assert.equal(parsed[0].routines[0].id,'1');
  assert.equal(registration.collectRegistrationLink(parsed[0].routines).routines[0].sourceRoutineId,'1');
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

test('legacy day programmes preserve section order and omit repeated headers and operational rows',()=>{
  const scheduleHeaders=[null,'COREOGRAFÍA','ACADEMIA','DIVISIÓN','SUBGÉNERO','CATEGORÍA','NIVEL','COREÓGRAFOS','PARTICIPANTE','ESTADO','HORARIO','DURACION','MARGEN'];
  const view=harness([
    [null,null,'BLOQUE 4 B: AERIAL PETITE',null,null,null,null,null,'TEMPORADA OTOÑO · DOMINGO 15 NOV 2026'],
    scheduleHeaders,
    [82,'Alicia','Academia Una','Petite','Tela','Solo','Intermedio','Coreógrafa','Persona A','México','08:00','03:00'],
    [null,'PREMIACION',null,null,null,null,null,null,null,null,'09:20'],
    [null,'RECESO',null,null,null,null,null,null,null,null,'09:30'],
    [null,'BREAK',null,null,null,null,null,null,null,null,'09:35'],
    [null,null,'BLOQUE 7: AERIAL SENIORS',null,null,null,null,null,'TEMPORADA OTOÑO · DOMINGO 15 NOV 2026'],
    scheduleHeaders,
    ['194 a','Pathos','Academia Dos','Senior','Cuna','Solo','Intermedio','Coreógrafo','Persona B','México','18:25','03:00'],
    [194,'Lorax','Academia Tres','Senior','Cuna','Solo','Principiante','Coreógrafa','Persona C','México','18:30','03:30'],
    [null,'PREMIACIÓN',null,null,null,null,null,null,null,null,'22:00'],
  ]);
  const blocks=view.parse('DOMINGO');
  assert.deepEqual(Array.from(blocks,block=>block.name),['BLOQUE 4 B: AERIAL PETITE','BLOQUE 7: AERIAL SENIORS']);
  assert.match(blocks[0].title,/BLOQUE 4 B: AERIAL PETITE/);
  assert.match(blocks[1].title,/BLOQUE 7: AERIAL SENIORS/);
  assert.match(blocks[1].title,/DOMINGO 15 NOV 2026/);
  const entries=blocks.flatMap(block=>block.routines);
  assert.deepEqual(Array.from(entries,item=>item.id),['82','194 a','194']);
  assert.deepEqual(Array.from(entries,item=>item.name),['Alicia','Pathos','Lorax']);
  assert.equal(entries[1].time,'18:25');assert.equal(entries[1].duration,'03:00');
  assert.equal(entries[2].level,'Principiante');
  assert.equal(registration.collectRegistrationLink(entries),null);
});

test('explicit block columns win over visual section titles and numbered routines retain operational names',()=>{
  const view=harness([
    [null,null,'BLOQUE 1: MOTION',null,'TEMPORADA OTOÑO'],
    ['ID','COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA','BLOQUE'],
    ['4','Premiación','Academia Una','Junior','Jazz','Solo','Final Jazz'],
    ['5','Receso','Academia Una','Junior','Jazz','Solo','Final Jazz'],
    ['6','Bloque 8: Una Historia','Academia Una','Junior','Jazz','Solo','Final Jazz'],
    ['7','Break','Academia Una','Junior','Jazz','Solo','Final Jazz'],
    ['8','NOMBRE','Academia Una','Junior','Jazz','Solo','Final Jazz'],
    [null,'PREMIACION'],
    [null,'RECESO'],
    [null,'BREAK'],
  ]);
  const blocks=view.parse('SABADO');
  assert.equal(blocks.length,1);
  const [block]=blocks;
  assert.equal(block.name,'Final Jazz');
  assert.deepEqual(Array.from(block.routines,item=>item.id),['4','5','6','7','8']);
  assert.deepEqual(Array.from(block.routines,item=>item.name),['Premiación','Receso','Bloque 8: Una Historia','Break','NOMBRE']);
});

test('presentation names retain their supplied accents, acronyms and capitalization',()=>{
  const view=harness([
    ['#','COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA'],
    [1,'RÊVERIE — BTS / CDMX','Academia Una','Junior','Jazz','Solo'],
    [2,'MULAN','Academia Dos','Senior','Jazz','Grupo'],
  ]);
  assert.deepEqual(Array.from(view.parse().flatMap(block=>block.routines),item=>item.name),['RÊVERIE — BTS / CDMX','MULAN']);
});

test('a numbered routine with a block-like title and genre remains a presentation even without an academy',()=>{
  const view=harness([
    ['BLOQUE 1: MOTION'],
    ['#','COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA'],
    [1,'BLOQUE 7: Mi Historia',null,'Junior','Jazz','Solo'],
  ]);
  const blocks=view.parse();
  assert.equal(blocks.length,1);assert.equal(blocks[0].name,'BLOQUE 1: MOTION');
  assert.equal(blocks[0].routines.length,1);assert.equal(blocks[0].routines[0].id,'1');
  assert.equal(blocks[0].routines[0].name,'BLOQUE 7: Mi Historia');
});

test('legacy repeated headers refresh the column layout between Motion and Aerial sections',()=>{
  const motionHeaders=['#','COREOGRAFÍA','ACADEMIA','DIVISIÓN','SUBGÉNERO','CATEGORÍA','COREÓGRAFOS','PARTICIPANTE','ESTADO'];
  const aerialHeaders=[...motionHeaders.slice(0,6),'NIVEL',...motionHeaders.slice(6)];
  const view=harness([
    ['BLOQUE 1: MOTION'],
    motionHeaders,
    [1,'Primer Baile','Academia Una','Petite','Jazz','Solo','Primera Coreógrafa','Persona A','México'],
    ['BLOQUE 4 A: AERIAL'],
    aerialHeaders,
    [2,'Segundo Baile','Academia Una','Petite','Tela','Solo','Principiante','Segunda Coreógrafa','Persona B','México'],
  ]);
  const blocks=view.parse();
  assert.equal(blocks.length,2);
  assert.equal(blocks[0].routines.length,1);assert.equal(blocks[1].routines.length,1);
  const item=blocks[1].routines[0];
  assert.equal(item.id,'2');assert.equal(item.level,'Principiante');
  assert.equal(item.choreographer,'Segunda Coreógrafa');assert.equal(item.participant,'Persona B');assert.equal(item.state,'México');
});

test('a numbered presentation missing its name reports its source location before any import writes',async()=>{
  const view=harness([
    [null,null,'BLOQUE 7: AERIAL SENIORS',null,null,null,null,null,'TEMPORADA OTOÑO · DOMINGO 15 NOV 2026'],
    ['#','COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA'],
    [236,'Con Amor','Academia Una','Relevé','Jazz','Grupo'],
    [237,null,'CREA','Relevé','Jazz','Grupo'],
  ]);
  assert.throws(()=>view.parse('DOMINGO'),error=>error.status===422 && /DOMINGO/.test(error.message) && /\b4\b/.test(error.message));
  const response=await view.request({dry_run:true});
  assert.equal(response.status,422);
  assert.match((await response.json()).error,/Programa.*\b4\b/);
  assert.equal(view.calls.length,0);assert.equal(view.callbacks.length,0);
});

test('ordinary empty rows in a legacy programme do not become incomplete presentations',()=>{
  const view=harness([
    ['#','COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA'],
    [],
    [null,null,null,null,null,null],
    [1,'Aire','Academia Una','Junior','Jazz','Solo'],
    [],
  ]);
  const blocks=view.parse();
  assert.deepEqual(Array.from(blocks.flatMap(block=>block.routines),item=>item.id),['1']);
});

test('exhibitions are omitted before missing-name and unknown-rubric validation',async()=>{
  const view=harness([
    ['#','COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA'],
    [1,'Aire','Academia Una','Junior','Jazz','Solo'],
    [2,'SPAGUETTI','Academia Dos','EXHIBICIÓN','KPOP','Grupo'],
    [3,null,'Academia Tres','Senior','Unknown Genre','EXHIBITION'],
    [4,'Exhibición de Luz','Academia Una','Junior','Jazz','Solo'],
  ]);
  const entries=view.parse().flatMap(block=>block.routines);
  assert.deepEqual(Array.from(entries,item=>item.id),['1','4']);
  assert.equal(entries[1].name,'Exhibición de Luz');
  const response=await view.request({dry_run:true});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.routines,2);
  assert.ok(result.warnings.some(warning=>/2 presentaciones de exhibición/.test(warning)));
  assert.equal(view.calls.length,0);assert.equal(view.callbacks.length,0);
});

test('an unknown discipline still blocks a competitive presentation before external writes',async()=>{
  const view=harness([
    ['#','COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA'],
    [1,'Competencia','Academia Una','Junior','KPOP','Solo'],
  ]);
  const response=await view.request({dry_run:true});
  assert.equal(response.status,422);assert.match((await response.json()).error,/KPOP/);
  assert.equal(view.calls.length,0);assert.equal(view.callbacks.length,0);
});

test('dated weekend programmes omit only the companion legacy export and report that choice',async()=>{
  const scheduleHeaders=['#','COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA','HORARIO'];
  const legacyRows=[scheduleHeaders,[1,'Copia Antigua','Academia Una','Junior','Jazz','Solo','08:00']];
  const view=harness(undefined,{sheets:{
    SABADO:[['BLOQUE 1: MOTION',null,null,'SÁBADO 14 NOV 2026'],scheduleHeaders,[1,'Aire','Academia Una','Junior','Jazz','Solo','08:00']],
    DOMINGO:[['BLOQUE 4 B: AERIAL',null,null,'DOMINGO 15 NOV 2026'],scheduleHeaders,[2,'Orbita','Academia Una','Junior','Jazz','Solo','09:00']],
    'levitate-programa (11)':legacyRows,
    'Programa Extra':[scheduleHeaders,[3,'Invitada','Academia Dos','Senior','Jazz','Solo','10:00']],
  }});
  const response=await view.request({dry_run:true});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.routines,3);assert.equal(result.blocks,3);
  assert.ok(Array.isArray(result.warnings));
  assert.ok(result.warnings.some(warning=>warning.includes('levitate-programa (11)')));
  assert.equal(view.calls.length,0);assert.equal(view.callbacks.length,0);
  const imported=await view.request();
  assert.equal(imported.status,200);
  const actual=await imported.json();
  assert.equal(actual.routines,3);assert.equal(actual.blocks,3);
  assert.ok(actual.warnings.some(warning=>warning.includes('levitate-programa (11)')));
});

test('a standalone legacy export is still imported',async()=>{
  const view=harness(undefined,{sheets:{
    'levitate-programa (11)':[headers.slice(0,6),row.slice(0,6)],
  }});
  const response=await view.request({dry_run:true});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.routines,1);assert.equal(result.blocks,1);
  assert.ok(result.warnings.every(warning=>!warning.includes('levitate-programa (11)')));
});

test('a weekday sheet without a scheduled block does not suppress the companion export',async()=>{
  const scheduleHeaders=['#','COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA','HORARIO'];
  const regularHeaders=scheduleHeaders.slice(0,6);
  for(const saturday of [
    [regularHeaders,[1,'Aire','Academia Una','Junior','Jazz','Solo']],
    [scheduleHeaders,[1,'Aire','Academia Una','Junior','Jazz','Solo','08:00']],
    [['BLOQUE 1: MOTION'],regularHeaders,[1,'Aire','Academia Una','Junior','Jazz','Solo']],
  ]){
    const view=harness(undefined,{sheets:{
      SABADO:saturday,
      'levitate-programa (11)':[regularHeaders,[2,'Otra','Academia Dos','Senior','Jazz','Solo']],
    }});
    const response=await view.request({dry_run:true});
    assert.equal(response.status,200);
    assert.equal((await response.json()).routines,2);
  }
});

test('empty or exhibition-only weekend schedules preserve the populated reference export',async()=>{
  const scheduleHeaders=['#','COREOGRAFÍA','ACADEMIA','DIVISIÓN','DISCIPLINA','CATEGORÍA','HORARIO'];
  for(const entries of [[],[[1,'Muestra','Academia Una','EXHIBICION','KPOP','Grupo','08:00']]]){
    const view=harness(undefined,{sheets:{
      SABADO:[['BLOQUE 1: MOTION',null,null,'SÁBADO 14 NOV 2026'],scheduleHeaders,...entries],
      'levitate-programa (11)':[scheduleHeaders,[2,'Referencia','Academia Dos','Senior','Jazz','Solo','09:00']],
    }});
    const response=await view.request({dry_run:true});
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.routines,1);assert.equal(result.blocks,1);
    assert.ok(result.warnings.every(warning=>!warning.includes('levitate-programa (11)')));
  }
});

test('programme discipline spellings use their matching base rubrics',()=>{
  const view=harness();
  const aliases=[
    ['BELLY DANCE','BELLYDANCE'],
    ['TRAPECIO','DANZA AEREA'],
    ['OPEN: MOTION','CONTEMPORANEO'],
    ['OPEN:MOTION','CONTEMPORANEO'],
    ['OPEN:CUNA','DANZA AEREA'],
  ];
  for(const [genre,expected] of aliases)assert.equal(view.scope.exports.aliasBaseForGenre(genre),expected);
  assert.equal(view.scope.exports.aliasBaseForGenre('KPOP'),undefined);

  const bases=['BELLYDANCE','DANZA AEREA','CONTEMPORANEO'].map((genre,index)=>({
    genre,title:genre,maxScore:(index+1)*10,
    criteria:[{id:1,section:'Técnica',label:`Criterio ${genre}`,maxScore:(index+1)*10}],
  }));
  const templates=[...bases];
  const warnings=view.scope.exports.ensureTemplatesForRoutines(templates,aliases.map(([genre])=>({genre})));
  assert.equal(warnings.length,aliases.length);
  for(const [genre,baseGenre] of aliases){
    const imported=templates.find(template=>template.genre===genre);
    const base=bases.find(template=>template.genre===baseGenre);
    assert.equal(imported.maxScore,base.maxScore);
    assert.deepEqual(Array.from(imported.criteria,criterion=>({...criterion})),base.criteria);
    assert.notEqual(imported.criteria,base.criteria);
    assert.notEqual(imported.criteria[0],base.criteria[0]);
  }
  assert.throws(()=>view.scope.exports.ensureTemplatesForRoutines([...bases],[{genre:'KPOP'}]),error=>error.status===422 && /KPOP/.test(error.message));
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
