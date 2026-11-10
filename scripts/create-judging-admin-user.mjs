import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, open, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, promisify, stripVTControlCharacters } from 'node:util';
import { createWranglerDatabase } from './prepare-registration-db.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runExecFile = promisify(execFile);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const importWarning = '▲ [WARNING] ⚠️ This process may take some time, during which your D1 database will be unavailable to serve queries.';

/** The local CLI uses D1.batch; the remote file importer rolls back a failed import.
 * All credential-bearing SQL stays in a private file, never argv or an error log.
 */
export function createJudgingAdminDatabase({ remote, database = 'levitate-passport', persistTo, runCommand = runExecFile }) {
  const reader = createWranglerDatabase({ remote, database, persistTo, runCommand });
  return {
    read: reader.read,
    async write(statements) {
      const directory = await mkdtemp(join(tmpdir(), 'levitate-judging-admin-sql-'));
      try {
        const file = join(directory, 'provision.sql');
        await writeFile(file, `${statements.map(sql => sql.trim().replace(/;+$/, '')).join(';\n')};\n`, { mode: 0o600 });
        const args = [resolve(projectRoot, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', database,
          '--config', resolve(projectRoot, 'wrangler.jsonc'), remote ? '--remote' : '--local', '--json', '--yes', '--file', file];
        if (persistTo) args.push('--persist-to', resolve(persistTo));
        let stdout;
        try {
          ({ stdout } = await runCommand(process.execPath, args, {
            cwd: projectRoot, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, CI: 'true' },
          }));
        } catch {
          throw new Error('Private D1 provisioning failed. Raw database output was suppressed.');
        }
        let result;
        try { result = JSON.parse(stdout); } catch {
          const output = stripVTControlCharacters(String(stdout));
          const start = output.search(/^\[/m);
          if (start > 0 && output.slice(0, start).replace(/\s+/g, ' ').trim() === importWarning) {
            try { result = JSON.parse(output.slice(start)); } catch { /* Reject below without echoing SQL. */ }
          }
        }
        if (!Array.isArray(result) || result.length !== (remote ? 1 : statements.length) || result.some(item => item.success !== true)) {
          throw new Error('Private D1 provisioning returned an unconfirmed result.');
        }
      } finally { await rm(directory, { recursive: true, force: true }); }
    },
  };
}

function accountIdentity(username) {
  if (typeof username !== 'string' || !/^[a-z0-9][a-z0-9_.-]{2,39}$/i.test(username)) {
    throw new Error('Use a username of 3–40 letters, numbers, dots, underscores or hyphens.');
  }
  username = username.toLowerCase();
  return { username, email: `${username}@accounts.levitate.invalid` };
}

async function writeCredentials(handle, data) {
  await handle.truncate(0);
  await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`);
  await handle.sync();
}

/** Creates a new scoped staff account only. Existing identities are never updated. */
export async function provisionJudgingAdmin({ db, credentialsFile, username = 'adminjueceo',
  name = 'Administrador de jueceo', remote = false, persistCredentials = writeCredentials }) {
  const identity = accountIdentity(username);
  if (!credentialsFile || typeof credentialsFile !== 'string') throw new Error('Choose --credentials-file before creating the account.');
  if (typeof name !== 'string' || !name.trim() || name.length > 100 || /[\u0000-\u001f]/.test(name)) throw new Error('Choose a valid account name.');
  const [columns, existingUsers, existingAcademies] = await db.read([
    'PRAGMA table_info(registration_users)',
    `SELECT id FROM registration_users WHERE username=${quote(identity.username)} COLLATE NOCASE OR email=${quote(identity.email)} COLLATE NOCASE`,
    `SELECT id FROM registration_academies WHERE email=${quote(identity.email)} COLLATE NOCASE`,
  ]);
  for (const column of ['is_judge', 'is_judging_admin']) {
    if (!columns.some(item => item.name === column)) throw new Error('Prepare the registration schema before provisioning this account.');
  }
  if (existingUsers.length || existingAcademies.length) throw new Error('This username or internal identifier already exists; no account was changed.');

  const target = resolve(credentialsFile);
  const delivery = await open(target, 'wx', 0o600);
  let recoveryDirectory, recoveryFile, mutationStarted = false, confirmed = false;
  try {
    await delivery.chmod(0o600);
    const password = randomBytes(24).toString('base64url');
    const salt = randomBytes(16);
    const passwordHash = `pbkdf2_sha256$100000$${salt.toString('base64url')}$${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('base64url')}`;
    const userId = randomUUID(), academyId = randomUUID();
    const credentials = { username: identity.username, password, userId, academyId,
      role: 'judging_admin', recoveryEmail: null, environment: remote ? 'remote' : 'local', status: 'unconfirmed' };

    // A private recovery copy is durable BEFORE mutation, so a disk/output failure
    // after the account commits cannot leave a privileged account without its key.
    recoveryDirectory = await mkdtemp(join(dirname(target), '.levitate-judging-admin-recovery-'));
    recoveryFile = join(recoveryDirectory, 'credentials.json');
    const recovery = await open(recoveryFile, 'wx', 0o600);
    try { await writeCredentials(recovery, credentials); } finally { await recovery.close(); }

    const verificationSql = `SELECT u.id,u.academy_id,u.username,u.email,u.password_hash,u.role,u.is_judge,u.is_judging_admin,u.status,u.email_confirmed_at,
      a.name AS academy_name,a.email AS academy_email FROM registration_users u JOIN registration_academies a ON a.id=u.academy_id WHERE u.id=${quote(userId)}`;
    const verify = async () => {
      const [rows] = await db.read([verificationSql]);
      const row = rows[0];
      return rows.length === 1 && row.id === userId && row.academy_id === academyId && row.username === identity.username
        && row.email === identity.email && row.password_hash === passwordHash && row.role === 'academy'
        && row.is_judge === 0 && row.is_judging_admin === 1 && row.status === 'active' && Boolean(row.email_confirmed_at)
        && row.academy_name === 'Administración de jueceo · cuenta interna' && row.academy_email === identity.email;
    };
    mutationStarted = true;
    try {
      await db.write([
        `INSERT INTO registration_academies(id,name,contact_name,email) VALUES (${quote(academyId)},'Administración de jueceo · cuenta interna',${quote(name.trim())},${quote(identity.email)})`,
        `INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,status,role,is_judge,is_judging_admin,email_confirmed_at)
          VALUES (${quote(userId)},${quote(academyId)},${quote(name.trim())},${quote(identity.username)},${quote(identity.email)},${quote(passwordHash)},'active','academy',0,1,datetime('now'))`,
      ]);
    } catch {
      // A lost CLI response may follow a committed import. Reconcile our exact
      // generated identity, never retry writes or reset a colliding account.
      if (!await verify()) throw new Error('Provisioning outcome is unconfirmed; no automatic retry was attempted.');
    }
    if (!await verify()) throw new Error('Provisioning verification failed; no automatic retry was attempted.');
    confirmed = true;
    credentials.status = 'created';
    try { await persistCredentials(delivery, credentials); } catch {
      throw new Error('Account created, but the credentials file could not be completed.');
    }
    await rm(recoveryDirectory, { recursive: true, force: true });
    recoveryDirectory = null;
    return { username: identity.username, userId, academyId, role: 'judging_admin', recoveryEmail: null,
      credentialsFile: target, environment: remote ? 'remote' : 'local' };
  } catch (error) {
    if (!mutationStarted) {
      await rm(target, { force: true });
      if (recoveryDirectory) await rm(recoveryDirectory, { recursive: true, force: true });
      throw error;
    }
    // Keep the private recovery copy when the remote outcome or final disk write
    // is uncertain. Never expose its plaintext or pretend a second run is safe.
    await rm(target, { force: true }).catch(() => {});
    const failure = new Error(`${confirmed ? 'Account creation was confirmed.' : 'Account creation was not confirmed.'} Recover using the private file: ${recoveryFile}. Do not automatically retry or reset the account.`);
    failure.code = confirmed ? 'credentials_write_failed' : 'provisioning_unconfirmed';
    failure.recoveryFile = recoveryFile;
    throw failure;
  } finally { await delivery.close(); }
}

export async function main(argv = process.argv.slice(2), { createDatabase = createJudgingAdminDatabase, log = console.log } = {}) {
  const { values } = parseArgs({ args: argv, options: {
    local: { type: 'boolean' }, remote: { type: 'boolean' }, database: { type: 'string', default: 'levitate-passport' },
    'persist-to': { type: 'string' }, username: { type: 'string', default: 'adminjueceo' },
    name: { type: 'string', default: 'Administrador de jueceo' }, 'credentials-file': { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    log('Usage: node scripts/create-judging-admin-user.mjs (--local | --remote) --credentials-file /private/path.json [--username adminjueceo] [--persist-to local-directory]');
    log('Creates a new judging-only account without a recovery email. Existing users are never promoted or reset. Credentials are written privately, never to stdout.');
    return 0;
  }
  if (Boolean(values.local) === Boolean(values.remote)) throw new Error('Choose exactly one target: --local or --remote.');
  if (values['persist-to'] && !values.local) throw new Error('--persist-to is supported only with --local.');
  if (!values['credentials-file']) throw new Error('Choose --credentials-file before creating the account.');
  const result = await provisionJudgingAdmin({ db: createDatabase({ remote: Boolean(values.remote), database: values.database, persistTo: values['persist-to'] }),
    credentialsFile: values['credentials-file'], username: values.username, name: values.name, remote: Boolean(values.remote) });
  log(`Created ${result.username} with the judging_admin role and no recovery email. Credentials saved privately to ${result.credentialsFile}.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
