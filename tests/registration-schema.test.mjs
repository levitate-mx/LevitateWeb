import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { planRegistrationSchema, prepareRegistrationSchema } from "../scripts/lib/registration-schema.mjs";
import { main } from "../scripts/prepare-registration-db.mjs";

const baseSchema = readFileSync(new URL("../db/registration_d1_schema.sql", import.meta.url), "utf8");
const removableColumns = {
  registration_academies: ["origin_type", "origin_state", "origin_country"],
  registration_users: ["role"],
  registration_participants: ["is_international", "is_releve_teacher"],
  registration_choreographers: ["is_releve_teacher"],
  registration_dances: ["subgenre_detail"],
  registration_inscription_orders: ["buyer_phone_country_code", "buyer_phone_number", "buyer_phone"],
  registration_shop_orders: ["access_token", "buyer_name", "buyer_email"],
  registration_music_uploads: ["storage_provider", "drive_file_id", "drive_web_view_link", "drive_web_content_link"],
};

function removeColumns(schema, table, columns) {
  return schema.replace(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`), (statement) => {
    for (const column of columns) statement = statement.replace(new RegExp(`^  ${column} .+\\n`, "m"), "");
    return statement;
  });
}

function legacySchema({ venue = false } = {}) {
  let schema = baseSchema;
  for (const [table, columns] of Object.entries(removableColumns)) schema = removeColumns(schema, table, columns);
  schema = schema.replace(/^CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_shop_orders_access_token.*\n/m, "");
  if (venue) schema = schema.replace("CREATE TABLE IF NOT EXISTS registration_academies (", "CREATE TABLE IF NOT EXISTS registration_academies (\n  venue TEXT NOT NULL DEFAULT 'cdmx',");
  return schema;
}

function fixture(t, schema = baseSchema) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(schema);
  const writes = [];
  const db = {
    async read(statements) {
      return statements.map((sql) => {
        assert.match(sql.trim(), /^(?:SELECT|PRAGMA table_info\()/i, "inspection must be read-only");
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
  return { sqlite, db, writes };
}

function seed(sqlite) {
  sqlite.exec(`
    INSERT INTO registration_academies(id, name, contact_name, email, phone) VALUES ('academy-1', 'Academy', 'Teacher', 'teacher@example.test', '123456');
    INSERT INTO registration_users(id, academy_id, name, username, email, password_hash) VALUES ('user-1', 'academy-1', 'Teacher', 'teacher', 'teacher@example.test', 'original-password-hash');
    INSERT INTO registration_participants(id, academy_id, full_name, curp, division, shirt_size) VALUES ('participant-1', 'academy-1', 'Dancer', 'TEST-CURP', 'adulto', 'm');
    INSERT INTO registration_choreographers(id, academy_id, full_name) VALUES ('teacher-1', 'academy-1', 'Teacher');
    INSERT INTO registration_dances(id, academy_id, title, genre, subgenre, category, venue) VALUES ('dance-1', 'academy-1', 'Dance', 'motion', 'ballet', 'solo', 'cdmx');
    INSERT INTO registration_inscription_orders(id, curp, participant_name, academy_id, academy_name, venue, reference, access_token, amount, paid_amount, status)
      VALUES ('order-1', 'TEST-CURP', 'Dancer', 'academy-1', 'Academy', 'cdmx', 'REF-1', 'inscription-token-original', 12500, 12500, 'paid');
  `);
}

function shopOrder(sqlite, id, token) {
  const columns = sqlite.prepare("PRAGMA table_info(registration_shop_orders)").all();
  const hasToken = columns.some((column) => column.name === "access_token");
  sqlite.prepare(`INSERT INTO registration_shop_orders (id, curp, participant_name, academy_id, academy_name, venue, reference, amount, paid_amount, status${hasToken ? ", access_token" : ""})
    VALUES (?, 'TEST-CURP', 'Dancer', 'academy-1', 'Academy', 'cdmx', ?, 8000, 8000, 'paid'${hasToken ? ", ?" : ""})`)
    .run(...[id, `SHOP-${id}`, ...(hasToken ? [token ?? null] : [])]);
}

function rows(sqlite, table) {
  return sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all().map((row) => ({ ...row }));
}

test("fresh canonical schema is already prepared and rechecking does not write", async (t) => {
  const { db, sqlite, writes } = fixture(t);
  const result = await prepareRegistrationSchema(db, { apply: true });
  assert.equal(result.applied, 0);
  assert.deepEqual(result.steps, []);
  assert.deepEqual(writes, []);
  seed(sqlite);
  assert.equal(sqlite.prepare("SELECT role FROM registration_users").get().role, "academy");
});

test("deployed inscription schema without an unused access_token column remains compatible", async (t) => {
  const { db, sqlite, writes } = fixture(t, removeColumns(baseSchema, "registration_inscription_orders", ["access_token"]));
  assert.deepEqual((await prepareRegistrationSchema(db, { apply: true })).steps, []);
  assert.deepEqual(writes, []);
  assert.equal(sqlite.prepare("PRAGMA table_info(registration_inscription_orders)").all().some((row) => row.name === "access_token"), false);
});

for (const venue of [false, true]) {
  test(`legacy schema preserves rows and ${venue ? "retains" : "does not add"} academy venue`, async (t) => {
    const { db, sqlite, writes } = fixture(t, legacySchema({ venue }));
    seed(sqlite);
    shopOrder(sqlite, "shop-1");
    sqlite.exec(`
      INSERT INTO registration_music_uploads(id, academy_id, dance_id, file_name, content_type, file_size, data_url, uploaded_by_user_id)
        VALUES ('music-1', 'academy-1', 'dance-1', 'dance.mp3', 'audio/mpeg', 10, 'data:audio/mpeg;base64,original', 'user-1');
      INSERT INTO registration_shop_payment_proofs(id, order_id, file_name, content_type, file_size, data_url)
        VALUES ('proof-1', 'shop-1', 'proof.pdf', 'application/pdf', 10, 'data:application/pdf;base64,original');
    `);
    const before = new Map(Object.keys(removableColumns).map((table) => [table, rows(sqlite, table)]));
    const proofBefore = rows(sqlite, "registration_shop_payment_proofs");
    const plan = await planRegistrationSchema(db);
    assert.ok(plan.steps.length > 10);
    assert.equal(plan.legacyAcademyVenue, venue);
    assert.ok(plan.steps.every((step) => !/DROP|DELETE|REPLACE|RENAME/i.test(step.sql)));
    assert.deepEqual(writes, []);

    const result = await prepareRegistrationSchema(db, { apply: true });
    assert.equal(result.steps.length, 0);
    for (const [table, originalRows] of before) {
      const migratedRows = rows(sqlite, table);
      assert.equal(migratedRows.length, originalRows.length);
      for (const [index, original] of originalRows.entries()) {
        for (const [column, value] of Object.entries(original)) assert.deepEqual(migratedRows[index][column], value, `${table}.${column}`);
      }
    }
    assert.deepEqual(rows(sqlite, "registration_shop_payment_proofs"), proofBefore);
    const academy = rows(sqlite, "registration_academies")[0];
    assert.equal(academy.origin_type, "mexico");
    assert.equal(academy.origin_country, "México");
    assert.equal(Object.hasOwn(academy, "venue"), venue);
    assert.equal(rows(sqlite, "registration_users")[0].role, "academy");
    assert.equal(rows(sqlite, "registration_music_uploads")[0].storage_provider, "d1");
    assert.equal(rows(sqlite, "registration_participants")[0].is_international, 0);
    assert.match(rows(sqlite, "registration_shop_orders")[0].access_token, /^[0-9a-f]{32}$/);
    assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
    const writeCount = writes.length;
    const token = rows(sqlite, "registration_shop_orders")[0].access_token;
    await prepareRegistrationSchema(db, { apply: true });
    assert.equal(writes.length, writeCount, "second execution should not write");
    assert.equal(rows(sqlite, "registration_shop_orders")[0].access_token, token);
  });
}

test("missing optional runtime tables are created without altering prerequisite rows", async (t) => {
  const { db, sqlite } = fixture(t);
  seed(sqlite);
  sqlite.exec("DROP TABLE registration_shop_payment_proofs; DROP TABLE registration_shop_orders; DROP TABLE registration_inscription_payment_proofs; DROP TABLE registration_music_uploads;");
  const before = rows(sqlite, "registration_inscription_orders");
  const plan = await planRegistrationSchema(db);
  assert.equal(plan.steps.filter((step) => step.sql.startsWith("CREATE TABLE")).length, 4);
  await prepareRegistrationSchema(db, { apply: true });
  assert.deepEqual(rows(sqlite, "registration_inscription_orders"), before);
  shopOrder(sqlite, "new-order", "token");
  assert.throws(() => sqlite.exec("INSERT INTO registration_shop_payment_proofs(id, order_id, file_name, content_type, file_size, data_url) VALUES ('invalid', 'new-order', 'x.pdf', 'application/pdf', 1800001, 'data')"), /CHECK constraint/);
  assert.deepEqual((await planRegistrationSchema(db)).steps, []);
});

test("check is read-only; preparation preserves admin roles and nonempty tokens", async (t) => {
  const { db, sqlite, writes } = fixture(t);
  seed(sqlite);
  sqlite.exec("UPDATE registration_users SET role = 'admin'; UPDATE registration_academies SET origin_type = 'international', origin_country = 'Argentina';");
  shopOrder(sqlite, "existing", "do-not-rotate-this-token");
  shopOrder(sqlite, "null-token", null);
  shopOrder(sqlite, "empty-token", "");
  const before = rows(sqlite, "registration_shop_orders");
  const check = await prepareRegistrationSchema(db);
  assert.equal(check.steps.length, 1);
  assert.deepEqual(writes, []);
  assert.deepEqual(rows(sqlite, "registration_shop_orders"), before);
  await prepareRegistrationSchema(db, { apply: true });
  assert.equal(sqlite.prepare("SELECT access_token FROM registration_shop_orders WHERE id = 'existing'").get().access_token, "do-not-rotate-this-token");
  const generated = sqlite.prepare("SELECT access_token FROM registration_shop_orders WHERE id <> 'existing'").all().map((row) => row.access_token);
  assert.ok(generated.every((token) => /^[0-9a-f]{32}$/.test(token)));
  assert.equal(new Set(generated).size, 2);
  assert.equal(rows(sqlite, "registration_users")[0].role, "admin");
  assert.equal(rows(sqlite, "registration_academies")[0].origin_country, "Argentina");
  assert.equal(rows(sqlite, "registration_inscription_orders")[0].access_token, "inscription-token-original");
});

test("duplicate nonempty tokens fail before any schema or data change", async (t) => {
  let schema = baseSchema.replaceAll("access_token TEXT UNIQUE", "access_token TEXT");
  schema = schema.replace(/^CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_shop_orders_access_token.*\n/m, "");
  schema = removeColumns(schema, "registration_academies", ["origin_type", "origin_state", "origin_country"]);
  const { db, sqlite, writes } = fixture(t, schema);
  seed(sqlite);
  shopOrder(sqlite, "duplicate-1", "same-existing-token");
  shopOrder(sqlite, "duplicate-2", "same-existing-token");
  const before = rows(sqlite, "registration_shop_orders");
  await assert.rejects(prepareRegistrationSchema(db, { apply: true }), /duplicate nonempty shop access tokens/);
  assert.deepEqual(writes, []);
  assert.deepEqual(rows(sqlite, "registration_shop_orders"), before);
  assert.equal(sqlite.prepare("PRAGMA table_info(registration_academies)").all().some((row) => row.name === "origin_type"), false);
});

test("missing prerequisites fail before making any additions", async (t) => {
  const empty = fixture(t, "");
  await assert.rejects(prepareRegistrationSchema(empty.db, { apply: true }), /Missing prerequisite table registration_academies/);
  assert.deepEqual(empty.writes, []);
  const partial = fixture(t, removeColumns(legacySchema(), "registration_users", ["password_hash"]));
  await assert.rejects(prepareRegistrationSchema(partial.db, { apply: true }), /Missing prerequisite column registration_users.password_hash/);
  assert.deepEqual(partial.writes, []);
});

test("preparation can resume safely after an interrupted partial migration", async (t) => {
  const { db, sqlite } = fixture(t, legacySchema());
  seed(sqlite);
  shopOrder(sqlite, "shop-1");
  const initial = await planRegistrationSchema(db);
  await db.write(initial.steps.slice(0, 3).map((step) => step.sql));
  const remaining = await planRegistrationSchema(db);
  assert.equal(remaining.steps.length, initial.steps.length - 3);
  await prepareRegistrationSchema(db, { apply: true });
  assert.deepEqual((await planRegistrationSchema(db)).steps, []);
  assert.equal(rows(sqlite, "registration_shop_orders")[0].status, "paid");
});

test("CLI requires explicit target and mode before invoking any database", async () => {
  for (const args of [[], ["--apply"], ["--remote"], ["--local", "--remote", "--check"], ["--local", "--apply", "--check"]]) {
    await assert.rejects(main(args), /Choose exactly one target/);
  }
  await assert.rejects(main(["--remote", "--check", "--persist-to", "/tmp/unused"]), /only with --local/);
});
