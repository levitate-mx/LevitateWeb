import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

const ink = rgb(0.045, 0.045, 0.045);
const pink = rgb(0.86, 0.0, 0.39);
const cream = rgb(0.975, 0.965, 0.945);

export function generateParticipantQrSvg(entryUrl) {
  const url = new URL(entryUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('El enlace del QR no es válido.');
  return QRCode.toString(url.href, { type: 'svg', errorCorrectionLevel: 'M', margin: 3, width: 400 });
}

function wrap(text, font, size, width) {
  const lines = [];
  let current = '';
  for (const word of String(text).trim().split(/\s+/)) {
    if (font.widthOfTextAtSize(word, size) > width) {
      if (current) { lines.push(current); current = ''; }
      for (const letter of word) {
        if (current && font.widthOfTextAtSize(current + letter, size) > width) { lines.push(current); current = ''; }
        current += letter;
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

function fit(value, font, initialSize, minimumSize, width, maximumLines, label) {
  let size = initialSize;
  let lines = wrap(value, font, size, width);
  while (size > minimumSize && lines.length > maximumLines) {
    size -= 1;
    lines = wrap(value, font, size, width);
  }
  if (lines.length > maximumLines || lines.some(line => font.widthOfTextAtSize(line, size) > width)) {
    throw new Error(`${label} no cabe en esta plantilla. Revisa el diploma antes de emitirlo.`);
  }
  return { size, lines };
}

/** A real, vector-text US-letter PDF. All values come from an approved issuance record. */
export async function generateParticipantDiploma({ name, academy, eventTitle, season, venue, dateLabel, entryUrl, logoBytes, preview = false }) {
  if (!name?.trim() || !eventTitle?.trim()) throw new Error('El nombre y la edición son obligatorios.');
  if (entryUrl) {
    const url = new URL(entryUrl);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('El enlace del QR no es válido.');
  }
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Diploma de participación · ${name}`);
  pdf.setAuthor('Levitate MX');
  pdf.setSubject(eventTitle);
  const page = pdf.addPage([612, 792]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  try {
    serif.encodeText(name);
    for (const value of [academy, eventTitle, season, venue, dateLabel]) if (value) sans.encodeText(value);
  } catch {
    throw new Error('Esta plantilla necesita una fuente compatible con el nombre o los datos de la edición. Carga un diploma aprobado para esta persona.');
  }
  const text = (value, y, font, size, color = ink) => {
    const width = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: (612 - width) / 2, y, font, size, color });
  };
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: cream });
  page.drawRectangle({ x: 44, y: 743, width: 28, height: 3, color: pink });
  const header = fit(String(season || eventTitle).toUpperCase(), sans, 9, 7, preview ? 320 : 470, 1, 'La temporada');
  page.drawText(header.lines[0], { x: 82, y: 741, font: sans, size: header.size, color: ink });
  if (preview) page.drawText('VISTA DE EJEMPLO', { x: 430, y: 741, font: bold, size: 8, color: pink });
  if (logoBytes) {
    const logo = await pdf.embedPng(logoBytes);
    const width = 270;
    const height = logo.height * width / logo.width;
    page.drawImage(logo, { x: (612 - width) / 2, y: 650 - height / 2, width, height });
  } else text('Levitate MX', 636, serif, 40);
  text('Diploma', 548, italic, 50, pink);
  text('DE PARTICIPACIÓN', 518, sans, 17);
  text('Se otorga a', 451, sans, 10);

  const { size, lines } = fit(name, serif, 44, 20, 490, 2, 'El nombre');
  const nameStart = lines.length === 1 ? 385 : 408;
  lines.forEach((line, index) => text(line, nameStart - index * (size + 5), serif, size));
  const afterName = nameStart - (lines.length - 1) * (size + 5);
  if (academy) {
    const fitted = fit(academy, sans, 11, 8, 470, 2, 'La academia');
    fitted.lines.forEach((line, index) => text(line, afterName - 30 - index * 15, sans, fitted.size));
  }
  page.drawLine({ start: { x: 270, y: afterName - 61 }, end: { x: 342, y: afterName - 61 }, thickness: 1, color: pink });
  const sentence = 'Por compartir su talento en el escenario de Levitate MX.';
  wrap(sentence, sans, 12, 435).forEach((line, index) => text(line, afterName - 94 - index * 18, sans, 12));
  text('Te elevaste con nosotros.', 221, italic, 21, pink);
  const title = fit(eventTitle, bold, 10, 8, 470, 2, 'El título de la edición');
  title.lines.forEach((line, index) => text(line, 191 - index * 12, bold, title.size));
  if (dateLabel) {
    const date = fit(dateLabel, sans, 9, 8, 470, 1, 'La fecha');
    text(date.lines[0], 160, sans, date.size);
  }
  if (venue) {
    const place = fit(venue, sans, 9, 8, 470, 1, 'La sede');
    text(place.lines[0], 143, sans, place.size);
  }
  page.drawLine({ start: { x: 53, y: 89 }, end: { x: 270, y: 89 }, thickness: 0.6, color: ink });
  page.drawText('DIRECCIÓN LEVITATE MX', { x: 84, y: 74, font: sans, size: 8 });
  if (entryUrl) {
    const qr = await QRCode.toDataURL(entryUrl, { errorCorrectionLevel: 'M', margin: 2, width: 256, color: { dark: '#101010', light: '#ffffff' } });
    const qrImage = await pdf.embedPng(qr);
    page.drawImage(qrImage, { x: 485, y: 43, width: 73, height: 73 });
    page.drawText('MI LEVITATE', { x: 493, y: 31, font: sans, size: 7 });
  }
  return pdf.save();
}
