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

function getFunctionDeclaration(name) {
  const node = syntax.statements.find((statement) => (
    ts.isFunctionDeclaration(statement) && statement.name?.text === name
  ));

  assert.ok(node, `missing ${name} helper`);
  return node;
}

function loadFunctions(names, globals = {}) {
  const declarations = names.map((name) => getFunctionDeclaration(name).getText(syntax));
  const assignments = names.map((name) => `globalThis.${name} = ${name};`);
  const compiled = ts.transpileModule(
    `${declarations.join("\n")}\n${assignments.join("\n")}`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  const context = { ...globals };

  vm.runInNewContext(compiled, context);
  return context;
}

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

test("photo and video orders label their unique purchased choreographies", () => {
  const helper = loadFunctions(["getOrderMediaChoreographyLabel"], {
    getOrderMediaLineItems(order) {
      return order.lineItems.filter((lineItem) => lineItem.itemType === "media");
    },
  }).getOrderMediaChoreographyLabel;
  const order = {
    lineItems: [
      { itemType: "media", danceTitle: "  Vuelo rosa  " },
      { itemType: "media", danceTitle: "Vuelo rosa" },
      { itemType: "media", danceTitle: "Cielo abierto" },
      { itemType: "ticket", danceTitle: "No debe aparecer" },
    ],
  };

  assert.equal(helper(order), "Vuelo rosa, Cielo abierto");
  assert.equal(helper({ lineItems: [{ itemType: "media" }] }), "Sin coreografía registrada");
  assert.equal(helper({ lineItems: [] }), "Sin coreografía registrada");
});

test("photo and video orders label the unique programme blocks for their choreographies", () => {
  const helper = loadFunctions(["getOrderMediaBlockLabel"], {
    getOrderMediaLineItems(order) {
      return order.lineItems.filter((lineItem) => lineItem.itemType === "media");
    },
  }).getOrderMediaBlockLabel;
  const order = {
    lineItems: [
      { itemType: "media", danceId: "dance-rose" },
      { itemType: "media", danceId: "dance-sky" },
      { itemType: "media", danceId: "dance-moon" },
      { itemType: "ticket", danceId: "dance-ticket" },
    ],
  };
  const dances = [
    { id: "dance-rose", program: { blockId: "3", blockTitle: "  BLOQUE 3 · AÉREO  " } },
    { id: "dance-sky", program: { blockId: "3", blockTitle: "BLOQUE 3 · AÉREO" } },
    { id: "dance-moon", program: { blockId: "5", blockTitle: "BLOQUE 5 · JUNIOR" } },
    { id: "dance-ticket", program: { blockId: "9", blockTitle: "NO DEBE APARECER" } },
  ];

  assert.equal(helper(order, dances), "BLOQUE 3 · AÉREO, BLOQUE 5 · JUNIOR");
  assert.equal(helper({ lineItems: [{ itemType: "media", danceId: "missing" }] }, dances), "Sin bloque asignado");
  assert.equal(helper({ lineItems: [] }, dances), "Sin bloque asignado");
});

test("photo and video CSV includes the choreography column produced by the shared helper", async () => {
  let downloadedBlob;
  let blockCalls = 0;
  let choreographyCalls = 0;
  let receivedDances;
  const csv = loadFunctions(
    ["toRegistrationCsvValue", "createUtf8EncodedBlob", "downloadMediaOrdersCsv"],
    {
      Blob,
      URL: {
        createObjectURL(blob) {
          downloadedBlob = blob;
          return "blob:photo-video-export";
        },
        revokeObjectURL() {},
      },
      document: {
        createElement() {
          return { click() {} };
        },
      },
      getAdminOrderDate() {
        return { date: "23/11/2026" };
      },
      getAdminPaymentStatusLabel() {
        return "Pagado";
      },
      getOrderMediaBlockLabel(_order, dances) {
        blockCalls += 1;
        receivedDances = dances;
        return "BLOQUE 3 · AÉREO";
      },
      getOrderMediaChoreographyLabel() {
        choreographyCalls += 1;
        return "Vuelo rosa / Cielo abierto";
      },
      getOrderMediaConcept() {
        return "Paquete digital";
      },
      getOrderMediaItemCount() {
        return 2;
      },
      getRegistrationInscriptionPaymentReference() {
        return "FOTO-001";
      },
      getRegistrationOrderBuyerLabel() {
        return "Compradora de prueba";
      },
    },
  );
  const dances = [{ id: "dance-rose", program: { blockId: "3", blockTitle: "BLOQUE 3 · AÉREO" } }];

  csv.downloadMediaOrdersCsv([{
    academyName: "Academia prueba",
    amount: 1800,
    buyerEmail: "compra@example.test",
    buyerPhone: "+525555555555",
    curp: "CURP-DE-PRUEBA",
    paidAmount: 1800,
    participantName: "Participante prueba",
    proof: { fileName: "comprobante.pdf" },
    status: "paid",
  }], dances);

  assert.ok(downloadedBlob, "the export should create a CSV blob");
  assert.equal(choreographyCalls, 1, "the CSV should reuse the page choreography label");
  assert.equal(blockCalls, 1, "the CSV should reuse the page block label");
  assert.equal(receivedDances, dances, "the CSV should resolve blocks from the loaded programme");
  const [headerRow, dataRow] = (await downloadedBlob.text()).replace(/^\uFEFF/, "").split("\n");
  const headers = headerRow.split(",");
  const values = dataRow.split(",");
  const choreographyIndex = headers.indexOf("Coreografía");
  const blockIndex = headers.indexOf("Bloque");

  assert.notEqual(choreographyIndex, -1);
  assert.equal(values[choreographyIndex], "Vuelo rosa / Cielo abierto");
  assert.notEqual(blockIndex, -1);
  assert.equal(values[blockIndex], "BLOQUE 3 · AÉREO");
});
