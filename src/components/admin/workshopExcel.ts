import ExcelJS from "exceljs";

export type WorkshopExportRow = {
  name: string;
  curp: string;
  academyName: string;
  workshops: string[];
  extraCount: number;
  amountDue: number;
  paidAmount: number;
  balance: number;
  paymentReference: string;
  paymentStatus: string;
};

export async function createWorkshopExcel(rows: WorkshopExportRow[], eventName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Levitate MX";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Inscritos", {
    views: [{ state: "frozen", ySplit: 4, xSplit: 1 }],
  });
  const headers = ["Participante", "CURP", "Academia", "Talleres", "Cantidad", "Adicionales",
    "Total extras MXN", "Pagado MXN", "Pendiente MXN", "Referencia", "Estado del pago"];
  const widths = [34, 24, 32, 66, 12, 14, 20, 18, 20, 26, 20];
  sheet.columns = widths.map(width => ({ width }));
  sheet.mergeCells("A1:K1");
  sheet.getCell("A1").value = "Workshops · Levitate MX";
  sheet.getCell("A1").font = { name: "Calibri", size: 20, bold: true, color: { argb: "FFA2366A" } };
  sheet.getRow(1).height = 34;
  sheet.mergeCells("A2:K2");
  sheet.getCell("A2").value = `${eventName} · ${rows.length} participantes exportados`;
  sheet.getCell("A2").font = { name: "Calibri", size: 11, color: { argb: "FF706C69" } };
  sheet.getRow(2).height = 24;
  sheet.getRow(4).values = headers;
  sheet.getRow(4).height = 30;
  sheet.getRow(4).eachCell(cell => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA2366A" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  for (const [index, enrollment] of rows.entries()) {
    // Strings are stored as text cells, never parsed as Excel formulas.
    const row = sheet.addRow([
      enrollment.name, enrollment.curp, enrollment.academyName, enrollment.workshops.join("\n"),
      enrollment.workshops.length, enrollment.extraCount, enrollment.amountDue, enrollment.paidAmount,
      enrollment.balance, enrollment.paymentReference, enrollment.paymentStatus,
    ]);
    row.height = Math.max(42, enrollment.workshops.length * 17 + 12);
    row.eachCell(cell => {
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF312934" } };
      cell.alignment = { vertical: "top", wrapText: true };
      if (index % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F3F6" } };
    });
    for (const column of [2, 10]) row.getCell(column).numFmt = "@";
    for (const column of [5, 6]) row.getCell(column).numFmt = "0";
    for (const column of [7, 8, 9]) row.getCell(column).numFmt = '"$"#,##0.00';
  }
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, sheet.rowCount), column: headers.length } };
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
