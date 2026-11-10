import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

const ink = rgb(0.045, 0.045, 0.045);
const pink = rgb(0.86, 0.0, 0.39);
const cream = rgb(0.975, 0.965, 0.945);

function fieldText(value) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('Revisa los datos del reconocimiento.');
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function fontError(code, message) { return Object.assign(new Error(message), { code }); }

function fontsFor(pdf, unicodeFontBytes) {
  let unicode;
  let supported;
  return async (value, standard) => {
    try { standard.encodeText(value); return standard; } catch { /* Preserve Unicode with a real embedded font. */ }
    if (!unicodeFontBytes) throw fontError('diploma_unicode_font_required', 'El reconocimiento necesita la fuente compatible con los caracteres de sus datos.');
    unicode ||= (async () => {
      try {
        const { default: fontkit } = await import('@pdf-lib/fontkit');
        pdf.registerFontkit(fontkit);
        return await pdf.embedFont(unicodeFontBytes, { subset: true });
      } catch {
        throw fontError('diploma_unicode_font_invalid', 'No pudimos cargar la fuente del reconocimiento. Intenta de nuevo.');
      }
    })();
    const font = await unicode;
    supported ||= new Set(font.getCharacterSet());
    if ([...value].some(character => !supported.has(character.codePointAt(0)))) {
      throw fontError('diploma_unicode_glyph_missing', 'La fuente del reconocimiento no incluye todos los caracteres de sus datos.');
    }
    font.encodeText(value);
    return font;
  };
}

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
export async function generateParticipantDiploma({ name, academy, eventTitle, season, venue, dateLabel, entryUrl, logoBytes, templateBytes, unicodeFontBytes, preview = false }) {
  [name, academy, eventTitle, season, venue, dateLabel] = [name, academy, eventTitle, season, venue, dateLabel].map(fieldText);
  if (!name || !eventTitle) throw new Error('El nombre y la edición son obligatorios.');
  if (entryUrl) {
    const url = new URL(entryUrl);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('El enlace del QR no es válido.');
  }
  if (templateBytes) {
    const pdf = await PDFDocument.load(templateBytes);
    if (pdf.getPageCount() !== 1) throw new Error('La plantilla del reconocimiento debe tener una sola página.');
    const page = pdf.getPage(0);
    const { width, height } = page.getSize();
    if (width !== 612 || height !== 792) throw new Error('La plantilla del reconocimiento debe ser tamaño carta vertical.');
    const serif = await pdf.embedFont(StandardFonts.TimesRoman);
    const sans = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const selectFont = fontsFor(pdf, unicodeFontBytes);
    const nameFont = await selectFont(name, serif);
    const academyFont = await selectFont(academy, sans);
    const centered = (value, y, font, size, color = ink) => {
      page.drawText(value, { x: (612 - font.widthOfTextAtSize(value, size)) / 2, y, font, size, color });
    };
    const fittedName = fit(name, nameFont, 29, 18, 470, 2, 'El nombre');
    const nameStart = fittedName.lines.length === 1 ? 402 : 414;
    fittedName.lines.forEach((line, index) => centered(line, nameStart - index * (fittedName.size + 3), nameFont, fittedName.size));
    if (academy) {
      const fittedAcademy = fit(academy, academyFont, 8, 7, 440, 1, 'La academia');
      centered(fittedAcademy.lines[0], 372, academyFont, fittedAcademy.size, rgb(0.2, 0.17, 0.18));
    }
    const authenticatedLabel = preview ? 'EJEMPLO · AUTENTICADO' : 'AUTENTICADO';
    page.drawText(authenticatedLabel, {
      x: 498 - bold.widthOfTextAtSize(authenticatedLabel, 6.5), y: 748, font: bold, size: 6.5, color: pink,
    });
    if (entryUrl) {
      const qr = await QRCode.toDataURL(entryUrl, { errorCorrectionLevel: 'M', margin: 2, width: 256, color: { dark: '#211b1e', light: '#fff8fb' } });
      const qrImage = await pdf.embedPng(qr);
      page.drawRectangle({ x: 278, y: 31, width: 56, height: 56, color: rgb(1, 0.973, 0.984) });
      page.drawImage(qrImage, { x: 283, y: 36, width: 46, height: 46 });
      centered('ACCESO PRIVADO · MI LEVITATE', 22, sans, 5.5, rgb(0.29, 0.23, 0.26));
    }
    pdf.setTitle(`Reconocimiento de participación autenticado · ${name}`);
    pdf.setAuthor('Levitate MX');
    pdf.setSubject(eventTitle);
    return pdf.save();
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
  const selectFont = fontsFor(pdf, unicodeFontBytes);
  const nameFont = await selectFont(name, serif);
  const academyFont = await selectFont(academy, sans);
  const headerValue = String(season || eventTitle).toUpperCase();
  const headerFont = await selectFont(headerValue, sans);
  const eventFont = await selectFont(eventTitle, bold);
  const dateFont = await selectFont(dateLabel, sans);
  const venueFont = await selectFont(venue, sans);
  const text = (value, y, font, size, color = ink) => {
    const width = font.widthOfTextAtSize(value, size);
    page.drawText(value, { x: (612 - width) / 2, y, font, size, color });
  };
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: cream });
  page.drawRectangle({ x: 44, y: 743, width: 28, height: 3, color: pink });
  const header = fit(headerValue, headerFont, 9, 7, preview ? 320 : 470, 1, 'La temporada');
  page.drawText(header.lines[0], { x: 82, y: 741, font: headerFont, size: header.size, color: ink });
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

  const { size, lines } = fit(name, nameFont, 44, 20, 490, 2, 'El nombre');
  const nameStart = lines.length === 1 ? 385 : 408;
  lines.forEach((line, index) => text(line, nameStart - index * (size + 5), nameFont, size));
  const afterName = nameStart - (lines.length - 1) * (size + 5);
  if (academy) {
    const fitted = fit(academy, academyFont, 11, 8, 470, 2, 'La academia');
    fitted.lines.forEach((line, index) => text(line, afterName - 30 - index * 15, academyFont, fitted.size));
  }
  page.drawLine({ start: { x: 270, y: afterName - 61 }, end: { x: 342, y: afterName - 61 }, thickness: 1, color: pink });
  const sentence = 'Por compartir su talento en el escenario de Levitate MX.';
  wrap(sentence, sans, 12, 435).forEach((line, index) => text(line, afterName - 94 - index * 18, sans, 12));
  text('Te elevaste con nosotros.', 221, italic, 21, pink);
  const title = fit(eventTitle, eventFont, 10, 8, 470, 2, 'El título de la edición');
  title.lines.forEach((line, index) => text(line, 191 - index * 12, eventFont, title.size));
  if (dateLabel) {
    const date = fit(dateLabel, dateFont, 9, 8, 470, 1, 'La fecha');
    text(date.lines[0], 160, dateFont, date.size);
  }
  if (venue) {
    const place = fit(venue, venueFont, 9, 8, 470, 1, 'La sede');
    text(place.lines[0], 143, venueFont, place.size);
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
