import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = await readFile(new URL("../src/components/admin/MediaDriveConnectionPanel.tsx", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const nativeRequire = createRequire(import.meta.url);
const settle = () => new Promise(resolve => setImmediate(resolve));
const connection = (overrides = {}) => ({
  status: "connected", credentialsPresent: true, validated: true,
  account: { displayName: "Medios Levitate", emailAddress: "medios@example.test" },
  checkedAt: "2026-11-09T12:00:00.000Z", message: "Conexión comprobada.", folder: null, ...overrides,
});
const folder = (overrides = {}) => ({
  id: "folder-123", name: "Material del evento", driveId: null,
  status: "ready", validated: true, canAddChildren: true, ...overrides,
});

function createPanel() {
  let cursor = 0;
  const hooks = [], effects = [], calls = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
      return [hooks[index], next => { hooks[index] = typeof next === "function" ? next(hooks[index]) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useId() { cursor++; return "media-drive-test"; },
    useEffect(effect) {
      const index = cursor++;
      if (!(index in hooks)) { hooks[index] = true; effects.push(effect); }
    },
  };
  const scope = {
    exports: {}, AbortController, Error,
    require(name) {
      if (name === "react") return react;
      if (name.endsWith(".css")) return {};
      if (name === "./registrationApi") return {
        requestRegistrationApi(path, options) {
          let resolve, reject;
          const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
          calls.push({ path, options, resolve, reject });
          return promise;
        },
      };
      return nativeRequire(name);
    },
  };
  vm.runInNewContext(javascript, scope);
  let cleanup;
  return {
    calls,
    render() {
      cursor = 0;
      const tree = scope.exports.MediaDriveConnectionPanel();
      for (const effect of effects.splice(0)) cleanup = effect();
      return tree;
    },
    unmount() { cleanup?.(); },
  };
}

function find(tree, type) {
  if (!tree || typeof tree !== "object") return undefined;
  if (tree.type === type) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const match = find(child, type);
    if (match) return match;
  }
  return undefined;
}

test("checks Drive once on mount, then exposes the account and pending folder without importing files", async () => {
  const panel = createPanel();
  let tree = panel.render();
  assert.equal(panel.calls.length, 1);
  assert.equal(panel.calls[0].path, "/api/registration/admin/media-drive/connection");
  assert.equal(panel.calls[0].options.method, undefined);
  assert.equal(find(tree, "button").props.disabled, true);
  assert.equal(find(tree, "form"), undefined);

  panel.calls[0].resolve({ connection: connection() });
  await settle();
  tree = panel.render();
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Drive conectado/);
  assert.match(html, /Carpeta pendiente/);
  assert.match(html, /medios@example.test/);
  assert.match(html, /no publica ni importa sus archivos/);
  assert.doesNotMatch(html, /<a\b|type="password"|client_secret|refresh_token/);
  assert.ok(find(tree, "form"));
  panel.render();
  assert.equal(panel.calls.length, 1, "rendering does not poll Drive");
  find(tree, "button").props.onClick();
  assert.equal(panel.calls.length, 2, "a new check requires the explicit button");
  panel.unmount();
});

test("stored credentials alone never enable folder linking and errors remain retryable", async () => {
  const panel = createPanel();
  panel.render();
  panel.calls[0].resolve({ connection: connection({ status: "missing_configuration", validated: false }) });
  await settle();
  let tree = panel.render();
  assert.match(renderToStaticMarkup(tree), /Falta configurar Drive/);
  assert.equal(find(tree, "form"), undefined);

  find(tree, "button").props.onClick();
  panel.calls[1].reject(new Error("La cuenta no está disponible."));
  await settle();
  tree = panel.render();
  assert.match(renderToStaticMarkup(tree), /role="alert">La cuenta no está disponible/);
  assert.equal(find(tree, "button").props.disabled, false);
  assert.equal(find(tree, "form"), undefined);
  panel.unmount();
});

test("links only the entered folder and waits for verified server confirmation", async () => {
  const panel = createPanel();
  panel.render();
  panel.calls[0].resolve({ connection: connection() });
  await settle();
  let tree = panel.render();
  find(tree, "input").props.onChange({ target: { value: "  https://drive.google.com/drive/folders/folder-123  " } });
  tree = panel.render();
  const form = find(tree, "form");
  form.props.onSubmit({ preventDefault() {} });
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(panel.calls.length, 2, "repeated submissions cannot create parallel writes");
  assert.equal(panel.calls[1].path, "/api/registration/admin/media-drive/folder");
  assert.equal(panel.calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(panel.calls[1].options.body), { folder: "https://drive.google.com/drive/folders/folder-123" });
  assert.doesNotMatch(renderToStaticMarkup(panel.render()), /Carpeta verificada y vinculada/);

  panel.calls[1].resolve({ connection: connection({ folder: folder({ name: "Evento <privado>" }) }) });
  await settle();
  tree = panel.render();
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Carpeta verificada y vinculada/);
  assert.match(html, /Evento &lt;privado&gt;/);
  assert.doesNotMatch(html, /href=|Carpeta pendiente/);
  assert.equal(find(tree, "input").props.value, "");
  panel.unmount();
});

