import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { PDFDocument, PDFName, decodePDFRawStream } from 'pdf-lib';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/judging/judgingAdminPdf.ts', import.meta.url), 'utf8');
const font = await readFile(new URL('../public/assets/participant-recognition-unicode.ttf', import.meta.url));
const scope = {
  exports: {},
  require: createRequire(new URL('../src/components/judging/judgingAdminPdf.ts', import.meta.url)),
  fetch: async (url) => {
    assert.equal(url, '/assets/participant-recognition-unicode.ttf');
    return { ok: true, arrayBuffer: async () => font };
  },
};
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
vm.runInThisContext(`(function(exports, require, fetch) { ${javascript}\n})`)(scope.exports, scope.require, scope.fetch);
const { generateAdminReportPdf } = scope.exports;

// Read the actual embedded Unicode mapping and page operators, rather than
// inspecting the source or assuming that the custom font uses Latin-1 bytes.
function contentText(pdf) {
  return pdf.getPages().map((page) => {
    const fontResources = page.node.Resources().lookup(PDFName.of('Font'));
    const unicode = new Map();
    for (const [, reference] of fontResources.entries()) {
      const fontDictionary = pdf.context.lookup(reference);
      const mapping = fontDictionary.lookup(PDFName.of('ToUnicode'));
      const cmap = Buffer.from(decodePDFRawStream(mapping).decode()).toString('ascii');
      for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
        for (const entry of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
          const bytes = Buffer.from(entry[2], 'hex');
          unicode.set(entry[1].toUpperCase(), bytes.swap16().toString('utf16le'));
        }
      }
    }
    const contents = page.node.Contents();
    const streams = contents?.asArray ? contents.asArray().map((ref) => pdf.context.lookup(ref)) : [contents];
    return streams.filter(Boolean).map((stream) => {
      const operators = Buffer.from(decodePDFRawStream(stream).decode()).toString('ascii');
      return [...operators.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((match) =>
        match[1].match(/.{4}/g).map((cid) => unicode.get(cid.toUpperCase()) ?? '').join(''),
      ).join('\n');
    }).join('\n');
  }).join('\n');
}

function fixture(entries) {
  const rows = entries.map((entry, index) => ({
    id: String(index + 1), programNumber: `${index + 101} a`,
    name: `Rutina ${index + 1} - Expresión y vuelo`, academy: 'Academia Águila',
    status: 'complete', ...entry.row,
  }));
  const standings = entries.map(({ row, ...entry }, index) => ({
    routineId: rows[index].id, score: 170, maximumScore: 210, medal: 'plata', directCompetition: true,
    eligibleCount: entries.length,
    placement: { rank: null, label: 'Sin lugar de podio' }, ...entry,
  }));
  return {
    event: { name: 'Final Levitate - Otoño 2026' },
    snapshot: {
      rows,
      report: { blocks: [{ id: 'b1', title: 'Bloque de premiación', name: 'Bloque 1',
        sections: [{ label: 'Motion', categories: [{ title: 'Junior - Solo', rows: standings }] }],
        specialAwards: [{ title: 'Mejor vestuario', displayValue: 'Academia Águila' }],
        topScore: { routineId: '1', score: standings[0].score },
      }] },
    },
  };
}

async function render(entries) {
  const bytes = await generateAdminReportPdf(fixture(entries), 'b1');
  const pdf = await PDFDocument.load(bytes);
  return { bytes, pdf, text: contentText(pdf).replace(/\s+/g, ' ') };
}

