import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = await readFile(new URL("../src/components/admin/AcademyJudgingSheetsPanel.tsx", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const nativeRequire = createRequire(import.meta.url);
const dance = { id: "dance-01", title: "Ángel en vuelo", categoryLabel: "Solo", participantNames: ["Persona Uno"] };
const summary = (overrides = {}) => ({ danceId: dance.id, eventId: "event-a", eventTitle: "Levitate Otoño", status: "available", judgeCount: 1, ...overrides });
const descriptor = (overrides = {}) => ({
  eventTitle: "Levitate Otoño", preview: false,
  routine: { id: "routine/42", title: dance.title, academy: "Academia Uno", genre: "TELA", category: "Solo", division: "Petite", level: "Intermedio", block: "4A" },
  judges: [{ id: "judge-1", name: "Juez Uno", status: "complete", penalty: 0,
    criteria: [{ id: 1, section: "Técnica", label: "Control", value: 8, maximumScore: 10 }] }],
  ...overrides,
});
const detail = (overrides = {}) => ({ ...summary(), judging: { source: "jueceocore", sourceStatus: "available", status: "available", preview: false,
  judges: [{ id: "judge-1", status: "complete" }], pdf: descriptor() }, ...overrides });

function text(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  return value?.props ? text(value.props.children) : "";
}
function nodes(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...[value.props?.children].flat(Infinity).flatMap(nodes)];
}

function harness(dances = [dance]) {
  const slots = [], requests = [], downloads = [], generated = [];
  let hook = 0, effects = [], dirty = true, tree;
  const dependenciesChanged = (left, right) => !left || left.length !== right.length || right.some((value, index) => !Object.is(value, left[index]));
  const react = {
    useState(initial) {
      const index = hook++;
      slots[index] ||= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (next) => {
        const value = typeof next === "function" ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useEffect(effect, dependencies) {
      const index = hook++, previous = slots[index];
      if (dependenciesChanged(previous?.dependencies, dependencies)) {
        slots[index] = { dependencies, cleanup: previous?.cleanup };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
    useMemo(factory, dependencies) {
      const index = hook++, previous = slots[index];
      if (dependenciesChanged(previous?.dependencies, dependencies)) slots[index] = { dependencies, value: factory() };
      return slots[index].value;
    },
    useCallback(callback, dependencies) {
      const index = hook++, previous = slots[index];
      if (dependenciesChanged(previous?.dependencies, dependencies)) slots[index] = { dependencies, value: callback };
      return slots[index].value;
    },
  };
  const scope = { exports: {}, AbortController, Blob, Error, Map, Set, Uint8Array,
    require(path) {
      if (path === "react") return react;
      if (path === "react/jsx-runtime") return nativeRequire(path);
      if (path === "lucide-react") return { Download: () => null, RefreshCw: () => null };
      if (path.endsWith(".css")) return {};
      if (path === "./registrationApi") return { requestRegistrationApi(pathname, options = {}) {
        return new Promise((resolve, reject) => requests.push({ path: pathname, options, resolve, reject }));
      } };
      if (path === "../../utils/browserDownload") return {
        prepareBrowserDownload(blob, fileName) { return { blob, fileName }; },
        startBrowserDownload(download) { downloads.push(download); },
      };
      if (path === "../../../shared/participant-judging-sheet.js") return { async generateParticipantJudgingPdf(input) {
        generated.push(input); return new Uint8Array([37, 80, 68, 70]);
      } };
      return nativeRequire(path);
    },
  };
  vm.runInNewContext(javascript, scope);
  function render() {
    let passes = 0;
    while (dirty) {
      if (++passes > 20) throw new Error("Render loop");
      dirty = false; hook = 0; effects = [];
      tree = scope.exports.AcademyJudgingSheetsPanel({ dances });
      for (const run of effects) run();
    }
  }
  async function settle() { await new Promise((resolve) => setImmediate(resolve)); await new Promise((resolve) => setImmediate(resolve)); render(); }
  render();
  return {
    requests, downloads, generated,
    get tree() { return tree; },
    button(label) { const found = nodes(tree).find((node) => node.type === "button" && text(node) === label); assert.ok(found, label); return found; },
    click(label) { this.button(label).props.onClick(); render(); },
    async resolve(index, value) { requests[index].resolve(value); await settle(); },
    async reject(index, cause) { requests[index].reject(cause); await settle(); },
    html() { return renderToStaticMarkup(tree); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test("loads academy-owned summaries and distinguishes available, pending and unlinked choreography cards", async () => {
  const view = harness([dance, { ...dance, id: "dance-02", title: "Pendiente" }, { ...dance, id: "dance-03", title: "Sin vínculo" }]);
  assert.equal(view.requests[0].path, "/api/registration/judging-sheets");
  assert.ok(view.requests[0].options.signal instanceof AbortSignal);
  await view.resolve(0, { sheets: [summary(), summary({ danceId: "dance-02", status: "pending", judgeCount: 0 }),
    summary({ danceId: "dance-03", eventId: null, eventTitle: null, status: "unavailable", judgeCount: 0 })] });
  const html = view.html();
  assert.match(html, /1 hoja disponible/);
  assert.match(html, /Pendiente de publicación/);
  assert.match(html, /No disponible por el momento/);
  assert.equal(nodes(view.tree).filter((node) => node.type === "button" && text(node) === "Descargar hojas").length, 1);
  assert.doesNotMatch(html, />Por publicar</);
  view.unmount();
});

test("revalidates a released sheet before generating the same PDF used by Mi Levitate", async () => {
  const view = harness();
  await view.resolve(0, { sheets: [summary()] });
  view.click("Descargar hojas");
  assert.equal(view.requests[1].path, "/api/registration/judging-sheets?danceId=dance-01");
  await view.resolve(1, { sheet: detail() });
  assert.equal(view.generated.length, 1);
  assert.equal(view.generated[0].preview, false);
  assert.equal(view.generated[0].judges[0].criteria[0].value, 8);
  assert.equal(view.downloads.length, 1);
  assert.equal(view.downloads[0].blob.type, "application/pdf");
  assert.equal(view.downloads[0].fileName, "levitate-jueceo-angel-en-vuelo-routine-42.pdf");
  view.unmount();
});

test("never generates from stale, foreign, preview or incomplete detail responses", async () => {
  const mutations = [
    (sheet) => { sheet.danceId = "other-dance"; },
    (sheet) => { sheet.eventId = "other-event"; },
    (sheet) => { sheet.status = "pending"; },
    (sheet) => { sheet.judging.preview = true; },
    (sheet) => { sheet.judging.pdf.preview = true; },
    (sheet) => { sheet.judging.pdf.judges[0].status = "partial"; },
    (sheet) => { sheet.judging.pdf.judges[0].criteria[0].value = null; },
    (sheet) => { sheet.judging.judges = []; },
  ];
  for (const mutate of mutations) {
    const view = harness(); await view.resolve(0, { sheets: [summary()] }); view.click("Descargar hojas");
    const sheet = structuredClone(detail()); mutate(sheet); await view.resolve(1, { sheet });
    assert.equal(view.generated.length, 0); assert.equal(view.downloads.length, 0);
    assert.match(view.html(), /role="alert"/); view.unmount();
  }
});

test("invalid or failed list responses remain explicit and retryable", async () => {
  const view = harness();
  await view.resolve(0, { sheets: [{ ...summary(), judgeCount: -1 }] });
  assert.match(view.html(), /role="alert"/);
  view.click("Actualizar");
  assert.equal(view.requests.length, 2);
  view.unmount();
  assert.equal(view.requests[1].options.signal.aborted, true);
});
