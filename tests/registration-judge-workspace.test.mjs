import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';
import worker from '../worker/index.js';
import { handleJudgeWorkspace, validateJudgeRows } from '../worker/judge-workspace.js';

const eventId = '11111111-1111-4111-8111-111111111111';
const otherEvent = '22222222-2222-4222-8222-222222222222';
const judgeId = 'juez-web';
const scope = { eventId, judgeId, blocks: [], assigned: [] };
const routines = [1, 2, 3].map(n => ({ event_id: eventId, routine_id: `r${n}`, block_id: n === 3 ? 'b2' : 'b1', genre: 'Ballet' }));
const templates = [{ template_id: 'ballet', genre: 'Ballet' }, { template_id: 'aerial', genre: 'Danza Aerea' }];
const criteria = [{ template_id: 'ballet', criterion_id: 1, max_score: 10 }, { template_id: 'aerial', criterion_id: 2, max_score: 3 }];
const row = (extra = {}) => ({ event_id: eventId, judge_id: judgeId, block_id: 'b1', routine_id: 'r1', device_id: 'browser-test', criterion_id: 1, value: 8, ...extra });
const session = { user: { id: 'judge-user', name: 'Juez Web', role: 'judge' } };

function allowSelection(f) {
  f.env.JUDGING_SELECTABLE_JUDGE_USER_IDS = "judge-user";
  f.data.judges.push(
    {
      event_id: eventId,
      judge_id: "judge-two",
      name: "Judge Two",
      role: "judge",
      assigned_block_ids: ["b2"],
    },
    {
      event_id: eventId,
      judge_id: "ati",
      name: "Admin",
      role: "admin",
      assigned_block_ids: [],
    },
  );
  f.data.scores.push(
    row({ routine_id: "r3", block_id: "b2", judge_id: "judge-two", value: 5 }),
    row({ judge_id: "ati", value: 10 }),
  );
}

