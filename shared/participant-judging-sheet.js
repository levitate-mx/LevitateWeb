import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

const A4 = [595.28, 841.89];
const margin = 28;
const palette = {
  dark: rgb(0.075, 0.064, 0.083), panel: rgb(0.13, 0.115, 0.14),
  pink: rgb(0.83, 0.29, 0.55), paper: rgb(0.977, 0.964, 0.953),
  white: rgb(1, 1, 1), ink: rgb(0.12, 0.10, 0.13),
  muted: rgb(0.40, 0.36, 0.40), line: rgb(0.84, 0.79, 0.82), tint: rgb(0.97, 0.91, 0.94),
};
const number = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const pendingStatuses = new Set(['pending', 'partial', 'unavailable', 'draft', 'incomplete', 'unassigned', 'error']);
const finite = value => typeof value === 'number' && Number.isFinite(value);

/** Per-judge arithmetic follows the app; an explicit zero is a real score. */
export function summarizeParticipantJudgingSheet(judge) {
  const criteria = Array.isArray(judge?.criteria) ? judge.criteria : [];
  const complete = criteria.length > 0 && !pendingStatuses.has(String(judge?.status || '').toLowerCase())
    && criteria.every(criterion => finite(criterion?.value) && finite(criterion?.maximumScore)
      && criterion.maximumScore >= 0 && criterion.value >= 0 && criterion.value <= criterion.maximumScore)
    && (judge?.penalty === undefined || finite(judge.penalty));
  const maximumScore = finite(judge?.sheetMaximumScore) && judge.sheetMaximumScore > 0
    ? judge.sheetMaximumScore
    : criteria.every(criterion => finite(criterion?.maximumScore) && criterion.maximumScore >= 0)
      ? criteria.reduce((sum, criterion) => sum + criterion.maximumScore, 0) : null;
  if (!complete) return { complete: false, subtotal: null, total: null, penalty: finite(judge?.penalty) ? judge.penalty : null, maximumScore };
  const subtotal = criteria.reduce((sum, criterion) => sum + criterion.value, 0);
  const penalty = judge.penalty ?? 0;
  if (!finite(subtotal) || !finite(maximumScore) || !finite(subtotal + penalty)) {
    return { complete: false, subtotal: null, total: null, penalty, maximumScore: finite(maximumScore) ? maximumScore : null };
  }
  return { complete: true, subtotal, penalty, total: subtotal > 0 ? Math.max(0, subtotal + penalty) : 0, maximumScore };
}

function safeText(input, font) {
  const value = String(input ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\t/g, ' ');
  return [...value].map(character => {
    if (character === '\n' || character === '\r') return character;
    try { font.encodeText(character); return character; }
    catch {
      const base = character.normalize('NFKD').replace(/\p{Mark}/gu, '');
      try { font.encodeText(base); return base || '?'; } catch { return '?'; }
    }
  }).join('');
}

function wrap(input, font, size, width) {
  const paragraphs = safeText(input, font).replace(/\r\n?/g, '\n').split('\n');
  const lines = [];
  for (const paragraph of paragraphs) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (font.widthOfTextAtSize(word, size) > width) {
        if (line) { lines.push(line); line = ''; }
        for (const character of word) {
          if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = ''; }
          line += character;
        }
      } else {
        const candidate = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(candidate, size) > width) { lines.push(line); line = word; }
        else line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Generate vector A4 sheets in the browser. No Drive/storage operation occurs. */
