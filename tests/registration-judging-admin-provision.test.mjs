import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createJudgingAdminDatabase, main, provisionJudgingAdmin } from '../scripts/create-judging-admin-user.mjs';
import { planRegistrationSchema, prepareRegistrationSchema } from '../scripts/lib/registration-schema.mjs';

const schema = readFileSync(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../db/registration_judging_admin_role.sql', import.meta.url), 'utf8');
const oldSchema = schema.replace(/^  is_judging_admin .+\n/m, '');

async function fixture(t, initialSchema = schema) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(initialSchema);
  const directory = await mkdtemp(join(tmpdir(), 'levitate-provision-test-'));
  t.after(async () => { sqlite.close(); await rm(directory, { recursive: true, force: true }); });
  let writes = 0;
  const db = {
    async read(statements) { return statements.map(sql => sqlite.prepare(sql).all()); },
    async write(statements) {
      writes++;
      sqlite.exec('BEGIN');
      try { for (const sql of statements) sqlite.exec(sql); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const credentialsFile = join(directory, 'credentials.json');
  return { sqlite, db, directory, credentialsFile, writes: () => writes };
}

function seed(sqlite) {
  sqlite.exec(`INSERT INTO registration_academies(id,name,contact_name,email) VALUES ('old-academy','Existing academy','Existing contact','old@example.test');
    INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,is_judge,email_confirmed_at)
      VALUES ('old-academy-user','old-academy','Academy','academy','academy@example.test','old-academy-hash','academy',0,datetime('now')),
             ('old-admin','old-academy','Administrator','superadmin','admin@example.test','old-admin-hash','admin',0,datetime('now')),
             ('old-judge','old-academy','Judge','judge','judge@example.test','old-judge-hash','academy',1,datetime('now'));`);
}

function userSnapshot(sqlite) {
  return sqlite.prepare('SELECT id,academy_id,name,username,email,password_hash,role,is_judge,status,email_confirmed_at FROM registration_users ORDER BY id').all();
}

function verifyPassword(password, hash) {
  const [algorithm, iterations, salt, digest] = hash.split('$');
  assert.equal(algorithm, 'pbkdf2_sha256');
  assert.equal(iterations, '100000');
  assert.equal(Buffer.from(salt, 'base64url').length, 16);
  assert.equal(pbkdf2Sync(password, Buffer.from(salt, 'base64url'), Number(iterations), 32, 'sha256').toString('base64url'), digest);
}

test('judging admin flag is an additive, idempotent migration that preserves legacy users and role constraints', async t => {
  const { sqlite, db, writes } = await fixture(t, oldSchema);
  seed(sqlite);
  const before = userSnapshot(sqlite);
  const plan = await planRegistrationSchema(db);
  assert.equal(plan.steps.length, 1);
  assert.match(plan.steps[0].sql, /^ALTER TABLE registration_users ADD COLUMN is_judging_admin INTEGER NOT NULL DEFAULT 0 CHECK/);
  assert.equal(writes(), 0);
  assert.equal((await prepareRegistrationSchema(db, { apply: true })).applied, 1);
  assert.deepEqual(userSnapshot(sqlite), before);
  assert.deepEqual(sqlite.prepare('SELECT is_judging_admin FROM registration_users').all().map(row => row.is_judging_admin), [0, 0, 0]);
  assert.throws(() => sqlite.exec("UPDATE registration_users SET is_judging_admin=2 WHERE id='old-admin'"), /CHECK/);
  assert.throws(() => sqlite.exec("UPDATE registration_users SET role='judging_admin' WHERE id='old-admin'"), /CHECK/);
  assert.equal((await prepareRegistrationSchema(db, { apply: true })).applied, 0);
  assert.equal(writes(), 1);
});

test('standalone judging migration matches the canonical flag without changing user records', async t => {
  const { sqlite } = await fixture(t, oldSchema);
  seed(sqlite);
  const before = userSnapshot(sqlite);
  sqlite.exec(migration);
  assert.deepEqual(userSnapshot(sqlite), before);
  const column = sqlite.prepare('PRAGMA table_info(registration_users)').all().find(row => row.name === 'is_judging_admin');
  assert.equal(column.type, 'INTEGER');
  assert.equal(column.notnull, 1);
  assert.equal(column.dflt_value, '0');
});

test('provisioning creates only an empty staff container and a scoped active account with a private compatible password', async t => {
  const { sqlite, db, credentialsFile, directory, writes } = await fixture(t);
  seed(sqlite);
  const before = userSnapshot(sqlite);
  const result = await provisionJudgingAdmin({ db, credentialsFile });
  assert.equal(writes(), 1);
  const credentials = JSON.parse(await readFile(credentialsFile, 'utf8'));
  const account = sqlite.prepare('SELECT * FROM registration_users WHERE id=?').get(result.userId);
  assert.equal(credentials.username, 'adminjueceo');
  assert.equal(credentials.status, 'created');
  assert.equal(credentials.password.length, 32);
  assert.equal(credentials.recoveryEmail, null);
  assert.equal(account.email, 'adminjueceo@accounts.levitate.invalid');
  assert.equal(account.role, 'academy');
  assert.equal(account.is_judge, 0);
  assert.equal(account.is_judging_admin, 1);
  assert.equal(account.status, 'active');
  assert.ok(account.email_confirmed_at);
  verifyPassword(credentials.password, account.password_hash);
  assert.equal(statSync(credentialsFile).mode & 0o777, 0o600);
  assert.ok(!JSON.stringify(result).includes(credentials.password));
  assert.ok(!JSON.stringify(result).includes(account.password_hash));
  assert.deepEqual(userSnapshot(sqlite).filter(row => row.id !== result.userId), before);
  const academy = sqlite.prepare('SELECT * FROM registration_academies WHERE id=?').get(result.academyId);
  assert.equal(academy.name, 'Administración de jueceo · cuenta interna');
  assert.equal(academy.email, account.email);
  for (const table of ['registration_participants', 'registration_dances', 'registration_inscription_orders', 'registration_shop_orders']) {
    assert.equal(sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  }
  assert.deepEqual(await readdir(directory), ['credentials.json']);
});

test('a second invocation refuses the existing identity without resetting its password or creating another file', async t => {
  const { sqlite, db, credentialsFile, directory, writes } = await fixture(t);
  await provisionJudgingAdmin({ db, credentialsFile });
  const before = userSnapshot(sqlite);
  const secondFile = join(directory, 'second.json');
  await assert.rejects(provisionJudgingAdmin({ db, credentialsFile: secondFile, username: 'ADMINJUECEO' }), /already exists/);
  assert.equal(writes(), 1);
  assert.deepEqual(userSnapshot(sqlite), before);
  assert.equal(existsSync(secondFile), false);
});

test('email collisions, academy identifier collisions, and preexisting output files never mutate existing accounts', async t => {
  for (const collision of ['username', 'email', 'academy', 'file']) {
    await t.test(collision, async t => {
      const { sqlite, db, credentialsFile, writes } = await fixture(t);
      seed(sqlite);
      if (collision === 'username') sqlite.exec("UPDATE registration_users SET username='ADMINJUECEO' WHERE id='old-admin'");
      if (collision === 'email') sqlite.exec("UPDATE registration_users SET email='ADMINJUECEO@ACCOUNTS.LEVITATE.INVALID' WHERE id='old-admin'");
      if (collision === 'academy') sqlite.exec("UPDATE registration_academies SET email='ADMINJUECEO@ACCOUNTS.LEVITATE.INVALID'");
      if (collision === 'file') await writeFile(credentialsFile, 'original credential file');
      const before = userSnapshot(sqlite);
      await assert.rejects(provisionJudgingAdmin({ db, credentialsFile }), collision === 'file' ? /EEXIST/ : /already exists/);
      assert.equal(writes(), 0);
      assert.deepEqual(userSnapshot(sqlite), before);
      assert.equal(sqlite.prepare('SELECT count(*) AS n FROM registration_academies').get().n, 1);
      if (collision === 'file') assert.equal(await readFile(credentialsFile, 'utf8'), 'original credential file');
      else assert.equal(existsSync(credentialsFile), false);
    });
  }
});

test('schema must be prepared before provisioning; failed preparation does not reserve credentials', async t => {
  const { db, credentialsFile, writes } = await fixture(t, oldSchema);
  await assert.rejects(provisionJudgingAdmin({ db, credentialsFile }), /Prepare the registration schema/);
  assert.equal(writes(), 0);
  assert.equal(existsSync(credentialsFile), false);
});

test('a user insert failure rolls back its academy and preserves a private recovery copy without leaking raw database errors', async t => {
  const { sqlite, db, credentialsFile, writes } = await fixture(t);
  seed(sqlite);
  const before = userSnapshot(sqlite);
  sqlite.exec("CREATE TRIGGER reject_new_staff BEFORE INSERT ON registration_users WHEN NEW.is_judging_admin=1 BEGIN SELECT RAISE(ABORT,'private database detail'); END;");
  let failure;
  await assert.rejects(provisionJudgingAdmin({ db, credentialsFile }), error => { failure = error; return error.code === 'provisioning_unconfirmed'; });
  assert.equal(writes(), 1);
  assert.deepEqual(userSnapshot(sqlite), before);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM registration_academies').get().n, 1);
  assert.equal(existsSync(credentialsFile), false);
  assert.equal(statSync(failure.recoveryFile).mode & 0o777, 0o600);
  assert.equal(statSync(dirname(failure.recoveryFile)).mode & 0o777, 0o700);
  assert.doesNotMatch(failure.message, /private database detail|pbkdf2_sha256/);
});

test('a lost write response is reconciled by the exact generated user and its one-time password without retrying', async t => {
  const { sqlite, db, credentialsFile, writes } = await fixture(t);
  const commit = db.write;
  db.write = async statements => { await commit(statements); throw new Error('lost response'); };
  const result = await provisionJudgingAdmin({ db, credentialsFile });
  assert.equal(writes(), 1);
  const credentials = JSON.parse(await readFile(credentialsFile, 'utf8'));
  verifyPassword(credentials.password, sqlite.prepare('SELECT password_hash FROM registration_users WHERE id=?').get(result.userId).password_hash);
});

test('a final credential write failure keeps the created account recoverable with its original password', async t => {
  const { sqlite, db, credentialsFile } = await fixture(t);
  let failure;
  await assert.rejects(provisionJudgingAdmin({ db, credentialsFile, persistCredentials: async () => { throw new Error('disk full'); } }),
    error => { failure = error; return error.code === 'credentials_write_failed'; });
  assert.equal(existsSync(credentialsFile), false);
  const credentials = JSON.parse(await readFile(failure.recoveryFile, 'utf8'));
  const row = sqlite.prepare('SELECT password_hash FROM registration_users WHERE id=?').get(credentials.userId);
  verifyPassword(credentials.password, row.password_hash);
  assert.equal(statSync(failure.recoveryFile).mode & 0o777, 0o600);
  assert.ok(!failure.message.includes(credentials.password));
});

test('private D1 adapter sends sensitive SQL only in a temporary private file and accepts the importer result', async t => {
  for (const remote of [false, true]) await t.test(remote ? 'remote' : 'local', async () => {
    let sqlFile;
    const statements = ["INSERT INTO accounts VALUES ('synthetic-password-hash')", 'INSERT INTO staff VALUES (1)'];
    const db = createJudgingAdminDatabase({ remote, runCommand: async (_command, args) => {
      assert.ok(!args.some(arg => arg.includes('synthetic-password-hash')));
      assert.ok(!args.includes('--command'));
      assert.ok(args.includes(remote ? '--remote' : '--local'));
      sqlFile = args[args.indexOf('--file') + 1];
      assert.equal(statSync(sqlFile).mode & 0o777, 0o600);
      assert.equal(statSync(dirname(sqlFile)).mode & 0o777, 0o700);
      assert.equal(readFileSync(sqlFile, 'utf8'), `${statements.join(';\n')};\n`);
      const response = JSON.stringify(remote ? [{ success: true, results: [] }] : statements.map(() => ({ success: true, results: [] })));
      return { stdout: remote ? `▲ [WARNING] ⚠️ This process may take some time, during which your D1 database will be unavailable to serve queries.\n\n${response}` : response };
    } });
    await db.write(statements);
    assert.equal(existsSync(sqlFile), false);
    assert.equal(existsSync(dirname(sqlFile)), false);
  });
});

test('private D1 adapter suppresses failed subprocess output and removes its temporary SQL', async () => {
  let sqlFile;
  const db = createJudgingAdminDatabase({ remote: true, runCommand: async (_command, args) => {
    sqlFile = args[args.indexOf('--file') + 1];
    throw new Error(`raw output containing ${readFileSync(sqlFile, 'utf8')}`);
  } });
  await assert.rejects(db.write(["SELECT 'synthetic-secret'"]), error => /suppressed/.test(error.message) && !error.message.includes('synthetic-secret'));
  assert.equal(existsSync(sqlFile), false);
});

test('CLI requires an explicit local or remote target and an output file, and reports no password', async t => {
  const { db, credentialsFile } = await fixture(t);
  let calls = 0;
  const logs = [];
  const options = { createDatabase: () => { calls++; return db; }, log: line => logs.push(line) };
  await assert.rejects(main([], options), /exactly one target/);
  await assert.rejects(main(['--remote', '--local', '--credentials-file', credentialsFile], options), /exactly one target/);
  await assert.rejects(main(['--remote'], options), /credentials-file/);
  await assert.rejects(main(['--remote', '--persist-to', '/tmp/local', '--credentials-file', credentialsFile], options), /only with --local/);
  assert.equal(calls, 0);
  assert.equal(await main(['--local', '--credentials-file', credentialsFile], options), 0);
  assert.equal(calls, 1);
  const credentials = JSON.parse(await readFile(credentialsFile, 'utf8'));
  assert.equal(logs.length, 1);
  assert.ok(logs[0].includes('adminjueceo'));
  assert.ok(!logs[0].includes(credentials.password));
  assert.ok(!logs[0].includes('pbkdf2_sha256'));
});
