import assert from "node:assert/strict";
import test from "node:test";
import { getJudgingEvents, getJudgingScores, getJudgingSheets, getJudgingRoutineDirectory, getJudgingBlockDirectory } from "../worker/judging-reader.js";
import { projectParticipantResult } from "../worker/participant-results.js";

const eventId="f3c2e100-1234-4567-8abc-123456789abc";
const otherEventId="f3c2e100-1234-4567-8abc-987654321abc";
const thirdEventId="f3c2e100-1234-4567-8abc-000000000003";
const env={JUDGING_SUPABASE_URL:"https://judgingfixture.supabase.co",JUDGING_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic_test_key",JUDGING_LEVITATE_EVENT_IDS:eventId};
function fixture(id=eventId) {
  const row=value=>({event_id:id,...value});
  return {
    events:[{id,name:"Levitate",event_type:"event",is_active:false}],
    blocks:[row({block_id:"b1",name:"Bloque 1"}),row({block_id:"b2",name:"Bloque 2"})],
    routines:[row({routine_id:"r1",name:"Vuelo",academy:"Academia Uno",block_id:"b1",block:"Bloque 1",genre:"Aro",division:"Junior",category:"Solo",level:"Inicial"}),
      row({routine_id:"r2",name:"Otra pieza del mismo bloque",academy:"Academia Dos",block_id:"b1",block:"Bloque 1",genre:"Aro",division:"Junior",category:"Solo",level:"Inicial"}),
      row({routine_id:"r3",name:"PRIVADO DE OTRO BLOQUE",academy:"Academia Tres",block_id:"b2",block:"Bloque 2",genre:"Aro",division:"Junior",category:"Solo",level:"Inicial"})],
    judges:[row({judge_id:"j1",name:"Juez",role:"judge",access_code:"PRIVATE CODE",assigned_block_ids:[]})],
    criteria_templates:[row({template_id:"aerial",genre:"DANZA AEREA",max_score:50})],
    criteria:[row({template_id:"aerial",criterion_id:1,label:"Técnica",max_score:50})],
    scores:[row({routine_id:"r1",judge_id:"j1",criterion_id:1,value:40}),row({routine_id:"r2",judge_id:"j1",criterion_id:1,value:30}),row({routine_id:"r3",judge_id:"j1",criterion_id:1,value:50})],
    penalties:[],feedback:[],special_awards:[],
  };
}
function upstream(data,{cap=1000,ignoreScopeFor=[],rawPageFor={}}={}) {
  const calls=[];
  return {calls,fetcher:async(input,options)=>{
    const url=new URL(input),table=url.pathname.split("/").at(-1);
    calls.push({url,options});
    assert.equal(url.origin,env.JUDGING_SUPABASE_URL);assert.equal(options.method,"GET");
    assert.equal(options.redirect,"manual");assert.equal(options.body,undefined);
    assert.equal(options.headers.apikey,env.JUDGING_SUPABASE_PUBLISHABLE_KEY);
    assert.ok(options.signal instanceof AbortSignal);
    assert.doesNotMatch(url.searchParams.get("select"),/access_code|password|device_id|\*/i);
    if(Object.hasOwn(rawPageFor,table))return Response.json(rawPageFor[table]);
    let rows=data[table]||[];
    if(!ignoreScopeFor.includes(table)) {
      const selector=url.searchParams.get(table==="events"?"id":"event_id");
      if(selector?.startsWith("eq."))rows=rows.filter(row=>row[table==="events"?"id":"event_id"]===selector.slice(3));
      else if(selector?.startsWith("in.("))rows=rows.filter(row=>selector.slice(4,-1).split(",").includes(row.id));
      const routineFilter=url.searchParams.get("routine_id");
      if(routineFilter)rows=rows.filter(row=>routineFilter.slice(4,-1).split(",").includes(row.routine_id));
    }
    const offset=Number(url.searchParams.get("offset"));
    return Response.json(rows.slice(offset,offset+cap));
  }};
}

test("block publication directory returns stable membership without loading private evaluations",async()=>{
  const server=upstream(fixture());
  const result=await getJudgingBlockDirectory(env,eventId,{fetcher:server.fetcher});
  assert.deepEqual(result.blocks,[{id:"b1",name:"Bloque 1",routineIds:["r1","r2"]},{id:"b2",name:"Bloque 2",routineIds:["r3"]}]);
  assert.deepEqual(new Set(server.calls.map(({url})=>url.pathname.split('/').at(-1))),new Set(['events','blocks','routines']));
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE CODE|criteria|score|access_code|judge/i);
});

