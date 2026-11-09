import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { readSettings, saveSettings } from "../worker/media-drive-settings.js";
import { planRegistrationSchema, prepareRegistrationSchema } from "../scripts/lib/registration-schema.mjs";

const tableName = "registration_media_drive_settings";
const baseSchema = readFileSync(new URL("../db/registration_d1_schema.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../db/registration_media_drive_settings.sql", import.meta.url), "utf8");
const createTable = /CREATE TABLE IF NOT EXISTS registration_media_drive_settings \([\s\S]*?\n\);/;
const normalizeSql = sql => sql.replace(/IF NOT EXISTS /g, "").replace(/;$/, "").replace(/\s+/g, " ").trim();

function fixture(t, { legacy = false } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(legacy ? baseSchema.replace(createTable, "") : baseSchema);
  const queries = [];
  const writes = [];
  const db = {
    prepare(sql) {
      assert.doesNotMatch(sql, /\b(?:CREATE|ALTER|DROP|DELETE|REPLACE)\b/i, "runtime helpers never migrate or delete");
      queries.push(sql);
      const statement = sqlite.prepare(sql);
      let values = [];
      return {
        bind(...nextValues) { values = nextValues; return this; },
        async first() { const row = statement.get(...values); return row ? { ...row } : null; },
      };
    },
    async read(statements) {
      return statements.map(sql => {
        assert.match(sql.trim(), /^(?:SELECT|PRAGMA table_info\()/i);
        return sqlite.prepare(sql).all();
      });
    },
    async write(statements) {
      writes.push(...statements);
      sqlite.exec("BEGIN");
      try {
        for (const sql of statements) sqlite.exec(sql);
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { sqlite, db, queries, writes };
}

function seedExistingData(sqlite) {
  sqlite.exec(`
    INSERT INTO registration_academies(id,name,contact_name,email) VALUES ('academy-1','Academia','Maestra','test@example.test');
    INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role)
      VALUES ('admin-1','academy-1','Admin','admin','admin@example.test','unchanged-password-hash','admin');
    INSERT INTO registration_participants(id,academy_id,full_name,curp,division,shirt_size)
      VALUES ('participant-1','academy-1','Participante','SYNTHETIC-CURP','adulto','m');
    INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,venue)
      VALUES ('dance-1','academy-1','Danza','motion','ballet','solo','edomex');
    INSERT INTO registration_music_uploads(id,academy_id,dance_id,file_name,content_type,file_size,data_url,
      storage_provider,drive_file_id,drive_web_view_link,uploaded_by_user_id)
      VALUES ('music-1','academy-1','dance-1','cancion.mp3','audio/mpeg',100,'','google_drive',
        'unchanged_music_file','https://drive.google.com/file/d/unchanged_music_file/view','admin-1');
    INSERT INTO registration_student_resources(id,curp,resource_type,title,url)
      VALUES ('resource-1','SYNTHETIC-CURP','media_drive','Carpeta anterior','https://drive.google.com/drive/folders/original');
    INSERT INTO registration_inscription_orders(id,curp,participant_name,academy_name,venue,reference,amount,status,line_items_json)
      VALUES ('order-1','SYNTHETIC-CURP','Participante','Academia','edomex','UNCHANGED-REF',175000,'paid','[]');
    INSERT INTO registration_event_tickets(id,source_order_type,source_order_id,ticket_code,ticket_number,ticket_label,qr_payload)
      VALUES ('ticket-1','registration','order-1','UNCHANGED-QR',1,'Single pass','LEVITATE:TICKET:UNCHANGED-QR');
  `);
}

function existingSnapshot(sqlite) {
  const tables = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name != ? ORDER BY name").all(tableName);
  return tables.map(({ name }) => ({ name, rows: sqlite.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all() }));
}

for (const mode of ["standalone", "prepare"]) {
  test(`media Drive ${mode} migration only adds empty configuration and preserves all existing records`, async t => {
    const f = fixture(t, { legacy: true });
    seedExistingData(f.sqlite);
    const before = existingSnapshot(f.sqlite);
    const schemaBefore = f.sqlite.prepare("SELECT name,sql FROM sqlite_schema ORDER BY name").all();
    const plan = await planRegistrationSchema(f.db);
    assert.equal(plan.steps.length, 1);
    assert.match(plan.steps[0].sql, /^CREATE TABLE IF NOT EXISTS registration_media_drive_settings\b/);
    assert.deepEqual(f.writes, [], "planning remains read-only");
    if (mode === "standalone") f.sqlite.exec(migration);
    else await prepareRegistrationSchema(f.db, { apply: true });
    const actual = f.sqlite.prepare("SELECT sql FROM sqlite_schema WHERE name = ?").get(tableName).sql;
    assert.equal(normalizeSql(actual), normalizeSql(baseSchema.match(createTable)[0]));
    assert.equal(normalizeSql(actual), normalizeSql(migration.match(createTable)[0]));
    assert.deepEqual(existingSnapshot(f.sqlite), before);
    for (const original of schemaBefore) {
      assert.deepEqual(f.sqlite.prepare("SELECT name,sql FROM sqlite_schema WHERE name = ?").get(original.name), original);
    }
    assert.equal(await readSettings(f.db), null, "migration never guesses or copies a music folder");
    assert.deepEqual((await planRegistrationSchema(f.db)).steps, []);
    const changesBefore = f.sqlite.prepare("SELECT total_changes() AS count").get().count;
    f.sqlite.exec(migration);
    assert.equal((await prepareRegistrationSchema(f.db, { apply: true })).applied, 0);
    assert.equal(f.sqlite.prepare("SELECT total_changes() AS count").get().count, changesBefore);
    assert.ok(f.writes.every(sql => /^CREATE\b/i.test(sql.trim())));
  });
}

test("fresh settings have an exact metadata-only schema and a real singleton key", async t => {
  const f = fixture(t);
  assert.deepEqual((await planRegistrationSchema(f.db)).steps, []);
  assert.deepEqual(f.sqlite.prepare(`PRAGMA table_info(${tableName})`).all().map(column => column.name),
    ["key", "folder_id", "folder_name", "drive_id", "updated_by", "updated_at"]);
  const insert = f.sqlite.prepare(`INSERT INTO ${tableName}(key,folder_id,folder_name) VALUES (?,?,?)`);
  for (const key of [null, "music", "photos", "photo_video_other", ""]) {
    assert.throws(() => insert.run(key, "folder_1", "Fotos y videos"), /NOT NULL|CHECK constraint/);
  }
  insert.run("photo_video", "folder_1", "Fotos y videos");
  assert.throws(() => insert.run("photo_video", "folder_2", "Otra carpeta"), /UNIQUE constraint/);
  const indexes = f.sqlite.prepare(`PRAGMA index_list(${tableName})`).all();
  assert.equal(indexes.filter(index => index.origin === "c").length, 0, "singleton reads need no extra index");
  assert.deepEqual(indexes.map(index => index.origin), ["pk"]);
  assert.equal((await readSettings(f.db)).driveId, null);
});

test("readSettings only reads the explicit metadata projection and never prepares a missing table", async t => {
  const f = fixture(t);
  assert.equal(await readSettings(f.db), null);
  assert.equal(f.queries.length, 1);
  assert.match(f.queries[0], /^SELECT key, folder_id, folder_name, drive_id, updated_by, updated_at\b/);
  const old = fixture(t, { legacy: true });
  await assert.rejects(readSettings(old.db), /no such table/);
  assert.equal(old.sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_schema WHERE name = ?").get(tableName).count, 0);
});

test("saveSettings upserts one row, returns that committed metadata, and leaves music and registrations untouched", async t => {
  const f = fixture(t);
  seedExistingData(f.sqlite);
  const before = existingSnapshot(f.sqlite);
  const first = await saveSettings(f.db, {
    folderId: " photo_video_folder-1 ", folderName: " Fotos y videos · Levitate ",
    driveId: " shared_drive_1 ", updatedBy: " admin-1 ", accessToken: "must-not-be-stored",
    refreshToken: "must-not-be-stored", privateUrl: "https://drive.google.com/private",
  });
  assert.deepEqual({ ...first, updatedAt: "timestamp" }, { key: "photo_video", folderId: "photo_video_folder-1",
    folderName: "Fotos y videos · Levitate", driveId: "shared_drive_1", updatedBy: "admin-1", updatedAt: "timestamp" });
  assert.match(first.updatedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(f.queries.length, 1, "save returns its own UPSERT result without a racing follow-up read");
  assert.match(f.queries[0], /ON CONFLICT\(key\) DO UPDATE SET/);
  assert.match(f.queries[0], /RETURNING key, folder_id, folder_name, drive_id, updated_by, updated_at/);
  assert.deepEqual(await readSettings(f.db), first);
  f.sqlite.prepare(`UPDATE ${tableName} SET updated_at = '2000-01-01 00:00:00'`).run();
  const second = await saveSettings(f.db, { folderId: "other_folder", folderName: "Nueva carpeta" });
  assert.equal(second.folderId, "other_folder");
  assert.equal(second.folderName, "Nueva carpeta");
  assert.equal(second.driveId, null);
  assert.equal(second.updatedBy, null);
  assert.notEqual(second.updatedAt, "2000-01-01 00:00:00");
  assert.equal(f.sqlite.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count, 1);
  assert.deepEqual(existingSnapshot(f.sqlite), before);
  assert.doesNotMatch(JSON.stringify(second), /must-not-be-stored|accessToken|refreshToken|privateUrl/);
});

test("settings preserve the chosen folder when the editing user is removed", async t => {
  const f = fixture(t);
  seedExistingData(f.sqlite);
  const saved = await saveSettings(f.db, { folderId: "folder_1", folderName: "Fotos", updatedBy: "admin-1" });
  const foreignKeys = f.sqlite.prepare(`PRAGMA foreign_key_list(${tableName})`).all();
  assert.equal(foreignKeys.length, 1);
  assert.equal(foreignKeys[0].table, "registration_users");
  assert.equal(foreignKeys[0].from, "updated_by");
  assert.equal(foreignKeys[0].on_delete, "SET NULL");
  f.sqlite.prepare("DELETE FROM registration_users WHERE id = 'admin-1'").run();
  assert.deepEqual(await readSettings(f.db), { ...saved, updatedBy: null });
  await assert.rejects(saveSettings(f.db, { folderId: "folder_2", folderName: "Fotos", updatedBy: "missing-user" }), /FOREIGN KEY constraint/);
  assert.deepEqual(await readSettings(f.db), { ...saved, updatedBy: null }, "failed save preserves the prior configuration");
});

test("invalid input never writes and errors never echo folder URLs or credential values", async t => {
  const f = fixture(t);
  const baseline = await saveSettings(f.db, { folderId: "folder_1", folderName: "Fotos" });
  const queryCount = f.queries.length;
  for (const invalid of [
    {}, { folderId: "" }, { folderId: " " }, { folderId: 123 },
    { folderId: "https://drive.google.com/drive/folders/private_token" },
    { folderId: "folder?secret=private_token" }, { folderName: "" }, { folderName: null },
    { folderName: "   " }, { driveId: "https://drive.google.com/private_token" }, { driveId: {} },
    { updatedBy: " " }, { updatedBy: 123 },
  ]) {
    const value = { folderId: "folder_2", folderName: "Fotos", ...invalid };
    if (!Object.keys(invalid).length) delete value.folderId;
    await assert.rejects(saveSettings(f.db, value), error => {
      assert.equal(error.code, "media_drive_settings_invalid");
      assert.equal(error.statusCode, 400);
      assert.doesNotMatch(error.message, /private_token|https:\/\/|secret/);
      return true;
    });
  }
  assert.equal(f.queries.length, queryCount, "invalid metadata must fail before querying the database");
  assert.deepEqual(await readSettings(f.db), baseline);
  const normalized = await saveSettings(f.db, { folderId: "folder_2", folderName: "Fotos", driveId: "  " });
  assert.equal(normalized.driveId, null, "a My Drive folder has no shared drive ID");
});

test("schema preflight fails closed for a partial preexisting settings table without modifying any data", async t => {
  const f = fixture(t, { legacy: true });
  seedExistingData(f.sqlite);
  f.sqlite.exec(`CREATE TABLE ${tableName}(key TEXT PRIMARY KEY, folder_id TEXT)`);
  const before = existingSnapshot(f.sqlite);
  await assert.rejects(prepareRegistrationSchema(f.db, { apply: true }), /Missing prerequisite column registration_media_drive_settings.folder_name/);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(existingSnapshot(f.sqlite), before);
});
