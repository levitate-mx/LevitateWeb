import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  getAcademyJudgingSheets,
  handleAcademyJudgingSheets,
} from "../worker/academy-judging-sheets.js";

class D1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.bindCounts = [];
  }
  prepare(sql) {
    const statement = this.sqlite.prepare(sql);
    let args = [];
    const query = {
      bind: (...values) => {
        args = values;
        this.bindCounts.push(values.length);
        return query;
      },
      first: async () => statement.get(...args) || null,
      all: async () => ({ results: statement.all(...args) }),
    };
    return query;
  }
}

const judge = (overrides = {}) => ({
  id: "judge-1",
  name: "Jueza Uno",
  status: "complete",
  subtotal: 12,
  penalty: 0,
  total: 12,
  maximumScore: 15,
  feedback: "Retroalimentación propia",
  criteria: [
    {
      id: 1,
      section: "Técnica",
      label: "Control",
      value: 12,
      maximumScore: 15,
    },
  ],
  ...overrides,
});
const sourceRoutine = (id = "source-own", overrides = {}) => ({
  id,
  name: id === "source-own" ? "Vuelo propio" : "Rutina ajena privada",
  academy: id === "source-own" ? "Academia Uno" : "Academia Ajena",
  genre: "Tela",
  category: "Solo",
  division: "Petite",
  level: "Intermedio",
  blockName: "Bloque 4A",
  expectedJudges: 1,
  completedJudges: 1,
  recordedScores: 1,
  status: "complete",
  judges: [judge(id === "source-own" ? {} : { feedback: "SECRETO AJENO" })],
  ...overrides,
});

function fixture(t) {
  const db = new D1();
  t.after(() => db.sqlite.close());
  db.sqlite.exec(`
    CREATE TABLE registration_dances(
      id TEXT PRIMARY KEY, academy_id TEXT NOT NULL, title TEXT NOT NULL,
      program_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE participant_portal_events(
      id TEXT PRIMARY KEY, title TEXT NOT NULL, season TEXT, starts_at TEXT,
      published INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE participant_portal_routines(
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL, dance_id TEXT NOT NULL,
      source_event_id TEXT, source_routine_id TEXT, status TEXT,
      publication_blocked INTEGER NOT NULL DEFAULT 0, updated_at TEXT
    );
    CREATE TABLE participant_portal_judging_sources(
      event_id TEXT PRIMARY KEY, source_event_id TEXT, enabled INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE registration_judging_sheet_releases(
      source_event_id TEXT NOT NULL, block_id TEXT NOT NULL,
      manifest_json TEXT, released_at TEXT
    );
  `);
  const dance = db.sqlite.prepare(
    "INSERT INTO registration_dances(id,academy_id,title,program_json) VALUES(?,?,?,?)",
  );
  dance.run(
    "dance-own",
    "academy-one",
    "Vuelo propio",
    JSON.stringify({ eventId: "edition-one" }),
  );
  dance.run(
    "dance-foreign",
    "academy-two",
    "Rutina ajena privada",
    JSON.stringify({ eventId: "edition-one" }),
  );
  db.sqlite
    .prepare(
      "INSERT INTO participant_portal_events(id,title,season,starts_at,published) VALUES(?,?,?,?,1)",
    )
    .run("edition-one", "Levitate Otoño", "Otoño", "2026-11-15");
  db.sqlite
    .prepare(
      "INSERT INTO participant_portal_judging_sources(event_id,source_event_id,enabled) VALUES(?,?,1)",
    )
    .run("edition-one", "core-event");
  const routine = db.sqlite.prepare(
    `INSERT INTO participant_portal_routines
      (id,event_id,dance_id,source_event_id,source_routine_id,status,publication_blocked,updated_at)
      VALUES(?,'edition-one',?,'core-event',?,'draft',0,'2026-11-15')`,
  );
  routine.run("portal-own", "dance-own", "source-own");
  routine.run("portal-foreign", "dance-foreign", "source-foreign");
  const fingerprint = "a".repeat(64);
  db.sqlite
    .prepare(
      `INSERT INTO registration_judging_sheet_releases(source_event_id,block_id,manifest_json,released_at)
       VALUES('core-event','block-4a',?,'2026-11-15')`,
    )
    .run(
      JSON.stringify({
        version: 1,
        routineIds: ["source-own", "source-foreign"],
        sheets: [
          { routineId: "source-own", judgeId: "judge-1", fingerprint },
          { routineId: "source-foreign", judgeId: "judge-1", fingerprint },
        ],
      }),
    );
  return db;
}

const snapshotFor = (routineIds, sourceEventId = "core-event") => ({
  event: { id: sourceEventId, name: "Levitate Otoño" },
  rows: routineIds.map((id) => sourceRoutine(id)),
});

