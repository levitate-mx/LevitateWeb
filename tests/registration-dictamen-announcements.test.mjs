import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/judging/dictamenAnnouncements.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const routine = () => ({ id: '1', name: 'Vuelo', academy: 'Academia', state: 'México', genre: 'Jazz', division: 'Teen', level: 'Intermedio',
  category: 'Solo', status: 'complete', completedJudges: 3, expectedJudges: 3, recordedScores: 45,
  judges: [{ feedback: 'PRIVATE INDIVIDUAL FEEDBACK', criteria: [] }] });
const standing = () => ({ routineId: '1', score: 180, maximumScore: 210, medal: 'plata', directCompetition: true, eligibleCount: 2,
  placement: { rank: 1, label: '1.º lugar', isFirstPlace: true, isParticipation: false } });
const award = () => ({ id: 'champion_of_champions', title: 'MVP', displayValue: 'Parcial: Vuelo · Academia · 180 puntos',
  isAssigned: true, isPartial: true, routineId: '1' });
const favorite = () => ({ status: 'ready', winner: { routineId: '1', name: 'Vuelo', academy: 'Academia', votes: 8 } });

// Run the actual hook with React's state/ref/effect lifecycle semantics. The
// browser adapter records writes and dispatches storage events independently.
function tab(values = new Map()) {
  const slots = [], effects = [], listeners = new Set(), writes = [], reads = [];
  let cursor = 0, pendingEffects = [], selected = ['event-a', 'block-1'];
  let readDenied = false, writeDenied = false;
  const localStorage = {
    getItem(key) { reads.push(key); if (readDenied) throw new Error('Storage denied'); return values.get(key) ?? null; },
    setItem(key, value) { writes.push({ key, value }); if (writeDenied) throw new Error('Quota denied'); values.set(key, value); },
  };
  const react = {
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useEffect(callback, dependencies) { const index = cursor++;
      if (!effects[index] || dependencies.some((value, i) => !Object.is(value, effects[index].dependencies[i]))) {
        pendingEffects.push(() => { effects[index]?.cleanup?.(); effects[index] = { dependencies, cleanup: callback() }; });
      }
    },
  };
  const scope = { exports: {}, require(name) { assert.equal(name, 'react'); return react; },
    window: { localStorage, addEventListener(name, listener) { assert.equal(name, 'storage'); listeners.add(listener); },
      removeEventListener(name, listener) { assert.equal(name, 'storage'); listeners.delete(listener); } } };
  vm.runInNewContext(javascript, scope);
  return { ...scope.exports, values, writes, reads,
    render(...ids) { if (ids.length) selected = ids; cursor = 0; pendingEffects = [];
      const result = scope.exports.useDictamenAnnouncements(...selected); for (const effect of pendingEffects) effect(); return result; },
    emit(key = reads.at(-1)) { for (const listener of [...listeners]) listener({ key }); },
    denyRead(value) { readDenied = value; }, denyWrite(value) { writeDenied = value; },
    close() { for (const effect of effects) effect?.cleanup?.(); },
  };
}

test('routine identities and signatures survive polling, property order and private feedback without storing a snapshot', () => {
  const t = tab(), row = routine(), value = standing();
  const item = t.routineAnnouncement(value, row);
  const reordered = Object.fromEntries(Object.entries(row).reverse());
  reordered.fetchedAt = 'later'; reordered.judges[0].feedback = 'OTHER PRIVATE FEEDBACK';
  assert.equal(t.routineAnnouncement(value, reordered).fingerprint, item.fingerprint);
  assert.equal(t.routineAnnouncement(value, reordered).id, item.id);
  assert.doesNotMatch(item.fingerprint, /PRIVATE|feedback|judges|fetchedAt/);
  for (const update of [entry => { entry.score = 181; }, entry => { entry.maximumScore = 300; },
    entry => { entry.medal = 'oro'; }, entry => { entry.placement.rank = 2; },
    entry => { entry.audience = { candidateId: 'c', status: 'closed', ready: true, votes: 10, bonus: 5 }; }]) {
    const changed = standing(); update(changed);
    assert.notEqual(t.routineAnnouncement(changed, row).fingerprint, item.fingerprint);
  }
  assert.notEqual(t.routineAnnouncement(value, { ...row, name: 'Otro nombre' }).fingerprint, item.fingerprint);
  assert.notEqual(t.routineAnnouncement(value, { ...row, status: 'partial' }).fingerprint, item.fingerprint);
  const legacyScale = standing(); delete legacyScale.maximumScore;
  assert.notEqual(t.routineAnnouncement(legacyScale, row).fingerprint,
    t.routineAnnouncement({ ...legacyScale, maximumScore: null }, row).fingerprint, 'unknown and legacy scale states stay distinct');
});

