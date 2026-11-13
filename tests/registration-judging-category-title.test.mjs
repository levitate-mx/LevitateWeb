import assert from 'node:assert/strict';
import test from 'node:test';
import { compactJudgingCategoryTitle } from '../shared/judging-category-title.js';

test('the event age brackets are omitted from display labels while division, level and format remain', () => {
  for (const [label, expected] of [
    ['BABY: HASTA LOS 6 AÑOS SOLO', 'BABY SOLO'],
    ['PETITE: 7 A 10 AÑOS DÚO', 'PETITE DÚO'],
    ['JUNIOR: 11 A 13 AÑOS PRINCIPIANTE SOLO', 'JUNIOR PRINCIPIANTE SOLO'],
    ['TEEN: 14 A 17 AÑOS GRUPO', 'TEEN GRUPO'],
    ['SENIOR: 18 AÑOS + INTERMEDIO DÚO: 2 APARATOS', 'SENIOR INTERMEDIO DÚO: 2 APARATOS'],
    ['SENIOR: 18 AÑOS EN ADELANTE AVANZADO TRÍOS: 3 APARATOS', 'SENIOR AVANZADO TRÍOS: 3 APARATOS'],
    ['LEGACY: +40 AÑOS SOLO', 'LEGACY SOLO'],
    ['Petite: 7 a 10 años Solo', 'Petite Solo'],
  ]) assert.equal(compactJudgingCategoryTitle(label), expected, label);
});

test('compact names, apparatus counts and unrelated age text remain unchanged', () => {
  for (const label of ['PETITE DÚO', 'BABY SOLO', 'RELEVÉ', 'OPEN AÉREO',
    'DÚO: 2 APARATOS', 'TRÍOS: 3 APARATOS', 'Taller de 7 a 10 años']) {
    assert.equal(compactJudgingCategoryTitle(label), label);
  }
});
