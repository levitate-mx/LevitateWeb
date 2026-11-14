import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function versionJudgeWebAssets(websiteRoot = process.cwd()) {
  const appRoot = resolve(websiteRoot, 'public/jueceo/app');
  const mainPath = resolve(appRoot, 'main.dart.js');
  const bootstrapPath = resolve(appRoot, 'flutter_bootstrap.js');
  const indexPath = resolve(appRoot, 'index.html');
  const main = readFileSync(mainPath);
  const bootstrap = readFileSync(bootstrapPath, 'utf8');
  const index = readFileSync(indexPath, 'utf8');
  if (!main.length) throw new Error('The judging web JavaScript is empty.');

  const mainPattern = /("mainJsPath"\s*:\s*")main\.dart\.js(?:\?revision=[A-Za-z0-9_-]+)?(")/g;
  const bootstrapPattern = /(<script\b[^>]*\bsrc\s*=\s*)(["'])flutter_bootstrap\.js(?:\?revision=[A-Za-z0-9_-]+)?\2(?=[\s>])/g;
  if ([...bootstrap.matchAll(mainPattern)].length !== 1) {
    throw new Error('Expected exactly one main.dart.js mainJsPath in the judging bootstrap.');
  }
  if ([...index.matchAll(bootstrapPattern)].length !== 1) {
    throw new Error('Expected exactly one flutter_bootstrap.js script in the judging index.');
  }

  // Validate both entry points before changing either file.
  const revision = createHash('sha256').update(main).digest('hex').slice(0, 16);
  const nextBootstrap = bootstrap.replace(mainPattern, (_, prefix, suffix) =>
    `${prefix}main.dart.js?revision=${revision}${suffix}`);
  const nextIndex = index.replace(bootstrapPattern, (_, prefix, quote) =>
    `${prefix}${quote}flutter_bootstrap.js?revision=${revision}${quote}`);
  if (nextBootstrap !== bootstrap) writeFileSync(bootstrapPath, nextBootstrap);
  if (nextIndex !== index) writeFileSync(indexPath, nextIndex);
  return { revision, changed: nextBootstrap !== bootstrap || nextIndex !== index };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = versionJudgeWebAssets(process.argv[2] ?? process.cwd());
    console.log(`Judging web revision: ${result.revision}${result.changed ? '' : ' (unchanged)'}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
