import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import ts from 'typescript';

const helper = await readFile(new URL('../src/components/participant/participantPhotoSync.ts', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/components/participant/ParticipantPage.tsx', import.meta.url), 'utf8');
const syntax = ts.createSourceFile('ParticipantPage.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let photoEffect, photoEffectDependencies, retryAction;
const require = createRequire(import.meta.url);
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(syntax) === 'useEffect'
    && node.arguments[0]?.getText(syntax).includes('return startParticipantPhotoSync')) {
    photoEffect = node.arguments[0].getText(syntax);
    photoEffectDependencies = node.arguments[1].getText(syntax);
  }
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(syntax) === 'PhotoSyncNotice') {
    const retry = node.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(syntax) === 'onRetry');
    retryAction = retry?.initializer?.expression?.getText(syntax);
  }
  ts.forEachChild(node, visit);
}
visit(syntax);
assert.ok(photoEffect, 'the real passport mounts automatic photo synchronization');
assert.ok(retryAction, 'the gallery provides an explicit photo retry action');
const notice = syntax.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'PhotoSyncNotice').getText(syntax);
const compile = (source, jsx = false) => ts.transpileModule(source, { fileName: jsx ? 'photo-sync-ui.tsx' : 'photo-sync-ui.ts', compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const clone = value => JSON.parse(JSON.stringify(value));
const profile = (changes = {}) => ({ participant: { id: 'alison', name: 'Alison', academy: 'Danzarale' },
  selectedEventId: 'edomex-2026', events: [{ id: 'edomex-2026' }],
  routines: [{ id: 'beyond', photos: { count: 0, items: [] } }], ...changes });
const result = (changes = {}) => ({ participantId: 'alison', eventId: 'edomex-2026', status: 'pending', hasMore: false, imported: 0, ...changes });
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(overrides = {}) {
  const timers = new Map(), requests = [], updates = [], statuses = [];
  let sequence = 0;
  const scope = { exports: {}, require, AbortController, URLSearchParams,
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(compile(helper), scope);
  Object.assign(scope, {
    preview: false, isInternalPreview: false, phase: 'ready', changingEvent: false, photoSyncAttempt: 0, photoSyncStatus: 'ready',
    data: profile(), accessNavigation: { current: 0 }, eventRequest: { current: new AbortController() },
    photoIndex: 1, selected: 'beyond', error: '', canceledDownloads: 0,
    setData(value) { scope.data = value; scope.refreshContext.current.data = value; updates.push(value); },
    setPhotoSyncStatus(status) { scope.photoSyncStatus = status; statuses.push(status); },
    setPhotoSyncAttempt(value) { scope.photoSyncAttempt = typeof value === 'function' ? value(scope.photoSyncAttempt) : value; },
    setSelectedRoutineId(value) { scope.selected = typeof value === 'function' ? value(scope.selected) : value; },
    setPhotoIndex(value) { scope.photoIndex = value; },
    setError(value) { scope.error = value; },
    setPhase(value) { scope.phase = value; scope.refreshContext.current.phase = value; },
    cancelParticipantDownloads() { scope.canceledDownloads++; },
    participantPublicationChanged(before, after) { return JSON.stringify(before.routines) !== JSON.stringify(after.routines); },
    participantRequest(path, options) { return new Promise((resolve, reject) => requests.push({ path, options, resolve, reject })); },
    openParticipantAdminPreview(params, signal) { return new Promise((resolve, reject) => requests.push({
      path: 'admin-preview?' + params, options: { signal }, resolve, reject,
    })); },
    ...scope.exports, ...overrides,
  });
  scope.refreshContext = { current: { data: scope.data, phase: scope.phase, changingEvent: scope.changingEvent } };
  vm.runInNewContext(compile(`${notice}
exports.notice = PhotoSyncNotice; exports.retry = ${retryAction}; exports.dependencies = () => ${photoEffectDependencies}; exports.mount = ${photoEffect};`, true), scope);
  let dependencies = scope.exports.dependencies();
  let stop = scope.exports.mount();
  const noticeView = () => scope.exports.notice({ status: scope.photoSyncStatus, onRetry: () => {
    scope.exports.retry();
    const next = scope.exports.dependencies();
    if (next.some((value, index) => !Object.is(value, dependencies[index]))) {
      stop?.(); dependencies = next; stop = scope.exports.mount();
    }
  } });
  return { scope, requests, updates, statuses, timers, get stop() { return stop; }, notice: noticeView,
    retry() {
      const element = noticeView();
      const button = element?.props.children?.find?.(child => child?.type === 'button');
      assert.ok(button, 'retry must be an actual gallery button');
      button.props.onClick();
    },
    fire(delay) { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.callback(); } },
  };
}

test('opening the real passport automatically posts only edition identity, never Drive URLs, names or source bytes', async () => {
  const view = harness();
  assert.deepEqual(view.statuses, ['checking']);
  assert.equal(view.requests.length, 1);
  assert.equal(view.requests[0].path, '/api/participant/photos/sync');
  assert.equal(view.requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(view.requests[0].options.body), { eventId: 'edomex-2026' });
  assert.ok(view.requests[0].options.signal instanceof AbortSignal);
  view.stop();
  assert.equal(view.requests[0].options.signal.aborted, true);
  view.requests[0].resolve(result({ status: 'ready' })); await flush();
  assert.equal(view.requests.length, 1); assert.equal(view.updates.length, 0);
});

test('administrative passport review automatically uses authenticated admin synchronization and admin projection reads', async () => {
  const view = harness({ isInternalPreview: true });
  assert.equal(view.requests[0].path, '/api/registration/admin/participant-portal');
  assert.deepEqual(JSON.parse(view.requests[0].options.body), {
    action: 'photo.sync', eventId: 'edomex-2026', participantId: 'alison',
  });
  view.requests[0].resolve(result({ imported: 1, status: 'ready' })); await flush();
  assert.equal(view.requests[1].path, 'admin-preview?eventId=edomex-2026&participantId=alison');
  view.requests[1].resolve(profile()); await flush();
  assert.equal(view.updates.length, 1); assert.equal(view.statuses.at(-1), 'ready');
  view.stop();
});

test('static demos, unstable loading screens and changing editions do not start photo work', () => {
  for (const overrides of [{ preview: true }, { phase: 'loading' }, { changingEvent: true }, { data: null }]) {
    const view = harness(overrides);
    assert.equal(view.requests.length, 0); assert.equal(view.timers.size, 0); assert.equal(view.stop, undefined);
  }
});

test('each imported photo refreshes the projection before the next serialized processing step', async () => {
  const view = harness();
  view.requests[0].resolve(result({ imported: 1, hasMore: true })); await flush();
  assert.equal(view.requests.length, 2);
  assert.equal(view.requests[1].path, '/api/participant/me?eventId=edomex-2026');
  await flush(); assert.equal(view.requests.length, 2, 'the next import cannot race the profile refresh');
  const firstPhoto = profile({ routines: [{ id: 'beyond', photos: { count: 1, items: [{ id: 'safe-preview' }] } }] });
  view.requests[1].resolve(firstPhoto); await flush();
  assert.equal(view.requests.length, 3); assert.equal(view.requests[2].path, '/api/participant/photos/sync');
  assert.equal(view.scope.selected, 'beyond'); assert.equal(view.scope.photoIndex, null);
  assert.equal(view.scope.canceledDownloads, 1, 'a changed publication cancels old media work');
  view.requests[2].resolve(result({ status: 'ready' })); await flush();
  assert.equal(view.requests[3].path, '/api/participant/me?eventId=edomex-2026');
  view.requests[3].resolve(firstPhoto); await flush();
  assert.equal(view.updates.length, 2); assert.equal(view.requests.length, 4);
  assert.equal(view.statuses.at(-1), 'ready'); assert.equal(view.timers.size, 0);
  view.stop();
});

test('a competing server lease waits before retrying and cancellation clears the wait', async () => {
  const view = harness();
  view.requests[0].resolve(result({ status: 'checking', hasMore: true })); await flush();
  assert.equal(view.requests.length, 1); assert.ok([...view.timers.values()].some(timer => timer.delay === 1500));
  view.fire(1500); await flush();
  assert.equal(view.requests.length, 2);
  view.requests[1].resolve(result({ status: 'checking', hasMore: true })); await flush();
  view.stop(); await flush();
  assert.equal(view.timers.size, 0); assert.equal(view.requests.length, 2);
});

test('changing the QR identity or edition discards old step results and late projection reads', async () => {
  for (const phase of ['step', 'read']) {
    const view = harness();
    if (phase === 'read') { view.requests[0].resolve(result({ imported: 1 })); await flush(); }
    const pending = view.requests.at(-1);
    view.scope.accessNavigation.current++;
    view.scope.refreshContext.current.data = profile({ participant: { id: 'other-person' } });
    pending.resolve(phase === 'step' ? result({ imported: 1, status: 'ready' }) : profile());
    await flush();
    assert.equal(view.updates.length, 0); assert.equal(view.scope.phase, 'ready');
    assert.equal(view.requests.length, phase === 'step' ? 1 : 2);
    view.stop();
  }
});

test('a disposed passport suppresses late data and late server errors', async () => {
  for (const reject of [false, true]) {
    const view = harness();
    view.requests[0].resolve(result({ imported: 1 })); await flush();
    const pending = view.requests[1]; view.stop();
    assert.equal(pending.options.signal.aborted, true);
    if (reject) pending.reject({ status: 401 }); else pending.resolve(profile());
    await flush();
    assert.equal(view.updates.length, 0); assert.equal(view.scope.data.participant.id, 'alison');
    assert.equal(view.scope.phase, 'ready'); assert.equal(view.scope.canceledDownloads, 0);
  }
});

test('invalid access clears private data while a temporary processing failure keeps the current passport', async () => {
  for (const status of [401, 403, 404, 410, 503]) {
    const view = harness();
    view.requests[0].reject({ status }); await flush();
    if (status === 503) {
      assert.equal(view.scope.data.participant.id, 'alison'); assert.equal(view.scope.phase, 'ready');
      assert.equal(view.statuses.at(-1), 'unavailable'); assert.equal(view.scope.canceledDownloads, 0);
    } else {
      assert.equal(view.scope.data, null); assert.equal(view.scope.phase, 'access');
      assert.equal(view.scope.canceledDownloads, 1); assert.equal(view.scope.eventRequest.current.signal.aborted, true);
      assert.match(view.scope.error, /sesión/);
    }
    view.stop();
  }
});

test('mismatched step responses or profiles cannot install another participant photo projection', async () => {
  for (const mismatch of ['participant', 'event', 'profile', 'invalid-response']) {
    const view = harness();
    if (mismatch === 'profile') {
      view.requests[0].resolve(result({ imported: 1 })); await flush();
      view.requests[1].resolve(profile({ participant: { id: 'other-person' } }));
    } else view.requests[0].resolve(result(mismatch === 'participant' ? { participantId: 'other-person' }
      : mismatch === 'event' ? { eventId: 'other-edition' } : { hasMore: 'true' }));
    await flush();
    assert.equal(view.scope.data, null); assert.equal(view.scope.phase, 'access');
    view.stop();
  }
});

test('opening is bounded to twelve processing steps instead of an unbounded loop', async () => {
  const view = harness();
  for (let step = 0; step < 12; step++) {
    assert.equal(view.requests.length, step + 1);
    view.requests[step].resolve(result({ status: 'pending', hasMore: true })); await flush();
  }
  assert.equal(view.requests.length, 12); assert.equal(view.statuses.at(-1), 'pending'); assert.equal(view.timers.size, 0);
  view.stop();
});

test('a pending search remains pending and offers a visible retry without claiming the photos are ready', async () => {
  const view = harness();
  view.requests[0].resolve(result({ status: 'pending', hasMore: false })); await flush();
  assert.equal(view.statuses.at(-1), 'pending');
  assert.equal(view.requests.length, 1);
  const html = renderToStaticMarkup(view.notice());
  assert.match(html, /role="status"/);
  assert.match(html, /La preparación de tus fotografías sigue pendiente/);
  assert.match(html, /Volver a buscar fotos/);
  assert.doesNotMatch(html, /bloque|Drive|CURP|listas|preparando/i);
  assert.equal(view.scope.phase, 'ready');
  assert.equal(view.scope.selected, 'beyond');
  view.stop();
});

test('a temporary photo failure is visible and its retry restarts only photo work while preserving the passport', async () => {
  const existing = profile({ routines: [{ id: 'beyond', photos: { count: 1, items: [{ id: 'existing-photo' }] } }] });
  const view = harness({ data: existing });
  const before = clone(view.scope.data);
  view.requests[0].reject({ status: 503 }); await flush();
  assert.equal(view.statuses.at(-1), 'unavailable');
  let html = renderToStaticMarkup(view.notice());
  assert.match(html, /role="alert"/);
  assert.match(html, /No pudimos preparar tus fotografías en este momento/);
  assert.match(html, /Volver a buscar fotos/);
  assert.doesNotMatch(html, /portal_photo_source_not_private|Drive|CURP/);
  assert.deepEqual(view.scope.data, before);
  assert.equal(view.scope.canceledDownloads, 0);
  view.retry();
  assert.equal(view.scope.photoSyncAttempt, 1);
  assert.equal(view.scope.phase, 'ready');
  assert.equal(view.scope.selected, 'beyond');
  assert.deepEqual(view.scope.data, before);
  assert.equal(view.requests.length, 2, 'one click starts one fresh photo batch');
  assert.equal(view.requests[0].options.signal.aborted, true);
  assert.equal(view.requests[1].path, '/api/participant/photos/sync');
  assert.deepEqual(JSON.parse(view.requests[1].options.body), { eventId: 'edomex-2026' });
  html = renderToStaticMarkup(view.notice());
  assert.match(html, /Estamos preparando tus fotografías/);
  assert.doesNotMatch(html, /<button|Volver a buscar/);
  view.requests[1].resolve(result({ status: 'pending', hasMore: false })); await flush();
  assert.equal(view.statuses.at(-1), 'pending');
  view.retry();
  assert.equal(view.scope.photoSyncAttempt, 2);
  assert.equal(view.requests.length, 3);
  view.requests[2].resolve(result({ status: 'ready', imported: 1 })); await flush();
  assert.equal(view.requests[3].path, '/api/participant/me?eventId=edomex-2026');
  const updated = profile({ routines: [{ id: 'beyond', photos: { count: 2, items: [{ id: 'existing-photo' }, { id: 'new-photo' }] } }] });
  view.requests[3].resolve(updated); await flush();
  assert.equal(view.statuses.at(-1), 'ready');
  assert.equal(view.notice(), null, 'a successful refreshed gallery removes the retry notice');
  assert.equal(view.scope.selected, 'beyond');
  assert.equal(view.scope.phase, 'ready');
  assert.equal(view.scope.data.routines[0].photos.items.length, 2);
  assert.ok(view.requests.every(request => !request.path.includes('session') && !request.path.includes('login')));
  view.stop();
});

test('a server unavailable result stays unavailable and late retry responses cannot affect a different edition', async () => {
  for (const reject of [false, true]) {
    const view = harness();
    view.requests[0].resolve(result({ status: 'unavailable', hasMore: false })); await flush();
    assert.equal(view.statuses.at(-1), 'unavailable');
    assert.match(renderToStaticMarkup(view.notice()), /No pudimos preparar/);
    view.retry();
    const pending = view.requests[1];
    view.scope.accessNavigation.current++;
    view.scope.refreshContext.current.data = profile({ selectedEventId: 'other-edition' });
    if (reject) pending.reject({ status: 401 }); else pending.resolve(result({ status: 'ready', imported: 1 }));
    await flush();
    assert.equal(view.updates.length, 0);
    assert.equal(view.requests.length, 2);
    assert.equal(view.scope.phase, 'ready');
    assert.equal(view.scope.canceledDownloads, 0);
    view.stop();
  }
});
