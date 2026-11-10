import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PHOTO_DRIVE_SCOPES, createPhotoDrivePkce, parsePhotoDriveArguments, startPhotoDriveOAuth,
  validateExpectedPhotoEmail, validateInstalledPhotoClient, validatePhotoDriveCallback } from '../scripts/connect-participant-photo-drive.mjs';

const email = 'ati.levitatemx@gmail.com';
const installed = { installed: { client_id: 'new-photo-client.apps.googleusercontent.com', client_secret: 'synthetic-photo-client-secret',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth', token_uri: 'https://oauth2.googleapis.com/token' } };
const client = validateInstalledPhotoClient(installed);
const token = () => ({ access_token: 'synthetic-photo-access', refresh_token: 'synthetic-photo-refresh', token_type: 'Bearer', scope: PHOTO_DRIVE_SCOPES.join(' ') });

async function fixture(t, { fetchImpl, timeoutMs = 5000, filename = 'photo-credentials.json' } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'levitate-photo-oauth-'));
  const credentialsFile = join(directory, filename), calls = [];
  const fakeGoogle = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.redirect, 'manual'); assert.ok(options.signal instanceof AbortSignal);
    if (fetchImpl) return fetchImpl(url, options);
    if (url === 'https://oauth2.googleapis.com/token') return Response.json(token());
    assert.equal(url, 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
    return Response.json({ user: { emailAddress: email } });
  };
  const flow = await startPhotoDriveOAuth({ client, credentialsFile, expectedEmail: email, fetchImpl: fakeGoogle, timeoutMs });
  t.after(async () => { flow.close(); await flow.completion.catch(() => {}); await rm(directory, { force: true, recursive: true }); });
  const redirect = await fetch(flow.authorizeUrl, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  const authorize = new URL(redirect.headers.get('location'));
  const callback = new URL(authorize.searchParams.get('redirect_uri'));
  callback.searchParams.set('state', authorize.searchParams.get('state')); callback.searchParams.set('code', 'synthetic-authorization-code');
  return { ...flow, credentialsFile, calls, authorize, callback, directory };
}

test('only a dedicated installed Desktop JSON is accepted and CLI paths cannot overwrite the source', () => {
  assert.deepEqual(client, { clientId: installed.installed.client_id, clientSecret: installed.installed.client_secret });
  for (const value of [{ web: installed.installed }, { ...installed, web: {} }, { installed: { ...installed.installed, token_uri: 'https://evil.test/token' } },
    { installed: { ...installed.installed, auth_uri: 'https://evil.test/auth' } }, { installed: { client_id: 'bad-client' } }, null]) {
    assert.throws(() => validateInstalledPhotoClient(value), { code: 'invalid_desktop_client' });
  }
  const args = parsePhotoDriveArguments(['--client-file', '/private/tmp/client.json', '--credentials-file', '/private/tmp/new-photo.json']);
  assert.equal(args.expectedEmail, email); assert.equal(args.timeoutMs, 600000);
  assert.throws(() => parsePhotoDriveArguments(['--client-file', '/tmp/a.json', '--credentials-file', '/tmp/a.json']), { code: 'invalid_arguments' });
  assert.throws(() => parsePhotoDriveArguments(['--client-secret', 'synthetic-secret']), { code: 'invalid_arguments' });
  assert.throws(() => parsePhotoDriveArguments(['--client-file', '/tmp/a', '--credentials-file', '/tmp/b', '--client-file', '/tmp/c']), { code: 'invalid_arguments' });
  assert.throws(() => validateExpectedPhotoEmail('ati@@gmail.com'), { code: 'invalid_email' });
});

test('state and PKCE are fresh, bounded and use the S256 challenge', () => {
  const a = createPhotoDrivePkce(), b = createPhotoDrivePkce();
  assert.match(a.state, /^[A-Za-z0-9_-]{43}$/); assert.match(a.verifier, /^[A-Za-z0-9_-]{86}$/);
  assert.equal(a.challenge, createHash('sha256').update(a.verifier).digest('base64url'));
  assert.notEqual(a.state, b.state); assert.notEqual(a.verifier, b.verifier);
});