test("block publication directory rejects ambiguous, foreign and duplicate identities",async()=>{
  const duplicate=fixture();duplicate.routines.push({...duplicate.routines[0]});
  await assert.rejects(getJudgingBlockDirectory(env,eventId,{fetcher:upstream(duplicate).fetcher}),/identidades/);
  const ambiguous=fixture();ambiguous.blocks.push({...ambiguous.blocks[0],block_id:'b-other'});ambiguous.routines[0].block_id=null;
  await assert.rejects(getJudgingBlockDirectory(env,eventId,{fetcher:upstream(ambiguous).fetcher}),/bloque único/);
  const foreign=fixture();foreign.blocks[0].event_id=otherEventId;
  await assert.rejects(getJudgingBlockDirectory(env,eventId,{fetcher:upstream(foreign,{ignoreScopeFor:['blocks']}).fetcher}),/bloques/);
  await assert.rejects(getJudgingBlockDirectory(env,otherEventId,{fetcher:upstream(fixture(otherEventId)).fetcher}),/evento de Levitate/);
});

test("release snapshots carry calculation configuration but not a public closure signal",async()=>{
  const data=fixture();data.events[0].competition_config={maximumScore:150,version:'release-test'};
  const snapshot=await getJudgingSheets(env,eventId,{routineIds:['r1'],fetcher:upstream(data).fetcher});
  assert.deepEqual(snapshot.publicationContext,{competitionConfig:data.events[0].competition_config});
  assert.equal(snapshot.publicationContext.closed,undefined);
});

test("participant result reader reads full requested blocks but no evaluations from unrelated blocks",async()=>{
  const server=upstream(fixture());
  const result=await getJudgingSheets(env,eventId,{routineIds:["r1"],fetcher:server.fetcher});
  assert.deepEqual(result.rows.map(row=>row.id),["r1","r2"]);
  assert.deepEqual(result.resultScope,{complete:true,eventId,blockIds:["b1"]});
  assert.equal(projectParticipantResult({snapshot:result,routineId:"r1"}).place,1);
  assert.equal(projectParticipantResult({snapshot:result,routineId:"r1"}).eligibleCount,2);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE CODE|PRIVADO DE OTRO BLOQUE|access_code/);
  for(const {url} of server.calls) {
    const table=url.pathname.split("/").at(-1);
    if(table==="routines")assert.equal(url.searchParams.get("routine_id"),null,"membership comes from full event metadata");
    if(["scores","penalties","feedback"].includes(table))assert.equal(url.searchParams.get("routine_id"),"in.(r1,r2)");
    assert.notEqual(table,"special_awards");
  }
  assert.ok(server.calls.length<40);
});

test("unfinished peers are retained so an own-only score cannot become a false first place",async()=>{
  const data=fixture();data.scores=data.scores.filter(row=>row.routine_id!=="r2");
  const result=await getJudgingSheets(env,eventId,{routineIds:["r1"],fetcher:upstream(data).fetcher});
  assert.equal(result.rows.find(row=>row.id==="r2").status,"pending");
  const own=projectParticipantResult({snapshot:result,routineId:"r1"});
  assert.equal(own.score,40);assert.equal(own.place,null);assert.equal(own.eligibleCount,2);
});

