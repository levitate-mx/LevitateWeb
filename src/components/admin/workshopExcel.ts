import ExcelJS from 'exceljs';
import { buildWorkshopRosters, type WorkshopRosterSession } from '../../../shared/workshop-rosters.js';

export type WorkshopExportRow = { name: string; academyName: string; workshops: string[] };

export async function createWorkshopExcel(rows: WorkshopExportRow[], eventName: string, sessions: WorkshopRosterSession[] = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Levitate MX';
  workbook.created = new Date();
  const rosters = buildWorkshopRosters(rows, sessions);
  function addSheet(name: string, title: string, subtitle: string, headers: string[], widths: number[]) {
    const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    sheet.columns = widths.map(width => ({ width }));
    sheet.mergeCells(1, 1, 1, headers.length);
    sheet.mergeCells(2, 1, 2, headers.length);
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFA2366A' } };
    sheet.getRow(1).height = 28;
    sheet.getCell('A2').value = subtitle;
    sheet.getCell('A2').font = { name: 'Calibri', size: 11, color: { argb: 'FF706C69' } };
    sheet.getRow(2).height = 24;
    sheet.getRow(4).values = headers;
    sheet.getRow(4).height = 30;
    sheet.getRow(4).eachCell(cell => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA2366A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    sheet.pageSetup.printTitlesRow = '1:4';
    return sheet;
  }
  function addData(sheet: ExcelJS.Worksheet, values: (string | number)[][]) {
    for (const [index, valuesRow] of values.entries()) {
      // Strings remain literal text, including formula-like participant names.
      const row = sheet.addRow(valuesRow);
      row.height = 32;
      row.eachCell(cell => {
        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF312934' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        if (index % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F3F6' } };
      });
    }
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, sheet.rowCount), column: sheet.columnCount } };
  }
  const summary = addSheet('Resumen', 'Workshops por taller', `${eventName} · ${rows.length} participantes`, ['Taller y horario', 'Participantes'], [72, 18]);
  addData(summary, rosters.map(roster => [roster.label, roster.participants.length]));
  for (const roster of rosters) {
    const sheet = addSheet(roster.worksheetName, roster.label, `${eventName} · ${roster.participants.length} participantes`, ['N.º', 'Participante', 'Academia'], [8, 52, 38]);
    addData(sheet, roster.participants.map((participant, index) => [index + 1, participant.name, participant.academyName]));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
