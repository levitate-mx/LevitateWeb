import assert from 'node:assert/strict';
import test from 'node:test';
import { getJudgingEvents, getJudgingScores, getJudgingSheets } from '../worker/judging-reader.js';

const eventId = 'f3c2e100-1234-4567-8abc-123456789abc';
const otherEventId = 'f3c2e100-1234-4567-8abc-987654321abc';
const env = {
  JUDGING_SUPABASE_URL: 'https://judgingfixture.supabase.co',
  JUDGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_key',
  JUDGING_LEVITATE_EVENT_IDS: eventId,
};
const allowedColumns = {
  events: 'id,name,source_name,starts_at,is_active,event_type,competition_config,created_at',
  blocks: 'event_id,block_id,name,title,sort_order,is_active',
  routines: 'event_id,routine_id,name,academy,state,genre,division,category,level,block_id,block,block_title,sort_order',
  judges: 'event_id,judge_id,name,role,sort_order,assigned_block_ids',
  criteria_templates: 'event_id,template_id,genre,title,max_score,sort_order,template_version,applies_to',
  criteria: 'event_id,template_id,criterion_id,section,label,max_score,sort_order,is_required',
  scores: 'event_id,routine_id,judge_id,criterion_id,value,updated_at',
  penalties: 'event_id,block_id,routine_id,judge_id,value,updated_at',
  feedback: 'event_id,routine_id,judge_id,body,updated_at',
  special_awards: 'event_id,block_id,award,routine_id,manual_value',
};

function event(id = eventId) {
  return { id, name: `Evento ${id}`, source_name: 'Programa', starts_at: '2026-11-13', is_active: true, event_type: 'event' };
}

function scoreData(id = eventId, value = 8) {
  return {
    events: [event(id)],
    blocks: [{ event_id: id, block_id: 'b1', name: 'Bloque 1', sort_order: 1 }],
    routines: [{ event_id: id, routine_id: 'r1', name: 'Pieza de prueba', state: 'Estado de México', genre: 'Jazz', block_id: 'b1' }],
    judges: ['Eva Carrillo', 'Daniel Montalvo', 'Jorge Díaz'].map((name, index) => ({ event_id: id, judge_id: `j${index + 1}`, name, role: 'judge', access_code: 'PRIVATE-CODE', photo: 'PRIVATE-PHOTO' })),
    criteria_templates: [{ event_id: id, template_id: 'jazz', genre: 'Jazz' }],
    criteria: [{ event_id: id, template_id: 'jazz', criterion_id: 1, label: 'Técnica', section: 'Arte', max_score: 10 }],
    scores: ['j1', 'j2', 'j3'].map(judge_id => ({ event_id: id, routine_id: 'r1', judge_id, criterion_id: 1, value })),
    penalties: [], feedback: [], special_awards: [],
  };
}

function upstream(data, { cap = 1000 } = {}) {
  const calls = [];
  return {
    calls,
    async fetcher(input, options) {
      const url = new URL(input);
      calls.push({ url, options });
      assert.equal(url.origin, env.JUDGING_SUPABASE_URL);
      assert.equal(options.method, 'GET', 'the reader must never write to JueceoCore');
      assert.equal(options.redirect, 'manual', 'credentials must not follow a redirect');
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.body, undefined);
      const table = url.pathname.split('/').at(-1);
      assert.ok(Object.hasOwn(allowedColumns, table), table);
      assert.equal(url.searchParams.get('select'), allowedColumns[table], 'read only the exact approved columns');
      assert.equal(url.searchParams.get('limit'), '1000');
      const offset = Number(url.searchParams.get('offset'));
      return Response.json((data[table] || []).slice(offset, offset + cap));
    },
  };
}

