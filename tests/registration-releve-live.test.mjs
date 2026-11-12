import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../worker/index.js';
import { relevePollId } from '../worker/releve-voting.js';

const origin = 'https://levitate.mx', publicPath = '/api/releve-voting', adminPath = '/api/registration/admin/releve-voting';
const sha = value => createHash('sha256').update(value).digest('hex');
function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES ('a','Private academy','Contact','contact@example.invalid');
    INSERT INTO participant_portal_events(id,title,venue,season,starts_at) VALUES ('edomex-2026-otono','Levitate fixture','edomex','2026','2026-11-14');`);
  const cookies = {};
  for (const [name,role,judge,judgingAdmin] of [['admin','admin',0,0],['judging','academy',0,1],['academy','academy',0,0],['judge','academy',1,0]]) {
    sqlite.prepare(`INSERT INTO registration_users(id,academy_id,name,username,email,role,password_hash,is_judge,is_judging_admin,email_confirmed_at) VALUES (?,'a',?,?,?,?,?,?,?,datetime('now'))`).run(name,name,name,name+'@example.invalid',role,'fixture-only-unused-hash',judge,judgingAdmin);
    const token='fixture-session-'+name;
    sqlite.prepare("INSERT INTO registration_sessions(id,user_id,session_token_hash,expires_at) VALUES (?,?,?,datetime('now','+1 day'))").run(name,name,sha(token));
    cookies[name]='levitate_registration_session='+token;
  }
  const queries=[];
  const db={prepare(sql){const s=sqlite.prepare(sql);let values=[];const bound={bind(...v){values=v;return bound;},async first(){queries.push(sql);return s.get(...values)||null;},async all(){queries.push(sql);return {results:s.all(...values)};},async run(){queries.push(sql);return {success:true,meta:s.run(...values)};}};return bound;},async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
  const env={DB:db};
  async function request(path=publicPath,{method='GET',body,cookie,requestOrigin=origin,headers={}}={}) {
    return worker.fetch(new Request(origin+path,{method,headers:{...(cookie?{cookie}:{}),...(method==='POST'?{'content-type':'application/json',...(requestOrigin?{origin:requestOrigin}:{})}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}),env,{});
  }
  const call=async(path,options)=>{const response=await request(path,options);return {response,data:await response.json()};};
  const admin=(body,cookie=cookies.judging)=>call(adminPath,{method:'POST',body,cookie});
  const open=async()=>{const {data}=await call(adminPath,{cookie:cookies.judging});const result=await admin({action:'open',revision:data.poll.revision,confirmation:'ABRIR'});assert.equal(result.response.status,200,JSON.stringify(result.data));return result.data;};
  const connect=async(fingerprint='a'.repeat(32),cookie)=>{const result=await call(publicPath+'/session',{method:'POST',body:{fingerprint},cookie});return {...result,cookie:result.response.headers.get('set-cookie')?.split(';')[0]||cookie};};
  const vote=(cookie,candidateId='estrella-mistica')=>call(publicPath+'/vote',{method:'POST',cookie,body:{candidateId}});
  return {sqlite,queries,env,cookies,request,call,admin,open,connect,vote};
}

test('a fresh installation stays closed, exposes only the five approved candidates and records no votes',async t=>{
  const f=fixture(t), result=await f.call();
  assert.equal(result.response.status,200);assert.equal(result.data.poll.status,'closed');assert.equal(result.data.poll.voterMode,'device');
  assert.equal(result.data.candidates.length,5);assert.equal(result.data.voter.hasVoted,false);
  assert.doesNotMatch(JSON.stringify(result.data),/totalVotes|juryScore|bonus|tiePolicy|token_hash|voter_hash|curp|source_order|accessId/);
  assert.equal((await f.vote('', 'mariana')).response.status,409);
  assert.equal((await f.connect()).response.status,409);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM releve_voting_ballots').get().n,0);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM releve_voting_polls').get().n,0);
});

test('only real global or judging administrators may read counts, open and close the poll',async t=>{
  const f=fixture(t);
  for(const cookie of ['',f.cookies.academy,f.cookies.judge]){
    for(const [method,body] of [['GET',undefined],['POST',{action:'open',revision:0,confirmation:'ABRIR'}]]){
      const r=await f.call(adminPath,{method,body,cookie});assert.ok([401,403].includes(r.response.status));assert.equal(r.data.totalVotes,undefined);
    }
  }
  const before=await f.call(adminPath,{cookie:f.cookies.admin});assert.equal(before.data.totalVotes,0);
  assert.equal((await f.admin({action:'open',revision:0})).response.status,400);
  const opened=await f.open();assert.equal(opened.poll.status,'open');
  const closed=await f.admin({action:'close',revision:opened.poll.revision},f.cookies.admin);assert.equal(closed.data.poll.status,'closed');
  const audit=f.sqlite.prepare('SELECT actor_id,previous_status,next_status FROM releve_voting_audit ORDER BY revision').all();
  assert.deepEqual(audit.map(r=>({...r})),[{actor_id:'judging',previous_status:'closed',next_status:'open'},{actor_id:'admin',previous_status:'open',next_status:'closed'}]);
});

test('voting persists across reload, resubmission and a new private session with the same fingerprint',async t=>{
  const f=fixture(t);await f.open();const session=await f.connect();assert.equal(session.response.status,200);
  assert.match(session.response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  const first=await f.vote(session.cookie);assert.equal(first.data.voter.hasVoted,true);assert.equal(first.data.voter.candidateId,'estrella-mistica');
  const reload=await f.call(publicPath,{cookie:session.cookie});assert.equal(reload.data.voter.hasVoted,true);
  // Lost reply: repeat the same request, then try a different choice. First ballot wins.
  assert.equal((await f.vote(session.cookie)).response.status,200);
  assert.equal((await f.vote(session.cookie,'hazel')).data.voter.candidateId,'estrella-mistica');
  const privateSession=await f.connect();assert.equal(privateSession.data.voter.hasVoted,true);assert.equal(privateSession.data.voter.candidateId,null,'another session may not read the earlier private choice');
  assert.equal((await f.vote(privateSession.cookie,'hazel')).data.voter.hasVoted,true);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM releve_voting_ballots').get().n,1);
  const totals=await f.call(adminPath,{cookie:f.cookies.judging});assert.equal(totals.data.totalVotes,1);assert.equal(totals.data.candidates.find(c=>c.id==='estrella-mistica').votes,1);
});

test('same-cookie fingerprint changes cannot replace identity; distinct devices sharing an IP can vote',async t=>{
  const f=fixture(t);await f.open();const a=await f.connect();await f.vote(a.cookie);
  const modified=await f.connect('b'.repeat(32),a.cookie);assert.equal(modified.data.voter.hasVoted,true);
  const b=await f.connect('b'.repeat(32));assert.equal(b.data.voter.hasVoted,false);await f.vote(b.cookie,'mariana');
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM releve_voting_ballots').get().n,2);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM releve_voting_ballots WHERE candidate_id='mariana'").get().n,1,'a missing photo never excludes a confirmed candidate');
});

test('concurrent submissions create one immutable ballot and closure is enforced in the insert itself',async t=>{
  const f=fixture(t);await f.open();const s=await f.connect();
  await Promise.all([f.vote(s.cookie),f.vote(s.cookie,'hazel')]);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM releve_voting_ballots').get().n,1);
  const other=await f.connect('c'.repeat(32));
  const original=f.env.DB.prepare.bind(f.env.DB);let closed=false;
  f.env.DB.prepare=sql=>{if(sql.startsWith('INSERT INTO releve_voting_ballots')&&!closed){closed=true;f.sqlite.prepare("UPDATE releve_voting_polls SET status='closed',revision=revision+1").run();}return original(sql);};
  assert.equal((await f.vote(other.cookie)).response.status,409);assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM releve_voting_ballots').get().n,1);
});

test('close and reopen preserve all votes, reject stale admin revisions and never provide a reset operation',async t=>{
  const f=fixture(t), opened=await f.open(), s=await f.connect();await f.vote(s.cookie);
  const closed=await f.admin({action:'close',revision:opened.poll.revision});
  assert.equal((await f.admin({action:'open',revision:opened.poll.revision,confirmation:'ABRIR'})).response.status,409);
  assert.equal((await f.admin({action:'reset',revision:closed.data.poll.revision})).response.status,400);
  await f.open();const newer=await f.connect();assert.equal(newer.data.voter.hasVoted,true);
  assert.equal((await f.call(adminPath,{cookie:f.cookies.judging})).data.totalVotes,1);
});

test('expired or invented sessions, invalid candidates and cross-origin submissions cannot record votes',async t=>{
  const f=fixture(t);await f.open();const s=await f.connect();
  for(const requestOrigin of [null,'https://other.example'])assert.equal((await f.call(publicPath+'/vote',{method:'POST',cookie:s.cookie,requestOrigin,body:{candidateId:'hazel'}})).response.status,403);
  assert.equal((await f.vote(s.cookie,'foreign-candidate')).response.status,400);
  assert.equal((await f.vote('levitate_releve_voter='+'z'.repeat(43))).response.status,401);
  f.sqlite.prepare("UPDATE releve_voting_sessions SET expires_at=datetime('now','-1 minute')").run();
  assert.equal((await f.vote(s.cookie)).response.status,401);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM releve_voting_ballots').get().n,0);
  assert.equal((await f.call(publicPath+'/session',{method:'POST',body:{fingerprint:'bad'}})).response.status,400);
  assert.equal((await f.request(publicPath+'/vote')).status,405);
  assert.equal((await f.call(publicPath+'/vote',{method:'POST',body:'x'.repeat(2050)})).response.status,413);
});

test('rate limits return a retry delay and public responses do not leak storage errors or results',async t=>{
  const f=fixture(t);await f.open();await f.connect();f.sqlite.prepare('UPDATE releve_voting_rate_limits SET attempts=1201').run();
  const limited=await f.connect('b'.repeat(32));assert.equal(limited.response.status,429);assert.equal(limited.response.headers.get('retry-after'),'60');
  const status=await f.call();assert.equal(status.response.headers.get('cache-control'),'private, no-store');assert.equal(status.data.totalVotes,undefined);
  const failed=await worker.fetch(new Request(origin+publicPath),{DB:{prepare(){throw new Error('PRIVATE DATABASE DETAILS');}}},{});
  assert.equal(failed.status,500);assert.doesNotMatch(await failed.text(),/PRIVATE DATABASE DETAILS/);
});

test('manual close connects the fixed bonus; reopening or a public tie withholds it without changing ballots', async t => {
  const f = fixture(t), opened = await f.open(), first = await f.connect();
  await f.vote(first.cookie, 'hazel');
  let state = await f.call(adminPath, { cookie: f.cookies.judging });
  assert.equal(state.data.result.status, 'open'); assert.ok(state.data.result.candidates.every(row => row.bonus === 0));
  const closed = await f.admin({ action: 'close', revision: opened.poll.revision });
  assert.equal(closed.data.result.ready, true);
  assert.equal(closed.data.result.candidates.find(row => row.id === 'hazel').bonus, 5);
  const reopened = await f.open();
  state = await f.call(adminPath, { cookie: f.cookies.judging });
  assert.equal(state.data.result.ready, false); assert.ok(state.data.result.candidates.every(row => row.bonus === 0));
  const second = await f.connect('d'.repeat(32)); await f.vote(second.cookie, 'mariana');
  const tied = await f.admin({ action: 'close', revision: reopened.poll.revision });
  assert.equal(tied.data.result.status, 'tie_pending'); assert.equal(tied.data.result.ready, false);
  assert.ok(tied.data.result.candidates.every(row => row.bonus === 0));
  assert.equal(tied.data.totalVotes, 2);
  const publicly = await f.call();
  assert.equal(publicly.data.result, undefined); assert.equal(publicly.data.totalVotes, undefined);
  assert.ok(publicly.data.candidates.every(row => row.votes === undefined && row.bonus === undefined));
});