test("a folder access error stays distinct from a connected account and permits correction", async () => {
  const panel = createPanel();
  panel.render();
  panel.calls[0].resolve({ connection: connection({ folder: folder({
    status: "error", validated: false, canAddChildren: false, message: "Comparte la carpeta con la cuenta conectada.",
  }) }) });
  await settle();
  let tree = panel.render();
  let html = renderToStaticMarkup(tree);
  assert.match(html, /Drive conectado/);
  assert.match(html, /Carpeta por verificar/);
  assert.match(html, /Comparte la carpeta con la cuenta conectada/);
  assert.doesNotMatch(html, /Carpeta verificada y vinculada|Carpeta vinculada:/);
  assert.equal(find(tree, "input").props.value, "folder-123");
  find(tree, "input").props.onChange({ target: { value: "replacement-folder" } });
  tree = panel.render();
  find(tree, "form").props.onSubmit({ preventDefault() {} });
  panel.calls[1].reject(new Error("No tienes acceso a esta carpeta."));
  await settle();
  tree = panel.render();
  html = renderToStaticMarkup(tree);
  assert.match(html, /No tienes acceso a esta carpeta/);
  assert.match(html, /Drive conectado/);
  assert.equal(find(tree, "input").props.value, "replacement-folder", "a failed write preserves the entered value");
  panel.unmount();
});

test("a verified folder with read-only access remains linked without promising upload permission", async () => {
  const panel = createPanel();
  panel.render();
  panel.calls[0].resolve({ connection: connection() });
  await settle();
  let tree = panel.render();
  find(tree, "input").props.onChange({ target: { value: "read-only-folder" } });
  tree = panel.render();
  find(tree, "form").props.onSubmit({ preventDefault() {} });
  panel.calls[1].resolve({ connection: connection({ folder: folder({ id: "read-only-folder", canAddChildren: false }) }) });
  await settle();
  tree = panel.render();
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Carpeta vinculada:/);
  assert.match(html, /Acceso de lectura/);
  assert.match(html, /Carpeta verificada y vinculada/);
  assert.match(html, /La cuenta conectada debe tener acceso a la carpeta/);
  assert.doesNotMatch(html, /Carpeta por verificar|role="alert"|pueda agregar archivos/);
  assert.equal(find(tree, "input").props.value, "");
  panel.unmount();
});

test("an invalid connection response cannot unlock the form and unmount cancels requests", async () => {
  const panel = createPanel();
  panel.render();
  panel.calls[0].resolve({ connection: connection({ validated: false }) });
  await settle();
  let tree = panel.render();
  assert.match(renderToStaticMarkup(tree), /No se pudo leer el estado de Drive/);
  assert.equal(find(tree, "form"), undefined);
  find(tree, "button").props.onClick();
  const lastRequest = panel.calls.at(-1);
  panel.unmount();
  assert.equal(lastRequest.options.signal.aborted, true);
  lastRequest.resolve({ connection: connection() });
  await settle();
  tree = panel.render();
  assert.equal(find(tree, "form"), undefined, "a late response after unmount is ignored");
});