test('judging event reads use GET-only column allowlists and continue through a server cap below the requested page size', async () => {
  const ids = [eventId, otherEventId, ...[1, 2, 3].map(id => `f3c2e100-1234-4567-8abc-${String(id).padStart(12, '0')}`)];
  const data = { events: ids.map(id => event(id)) };
  const server = upstream(data, { cap: 2 });
  const result = await getJudgingEvents({ ...env, JUDGING_LEVITATE_EVENT_IDS: ids.join(',') }, server);
  assert.deepEqual(result.events.map(row => row.id), data.events.map(row => row.id));
  assert.deepEqual(server.calls.map(call => call.url.searchParams.get('offset')), ['0', '2', '4', '5']);
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
  for (const { url, options } of server.calls) {
    assert.equal(url.searchParams.get('id'), `in.(${ids.join(',')})`, 'the catalog must request only explicitly configured Levitate events');
    assert.equal(url.searchParams.get('or'), '(event_type.is.null,event_type.eq.event)');
    assert.equal(options.headers.apikey, env.JUDGING_SUPABASE_PUBLISHABLE_KEY);
    assert.equal(options.headers.authorization, undefined, 'publishable keys do not become bearer JWTs');
  }
});

test('the Levitate event catalog normalizes its explicit allowlist and excludes rogue IDs and archived event types', async () => {
  const archivedId = 'f3c2e100-1234-4567-8abc-000000000001';
  const legacyId = 'f3c2e100-1234-4567-8abc-000000000002';
  const nullTypeId = 'f3c2e100-1234-4567-8abc-000000000003';
  const ids = [eventId, otherEventId, archivedId, legacyId, nullTypeId];
  const data = { events: [event(), event(otherEventId),
    { ...event(archivedId), event_type: 'archived', name: 'Archived event' },
    { ...event(legacyId), event_type: 'legacy', name: 'Legacy event' },
    { ...event(nullTypeId), event_type: null },
    { ...event('f3c2e100-1234-4567-8abc-000000000004'), name: 'Prisma Aurora Sandbox' },
  ] };
  const server = upstream(data, { cap: 2 });
  const result = await getJudgingEvents({ ...env,
    JUDGING_LEVITATE_EVENT_IDS: ` ${eventId.toUpperCase()} , ${otherEventId}, ${eventId}, ${archivedId},${legacyId},${nullTypeId} `,
  }, server);
  assert.deepEqual(result.events.map(row => row.id), [eventId, otherEventId, nullTypeId]);
  for (const { url } of server.calls) assert.equal(url.searchParams.get('id'), `in.(${ids.join(',')})`, 'trim, lowercase and deduplicate before constructing the REST filter');
  assert.doesNotMatch(JSON.stringify(result), /Prisma|Aurora|Sandbox|Archived event|Legacy event/);
});

test('valid but unconfigured event IDs are rejected before fetch while explicitly allowed additional IDs remain readable', async () => {
  let calls = 0;
  await assert.rejects(getJudgingScores(env, otherEventId, { fetcher: async () => {
    calls += 1;
    throw new Error('unconfigured event must never be fetched');
  } }), error => error.code === 'judging_event_not_found' && error.statusCode === 404);
  assert.equal(calls, 0);
  const server = upstream(scoreData(otherEventId));
  const result = await getJudgingScores({ ...env, JUDGING_LEVITATE_EVENT_IDS: `${eventId},${otherEventId}` },
    otherEventId.toUpperCase(), server);
  assert.equal(result.event.id, otherEventId);
  assert.equal(result.rows[0].judges[0].total, 8);
  for (const { url } of server.calls) {
    const table = url.pathname.split('/').at(-1);
    assert.equal(url.searchParams.get(table === 'events' ? 'id' : 'event_id'), `eq.${otherEventId}`);
  }
});

