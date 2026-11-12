import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/participant-admin/ParticipantBlockPublication.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
const fingerprint = 'a'.repeat(64);
function publication(changes = {}) {
  return { mode: 'block_close', sourceEventId: 'source-one', blocks: [{ id: 'block-1', name: 'Bloque 1', routineCount: 2 }],
    selectedBlock: { id: 'block-1', name: 'Bloque 1', state: 'open', complete: true, completedRoutines: 2,
      totalRoutines: 2, closedAt: null, fingerprint }, ...changes };
}
const children = value => Array.isArray(value) ? value : value == null ? [] : [value];
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value)
  : Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : '';
function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...children(value.props?.children).flatMap(nodes)];
}

// Render the real component with deterministic hooks so late server responses
// and navigation can be exercised without replacing its request handlers.
function harness(eventId = 'edition-a') {
  const slots = [], requests = [], changed = [], modeChanges = [], errors = [];
  let hook = 0, pendingEffects = [], dirty = true, tree, props;
  const hooks = {
    useState(initial) {
      const index = hook++;
      slots[index] ||= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => {
        const next = typeof value === 'function' ? value(slots[index].value) : value;
        if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = hook++; slots[index] ||= { current: initial }; return slots[index]; },
    useId() { const index = hook++; return `test-${index}`; },
    useEffect(effect, dependencies) {
      const index = hook++, previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        slots[index] = { dependencies, cleanup: previous?.cleanup };
        pendingEffects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const scope = { exports: {}, Error, AbortController, URLSearchParams, require(path) {
    if (path === 'react') return hooks;
    if (path === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    assert.equal(path, '../admin/registrationApi');
    return { RegistrationApiError: ApiError, requestRegistrationApi(path, options) {
      return new Promise((resolve, reject) => requests.push({ path, options, resolve, reject }));
    } };
  } };
  vm.runInNewContext(compiled, scope);
  props = { eventId, onChanged: () => changed.push(props.eventId), onModeChange: mode => modeChanges.push({ eventId: props.eventId, mode }), onError: cause => errors.push(cause) };
  function render() {
    let count = 0;
    while (dirty) {
      if (++count > 20) throw new Error('Render loop');
      dirty = false; hook = 0; pendingEffects = [];
      tree = scope.exports.ParticipantBlockPublication(props);
      for (const effect of pendingEffects) effect();
    }
  }
  async function settle() { await new Promise(resolve => setImmediate(resolve)); render(); }
  render();
  return {
    requests, changed, modeChanges, errors,
    get tree() { return tree; },
    button(label) { const button = nodes(tree).find(node => node.type === 'button' && text(node) === label); assert.ok(button, label); return button; },
    click(label) { this.button(label).props.onClick(); render(); },
    change(label, value) {
      const field = nodes(tree).find(node => node.type === 'label' && text(node).startsWith(label));
      const select = nodes(field).find(node => node.type === 'select'); assert.ok(select, label);
      select.props.onChange({ target: { value } }); render();
    },
    async resolve(index, value) { requests[index].resolve(value); await settle(); },
    async reject(index, cause) { requests[index].reject(cause); await settle(); },
    setProps(changes) { props = { ...props, ...changes }; dirty = true; render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('a missing programme still allows preparing the block publication mode without opening the edition', async () => {
  const view = harness();
  await view.resolve(0, publication({ mode: 'individual', sourceEventId: '', blocks: [], selectedBlock: null }));
  assert.match(text(view.tree), /todavía no está vinculado/);
  view.change('Forma de publicación', 'block_close');
  view.click('Guardar forma de publicación');
  assert.deepEqual(JSON.parse(view.requests[1].options.body), { action: 'publication.mode.save', eventId: 'edition-a', mode: 'block_close' });
  await view.resolve(1, { ok: true });
  assert.equal(view.changed.length, 1);
  assert.equal(view.requests[2].options.method, undefined);
  assert.match(view.requests[2].path, /publication=1&eventId=edition-a/);
  assert.doesNotMatch(JSON.stringify(view.requests.map(request => request.options.body)), /event\.upsert|access\.|asset\.publish/);
  view.unmount();
});

test('incomplete or unreviewed blocks cannot be closed', async () => {
  for (const change of [{ complete: false, completedRoutines: 1 }, { fingerprint: '' }, { totalRoutines: 0, completedRoutines: 0 }]) {
    const view = harness(); const data = publication(); Object.assign(data.selectedBlock, change);
    await view.resolve(0, data);
    assert.equal(view.button('Cerrar y publicar bloque').props.disabled, true);
    view.click('Cerrar y publicar bloque');
    assert.equal(view.requests.length, 1);
    view.unmount();
  }
});

test('closing sends only the reviewed block and fingerprint; reopening never approves files or opens the edition', async () => {
  const view = harness();
  await view.resolve(0, publication());
  view.click('Cerrar y publicar bloque');
  assert.deepEqual(JSON.parse(view.requests[1].options.body), { action: 'block.close', eventId: 'edition-a', blockId: 'block-1', fingerprint });
  await view.resolve(1, { ok: true });
  const closed = publication(); closed.selectedBlock.state = 'closed'; closed.selectedBlock.closedAt = '2026-11-14T12:00:00Z';
  await view.resolve(2, closed);
  assert.equal(view.button('Bloque cerrado').props.disabled, true);
  view.click('Reabrir y ocultar');
  assert.deepEqual(JSON.parse(view.requests[3].options.body), { action: 'block.reopen', eventId: 'edition-a', blockId: 'block-1' });
  await view.resolve(3, { ok: true });
  assert.match(text(view.tree), /sin borrar evaluaciones ni archivos/);
  assert.doesNotMatch(JSON.stringify(view.requests.map(request => request.options.body)), /published|photosPublished|assetId|accessId/);
  view.unmount();
});

test('a changed publication mode must be saved before closing a block', async () => {
  const view = harness();
  await view.resolve(0, publication());
  view.change('Forma de publicación', 'individual');
  assert.equal(view.button('Cerrar y publicar bloque').props.disabled, true);
  view.click('Cerrar y publicar bloque'); assert.equal(view.requests.length, 1);
  view.unmount();
});

test('automatic completion consults the passport without presenting close or reopen buttons', async () => {
  const view = harness();
  const automatic = publication({ mode: 'block_complete' });
  automatic.selectedBlock.state = 'ready'; automatic.selectedBlock.fingerprint = '';
  await view.resolve(0, automatic);
  assert.match(text(view.tree), /Al abrir el pasaporte se consultan las notas/);
  assert.match(text(view.tree), /todos los jueces completan el bloque; no hace falta cerrarlo/);
  assert.match(text(view.tree), /Evaluaciones completas/);
  assert.equal(nodes(view.tree).some(node => node.type === 'button' && /cerrar|reabrir/i.test(text(node))), false);
  assert.equal(view.requests.length, 1, 'viewing a completed block does not create a closure');
  view.unmount();
});

test('automatic mode stays pending for incomplete evaluations and still has no manual closure controls', async () => {
  const view = harness();
  const automatic = publication({ mode: 'block_complete' });
  Object.assign(automatic.selectedBlock, { state: 'open', complete: false, completedRoutines: 1, fingerprint: '' });
  await view.resolve(0, automatic);
  assert.match(text(view.tree), /Evaluaciones pendientes/);
  assert.match(text(view.tree), /1 de 2 coreografías/);
  assert.match(text(view.tree), /notas permanecen pendientes/);
  assert.equal(nodes(view.tree).some(node => node.type === 'button' && /cerrar|reabrir/i.test(text(node))), false);
  view.unmount();
});

test('automatic completion can be configured before programme linkage without creating closures or publishing the edition', async () => {
  const view = harness();
  await view.resolve(0, publication({ mode: 'individual', sourceEventId: '', blocks: [], selectedBlock: null }));
  view.change('Forma de publicación', 'block_complete');
  view.click('Guardar forma de publicación');
  assert.deepEqual(JSON.parse(view.requests[1].options.body), { action: 'publication.mode.save', eventId: 'edition-a', mode: 'block_complete' });
  await view.resolve(1, { ok: true });
  await view.resolve(2, publication({ mode: 'block_complete', sourceEventId: '', blocks: [], selectedBlock: null }));
  assert.match(text(view.tree), /todavía no está vinculado/);
  assert.match(text(view.tree), /no hace falta cerrarlo/);
  assert.doesNotMatch(JSON.stringify(view.requests.map(request => request.options.body)), /block\.close|block\.reopen|event\.upsert|asset\.publish|access\./);
  view.unmount();
});

test('the parent only receives a publication mode confirmed by the current edition server response', async () => {
  const view = harness();
  await view.resolve(0, publication({ mode: 'individual' }));
  assert.deepEqual(view.modeChanges, [{ eventId: 'edition-a', mode: 'individual' }]);
  view.change('Forma de publicación', 'block_complete');
  assert.equal(view.modeChanges.length, 1, 'an unsaved selection cannot enable automatic controls in the parent');
  view.click('Guardar forma de publicación');
  await view.resolve(1, { ok: true });
  assert.equal(view.modeChanges.length, 1, 'the write acknowledgement does not stand in for a fresh review');
  await view.resolve(2, publication({ mode: 'block_complete' }));
  assert.deepEqual(view.modeChanges.at(-1), { eventId: 'edition-a', mode: 'block_complete' });
  view.unmount();
});

test('edition navigation aborts old reads and ignores late block results', async () => {
  const view = harness();
  view.setProps({ eventId: 'edition-b' });
  assert.equal(view.requests[0].options.signal.aborted, true);
  await view.resolve(0, publication());
  assert.doesNotMatch(text(view.tree), /2 de 2 coreografías/);
  assert.equal(view.modeChanges.length, 0, 'a late old-edition response cannot change parent permissions');
  const second = publication(); second.selectedBlock.name = 'Bloque de otra edición'; second.blocks[0].name = second.selectedBlock.name;
  await view.resolve(1, second);
  assert.deepEqual(view.modeChanges, [{ eventId: 'edition-b', mode: 'block_close' }]);
  view.click('Cerrar y publicar bloque');
  assert.equal(JSON.parse(view.requests[2].options.body).eventId, 'edition-b');
  view.unmount();
});

test('late mutations after navigation cannot refresh or announce success in another edition', async () => {
  const view = harness();
  await view.resolve(0, publication());
  view.click('Cerrar y publicar bloque');
  view.setProps({ eventId: 'edition-b' });
  assert.equal(view.requests[1].options.signal.aborted, true);
  await view.resolve(1, { ok: true });
  assert.equal(view.changed.length, 0);
  assert.doesNotMatch(text(view.tree), /Bloque cerrado\. Su material/);
  assert.equal(view.requests.length, 3);
  assert.match(view.requests[2].path, /eventId=edition-b/);
  view.unmount();
});

test('authorization failures clear the review and stop additional requests', async () => {
  const view = harness();
  await view.resolve(0, publication());
  view.click('Actualizar revisión');
  await view.reject(1, new ApiError('Inicia sesión como administrador.', 401));
  assert.equal(view.errors.length, 1);
  assert.doesNotMatch(text(view.tree), /2 de 2 coreografías/);
  assert.match(text(view.tree), /Iniciar sesión/);
  assert.equal(view.requests.length, 2);
  view.click('Actualizar revisión'); assert.equal(view.requests.length, 2);
  view.unmount();
});


test('automatic mixed blocks distinguish published results from pending Relevé without marking jury sheets incomplete', async () => {
  const view = harness();
  const automatic = publication({ mode: 'block_complete' });
  Object.assign(automatic.selectedBlock, { state: 'open', complete: false, completedRoutines: 47, totalRoutines: 47, publishableRoutines: 42 });
  await view.resolve(0, automatic);
  assert.match(text(view.tree), /Votación del público pendiente/);
  assert.match(text(view.tree), /47 de 47 coreografías/);
  assert.match(text(view.tree), /42 resultados listos para publicarse/);
  assert.match(text(view.tree), /Relevé esperan el resultado de la votación/);
  assert.doesNotMatch(text(view.tree), /Evaluaciones pendientes|Las notas permanecen pendientes/);
  assert.equal(nodes(view.tree).some(node => node.type === 'button' && /cerrar|reabrir/i.test(text(node))), false);
  view.unmount();
});
