import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const portraitSource = await readFile(new URL('../src/components/judging/judgePortraits.ts', import.meta.url), 'utf8');
const portraitModule = ts.transpileModule(portraitSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { resolveJudgePortrait } = await import(`data:text/javascript;base64,${Buffer.from(portraitModule).toString('base64')}`);

test('judging portraits reuse the exact public jury assets instead of legacy photos', async () => {
  const source = await readFile(new URL('../src/components/sedes/SedesPage.tsx', import.meta.url), 'utf8');
  const jury = source.match(/jury:\s*\[([\s\S]*?)\]/)?.[1];
  assert.ok(jury, 'The public jury catalogue must be present');
  const portraits = [...jury.matchAll(/name:\s*"([^"]+)"[^\n]*?image:\s*"([^"]+)"/g)];
  assert.ok(portraits.length > 0);
  for (const [, name, image] of portraits) {
    assert.equal(resolveJudgePortrait({ name, photo_data: 'legacy-other-person' }), image, name);
    await access(new URL(`../public${image}`, import.meta.url));
  }
});

test('portrait aliases handle case, accents and separators without conflating the Daniels', () => {
  const identities = [
    ['DANIEL MONTALVO', '/assets/daniel-montalvo.jpg'],
    ['daniel-herrera', '/assets/daniel-herrera.jpg'],
    ['ÁNA KAREN ROJAS', '/assets/ana-karen-rojas.jpg'],
    ['RENATA PINAL', '/assets/renata-pinal.jpg'],
    ['JORGE DÍAZ', '/assets/jorge-diaz-de-leon.png'],
    ['Jorge Diaz de Leon', '/assets/jorge-diaz-de-leon.png'],
  ];
  for (const [name, image] of identities) assert.equal(resolveJudgePortrait({ name }), image, name);
  assert.equal(resolveJudgePortrait({ name: 'Daniel' }), undefined);
  assert.equal(resolveJudgePortrait({ name: 'Daniel Montalvo Herrera' }), undefined);
});

test('Eva Carrillo uses her supplied portrait and incomplete identities retain a placeholder', async () => {
  for (const name of ['EVA CARRILLO', 'eva-carrillo', 'Éva_Carrillo']) {
    assert.equal(resolveJudgePortrait({ name, photo_data: 'legacy-other-person' }), '/assets/eva-carrillo.jpg');
  }
  await access(new URL('../public/assets/eva-carrillo.jpg', import.meta.url));
  assert.equal(resolveJudgePortrait({ name: 'Eva', photo_data: 'legacy-other-person' }), undefined);
  assert.equal(resolveJudgePortrait({ name: 'Juez invitado', photo_data: 'data:image/png;base64,local' }), 'data:image/png;base64,local');
  assert.equal(resolveJudgePortrait({ name: 'Juez invitado', photo_data: ' ' }), undefined);
});
