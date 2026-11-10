#!/usr/bin/env node
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PHOTO_DRIVE_SCOPES = Object.freeze([
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
]);
const callbackPath = '/oauth/callback';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const aboutEndpoint = 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)';
const defaultEmail = 'ati.levitatemx@gmail.com';

function failure(code, message = 'No se pudo completar la conexión independiente de fotografías.') {
  return Object.assign(new Error(message), { code });
}
function text(value, max = 4096) {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u0020\u007f]/.test(value);
}
export function validateExpectedPhotoEmail(value = defaultEmail) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw failure('invalid_email', 'La cuenta esperada de fotografías no es válida.');
  }
  return value.toLowerCase();
}
export function validateInstalledPhotoClient(value) {
  const client = value?.installed;
  if (!client || typeof client !== 'object' || Array.isArray(client) || value.web
    || !text(client.client_id, 512) || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(client.client_id)
    || !text(client.client_secret)
    || (client.token_uri !== undefined && client.token_uri !== tokenEndpoint)
    || (client.auth_uri !== undefined && !['https://accounts.google.com/o/oauth2/auth', 'https://accounts.google.com/o/oauth2/v2/auth'].includes(client.auth_uri))) {
    throw failure('invalid_desktop_client', 'Usa el JSON de un cliente Desktop nuevo y exclusivo para fotografías.');
  }
  return { clientId: client.client_id, clientSecret: client.client_secret };
}
export function parsePhotoDriveArguments(argv) {
  const result = { expectedEmail: defaultEmail, timeoutMs: 600000 };
  const names = new Map([['--client-file', 'clientFile'], ['--credentials-file', 'credentialsFile'], ['--expected-email', 'expectedEmail'], ['--timeout-ms', 'timeoutMs']]);
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 2) {
    const name = names.get(argv[i]), value = argv[i + 1];
    if (!name || seen.has(name) || typeof value !== 'string' || !value || value.startsWith('--')) throw failure('invalid_arguments', 'Indica --client-file y --credentials-file; cada opción se admite una sola vez.');
    seen.add(name); result[name] = value;
  }
  if (!result.clientFile || !result.credentialsFile) throw failure('invalid_arguments', 'Indica --client-file y --credentials-file.');
  result.clientFile = resolve(result.clientFile); result.credentialsFile = resolve(result.credentialsFile);
  if (result.clientFile === result.credentialsFile) throw failure('invalid_arguments', 'El archivo de credenciales debe ser un archivo nuevo.');
  result.expectedEmail = validateExpectedPhotoEmail(result.expectedEmail);
  result.timeoutMs = Number(result.timeoutMs);
  if (!Number.isSafeInteger(result.timeoutMs) || result.timeoutMs < 1000 || result.timeoutMs > 900000) throw failure('invalid_timeout', 'El tiempo de espera debe estar entre 1000 y 900000 milisegundos.');
  return result;
}
export function createPhotoDrivePkce() {
  const verifier = randomBytes(64).toString('base64url');
  return { state: randomBytes(32).toString('base64url'), verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}
function loopbackUrl(request, port) {
  if (request.method !== 'GET' || request.host !== `127.0.0.1:${port}` || typeof request.url !== 'string'
    || request.url.length > 8192 || !request.url.startsWith('/') || request.url.startsWith('//')) throw failure('invalid_callback');
  let url;
  try { url = new URL(request.url, `http://127.0.0.1:${port}`); } catch { throw failure('invalid_callback'); }
  if (url.origin !== `http://127.0.0.1:${port}` || url.hash || url.username || url.password) throw failure('invalid_callback');
  return url;
}
export function validatePhotoDriveCallback(request, { port, state }) {
  const url = loopbackUrl(request, port), params = url.searchParams;
  if (url.pathname !== callbackPath || params.getAll('state').length !== 1 || params.get('state')?.length !== state.length) throw failure('invalid_callback');
  const received = Buffer.from(params.get('state'));
  if (received.length !== Buffer.byteLength(state) || !timingSafeEqual(received, Buffer.from(state))) throw failure('invalid_callback');
  if (params.has('error')) {
    if (params.getAll('error').length !== 1 || params.has('code') || !/^[A-Za-z0-9_]{1,100}$/.test(params.get('error'))
      || (params.get('error_description')?.length || 0) > 1000 || (params.get('error_uri')?.length || 0) > 1000) throw failure('invalid_callback');
    return { denied: true };
  }
  if (params.getAll('code').length !== 1 || !text(params.get('code'))) throw failure('invalid_callback');
  return { code: params.get('code') };
}
function send(response, status, message, headers = {}) {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'", 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', ...headers });
  response.end(message);
}
async function readJson(response, maximum) {
  if (!response.ok || !response.body) throw failure('provider_rejected');
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if ((size += value.byteLength) > maximum) throw failure('provider_rejected');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw failure('provider_rejected'); }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
async function privateCredentialFile(path, credentials) {
  let file;
  try {
    file = await open(path, 'wx', 0o600);
    await file.writeFile(`${JSON.stringify(credentials, null, 2)}\n`, 'utf8');
  } catch (error) {
    throw failure(error?.code === 'EEXIST' ? 'credentials_file_exists' : 'credentials_file_write_failed', 'No se guardaron credenciales en un archivo existente; revisa el destino privado.');
  } finally { await file?.close().catch(() => {}); }
}

