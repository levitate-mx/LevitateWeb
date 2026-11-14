import assert from 'node:assert/strict';
import test from 'node:test';
import { selectParticipantPhotoAssets } from '../worker/participant-photo-priority.js';

const dances = [{ id: 'dance-a', title: 'A', participant_count: 1 }, { id: 'dance-b', title: 'B', participant_count: 2 }];
const asset = (id, sourceFileId, created_at, extra = {}) => ({ id, sourceFileId, created_at, event_id: 'event-a', danceId: 'dance-a', ...extra });

test('new previews replace the same original before applying the two-photo limit without mutating inputs', () => {
  const assets = [asset('old-a', 'original-a', '2026-11-13 00:00:01'), asset('b', 'original-b', '2026-11-13 00:00:02'),
    asset('new-a', 'original-a', '2026-11-13 00:00:03')];
  const before = structuredClone({ dances, assets });
  assert.deepEqual(selectParticipantPhotoAssets(dances, assets).map(photo => photo.id), ['new-a', 'b']);
  assert.deepEqual({ dances, assets }, before);
});

test('original identity includes both edition and choreography', () => {
  const first = asset('first', 'same-provider-id', '2026-11-13 00:00:01');
  for (const second of [
    asset('other-dance', 'same-provider-id', '2026-11-13 00:00:02', { danceId: 'dance-b' }),
    asset('other-edition', 'same-provider-id', '2026-11-13 00:00:02', { event_id: 'event-b' }),
  ]) {
    assert.equal(selectParticipantPhotoAssets(dances, [first, second]).length, 2);
  }
});

test('manual photos fall back to asset identity and never collide with a Drive original or repeated query rows', () => {
  const manual = asset('original-a', null, '2026-11-13 00:00:02');
  const automatic = asset('auto-a', 'original-a', '2026-11-13 00:00:01');
  assert.deepEqual(selectParticipantPhotoAssets(dances, [manual, manual, automatic]).map(photo => photo.id), ['original-a', 'auto-a']);
});

test('source deduplication preserves choreography priority and excludes nonmember dances', () => {
  const assets = [asset('old-a', 'a', '2026-11-13 00:00:01'), asset('new-a', 'a', '2026-11-13 00:00:02'),
    asset('group-b', 'b', '2026-11-13 00:00:03', { danceId: 'dance-b' }),
    asset('not-a-member', 'c', '2026-11-13 00:00:04', { danceId: 'dance-c' })];
  assert.deepEqual(selectParticipantPhotoAssets(dances, assets).map(photo => photo.id), ['new-a', 'group-b']);
});
