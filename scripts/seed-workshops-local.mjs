import { execFile } from 'node:child_process';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createWranglerDatabase } from './prepare-registration-db.mjs';
import { prepareRegistrationSchema } from './lib/registration-schema.mjs';

// This script intentionally accepts no target/database arguments. It can only
// create this disposable local preview, and refuses to overwrite an existing one.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const persistTo = resolve(root, 'tmp/workshops-preview-state');
const accessPath = resolve(root, 'tmp/workshops-preview-access.json');
const execFileAsync = promisify(execFile);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const sqlNull = value => value == null ? 'NULL' : quote(value);
const passwordHash = password => {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return `pbkdf2_sha256$100000$${salt.toString('base64url')}$${hash.toString('base64url')}`;
};

async function executeFile(file) {
  const { stdout } = await execFileAsync(process.execPath, [
    resolve(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'levitate-passport',
    '--config', resolve(root, 'wrangler.jsonc'), '--local', '--persist-to', persistTo, '--file', file, '--json',
  ], { cwd: root, env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' }, maxBuffer: 8 * 1024 * 1024 });
  const results = JSON.parse(stdout);
  if (!Array.isArray(results) || results.some(result => !result.success)) throw new Error('Local SQL setup failed.');
}

async function main() {
  if (process.argv.length > 2) throw new Error('No arguments supported: this script always creates the isolated local workshop preview.');
  await mkdir(resolve(root, 'tmp'), { recursive: true });
  for (const file of [persistTo, accessPath]) {
    try { await access(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    throw new Error('A workshop preview already exists. Stop its local server and move the old preview state/access file before creating a fresh one.');
  }
  await mkdir(persistTo);
  await executeFile(resolve(root, 'db/registration_d1_schema.sql'));
  await prepareRegistrationSchema(createWranglerDatabase({ remote: false, persistTo }), { apply: true });

  const catalog = JSON.parse(await readFile(resolve(root, 'shared/workshops-event.json'), 'utf8'));
  const sessions = catalog.tracks.flatMap(track => track.slots.flatMap(slot => slot.shared ? [slot.shared] : slot.classes));
  const credentials = {
    localOnly: true,
    baseUrl: 'http://localhost:8788',
    persistTo: 'tmp/workshops-preview-state',
    admin: { username: 'workshops-preview-admin', password: randomBytes(18).toString('base64url') },
    academy: { username: 'workshops-preview-academy', password: randomBytes(18).toString('base64url') },
    participants: [
      { id: 'workshops-preview-young', name: 'Prueba Local Doce', curp: 'PRLA131114MDFBBB01', birthDate: '2013-11-14', ageAtEvent: 12, paid: true },
      { id: 'workshops-preview-older', name: 'Prueba Local Trece', curp: 'PRLB131113MDFBBB01', birthDate: '2013-11-13', ageAtEvent: 13, paid: true },
      { id: 'workshops-preview-unpaid', name: 'Prueba Local Pendiente', curp: 'PRLC120101MDFBBB01', birthDate: '2012-01-01', ageAtEvent: 14, paid: false },
    ],
  };
  const statements = [];
  for (const [role, account] of [['admin', credentials.admin], ['academy', credentials.academy]]) {
    const id = `workshops-preview-${role}`;
    const email = `${account.username}@example.test`;
    statements.push(`INSERT INTO registration_academies(id,name,contact_name,email,phone,origin_type,origin_state,origin_country)
      VALUES (${quote(id)}, ${quote(`Prueba local ${role}`)}, 'Responsable ficticio', ${quote(email)}, '5555555555', 'mexico', 'mexico', 'México')`);
    statements.push(`INSERT INTO registration_users(id,academy_id,name,username,email,password_hash,role,email_confirmed_at)
      VALUES (${quote(id)}, ${quote(id)}, 'Responsable ficticio', ${quote(account.username)}, ${quote(email)}, ${quote(passwordHash(account.password))}, ${quote(role)}, datetime('now'))`);
  }
  statements.push(`INSERT INTO registration_choreographers(id,academy_id,full_name,email,phone)
    VALUES ('workshops-preview-teacher','workshops-preview-academy','Maestra ficticia','teacher@example.test','5555555555')`);
  for (const person of credentials.participants) {
    const danceId = `${person.id}-dance`;
    const orderId = `${person.id}-order`;
    const line = { id: danceId, title: `Coreografía ${person.name}`, genre: 'motion', subgenre: 'jazz', category: 'solo',
      venue: 'edomex', currency: 'MXN', baseAmount: 1500, amount: 1500, discountRate: 0 };
    statements.push(`INSERT INTO registration_participants(id,academy_id,full_name,curp,birth_date,age,division,shirt_size)
      VALUES (${quote(person.id)},'workshops-preview-academy',${quote(person.name)},${quote(person.curp)},${quote(person.birthDate)},${person.ageAtEvent},'teen','m')`);
    // Exercise registration eligibility even without a dance or payment order.
    if (!person.paid) continue;
    statements.push(`INSERT INTO registration_dances(id,academy_id,title,genre,subgenre,category,venue)
      VALUES (${quote(danceId)},'workshops-preview-academy',${quote(line.title)},'motion','jazz','solo','edomex')`);
    statements.push(`INSERT INTO registration_dance_participants(dance_id,participant_id) VALUES (${quote(danceId)},${quote(person.id)})`);
    statements.push(`INSERT INTO registration_dance_choreographers(dance_id,choreographer_id) VALUES (${quote(danceId)},'workshops-preview-teacher')`);
    statements.push(`INSERT INTO registration_inscription_orders(id,curp,participant_name,academy_id,academy_name,venue,reference,amount,paid_amount,status,line_items_json,notes,paid_at)
      VALUES (${quote(orderId)},${quote(person.curp)},${quote(person.name)},'workshops-preview-academy','Prueba local academy','edomex',${quote(`LOCAL-${person.id}`)},1500,${person.paid ? 1500 : 0},${quote(person.paid ? 'paid' : 'pending_payment')},${quote(JSON.stringify([line]))},'Fixture sintética exclusiva de preview local',${sqlNull(person.paid ? '2026-10-13 12:00:00' : null)})`);
  }
  for (const session of sessions) statements.push(`INSERT INTO registration_workshop_sessions(event_id,session_id,capacity)
    VALUES (${quote(catalog.eventId)},${quote(session.id)},NULL)
    ON CONFLICT(event_id,session_id) DO UPDATE SET capacity=NULL`);

  const seedPath = resolve(root, `tmp/workshops-preview-seed-${randomBytes(8).toString('hex')}.sql`);
  try {
    await writeFile(seedPath, `${statements.join(';\n')};\n`, { mode: 0o600, flag: 'wx' });
    await executeFile(seedPath);
    await writeFile(accessPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  } finally {
    await rm(seedPath, { force: true });
  }
  console.log('Local workshop preview created at tmp/workshops-preview-state with synthetic participants and unlimited capacity.');
  console.log('Local login details saved only in tmp/workshops-preview-access.json (0600). No remote database was contacted.');
}

main().catch(() => {
  // Child-process errors may include SQL; never dump hashes or access details.
  console.error('Local workshop fixture could not be created. Check that no previous preview exists and that the local Wrangler runtime/schema are ready. No remote operation was attempted.');
  process.exitCode = 1;
});
