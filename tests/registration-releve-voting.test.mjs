import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { getReleveVotingPreview } from '../worker/releve-voting-preview.js';
import { getAdminSectionFromPath } from '../src/components/admin/adminNavigation.ts';

test('the private Relevé preview contains only explicitly fictitious candidates and never enables a public ballot', t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('preview data must never contact a real service'); });
  const preview = getReleveVotingPreview();
  assert.equal(preview.mode, 'preview');
  assert.equal(preview.publicVotingEnabled, false);
  assert.match(preview.description, /ejemplo/i);
  assert.match(preview.description, /no.*votos reales/i);
  assert.ok(Number.isFinite(Date.parse(preview.fetchedAt)));
  assert.deepEqual([...new Set(preview.candidates.map(candidate => candidate.division))].sort(), ['aerial', 'motion']);
  assert.equal(new Set(preview.candidates.map(candidate => candidate.id)).size, preview.candidates.length);
  for (const candidate of preview.candidates) {
    assert.match(candidate.id, /^preview-(?:motion|aerial)-/);
    for (const field of ['teacherName', 'academyName', 'choreographyTitle']) assert.match(candidate[field], /ejemplo/i);
    assert.deepEqual(Object.keys(candidate).sort(), ['academyName', 'choreographyTitle', 'division', 'entryNumber', 'id', 'teacherName']);
  }
  assert.doesNotMatch(JSON.stringify(preview), /curp|payment|proof|ticket|accessToken|data:audio/i);
});

test('one admin simulation cannot alter the shared server preview or introduce a persistent ballot', () => {
  const first = getReleveVotingPreview();
  const before = structuredClone(first.candidates);
  assert.throws(() => { first.candidates[0].teacherName = 'Changed candidate'; }, TypeError);
  assert.throws(() => { first.candidates.push({ id: 'real-candidate' }); }, TypeError);
  const next = getReleveVotingPreview();
  assert.deepEqual(next.candidates, before);
  assert.equal(next.publicVotingEnabled, false);
  assert.equal(Object.hasOwn(next, 'votes'), false);
  assert.equal(Object.hasOwn(next, 'results'), false);
});

test('the Relevé preview is an exact admin section and has no public voting route alias', () => {
  assert.equal(getAdminSectionFromPath('/admin/releve/votacion'), 'releveVoting');
  assert.equal(getAdminSectionFromPath('/admin/releve/votacion/'), 'releveVoting');
  for (const path of ['/releve/votacion', '/votacion/releve', '/admin/releve/votacion/publica']) {
    assert.equal(getAdminSectionFromPath(path), null);
  }
});

