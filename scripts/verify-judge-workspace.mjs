import assert from 'node:assert/strict';

// Credentials arrive over stdin, never command arguments, source or log files.
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log('Ready for judge verification credentials on stdin (input is hidden).');
const input = await new Promise(resolve => {
  let text = '';
  process.stdin.on('data', chunk => { text += chunk; if (text.includes('\n')) { process.stdin.pause(); resolve(text.split('\n')[0]); } });
  process.stdin.resume();
});
if (process.stdin.isTTY) process.stdin.setRawMode(false);
const { origin, username, password } = JSON.parse(input);
assert.ok(['https://levitate.mx', 'http://localhost:5173'].includes(origin));
const login = await fetch(`${origin}/api/registration/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
assert.equal(login.status, 200);
assert.equal((await login.json()).user.role, 'judge');
const cookie = login.headers.get('set-cookie').split(';')[0];
const call = async (action, { eventId, rows } = {}) => {
  const response = await fetch(`${origin}/api/registration/judge/${action}${eventId ? `?event_id=${eventId}` : ''}`, {
    method: rows ? 'POST' : 'GET', headers: { cookie, origin, 'content-type': 'application/json' }, ...(rows ? { body: JSON.stringify({ rows }) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.match(response.headers.get('cache-control'), /no-store/);
  return result;
};
const session = await call('session');
assert.equal(session.assignments.length, 1);
const { event, judge } = session.assignments[0];
assert.equal(event.slug, 'levitate-web-pruebas', 'Writes are restricted to the newly created isolated test event.');
const bundle = await call('bundle', { eventId: event.id });
assert.equal(bundle.judges.length, 1);
assert.equal(bundle.judges[0].judge_id, judge.judge_id);
assert.ok(bundle.routines.length >= 2);
const routine = bundle.routines[0];
const template = bundle.criteria_templates.find(t => t.genre === routine.genre)
  || bundle.criteria_templates.find(t => t.template_id === 'danza-aerea');
const criteria = bundle.criteria.filter(c => c.template_id === template.template_id);
assert.equal(criteria.reduce((sum, c) => sum + Number(c.max_score), 0), 70);
const base = r => ({ event_id: event.id, judge_id: judge.judge_id, block_id: r.block_id, routine_id: r.routine_id, device_id: 'web-verification' });
await call('scores', { eventId: event.id, rows: criteria.map(c => ({ ...base(routine), criterion_id: c.criterion_id, value: Number(c.max_score) })) });
await call('feedback', { eventId: event.id, rows: [{ ...base(routine), body: 'Prueba de sincronizacion web.' }] });
await call('penalties', { eventId: event.id, rows: [{ ...base(routine), value: 0 }] });
await call('favorites', { eventId: event.id, rows: bundle.routines.slice(0, 2).map(r => ({ ...base(r), category: 'costume' })) });
const readBack = await call('bundle', { eventId: event.id });
assert.equal(readBack.scores.filter(s => s.routine_id === routine.routine_id).length, criteria.length);
assert.equal(readBack.favorites.filter(f => f.category === 'costume').length, 2);
await call('delete-favorites', { eventId: event.id, rows: [{ ...base(routine), category: 'costume' }] });
const afterDelete = await call('bundle', { eventId: event.id });
assert.equal(afterDelete.favorites.filter(f => f.category === 'costume').length, 1);
assert.equal(afterDelete.favorites.find(f => f.category === 'costume').routine_id, bundle.routines[1].routine_id);
const anonymous = await fetch(`${origin}/api/registration/judge/session`);
assert.equal(anonymous.status, 401);
const admin = await fetch(`${origin}/api/registration/admin/judging/events`, { headers: { cookie } });
assert.equal(admin.status, 403);
console.log(JSON.stringify({ login: true, ownJudgeOnly: true, scoreRowsVerified: criteria.length, maximum: 70, multipleFavorites: true, isolatedRemoval: true, adminDenied: true }));
