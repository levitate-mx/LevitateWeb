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
  assert.match(text, /PUNTAJE FINAL\n0\n\/ 20/);
  assert.doesNotMatch(text, /Pendiente|VISTA PREVIA/);
});

test('PDF sheets display original programme numbers while keeping legacy ID fallback', async () => {
  for (const programNumber of ['194 a', '237', undefined]) {
    const pdf = await PDFDocument.load(await generateParticipantJudgingPdf({
      eventTitle: 'Levitate MX', routine: { ...routine, programNumber }, judges: [judge()],
    }));
    const text = contentText(pdf);
    assert.ok(text.includes(`#${programNumber || routine.id}`));
    assert.ok(text.includes(routine.title));
    if (programNumber) assert.ok(!text.includes(`#${routine.id}\n`));
  }
});

test('null and partial evaluations stay pending and always carry a preview mark', async () => {
  for (const pending of [judge({ criteria: [criterion(1, null)] }), judge({ status: 'partial' }), judge({ penalty: null }), judge({ criteria: [] })]) {
    const summary = summarizeParticipantJudgingSheet(pending);
    assert.equal(summary.complete, false);
    assert.equal(summary.total, null);
    const pdf = await PDFDocument.load(await generateParticipantJudgingPdf({ eventTitle: 'Levitate MX', routine, judges: [pending] }));
    const text = contentText(pdf);
    assert.equal(pdf.getPageCount(), 1);
    assert.match(text, /PUNTAJE FINAL\nPendiente/);
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

test('sixteen criteria, long metadata, all sections and 350 feedback characters fit one readable A4 sheet', async () => {
  const criteria = Array.from({ length: 16 }, (_, index) => ({ ...criterion(index + 1),
    section: index < 4 ? 'TÉCNICA' : index < 12 ? 'EJECUCIÓN COREOGRÁFICA' : 'PERFORMANCE',
    label: `CRITERIO-${index + 1} Composición, precisión y ejecución escénica.` }));
  const feedback = 'PÁRRAFO-INICIAL ' + 'Mejorar las transiciones, respiración y conexión escénica. '.repeat(5) + ' FINAL DE RETROALIMENTACIÓN 🌟 漢字';
  assert.ok(feedback.length <= 350);
  const pdf = await PDFDocument.load(await generateParticipantJudgingPdf({ eventTitle: 'Encuentro de expresión - Otoño', routine: { ...routine, title: 'Ángeles, corazones y expresión '.repeat(6), academy: 'Academia de Danza, Expresión y Movimiento Escénico' }, judges: [judge({ criteria, feedback })] }));
  assert.equal(pdf.getPageCount(), 1);
  const text = contentText(pdf);
  for (let index = 1; index <= 16; index++) assert.ok(text.includes(`CRITERIO-${index} `));
  assert.ok(text.includes('FINAL DE RETROALIMENTACIÓN'));
  for (const section of ['TÉCNICA', 'EJECUCIÓN COREOGRÁFICA', 'PERFORMANCE']) assert.ok(text.includes(section));
  assert.doesNotMatch(text, /CONTINUACIÓN|MUESTRA DE DISEÑO|DATOS DE EJEMPLO/);
});

test('Relevé keeps its five one-to-three criteria, fifteen-point maximum and one page per judge', async () => {
  const labels = ['Técnica y control', 'Composición coreográfica', 'Musicalidad', 'Interpretación artística', 'Presencia escénica'];
  const criteria = labels.map((label, index) => ({ id: index, label, section: 'RELEVÉ', value: 3, maximumScore: 3 }));
  const pdf = await PDFDocument.load(await generateParticipantJudgingPdf({ eventTitle: 'Levitate MX', routine: { ...routine, division: 'Relevé', genre: 'Tela' }, judges: [judge({ criteria, penalty: 0, sheetMaximumScore: 15 })] }));
  assert.equal(pdf.getPageCount(), 1);
  const text = contentText(pdf);
  for (const label of labels) assert.ok(text.includes(label));
  assert.match(text, /PUNTAJE FINAL\n15\n\/ 15/);
});

test('oversized source data is rejected instead of silently truncating rubrics or adding continuation pages', async () => {
  const criteria = Array.from({ length: 100 }, (_, index) => criterion(index + 1));
  await assert.rejects(generateParticipantJudgingPdf({ eventTitle: 'Levitate MX', routine,
    judges: [judge({ criteria, feedback: 'Texto extraordinario fuera de los límites del evento. '.repeat(100) })] }), /no cabe legiblemente en una hoja/);
});

test('empty judging list cannot create a misleading blank official sheet', async () => {
  await assert.rejects(generateParticipantJudgingPdf({ eventTitle: 'Levitate MX', routine, judges: [] }), /No hay hojas/);
});