const source = await readFile(new URL('../src/components/admin/ReleveVotingPreview.tsx', import.meta.url), 'utf8');
const syntax = ts.createSourceFile('ReleveVotingPreview.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['recordPreviewVote', 'simulatedResults', 'PreviewCandidateCard', 'PreviewVoteReceipt'];
const declarations = names.map(name => {
  const declaration = syntax.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `missing real preview helper ${name}`);
  return declaration.getText(syntax);
}).join('\n');
const require = createRequire(import.meta.url);
const scope = { require, exports: {}, ...require('lucide-react') };
vm.runInNewContext(ts.transpileModule(`${declarations}\nglobalThis.helpers = { ${names.join(',')} };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, scope);
const { recordPreviewVote, simulatedResults, PreviewCandidateCard, PreviewVoteReceipt } = scope.helpers;
const candidates = getReleveVotingPreview().candidates;
const motion = candidates.find(candidate => candidate.division === 'motion');
const aerial = candidates.find(candidate => candidate.division === 'aerial');

test('the local demonstration stores one simulated choice independently in each division without changing inputs', () => {
  const initial = Object.freeze({ motion: null, aerial: null });
  const motionVote = recordPreviewVote(candidates, initial, 'motion', motion.id, 'open');
  assert.deepEqual({ ...motionVote }, { motion: motion.id, aerial: null });
  const both = recordPreviewVote(candidates, motionVote, 'aerial', aerial.id, 'open');
  assert.deepEqual({ ...both }, { motion: motion.id, aerial: aerial.id });
  assert.deepEqual(initial, { motion: null, aerial: null });
  assert.deepEqual({ ...motionVote }, { motion: motion.id, aerial: null }, 'a second branch cannot rewrite the previous simulated choice');
  assert.equal(getReleveVotingPreview().publicVotingEnabled, false, 'simulating choices never enables a live ballot');
});

test('a second simulated vote, an unknown candidate and a candidate from the other division are rejected', () => {
  const empty = { motion: null, aerial: null };
  const voted = recordPreviewVote(candidates, empty, 'motion', motion.id, 'open');
  const before = structuredClone(voted);
  assert.throws(() => recordPreviewVote(candidates, voted, 'motion', motion.id, 'open'));
  assert.throws(() => recordPreviewVote(candidates, empty, 'motion', 'unknown-candidate', 'open'));
  assert.throws(() => recordPreviewVote(candidates, empty, 'motion', aerial.id, 'open'));
  assert.deepEqual({ ...voted }, { ...before });
});

test('closed demonstration states reject simulated choices and resetting local state starts a fresh simulation', () => {
  const empty = { motion: null, aerial: null };
  for (const phase of ['upcoming', 'closed']) {
    assert.throws(() => recordPreviewVote(candidates, empty, 'motion', motion.id, phase));
    assert.deepEqual(empty, { motion: null, aerial: null });
  }
  const firstTry = recordPreviewVote(candidates, empty, 'motion', motion.id, 'open');
  const reset = { motion: null, aerial: null };
  const another = candidates.find(candidate => candidate.division === 'motion' && candidate.id !== motion.id);
  const nextTry = recordPreviewVote(candidates, reset, 'motion', another.id, 'open');
  assert.equal(firstTry.motion, motion.id);
  assert.equal(nextTry.motion, another.id);
  assert.deepEqual(reset, { motion: null, aerial: null });
});

test('demonstration results count only the current in-memory simulated choices and never invent historical totals', () => {
  const empty = { motion: null, aerial: null };
  const initial = simulatedResults(candidates, empty, 'motion');
  assert.ok(initial.every(item => item.candidate.division === 'motion' && item.votes === 0));
  const voted = recordPreviewVote(candidates, empty, 'motion', motion.id, 'open');
  const result = simulatedResults(candidates, voted, 'motion');
  assert.equal(result.reduce((total, item) => total + item.votes, 0), 1);
  assert.equal(result.find(item => item.candidate.id === motion.id).votes, 1);
  assert.ok(result.every(item => item.votes === 0 || item.votes === 1));
  assert.ok(simulatedResults(candidates, voted, 'aerial').every(item => item.votes === 0));
  assert.ok(simulatedResults(candidates, { motion: null, aerial: null }, 'motion').every(item => item.votes === 0));
});

test('candidate cards identify demonstration data and preserve the disabled radio-selection boundary', () => {
  const html = renderToStaticMarkup(PreviewCandidateCard({
    candidate: { ...motion, teacherName: 'Maestro <script>ejemplo</script>' }, selected: true, disabled: true, onSelect() {},
  }));
  assert.match(html, /Candidato de demostración/);
  assert.match(html, /type="radio"[^>]*name="releve-preview-motion"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /checked=""/);
  assert.match(html, /Maestro &lt;script&gt;ejemplo&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('the simulated receipt clearly states that no real vote was submitted or saved', () => {
  const html = renderToStaticMarkup(PreviewVoteReceipt({ candidate: aerial, divisionLabel: 'Relevé Aerial', onReset() {} }));
  assert.match(html, /Voto de prueba confirmado/);
  assert.match(html, /Relevé Aerial · Simulación/);
  assert.match(html, /No se envió ni se guardó un voto real/);
  assert.match(html, /Reiniciar este voto de prueba/);
  assert.doesNotMatch(html, /<form|action=|href=/);
});
