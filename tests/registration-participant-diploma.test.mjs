import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PDFDocument, PDFDict, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { generateParticipantDiploma, generateParticipantQrSvg } from '../shared/participant-diploma.js';

const templateBytes = await readFile(new URL('../public/assets/participant-recognition-template.pdf', import.meta.url));
const unicodeFontBytes = await readFile(new URL('../public/assets/participant-recognition-unicode.ttf', import.meta.url));

function embeddedUnicodeText(pdf) {
  const page = pdf.getPage(0), fonts = page.node.Resources().lookup(PDFName.of('Font'), PDFDict), maps = new Map();
  for (const [name, reference] of fonts.entries()) {
    const font = pdf.context.lookup(reference, PDFDict), stream = font.lookup(PDFName.of('ToUnicode'));
    if (!(stream instanceof PDFRawStream)) continue;
    const cmap = new TextDecoder().decode(decodePDFRawStream(stream).decode()), characters = new Map();
    for (const section of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const match of section[1].matchAll(/<([a-f0-9]+)>\s*<([a-f0-9]+)>/gi)) {
      const bytes = Buffer.from(match[2], 'hex'); bytes.swap16();
      characters.set(match[1].toUpperCase(), bytes.toString('utf16le'));
    }
    maps.set(name.asString(), characters);
  }
  const contents = page.node.Contents(), blocks = [];
  for (let index = 0; index < contents.size(); index++) {
    const stream = contents.lookup(index, PDFRawStream), text = new TextDecoder().decode(decodePDFRawStream(stream).decode());
    for (const block of text.matchAll(/BT([\s\S]*?)ET/g)) {
      const font = block[1].match(/\/([^\s]+)\s+[\d.]+\s+Tf/), cmap = font ? maps.get('/' + font[1]) : undefined;
      if (!cmap) continue;
      for (const value of block[1].matchAll(/<([a-f0-9]+)>\s*Tj/gi)) blocks.push((value[1].match(/.{1,4}/g) || []).map(code => cmap.get(code.toUpperCase()) || '').join(''));
    }
  }
  return blocks.join('\n');
}

test('participant diploma is a one-page US-letter PDF with correct recipient metadata', async () => {
  const bytes = await generateParticipantDiploma({ name: 'María José López', academy: 'Academia de danza', eventTitle: 'Levitate MX · Otoño 2026', templateBytes, preview: true });
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getTitle(), 'Reconocimiento de participación autenticado · María José López');
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 612, height: 792 });
});

test('long participant names wrap without changing the issued identity', async () => {
  const name = 'María Fernanda de los Ángeles González Hernández';
  const bytes = await generateParticipantDiploma({ name, eventTitle: 'Levitate MX · Otoño 2026', entryUrl: 'https://levitate.mx/mi-levitate#access=synthetic-example-only', templateBytes });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), `Reconocimiento de participación autenticado · ${name}`);
  assert.equal(pdf.getPageCount(), 1);
});

test('QR and diploma generators reject non-web credential targets', async () => {
  await assert.rejects(generateParticipantDiploma({ name: 'Test', eventTitle: 'Levitate', entryUrl: 'javascript:alert(1)' }), /enlace/);
  assert.throws(() => generateParticipantQrSvg('javascript:alert(1)'), /enlace/);
  const svg = await generateParticipantQrSvg('https://levitate.mx/mi-levitate#access=synthetic-example-only');
  assert.match(svg, /^<svg/);
});

test('issuance rejects fields that cannot fit or encode rather than truncating identity', async () => {
  await assert.rejects(generateParticipantDiploma({ name: 'W'.repeat(1000), eventTitle: 'Levitate MX', templateBytes }), /no cabe/);
  await assert.rejects(generateParticipantDiploma({ name: 'Nombre de prueba', academy: 'Academia '.repeat(500), eventTitle: 'Levitate MX', templateBytes }), /no cabe/);
  await assert.rejects(generateParticipantDiploma({ name: '测试', eventTitle: 'Levitate MX', templateBytes }), /fuente compatible/);
});

test('unsupported Unicode requests the bundled font and preserves its exact academy text in PDF text mapping', async () => {
  const input = { name: 'María José López', academy: 'Estudio Lūna', eventTitle: 'Levitate MX · Otoño 2026', templateBytes };
  await assert.rejects(generateParticipantDiploma(input), error => error.code === 'diploma_unicode_font_required');
  const pdf = await PDFDocument.load(await generateParticipantDiploma({ ...input, unicodeFontBytes }));
  assert.equal(pdf.getPageCount(), 1); assert.equal(pdf.getTitle(), 'Reconocimiento de participación autenticado · María José López');
  assert.match(embeddedUnicodeText(pdf), /Estudio Lūna/);
  assert.doesNotMatch(embeddedUnicodeText(pdf), /Estudio Luna/);
});

test('Unicode fallback covers participant names and optional standalone diploma fields without changing characters', async () => {
  const pdf = await PDFDocument.load(await generateParticipantDiploma({ name: 'María Ūna', academy: 'Estudio Lūna', eventTitle: 'Levitate MX',
    venue: 'Sede Lūna', unicodeFontBytes, preview: true }));
  assert.match(pdf.getTitle(), /María Ūna/); const text = embeddedUnicodeText(pdf);
  assert.match(text, /María Ūna/); assert.match(text, /Estudio Lūna/); assert.match(text, /Sede Lūna/);
});

test('supported Spanish retains standard fonts while NFC and whitespace are normalized without transliteration', async () => {
  const bytes = await generateParticipantDiploma({ name: '  Mari\u0301a   José  López ', academy: 'Academia   Española', eventTitle: 'Levitate MX',
    unicodeFontBytes: new Uint8Array([0, 1, 2]), templateBytes });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), 'Reconocimiento de participación autenticado · María José López');
  assert.equal(pdf.getPageCount(), 1, 'invalid optional font bytes are unused for fields already supported by standard fonts');
});

test('fallback rejects invalid fonts and missing glyphs instead of silently replacing identities', async () => {
  const input = { name: 'Nombre de prueba', academy: 'Estudio Lūna', eventTitle: 'Levitate MX', templateBytes };
  await assert.rejects(generateParticipantDiploma({ ...input, unicodeFontBytes: new Uint8Array([0, 1, 2]) }), error => error.code === 'diploma_unicode_font_invalid');
  await assert.rejects(generateParticipantDiploma({ ...input, academy: '测试', unicodeFontBytes }), error => error.code === 'diploma_unicode_glyph_missing');
});
