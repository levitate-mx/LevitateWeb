import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { applySiteMetadataToHtml, sitePages } from '../shared/site-seo.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootOutlet = /<div\s+id=(["'])root\1\s*>\s*<\/div>/;
const escapeAttribute = value => value.replace(/[&"<>]/g, character => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[character]);

/** Compile only public React components. Temporary SSR output is never shipped. */
export async function buildPrerenderRenderer() {
  const temporaryParent = resolve(projectRoot, 'node_modules/.tmp');
  await mkdir(temporaryParent, { recursive: true });
  const directory = await mkdtemp(resolve(temporaryParent, 'levitate-prerender-'));
  try {
    await build({
      configFile: false,
      root: projectRoot,
      publicDir: false,
      plugins: [react()],
      logLevel: 'error',
      build: {
        ssr: resolve(projectRoot, 'src/entry-server.tsx'),
        outDir: directory,
        emptyOutDir: true,
        copyPublicDir: false,
        minify: false,
        rolldownOptions: { output: { entryFileNames: 'entry-server.mjs' } },
      },
    });
    const renderer = await import(pathToFileURL(resolve(directory, 'entry-server.mjs')).href);
    return { ...renderer, dispose: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function prerenderPages({ clientDirectory = resolve(projectRoot, 'dist/client') } = {}) {
  const template = await readFile(resolve(clientDirectory, 'index.html'), 'utf8');
  if (!rootOutlet.test(template)) throw new Error('Prerendering requires the original empty client root.');
  const renderer = await buildPrerenderRenderer();
  try {
    const paths = new Set(renderer.prerenderedPaths);
    if ([...paths].some(path => !sitePages.some(page => page.path === path))) throw new Error('A prerendered route is missing from the public SEO catalog.');
    const outputs = sitePages.map(page => {
      if (!/^[a-z0-9-]+$/.test(page.key)) throw new Error('Invalid public SEO output key.');
      let markup = '';
      if (paths.has(page.path)) {
        markup = renderer.render(page.path);
        if (!markup || !markup.includes('<main')) throw new Error(`Public prerender is empty for ${page.path}.`);
      }
      const html = template.replace(rootOutlet, () => `<div id="root" data-site-page="${page.key}"${paths.has(page.path)
        ? ` data-prerender-path="${escapeAttribute(page.path)}"` : ''}>${markup}</div>`);
      return { key: page.key, path: page.path, prerendered: paths.has(page.path),
        outputFile: resolve(clientDirectory, '__seo', page.key, 'index.html'), html: applySiteMetadataToHtml(html, page) };
    });
    // Leave index.html untouched so private/unknown SPA routes retain an empty shell.
    for (const output of outputs) {
      await mkdir(dirname(output.outputFile), { recursive: true });
      await writeFile(output.outputFile, output.html);
    }
    return outputs.map(({ html: _html, ...output }) => output);
  } finally { await renderer.dispose(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  prerenderPages().then(outputs => {
    console.log(`Prepared ${outputs.length} public metadata pages; ${outputs.filter(page => page.prerendered).length} contain prerendered React HTML.`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