test("explicit selector access lists existing Levitate events and blocks without creating jury profiles", async (t) => {
  const f = fixture(t);
  allowSelection(f);
  f.env.JUDGING_LEVITATE_EVENT_IDS += `,${otherEvent}`;
  f.data.events.push({
    id: otherEvent,
    slug: "levitate-two",
    name: "Levitate Two",
    event_type: "event",
  });
  f.data.judges.push({
    event_id: otherEvent,
    judge_id: "other",
    name: "Other",
    role: "judge",
    assigned_block_ids: [],
  });
  f.data.blocks.push({
    event_id: otherEvent,
    block_id: "b-other",
    name: "Other block",
  });
  const response = await handleJudgeWorkspace(
    f.request("session"),
    f.env,
    session,
    { fetcher: f.fetcher },
  );
  const data = await response.json();
  assert.equal(data.selectableJudges, true);
  assert.equal(data.assignments.length, 2);
  const first = data.assignments.find((a) => a.event.id === eventId);
  assert.equal(
    first.blocks.find((b) => b.block_id === "b1").routines.length,
    2,
  );
  assert.equal(
    first.blocks.find((b) => b.block_id === "b2").routines.length,
    1,
  );
  assert.ok(f.calls.every((call) => call.method === "GET"));
});
test("selector bundles show the existing regular judges and their own recorded sheets, never admin scores", async (t) => {
  const f = fixture(t);
  allowSelection(f);
  const response = await handleJudgeWorkspace(
    f.request("bundle"),
    f.env,
    session,
    { fetcher: f.fetcher },
  );
  const data = await response.json();
  assert.deepEqual(
    data.judges.map((j) => j.judge_id),
    [judgeId, "judge-two"],
  );
  assert.deepEqual(
    data.scores.map((s) => s.judge_id),
    [judgeId, "judge-two"],
  );
  assert.equal(data.routines.length, 3);
  assert.equal(data.blocks.length, 2);
});
test("selector saves bind to the chosen existing judge and enforce their block assignment", async (t) => {
  const f = fixture(t);
  allowSelection(f);
  const score = row({
    routine_id: "r3",
    block_id: "b2",
    judge_id: "judge-two",
    value: 6,
  });
  await handleJudgeWorkspace(
    f.request("scores", { judge: "judge-two", body: { rows: [score] } }),
    f.env,
    session,
    { fetcher: f.fetcher },
  );
  const writes = () => f.calls.filter((c) => c.method === "POST");
  assert.equal(writes().length, 1);
  assert.equal(JSON.parse(writes()[0].body)[0].judge_id, "judge-two");
  for (const input of [row(), row({ judge_id: "judge-two" })]) {
    await assert.rejects(
      handleJudgeWorkspace(
        f.request("scores", { judge: "judge-two", body: { rows: [input] } }),
        f.env,
        session,
        { fetcher: f.fetcher },
      ),
      (e) => e.statusCode === 403,
    );
  }
  assert.equal(writes().length, 1);
  await assert.rejects(
    handleJudgeWorkspace(
      f.request("scores", { body: { rows: [score] } }),
      f.env,
      session,
      { fetcher: f.fetcher },
    ),
    (e) => e.statusCode === 400,
  );
});
test("selector permission never grants admin, other brands or reserved identities", async (t) => {
  const f = fixture(t);
  allowSelection(f);
  for (const judge of ["ati", "admin", "not-in-event"])
    await assert.rejects(
      handleJudgeWorkspace(
        f.request("scores", {
          judge,
          body: { rows: [row({ judge_id: judge })] },
        }),
        f.env,
        session,
        { fetcher: f.fetcher },
      ),
      (e) => e.statusCode === 403,
    );
  await assert.rejects(
    handleJudgeWorkspace(
      f.request("bundle", { event: otherEvent }),
      f.env,
      session,
      { fetcher: f.fetcher },
    ),
    (e) => e.statusCode === 403,
  );
  for (const role of ["admin", "academy"])
    await assert.rejects(
      handleJudgeWorkspace(
        f.request("session"),
        f.env,
        { user: { ...session.user, role } },
        { fetcher: f.fetcher },
      ),
      (e) => e.statusCode === 403,
    );
  assert.equal(f.calls.filter((c) => c.method === "POST").length, 0);
});
test("ordinary accounts cannot opt into selection and removing the server grant restores their assigned-only access", async (t) => {
  const f = fixture(t);
  allowSelection(f);
  f.env.JUDGING_SELECTABLE_JUDGE_USER_IDS = "another-user";
  const data = await (
    await handleJudgeWorkspace(
      f.request("bundle", { judge: "judge-two" }),
      f.env,
      session,
      { fetcher: f.fetcher },
    )
  ).json();
  assert.deepEqual(
    data.judges.map((j) => j.judge_id),
    [judgeId],
  );
  await assert.rejects(
    handleJudgeWorkspace(
      f.request("scores", {
        judge: "judge-two",
        body: {
          selectableJudges: true,
          rows: [row({ judge_id: "judge-two" })],
        },
      }),
      f.env,
      session,
      { fetcher: f.fetcher },
    ),
    (e) => e.statusCode === 403,
  );
  const result = await (
    await handleJudgeWorkspace(f.request("session"), f.env, session, {
      fetcher: f.fetcher,
    })
  ).json();
  assert.equal(result.selectableJudges, undefined);
  assert.equal(result.assignments.length, 1);
});

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../db/registration_d1_schema.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  sqlite.exec(`INSERT INTO registration_academies (id,name,contact_name,email) VALUES ('staff','Jueces','Jueces','staff@example.invalid');`);
  const password = 'test-only-password';
  const salt = Buffer.alloc(16, 42), hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  sqlite.prepare(`INSERT INTO registration_users (id,academy_id,name,username,email,password_hash,email_confirmed_at,is_judge)
    VALUES ('judge-user','staff','Juez Web','juezweb','judge@example.invalid',?,datetime('now'),1)`)
    .run(`pbkdf2_sha256$100000$${salt.toString('base64url')}$${hash.toString('base64url')}`);
  sqlite.prepare(`INSERT INTO registration_judge_assignments(user_id,event_id,judge_id) VALUES ('judge-user',?,?)`).run(eventId, judgeId);
  const db = { prepare(sql) {
    const statement = sqlite.prepare(sql); let values = [];
    const bound = { bind(...args) { values = args; return bound; },
      async first() { return statement.get(...values) || null; },
      async all() { return { results: statement.all(...values) }; },
      async run() { return { success: true, meta: statement.run(...values) }; } };
    return bound;
  } };
  const env = { DB: db, JUDGING_SUPABASE_URL: 'https://testing.supabase.co', JUDGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_testing', JUDGING_LEVITATE_EVENT_IDS: eventId };
  const data = {
    events: [{ id: eventId, slug: 'levitate-web', name: 'Levitate Web', event_type: 'event' }],
    judges: [{ event_id: eventId, judge_id: judgeId, name: 'Juez Web', role: 'judge', assigned_block_ids: [] }],
    blocks: [{ event_id: eventId, block_id: 'b1' }, { event_id: eventId, block_id: 'b2' }],
    routines, criteria_templates: templates.map(t => ({ ...t, event_id: eventId })), criteria: criteria.map(c => ({ ...c, event_id: eventId })),
    scores: [row()], feedback: [], penalties: [], routine_favorite_votes: [], routine_favorites: [],
  };
  const calls = [];
  let writeStatus = 204;
  const fetcher = async (input, options) => {
    const url = new URL(input), table = url.pathname.split('/').pop();
    calls.push({ url, ...options });
    if (options.method !== 'GET') return new Response(writeStatus === 204 ? null : 'upstream secret must not leak', { status: writeStatus });
    let rows = Number(url.searchParams.get('offset')) > 0 ? [] : (data[table] || []);
    for (const key of ['event_id', 'judge_id', 'routine_id', 'id']) {
      const filter = url.searchParams.get(key);
      if (filter?.startsWith('eq.')) rows = rows.filter(row => row[key] === filter.slice(3));
      if (filter?.startsWith('in.(')) rows = rows.filter(row => filter.slice(4, -1).split(',').includes(row[key]));
    }
    return Response.json(rows);
  };
  const request = (action, { body, event = eventId, origin = 'https://levitate.mx', judge } = {}) => new Request(`https://levitate.mx/api/registration/judge/${action}?event_id=${event}${judge ? `&judge_id=${judge}` : ''}`, {
    method: body ? 'POST' : 'GET', headers: body ? { origin, 'content-type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { sqlite, env, data, calls, fetcher, request, password, setWriteStatus(value) { writeStatus = value; } };
}

test('the existing Levitate login issues its normal HttpOnly session and identifies a judge without changing the legacy role', async t => {
  const f = fixture(t);
  const response = await worker.fetch(new Request('https://levitate.mx/api/registration/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'juezweb', password: f.password }),
  }), f.env);
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.user.role, 'judge');
  assert.match(response.headers.get('set-cookie'), /levitate_registration_session=.*HttpOnly.*SameSite=Lax.*Secure/);
  assert.equal(f.sqlite.prepare('SELECT role,is_judge FROM registration_users').get().role, 'academy');
  const cookie = response.headers.get('set-cookie').split(';')[0];
  f.env.ASSETS = { fetch: async () => new Response('authenticated judge app') };
  const page = await worker.fetch(new Request('https://levitate.mx/jueceo/app/', { headers: { cookie } }), f.env);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), 'authenticated judge app');
  assert.match(page.headers.get('cache-control'), /no-store/);
  const privateEntry = await worker.fetch(new Request('https://levitate.mx/jueceo/app/'), f.env);
  assert.equal(privateEntry.status, 302);
  assert.equal(privateEntry.headers.get('location'), '/login');
  for (const path of ['/api/registration/admin/judging/events', '/api/registration/participants']) {
    const denied = await worker.fetch(new Request(`https://levitate.mx${path}`, { headers: { cookie } }), f.env);
    assert.equal(denied.status, 403, path);
  }
  const missing = await worker.fetch(new Request('https://levitate.mx/api/registration/judge/session'), f.env);
  assert.equal(missing.status, 401);
  assert.equal(missing.headers.get('cache-control'), 'no-store, private');
});

