import assert from 'node:assert/strict';
import test from 'node:test';
import { participantReleasedScore } from '../src/components/participant/participantReleasedScore.ts';

function routine(scores = [19, 59, 42], maxima = [70, 70, 70]) {
  return { result: { status: 'pending', score: null, medal: null, place: null }, judging: {
    status: 'available', source: 'jueceocore',
    judges: scores.map((score, i) => ({ name: `Judge ${i}`, score, maxScore: maxima[i] })),
    pdf: { preview: false, judges: scores.map((_, i) => ({ id: `judge-${i}`, name: `Judge ${i}`, status: 'complete', penalty: i === 2 ? -1 : 0 })) },
  } };
}

test('released Angel sheets show 120/210, including the existing penalty once, while recognition stays pending', () => {
  const data = routine(), before = structuredClone(data);
  assert.deepEqual(participantReleasedScore(data), { score: 120, maxScore: 210 });
  assert.deepEqual(data, before);
  assert.equal(data.result.status, 'pending');
  assert.equal(data.result.medal, null);
  assert.equal(data.result.place, null);
});

test('only released sheets contribute, including zero scores and Relevé without an unconfirmed audience bonus', () => {
  assert.deepEqual(participantReleasedScore(routine([19], [70])), { score: 19, maxScore: 70 });
  assert.deepEqual(participantReleasedScore(routine([0], [70])), { score: 0, maxScore: 70 });
  assert.deepEqual(participantReleasedScore(routine([15, 14, 13], [15, 15, 15])), { score: 42, maxScore: 45 });
});

test('withdrawn, incomplete, preview, mismatched and invalid sheets never produce a visible provisional score', () => {
  for (const mutate of [
    r => { r.judging.status = 'pending'; }, r => { r.judging.source = 'other'; },
    r => { r.judging.pdf.preview = true; }, r => { r.judging.pdf.judges[0].status = 'partial'; },
    r => { r.judging.pdf.judges.pop(); }, r => { r.judging.pdf.judges[1].id = 'judge-0'; },
    r => { r.judging.pdf.judges[0].name = 'Other'; }, r => { r.judging.judges = []; },
    r => { delete r.judging.pdf; }, r => { r.judging.judges[0].score = null; },
    r => { r.judging.judges[0].score = -1; }, r => { r.judging.judges[0].score = 71; },
    r => { r.judging.judges[0].score = NaN; }, r => { r.judging.judges[0].maxScore = Infinity; },
    r => { r.judging.judges[0].maxScore = 0; }, r => { r.result.status = 'published'; },
  ]) {
    const data = routine(); mutate(data);
    assert.equal(participantReleasedScore(data), null);
  }
  assert.equal(participantReleasedScore(undefined), null);
});