test('missing or malformed Levitate event scope fails closed instead of exposing the unfiltered catalog', async () => {
  for (const value of [undefined, null, '', '   ', ',,', 'invalid-id', `${eventId},invalid-id`,
    `${eventId}&id=not.is.null`, `in.(${eventId})`]) {
    const scopedEnv = { ...env, JUDGING_LEVITATE_EVENT_IDS: value };
    let calls = 0;
    const fetcher = async () => { calls += 1; throw new Error('invalid scope must never fetch'); };
    for (const operation of [() => getJudgingEvents(scopedEnv, { fetcher }), () => getJudgingScores(scopedEnv, eventId, { fetcher })]) {
      await assert.rejects(operation(), error => error.code === 'judging_not_configured' && error.statusCode === 503);
    }
    assert.equal(calls, 0);
  }
});

test('judging score reads are isolated to one validated event and never expose judge credentials or photos', async () => {
  const data = scoreData();
  const foreign = scoreData(otherEventId, 1);
  for (const table of Object.keys(data).filter(table => table !== 'events')) data[table].push(...foreign[table]);
  const server = upstream(data, { cap: 1 });
  const result = await getJudgingScores(env, eventId, server);
  assert.equal(result.event.id, eventId);
  assert.equal(result.rows.length, 1, 'foreign event routines are excluded even if an upstream response includes them');
  assert.equal(result.rows[0].judges[0].total, 8, 'identically keyed scores from another event cannot enter the selected event');
  assert.equal(result.rows[0].judges.length, 3);
  for (const { url } of server.calls) {
    const table = url.pathname.split('/').at(-1);
    assert.equal(url.searchParams.get(table === 'events' ? 'id' : 'event_id'), `eq.${eventId}`);
    assert.doesNotMatch(url.searchParams.get('select'), /access_code|photo|password|token|\*/i);
  }
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-CODE|PRIVATE-PHOTO|access_code|photo|sb_publishable_|supabase\.co/);
});

test('the block report reads state and assigned awards without exposing device metadata or another event', async () => {
  const data = scoreData();
  data.events[0].competition_config = { special_awards: [{ category: 'award_1', title: 'Vestuario', is_enabled: true }] };
  data.special_awards = [
    { event_id: eventId, block_id: 'b1', award: 'award_1', routine_id: 'r1', manual_value: 'Vestuario destacado', device_id: 'PRIVATE-DEVICE' },
    { event_id: otherEventId, block_id: 'b1', award: 'award_1', routine_id: 'r1', manual_value: 'FOREIGN-AWARD' },
  ];
  const server = upstream(data);
  const result = await getJudgingScores(env, eventId, server);
  assert.equal(result.rows[0].state, 'Estado de México');
  assert.equal(result.report.blocks[0].specialAwards[0].displayValue, 'Vestuario destacado');
  assert.equal(result.report.blocks[0].sections[0].categories[0].rows[0].score, 120);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-DEVICE|device_id|FOREIGN-AWARD/);
  assert.ok(server.calls.some(({ url }) => url.pathname.endsWith('/special_awards')));
});

test('invalid event IDs cannot inject a REST filter or trigger an upstream request', async () => {
  for (const value of [undefined, null, '', 'not-a-uuid', `${eventId}&event_id=neq.${eventId}`, `${eventId},id.not.is.null`, `${eventId}/scores`]) {
    let calls = 0;
    await assert.rejects(getJudgingScores(env, value, { fetcher: async () => { calls += 1; throw new Error('must not fetch'); } }),
      error => error.code === 'judging_invalid_event' && error.statusCode === 400);
    assert.equal(calls, 0);
  }
});

test('a missing or ambiguous event remains an explicit not-found error rather than a fake empty score set', async () => {
  for (const events of [[], [event(otherEventId)], [event(), event()],
    [{ ...event(), event_type: 'archived' }], [{ ...event(), event_type: 'legacy' }]]) {
    const server = upstream({ events });
    await assert.rejects(getJudgingScores(env, eventId, server),
      error => error.code === 'judging_event_not_found' && error.statusCode === 404);
    assert.ok(server.calls.every(call => call.url.pathname.endsWith('/events')));
  }
});