test("multiple own presentations reuse block reads and request each complete block only once",async()=>{
  const server=upstream(fixture());
  const result=await getJudgingSheets(env,eventId,{routineIds:["r1","r2","r3","r1"],fetcher:server.fetcher});
  assert.deepEqual(result.resultScope.blockIds,["b1","b2"]);
  assert.deepEqual(result.rows.map(row=>row.id),["r1","r2","r3"]);
  const firstScoreQuery=server.calls.find(({url})=>url.pathname.endsWith("/scores"));
  assert.equal(firstScoreQuery.url.searchParams.get("routine_id"),"in.(r1,r2,r3)");
});

test("legacy labels resolve through block metadata or a stable fallback without losing competitors",async()=>{
  for(const withMetadata of [true,false]) {
    const data=fixture();data.routines=data.routines.filter(row=>row.routine_id!=="r3");
    for(const row of data.routines){row.block_id=null;row.block="Bloque aéreo 4";}
    data.blocks=withMetadata?[{event_id:eventId,block_id:"b4",name:"Bloque aéreo 4"}]:[];
    const result=await getJudgingSheets(env,eventId,{routineIds:["r1"],fetcher:upstream(data).fetcher});
    const block=withMetadata?"b4":"bloque-aereo-4";
    assert.deepEqual(result.resultScope.blockIds,[block]);
    assert.ok(result.rows.every(row=>row.blockId===block));
    assert.equal(projectParticipantResult({snapshot:result,routineId:"r1"}).eligibleCount,2);
  }
});

test("ambiguous or missing block identities and duplicate routine IDs fail before score reads",async()=>{
  for(const change of [
    data=>{data.routines[0].block_id=null;data.routines[0].block=null;},
    data=>{data.routines[0].block_id=null;data.blocks[1].name="Bloque 1";},
    data=>data.routines.push({...data.routines[0]}),
    data=>data.blocks.push({...data.blocks[0]}),
  ]) {
    const data=fixture();change(data);const server=upstream(data);
    await assert.rejects(()=>getJudgingSheets(env,eventId,{routineIds:["r1"],fetcher:server.fetcher}),error=>error.code==="judging_invalid_response");
    assert.ok(server.calls.every(({url})=>["events","routines","blocks"].some(table=>url.pathname.endsWith("/"+table))));
  }
});

test("a missing routine remains unlinked and never certifies an empty or guessed category",async()=>{
  const server=upstream(fixture());
  const missing=await getJudgingSheets(env,eventId,{routineIds:["not-imported"],fetcher:server.fetcher});
  assert.deepEqual(missing.rows,[]);assert.deepEqual(missing.resultScope,{complete:false,eventId,blockIds:[]});
  assert.ok(server.calls.every(({url})=>!url.pathname.endsWith("/scores")));
  const mixed=await getJudgingSheets(env,eventId,{routineIds:["r1","not-imported"],fetcher:upstream(fixture()).fetcher});
  assert.deepEqual(mixed.resultScope.blockIds,["b1"]);assert.equal(mixed.rows.length,2);
});

test("untrusted or foreign responses cannot enter a certified block snapshot",async()=>{
  for(const table of ["routines","blocks","scores","penalties","feedback","judges","criteria_templates","criteria"]) {
    const data=fixture();
    const sample=data[table][0]||{routine_id:"r1",judge_id:"j1",value:0};
    data[table].push({...sample,event_id:otherEventId});
    const server=upstream(data,{ignoreScopeFor:[table]});
    await assert.rejects(()=>getJudgingSheets(env,eventId,{routineIds:["r1"],fetcher:server.fetcher}),error=>error.code==="judging_invalid_response");
  }
  const server=upstream(fixture(),{ignoreScopeFor:["scores"]});
  await assert.rejects(()=>getJudgingSheets(env,eventId,{routineIds:["r1"],fetcher:server.fetcher}),error=>error.code==="judging_invalid_response");
});

