import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareBrowserDownload,
  startBrowserDownload,
} from "../src/utils/browserDownload.ts";

function downloadEnvironment(t, { failClick = false } = {}) {
  const links = [];
  const document = {
    body: {
      append(link) {
        link.attached = true;
      },
    },
    createElement(tag) {
      assert.equal(tag, "a");
      const link = {
        attached: false,
        click() {
          assert.equal(this.attached, true);
          if (failClick) throw new Error("Download blocked");
        },
        remove() {
          this.attached = false;
        },
      };
      links.push(link);
      return link;
    },
  };
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = document;
  globalThis.window = globalThis;
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  return links;
}

test("PDF remains readable after a delayed save and repeat download reuses the prepared URL", async (t) => {
  const links = downloadEnvironment(t);
  const bytes = new Uint8Array([
    37, 80, 68, 70, 45, 49, 46, 52, 10, 255, 0, 37, 37, 69, 79, 70,
  ]);
  const download = prepareBrowserDownload(
    new Blob([bytes], { type: "application/pdf" }),
    "academia.pdf",
  );
  t.after(() => URL.revokeObjectURL(download.url));
  startBrowserDownload(download);
  t.mock.timers.tick(120_000);
  let response = await fetch(download.url);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  startBrowserDownload(download);
  assert.equal(links[0].href, links[1].href);
  assert.equal(links[0].download, "academia.pdf");
  assert.equal(
    links[0].target,
    "_blank",
    "a PDF preview must not replace its source document",
  );
  assert.equal(links[0].rel, "noopener");
  assert.ok(links.every((link) => !link.attached));
  response = await fetch(download.url);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test("blocked automatic download still leaves the file available for a manual save", async (t) => {
  const links = downloadEnvironment(t, { failClick: true });
  const download = prepareBrowserDownload(
    new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" }),
    "pendientes.pdf",
  );
  t.after(() => URL.revokeObjectURL(download.url));
  assert.throws(() => startBrowserDownload(download), /Download blocked/);
  assert.equal(links[0].attached, false);
  t.mock.timers.tick(120_000);
  assert.equal(await (await fetch(download.url)).text(), "%PDF-1.4\n%%EOF");
});
