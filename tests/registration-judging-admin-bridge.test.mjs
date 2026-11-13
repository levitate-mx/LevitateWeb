import assert from 'node:assert/strict';
import test from 'node:test';
import { adminBridge, requireJudgingAdmin } from '../worker/judging-admin.js';

const eventId = '11111111-2222-4333-8444-555555555555';
const secret = 'fixture-only-shared-secret-not-a-real-credential'.repeat(2);
const env = {
  JUDGING_SUPABASE_URL: 'https://fixture.supabase.co',
  JUDGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  JUDGING_LEVITATE_EVENT_IDS: eventId,
  LEVITATE_ADMIN_WEB_SECRET: secret,
};
const session = { user: { id: 'admin-fixture', role: 'judging_admin' } };
const data = { block_id: 'b1', award: 'award_1', manual_value: 'Academia de prueba' };

test('administrative mutations send the shared service header and server-selected scope only', async () => {
  const result = await adminBridge(env, session, 'special-award', eventId, data, { fetcher: async (input, options) => {
    assert.equal(input, 'https://fixture.supabase.co/functions/v1/levitate-web-admin');
    assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'manual');
    const headers = new Headers(options.headers);
    assert.equal(headers.get('x-levitate-admin-secret'), secret);
    assert.ok(secret.length >= 40 && secret.length <= 200, 'the shared header satisfies the existing edge authorization bounds');
    assert.equal(headers.get('apikey'), env.JUDGING_SUPABASE_PUBLISHABLE_KEY);
    assert.deepEqual(JSON.parse(options.body), { action: 'special-award', event_id: eventId,
      allowed_event_ids: [eventId], actor_id: session.user.id, data });
    return Response.json({ ok: true });
  } });
  assert.deepEqual(result, { ok: true });
});

test('edge authorization failures become a service connection error instead of an account denial', async () => {
  for (const [status, body] of [[401, { error: 'No autorizado.' }], [401, { error: secret }],
    [401, { message: 'Invalid JWT' }], [403, { error: 'No autorizado.' }]]) {
    await assert.rejects(() => adminBridge(env, session, 'special-award', eventId, data,
      { fetcher: async () => Response.json(body, { status }) }), error => {
      assert.equal(error.code, 'judging_admin_connection_rejected');
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /conexión con el servicio de jueceo/);
      assert.match(error.message, /No se guardó el cambio/);
      assert.doesNotMatch(error.message, /No autorizado\.|fixture-only-shared-secret|sb_publishable_fixture/);
      return true;
    });
  }
});

test('RPC permission errors and concurrent-edit conflicts keep their existing meaning', async () => {
  for (const [status, message, expectedStatus] of [[403, 'El bloque no pertenece al evento autorizado.', 502],
    [409, 'La premiación cambió. Actualiza antes de guardar.', 409]]) {
    await assert.rejects(() => adminBridge(env, session, 'special-award', eventId, data,
      { fetcher: async () => Response.json({ error: message }, { status }) }), error => {
      assert.equal(error.code, 'judging_admin_rejected');
      assert.equal(error.statusCode, expectedStatus);
      assert.equal(error.message, message);
      return true;
    });
  }
});

test('upstream errors cannot echo the shared credential and public role guards still reject ordinary users', async () => {
  await assert.rejects(() => adminBridge(env, session, 'special-award', eventId, data,
    { fetcher: async () => Response.json({ error: `Conflicto interno: ${secret}` }, { status: 409 }) }), error => {
    assert.equal(error.statusCode, 409); assert.equal(error.code, 'judging_admin_rejected');
    assert.equal(error.message, 'Conflicto interno: [redactado]');
    return true;
  });
  for (const role of ['judge', 'academy', 'judging_viewer']) {
    assert.throws(() => requireJudgingAdmin({ user: { role } }), error => error.statusCode === 403 && error.code === 'judging_admin_forbidden');
  }
});
