import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { compactJudgingCategoryTitle } from '../shared/judging-category-title.js';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/components/judging/JudgingAdminWorkspace.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const key = eventId => `levitate-judging-scores-block:${eventId}`;
const nodes = element => !element || typeof element !== 'object' ? [] : Array.isArray(element)
  ? element.flatMap(nodes) : [element, ...nodes(element.props?.children)];

function fixture(eventId = 'event-one', ids = ['b1', 'b2', 'b3']) {
  const event = { id: eventId, name: eventId, event_type: 'event', is_active: true };
  const judge = { judge_id: 'eva', name: 'EVA CARRILLO', role: 'judge', photo_data: '', assigned_block_ids: [] };
  return {
    event, judges: [judge], favorites: [], specialAwards: [], accounts: [],
    blocks: ids.map(block_id => ({ block_id, name: block_id, title: block_id })),
    routines: ids.map(block_id => ({ routine_id: `routine-${block_id}`, block_id,
      name: `Pieza ${block_id}`, academy: 'Academia', genre: 'JAZZ', division: 'Teen',
      level: 'Intermedio', category: 'Solo', updated_at: '2026-11-14T12:00:00Z' })),
    snapshot: { fetchedAt: '2026-11-14T12:00:00Z', warnings: [],
      rows: ids.map(blockId => ({ id: `routine-${blockId}`, name: `Pieza ${blockId}`, academy: 'Academia',
        blockId, genre: 'JAZZ', status: 'pending', recordedScores: 0, completedJudges: 0, expectedJudges: 1,
        judges: [{ id: 'eva', name: judge.name, status: 'pending', criteria: [], feedback: '', subtotal: null, total: null, penalty: 0 }] })),
      report: { maximumScore: 210, blocks: ids.map(id => ({ id, name: id, title: id, sections: [], specialAwards: [] })) },
    },
  };
}

function memoryStorage(initial = {}, unavailable = false) {
  const values = new Map(Object.entries(initial));
  const reads = [], writes = [];
  return {
    values, reads, writes,
    getItem(name) { if (unavailable) throw new Error('Storage denied'); reads.push(name); return values.get(name) ?? null; },
    setItem(name, value) { if (unavailable) throw new Error('Storage denied'); writes.push([name, value]); values.set(name, value); },
    removeItem(name) { if (unavailable) throw new Error('Storage denied'); values.delete(name); },
  };
}