test('callback validates exact loopback host, path, method, state, code bounds and denial', () => {
  const context = { port: 12345, state: 'expected-state' };
  const good = { method: 'GET', host: '127.0.0.1:12345', url: '/oauth/callback?state=expected-state&code=valid-code' };
  assert.deepEqual(validatePhotoDriveCallback(good, context), { code: 'valid-code' });
  for (const override of [ { method: 'POST' }, { host: 'localhost:12345' }, { host: 'evil.test' }, { url: '//evil.test/oauth/callback?state=expected-state&code=a' },
    { url: '/other?state=expected-state&code=a' }, { url: '/oauth/callback?state=wrong-state&code=a' },
    { url: '/oauth/callback?state=expected-state&state=expected-state&code=a' }, { url: '/oauth/callback?state=expected-state&code=a&code=b' },
    { url: '/oauth/callback?state=expected-state&code=contains%0Anewline' }, { url: `/oauth/callback?state=expected-state&code=${'a'.repeat(8200)}` },
    { url: '/oauth/callback?state=expected-state&error=access_denied&code=also-a-code' },
    { url: `/oauth/callback?state=expected-state&error=access_denied&error_description=${'a'.repeat(1001)}` }]) {
    assert.throws(() => validatePhotoDriveCallback({ ...good, ...override }, context), { code: 'invalid_callback' });
  }
  assert.deepEqual(validatePhotoDriveCallback({ ...good, url: '/oauth/callback?state=expected-state&error=access_denied' }, context), { denied: true });
});

test('successful loopback flow verifies Ati before writing only the four new secrets with mode 0600', async t => {
  const f = await fixture(t);
  assert.match(f.authorizeUrl, /^http:\/\/127\.0\.0\.1:\d+\/authorize$/);
  assert.equal(f.authorize.origin, 'https://accounts.google.com');
  for (const [key, value] of Object.entries({ login_hint: email, prompt: 'consent', access_type: 'offline', code_challenge_method: 'S256', response_type: 'code' })) {
    assert.equal(f.authorize.searchParams.get(key), value);
  }
  assert.deepEqual(new Set(f.authorize.searchParams.get('scope').split(' ')), new Set(PHOTO_DRIVE_SCOPES));
  assert.equal(f.authorize.searchParams.has('client_secret'), false);
  assert.equal(f.calls.length, 0, 'merely opening authorize does not exchange credentials');
  const response = await fetch(f.callback);
  assert.equal(response.status, 200);
  assert.doesNotMatch(await response.text(), /synthetic-|refresh_token|client_secret|authorization-code/);
  await f.completion;
  assert.equal(f.calls.length, 2);
  const exchange = f.calls[0].options.body;
  assert.equal(exchange.get('grant_type'), 'authorization_code');
  assert.equal(exchange.get('code'), 'synthetic-authorization-code');
  assert.equal(createHash('sha256').update(exchange.get('code_verifier')).digest('base64url'), f.authorize.searchParams.get('code_challenge'));
  assert.equal(f.calls[1].options.headers.authorization, 'Bearer synthetic-photo-access');
  assert.equal((await stat(f.credentialsFile)).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(await readFile(f.credentialsFile, 'utf8')), {
    PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID: installed.installed.client_id,
    PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_SECRET: installed.installed.client_secret,
    PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN: 'synthetic-photo-refresh',
    PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL: email,
  });
});

test('invalid state and foreign Host cannot exchange tokens or consume the valid callback', async t => {
  const f = await fixture(t), wrong = new URL(f.callback);
  wrong.searchParams.set('state', 'not-the-expected-state');
  assert.equal((await fetch(wrong)).status, 400);
  const foreignHostStatus = await new Promise((resolveStatus, rejectRequest) => {
    const request = httpRequest(f.callback, { headers: { host: 'attacker.test' } }, response => { response.resume(); resolveStatus(response.statusCode); });
    request.on('error', rejectRequest); request.end();
  });
  assert.equal(foreignHostStatus, 400);
  assert.equal(f.calls.length, 0);
  assert.equal((await fetch(f.callback)).status, 200); await f.completion;
});

test('a callback is consumed once even while the first token exchange is pending', async t => {
  let release, began;
  const pending = new Promise(resolvePending => { release = resolvePending; });
  const entered = new Promise(resolveEntered => { began = resolveEntered; });
  const f = await fixture(t, { fetchImpl: async url => {
    if (url === 'https://oauth2.googleapis.com/token') { began(); await pending; return Response.json(token()); }
    return Response.json({ user: { emailAddress: email } });
  } });
  const first = fetch(f.callback); await entered;
  assert.equal((await fetch(f.callback)).status, 409);
  release(); assert.equal((await first).status, 200); await f.completion;
  assert.equal(f.calls.filter(call => call.url === 'https://oauth2.googleapis.com/token').length, 1);
});