test('judge sessions only include their explicit Levitate assignment and never other judges', async t => {
  const f = fixture(t);
  const response = await handleJudgeWorkspace(f.request('session'), f.env, session, { fetcher: f.fetcher });
  const result = await response.json();
  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignments[0].judge.judge_id, judgeId);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.ok(f.calls.every(call => call.method === 'GET'));
});

test('academy and admin accounts cannot use judge endpoints', async t => {
  const f = fixture(t);
  for (const role of ['academy', 'admin']) {
    await assert.rejects(handleJudgeWorkspace(f.request('session'), f.env, { user: { id: 'judge-user', role } }, { fetcher: f.fetcher }), error => error.statusCode === 403);
  }
  assert.equal(f.calls.length, 0);
});

test('revoked grants, other events, admins in Core, archived events and other brands fail closed', async t => {
  const f = fixture(t);
  await assert.rejects(handleJudgeWorkspace(f.request('bundle', { event: otherEvent }), f.env, session, { fetcher: f.fetcher }), error => error.statusCode === 403);
  assert.equal(f.calls.length, 0);
  f.data.judges[0].role = 'admin';
  await assert.rejects(handleJudgeWorkspace(f.request('bundle'), f.env, session, { fetcher: f.fetcher }), error => error.statusCode === 403);
  f.data.judges[0].role = 'judge'; f.data.events[0].event_type = 'archived';
  await assert.rejects(handleJudgeWorkspace(f.request('bundle'), f.env, session, { fetcher: f.fetcher }), error => error.statusCode === 403);
  f.env.JUDGING_LEVITATE_EVENT_IDS = otherEvent;
  const response = await handleJudgeWorkspace(f.request('session'), f.env, session, { fetcher: f.fetcher });
  assert.deepEqual((await response.json()).assignments, []);
});