test("academy list returns release summaries without criteria, feedback or foreign dances", async (t) => {
  const db = fixture(t);
  const result = await getAcademyJudgingSheets({
    db,
    academyId: "academy-one",
    getJudgingSnapshot: async (eventId, options) => {
      assert.equal(eventId, "core-event");
      assert.deepEqual(options, {
        routineIds: ["source-own"],
        trustedEventId: "core-event",
      });
      return snapshotFor(options.routineIds);
    },
    getReleasedJudgeIds: async () => ["judge-1"],
  });
  assert.deepEqual(result, {
    sheets: [
      {
        danceId: "dance-own",
        title: "Vuelo propio",
        eventId: "edition-one",
        eventTitle: "Levitate Otoño",
        status: "available",
        judgeCount: 1,
      },
    ],
  });
  assert.doesNotMatch(JSON.stringify(result), /criteria|feedback|SECRETO|source-own|source-foreign/);
});

test("a stale release manifest never marks a corrected sheet available in the list", async (t) => {
  const db = fixture(t);
  const result = await getAcademyJudgingSheets({
    db,
    academyId: "academy-one",
    getJudgingSnapshot: async (_eventId, options) => snapshotFor(options.routineIds),
    getReleasedJudgeIds: async () => [],
  });
  assert.equal(result.sheets[0].status, "pending");
  assert.equal(result.sheets[0].judgeCount, 0);
  assert.equal(result.sheets[0].judging, undefined);
});

test("a release withdrawn during list projection is removed before the response", async (t) => {
  const db = fixture(t);
  let releaseReads = 0;
  const result = await getAcademyJudgingSheets({
    db,
    academyId: "academy-one",
    getJudgingSnapshot: async (_eventId, options) => snapshotFor(options.routineIds),
    getReleasedJudgeIds: async () => (++releaseReads === 1 ? ["judge-1"] : []),
  });
  assert.equal(releaseReads, 2);
  assert.equal(result.sheets[0].status, "pending");
  assert.equal(result.sheets[0].judgeCount, 0);
});

test("detail revalidates exact ownership and returns only the released own PDF descriptor", async (t) => {
  const db = fixture(t);
  let reads = 0;
  const result = await getAcademyJudgingSheets({
    db,
    academyId: "academy-one",
    danceId: "dance-own",
    getJudgingSnapshot: async (eventId, options) => {
      reads += 1;
      assert.equal(eventId, "core-event");
      assert.deepEqual(options, {
        routineIds: ["source-own"],
        trustedEventId: "core-event",
      });
      return {
        event: { id: "core-event", name: "Levitate Otoño" },
        rows: [sourceRoutine(), sourceRoutine("source-foreign")],
      };
    },
    getReleasedJudgeIds: async ({ sourceEventId, sourceRoutineId }) => {
      assert.equal(sourceEventId, "core-event");
      assert.equal(sourceRoutineId, "source-own");
      return ["judge-1"];
    },
  });
  assert.equal(reads, 1);
  assert.equal(result.sheet.status, "available");
  assert.equal(result.sheet.danceId, "dance-own");
  assert.equal(result.sheet.judgeCount, 1);
  assert.equal(result.sheet.judging.pdf.routine.id, "source-own");
  assert.equal(result.sheet.judging.pdf.judges[0].feedback, "Retroalimentación propia");
  assert.doesNotMatch(JSON.stringify(result), /SECRETO AJENO|source-foreign|Academia Ajena/);
});

test("a release withdrawn during detail projection never returns a PDF", async (t) => {
  const db = fixture(t);
  let releaseReads = 0;
  const result = await getAcademyJudgingSheets({
    db,
    academyId: "academy-one",
    danceId: "dance-own",
    getJudgingSnapshot: async (_eventId, options) => snapshotFor(options.routineIds),
    getReleasedJudgeIds: async () => (++releaseReads === 1 ? ["judge-1"] : []),
  });
  assert.equal(releaseReads, 2);
  assert.equal(result.sheet.status, "pending");
  assert.equal(result.sheet.judgeCount, 0);
  assert.equal(result.sheet.judging, undefined);
});

test("foreign dance identifiers fail before any upstream read", async (t) => {
  const db = fixture(t);
  let reads = 0;
  await assert.rejects(
    getAcademyJudgingSheets({
      db,
      academyId: "academy-one",
      danceId: "dance-foreign",
      getJudgingSnapshot: async () => {
        reads += 1;
      },
    }),
    (error) =>
      error.code === "registration_academy_judging_not_found" &&
      error.statusCode === 404,
  );
  assert.equal(reads, 0);
});

