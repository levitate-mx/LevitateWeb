import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as seo from '../shared/site-seo.js';

const require = createRequire(import.meta.url);
const runtimeSource = await readFile(new URL('../src/components/seo/SiteMetadata.tsx', import.meta.url), 'utf8');
const runtime = { exports: {}, require(name) {
  return name.endsWith('/shared/site-seo.js') ? seo : require(name);
} };
vm.runInNewContext(ts.transpileModule(runtimeSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText, runtime);
const { applySiteMetadata, SiteMetadata } = runtime.exports;
const shell = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('the public metadata catalogue covers exactly the sitemap with distinct copy, absolute URLs and existing public images', async () => {
  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => new URL(url).pathname);
  assert.equal(seo.sitePages.length, 12);
  assert.deepEqual(seo.sitePages.map(page => page.path), paths);
  for (const field of ['key', 'path', 'title', 'description', 'canonical']) {
    assert.equal(new Set(seo.sitePages.map(page => page[field])).size, 12, `${field} must identify each page separately`);
  }
  for (const page of seo.sitePages) {
    assert.match(page.key, /^[a-z][a-z-]*$/);
    assert.ok(page.title.length >= 25 && page.title.length <= 65, page.title);
    assert.ok(page.description.length >= 100 && page.description.length <= 170, page.description);
    assert.equal(page.canonical, seo.siteOrigin + page.path);
    assert.equal(new URL(page.image).origin, seo.siteOrigin);
    assert.ok(page.imageAlt.length > 10);
    assert.doesNotMatch(page.title + page.description, /\b20\d{2}\b|MXN|\$|inscripciones abiertas/i,
      'the metadata must not introduce dates, prices or time-sensitive registration claims');
    await access(new URL('../public' + new URL(page.image).pathname, import.meta.url));
  }
  assert.equal(seo.resolveSiteMetadata('/modalidades/levitate-motion/generos').title, 'Competencia de danza escénica | Levitate Motion');
  assert.equal(seo.resolveSiteMetadata('/modalidades/levitate-aerial/evaluacion').title, 'Competencia de danza aérea en México | Levitate Aerial');
});

test('existing public aliases, trailing slashes, queries and fragments point to the same canonical page', () => {
  const releve = seo.resolveSiteMetadata('/releve');
  for (const alias of ['/releve/', '/premio-releve', '/premio-releve/', '/modalidades/releve', '/modalidades/levitate-releve/']) {
    assert.strictEqual(seo.resolveSiteMetadata(alias + '?utm_source=campaign#reglas'), releve);
  }
  const edomex = seo.resolveSiteMetadata('/sedes/estado-de-mexico');
  for (const alias of ['/sedes/edomex', '/sedes/edomex/']) {
    assert.strictEqual(seo.resolveSiteMetadata(alias + '?sede=edomex#programa'), edomex);
  }
  const veracruz = seo.resolveSiteMetadata('/sedes/veracruz');
  for (const alias of ['/sedes', '/sedes/', '/sedes/orizaba', '/sedes/orizaba/']) {
    assert.strictEqual(seo.resolveSiteMetadata(alias + '?sede=orizaba#programa'), veracruz);
  }
  for (const page of seo.sitePages) {
    const resolved = seo.resolveSiteMetadata('https://preview.example.invalid' + page.path + '?code=PRIVATE_TEST_VALUE#details');
    assert.strictEqual(resolved, page);
    assert.doesNotMatch(seo.renderSiteMetadataTags(resolved), /preview\.example|PRIVATE_TEST_VALUE|details|\?code=/);
  }
});

test('private workflows, asset paths, internal render files and unknown routes never inherit homepage metadata', () => {
  for (const path of ['/admin', '/admin/calificaciones', '/jueceo', '/jueceo/dictamen', '/mi-levitate', '/mi-levitate/demo',
    '/login?tipo=academia', '/registro', '/registro/academias', '/passport', '/passport/claim?token=PRIVATE_TEST_VALUE',
    '/inscripciones/consulta-curp?curp=PRIVATE_TEST_VALUE', '/votacion-releve', '/__seo/home/index.html',
    '/sedes/desconocida', '/assets/levitate-home-hero-poster.jpg', '/releve/extra', '/RELEVE', '/releve//',
    '//unrelated.example/releve', '/\\unrelated.example/releve', 'javascript:alert(1)', '', null]) {
    assert.equal(seo.resolveSiteMetadata(path), null, String(path));
  }
});

