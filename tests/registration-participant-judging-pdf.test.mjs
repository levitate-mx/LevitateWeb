import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';
import { generateParticipantJudgingPdf, summarizeParticipantJudgingSheet } from '../shared/participant-judging-sheet.js';

const criterion = (id, value = 9.5, maximumScore = 10) => ({ id, label: `Técnica y expresión ${id}`, section: 'TÉCNICA', value, maximumScore });
const routine = { id: '42', title: 'El instante de volar', academy: 'Academia Expresión', genre: 'TELA', category: 'Solo', division: 'Junior', level: 'Intermedio', block: 'Bloque 1' };
const judge = (patch = {}) => ({ id: 'judge-1', name: 'María José Pérez', status: 'complete', criteria: [criterion(1), criterion(2)], penalty: -1, feedback: 'Muy buena expresión.', ...patch });

function contentText(pdf) {
  return pdf.getPages().map(page => {
    const contents = page.node.Contents();
    const streams = contents?.asArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
    return streams.filter(Boolean).map(stream => {
      const operators = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
      return [...operators.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map(match => Buffer.from(match[1], 'hex').toString('latin1')).join('\n');
    }).join('\n');
  }).join('\n');
}

test('per-judge sheet preserves app subtotal, signed penalty, clamping and explicit template maximum', () => {
  assert.deepEqual(summarizeParticipantJudgingSheet(judge()), { complete: true, subtotal: 19, penalty: -1, total: 18, maximumScore: 20 });
  assert.equal(summarizeParticipantJudgingSheet(judge({ penalty: -40 })).total, 0);
  assert.equal(summarizeParticipantJudgingSheet(judge({ sheetMaximumScore: 50 })).maximumScore, 50);
  assert.equal(summarizeParticipantJudgingSheet(judge({ penalty: 0.5 })).total, 19.5);
});

test('all explicitly scored zeros are complete and remain zero even with a positive penalty', async () => {
  const zeroJudge = judge({ criteria: [criterion(1, 0), criterion(2, 0)], penalty: 1 });
  assert.deepEqual(summarizeParticipantJudgingSheet(zeroJudge), { complete: true, subtotal: 0, penalty: 1, total: 0, maximumScore: 20 });
  const pdf = await PDFDocument.load(await generateParticipantJudgingPdf({ eventTitle: 'Levitate MX', routine, judges: [zeroJudge] }));
  const text = contentText(pdf);
  assert.match(text, /TOTAL: 0 \/ 20/);
  assert.doesNotMatch(text, /Pendiente|VISTA PREVIA/);
});

test('null and partial evaluations stay pending and always carry a preview mark', async () => {
  for (const pending of [judge({ criteria: [criterion(1, null)] }), judge({ status: 'partial' }), judge({ penalty: null }), judge({ criteria: [] })]) {
    const summary = summarizeParticipantJudgingSheet(pending);
    assert.equal(summary.complete, false);
    assert.equal(summary.total, null);
    const pdf = await PDFDocument.load(await generateParticipantJudgingPdf({ eventTitle: 'Levitate MX', routine, judges: [pending] }));
    const text = contentText(pdf);
    assert.match(text, /TOTAL: Pendiente/);
    assert.match(text, /VISTA PREVIA - NO OFICIAL/);
  }
});

test('invalid scores do not become official totals', () => {
  for (const entry of [criterion(1, NaN), criterion(1, 11), criterion(1, -1), criterion(1, 0, null), criterion(1, Infinity)]) {
    assert.equal(summarizeParticipantJudgingSheet(judge({ criteria: [entry] })).complete, false);
  }
});

test('each judge starts a separate A4 sheet and the preview flag marks complete sheets too', async () => {
  const pdf = await PDFDocument.load(await generateParticipantJudgingPdf({ eventTitle: 'Otoño 2026', routine, judges: [judge(), judge({ name: 'Renata Piñal' })], preview: true }));
  assert.equal(pdf.getPageCount(), 2);
  for (const page of pdf.getPages()) {
    assert.equal(page.getWidth(), 595.28);
    assert.equal(page.getHeight(), 841.89);
  }
  const text = contentText(pdf);
  assert.match(text, /María José Pérez/);
  assert.match(text, /Renata Piñal/);
  assert.equal(text.match(/VISTA PREVIA - NO OFICIAL/g).length, 2);
});

test('long criteria, identifiers, accented names, feedback and unsupported glyphs never truncate or crash', async () => {
  const criteria = Array.from({ length: 42 }, (_, index) => ({ ...criterion(index + 1), label: `CRITERIO-${index + 1}-INICIO ${'Composición, precisión, respiración y ejecución escénica. '.repeat(4)} CRITERIO-${index + 1}-FINAL` }));
  criteria.push({ ...criterion('IDENTIFICADOR'.repeat(25)), label: 'LARGO-SIN-ESPACIOS-' + 'abcdefghij'.repeat(300) + '-ÚLTIMO' });
  const feedback = 'PÁRRAFO-INICIAL\n' + Array.from({ length: 90 }, (_, index) => `Comentario ${index + 1}: ejecución escénica y expresión impecables.`).join('\n') + '\nFINAL DE RETROALIMENTACIÓN 🌟 漢字';
  const pdf = await PDFDocument.load(await generateParticipantJudgingPdf({ eventTitle: 'Encuentro de expresión - Otoño', routine: { ...routine, title: 'Ángeles, corazones y expresión '.repeat(8) }, judges: [judge({ criteria, feedback })] }));
  assert.ok(pdf.getPageCount() > 5);
  const text = contentText(pdf);
  for (let index = 1; index <= 42; index++) {
    assert.ok(text.includes(`CRITERIO-${index}-INICIO`));
    assert.ok(text.includes(`CRITERIO-${index}-FINAL`));
  }
  assert.ok(text.includes('ÚLTIMO'));
  assert.ok(text.includes('FINAL DE RETROALIMENTACIÓN'));
  assert.ok(text.includes('Comentario 90:'));
});

test('empty judging list cannot create a misleading blank official sheet', async () => {
  await assert.rejects(generateParticipantJudgingPdf({ eventTitle: 'Levitate MX', routine, judges: [] }), /No hay hojas/);
});