test("hidden, disabled, blocked and edition-mismatched records remain pending without upstream access", async (t) => {
  const db = fixture(t);
  for (const [apply, restore] of [
    [
      "UPDATE participant_portal_events SET published=0",
      "UPDATE participant_portal_events SET published=1",
    ],
    [
      "UPDATE participant_portal_judging_sources SET enabled=0",
      "UPDATE participant_portal_judging_sources SET enabled=1",
    ],
    [
      "UPDATE participant_portal_routines SET publication_blocked=1 WHERE id='portal-own'",
      "UPDATE participant_portal_routines SET publication_blocked=0 WHERE id='portal-own'",
    ],
    [
      `UPDATE registration_dances SET program_json='{"eventId":"another-edition"}' WHERE id='dance-own'`,
      `UPDATE registration_dances SET program_json='{"eventId":"edition-one"}' WHERE id='dance-own'`,
    ],
  ]) {
    db.sqlite.exec(apply);
    let reads = 0;
    const result = await getAcademyJudgingSheets({
      db,
      academyId: "academy-one",
      danceId: "dance-own",
      getJudgingSnapshot: async () => {
        reads += 1;
      },
    });
    assert.equal(result.sheet.status, "pending");
    assert.equal(reads, 0);
    db.sqlite.exec(restore);
  }
});

test("upstream errors and ownership changes during a read fail closed", async (t) => {
  const db = fixture(t);
  const unavailable = await getAcademyJudgingSheets({
    db,
    academyId: "academy-one",
    danceId: "dance-own",
    getJudgingSnapshot: async () => {
      throw new Error("PRIVATE UPSTREAM CREDENTIAL");
    },
    getReleasedJudgeIds: async () => ["judge-1"],
  });
  assert.equal(unavailable.sheet.status, "unavailable");
  assert.doesNotMatch(JSON.stringify(unavailable), /PRIVATE|CREDENTIAL/);

  const raced = await getAcademyJudgingSheets({
    db,
    academyId: "academy-one",
    danceId: "dance-own",
    getJudgingSnapshot: async () => {
      db.sqlite
        .prepare("UPDATE registration_dances SET academy_id='academy-two' WHERE id='dance-own'")
        .run();
      return {
        event: { id: "core-event", name: "Levitate" },
        rows: [sourceRoutine()],
      };
    },
    getReleasedJudgeIds: async () => ["judge-1"],
  });
  assert.equal(raced.sheet.status, "unavailable");
  assert.equal(raced.sheet.judging, undefined);
});

test("fresh release validation is chunked to at most fifty routines per source read", async (t) => {
  const db = fixture(t);
  const insertDance = db.sqlite.prepare(
    "INSERT INTO registration_dances(id,academy_id,title,program_json) VALUES(?,'academy-one',?,?)",
  );
  const insertEvent = db.sqlite.prepare(
    "INSERT INTO participant_portal_events(id,title,published) VALUES(?,?,1)",
  );
  const insertSource = db.sqlite.prepare(
    "INSERT INTO participant_portal_judging_sources(event_id,source_event_id,enabled) VALUES(?,?,1)",
  );
  const insertRoutine = db.sqlite.prepare(
    `INSERT INTO participant_portal_routines
      (id,event_id,dance_id,source_event_id,source_routine_id,status,publication_blocked)
      VALUES(?,?,?,?,?,'draft',0)`,
  );
  for (let index = 0; index < 51; index += 1) {
    const danceId = `chunk-dance-${index}`;
    const editionId = `chunk-edition-${index}`;
    const sourceId = "chunk-source";
    insertDance.run(
      danceId,
      `Rutina ${index}`,
      JSON.stringify({ eventId: editionId }),
    );
    insertEvent.run(editionId, `Edición ${index}`);
    insertSource.run(editionId, sourceId);
    insertRoutine.run(
      `chunk-portal-${index}`,
      editionId,
      danceId,
      sourceId,
      `chunk-routine-${index}`,
    );
  }
  const batches = [];
  const result = await getAcademyJudgingSheets({
    db,
    academyId: "academy-one",
    getJudgingSnapshot: async (eventId, options) => {
      batches.push({ eventId, ids: options.routineIds });
      return snapshotFor(options.routineIds, eventId);
    },
    getReleasedJudgeIds: async () => ["judge-1"],
  });
  assert.equal(result.sheets.length, 52);
  assert.ok(batches.every((batch) => batch.ids.length <= 50));
  assert.deepEqual(batches.filter((batch) => batch.eventId === "chunk-source").map((batch) => batch.ids.length), [50, 1]);
});

test("HTTP wrapper is GET-only and applies private response headers", async (t) => {
  const db = fixture(t);
  const response = await handleAcademyJudgingSheets(
    new Request("https://levitate.mx/api/registration/judging-sheets"),
    { db, academyId: "academy-one" },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.equal((await response.json()).sheets.length, 1);
  await assert.rejects(
    handleAcademyJudgingSheets(
      new Request("https://levitate.mx/api/registration/judging-sheets", {
        method: "POST",
      }),
      { db, academyId: "academy-one" },
    ),
    (error) => error.statusCode === 405,
  );
});
