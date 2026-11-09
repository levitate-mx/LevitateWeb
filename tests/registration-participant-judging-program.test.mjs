import assert from "node:assert/strict";
import test from "node:test";
import { parseParticipantJudgingProgram } from "../shared/participant-judging-program.js";

const header = '<tr><th>COREOGRAFÍA</th><th>ID</th><th>ID INSCRIPCIÓN</th></tr>';
const row = (source = '1', dance = 'd49a92a5-1063-4c5b-ab3f-a3d40e0e487a', title = 'VOLAR') => `<tr><td>${title}</td><td>${source}</td><td>${dance}</td></tr>`;
const table = body => `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse}</style></head><body><table>${body}</table></body></html>`;

test('program associations preserve exact IDs across block titles and repeated headers', () => {
  const html = table(`<tr><td colspan="11">BLOQUE 1</td></tr>${header}${row()}<tr><td colspan="12">BLOQUE 2</td></tr>${header}${row('2', 'other-123', 'LUZ &amp; AIRE')}`);
  assert.deepEqual(parseParticipantJudgingProgram(html), [
    { danceId: 'd49a92a5-1063-4c5b-ab3f-a3d40e0e487a', sourceRoutineId: '1' },
    { danceId: 'other-123', sourceRoutineId: '2' },
  ]);
});

test('HTML entities decode as text without rendering or fetching content', () => {
  const encodedHeader = header.replace('INSCRIPCIÓN', 'INSCRIPCI&Oacute;N');
  const encodedRow = row('&#49;', 'dance&#x2d;01', 'LUZ &lt;BRILLANTE&gt;');
  assert.deepEqual(parseParticipantJudgingProgram(table(encodedHeader + encodedRow)), [{ danceId: 'dance-01', sourceRoutineId: '1' }]);
});

test('old exports, missing columns, malformed cells and duplicate IDs fail before linkage', () => {
  for (const html of [
    table('<tr><th>COREOGRAFÍA</th><th>ACADEMIA</th></tr><tr><td>Volar</td><td>Academia</td></tr>'),
    table('<tr><th>ID</th></tr><tr><td>1</td></tr>'),
    table(header + row() + row('1', 'different-123')),
    table(header + row() + row('2')),
    table(header.replace('<th>ID</th>', '<th>ID</th><th>ID</th>') + row()),
    table(header + '<tr><td>VOLAR</td><td>1</td></tr>'),
    table(header + '<tr><td>VOLAR</td><td>1</td><td rowspan="2">dance-01</td></tr>'),
    table(header),
  ]) assert.throws(() => parseParticipantJudgingProgram(html));
});

test('ambiguous numeric and unsafe registration identifiers are rejected', () => {
  for (const source of ['0', '-1', '01', '1.0', '1e2', '1 OR 1=1', '999999999999999999']) {
    assert.throws(() => parseParticipantJudgingProgram(table(header + row(source))));
  }
  for (const dance of ['short', '../dance-01', 'dance-01?person=other', 'dance-01&amp;any', 'dance-01\nother']) {
    assert.throws(() => parseParticipantJudgingProgram(table(header + row('1', dance))));
  }
});

test('active content, XML entities and external references are never imported', () => {
  for (const injected of [
    '<script>alert(1)</script>', '<img src="https://external.test/pixel">', '<a href="https://external.test">Abrir</a>',
    '<iframe src="https://external.test"></iframe>', '<?xml version="1.0"?>', '<!ENTITY test SYSTEM "file:///etc/passwd">',
    '<td onclick="alert(1)">Texto</td>', '<svg onload="alert(1)"></svg>',
  ]) assert.throws(() => parseParticipantJudgingProgram(table(header + row()) + injected));
  assert.throws(() => parseParticipantJudgingProgram(table(header + row()) + table(header + row('2', 'another-1'))));
});

test('program imports are bounded to 600 unique routines and a small text file', () => {
  const rows = Array.from({ length: 600 }, (_, index) => row(String(index + 1), `dance-${String(index).padStart(5, '0')}`)).join('');
  assert.equal(parseParticipantJudgingProgram(table(header + rows)).length, 600);
  assert.throws(() => parseParticipantJudgingProgram(table(header + rows + row('601', 'dance-extra'))), /600/);
  assert.throws(() => parseParticipantJudgingProgram(' '.repeat(2 * 1024 * 1024 + 1)));
  assert.throws(() => parseParticipantJudgingProgram('PK\x03\x04xlsx-is-not-html'));
});