test('dictamen PDF separates medals and podium places without printing presentation numbers', async () => {
  const result = await render([
    { score: 180.75, medal: 'plata', placement: { rank: 1, label: '1.º lugar' } },
    { score: 150, medal: 'bronce', placement: { rank: 2, label: '2.º lugar' } },
    { score: 120, medal: 'participacion', placement: { rank: 3, label: '3.º lugar' } },
    { score: 110, medal: 'participacion', placement: { rank: 4, label: '4.º lugar' } },
    { score: 190, medal: 'oro', directCompetition: false, eligibleCount: 1,
      placement: { rank: 1, label: '1.º lugar' } },
  ]);
  assert.match(result.text, /181 1\.º lugar Medalla de plata/);
  assert.match(result.text, /150 2\.º lugar Medalla de bronce/);
  assert.match(result.text, /120 3\.º lugar Medalla de participación/);
  assert.match(result.text, /110 Sin lugar de podio Medalla de participación/);
  assert.match(result.text, /190 Sin competencia directa Medalla de oro/);
  assert.equal(result.text.match(/1\.º lugar/g)?.length, 1, 'a solo must never gain a first-place label');
  assert.doesNotMatch(result.text, /4\.º lugar/);
  assert.match(result.text, /Rutina 1 - Expresión y vuelo/);
  assert.doesNotMatch(result.text, /#101|#102|#103|#104|#105|180\.75/);
  assert.match(result.text, /PREMIOS ESPECIALES Mejor vestuario: Academia Águila/);
  assert.doesNotMatch(result.text, /TOP SCORE/);
  if (process.env.LEVITATE_AWARDS_PDF_PREVIEW) {
    await writeFile(process.env.LEVITATE_AWARDS_PDF_PREVIEW, result.bytes);
  }
});

test('pending and invalid dictamen PDF results never invent a medal or podium', async () => {
  const result = await render([
    { score: null, medal: null, placement: null, row: { status: 'pending' } },
    { score: null, medal: null, placement: null, row: { status: 'unavailable' } },
    { score: 0, medal: 'participacion', placement: { rank: 2, label: '2.º lugar' } },
  ]);
  assert.match(result.text, /Pendiente Lugar pendiente Medalla pendiente/);
  assert.match(result.text, /Lugar pendiente Sin medalla asignada/);
  assert.match(result.text, /0 2\.º lugar Medalla de participación/);
  assert.doesNotMatch(result.text, /Medalla de oro|Medalla de plata|Medalla de bronce|1\.º lugar/);
});

test('Relevé awaiting audience votes keeps final medal and place pending in the PDF', async () => {
  const result = await render([
    { score: null, juryScore: 145, medal: 'oro',
      placement: { rank: 1, label: '1.º lugar' },
      audience: { votes: 17, bonus: 0, ready: false, status: 'tie_pending' } },
  ]);
  assert.match(result.text, /Jurado: 145 · Público: 17 votos · Bono: Empate por definir/);
  assert.match(result.text, /Pendiente del público Medalla pendiente/);
  assert.doesNotMatch(result.text, /Medalla de oro|1\.º lugar/);
});

test('award labels remain readable across multiple A4 pages with long names', async () => {
  const result = await render(Array.from({ length: 20 }, (_, index) => ({
    score: 190 - index, medal: index < 10 ? 'oro' : 'plata',
    directCompetition: false, eligibleCount: 1,
    row: { name: `Rutina ${index + 1} - ${'Composición, precisión y expresión escénica. '.repeat(3)}` },
  })));
  assert.ok(result.pdf.getPageCount() > 1);
  assert.equal(result.text.match(/Sin competencia directa/g).length, 20);
  assert.equal(result.text.match(/Medalla de oro/g).length, 10);
  assert.equal(result.text.match(/Medalla de plata/g).length, 10);
  for (const page of result.pdf.getPages()) {
    assert.equal(page.getWidth(), 595.28);
    assert.equal(page.getHeight(), 841.89);
  }
  assert.match(result.text, /Rutina 20/);
  assert.doesNotMatch(result.text, /#120 a/);
});

test('ceremony PDF moves from independent Relevé to special awards, champion and porra without Top Score', async () => {
  const bundle = fixture([
    { score: 199.5, medal: 'oro', row: { name: 'Vuelo campeón' } },
    { score: 182, medal: 'oro', row: { name: 'Competencia Aerial' } },
    { score: 50, juryScore: 45, maximumScore: 50, medal: 'participacion', row: { name: 'Maestro Relevé Motion' },
      audience: { votes: 28, bonus: 5, ready: true, status: 'ready' } },
    { score: null, juryScore: 43, maximumScore: 50, medal: null, placement: null, row: { name: 'Maestra Relevé Aerial' },
      audience: { votes: 17, bonus: 0, ready: false, status: 'tie_pending' } },
  ]);
  const block = bundle.snapshot.report.blocks[0];
  const standings = block.sections[0].categories[0].rows;
  block.sections = [
    { label: 'Motion', kind: 'competition', categories: [{ title: 'Junior - Solo', rows: [standings[0]] }] },
    { label: 'Aerial', kind: 'competition', categories: [{ title: 'Senior - Intermedio', rows: [standings[1]] }] },
    { label: 'Relevé', kind: 'releve', categories: [
      { title: 'Relevé Motion', rows: [standings[2]] },
      { title: 'Relevé Aerial', rows: [standings[3]] },
    ] },
  ];
  block.specialAwards = [
    { id: 'award_2', title: 'Mejor música', displayValue: 'Academia del Sol' },
    { id: 'award_1', title: 'Mejor vestuario', displayValue: 'Academia Águila' },
    { id: 'award_3', title: 'Mejor idea coreográfica', displayValue: 'Academia del Valle' },
    { id: 'champion_of_champions', title: 'Campeón de campeones',
      displayValue: 'Vuelo campeón · Academia Águila · 200 puntos' },
    { id: 'award_4', title: 'Mejor porra', displayValue: 'Academia del Ritmo' },
  ];
  block.releveAudienceFavorite = { status: 'ready', winner: { routineId: '3', name: 'Maestro Relevé Motion', academy: 'Academia Águila', votes: 28 } };
  const bytes = await generateAdminReportPdf(bundle, 'b1');
  const pdf = await PDFDocument.load(bytes);
  const text = contentText(pdf).replace(/\s+/g, ' ');
  const motion = text.indexOf('MOTION');
  const aerial = text.indexOf('AERIAL');
  const releve = text.indexOf('PREMIO RELEVÉ');
  const specialAwards = text.indexOf('PREMIOS ESPECIALES');
  const choreography = text.indexOf('Mejor idea coreográfica:');
  const wardrobe = text.indexOf('Mejor vestuario:');
  const music = text.indexOf('Mejor música:');
  const champion = text.indexOf('Campeón de campeones:');
  const porra = text.indexOf('Mejor porra:');
  assert.ok(motion >= 0 && motion < aerial && aerial < releve);
  assert.match(text, /PREMIO RELEVÉ Premiación independiente El más votado por el público Maestro Relevé Motion · Academia Águila · 28 votos Relevé Motion/);
  assert.doesNotMatch(text, /#10[1-4]|199\.5/);
  assert.ok(releve < text.indexOf('Maestro Relevé Motion'));
  assert.ok(releve < text.indexOf('Maestra Relevé Aerial'));
  assert.match(text, /Jurado: 45 · Público: 28 votos · Bono: \+5 · Final hasta 50 puntos/);
  assert.match(text, /Jurado: 43 · Público: 17 votos · Bono: Empate por definir/);
  assert.match(text, /Pendiente del público Medalla pendiente/);
  assert.match(text, /Campeón de campeones: Vuelo campeón · Academia Águila · 200 puntos/);
  assert.ok(text.indexOf('Maestra Relevé Aerial') < specialAwards);
  assert.ok(releve < specialAwards && specialAwards < music && music < wardrobe
    && wardrobe < choreography && choreography < champion && champion < porra);
  assert.doesNotMatch(text, /TOP SCORE/);
  assert.deepEqual([...text.matchAll(/(Mejor idea coreográfica|Mejor vestuario|Mejor música|Campeón de campeones|Mejor porra):/g)]
    .map((match) => match[1]), ['Mejor música', 'Mejor vestuario', 'Mejor idea coreográfica', 'Campeón de campeones', 'Mejor porra']);
  assert.match(text, /Mejor porra: Academia del Ritmo/);
  if (process.env.LEVITATE_RELEVE_PDF_PREVIEW) {
    await writeFile(process.env.LEVITATE_RELEVE_PDF_PREVIEW, bytes);
  }
});

test('final PDF rounds displayed points only and leaves the source scores and placements intact', async () => {
  const bundle = fixture([
    { score: 12.1, medal: 'participacion', placement: { rank: 2, label: '2.º lugar' } },
    { score: 12.9, medal: 'participacion', placement: { rank: 1, label: '1.º lugar' } },
  ]);
  const before = structuredClone(bundle);
  const bytes = await generateAdminReportPdf(bundle, 'b1');
  const text = contentText(await PDFDocument.load(bytes)).replace(/\s+/g, ' ');
  assert.match(text, /12 2\.º lugar Medalla de participación/);
  assert.match(text, /13 1\.º lugar Medalla de participación/);
  assert.doesNotMatch(text, /12\.1|12\.9|#101|#102/);
  assert.deepEqual(bundle, before);
});

test('public-favorite PDF announcement never invents a winner while voting is pending, tied or empty', async () => {
  for (const [status, message] of [['pending', 'Pendiente del cierre de la votación'],
    ['tie', 'Empate del público pendiente de resolver'], ['none', 'Sin votos registrados']]) {
    const bundle = fixture([{ score: null, medal: null, placement: null }]);
    const block = bundle.snapshot.report.blocks[0];
    block.sections[0].kind = 'releve';
    block.releveAudienceFavorite = { status, winner: null };
    const text = contentText(await PDFDocument.load(await generateAdminReportPdf(bundle, 'b1'))).replace(/\s+/g, ' ');
    assert.ok(text.indexOf('El más votado por el público') < text.indexOf('Junior - Solo'));
    assert.ok(text.includes(message));
  }
});

test('PDF category headings omit age ranges while preserving levels, apparatus formats and source data', async () => {
  const bundle = fixture([
    { row: { name: 'Rutina inspirada en 7 A 10 AÑOS' } },
    { row: { name: 'Vuelo Baby' } },
    { row: { name: 'Vuelo en dos aparatos' } },
  ]);
  const section = bundle.snapshot.report.blocks[0].sections[0];
  section.label = 'PETITE: 7 A 10 AÑOS';
  const standings = section.categories[0].rows;
  section.categories = [
    { title: 'PETITE: 7 A 10 AÑOS DÚO', rows: [standings[0]] },
    { title: 'BABY: HASTA LOS 6 AÑOS SOLO', rows: [standings[1]] },
    { title: 'PETITE: 7 A 10 AÑOS INTERMEDIO DÚO: 2 APARATOS', rows: [standings[2]] },
  ];
  const before = structuredClone(bundle);
  const bytes = await generateAdminReportPdf(bundle, 'b1');
  const text = contentText(await PDFDocument.load(bytes)).replace(/\s+/g, ' ');
  assert.match(text, /Bloque de premiación PETITE PETITE DÚO/);
  assert.match(text, /PETITE DÚO Rutina inspirada en 7 A 10 AÑOS/);
  assert.match(text, /BABY SOLO Vuelo Baby/);
  assert.match(text, /PETITE INTERMEDIO DÚO: 2 APARATOS Vuelo en dos aparatos/);
  assert.doesNotMatch(text, /PETITE: 7 A 10 AÑOS|BABY: HASTA LOS 6 AÑOS/);
  assert.deepEqual(bundle, before, 'category presentation must not mutate source titles, scores or grouping');
  if (process.env.LEVITATE_CATEGORY_PDF_PREVIEW) {
    await writeFile(process.env.LEVITATE_CATEGORY_PDF_PREVIEW, bytes);
  }
});

test('PDF preserves raw backend totals of 19, 43 and 210 and the actual Relevé 50-point maximum', async () => {
  const bundle = fixture([
    { score: 19, maximumScore: 210, medal: 'participacion',
      placement: { rank: 3, label: '3.º lugar' }, row: { name: 'Suma real de 19' } },
    { score: 43, maximumScore: 210, medal: 'participacion',
      placement: { rank: 2, label: '2.º lugar' }, row: { name: 'Suma real de 43' } },
    { score: 210, maximumScore: 210, medal: 'oro',
      placement: { rank: 1, label: '1.º lugar' }, row: { name: 'Suma real de 210' } },
    { score: 50, juryScore: 45, maximumScore: 50, medal: 'participacion',
      placement: { rank: 1, label: '1.º lugar' },
      audience: { votes: 28, bonus: 5, ready: true, status: 'closed' },
      row: { name: 'Relevé con máximo real' } },
  ]);
  const block = bundle.snapshot.report.blocks[0];
  const standings = block.sections[0].categories[0].rows;
  block.sections[0].categories[0].rows = standings.slice(0, 3);
  block.sections.push({ label: 'Relevé', kind: 'releve',
    categories: [{ title: 'Relevé Aerial', rows: [standings[3]] }] });
  block.releveAudienceFavorite = { status: 'ready', winner: { routineId: '4',
    name: 'Relevé con máximo real', academy: 'Academia Águila', votes: 28 } };
  const before = structuredClone(bundle);
  const bytes = await generateAdminReportPdf(bundle, 'b1');
  const text = contentText(await PDFDocument.load(bytes)).replace(/\s+/g, ' ');
  assert.match(text, /Suma real de 19 Academia Águila 19 3\.º lugar Medalla de participación/);
  assert.match(text, /Suma real de 43 Academia Águila 43 2\.º lugar Medalla de participación/);
  assert.match(text, /Suma real de 210 Academia Águila 210 1\.º lugar Medalla de oro/);
  assert.match(text, /Jurado: 45 · Público: 28 votos · Bono: \+5 · Final hasta 50 puntos 50 1\.º lugar Medalla de participación/);
  assert.doesNotMatch(text, /155|Jurado: 150/);
  assert.deepEqual(bundle, before, 'the PDF must never normalize or recompute scores, bonuses, medals or places');
  if (process.env.LEVITATE_RAW_TOTALS_PDF_PREVIEW) {
    await writeFile(process.env.LEVITATE_RAW_TOTALS_PDF_PREVIEW, bytes);
  }
});

test('Relevé PDF omits absent or invalid source maxima instead of assuming 155 points', async () => {
  for (const maximumScore of [undefined, null, NaN, Infinity, -1, 0]) {
    const result = await render([{ score: 48, juryScore: 43, maximumScore,
      audience: { votes: 4, bonus: 5, ready: true, status: 'closed' } }]);
    assert.match(result.text, /Jurado: 43 · Público: 4 votos · Bono: \+5/);
    assert.doesNotMatch(result.text, /Final hasta|155|NaN|Infinity/);
  }
});
