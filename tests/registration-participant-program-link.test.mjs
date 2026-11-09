import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { issueParticipantProgramLink, completeParticipantProgramLink } from "../worker/participant-program-link.js";

const sourceId = "25cf168b-4bf1-423f-b2c2-42897d3f8110";
const otherSourceId = "11111111-2222-4333-8444-555555555555";
const eventId = "edomex-test-edition";
const schema = await readFile(new URL("../db/registration_d1_schema.sql", import.meta.url), "utf8");
const portalSchema = await readFile(new URL("../db/registration_participant_portal.sql", import.meta.url), "utf8");
const hash = async value => Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("hex");

class D1 {
  constructor() { this.sqlite = new DatabaseSync(":memory:"); this.queries = []; this.parameterCounts = []; this.failBatchAt = null; }
  prepare(sql) {
    this.queries.push(sql);
    assert.doesNotMatch(sql, /^\s*(CREATE|DROP|ALTER|PRAGMA)\b/i, "HTTP workflows must not alter the schema");
    const statement = this.sqlite.prepare(sql); let args = [];
    const owner = this;
    const query = {
      bind(...values) { assert.ok(values.length <= 100, `D1 parameter limit: ${values.length}`); owner.parameterCounts.push(values.length); args = values; return query; },
      async all() { return { results: statement.all(...args).map(row => ({ ...row })) }; },
      async first() { const row = statement.get(...args); return row ? { ...row } : null; },
      sync() { const result = statement.run(...args); return { success: true, meta: { changes: result.changes } }; },
      async run() { return query.sync(); },
    };
    return query;
  }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const [index, statement] of statements.entries()) {
        if (index === this.failBatchAt) throw new Error("Simulated atomic database failure");
        results.push(statement.sync());
      }
      this.sqlite.exec("COMMIT"); return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}