test('Open Graph and Twitter use each page title, description, public URL and image consistently', () => {
  for (const page of seo.sitePages) {
    const tags = seo.getSiteMetadataTags(page);
    const values = new Map(tags.filter(tag => tag.tagName === 'meta').map(tag => [tag.attributes.name || tag.attributes.property, tag.attributes.content]));
    assert.equal(tags.filter(tag => tag.tagName === 'title').length, 1);
    assert.equal(tags.find(tag => tag.tagName === 'link').attributes.href, page.canonical);
    assert.equal(values.get('description'), page.description);
    for (const prefix of ['og', 'twitter']) {
      assert.equal(values.get(prefix + ':title'), page.title);
      assert.equal(values.get(prefix + ':description'), page.description);
      assert.equal(values.get(prefix + ':url'), page.canonical);
      assert.equal(values.get(prefix + ':image'), page.image);
      assert.equal(values.get(prefix + ':image:alt'), page.imageAlt);
    }
    assert.equal(values.get('og:site_name'), 'Levitate MX');
    assert.equal(values.get('og:type'), 'website');
    assert.equal(values.get('og:locale'), 'es_MX');
    assert.equal(values.get('twitter:card'), 'summary_large_image');
  }
});

test('HTML metadata replaces defaults and duplicates idempotently while preserving the entire body and asset tags', () => {
  for (const page of seo.sitePages) {
    const html = seo.applySiteMetadataToHtml(shell, page);
    assert.equal(html.slice(html.indexOf('<body>')), shell.slice(shell.indexOf('<body>')));
    assert.equal((html.match(/<title\b/gi) || []).length, 1);
    assert.equal((html.match(/name="description"/g) || []).length, 1);
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.equal((html.match(/property="og:title"/g) || []).length, 1);
    assert.equal((html.match(/name="twitter:title"/g) || []).length, 1);
    assert.ok(html.includes(page.title));
    assert.ok(html.includes(page.description));
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0" \/>/);
    assert.match(html, /<link rel="icon" type="image\/png" href="\/favicon\.png" \/>/);
    assert.equal(seo.applySiteMetadataToHtml(html, page), html);
  }
  const original = `<!doctype html><html><head>
    <title>Old title</title><TITLE>Duplicate title</TITLE>
    <META content='Old > description' NAME='DESCRIPTION'><meta name=description content=duplicate>
    <link href='/old' rel='alternate canonical'><link rel=canonical href=/duplicate>
    <meta property='og:title' content='old'><meta name='twitter:title' content='old'>
    <meta name='robots' content='noindex'><link rel='stylesheet' href='/assets/site-abc.css'>
    <script>const example = '<title>Example</title><meta name="description" content="example">';</script>
    <!-- <title>Documented example</title> -->
    </head><body><div id="root">Visible content stays exact.</div><script src='/assets/app-xyz.js'></script></body></html>`;
  const html = seo.applySiteMetadataToHtml(original, seo.sitePages[0]);
  assert.doesNotMatch(html, /Old title|Duplicate title|Old > description|content=duplicate|href='\/old'|href=\/duplicate/);
  assert.ok(html.includes("<meta name='robots' content='noindex'>"));
  assert.ok(html.includes("<link rel='stylesheet' href='/assets/site-abc.css'>"));
  assert.ok(html.includes("const example = '<title>Example</title><meta name=\"description\" content=\"example\">';"));
  assert.ok(html.includes('<!-- <title>Documented example</title> -->'));
  assert.equal(html.slice(html.indexOf('<body>')), original.slice(original.indexOf('<body>')));
  assert.equal(seo.applySiteMetadataToHtml(html, seo.sitePages[0]), html);
  assert.equal(seo.applySiteMetadataToHtml(original, null), original);
  assert.throws(() => seo.applySiteMetadataToHtml('<main>No head</main>', seo.sitePages[0]), /head element/);
});

