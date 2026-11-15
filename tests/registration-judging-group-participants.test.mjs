import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { withJudgingGroupParticipants } from '../worker/judging-group-participants.js';

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  sqlite.exec("INSERT INTO registration_academies(id,name,contact_name,email) VALUES('academy','Private academy','Private contact','fixture@example.invalid')");
  for (let i = 1; i <= 4; i++) sqlite.prepare(`INSERT INTO registration_participants(id,academy_id,full_name,curp,division,shirt_size)
    VALUES(?,'academy','PRIVATE PARTICIPANT',?,'teen','s')`).run(`p${i}`, `PRIVATE-CURP-${i}`);
  for (const edition of ['edition', 'other-edition', 'disabled-edition']) {
    sqlite.prepare("INSERT INTO participant_portal_events(id,title,season,venue) VALUES(?,?,'2026','edomex')").run(edition, edition);
    sqlite.prepare('INSERT INTO participant_portal_judging_sources(event_id,source_event_id,enabled) VALUES(?,?,?)').run(edition, 'judging-event', edition === 'disabled-edition' ? 0 : 1);
  }
  function link(id, routine, members, edition = 'edition', event = 'judging-event') {
    sqlite.prepare(`INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,venue)
      VALUES(?,'academy','Same title','motion','jazz','grupo','edomex')`).run(id);
    for (let i = 1; i <= members; i++) sqlite.prepare('INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES(?,?)').run(id, `p${i}`);
    sqlite.prepare('INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id) VALUES(?,?,?,?,?)').run(id, edition, id, event, routine);
  }
  let queries = 0;
  const DB = { prepare(sql) {
    assert.match(sql.trim(), /^SELECT/);
    const statement = sqlite.prepare(sql);
    return { bind(...args) { return { async all() { queries++; return { results: statement.all(...args) }; } }; } };
  } };
  const snapshot = { event: { id: 'judging-event' }, report: { preserved: true }, rows: [
    { id: 'r1', category: 'GRUPO', name: 'Same title', score: 123 },
    { id: 'r2', category: 'Grupo', name: 'Same title', score: 111 },
    { id: 'solo', category: 'SOLO' }, { id: 'duo', category: 'DÚO' }, { id: 'trio', category: 'TRÍO' },
  ] };
  return { sqlite, link, snapshot, env: { DB, PARTICIPANT_REGISTRATION_EVENT_IDS: 'edition' }, queries: () => queries };
}

test('exact programme IDs return real membership counts for groups, solos, duos and trios without exposing participants', async t => {
  const f = fixture(t);
  f.link('group-one', 'r1', 4); f.link('group-two', 'r2', 3);
  f.link('solo-one','solo',1);f.link('duo-one','duo',2);f.link('trio-one','trio',3);
  f.link('foreign-edition', 'r1', 2, 'other-edition');
  f.link('foreign-event', 'r1', 1, 'disabled-edition', 'foreign-event');
  const before = structuredClone(f.snapshot);
  const result = await withJudgingGroupParticipants(f.env, f.snapshot);
  assert.deepEqual(result.rows.map(r => r.participantCount), [4, 3, 1, 2, 3]);
  assert.strictEqual(result.report, f.snapshot.report);
  assert.equal(result.rows[0].score, 123);
  assert.deepEqual(f.snapshot, before);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|CURP|participant_id|dance_id/);
  assert.equal(f.queries(), 1);
});

test('missing, empty, disabled or ambiguous links stay unconfirmed for every category instead of guessing a count', async t => {
  const f = fixture(t);
  f.link('empty', 'r1', 0);
  f.link('disabled', 'r2', 4, 'disabled-edition');
  let result = await withJudgingGroupParticipants({ ...f.env, PARTICIPANT_REGISTRATION_EVENT_IDS: 'edition,disabled-edition' }, f.snapshot);
  assert.deepEqual(result.rows.map(r => r.participantCount), [null, null, null, null, null]);
  f.link('valid', 'r2', 4);
  f.link('ambiguous', 'r2', 4, 'other-edition');
  f.link('valid-duo','duo',2);f.link('ambiguous-duo','duo',2,'other-edition');
  result = await withJudgingGroupParticipants({ ...f.env, PARTICIPANT_REGISTRATION_EVENT_IDS: 'edition,other-edition' }, f.snapshot);
  assert.equal(result.rows[1].participantCount, null);
  assert.equal(result.rows[3].participantCount, null);
  f.sqlite.prepare("DELETE FROM participant_portal_routines WHERE id='valid'").run();
  result = await withJudgingGroupParticipants(f.env, f.snapshot);
  assert.equal(result.rows[1].participantCount, null);
});

test('solo, duo and trio query real membership even without any group and never infer it from the category label', async t => {
  const f = fixture(t);
  f.link('solo-one','solo',1);f.link('duo-one','duo',4);f.link('trio-one','trio',2);
  const snapshot = { ...f.snapshot, rows: f.snapshot.rows.slice(2) };
  const result=await withJudgingGroupParticipants(f.env,snapshot);
  assert.deepEqual(result.rows.map(row=>row.participantCount),[1,4,2]);
  assert.equal(f.queries(),1);
  assert.ok(snapshot.rows.every(row=>!Object.hasOwn(row,'participantCount')),'source snapshots remain unchanged');
});

test('missing DB or edition scope reports unavailable counts on every routine without issuing a query',async t=>{
  const f=fixture(t);
  f.link('group-one','r1',4);f.link('solo-one','solo',1);
  for(const env of [{},{PARTICIPANT_REGISTRATION_EVENT_IDS:'edition'},{DB:f.env.DB},
    {DB:f.env.DB,PARTICIPANT_REGISTRATION_EVENT_IDS:' , '}]) {
    const result=await withJudgingGroupParticipants(env,f.snapshot);
    assert.deepEqual(result.rows.map(row=>row.participantCount),[null,null,null,null,null]);
  }
  assert.equal(f.queries(),0);
});
