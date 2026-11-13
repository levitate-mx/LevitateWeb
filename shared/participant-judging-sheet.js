import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

const A4 = [595.28, 841.89];
const margin = 32;
const palette = {
  dark: rgb(0.045, 0.055, 0.075), pink: rgb(0.93, 0.16, 0.45),
  white: rgb(1, 1, 1), ink: rgb(0.12, 0.13, 0.17),
  muted: rgb(0.47, 0.48, 0.55), line: rgb(0.83, 0.84, 0.87),
  stripe: rgb(0.969, 0.969, 0.977), tint: rgb(1, 0.9, 0.94),
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

/** Generate one reference-format A4 page per judge, with the source rubric. */
export async function generateParticipantJudgingPdf({ eventTitle, routine, judges, logoBytes, preview = false }) {
  if (!routine || !Array.isArray(judges) || !judges.length) throw new Error('No hay hojas de jueceo disponibles para esta presentación.');
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  let logo;
  if (!logoBytes && typeof window !== 'undefined') {
    try {
      const response = await fetch('/assets/judging-sheet-logo-white.png');
      if (response.ok) logoBytes = new Uint8Array(await response.arrayBuffer());
    } catch { /* Keep a vector wordmark when the optional logo is unavailable. */ }
  }
  if (logoBytes) {
    const bytes = logoBytes instanceof Uint8Array ? logoBytes : new Uint8Array(logoBytes);
    logo = bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  }
  const [width, height] = A4, contentWidth = width - margin * 2;
  const metric = value => finite(value) ? number.format(value) : 'Pendiente';
  const text = (page, value, x, top, size = 8.7, font = regular, color = palette.ink) => {
    page.drawText(safeText(value, font), { x, y: height - top - size, size, font, color });
  };
  const rect = (page, x, top, w, h, fill) => page.drawRectangle({ x, y: height - top - h, width: w, height: h, color: fill });
  const rule = (page, top, color = palette.line, thickness = 0.4) => page.drawLine({ start: { x: margin, y: height - top }, end: { x: width - margin, y: height - top }, color, thickness });
  const right = (page, value, edge, top, size, font = regular, color = palette.ink) => text(page, value, edge - font.widthOfTextAtSize(safeText(value, font), size), top, size, font, color);
  const centered = (page, value, x, w, top, size, font = regular, color = palette.ink) => text(page, value, x + (w - font.widthOfTextAtSize(safeText(value, font), size)) / 2, top, size, font, color);
  const fitted = (value, font, sizes, availableWidth, maxLines) => {
    for (const size of sizes) {
      const lines = wrap(value, font, size, availableWidth);
      if (lines.length <= maxLines || size === sizes.at(-1)) return { size, lines, leading: size + 3 };
    }
  };
  const normalized = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  const genre = String(routine.genre || '').trim();
  const releve = [routine.division, routine.category, genre].some(value => normalized(value) === 'RELEVE');
  const motion = /MOTION|LIRICO|JAZZ|BALLET|BELLY|CONTEMP|FOL[CK]LORE|URBAN|HIP.?HOP|NO AERE/.test(normalized(genre));
  const area = releve ? 'RELEVÉ' : motion ? 'MOTION' : 'AERIAL';
  const discipline = !genre || normalized(genre) === normalized(area) ? area : `${area} / ${genre.toUpperCase()}`;
  const heading = fitted(discipline, bold, [13, 12, 11, 10, 9], 340, 2);
  const context = fitted([eventTitle || 'Levitate MX', routine.block].filter(Boolean).join(' / '), regular, [7.7, 7, 6.5], 340, 2);
  const headerBottom = Math.max(84, 32 + heading.lines.length * heading.leading + context.lines.length * context.leading + 9);
  const offset = headerBottom - 84;
  const programNumber = typeof routine.programNumber === 'string' && routine.programNumber.trim() ? routine.programNumber.trim() : routine.id;
  const program = fitted(programNumber == null ? '' : `#${programNumber}`, bold, [18, 15, 12, 10, 8], 59, 2);
  const title = fitted(routine.title || 'Presentación', bold, [27, 25, 23, 21, 19, 17, 15, 14], contentWidth - 68, 2);
  const academy = fitted(routine.academy || 'Academia sin especificar', bold, [9, 8.5, 8], contentWidth - 68, 2);
  const titleTop = 102 + offset;
  const academyTop = titleTop + Math.max(title.lines.length * title.leading, program.lines.length * program.leading) + 7;
  const fields = [['JUEZ', null, 0, 166], ['DIVISIÓN', routine.division, 179, 98], ['CATEGORÍA', routine.category, 290, 101], ['NIVEL', routine.level || 'No aplica', 405, contentWidth - 405]];
  const footerTop = height - 32;

  for (const [judgeIndex, judge] of judges.entries()) {
    const summary = summarizeParticipantJudgingSheet(judge), isPreview = preview || !summary.complete;
    const metadata = fields.map(([label, value, x, w]) => ({ label, x, w, ...fitted(value ?? judge.name ?? 'Sin nombre', bold, [10, 9.5, 9, 8.5], w, 2) }));
    const metadataTop = Math.max(174 + offset, academyTop + academy.lines.length * academy.leading + 17);
    const pointsTop = metadataTop + 14 + Math.max(...metadata.map(field => field.lines.length * field.leading)) + 14;
    const tableTop = pointsTop + 94;
    const criteria = (Array.isArray(judge.criteria) ? [...judge.criteria] : []).sort((a, b) => {
      const left = Number(a.id), right = Number(b.id);
      return Number.isFinite(left) && Number.isFinite(right) ? left - right : String(a.id).localeCompare(String(b.id), 'es');
    });
    const feedback = String(judge.feedback || '').trim() || 'Sin comentarios registrados.';
    let layout;
    for (const size of [8.7, 8.3, 8, 7.5, 7, 6.5]) {
      const leading = size + 2, baseHeight = size >= 8.3 ? 18.5 : size + 7;
      const sectionSize = Math.min(7.5, size), sectionLeading = sectionSize + 2;
      const rows = [], sections = [];
      let cursor = 0, lastSection;
      for (const [index, criterion] of criteria.entries()) {
        const section = String(criterion.section || 'Criterios');
        if (section !== lastSection) {
          if (sections.length) cursor += 5;
          const lines = wrap(section.toUpperCase(), bold, sectionSize, contentWidth - 100);
          const group = { section, lines, top: cursor, height: Math.max(18, lines.length * sectionLeading + 6), criteria: [] };
          sections.push(group); cursor += group.height; lastSection = section;
        }
        const lines = wrap(criterion.label || 'Criterio', regular, size, contentWidth - 145);
        const rowHeight = Math.max(baseHeight, lines.length * leading + 6);
        rows.push({ criterion, lines, index, top: cursor, height: rowHeight });
        sections.at(-1).criteria.push(criterion); cursor += rowHeight;
      }
      if (!criteria.length) cursor = 22;
      const feedbackTop = tableTop + cursor + 12;
      const feedbackLines = wrap(feedback, regular, size, contentWidth);
      const feedbackBottom = feedbackTop + 25 + feedbackLines.length * (size + 3);
      if (feedbackBottom <= footerTop - 13) {
        layout = { size, leading, rows, sections, sectionSize, sectionLeading, feedbackTop, feedbackLines };
        break;
      }
    }
    // Never create continuation pages or silently discard rubric/comments.
    if (!layout) throw new Error('Esta evaluación no cabe legiblemente en una hoja. Revisa la extensión de los criterios y comentarios antes de descargarla.');
    const page = pdf.addPage(A4);
    rect(page, 0, 0, width, height, palette.white);
    rect(page, 0, 0, width, headerBottom, palette.dark);
    rect(page, 0, headerBottom, width, 3, palette.pink);
    if (logo) {
      const scale = Math.min(158 / logo.width, 48 / logo.height);
      page.drawImage(logo, { x: margin, y: height - 18 - logo.height * scale, width: logo.width * scale, height: logo.height * scale });
    } else text(page, 'Levitate', margin, 17, 32, serif, palette.white);
    right(page, 'HOJA DE JUECEO', width - margin, 18, 8, bold, palette.white);
    heading.lines.forEach((line, index) => right(page, line, width - margin, 32 + index * heading.leading, heading.size, bold, palette.pink));
    context.lines.forEach((line, index) => right(page, line, width - margin, 32 + heading.lines.length * heading.leading + 7 + index * context.leading, context.size, regular, rgb(0.77, 0.78, 0.81)));
    program.lines.forEach((line, index) => text(page, line, margin, titleTop + 5 + index * program.leading, program.size, bold, palette.pink));
    title.lines.forEach((line, index) => text(page, line, margin + 68, titleTop + index * title.leading, title.size, bold));
    academy.lines.forEach((line, index) => text(page, line, margin + 68, academyTop + index * academy.leading, academy.size, bold, palette.muted));
    for (const field of metadata) {
      text(page, field.label, margin + field.x, metadataTop, 7, bold, palette.muted);
      field.lines.forEach((line, index) => text(page, line, margin + field.x, metadataTop + 14 + index * field.leading, field.size, bold));
    }
    rect(page, margin, pointsTop, contentWidth, 60, palette.tint);
    rect(page, margin, pointsTop, 3, 60, palette.pink);
    text(page, 'PUNTAJE FINAL', margin + 16, pointsTop + 10, 7, bold, palette.pink);
    const total = metric(summary.total), totalSize = summary.complete ? 29 : 18;
    text(page, total, margin + 15, pointsTop + 23, totalSize, bold);
    text(page, `/ ${metric(summary.maximumScore)}`, margin + 21 + bold.widthOfTextAtSize(safeText(total, bold), totalSize), pointsTop + 35, 10, bold, palette.muted);
    for (const [label, value, x] of [['SUBTOTAL', summary.subtotal, 244], ['PENALIZACIÓN', summary.penalty, 400]]) {
      text(page, label, margin + x, pointsTop + 14, 7, bold, palette.muted);
      text(page, metric(value), margin + x, pointsTop + 30, finite(value) ? 15 : 10, bold);
    }
    text(page, 'CRITERIOS DE EVALUACIÓN', margin, tableTop - 18, 7, bold, palette.muted);
    centered(page, 'MÁX.', width - margin - 109, 56, tableTop - 18, 7, bold, palette.muted);
    centered(page, 'PUNTAJE', width - margin - 53, 53, tableTop - 18, 7, bold, palette.pink);
    for (const section of layout.sections) {
      const top = tableTop + section.top;
      rect(page, margin, top, contentWidth, section.height, palette.dark);
      rect(page, margin, top, 3, section.height, palette.pink);
      section.lines.forEach((line, index) => text(page, line, margin + 10, top + 5 + index * layout.sectionLeading, layout.sectionSize, bold, palette.white));
      const complete = section.criteria.every(c => finite(c.value) && finite(c.maximumScore) && c.value >= 0 && c.value <= c.maximumScore);
      const maximum = section.criteria.every(c => finite(c.maximumScore) && c.maximumScore >= 0) ? section.criteria.reduce((sum, c) => sum + c.maximumScore, 0) : null;
      right(page, `${complete ? metric(section.criteria.reduce((sum, c) => sum + c.value, 0)) : 'Pendiente'} / ${metric(maximum)}`, width - margin - 10, top + 5, layout.sectionSize, bold, palette.white);
    }
    for (const row of layout.rows) {
      const top = tableTop + row.top;
      rect(page, margin, top, contentWidth, row.height, row.index % 2 ? palette.stripe : palette.white);
      rect(page, width - margin - 53, top, 53, row.height, palette.tint);
      const textTop = top + (row.height - row.lines.length * layout.leading) / 2;
      text(page, String(row.index + 1).padStart(2, '0'), margin + 3, top + (row.height - 7.7) / 2, 7.7, regular, palette.muted);
      row.lines.forEach((line, index) => text(page, line, margin + 29, textTop + index * layout.leading, layout.size));
      centered(page, metric(row.criterion.maximumScore), width - margin - 109, 56, top + (row.height - layout.size) / 2, layout.size, regular, palette.muted);
      const valid = finite(row.criterion.value) && finite(row.criterion.maximumScore) && row.criterion.value >= 0 && row.criterion.value <= row.criterion.maximumScore;
      centered(page, valid ? metric(row.criterion.value) : 'Pendiente', width - margin - 53, 53, top + (row.height - layout.size) / 2, layout.size, bold);
      rule(page, top + row.height);
    }
    if (!criteria.length) text(page, 'Criterios pendientes de sincronización.', margin + 8, tableTop + 5);
    rule(page, layout.feedbackTop, palette.ink, 0.8);
    text(page, 'RETROALIMENTACIÓN DEL JUEZ', margin, layout.feedbackTop + 9, 7.5, bold, palette.pink);
    layout.feedbackLines.forEach((line, index) => text(page, line, margin, layout.feedbackTop + 25 + index * (layout.size + 3), layout.size));
    if (!summary.complete) text(page, 'EVALUACIÓN PENDIENTE', margin, footerTop - 13, 7, bold, palette.pink);
    if (isPreview) page.drawText('VISTA PREVIA - NO OFICIAL', { x: 94, y: 335, font: bold, size: 27, color: palette.pink, opacity: 0.13, rotate: degrees(32) });
    rule(page, footerTop);
    text(page, 'LEVITATE MX - HOJA DE JUECEO', margin, footerTop + 10, 6.7, regular, palette.muted);
    right(page, `${judgeIndex + 1} / ${judges.length}`, width - margin, footerTop + 10, 6.7, regular, palette.muted);
  }
  pdf.setTitle(safeText(`Hoja de jueceo - ${routine.title || 'Presentación'}`, regular));
  pdf.setAuthor('Levitate MX');
  pdf.setSubject(safeText(eventTitle || 'Levitate MX', regular));
  return pdf.save();
}
