import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { createWorkshopExcel } from "../src/components/admin/workshopExcel.ts";

const sampleRow = (index = 0) => ({
  name: `José María Núñez ${index + 1}`,
  curp: `001213MDFBBB${String(index).padStart(7, "0")}`,
  academyName: "Academia Raíces · México",
  workshops: ["Técnica aérea · 09:00", "Comedia musical · 11:00", "Flexibilidad · 13:00", "Jazz · 15:00"],
  extraCount: 1,
  amountDue: 200,
  paidAmount: index % 2 ? 0 : 125.5,
  balance: index % 2 ? 200 : 74.5,
  paymentReference: `000${String(index).padStart(8, "0")}`,
  paymentStatus: index % 2 ? "Pendiente" : "Pago parcial",
});

async function roundTrip(rows) {
  const blob = await createWorkshopExcel(rows, "Estado de México · Otoño 2026");
  const buffer = await blob.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return { blob, buffer, workbook, sheet: workbook.getWorksheet("Inscritos") };
}

test("workshop export is a genuine XLSX containing all 31 participants and their accented text", async () => {
  const rows = Array.from({ length: 31 }, (_, index) => sampleRow(index));
  const { blob, buffer, workbook, sheet } = await roundTrip(rows);

  assert.equal(blob.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.deepEqual([...new Uint8Array(buffer).slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], "XLSX must be a ZIP package, not renamed CSV or HTML");
  assert.equal(workbook.worksheets.length, 1);
  assert.ok(sheet, "the workbook contains an Inscritos sheet");
  assert.equal(sheet.columnCount, 11);
  assert.equal(sheet.rowCount, 35, "all records beyond a 25-row admin page must be included");
  assert.match(sheet.getCell("A2").value, /Estado de México · Otoño 2026/);
  assert.deepEqual(sheet.getRow(4).values.slice(1), [
    "Participante", "CURP", "Academia", "Talleres", "Cantidad", "Adicionales",
    "Total extras MXN", "Pagado MXN", "Pendiente MXN", "Referencia", "Estado del pago",
  ]);

  rows.forEach((participant, index) => {
    assert.deepEqual(sheet.getRow(index + 5).values.slice(1), [
      participant.name, participant.curp, participant.academyName,
      participant.workshops.join("\n"), participant.workshops.length, participant.extraCount,
      participant.amountDue, participant.paidAmount, participant.balance,
      participant.paymentReference, participant.paymentStatus,
    ]);
  });
});

test("Excel preserves numeric amounts and quantities while CURP and references retain leading zeroes", async () => {
  const participant = sampleRow();
  const { sheet } = await roundTrip([participant]);
  const row = sheet.getRow(5);

  for (const [column, expected] of [[5, 4], [6, 1], [7, 200], [8, 125.5], [9, 74.5]]) {
    assert.equal(row.getCell(column).type, ExcelJS.ValueType.Number);
    assert.equal(row.getCell(column).value, expected);
  }
  for (const [column, expected] of [[2, participant.curp], [10, participant.paymentReference]]) {
    assert.equal(row.getCell(column).type, ExcelJS.ValueType.String);
    assert.equal(row.getCell(column).value, expected);
    assert.ok(expected.startsWith("00"));
  }
});

test("formula-like participant data stays literal text in the generated workbook", async () => {
  const rows = ["=1+1", "+SUM(1,1)", "-1+1", "@SUM(1,1)"].map((value, index) => ({
    ...sampleRow(index),
    name: value,
    curp: value,
    academyName: value,
    workshops: [value],
    paymentReference: value,
    paymentStatus: value,
  }));
  const { sheet } = await roundTrip(rows);

  rows.forEach((participant, index) => {
    const row = sheet.getRow(index + 5);
    for (const column of [1, 2, 3, 4, 10, 11]) {
      const cell = row.getCell(column);
      assert.equal(cell.type, ExcelJS.ValueType.String);
      assert.equal(cell.value, participant.name, "formula prefixes must remain visible and unchanged");
      assert.equal(cell.formula, undefined, "exported participant data must never execute as a formula");
    }
  });
});