// Run the actual component with stable hooks, dependency-aware effects and
// mocked reads. Remounting uses a fresh hook store and the same browser storage.
function harness({ view = 'scores', eventId = 'event-one', storage = memoryStorage(), bundles } = {}) {
  const data = bundles ?? new Map([['event-one', fixture()], ['event-two', fixture('event-two')]]);
  const hooks = [], timers = new Map(), requests = [], navigation = [];
  const location = { href: `https://levitate.mx/jueceo/admin?event=${eventId}&view=${view}`,
    search: `?event=${eventId}&view=${view}`, assign(url) { navigation.push(url); } };
  let cursor = 0, effects = [], dirty = true, tree, active = true, nextTimer = 0;
  const changed = (before, after) => !before || !after || before.length !== after.length
    || after.some((value, index) => !Object.is(value, before[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [hooks[index].value, next => {
        const value = typeof next === 'function' ? next(hooks[index].value) : next;
        if (!Object.is(value, hooks[index].value)) { hooks[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; hooks[index] ??= { current: initial }; return hooks[index]; },
    useCallback(callback, dependencies) {
      const index = cursor++, previous = hooks[index];
      if (!previous || changed(previous.dependencies, dependencies)) hooks[index] = { value: callback, dependencies };
      return hooks[index].value;
    },
    useEffect(effect, dependencies) {
      const index = cursor++, previous = hooks[index];
      if (!previous || changed(previous.dependencies, dependencies)) {
        const slot = hooks[index] = { dependencies, cleanup: previous?.cleanup };
        effects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const scope = { exports: {}, URL, URLSearchParams, Date, Map, Set, Error, location, sessionStorage: storage,
    localStorage: { getItem: () => 'dark', setItem() {} },
    history: { replaceState(_state, _title, url) {
      location.href = String(url); location.search = new URL(location.href).search;
    } },
    document: { hidden: false, fullscreenEnabled: false, fullscreenElement: null,
      addEventListener() {}, removeEventListener() {} },
    setInterval(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearInterval(id) { timers.delete(id); },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name.endsWith('registrationApi')) return { async requestRegistrationApi(path, options) {
        requests.push({ path, options });
        const url = new URL(path, 'https://levitate.mx');
        if (url.pathname.endsWith('/events')) return { events: [...data.values()].map(b => b.event), user: { name: 'Admin', role: 'judging_admin' } };
        if (url.pathname.endsWith('/snapshot')) return structuredClone(data.get(url.searchParams.get('eventId')));
        if (url.pathname.endsWith('/activity')) return { activity: [] };
        throw new Error(`Unexpected request ${path}`);
      } };
      if (name.endsWith('JudgingScoresPanel') || name.endsWith('dictamenAnnouncements') || name.endsWith('DictamenAnnouncementCheck')) return {};
      if (name.endsWith('judging-category-title.js')) return { compactJudgingCategoryTitle };
      if (name.endsWith('judgePortraits')) return { resolveJudgePortrait: () => undefined };
      if (name.endsWith('ReleveVotingAdminPanel')) return { ReleveVotingAdminPanel: () => null };
      if (name.endsWith('.css')) return {};
      return require(name);
    },
  };
  vm.runInNewContext(compiled, scope);
  function render() {
    let count = 0;
    while (active && dirty) {
      assert.ok(++count < 30, 'Component entered a render loop');
      dirty = false; cursor = 0; effects = [];
      tree = scope.exports.JudgingAdminWorkspace();
      for (const effect of effects) effect();
    }
  }
  async function settle() {
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise(resolve => setImmediate(resolve)); render();
    }
  }
  const node = predicate => nodes(tree).find(predicate);
  function blockSelect() {
    const label = node(n => n.type === 'label' && n.props.className === 'ja-block');
    return label && nodes(label).find(n => n.type === 'select');
  }
  render();
  return {
    storage, requests, navigation, bundles: data, settle,
    get url() { return location.href; },
    get block() { return blockSelect()?.props.value ?? node(n => n.type?.name === 'ReportPanel')?.props.blockId; },
    get error() { return node(n => n.props?.role === 'alert'); },
    async selectBlock(value) {
      const select = blockSelect();
      if (select) select.props.onChange({ target: { value } });
      else { const report = node(n => n.type?.name === 'ReportPanel'); assert.ok(report); report.props.onBlockChange(value); }
      render(); await settle();
    },
    async selectEvent(value) {
      const select = node(n => n.type === 'select' && n.props.id === 'ja-event'); assert.ok(select);
      select.props.onChange({ target: { value } }); render(); await settle();
    },
    async refresh() {
      const button = node(n => n.props?.label === 'Actualizar datos'); assert.ok(button);
      button.props.onClick(); render(); await settle();
    },
    async autoRefresh() {
      const timer = [...timers.values()].find(t => t.delay === 30_000); assert.ok(timer, 'Automatic snapshot refresh must be scheduled');
      timer.callback(); render(); await settle();
    },
    openEditor() {
      const button = node(n => typeof n.props?.title === 'string' && n.props.title.startsWith('Editar hoja de ')); assert.ok(button);
      button.props.onClick(); render();
    },
    unmount() { active = false; for (const hook of hooks) hook?.cleanup?.(); },
  };
}

test('score editing keeps its current block through manual and automatic snapshot refreshes', async () => {
  const page = harness(); await page.settle(); assert.equal(page.block, 'b1');
  await page.selectBlock('b3');
  const before = page.requests.filter(r => r.path.includes('/snapshot?')).length;
  await page.refresh(); assert.equal(page.block, 'b3');
  await page.autoRefresh(); assert.equal(page.block, 'b3');
  assert.equal(page.requests.filter(r => r.path.includes('/snapshot?')).length, before + 2);
  assert.equal(page.error, undefined); page.unmount();
});

test('a full reload and the sheet editor return restore the score block for the same event', async () => {
  const storage = memoryStorage();
  const first = harness({ storage }); await first.settle(); await first.selectBlock('b2');
  assert.equal(storage.values.get(key('event-one')), 'b2');
  first.unmount();
  const reloaded = harness({ storage }); await reloaded.settle(); assert.equal(reloaded.block, 'b2');
  reloaded.openEditor();
  assert.match(reloaded.navigation[0], /^\/jueceo\/app\/\?/);
  assert.equal(new URL(reloaded.navigation[0], 'https://levitate.mx').searchParams.get('event'), 'event-one');
  reloaded.unmount();
  const returned = harness({ storage }); await returned.settle(); assert.equal(returned.block, 'b2'); returned.unmount();
});

test('score blocks are remembered by event without overwriting another event during its load', async () => {
  const storage = memoryStorage({ [key('event-one')]: 'b3', [key('event-two')]: 'b2' });
  const page = harness({ storage }); await page.settle(); assert.equal(page.block, 'b3');
  await page.selectEvent('event-two'); assert.equal(page.block, 'b2');
  assert.equal(storage.values.get(key('event-one')), 'b3');
  assert.equal(storage.values.get(key('event-two')), 'b2');
  await page.selectEvent('event-one'); assert.equal(page.block, 'b3'); page.unmount();
});

test('missing remembered or removed score blocks fall back to the first available block', async () => {
  const storage = memoryStorage({ [key('event-one')]: 'removed-block' });
  const page = harness({ storage }); await page.settle(); assert.equal(page.block, 'b1');
  await page.selectBlock('b3'); page.bundles.set('event-one', fixture('event-one', ['b1', 'b2']));
  await page.refresh(); assert.equal(page.block, 'b1'); assert.equal(storage.values.get(key('event-one')), 'b1'); page.unmount();
});

test('home, favorites and final report ignore and do not overwrite the score-only remembered block', async () => {
  for (const view of ['home', 'favorites', 'report']) {
    const storage = memoryStorage({ [key('event-one')]: 'b3' });
    const page = harness({ view, storage }); await page.settle(); assert.equal(page.block, 'b1', view);
    await page.selectBlock('b2'); await page.refresh(); assert.equal(page.block, 'b2', view);
    assert.equal(storage.values.get(key('event-one')), 'b3', view);
    assert.equal(storage.reads.filter(k => k === key('event-one')).length, 0, view);
    assert.equal(storage.writes.filter(([k]) => k === key('event-one')).length, 0, view);
    page.unmount();
  }
});

test('blocked browser storage does not prevent score refresh or lose the in-memory block', async () => {
  const page = harness({ storage: memoryStorage({}, true) }); await page.settle(); assert.equal(page.block, 'b1');
  await page.selectBlock('b2'); await page.refresh(); await page.autoRefresh();
  assert.equal(page.block, 'b2'); assert.equal(page.error, undefined); page.unmount();
});
