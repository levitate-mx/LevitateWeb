import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

// Never launch Wrangler from this test, even if the injected runner is ignored.
// The adapter captures the trapped default during import; actual calls below
// use an injected runner and local temporary files/SQLite only.
const originalExecFile = childProcess.execFile;
let createWranglerDatabase;
try {
  childProcess.execFile = () => { throw new Error('Adapter tests must not launch subprocesses.'); };
  syncBuiltinESMExports();
  ({ createWranglerDatabase } = await import('../scripts/prepare-registration-db.mjs'));
} finally {
  childProcess.execFile = originalExecFile;
  syncBuiltinESMExports();
}

const triggerStatements = [
  'CREATE TABLE entries(id INTEGER PRIMARY KEY, value INTEGER)',
  'CREATE TABLE totals(value INTEGER)',
  'INSERT INTO totals(value) VALUES (0)',
  `CREATE TRIGGER count_entries AFTER INSERT ON entries BEGIN
    UPDATE totals SET value = value + NEW.value;
    UPDATE totals SET value = value + 1;
  END;`,
  'INSERT INTO entries(id,value) VALUES (1,2)',
];
const aggregate = [{ success: true, results: [{ 'Total queries executed': 5, 'Rows read': 0, 'Rows written': 3 }],
  finalBookmark: 'synthetic-import-bookmark', meta: { duration: 1, rows_read: 0, rows_written: 3 } }];
const importWarning = '▲ [WARNING] ⚠️ This process may take some time, during which your D1 database will be unavailable to serve queries.\n\n';

async function assertRemoved(path) {
  await assert.rejects(stat(path), { code: 'ENOENT' });
}

test('remote trigger writes use a private SQL file, preserve trigger bodies and accept the importer aggregate', async t => {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  let sqlPath;
  let calls = 0;
  const db = createWranglerDatabase({ remote: true, runCommand: async (executable, args, options) => {
    calls++;
    assert.equal(executable, process.execPath);
    assert.ok(args.includes('--remote'));
    assert.ok(args.includes('--json'));
    assert.ok(args.includes('--yes'));
    assert.ok(!args.includes('--command'));
    sqlPath = args[args.indexOf('--file') + 1];
    assert.equal((await stat(sqlPath)).mode & 0o777, 0o600);
    assert.equal(options.env.CI, 'true');
    const sql = await readFile(sqlPath, 'utf8');
    for (const statement of triggerStatements) assert.ok(sql.includes(statement));
    sqlite.exec(sql);
    return { stdout: JSON.stringify(aggregate) };
  } });
  await db.write(triggerStatements);
  assert.equal(calls, 1);
  assert.equal(sqlite.prepare('SELECT value FROM totals').get().value, 3);
  await assertRemoved(sqlPath);
  await assertRemoved(dirname(sqlPath));
});

test('remote reads and simple writes retain command transport and per-statement result validation', async () => {
  const calls = [];
  const db = createWranglerDatabase({ remote: true, runCommand: async (_executable, args) => {
    calls.push(args);
    assert.ok(args.includes('--remote'));
    assert.ok(args.includes('--command'));
    assert.ok(!args.includes('--file'));
    const sql = args[args.indexOf('--command') + 1];
    return { stdout: JSON.stringify(sql.includes('SELECT')
      ? [{ success: true, results: [{ value: 1 }] }, { success: true, results: [{ value: 2 }] }]
      : [{ success: true, results: [] }]) };
  } });
  assert.deepEqual(await db.read(['SELECT 1 AS value', 'SELECT 2 AS value']), [[{ value: 1 }], [{ value: 2 }]]);
  await db.write(['CREATE INDEX extra ON entries(value)']);
  assert.equal(calls.length, 2);
  const shortResponse = createWranglerDatabase({ remote: true,
    runCommand: async () => ({ stdout: JSON.stringify([{ success: true, results: [] }]) }) });
  await assert.rejects(shortResponse.read(['SELECT 1', 'SELECT 2']), /Unexpected D1 response/);
});

test('Wrangler import warning before its JSON aggregate is accepted and the temporary file is removed', async () => {
  let sqlPath;
  const db = createWranglerDatabase({ remote: true, runCommand: async (_executable, args) => {
    sqlPath = args[args.indexOf('--file') + 1];
    return { stdout: `${importWarning}${JSON.stringify(aggregate, null, 2)}\n` };
  } });
  assert.deepEqual(await db.write(triggerStatements), [aggregate[0].results]);
  await assertRemoved(sqlPath);
  await assertRemoved(dirname(sqlPath));
});

test('local trigger writes remain local commands and preserve the isolated persistence target', async () => {
  const db = createWranglerDatabase({ remote: false, persistTo: 'tmp/adapter-test-never-created',
    runCommand: async (_executable, args) => {
      assert.ok(args.includes('--local'));
      assert.ok(!args.includes('--remote'));
      assert.ok(args.includes('--command'));
      assert.ok(!args.includes('--file'));
      assert.equal(args[args.indexOf('--persist-to') + 1], resolve('tmp/adapter-test-never-created'));
      assert.ok(args[args.indexOf('--command') + 1].includes(triggerStatements[3]));
      return { stdout: JSON.stringify(triggerStatements.map(() => ({ success: true, results: [] }))) };
    } });
  await db.write(triggerStatements);
});

test('temporary migration SQL is removed when Wrangler fails', async () => {
  let sqlPath;
  const db = createWranglerDatabase({ remote: true, runCommand: async (_executable, args) => {
    sqlPath = args[args.indexOf('--file') + 1];
    assert.ok((await readFile(sqlPath, 'utf8')).includes('CREATE TRIGGER'));
    throw new Error('Synthetic importer failure');
  } });
  await assert.rejects(db.write(triggerStatements), error => {
    assert.match(error.message, /Registration schema command failed/);
    assert.doesNotMatch(error.message, /Synthetic importer failure/, 'raw execFile messages may contain SQL and must stay private');
    return true;
  });
  await assertRemoved(sqlPath);
  await assertRemoved(dirname(sqlPath));
});

test('temporary migration SQL is removed and import rejected for malformed or unsuccessful results', async () => {
  for (const stdout of ['not-json', '[]', '{}', '[{"success":false}]',
    JSON.stringify([aggregate[0], aggregate[0]]),
    `${importWarning}[{"success":false}]`,
    `${importWarning}{"error":{"message":"Synthetic import failure"}}`,
    `${importWarning}${JSON.stringify(aggregate)}\ntrailing junk`,
    `${JSON.stringify(aggregate)}\ntrailing junk`,
    `unknown output prefix\n${JSON.stringify(aggregate)}`,
    `[ { "success": false } ]\n${JSON.stringify(aggregate)}`,
  ]) {
    let sqlPath;
    const db = createWranglerDatabase({ remote: true, runCommand: async (_executable, args) => {
      sqlPath = args[args.indexOf('--file') + 1];
      return { stdout };
    } });
    await assert.rejects(db.write(triggerStatements));
    await assertRemoved(sqlPath);
    await assertRemoved(dirname(sqlPath));
  }
});