export async function generateParticipantJudgingPdf({ eventTitle, routine, judges, logoBytes, preview = false }) {
  if (!routine || !Array.isArray(judges) || !judges.length) throw new Error('No hay hojas de jueceo disponibles para esta presentación.');
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  let logo;
  if (logoBytes) {
    const bytes = logoBytes instanceof Uint8Array ? logoBytes : new Uint8Array(logoBytes);
    logo = bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  }
  const [width, height] = A4;
  const contentWidth = width - margin * 2;
  const bottom = height - 45;
  const documentPages = [];
  const drawText = (page, text, x, top, size = 9, font = regular, color = palette.ink) => {
    page.drawText(safeText(text, font), { x, y: height - top - size, size, font, color });
  };
  const box = (page, x, top, w, h, color, borderColor) => {
    page.drawRectangle({ x, y: height - top - h, width: w, height: h, color,
      ...(borderColor ? { borderColor, borderWidth: 0.5 } : {}) });
  };
  const metric = value => finite(value) ? number.format(value) : 'Pendiente';

  for (const judge of judges) {
    const summary = summarizeParticipantJudgingSheet(judge);
    const isPreview = preview || !summary.complete;
    let page;
    let top;
    let sheetPage = 0;
    const newPage = () => {
      page = pdf.addPage(A4);
      sheetPage += 1;
      documentPages.push({ page, isPreview, judge });
      box(page, 0, 0, width, height, palette.dark);
      box(page, 0, 0, 6, height, palette.pink);
      if (logo) {
        const ratio = Math.min(154 / logo.width, 37 / logo.height);
        box(page, margin, 23, 170, 51, palette.paper);
        page.drawImage(logo, { x: margin + (170 - logo.width * ratio) / 2,
          y: height - 23 - (51 + logo.height * ratio) / 2, width: logo.width * ratio, height: logo.height * ratio });
      } else drawText(page, 'Levitate', margin, 25, 31, serif, palette.white);
      drawText(page, 'HOJA DE JUECEO', margin + 190, 32, 15, bold, palette.pink);
      drawText(page, sheetPage > 1 ? 'CONTINUACIÓN' : 'EVALUACIÓN POR JUEZ', margin + 191, 56, 7.5, bold, palette.white);
      box(page, width - margin - 126, 23, 126, 51, palette.panel, palette.pink);
      drawText(page, 'TOTAL DEL JUEZ', width - margin - 116, 31, 6.7, bold, palette.white);
      drawText(page, metric(summary.total), width - margin - 116, 45, 14, bold, palette.pink);
      const maximumLabel = `/ ${metric(summary.maximumScore)}`;
      drawText(page, maximumLabel, width - margin - 10 - regular.widthOfTextAtSize(maximumLabel, 8), 49, 8, regular, palette.white);
      top = 89;
      const eventLines = wrap([eventTitle || 'Levitate MX', routine.block].filter(Boolean).join(' / '), bold, 8.2, contentWidth - 20);
      box(page, margin, top, contentWidth, 16 + eventLines.length * 11, palette.pink);
      eventLines.forEach((line, index) => drawText(page, line, margin + 10, top + 8 + index * 11, 8.2, bold, palette.white));
      top += 26 + eventLines.length * 11;
      if (sheetPage > 1) {
        const label = `${routine.id ? `#${routine.id} - ` : ''}${routine.title || 'Presentación'} / ${judge.name || 'Juez'}`;
        const lines = wrap(label, bold, 9, contentWidth);
        lines.forEach(line => { drawText(page, line, margin, top, 9, bold, palette.white); top += 13; });
        top += 9;
      }
    };
    const ensure = needed => { if (top + needed > bottom) newPage(); };
    const paragraph = (text, { size = 9, font = regular, color = palette.ink, fill = palette.paper, padding = 10, leading = size + 4 } = {}) => {
      const lines = wrap(text, font, size, contentWidth - padding * 2);
      for (const line of lines) {
        ensure(leading + padding * 2);
        box(page, margin, top, contentWidth, leading, fill);
        drawText(page, line, margin + padding, top + 2, size, font, color);
        top += leading;
      }
    };
    const heading = label => {
      ensure(42);
      box(page, margin, top, contentWidth, 22, palette.pink);
      drawText(page, label, margin + 10, top + 6, 8, bold, palette.white);
      top += 22;
    };
    const tableHeader = () => {
      ensure(26);
      box(page, margin, top, contentWidth, 25, palette.panel);
      drawText(page, '#', margin + 8, top + 8, 8, bold, palette.white);
      drawText(page, 'CRITERIO', margin + 47, top + 8, 8, bold, palette.white);
      drawText(page, 'MÁX.', margin + contentWidth - 116, top + 8, 8, bold, palette.white);
      drawText(page, 'PUNTAJE', margin + contentWidth - 66, top + 8, 8, bold, palette.white);
      top += 25;
    };
    newPage();
    paragraph(`${routine.id ? `#${routine.id} - ` : ''}${routine.title || 'Presentación'}`, { size: 17, font: bold, leading: 23 });
    paragraph(routine.academy || 'Academia sin especificar', { size: 10, font: bold, color: palette.muted });
    paragraph(`Juez: ${judge.name || 'Sin nombre'}`, { size: 10, font: bold, color: palette.pink });
    for (const label of [
      ['Disciplina', routine.genre], ['Categoría', routine.category], ['División', routine.division], ['Nivel', routine.level],
    ]) if (label[1]) paragraph(`${label[0]}: ${label[1]}`, { size: 8.5, leading: 13 });
    top += 12;
    if (!summary.complete) {
      heading('EVALUACIÓN PENDIENTE');
      paragraph('Esta hoja contiene datos pendientes. No representa una evaluación completa.', { size: 8.5 });
      top += 12;
    }
    tableHeader();
    const criteria = Array.isArray(judge.criteria) ? [...judge.criteria] : [];
    criteria.sort((a, b) => {
      const aId = Number(a.id), bId = Number(b.id);
      return Number.isFinite(aId) && Number.isFinite(bId) ? aId - bId : String(a.id).localeCompare(String(b.id), 'es');
    });
    let lastSection;
    for (const criterion of criteria) {
      const section = criterion.section || 'Criterios';
      const labelLines = wrap(criterion.label || 'Criterio', regular, 8.7, contentWidth - 177);
      const idLines = wrap(String(criterion.id ?? ''), bold, 8, 29);
      let cursor = 0;
      let idCursor = 0;
      const sectionLines = wrap(section.toUpperCase(), bold, 8, contentWidth - 20);
      const sectionHeight = 10 + sectionLines.length * 11;
      if (section !== lastSection) {
        if (top + sectionHeight + 25 > bottom) { newPage(); tableHeader(); }
        box(page, margin, top, contentWidth, sectionHeight, palette.tint);
        sectionLines.forEach((line, index) => drawText(page, line, margin + 10, top + 5 + index * 11, 8, bold, palette.pink));
        top += sectionHeight;
        lastSection = section;
      }
      while (cursor < labelLines.length || idCursor < idLines.length) {
        if (top + 25 > bottom) { newPage(); tableHeader(); }
        const available = Math.max(1, Math.floor((bottom - top - 12) / 12));
        const chunk = labelLines.slice(cursor, cursor + available);
        const idChunk = idLines.slice(idCursor, idCursor + available);
        const rowHeight = Math.max(25, Math.max(chunk.length, idChunk.length) * 12 + 12);
        box(page, margin, top, contentWidth, rowHeight, palette.paper, palette.line);
        idChunk.forEach((line, index) => drawText(page, line, margin + 8, top + 6 + index * 12, 8, bold));
        chunk.forEach((line, index) => drawText(page, line, margin + 47, top + 6 + index * 12, 8.7));
        if (cursor === 0 && idCursor === 0) {
          drawText(page, metric(criterion.maximumScore), margin + contentWidth - 116, top + 7, 8.5, bold, palette.muted);
          const valueValid = finite(criterion.value) && finite(criterion.maximumScore)
            && criterion.value >= 0 && criterion.value <= criterion.maximumScore;
          drawText(page, valueValid ? metric(criterion.value) : 'Pendiente', margin + contentWidth - 66, top + 7, 8.5, bold, palette.pink);
        }
        cursor += chunk.length;
        idCursor += idChunk.length;
        top += rowHeight;
      }
    }
    if (!criteria.length) paragraph('Criterios pendientes de sincronización.');
    top += 12;
    ensure(97);
    heading('RESUMEN DE LA EVALUACIÓN');
    paragraph(`Subtotal: ${metric(summary.subtotal)}   |   Penalización: ${metric(summary.penalty)}`, { font: bold, size: 9.3, leading: 19 });
    paragraph(`TOTAL: ${metric(summary.total)} / ${metric(summary.maximumScore)}`, { font: bold, size: 14, leading: 24, color: palette.pink });
    top += 12;
    heading('RETROALIMENTACIÓN');
    paragraph(judge.feedback?.trim() || 'Sin comentarios registrados.', { size: 9.3, leading: 14 });
  }

  documentPages.forEach(({ page, isPreview }, index) => {
    if (isPreview) page.drawText('VISTA PREVIA - NO OFICIAL', { x: 94, y: 335, font: bold, size: 27,
      color: palette.pink, opacity: 0.13, rotate: degrees(32) });
    drawText(page, 'MI LEVITATE - HOJA DE JUECEO', margin, height - 26, 7, bold, palette.white);
    const label = `${index + 1} / ${documentPages.length}`;
    drawText(page, label, width - margin - regular.widthOfTextAtSize(label, 7), height - 26, 7, regular, palette.white);
  });
  pdf.setTitle(safeText(`Hoja de jueceo - ${routine.title || 'Presentación'}`, regular));
  pdf.setAuthor('Levitate MX');
  pdf.setSubject(safeText(eventTitle || 'Levitate MX', regular));
  return pdf.save();
}
