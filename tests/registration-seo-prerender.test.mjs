import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { buildPrerenderRenderer, prerenderPages } from '../scripts/prerender-pages.mjs';
import { sitePages } from '../shared/site-seo.js';

let renderer;
before(async () => { renderer = await buildPrerenderRenderer(); });
after(async () => { await renderer?.dispose(); });

test('the public home prerender contains the real React heading, navigation and content without browser globals', () => {
  assert.equal(typeof window, 'undefined');
  const html = renderer.render('/');
  assert.match(html, /<main class="levitate-page levitate-home-redesign"/);
  assert.match(html, /<h1>Competir se siente distinto\.<\/h1>/);
  assert.match(html, /Competencia Nacional de Danza/);
  assert.match(html, /levitate-home-nav-portal/);
  assert.match(html, /href="\/inscripciones"/);
  assert.match(html, /<footer/);
  assert.doesNotMatch(html, /<video/,'decorative video remains deferred until browser effects run');
  assert.equal(renderer.render('/'), html, 'initial HTML remains deterministic');
});

test('the closed home menu exposes real crawlable modality links in the first HTML without adding visible navigation', () => {
  const html = renderer.render('/');
  const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, content]) => ({
    attributes,
    href: attributes.match(/\bhref="([^"]*)"/)?.[1],
    label: content.replace(/<[^>]*>/g, '').trim(),
  }));
  for (const [label, path] of [['Motion', '/modalidades/levitate-motion/generos'], ['Aerial', '/modalidades/levitate-aerial/evaluacion']]) {
    const matches = links.filter(link => link.href === path && link.label === label);
    assert.equal(matches.length, 1, `${label} is an actual navigation anchor, present before any menu click`);
    assert.doesNotMatch(matches[0].attributes, /nofollow|aria-disabled="true"|javascript:/);
  }
  const menu = html.match(/<div\b(?=[^>]*\bid="levitate-pill-menu")[^>]*>/)?.[0];
  assert.ok(menu, 'the existing menu, rather than a separate SEO-only list, is rendered');
  assert.match(menu, /\shidden=""/);
  assert.match(menu, /\sinert=""/);
  const sections = [...html.matchAll(/<aside\b[^>]*class="[^"]*levitate-pill-menu__submenu--inline[^>]*>/g)];
  assert.ok(sections.length > 0);
  for (const [section] of sections) {
    assert.match(section, /\shidden=""/);
    assert.match(section, /\sinert=""/);
  }
  assert.doesNotMatch(html, /levitate-pill-menu__submenu--side/, 'the desktop panel still opens only after interaction');
});

test('Motion and Aerial prerenders use their actual distinct page components and content', () => {
  const motion = renderer.render('/modalidades/levitate-motion/generos');
  assert.match(motion, /motion-genres-page/);
  for (const word of ['Motion', 'Acrojazz', 'Ballet', 'Folklore', 'Estilos en competencia.']) assert.ok(motion.includes(word), word);
  const aerial = renderer.render('/modalidades/levitate-aerial/evaluacion');
  assert.match(aerial, /rules-page--aerial/);
  for (const word of ['Aerial', 'Aparatos en competencia.', 'Niveles técnicos.', 'PDF de obligatorios']) assert.ok(aerial.includes(word), word);
  assert.notEqual(aerial, motion);
  assert.equal(renderer.render('/modalidades/levitate-motion/generos/'), motion);
});

test('the first browser render keeps the exact server header before moving it to its existing body portal', () => {
  const html = renderer.render('/');
  globalThis.document = { body: {} };
  try { assert.equal(renderer.render('/'), html); }
  finally { delete globalThis.document; }
});

test('the SSR entry never falls back to rendering the home page for unconfigured or private routes', () => {
  for (const path of ['/admin', '/mi-levitate', '/jueceo/admin', '/inscripciones', '/unknown']) {
    assert.throws(() => renderer.render(path), /No public prerender is configured/);
  }
});

const template = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Old title</title><meta name="description" content="Old description"><script type="module" crossorigin src="/assets/index-hashed123.js"></script><link rel="stylesheet" crossorigin href="/assets/index-hashed456.css"></head><body><div id="root"></div></body></html>';

test('postbuild emits twelve internal public pages while preserving hashed assets and the untouched private SPA shell', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'levitate-seo-prerender-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'index.html'), template);
  const outputs = await prerenderPages({ clientDirectory: directory });
  assert.equal(outputs.length, 12);
  assert.equal(outputs.filter(page => page.prerendered).length, 3);
  assert.equal(await readFile(join(directory, 'index.html'), 'utf8'), template);
  for (const page of sitePages) {
    const html = await readFile(join(directory, '__seo', page.key, 'index.html'), 'utf8');
    assert.ok(html.includes(`data-site-page="${page.key}"`));
    assert.match(html, /src="\/assets\/index-hashed123\.js"/);
    assert.match(html, /href="\/assets\/index-hashed456\.css"/);
    assert.ok(html.includes(page.canonical));
    assert.equal((html.match(/<title\b/g) || []).length, 1);
    assert.doesNotMatch(html, /Old title|Old description/);
    assert.doesNotMatch(html, /href="\/__seo\//, 'internal asset routes are never linked as public URLs');
    if (renderer.prerenderedPaths.includes(page.path)) {
      assert.ok(html.includes(`data-prerender-path="${page.path}"`));
      assert.match(html, /<main/);
      if (page.path === '/') {
        assert.match(html, /href="\/modalidades\/levitate-motion\/generos"/);
        assert.match(html, /href="\/modalidades\/levitate-aerial\/evaluacion"/);
      }
    } else {
      assert.ok(html.includes(`<div id="root" data-site-page="${page.key}"></div>`));
      assert.doesNotMatch(html, /data-prerender-path|<main/);
    }
  }
});

test('prerendering refuses an already populated or missing client root instead of duplicating page content', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'levitate-seo-invalid-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const html of [template.replace('<div id="root"></div>', '<div id="root"><main>Old content</main></div>'), template.replace('<div id="root"></div>', '')]) {
    await writeFile(join(directory, 'index.html'), html);
    await assert.rejects(prerenderPages({ clientDirectory: directory }), /original empty client root/);
  }
});
