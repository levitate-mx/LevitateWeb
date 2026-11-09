import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { generateParticipantDiploma, generateParticipantQrSvg } from '../shared/participant-diploma.js';

const templateBytes = await readFile(new URL('../public/assets/participant-recognition-template.pdf', import.meta.url));

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