test("large blocks use bounded group filters rather than one request per routine",async()=>{
  const data=fixture();data.routines=Array.from({length:250},(_,index)=>({...data.routines[0],routine_id:`f3c2e100-1234-4567-8abc-${String(index).padStart(12,"0")}`}));
  data.scores=data.routines.map(row=>({event_id:eventId,routine_id:row.routine_id,judge_id:"j1",criterion_id:1,value:40}));
  const server=upstream(data);
  const result=await getJudgingSheets(env,eventId,{routineIds:[data.routines[0].routine_id],fetcher:server.fetcher});
  assert.equal(result.rows.length,250);assert.equal(result.resultScope.complete,true);
  const queries=server.calls.filter(({url})=>url.pathname.endsWith("/scores")&&url.searchParams.get("offset")==="0");
  assert.ok(queries.length>1&&queries.length<5);
  for(const {url} of queries) {
    const filter=url.searchParams.get("routine_id");
    assert.ok(filter.slice(4,-1).split(",").length<=200);assert.ok(encodeURIComponent(filter).length<=6000);
  }
  assert.ok(server.calls.length<40);
});

test("request and aggregate row limits stop incomplete reads without asserting complete coverage",async()=>{
  const data=fixture();data.routines=Array.from({length:45},(_,index)=>({...data.routines[0],routine_id:`r${index+1}`}));
  const capped=upstream(data,{cap:1});
  await assert.rejects(()=>getJudgingSheets(env,eventId,{routineIds:["r1"],fetcher:capped.fetcher}),error=>error.code==="judging_request_limit");
  assert.ok(capped.calls.length<=40);
  const huge=Array.from({length:50000},(_,index)=>({...data.routines[0],routine_id:`r${index+1}`}));
  const oversized=upstream(fixture(),{rawPageFor:{routines:huge}});
  await assert.rejects(()=>getJudgingSheets(env,eventId,{routineIds:["r1"],fetcher:oversized.fetcher}),error=>error.code==="judging_too_many_rows");
});

test("a server-trusted binding authorizes exactly its validated event for sheets and directory",async()=>{
  const server=upstream(fixture(otherEventId));
  const sheets=await getJudgingSheets(env,otherEventId.toUpperCase(),{routineIds:["r1"],trustedEventId:otherEventId,fetcher:server.fetcher});
  assert.equal(sheets.event.id,otherEventId);assert.equal(sheets.resultScope.eventId,otherEventId);
  const directory=await getJudgingRoutineDirectory(env,otherEventId,{trustedEventId:otherEventId.toUpperCase(),fetcher:server.fetcher});
  assert.equal(directory.event.id,otherEventId);assert.equal(directory.rows.length,3);
  const noCatalogScope={...env,JUDGING_LEVITATE_EVENT_IDS:""};
  assert.equal((await getJudgingSheets(noCatalogScope,otherEventId,{routineIds:["r1"],trustedEventId:otherEventId,fetcher:upstream(fixture(otherEventId)).fetcher})).rows.length,2);
});

test("missing, invalid or nonmatching trusted IDs never broaden any other event or the legacy catalog",async()=>{
  for(const trustedEventId of [undefined,null,"",eventId,thirdEventId,`${otherEventId},${eventId}`,{id:otherEventId}]) {
    for(const operation of [
      server=>getJudgingSheets(env,otherEventId,{routineIds:["r1"],trustedEventId,fetcher:server.fetcher}),
      server=>getJudgingRoutineDirectory(env,otherEventId,{trustedEventId,fetcher:server.fetcher}),
    ]) {
      const server=upstream(fixture(otherEventId));
      await assert.rejects(()=>operation(server),error=>error.code==="judging_event_not_found");
      assert.equal(server.calls.length,0);
    }
  }
  const server=upstream(fixture(otherEventId));
  await assert.rejects(()=>getJudgingScores(env,otherEventId,{trustedEventId:otherEventId,fetcher:server.fetcher}),error=>error.code==="judging_event_not_found");
  assert.equal(server.calls.length,0);
  assert.deepEqual((await getJudgingEvents(env,{trustedEventId:otherEventId,fetcher:server.fetcher})).events,[]);
  assert.ok(server.calls.every(({url})=>url.searchParams.get("id")===`in.(${eventId})`));
});