test('denial completes without Google requests or a credentials file', async t => {
  const f = await fixture(t), denial = new URL(f.callback);
  denial.searchParams.delete('code'); denial.searchParams.set('error', 'access_denied');
  assert.equal((await fetch(denial)).status, 400);
  await assert.rejects(f.completion, { code: 'authorization_denied' });
  assert.equal(f.calls.length, 0); await assert.rejects(stat(f.credentialsFile), { code: 'ENOENT' });
});

test('a different Google account never reaches the credential-file write', async t => {
  const f = await fixture(t, { fetchImpl: async url => url === 'https://oauth2.googleapis.com/token'
    ? Response.json(token()) : Response.json({ user: { emailAddress: 'music@example.test' } }) });
  assert.equal((await fetch(f.callback)).status, 400);
  await assert.rejects(f.completion, { code: 'wrong_google_account' });
  await assert.rejects(stat(f.credentialsFile), { code: 'ENOENT' });
});

test('missing offline consent, insufficient scopes and redirects fail without storing credentials', async t => {
  for (const scenario of ['missing_refresh_token', 'missing_drive_scope', 'redirect']) {
    const f = await fixture(t, { fetchImpl: async () => {
      const data = token();
      if (scenario === 'missing_refresh_token') delete data.refresh_token;
      if (scenario === 'missing_drive_scope') data.scope = PHOTO_DRIVE_SCOPES[0];
      return scenario === 'redirect' ? new Response(null, { status: 302, headers: { location: 'https://evil.test/token' } }) : Response.json(data);
    } });
    assert.equal((await fetch(f.callback)).status, 400);
    await assert.rejects(f.completion, { code: scenario === 'redirect' ? 'provider_rejected' : scenario });
    assert.equal(f.calls.length, 1); await assert.rejects(stat(f.credentialsFile), { code: 'ENOENT' });
  }
});

test('an existing credential file is preserved byte-for-byte', async t => {
  const f = await fixture(t); await writeFile(f.credentialsFile, 'existing protected content', { mode: 0o600 });
  assert.equal((await fetch(f.callback)).status, 400);
  await assert.rejects(f.completion, { code: 'credentials_file_exists' });
  assert.equal(await readFile(f.credentialsFile, 'utf8'), 'existing protected content');
});

test('provider failures never return token/code details to browser or completion errors', async t => {
  const f = await fixture(t, { fetchImpl: async () => { throw new Error('synthetic-secret-code-and-token'); } });
  const response = await fetch(f.callback);
  assert.equal(response.status, 400); assert.doesNotMatch(await response.text(), /synthetic-secret/);
  await assert.rejects(f.completion, error => { assert.equal(error.code, 'provider_rejected'); assert.doesNotMatch(error.message, /synthetic-secret/); return true; });
  await assert.rejects(stat(f.credentialsFile), { code: 'ENOENT' });
});

test('unused setup times out and closes its loopback listener without provider calls', async t => {
  const f = await fixture(t, { timeoutMs: 100 });
  await assert.rejects(f.completion, { code: 'authorization_timeout' });
  assert.equal(f.calls.length, 0); await assert.rejects(stat(f.credentialsFile), { code: 'ENOENT' });
  await assert.rejects(fetch(f.authorizeUrl));
});

test('expiration aborts an in-flight provider exchange and cannot create credentials', async t => {
  let aborted = false;
  const f = await fixture(t, { timeoutMs: 100, fetchImpl: (url, { signal }) => new Promise((resolveResponse, rejectResponse) => {
    signal.addEventListener('abort', () => { aborted = true; rejectResponse(new Error('synthetic-private-provider-detail')); }, { once: true });
  }) });
  const callback = fetch(f.callback);
  await assert.rejects(f.completion, { code: 'authorization_timeout' });
  assert.equal((await callback).status, 400);
  assert.equal(aborted, true); await assert.rejects(stat(f.credentialsFile), { code: 'ENOENT' });
});

test('the executable prints only its local start URL and sanitized failure status', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'levitate-photo-oauth-cli-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const clientFile = join(directory, 'dedicated-desktop.json'), credentialsFile = join(directory, 'photo-private.json');
  await writeFile(clientFile, JSON.stringify(installed), { mode: 0o600 });
  const script = fileURLToPath(new URL('../scripts/connect-participant-photo-drive.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--client-file', clientFile, '--credentials-file', credentialsFile, '--timeout-ms', '1000'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^http:\/\/127\.0\.0\.1:\d+\/authorize\n$/);
  assert.equal(result.stderr, 'No se completó la conexión de fotografías (authorization_timeout).\n');
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-photo|client_secret|refresh_token|code_verifier/);
  await assert.rejects(stat(credentialsFile), { code: 'ENOENT' });
});