test('configuration rejects service-role and secret credentials before contacting an upstream service', async () => {
  const jwt = role => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.fixture-signature`;
  const invalidEnvs = [
    {}, { ...env, JUDGING_SUPABASE_PUBLISHABLE_KEY: '' },
    { ...env, JUDGING_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_MUST-NEVER-LEAK' },
    { ...env, JUDGING_SUPABASE_PUBLISHABLE_KEY: jwt('service_role') },
    { ...env, JUDGING_SUPABASE_PUBLISHABLE_KEY: jwt('authenticated') },
    { ...env, JUDGING_SUPABASE_PUBLISHABLE_KEY: 'not.valid.jwt' },
    ...['http://judgingfixture.supabase.co', 'https://attacker.test',
      'https://user:PRIVATE-PASSWORD@judgingfixture.supabase.co', 'https://judgingfixture.supabase.co/private',
      'https://judgingfixture.supabase.co?PRIVATE-QUERY=1'].map(url => ({ ...env, JUDGING_SUPABASE_URL: url })),
  ];
  let calls = 0;
  for (const config of invalidEnvs) {
    await assert.rejects(getJudgingEvents(config, { fetcher: async () => { calls += 1; throw new Error('must not fetch'); } }), error => {
      assert.equal(error.code, 'judging_not_configured');
      assert.equal(error.statusCode, 503);
      assert.doesNotMatch(error.message, /MUST-NEVER-LEAK|PRIVATE-|supabase\.co|sb_secret_|service_role/);
      return true;
    });
  }
  assert.equal(calls, 0);
  const anonKey = jwt('anon');
  const callsWithAnon = [];
  await getJudgingEvents({ ...env, JUDGING_SUPABASE_PUBLISHABLE_KEY: anonKey }, { fetcher: async (_url, options) => {
    callsWithAnon.push(options);
    return Response.json([]);
  } });
  assert.equal(callsWithAnon[0].headers.authorization, `Bearer ${anonKey}`, 'legacy anon compatibility retains its low-privilege role');
});

test('upstream connection failures, denied reads and malformed responses are explicit and never reveal private details', async () => {
  const secretDetail = `PRIVATE-UPSTREAM ${env.JUDGING_SUPABASE_URL} ${env.JUDGING_SUPABASE_PUBLISHABLE_KEY}`;
  for (const fetcher of [
    async () => { throw new Error(secretDetail); },
    async () => new Response(secretDetail, { status: 403 }),
    async () => new Response(secretDetail, { status: 503 }),
    async () => new Response(secretDetail),
    async () => Response.json({ error: secretDetail }),
    async () => Response.json([null]),
  ]) {
    await assert.rejects(getJudgingEvents(env, { fetcher }), error => {
      assert.ok(['judging_unavailable', 'judging_invalid_response'].includes(error.code));
      assert.ok([502, 503].includes(error.statusCode));
      assert.doesNotMatch(error.message, /PRIVATE-UPSTREAM|supabase\.co|sb_publishable_/);
      return true;
    });
  }
  const server = upstream(scoreData());
  await assert.rejects(getJudgingScores(env, eventId, { fetcher: async (url, options) => {
    if (new URL(url).pathname.endsWith('/scores')) return new Response(secretDetail, { status: 503 });
    return server.fetcher(url, options);
  } }), error => error.code === 'judging_unavailable', 'one failed score table must reject the whole snapshot');
});

test('an upstream redirect is rejected after one GET without forwarding credentials to its destination', async () => {
  const calls = [];
  await assert.rejects(getJudgingEvents(env, { fetcher: async (url, options) => {
    calls.push({ url, options });
    return new Response(null, { status: 302, headers: { location: 'https://redirect-destination.test/private' } });
  } }), error => error.code === 'judging_unavailable' && error.statusCode === 503);
  assert.equal(calls.length, 1, 'the reader must not issue a second request to a redirect destination');
  assert.equal(new URL(calls[0].url).origin, env.JUDGING_SUPABASE_URL);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.redirect, 'manual', 'Cloudflare fetch must return the redirect without following it');
});

test('judging pagination has a finite safety limit and refuses to present truncated data as complete', async () => {
  let calls = 0;
  await assert.rejects(getJudgingEvents(env, { fetcher: async (_url, options) => {
    assert.equal(options.method, 'GET');
    calls += 1;
    assert.ok(calls <= 51, 'pagination must be bounded');
    return Response.json(Array.from({ length: 1000 }, (_, index) => event(`${calls}-${index}`)));
  } }), error => error.code === 'judging_too_many_rows' && error.statusCode === 503);
  assert.equal(calls, 51);
});

test('participant sheets fetch only requested routine evaluations instead of the whole event',async()=>{
  const server=upstream(scoreData());
  const result=await getJudgingSheets(env,eventId,{routineIds:['r1'],fetcher:server.fetcher});
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].id,'r1');assert.equal(result.rows[0].status,'complete');
  assert.equal(result.rows[0].judges[0].criteria[0].value,8);
  for(const {url} of server.calls){
    const table=url.pathname.split('/').at(-1);
    assert.notEqual(table,'special_awards','participant sheets do not need unrelated special awards');
    if(['scores','penalties','feedback'].includes(table)){
      assert.equal(url.searchParams.get('routine_id'),'in.(r1)');
      assert.equal(url.searchParams.get('event_id'),`eq.${eventId}`);
    }
  }
});

test('admin score reads apply the confirmed area roster while participant sheets retain the native expected judges', async () => {
  const data = scoreData();
  for (const [index, name] of ['Daniel Herrera', 'Renata Pinal', 'Ana Karen Rojas'].entries()) {
    const judge_id = `aerial-${index}`;
    data.judges.push({ event_id: eventId, judge_id, name, role: 'judge' });
    data.scores.push({ event_id: eventId, routine_id: 'r1', judge_id, criterion_id: 1, value: 1 });
  }
  const adminResult = await getJudgingScores(env, eventId, upstream(data));
  assert.deepEqual(adminResult.rows[0].judges.map(judge => judge.name), ['Eva Carrillo', 'Daniel Montalvo', 'Jorge Díaz']);
  assert.equal(adminResult.rows[0].expectedJudges, 3);
  assert.equal(adminResult.rows[0].completedJudges, 3);
  const sheets = upstream(data);
  const participantResult = await getJudgingSheets(env, eventId, { routineIds: ['r1'], fetcher: sheets.fetcher });
  assert.equal(participantResult.rows[0].judges.length, 6);
  assert.equal(participantResult.rows[0].expectedJudges, 6);
});

test('sheet routine filters are bounded and cannot inject another PostgREST scope',async()=>{
  for(const routineIds of [[],Array(51).fill('r1'),['r1,r2'],['r1)'],['a b'],['"r1"'],['../r1'],[null]]){
    const server=upstream(scoreData());
    await assert.rejects(()=>getJudgingSheets(env,eventId,{routineIds,fetcher:server.fetcher}),error=>error.code==='judging_invalid_routine');
    assert.equal(server.calls.length,0);
  }
});

test('sheet reader rejects foreign routine or event rows even if upstream ignores its filter',async()=>{
  for(const table of ['routines','scores','penalties','feedback']){
    for(const mismatch of [{routine_id:'r2',event_id:eventId},{routine_id:'r1',event_id:otherEventId}]){
      if(table==='routines'&&mismatch.event_id===eventId) continue; // Full metadata can contain peers; absent own ID stays unlinked.
      const data=scoreData(); data[table]=[{...(data[table][0]||{}),...mismatch}];
      const server=upstream(data);
      await assert.rejects(()=>getJudgingSheets(env,eventId,{routineIds:['r1'],fetcher:server.fetcher}),error=>error.code==='judging_invalid_response');
    }
  }
});
