import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/participant-admin/ParticipantDriveDemoTrial.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value)
  : Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : '';
const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value)
  ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
class ApiError extends Error { constructor(message, status) { super(message); this.status = status; } }

function harness(initial = {}) {
  let props = { eventId: 'edition-one', participantId: 'person-one', ...initial };
  const slots = [], requests = [], completed = [], errors = [];
  let hook = 0, effects = [], dirty = true, tree;
  const hooks = {
    useState(initial) {
      const index = hook++;
      slots[index] ||= { value: initial };
      return [slots[index].value, value => {
        if (!Object.is(slots[index].value, value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = hook++; slots[index] ||= { current: initial }; return slots[index]; },
    useEffect(effect, dependencies) {
      const index = hook++, previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        slots[index] = { dependencies, cleanup: previous?.cleanup };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const scope = { exports: {}, Error, AbortController, URL, URLSearchParams, require(path) {
    if (path === 'react') return hooks;
    if (path === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    assert.equal(path, '../admin/registrationApi');
    return { RegistrationApiError: ApiError, requestRegistrationApi(path, options) {
      return new Promise((resolve, reject) => requests.push({ path, options, resolve, reject }));
    } };
  } };
  vm.runInNewContext(compiled, scope);
  function render() {
    let count = 0;
    while (dirty) {
      assert.ok(++count < 20, 'No render loop');
      dirty = false; hook = 0; effects = [];
      tree = scope.exports.ParticipantDriveDemoTrial({ ...props, onComplete: () => completed.push(true), onError: cause => errors.push(cause) });
      for (const effect of effects) effect();
    }
  }
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
  render();
  return {
    requests, completed, errors,
    get tree() { return tree; },
    get button() { return nodes(tree).find(node => node.type === 'button'); },
    click() { this.button.props.onClick(); render(); },
    clickNamed(label) { const button = nodes(tree).find(node => node.type === 'button' && text(node) === label); assert.ok(button); button.props.onClick(); render(); },
    select(value) { nodes(tree).find(node => node.type === 'select').props.onChange({ target: { value } }); render(); },
    async resolve(index, value) { requests[index].resolve(value); await settle(); },
    async reject(index, cause) { requests[index].reject(cause); await settle(); },
    setProps(changes) { props = { ...props, ...changes }; dirty = true; render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}
function trial(changes = {}) {
  return { folder: { id: 'folder_demotest_1234', name: 'Aire Norte · Alison · PRUEBA', accountEmail: 'music@example.com', url: 'https://drive.google.com/drive/folders/folder_demotest_1234' },
    eventId: 'edition-one', participantId: 'person-one', danceId: 'dance-one', routineId: 'routine-one', imported: 2, reused: 0,
    previewUrl: '/admin/mi-levitate/resumen?eventId=edition-one&participantId=person-one', ...changes };
}

test('the trial requests only the selected participant choreography directory before allowing a mutation', async () => {
  const view = harness();
  const url = new URL(view.requests[0].path, 'https://levitate.mx');
  assert.deepEqual(Object.fromEntries(url.searchParams), { photoTrial: '1', eventId: 'edition-one', participantId: 'person-one' });
  assert.equal(view.button.props.disabled, true);
  view.click(); assert.equal(view.requests.length, 1);
  await view.resolve(0, { routines: [] });
  assert.equal(view.button.props.disabled, true);
  assert.match(text(view.tree), /no tiene coreografías/);
  view.unmount();
});

test('one choreography is selected automatically; the trial makes one explicit admin request and displays verified internal links', async () => {
  const view = harness();
  await view.resolve(0, { routines: [{ danceId: 'dance-one', title: 'Aire Norte' }] });
  view.click(); view.click();
  assert.equal(view.requests.length, 2, 'double click cannot start a duplicate request');
  assert.deepEqual(JSON.parse(view.requests[1].options.body), { action: 'photo.demo.trial', eventId: 'edition-one', participantId: 'person-one', danceId: 'dance-one' });
  await view.resolve(1, trial());
  assert.equal(view.completed.length, 1);
  const links = nodes(view.tree).filter(node => node.type === 'a');
  assert.equal(links.length, 2);
  assert.equal(links[0].props.href, trial().folder.url);
  assert.equal(links[1].props.href, trial().previewUrl);
  assert.match(text(view.tree), /fotos en borrador/);
  assert.match(text(view.tree), /Al abrir el pasaporte se buscan y preparan las fotos nuevas/);
  assert.doesNotMatch(view.requests[1].options.body, /published|access\.create|event\.upsert|asset\.publish/);
  view.unmount();
});

test('several choreographies require a choice; changed choices clear previous trial links', async () => {
  const view = harness();
  await view.resolve(0, { routines: [{ danceId: 'dance-one', title: 'Aire Norte' }, { danceId: 'dance-two', title: 'Órbita' }] });
  assert.equal(view.button.props.disabled, true);
  view.select('dance-one'); view.click(); await view.resolve(1, trial());
  assert.equal(nodes(view.tree).filter(node => node.type === 'a').length, 2);
  view.select('dance-two');
  assert.equal(nodes(view.tree).filter(node => node.type === 'a').length, 0);
  view.unmount();
});

test('the automatic trial seeds an unmarked source and links to the passport where processing starts', async () => {
  const view = harness();
  await view.resolve(0, { routines: [{ danceId: 'dance-one', title: 'Aire Norte' }] });
  view.click(); await view.resolve(1, trial());
  view.clickNamed('Preparar foto sin marca para prueba automática');
  assert.deepEqual(JSON.parse(view.requests[2].options.body), { action: 'photo.source.demo.prepare', eventId: 'edition-one', participantId: 'person-one', danceId: 'dance-one' });
  await view.resolve(2, trial({ imported: 0 }));
  assert.match(text(view.tree), /guardada sin marca.*Abre su pasaporte para generar automáticamente/);
  assert.equal(nodes(view.tree).find(node => node.type === 'a' && /Ver previews/.test(text(node))).props.href, trial().previewUrl);
  view.unmount();
});

test('a missing Google folder URL still shows the successful trial and the internal passport preview', async () => {
  const view = harness();
  await view.resolve(0, { routines: [{ danceId: 'dance-one', title: 'Aire Norte' }] });
  view.click();
  await view.resolve(1, trial({ folder: { ...trial().folder, url: null } }));
  assert.equal(view.completed.length, 1);
  assert.match(text(view.tree), /Las dos fotos demo están listas/);
  const links = nodes(view.tree).filter(node => node.type === 'a');
  assert.equal(links.length, 1);
  assert.equal(links[0].props.href, trial().previewUrl);
  assert.equal(nodes(view.tree).some(node => node.props.role === 'alert'), false);
  view.unmount();
});

test('switching participants cancels the pending trial and ignores its late response', async () => {
  const view = harness();
  await view.resolve(0, { routines: [{ danceId: 'dance-one', title: 'Aire Norte' }] });
  view.click(); view.setProps({ participantId: 'person-two' });
  assert.equal(view.requests[1].options.signal.aborted, true);
  await view.resolve(1, trial());
  assert.equal(view.completed.length, 0);
  assert.equal(nodes(view.tree).filter(node => node.type === 'a').length, 0);
  await view.resolve(2, { routines: [] });
  assert.match(text(view.tree), /no tiene coreografías/);
  view.unmount();
});

test('mismatched participant data or provider links are rejected without navigation', async () => {
  for (const bad of [trial({ participantId: 'person-two' }), trial({ previewUrl: 'https://other.example/admin/mi-levitate/resumen?eventId=edition-one&participantId=person-one' }), trial({ folder: { ...trial().folder, url: 'https://drive.google.com.evil.example/drive/folders/folder_demotest_1234' } })]) {
    const view = harness();
    await view.resolve(0, { routines: [{ danceId: 'dance-one', title: 'Aire Norte' }] });
    view.click(); await view.resolve(1, bad);
    assert.equal(view.completed.length, 0);
    assert.equal(nodes(view.tree).filter(node => node.type === 'a').length, 0);
    assert.ok(nodes(view.tree).some(node => node.props.role === 'alert'));
    view.unmount();
  }
});

test('an expired admin session uses the existing authorization error handler', async () => {
  const view = harness();
  await view.reject(0, new ApiError('Inicia sesión como administrador.', 401));
  assert.equal(view.errors.length, 1);
  assert.equal(view.button.props.disabled, true);
  assert.match(text(view.tree), /Inicia sesión/);
  view.unmount();
});