/** Starts a loopback-only, one-use desktop OAuth flow. The caller prints only
 * authorizeUrl and awaits completion; tokens never enter URLs or process args.
 */
export async function startPhotoDriveOAuth({ client, credentialsFile, expectedEmail = defaultEmail, fetchImpl = fetch, timeoutMs = 600000 } = {}) {
  const configured = validateInstalledPhotoClient({ installed: { client_id: client?.clientId, client_secret: client?.clientSecret } });
  const email = validateExpectedPhotoEmail(expectedEmail);
  if (typeof credentialsFile !== 'string' || !credentialsFile || typeof fetchImpl !== 'function'
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 20 || timeoutMs > 900000) throw failure('invalid_arguments');
  const material = createPhotoDrivePkce(), controller = new AbortController();
  let port, timer, used = false, settled = false, complete, reject;
  const completion = new Promise((resolveCompletion, rejectCompletion) => { complete = resolveCompletion; reject = rejectCompletion; });
  // A timeout can fire before the caller attaches its await in a slow terminal.
  completion.catch(() => {});
  const finish = (error, result) => {
    if (settled) return;
    settled = true; clearTimeout(timer); controller.abort(); server.close(); server.closeIdleConnections?.();
    if (error) reject(error); else complete(result);
  };
  const upstream = async (url, options, maxBytes) => {
    const timeout = AbortSignal.timeout(15000);
    const signal = AbortSignal.any([controller.signal, timeout]);
    try { return await readJson(await fetchImpl(url, { ...options, redirect: 'manual', signal }), maxBytes); }
    catch { throw failure('provider_rejected'); }
  };
  const server = createServer(async (request, response) => {
    const input = { method: request.method, host: request.headers.host, url: request.url };
    let url;
    try { url = loopbackUrl(input, port); } catch { send(response, 400, 'Solicitud local no válida.'); return; }
    if (url.pathname === '/authorize') {
      if (url.search || used || settled) { send(response, 409, 'Esta conexión ya fue utilizada o no es válida.'); return; }
      const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      for (const [key, value] of Object.entries({ client_id: configured.clientId, redirect_uri: `http://127.0.0.1:${port}${callbackPath}`,
        response_type: 'code', scope: PHOTO_DRIVE_SCOPES.join(' '), state: material.state, code_challenge: material.challenge,
        code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent', login_hint: email })) authorize.searchParams.set(key, value);
      send(response, 302, 'Abriendo la autorización de fotografías en Google.', { location: authorize.href }); return;
    }
    if (url.pathname !== callbackPath) { send(response, 404, 'No encontrado.'); return; }
    if (used || settled) { send(response, 409, 'Esta conexión ya fue utilizada.'); return; }
    let callback;
    try { callback = validatePhotoDriveCallback(input, { port, state: material.state }); }
    catch { send(response, 400, 'La autorización local no coincide.'); return; }
    used = true;
    if (callback.denied) { send(response, 400, 'No se autorizó la conexión de fotografías.'); finish(failure('authorization_denied')); return; }
    try {
      const token = await upstream(tokenEndpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ client_id: configured.clientId, client_secret: configured.clientSecret, code: callback.code,
          code_verifier: material.verifier, redirect_uri: `http://127.0.0.1:${port}${callbackPath}`, grant_type: 'authorization_code' }) }, 32768);
      if (!text(token.access_token, 8192) || !text(token.refresh_token, 8192) || token.token_type?.toLowerCase() !== 'bearer') throw failure('missing_refresh_token');
      const granted = new Set(typeof token.scope === 'string' ? token.scope.split(/\s+/) : []);
      if (PHOTO_DRIVE_SCOPES.some(scope => !granted.has(scope))) throw failure('missing_drive_scope');
      const about = await upstream(aboutEndpoint, { method: 'GET', headers: { authorization: `Bearer ${token.access_token}`, accept: 'application/json' } }, 8192);
      if (typeof about.user?.emailAddress !== 'string' || about.user.emailAddress.toLowerCase() !== email) throw failure('wrong_google_account', 'Google devolvió una cuenta distinta de la cuenta de fotografías esperada.');
      if (settled || controller.signal.aborted) throw failure('authorization_expired');
      await privateCredentialFile(credentialsFile, {
        PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_ID: configured.clientId,
        PARTICIPANT_PHOTO_DRIVE_OAUTH_CLIENT_SECRET: configured.clientSecret,
        PARTICIPANT_PHOTO_DRIVE_OAUTH_REFRESH_TOKEN: token.refresh_token,
        PARTICIPANT_PHOTO_DRIVE_ACCOUNT_EMAIL: email,
      });
      send(response, 200, 'Drive de fotografías conectado. Puedes volver a Codex. La conexión de música no se modificó.');
      finish(null, { accountEmail: email, credentialsFile });
    } catch (error) {
      send(response, 400, 'No se completó la conexión de fotografías. No se modificó la conexión de música.');
      finish(error?.code ? error : failure('authorization_failed'));
    }
  });
  server.requestTimeout = 20000; server.headersTimeout = 10000; server.maxHeadersCount = 30;
  await new Promise((listening, rejectListen) => {
    const error = () => rejectListen(failure('loopback_unavailable'));
    server.once('error', error);
    server.listen(0, '127.0.0.1', () => { server.removeListener('error', error); listening(); });
  });
  port = server.address().port;
  server.on('error', () => finish(failure('loopback_failed')));
  timer = setTimeout(() => finish(failure('authorization_timeout')), timeoutMs);
  return { authorizeUrl: `http://127.0.0.1:${port}/authorize`, completion, close: () => finish(failure('authorization_cancelled')) };
}

async function main() {
  let flow;
  try {
    const options = parsePhotoDriveArguments(process.argv.slice(2));
    let raw;
    try { raw = await readFile(options.clientFile, 'utf8'); } catch { throw failure('client_file_unreadable'); }
    if (Buffer.byteLength(raw) > 32768) throw failure('invalid_desktop_client');
    let json;
    try { json = JSON.parse(raw); } catch { throw failure('invalid_desktop_client'); }
    const client = validateInstalledPhotoClient(json);
    flow = await startPhotoDriveOAuth({ ...options, client });
    const cancel = () => flow.close();
    process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
    process.stdout.write(`${flow.authorizeUrl}\n`);
    try { await flow.completion; }
    finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); }
  } catch (error) {
    flow?.close();
    const code = typeof error?.code === 'string' && /^[a-z_]{1,60}$/.test(error.code) ? error.code : 'authorization_failed';
    process.stderr.write(`No se completó la conexión de fotografías (${code}).\n`);
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