test('metadata text and attribute values cannot inject HTML, scripts or another head tag', () => {
  const html = seo.renderSiteMetadataTags({ ...seo.sitePages[0], title: 'Danza & "arte" </title><script>alert(1)</script>',
    description: "Una descripción con 'comillas' y <img src=x onerror=alert(2)>", imageAlt: 'Danza " onload="alert(3)' });
  assert.doesNotMatch(html, /<script>|<img| onload="alert/);
  assert.match(html, /Danza &amp; &quot;arte&quot; &lt;\/title&gt;&lt;script&gt;/);
  assert.match(html, /&#39;comillas&#39; y &lt;img/);
  assert.match(html, /Danza &quot; onload=&quot;alert\(3\)/);
});

class HeadElement {
  constructor(tagName, attributes = {}, textContent = '') { this.tagName = tagName.toUpperCase(); this.values = { ...attributes }; this.textContent = textContent; }
  get attributes() { return Object.entries(this.values).map(([name, value]) => ({ name, value })); }
  setAttribute(name, value) { this.values[name] = value; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}
function documentFixture() {
  const document = { body: { visibleContent: 'Keep this exact body' },
    createElement: tagName => new HeadElement(tagName), head: {
      children: [], append(element) { element.parent = this; this.children.push(element); },
      querySelectorAll(selector) { assert.equal(selector, 'title, meta, link'); return this.children.filter(element => ['TITLE', 'META', 'LINK'].includes(element.tagName)); },
    } };
  for (const element of [new HeadElement('title', {}, 'Old'), new HeadElement('title', {}, 'Duplicate'),
    new HeadElement('meta', { name: 'description', content: 'Old description' }), new HeadElement('meta', { name: 'description', content: 'Duplicate' }),
    new HeadElement('link', { rel: 'canonical', href: '/old' }), new HeadElement('meta', { property: 'og:title', content: 'Old' }),
    new HeadElement('meta', { name: 'twitter:title', content: 'Old' }), new HeadElement('link', { rel: 'icon', href: '/favicon.png' }),
    new HeadElement('meta', { name: 'viewport', content: 'width=device-width' }), new HeadElement('script', { src: '/assets/app-abc.js' })]) document.head.append(element);
  return document;
}

test('runtime metadata updates the real head helper without changing page content, and repeated calls leave one copy', () => {
  const document = documentFixture(), body = document.body;
  const untouched = document.head.children.filter(element => ['viewport'].includes(element.values.name) || element.values.rel === 'icon' || element.tagName === 'SCRIPT');
  for (const path of ['/premio-releve?code=PRIVATE_TEST_VALUE', '/sedes/edomex/', '/releve']) {
    assert.equal(applySiteMetadata(document, path), true);
    assert.strictEqual(document.body, body);
    assert.ok(untouched.every(element => document.head.children.includes(element)));
    const actual = document.head.children.filter(element => seo.isSiteMetadataTag(element.tagName, element.values));
    assert.equal(actual.length, seo.getSiteMetadataTags(seo.resolveSiteMetadata(path)).length);
    assert.equal(actual.filter(element => element.tagName === 'TITLE').length, 1);
    assert.equal(actual.find(element => element.tagName === 'TITLE').textContent, seo.resolveSiteMetadata(path).title);
    assert.equal(actual.find(element => element.values.rel === 'canonical').values.href, seo.resolveSiteMetadata(path).canonical);
    assert.doesNotMatch(JSON.stringify(actual.map(element => element.values)), /PRIVATE_TEST_VALUE/);
  }
  const before = document.head.children.slice();
  assert.equal(applySiteMetadata(document, '/mi-levitate'), false);
  assert.deepEqual(document.head.children, before);
  assert.equal(applySiteMetadata({ head: null }, '/'), false);
});

test('the optional metadata component is server-renderable and contributes only head elements', () => {
  for (const page of seo.sitePages) {
    const html = renderToStaticMarkup(SiteMetadata({ pathname: page.path }));
    assert.ok(html.includes(page.title));
    assert.ok(html.includes(page.canonical));
    assert.equal((html.match(/<title\b/g) || []).length, 1);
    assert.doesNotMatch(html, /<main|<div|<section|<script|<style/);
  }
  assert.equal(renderToStaticMarkup(SiteMetadata({ pathname: '/admin' })), '');
});
