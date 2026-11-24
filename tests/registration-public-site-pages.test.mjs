import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import worker from '../worker/index.js';
import { sitePages, resolveSiteMetadata } from '../shared/site-seo.js';
import { servePublicSitePage } from '../worker/public-site-pages.js';

const origin = 'https://levitate.mx';
const paths = [...new Set(sitePages.flatMap(page => page.path === '/' ? ['/'] : [page.path, `${page.path}/`]))];
const aliases = ['/sedes', '/sedes/', '/sedes/edomex', '/sedes/edomex/', '/sedes/orizaba', '/sedes/orizaba/', '/premio-releve', '/premio-releve/',
  '/modalidades/releve', '/modalidades/releve/', '/modalidades/levitate-releve', '/modalidades/levitate-releve/'];

function fixture() {
  const calls = [];
  const env = {
    DB: { prepare() { throw new Error('Public site pages must never read the session or database'); } },
    ASSETS: { async fetch(request) {
      calls.push(request);
      const match = new URL(request.url).pathname.match(/^\/__seo\/([^/]+)\/$/);
      assert.ok(match, 'fetches an exact internal directory without an HTML redirect');
      const page = sitePages.find(page => page.key === match[1]);
      assert.ok(page);
      return new Response(`<html><head><title>${page.title}</title></head><body><div id="root" data-site-page="${page.key}"></div></body></html>`, {
        headers: { 'content-type': 'text/html; charset=utf-8', etag: `"${page.key}"`, 'cache-control': 'public, max-age=0, must-revalidate' },
      });
    } },
  };
  return { env, calls };
}

test('all sitemap pages, aliases and trailing slashes receive their own static HTML through the actual Worker', async () => {
  for (const path of [...paths, ...aliases]) {
    const { env, calls } = fixture();
    const page = resolveSiteMetadata(path);
    assert.ok(page, path);
    const response = await worker.fetch(new Request(`${origin}${path}?utm_source=academia`, {
      headers: { cookie: 'private-session=secret', authorization: 'Bearer private',
        'if-none-match': 'old-shell', 'if-modified-since': 'Sun, 15 Nov 2026 00:00:00 GMT', 'sec-fetch-mode': 'navigate' },
    }), env, {});
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('x-robots-tag'), null);
    assert.match(await response.text(), new RegExp(`data-site-page="${page.key}"`));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${origin}/__seo/${page.key}/`);
    assert.equal(calls[0].method, 'GET');
    for (const name of ['cookie', 'authorization', 'if-none-match', 'if-modified-since', 'sec-fetch-mode']) {
      assert.equal(calls[0].headers.get(name), null, name);
    }
  }
});

test('public HEAD responses have matching headers and no body, with no conditional-shell 304 failure', async () => {
  for (const page of sitePages) {
    const { env, calls } = fixture();
    const response = await worker.fetch(new Request(`${origin}${page.path}`, { method: 'HEAD' }), env, {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('etag'), `"${page.key}"`);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(await response.text(), '');
    assert.equal(calls[0].method, 'GET');
  }
});

test('internal build document URLs cannot be opened directly or included in indexing', async () => {
  for (const path of ['/__seo', '/__seo/', '/__seo/home/', '/__seo/motion/index.html']) {
    for (const method of ['GET', 'HEAD', 'POST']) {
      const { env, calls } = fixture();
      const response = await worker.fetch(new Request(`${origin}${path}`, { method }), env, {});
      assert.equal(response.status, 404);
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      assert.equal(calls.length, 0);
    }
  }
});

test('missing, redirected or invalid build files never publish the homepage shell or an internal redirect', async () => {
  const cases = [
    () => new Response('<div id="root"></div>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('<div data-site-page="motion"></div>', { headers: { 'content-type': 'text/html' } }),
    () => new Response(null, { status: 307, headers: { location: '/__seo/home/' } }),
    () => new Response('not found', { status: 404 }),
    () => new Response('<div data-site-page="home"></div>', { headers: { 'content-type': 'application/json' } }),
    () => { throw new Error('PRIVATE CONFIGURATION DETAILS'); },
  ];
  for (const fetch of cases) {
    const response = await servePublicSitePage(new Request(origin), { ASSETS: { fetch } });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('retry-after'), '60');
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.doesNotMatch(await response.text(), /PRIVATE|__seo|id="root"/);
  }
});

test('the public HTML handler never handles APIs, personal pages, logins, judging, uploads or non-GET actions', async () => {
  const { env, calls } = fixture();
  for (const path of ['/api/registration/participants', '/api/releve-voting', '/admin', '/admin/mi-levitate',
    '/mi-levitate', '/mi-levitate/demo', '/login', '/registro', '/registro/academias', '/jueceo', '/jueceo/admin',
    '/jueceo/dictamen', '/votacion-releve', '/assets/image.jpg', '/unknown', '/inscripciones/consulta-curp']) {
    assert.equal(await servePublicSitePage(new Request(`${origin}${path}`), env), null, path);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.equal(await servePublicSitePage(new Request(origin, { method }), env), null, method);
  }
  assert.equal(calls.length, 0);
  const unknownApi = await worker.fetch(new Request(`${origin}/api/unknown`), env, {});
  assert.equal(unknownApi.status, 404);
  assert.equal(calls.length, 0);
});

test('Cloudflare runs the Worker for every public path and internal build path before SPA asset routing', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  for (const path of [...paths, ...aliases, '/__seo', '/__seo/*']) {
    assert.ok(config.assets.run_worker_first.includes(path), path);
  }
  for (const path of ['/api/*', '/jueceo/admin', '/jueceo/dictamen']) assert.ok(config.assets.run_worker_first.includes(path));
});