test('award and audience signatures distinguish winners, partial/final state and announced text with separate identity types', () => {
  const t = tab(), original = award(), item = t.awardAnnouncement(original);
  for (const change of [{ routineId: '2' }, { isPartial: false }, { displayValue: 'Nueva academia · 181 puntos' }, { isAssigned: false }]) {
    assert.equal(t.awardAnnouncement({ ...original, ...change }).id, item.id);
    assert.notEqual(t.awardAnnouncement({ ...original, ...change }).fingerprint, item.fingerprint);
  }
  assert.notEqual(t.routineAnnouncement(standing(), routine()).id, t.awardAnnouncement({ ...original, id: '1' }).id);
  const publicItem = t.audienceAnnouncement(favorite());
  assert.notEqual(t.audienceAnnouncement({ ...favorite(), winner: { ...favorite().winner, votes: 9 } }).fingerprint, publicItem.fingerprint);
  assert.notEqual(t.audienceAnnouncement({ status: 'tie', winner: null }).fingerprint, publicItem.fingerprint);
  assert.equal(t.audienceAnnouncement(undefined).id, publicItem.id);
});

test('only explicit clicks write, marks persist across remount, and changed content is unchecked', () => {
  const t = tab(), item = t.awardAnnouncement(award());
  let state = t.render(); assert.equal(state.isAnnounced(item), false); assert.equal(t.writes.length, 0);
  state.setAnnounced(item, true); state = t.render(); assert.equal(state.isAnnounced(item), true);
  const changed = t.awardAnnouncement({ ...award(), routineId: '2' });
  assert.equal(state.isAnnounced(changed), false);
  const remount = tab(t.values); assert.equal(remount.render().isAnnounced(item), true);
  remount.render().setAnnounced(item, false); assert.equal(remount.render().isAnnounced(item), false);
  assert.equal(t.writes.length, 1); assert.equal(remount.writes.length, 1);
});

test('event and block namespaces are isolated immediately and stale handlers cannot write to a previous block', () => {
  const t = tab(), item = t.awardAnnouncement(award());
  const old = t.render('event-a', 'block-1'); old.setAnnounced(item, true);
  const other = t.render('event-a', 'block-2'); assert.equal(other.isAnnounced(item), false);
  const before = t.writes.length; old.setAnnounced(item, false); assert.equal(t.writes.length, before);
  assert.equal(t.render('event-b', 'block-1').isAnnounced(item), false);
  assert.equal(t.render('event-a', 'block-1').isAnnounced(item), true);
  assert.equal(t.render('event:a', 'block:1').isAnnounced(item), false);
  assert.equal(t.render('', '').isAnnounced(item), false);
  assert.equal(t.writes.length, 1);
});

test('clicks merge fresh stored marks from another tab and storage events update checks without writing', () => {
  const values = new Map(), a = tab(values), b = tab(values);
  const first = a.awardAnnouncement(award()), second = a.routineAnnouncement(standing(), routine());
  a.render(); b.render(); a.render().setAnnounced(first, true);
  b.render().setAnnounced(second, true); // No storage event arrived yet: this must re-read and merge.
  a.emit(); assert.equal(a.render().isAnnounced(first), true); assert.equal(a.render().isAnnounced(second), true);
  b.render().setAnnounced(first, false); a.emit();
  assert.equal(a.render().isAnnounced(first), false); assert.equal(a.render().isAnnounced(second), true);
  assert.equal(a.writes.length, 1); assert.equal(b.writes.length, 2);
});

test('corrupt or denied storage fails closed and remains usable in memory', () => {
  const corrupt = tab(), item = corrupt.awardAnnouncement(award());
  corrupt.render(); corrupt.values.set(corrupt.reads.at(-1), '{broken');
  corrupt.close(); const reload = tab(corrupt.values);
  let state = reload.render(); assert.equal(state.isAnnounced(item), false); assert.equal(state.storageError, true);
  state.setAnnounced(item, true); state = reload.render(); assert.equal(state.isAnnounced(item), true); assert.equal(state.storageError, false);
  const denied = tab(); denied.denyRead(true); denied.denyWrite(true);
  state = denied.render(); assert.equal(state.storageError, true); state.setAnnounced(item, true);
  state = denied.render(); assert.equal(state.isAnnounced(item), true); assert.equal(state.storageError, true);
  denied.render('event-a', 'block-2'); state = denied.render('event-a', 'block-1');
  assert.equal(state.isAnnounced(item), true); assert.equal(state.storageError, true);
});

test('unsaved memory marks survive storage events and later merge when storage becomes writable', () => {
  const t = tab(), first = t.awardAnnouncement(award()), second = t.routineAnnouncement(standing(), routine());
  t.render(); t.denyWrite(true); t.render().setAnnounced(first, true);
  const key = t.reads.at(-1);
  t.values.set(key, JSON.stringify({ version: 1, marks: { [second.id]: second.fingerprint } }));
  t.emit(); assert.equal(t.render().isAnnounced(first), true); assert.equal(t.render().isAnnounced(second), true);
  assert.equal(t.render().storageError, true, 'a successful read must not claim failed writes were persisted');
  t.denyWrite(false); t.render().setAnnounced(second, true);
  assert.equal(t.render().storageError, false);
  const restored = tab(t.values).render(); assert.equal(restored.isAnnounced(first), true); assert.equal(restored.isAnnounced(second), true);
});