async function fixture(t, count = 3) {
  const db = new D1(); t.after(() => db.sqlite.close()); db.sqlite.exec(schema); db.sqlite.exec(portalSchema);
  db.sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES('academy-one','Academia Uno','Responsable','academy@example.test');
    INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,email_confirmed_at)
      VALUES('admin-one','academy-one','Administrador','admin','admin@example.test','unused-test-hash','admin',datetime('now'));
    INSERT INTO registration_participants(id,academy_id,full_name,curp,division,shirt_size)
      VALUES('person-one','academy-one','Participante Uno','PRIVATE-TEST-IDENTITY','junior','s');
    INSERT INTO participant_portal_events(id,title,season,venue,starts_at,published)
      VALUES('${eventId}','Levitate Prueba','Otoño 2026','edomex','2026-11-13',0),('puebla-test-edition','Puebla Prueba','Otoño 2026','puebla','2026-12-01',0);
    INSERT INTO participant_portal_access(id,participant_id,event_id,token_hash,active)
      VALUES('qr-existing','person-one','${eventId}','existing-private-qr-hash',1);`);
  const insert = db.sqlite.prepare("INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,level,venue) VALUES(?,'academy-one',?,'aereo','tela','solo','intermedio',?)");
  const dances = Array.from({ length: count }, (_, index) => ({ id: `dance-${String(index + 1).padStart(3, "0")}`, title: `Coreografía ${index + 1}`, venue: "edomex" }));
  for (const dance of dances) insert.run(dance.id, dance.title, dance.venue);
  insert.run("puebla-dance", "Puebla Coreografía", "puebla");
  db.sqlite.prepare("INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES(?,'person-one')").run(dances[0].id);
  db.sqlite.prepare(`INSERT INTO registration_music_uploads(id,academy_id,dance_id,file_name,content_type,file_size,data_url,storage_provider,drive_file_id)
    VALUES('music-existing','academy-one',?,'song.mp3','audio/mpeg',10,'','google_drive','unchanged-private-drive-file')`).run(dances[0].id);
  const env = { PARTICIPANT_REGISTRATION_EVENT_IDS: `${eventId},puebla-test-edition` };
  const links = ids => (ids || dances.map(dance => dance.id)).map((danceId, index) => ({ danceId, sourceRoutineId: String(index + 1) }));
  const issue = (ids, options = {}) => issueParticipantProgramLink({ db, env, input: { links: links(ids) }, actorId: "admin-one", ...options });
  const directory = (issued, id = sourceId) => ({ event: { id }, rows: issued.links.map(link => ({
    id: link.sourceRoutineId, name: dances.find(dance => dance.id === link.danceId).title, academy: "Academia Uno",
  })) });
  const calls = [];
  const complete = (issued, input = {}, provider) => completeParticipantProgramLink({ db, env,
    input: { token: issued.token, registrationEventId: issued.registrationEventId, sourceEventId: sourceId, routines: issued.links, ...input },
    getJudgingDirectory: async (...args) => { calls.push(args); return provider ? provider(...args) : directory(issued); },
  });
  const rows = table => db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(row => ({ ...row }));
  return { db, env, dances, links, issue, directory, complete, calls, rows };
}

test("programme export persists only a capability hash and preserves existing QR, music and participants", async t => {
  const f = await fixture(t), protectedBefore = [f.rows("participant_portal_access"), f.rows("registration_music_uploads"), f.rows("registration_participants")];
  const issued = await f.issue();
  assert.equal(issued.registrationEventId, eventId); assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(issued.links.map(link => link.sourceRoutineId), ["1", "2", "3"]);
  const saved = f.rows("participant_portal_program_exports")[0];
  assert.equal(saved.token_hash, await hash(issued.token)); assert.notEqual(saved.token_hash, issued.token);
  assert.doesNotMatch(JSON.stringify(saved), new RegExp(issued.token));
  assert.equal(JSON.parse(saved.manifest_json).length, 3);
  const expiry = f.db.sqlite.prepare("SELECT CAST(julianday(expires_at)-julianday(created_at) AS INTEGER) AS days FROM participant_portal_program_exports").get();
  assert.equal(expiry.days, 14);
  assert.deepEqual([f.rows("participant_portal_access"), f.rows("registration_music_uploads"), f.rows("registration_participants")], protectedBefore);
});

test("routine identities remain stable across reordered and partial programme exports", async t => {
  const f = await fixture(t), first = await f.issue(["dance-001", "dance-002"]);
  const reordered = await f.issue(["dance-002", "dance-001"]);
  assert.deepEqual(reordered.links, [first.links[1], first.links[0]]);
  const extended = await f.issue(["dance-003", "dance-001"]);
  assert.deepEqual(extended.links, [{ danceId: "dance-003", sourceRoutineId: "3" }, first.links[0]]);
  assert.equal(f.rows("participant_portal_program_links").length, 3);
  assert.notEqual(first.token, reordered.token); assert.notEqual(reordered.token, extended.token);
});

test("concurrent partial exports either keep exact stable IDs or fail safely and succeed on retry", async t => {
  const f = await fixture(t);
  const results = await Promise.allSettled([f.issue(["dance-001", "dance-002"]), f.issue(["dance-002", "dance-003"])]);
  assert.ok(results.some(result => result.status === "fulfilled"));
  const exported = [];
  for (const result of results) {
    if (result.status === "rejected") { assert.equal(result.reason.code, "portal_program_link_conflict"); continue; }
    exported.push(result.value);
    for (const link of result.value.links) {
      assert.equal(f.rows("participant_portal_program_links").find(row => row.dance_id === link.danceId).source_routine_id, link.sourceRoutineId);
    }
  }
  const final = await f.issue();
  assert.equal(new Set(final.links.map(link => link.sourceRoutineId)).size, 3);
  for (const issued of exported) for (const link of issued.links) assert.deepEqual(final.links.find(row => row.danceId === link.danceId), link);
});

test("issuance rejects duplicate, foreign, mixed-venue and ambiguous edition programmes without mutations", async t => {
  const f = await fixture(t);
  const invalid = [[], [{ danceId: "dance-001", sourceRoutineId: "01" }], f.links(["dance-001", "dance-001"]),
    f.links(["not-present"]), f.links(["dance-001", "puebla-dance"]), Array.from({ length: 601 }, (_, index) => ({ danceId: `dance-${index}`, sourceRoutineId: String(index + 1) }))];
  for (const links of invalid) await assert.rejects(() => f.issue(null, { input: { links } }));
  assert.equal(f.rows("participant_portal_program_links").length, 0); assert.equal(f.rows("participant_portal_program_exports").length, 0);
  f.db.sqlite.exec(`INSERT INTO participant_portal_events(id,title,season,venue) VALUES('other-edomex','Otra edición','Otra','edomex')`);
  await assert.rejects(() => f.issue(null, { env: { PARTICIPANT_REGISTRATION_EVENT_IDS: `${eventId},other-edomex` } }), error => error.code === "portal_program_edition_ambiguous");
  await assert.rejects(() => f.issue(null, { env: { PARTICIPANT_REGISTRATION_EVENT_IDS: "" } }), error => error.code === "portal_program_edition_ambiguous");
  assert.equal(f.rows("participant_portal_program_exports").length, 0);
});

test("invalid or expired capabilities fail before participant data or remote source reads", async t => {
  const f = await fixture(t), issued = await f.issue();
  for (const token of ["invalid", "A".repeat(43), undefined]) {
    f.db.queries.length = 0;
    await assert.rejects(() => f.complete(issued, { token }), error => error.code === "portal_program_access_invalid" && error.statusCode === 401);
    assert.ok(f.db.queries.every(sql => sql.includes("participant_portal_program_exports")));
  }
  f.db.sqlite.prepare("UPDATE participant_portal_program_exports SET expires_at=datetime('now','-1 second')").run();
  f.db.queries.length = 0;
  await assert.rejects(() => f.complete(issued), error => error.statusCode === 401);
  assert.ok(f.db.queries.every(sql => sql.includes("participant_portal_program_exports")));
  assert.equal(f.calls.length, 0); assert.equal(f.rows("participant_portal_routines").length, 0);
});

test("valid capability cannot select another edition, invalid source ID or a changed manifest", async t => {
  const f = await fixture(t), issued = await f.issue();
  for (const input of [
    { registrationEventId: "puebla-test-edition" }, { sourceEventId: "not-a-source" },
    { routines: issued.links.slice(1) }, { routines: [{ ...issued.links[0], sourceRoutineId: "99" }, ...issued.links.slice(1)] },
  ]) await assert.rejects(() => f.complete(issued, input));
  assert.equal(f.calls.length, 0); assert.equal(f.rows("participant_portal_judging_sources").length, 0);
  assert.equal(f.rows("participant_portal_routines").length, 0); assert.equal(f.rows("participant_portal_program_exports")[0].source_event_id, null);
});

test("complete association verifies the exact source roster and preserves result and photo drafts", async t => {
  const f = await fixture(t);
  f.db.sqlite.prepare(`INSERT INTO participant_portal_routines(id,event_id,dance_id,result_json,judging_json,photos_published,status,revision)
    VALUES('existing-routine',?,'dance-001','{"score":123}','{"judges":["approved"]}',1,'draft',7)`).run(eventId);
  const before = f.rows("participant_portal_routines")[0], protectedBefore = [f.rows("participant_portal_access"), f.rows("registration_music_uploads")];
  const issued = await f.issue(), result = await f.complete(issued);
  assert.deepEqual(result, { ok: true, linked: 3 }); assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0], [sourceId, { trustedEventId: sourceId }]);
  const bound = f.rows("participant_portal_routines"), existing = bound.find(row => row.id === "existing-routine");
  for (const key of ["id", "result_json", "judging_json", "photos_published", "status", "revision"]) assert.equal(existing[key], before[key]);
  assert.equal(existing.source_routine_id, "1"); assert.equal(bound.length, 3);
  assert.equal(f.rows("participant_portal_judging_sources")[0].enabled, 1);
  assert.equal(f.rows("participant_portal_program_exports")[0].source_event_id, sourceId);
  const routineIds = bound.map(row => row.id);
  await f.complete(issued);
  assert.deepEqual(f.rows("participant_portal_routines").map(row => row.id), routineIds, "same-source retries are idempotent");
  assert.deepEqual([f.rows("participant_portal_access"), f.rows("registration_music_uploads")], protectedBefore);
  await assert.rejects(() => f.complete(issued, { sourceEventId: otherSourceId }), error => error.code === "portal_program_link_conflict");
  assert.equal(f.calls.length, 2, "another source is rejected before remote access");
});

test("foreign, duplicated, incomplete or relabelled source rows cannot claim a programme", async t => {
  const f = await fixture(t), issued = await f.issue();
  for (const alter of [
    directory => ({ ...directory, event: { id: otherSourceId } }),
    directory => ({ ...directory, rows: directory.rows.slice(1) }),
    directory => ({ ...directory, rows: [...directory.rows, { id: "999", name: "Otra", academy: "Otra" }] }),
    directory => ({ ...directory, rows: [directory.rows[0], directory.rows[0], directory.rows[2]] }),
    directory => ({ ...directory, rows: [{ ...directory.rows[0], name: "Otra coreografía" }, ...directory.rows.slice(1)] }),
    directory => ({ ...directory, rows: [{ ...directory.rows[0], academy: "Otra academia" }, ...directory.rows.slice(1)] }),
  ]) {
    await assert.rejects(() => f.complete(issued, {}, () => alter(f.directory(issued))), error => error.code === "portal_program_link_mismatch");
    assert.equal(f.rows("participant_portal_program_exports")[0].source_event_id, null);
    assert.equal(f.rows("participant_portal_routines").length, 0); assert.equal(f.rows("participant_portal_judging_sources").length, 0);
  }
});

test("existing source conflicts are rejected before reading or replacing any remote programme", async t => {
  const f = await fixture(t), issued = await f.issue();
  f.db.sqlite.prepare("INSERT INTO participant_portal_judging_sources(event_id,source_event_id,enabled) VALUES(?,?,1)").run(eventId, otherSourceId);
  await assert.rejects(() => f.complete(issued), error => error.code === "portal_program_link_conflict");
  assert.equal(f.calls.length, 0); assert.equal(f.rows("participant_portal_program_exports")[0].source_event_id, null);
  assert.equal(f.rows("participant_portal_judging_sources")[0].source_event_id, otherSourceId);
});

test("large programme associations stay inside D1 bind limits without losing any routines", async t => {
  const f = await fixture(t, 70), issued = await f.issue();
  await f.complete(issued);
  assert.equal(f.rows("participant_portal_program_links").length, 70); assert.equal(f.rows("participant_portal_routines").length, 70);
  assert.ok(f.db.parameterCounts.every(count => count <= 100));
  assert.equal(new Set(f.rows("participant_portal_routines").map(row => row.source_routine_id)).size, 70);
});

test("a failed atomic callback batch leaves its capability unclaimed and existing records intact", async t => {
  const f = await fixture(t), issued = await f.issue(); f.db.failBatchAt = 2;
  await assert.rejects(() => f.complete(issued), error => error.code === "portal_program_link_conflict" && error.statusCode === 409 && !/Simulated atomic/.test(error.message));
  assert.equal(f.rows("participant_portal_program_exports")[0].source_event_id, null);
  assert.equal(f.rows("participant_portal_judging_sources").length, 0); assert.equal(f.rows("participant_portal_routines").length, 0);
  f.db.failBatchAt = null; assert.equal((await f.complete(issued)).linked, 3);
});

test("same-source callback replay cannot re-enable an administrator-disabled connection", async t => {
  const f = await fixture(t), issued = await f.issue(); await f.complete(issued);
  f.db.sqlite.prepare("UPDATE participant_portal_judging_sources SET enabled=0 WHERE event_id=?").run(eventId);
  await f.complete(issued);
  assert.equal(f.rows("participant_portal_judging_sources")[0].enabled, 0);
});

test("a routine changed during source verification prevents the entire association without overwrites", async t => {
  const f = await fixture(t), issued = await f.issue();
  await assert.rejects(() => f.complete(issued, {}, () => {
    f.db.sqlite.prepare("INSERT INTO participant_portal_routines(id,event_id,dance_id,source_event_id,source_routine_id) VALUES('racing-routine',?,'dance-001',?,'999')").run(eventId, otherSourceId);
    return f.directory(issued);
  }), error => error.code === "portal_program_link_conflict");
  const routines = f.rows("participant_portal_routines");
  assert.equal(routines.length, 1); assert.equal(routines[0].source_event_id, otherSourceId); assert.equal(routines[0].source_routine_id, "999");
  assert.equal(f.rows("participant_portal_program_exports")[0].source_event_id, null);
  assert.equal(f.rows("participant_portal_judging_sources").length, 0);
});

test("concurrent exports cannot claim different source events for the same edition", async t => {
  const f = await fixture(t), first = await f.issue(), second = await f.issue();
  let releaseFirst, releaseSecond, arrived = 0, bothArrived;
  const ready = new Promise(resolve => { bothArrived = resolve; });
  const sourceOne = f.complete(first, {}, async () => { arrived++; if (arrived === 2) bothArrived(); return new Promise(resolve => { releaseFirst = () => resolve(f.directory(first)); }); });
  const sourceTwo = f.complete(second, { sourceEventId: otherSourceId }, async () => { arrived++; if (arrived === 2) bothArrived(); return new Promise(resolve => { releaseSecond = () => resolve(f.directory(second, otherSourceId)); }); });
  await ready; releaseFirst(); await sourceOne; releaseSecond();
  await assert.rejects(() => sourceTwo, error => error.code === "portal_program_link_conflict");
  assert.equal(f.rows("participant_portal_judging_sources")[0].source_event_id, sourceId);
  assert.ok(f.rows("participant_portal_routines").every(row => row.source_event_id === sourceId));
  const secondHash = await hash(second.token);
  const secondRecord = f.rows("participant_portal_program_exports").find(row => row.token_hash === secondHash);
  assert.equal(secondRecord.source_event_id, null, "the losing import does not consume its file capability");
});

test('exhausted routine numbering fails before persisting an invalid future export',async t=>{
  const f=await fixture(t);
  f.db.sqlite.prepare('INSERT INTO participant_portal_program_links(event_id,dance_id,source_routine_id) VALUES(?,?,?)').run(eventId,'dance-001','999999999');
  await assert.rejects(()=>f.issue(['dance-002']),error=>error.code==='portal_program_link_conflict'&&error.statusCode===409);
  assert.equal(f.rows('participant_portal_program_exports').length,0);
  assert.equal(f.rows('participant_portal_program_links').length,1);
});
