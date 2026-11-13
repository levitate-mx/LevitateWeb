import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { createWorkshopExcel } from '../src/components/admin/workshopExcel.ts';
import { buildWorkshopRosters } from '../shared/workshop-rosters.js';
const sampleRow = index => ({ name: `José María Núñez ${index + 1}`, academyName: 'Academia Raíces · México',
  curp: 'PRIVATE-CURP', paymentReference: 'PRIVATE-REFERENCE', amountDue: 200,
  workshops: ['Tela · Aerial · 10:30 a. m.', 'Flex · Aerial · 9:00 a. m.'] });
const sessions = [{ label: 'Tela · Aerial · 10:30 a. m.', start: '10:30' }, { label: 'Flex · Aerial · 9:00 a. m.', start: '09:00' }];
async function roundTrip(rows, slots = sessions) {
  const blob = await createWorkshopExcel(rows, 'Estado de México · Otoño 2026', slots);
  const buffer = await blob.arrayBuffer(), workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return { blob, buffer, workbook };
}
test('workshop export contains a chronological summary and all participants per session beyond admin pagination', async () => {
  const rows = Array.from({ length: 31 }, (_, i) => sampleRow(i));
  const before = structuredClone(rows);
  const { blob, buffer, workbook } = await roundTrip(rows);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.deepEqual([...new Uint8Array(buffer).slice(0, 4)], [80,75,3,4]);
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Resumen', 'Flex Aerial 09.00', 'Tela Aerial 10.30']);
  const summary = workbook.getWorksheet('Resumen');
  assert.deepEqual(summary.getRow(4).values.slice(1), ['Taller y horario', 'Participantes']);
  assert.equal(summary.getCell('A5').value, sessions[1].label);
  assert.equal(summary.getCell('B5').value, 31);
  for (const sheet of workbook.worksheets.slice(1)) {
    assert.equal(sheet.rowCount, 35);
    assert.deepEqual(sheet.getRow(4).values.slice(1), ['N.º', 'Participante', 'Academia']);
    rows.forEach((participant, i) => assert.deepEqual(sheet.getRow(i + 5).values.slice(1), [i+1, participant.name, participant.academyName]));
    assert.equal(sheet.views[0].ySplit, 4);
  }
  assert.deepEqual(rows, before);
  assert.doesNotMatch(JSON.stringify(workbook.model), /PRIVATE-CURP|PRIVATE-REFERENCE/);
});
test('sessions with the same title keep separate rosters; a repeated selection never duplicates a participant', () => {
  const first = 'Comedia musical · Motion · 4:15 p. m.', second = 'Comedia musical · Motion · 6:00 p. m.';
  const rows = [{ name: 'Zoe', academyName: 'Uno', workshops: [first, first] }, { name: 'Ana', academyName: 'Dos', workshops: [second] }];
  const rosters = buildWorkshopRosters(rows, [{ label: first, start: '16:15' }, { label: second, start: '18:00' }]);
  assert.deepEqual(rosters.map(r => r.participants.map(p => p.name)), [['Zoe'], ['Ana']]);
  assert.equal(new Set(rosters.map(r => r.worksheetName)).size, 2);
});
test('formula-like names and academy labels remain literal text, and worksheet names are valid and unique', async () => {
  const labels = ['=1+1', '+SUM(1,1)', '-1+1', '@SUM(1,1)', 'Resumen', 'A'.repeat(40), 'A'.repeat(39)+'B', 'Bad[]:/?*Title'];
  const rows = labels.map(label => ({ name: label, academyName: label, workshops: [label] }));
  const { workbook } = await roundTrip(rows, []);
  assert.equal(new Set(workbook.worksheets.map(sheet => sheet.name.toLowerCase())).size, labels.length+1);
  for (const sheet of workbook.worksheets.slice(1)) {
    assert.ok(sheet.name.length <= 31); assert.doesNotMatch(sheet.name, /[\\/?*\[\]:]/);
    for (const address of ['A1','B5','C5']) {
      assert.equal(sheet.getCell(address).type, ExcelJS.ValueType.String);
      assert.equal(sheet.getCell(address).value, sheet.getCell('A1').value);
      assert.equal(sheet.getCell(address).formula, undefined);
    }
  }
});
