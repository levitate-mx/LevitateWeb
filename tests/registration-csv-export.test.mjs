import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/components/admin/RegistrationScreens.tsx", import.meta.url), "utf8");
const syntax = ts.createSourceFile("RegistrationScreens.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = syntax.statements.find((node) => (
  ts.isFunctionDeclaration(node) && node.name?.text === "createUtf8EncodedBlob"
));

assert.ok(declaration, "missing UTF-8 export helper");

const javascript = ts.transpileModule(
  `${declaration.getText(syntax)}\nglobalThis.createUtf8EncodedBlob = createUtf8EncodedBlob;`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
).outputText;
const scope = { Blob };
vm.runInNewContext(javascript, scope);

test("admin CSV exports include the UTF-8 marker Excel needs", async () => {
  const contents = "Participante,División,Descripción\nMuñoz,Aérea,Relevé · categoría infantil";
  const blob = scope.createUtf8EncodedBlob(contents, "text/csv;charset=utf-8");
  const bytes = new Uint8Array(await blob.arrayBuffer());

  assert.equal(blob.type, "text/csv;charset=utf-8");
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(await blob.text(), contents);
});

test("every admin CSV download uses the UTF-8 helper", () => {
  assert.doesNotMatch(source, /new Blob\(\[csv\]/);
  assert.equal((source.match(/createUtf8EncodedBlob\(csv,/g) || []).length, 8);
});