test('bundle intersects website and Core block assignments and filters own saved data', async t => {
  const f = fixture(t);
  f.sqlite.prepare('UPDATE registration_judge_assignments SET block_ids_json=?').run('["b1"]');
  f.data.judges[0].assigned_block_ids = ['b1', 'b2'];
  f.data.scores.push(row({ routine_id: 'r3', block_id: 'b2' }));
  const response = await handleJudgeWorkspace(f.request('bundle'), f.env, session, { fetcher: f.fetcher });
  const result = await response.json();
  assert.deepEqual(result.routines.map(r => r.routine_id), ['r1', 'r2']);
  assert.deepEqual(result.blocks.map(b => b.block_id), ['b1']);
  assert.equal(result.scores.length, 1);
  assert.equal(result.judges.length, 1);
  const scoreRead = f.calls.find(c => c.url.pathname.endsWith('/scores'));
  assert.equal(scoreRead.url.searchParams.get('judge_id'), `eq.${judgeId}`);
});

for (const [label, extra] of [
  ['foreign judge', { judge_id: 'another' }], ['foreign event', { event_id: otherEvent }],
  ['wrong block', { block_id: 'b2' }], ['unknown routine', { routine_id: 'missing' }],
  ['wrong template criterion', { criterion_id: 2 }], ['over maximum', { value: 11 }],
  ['negative', { value: -1 }], ['fractional', { value: 1.5 }], ['string', { value: '8' }],
]) test(`score validation rejects ${label} before a write`, () => {
  assert.throws(() => validateJudgeRows('scores', [row(extra)], scope, routines, templates, criteria));
});

test('zero scores remain real scores and all rows are validated without trusting extra columns', () => {
  const clean = validateJudgeRows('scores', [row({ value: 0, role: 'admin', submitted_at: 'tampered' })], scope, routines, templates, criteria);
  assert.equal(clean[0].value, 0);
  assert.equal(clean[0].judge_id, judgeId);
  assert.equal(Object.hasOwn(clean[0], 'role'), false);
  assert.equal(Object.hasOwn(clean[0], 'submitted_at'), false);
  assert.throws(() => validateJudgeRows('scores', [row(), row({ value: 99 })], scope, routines, templates, criteria));
  assert.throws(() => validateJudgeRows('scores', [row({ routine_id: 'r3', block_id: 'b2' })], { ...scope, blocks: ['b1'] }, routines, templates, criteria));
});

test('writes reject cross-origin requests, preserve structured errors and only send authorized rows', async t => {
  const f = fixture(t);
  await assert.rejects(handleJudgeWorkspace(f.request('scores', { body: { rows: [row()] }, origin: 'https://another.invalid' }), f.env, session, { fetcher: f.fetcher }), e => e.statusCode === 403);
  assert.equal(f.calls.filter(c => c.method === 'POST').length, 0);
  const response = await handleJudgeWorkspace(f.request('scores', { body: { rows: [row()] } }), f.env, session, { fetcher: f.fetcher });
  assert.deepEqual(await response.json(), { ok: true });
  const write = f.calls.find(c => c.method === 'POST');
  assert.equal(write.url.pathname, '/rest/v1/scores');
  assert.equal(JSON.parse(write.body)[0].judge_id, judgeId);
  f.setWriteStatus(403);
  await assert.rejects(handleJudgeWorkspace(f.request('scores', { body: { rows: [row()] } }), f.env, session, { fetcher: f.fetcher }), e => e.statusCode === 502 && e.message.includes('HTTP 403') && !e.message.includes('secret'));
});

test('multiple favorites are allowed and removing one cannot remove a different routine or judge', async t => {
  const f = fixture(t);
  await handleJudgeWorkspace(f.request('favorites', { body: { rows: [row({ category: 'costume' }), row({ category: 'costume', routine_id: 'r2' })] } }), f.env, session, { fetcher: f.fetcher });
  assert.equal(JSON.parse(f.calls.find(c => c.method === 'POST').body).length, 2);
  await handleJudgeWorkspace(f.request('delete-favorites', { body: { rows: [row({ category: 'costume' })] } }), f.env, session, { fetcher: f.fetcher });
  const deletes = f.calls.filter(c => c.method === 'DELETE');
  assert.equal(deletes.length, 2);
  assert.ok(deletes.every(c => c.url.searchParams.get('routine_id') === 'eq.r1'
    && c.url.searchParams.get('judge_id') === `eq.${judgeId}` && c.url.searchParams.get('event_id') === `eq.${eventId}`
    && c.url.searchParams.get('category') === 'in.(costume,favorite_1)'));
});

test('feedback and penalties keep native limits', () => {
  assert.throws(() => validateJudgeRows('feedback', [row({ body: 'a'.repeat(351) })], scope, routines, templates, criteria));
  assert.equal(validateJudgeRows('feedback', [row({ body: '' })], scope, routines, templates, criteria)[0].body, '');
  for (const value of [1, -101, null, '0']) assert.throws(() => validateJudgeRows('penalties', [row({ value })], scope, routines, templates, criteria));
  assert.equal(validateJudgeRows('penalties', [row({ value: -3 })], scope, routines, templates, criteria)[0].value, -3);
});
