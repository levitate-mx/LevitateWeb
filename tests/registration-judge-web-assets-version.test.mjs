import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { versionJudgeWebAssets } from '../scripts/version-judge-web-assets.mjs';

const bootstrapSource = 'const untouched = "main.dart.js";\n_flutter.buildConfig = {"builds":[{"mainJsPath":"main.dart.js"}]};\n';
const indexSource = '<!doctype html>\n<script>const untouched = "flutter_bootstrap.js";</script>\n<script src="flutter_bootstrap.js" async></script>\n';

function fixture(t, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'levitate-judge-web-assets-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const appRoot = join(root, 'public/jueceo/app');
  mkdirSync(join(appRoot, 'assets'), { recursive: true });
  const contents = {
    'main.dart.js': 'window.exampleJudgingApp = "first build";\n',
    'flutter_bootstrap.js': bootstrapSource,
    'index.html': indexSource,
    'assets/program_seed.json': '{"routines":[{"routine_id":"133"}]}\n',
    ...overrides,
  };
  for (const [file, content] of Object.entries(contents)) {
    if (content !== null) writeFileSync(join(appRoot, file), content);
  }
  return {
    root,
    file: (name) => join(appRoot, name),
    read: (name) => readFileSync(join(appRoot, name), 'utf8'),
    snapshot: () => Object.fromEntries(Object.entries(contents)
      .filter(([, content]) => content !== null)
      .map(([file]) => [file, readFileSync(join(appRoot, file), 'utf8')])),
  };
}

const revisionFor = source => createHash('sha256').update(source).digest('hex').slice(0, 16);

test('both judging entry points use the JavaScript content revision and only their asset references change', t => {
  const f = fixture(t);
  const main = f.read('main.dart.js');
  const revision = revisionFor(main);
  assert.deepEqual(versionJudgeWebAssets(f.root), { revision, changed: true });
  assert.equal(f.read('flutter_bootstrap.js'), bootstrapSource.replace('"mainJsPath":"main.dart.js"', `"mainJsPath":"main.dart.js?revision=${revision}"`));
  assert.equal(f.read('index.html'), indexSource.replace('src="flutter_bootstrap.js"', `src="flutter_bootstrap.js?revision=${revision}"`));
  assert.equal(f.read('main.dart.js'), main);
});

test('versioning an already versioned build is idempotent and does not rewrite files', t => {
  const f = fixture(t);
  const first = versionJudgeWebAssets(f.root);
  const before = f.snapshot();
  const date = new Date('2020-01-01T00:00:00Z');
  for (const name of ['flutter_bootstrap.js', 'index.html']) utimesSync(f.file(name), date, date);
  assert.deepEqual(versionJudgeWebAssets(f.root), { revision: first.revision, changed: false });
  assert.deepEqual(f.snapshot(), before);
  for (const name of ['flutter_bootstrap.js', 'index.html']) assert.equal(statSync(f.file(name)).mtimeMs, date.getTime());
});

test('a rebuilt JavaScript file replaces both previous revision references', t => {
  const f = fixture(t);
  const first = versionJudgeWebAssets(f.root);
  const source = 'window.exampleJudgingApp = "second build";\n';
  writeFileSync(f.file('main.dart.js'), source);
  const result = versionJudgeWebAssets(f.root);
  assert.notEqual(result.revision, first.revision);
  assert.equal(result.revision, revisionFor(source));
  assert.equal(result.changed, true);
  assert.ok(f.read('flutter_bootstrap.js').includes(`main.dart.js?revision=${result.revision}`));
  assert.ok(f.read('index.html').includes(`flutter_bootstrap.js?revision=${result.revision}`));
  assert.ok(!f.read('flutter_bootstrap.js').includes(first.revision));
  assert.ok(!f.read('index.html').includes(first.revision));
});

test('versioning leaves the program seed untouched', t => {
  const f = fixture(t);
  const seed = f.read('assets/program_seed.json');
  versionJudgeWebAssets(f.root);
  assert.equal(f.read('assets/program_seed.json'), seed);
});

for (const [name, overrides] of [
  ['missing JavaScript', { 'main.dart.js': null }],
  ['empty JavaScript', { 'main.dart.js': '' }],
  ['missing main path', { 'flutter_bootstrap.js': 'const untouched = "main.dart.js";' }],
  ['duplicate main paths', { 'flutter_bootstrap.js': bootstrapSource + bootstrapSource }],
  ['missing bootstrap script', { 'index.html': '<script src="other.js"></script>' }],
  ['duplicate bootstrap scripts', { 'index.html': indexSource + indexSource }],
]) {
  test(`${name} rejects before writing either entry point`, t => {
    const f = fixture(t, overrides);
    const before = f.snapshot();
    assert.throws(() => versionJudgeWebAssets(f.root));
    assert.deepEqual(f.snapshot(), before);
  });
}
