import { randomBytes, randomUUID, pbkdf2Sync } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
if (!remote && !args.includes('--local')) throw new Error('Choose --local or --remote explicitly.');
const eventId = args.find(value => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value));
if (!eventId) throw new Error('An existing Levitate Core test event UUID is required.');
const username = 'juezweb';
const email = 'juezweb@example.invalid';
const password = randomBytes(18).toString('base64url');
const salt = randomBytes(16);
const hash = `pbkdf2_sha256$100000$${salt.toString('base64url')}$${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('base64url')}`;
const academyId = randomUUID(), userId = randomUUID();
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const sql = `INSERT INTO registration_academies(id,name,contact_name,email) VALUES (${quote(academyId)},'Jueces Levitate','Juez Web',${quote(email)});
INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,is_judge,email_confirmed_at)
VALUES (${quote(userId)},${quote(academyId)},'Juez Web',${quote(username)},${quote(email)},${quote(hash)},1,datetime('now'));
INSERT INTO registration_judge_assignments(user_id,event_id,judge_id) VALUES (${quote(userId)},${quote(eventId)},'juez-web');`;
const directory = mkdtempSync(join(tmpdir(), 'levitate-judge-provision-'));
try {
  const file = join(directory, 'provision.sql');
  writeFileSync(file, sql, { mode: 0o600 });
  const result = spawnSync('npx', ['wrangler', 'd1', 'execute', 'levitate-passport', remote ? '--remote' : '--local', '--file', file, '--json'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Provisioning failed without resetting an existing account: ${result.stderr}`);
  // Only emit credentials once, after all statements succeeded. Never commit them.
  console.log(JSON.stringify({ username, password, userId, eventId, environment: remote ? 'remote' : 'local' }));
} finally { rmSync(directory, { recursive: true, force: true }); }
