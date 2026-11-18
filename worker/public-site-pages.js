import { resolveSiteMetadata } from '../shared/site-seo.js';

const unavailable = () => new Response('La página no está disponible temporalmente.', {
  status: 503,
  headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '60', 'x-robots-tag': 'noindex' },
});

// Only the public page allowlist can use these build-time HTML documents.
// The assets binding does not re-enter this Worker, so internal files can be
// served here while their direct URLs remain unavailable to visitors/crawlers.
export async function servePublicSitePage(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/__seo' || url.pathname.startsWith('/__seo/')) {
    return new Response(null, { status: 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
  }
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const metadata = resolveSiteMetadata(url.pathname);
  if (!metadata) return null;

  const assetUrl = new URL(`/__seo/${metadata.key}/`, url.origin);
  try {
    // Public HTML is identical for every visitor. Do not forward session
    // cookies, authentication, query parameters or conditional shell requests.
    const response = await env.ASSETS.fetch(new Request(assetUrl, { headers: { accept: 'text/html' } }));
    if (response.status !== 200 || !/^text\/html\b/i.test(response.headers.get('content-type') || '')) return unavailable();
    const html = await response.text();
    if (!html.includes(`data-site-page="${metadata.key}"`)) return unavailable();
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(request.method === 'HEAD' ? null : html, { status: 200, headers });
  } catch {
    return unavailable();
  }
}
