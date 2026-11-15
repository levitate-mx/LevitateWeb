import { useEffect, useRef, useState } from 'react';
import type { ChoreographyScore, ReportBlock, ReportStanding } from '../admin/JudgingScoresPanel';

export type AnnouncementItem = { id: string; fingerprint: string; label: string };
export type AnnouncementState = { checked: boolean; onChange: (checked: boolean) => void };

type Marks = Record<string, string>;
type LocalState = { marks: Marks; pending: Map<string, string | null>; storageError: boolean };
const emptyMarks = (): Marks => Object.create(null) as Marks;
const signature = (value: unknown) => JSON.stringify(value);

export function routineAnnouncement(standing: ReportStanding, row: ChoreographyScore): AnnouncementItem {
  return { id: `routine:${standing.routineId}`, label: row.name || 'Coreografía sin nombre',
    fingerprint: signature(['routine', standing.routineId, row.name, row.academy, row.state, row.genre, row.division,
      row.level, row.category, row.status, row.completedJudges, row.expectedJudges, row.recordedScores,
      standing.score, standing.maximumScore === undefined ? 'legacy-maximum' : standing.maximumScore,
      standing.medal, standing.directCompetition, standing.eligibleCount,
      standing.placement ? [standing.placement.rank, standing.placement.label, standing.placement.isFirstPlace, standing.placement.isParticipation] : null,
      standing.juryScore ?? null, standing.audience ? [standing.audience.candidateId, standing.audience.status,
        standing.audience.ready, standing.audience.votes, standing.audience.bonus] : null]) };
}

export function awardAnnouncement(award: ReportBlock['specialAwards'][number]): AnnouncementItem {
  return { id: `award:${award.id}`, label: award.title,
    fingerprint: signature(['award', award.id, award.title, award.displayValue, award.isAssigned,
      award.isPartial ?? false, award.routineId]) };
}

export function audienceAnnouncement(favorite: ReportBlock['releveAudienceFavorite']): AnnouncementItem {
  const winner = favorite?.winner;
  return { id: 'audience-favorite', label: 'El más votado por el público',
    fingerprint: signature(['audience-favorite', favorite?.status ?? 'pending', winner
      ? [winner.routineId, winner.name, winner.academy, winner.votes] : null]) };
}

function matchesFingerprint(stored: string | undefined, item: AnnouncementItem): boolean {
  if (stored === item.fingerprint) return true;
  if (!stored || !item.id.startsWith('routine:')) return false;
  try {
    const previous: unknown = JSON.parse(stored), current: unknown = JSON.parse(item.fingerprint);
    if (!Array.isArray(previous) || previous.length !== 22 || previous[0] !== 'routine'
      || !Array.isArray(current) || current.length !== 21 || current[0] !== 'routine') return false;
    // v1 included descriptive membership counts at slot 9. Ignore only that
    // slot, preserving every result/content comparison and stored mark as-is.
    previous.splice(9, 1);
    return signature(previous) === item.fingerprint;
  } catch { return false; }
}

function readMarks(key: string): { marks: Marks; storageError: boolean } {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return { marks: emptyMarks(), storageError: false };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('marks' in value)
      || !value.marks || typeof value.marks !== 'object' || Array.isArray(value.marks)) throw new Error('Invalid local marks');
    const marks = emptyMarks();
    for (const [id, fingerprint] of Object.entries(value.marks)) {
      if (!id || typeof fingerprint !== 'string' || !fingerprint) throw new Error('Invalid local mark');
      marks[id] = fingerprint;
    }
    return { marks, storageError: false };
  } catch { return { marks: emptyMarks(), storageError: true }; }
}

function overlayPending(marks: Marks, pending: LocalState['pending']): Marks {
  const result = Object.assign(emptyMarks(), marks);
  for (const [id, fingerprint] of pending) {
    if (fingerprint === null) delete result[id];
    else result[id] = fingerprint;
  }
  return result;
}

/** Browser-only announcement notes. No API request or automatic storage write. */
export function useDictamenAnnouncements(eventId: string, blockId: string) {
  const key = `levitate.dictamen-announcements.v1:${JSON.stringify([eventId, blockId])}`;
  const enabled = Boolean(eventId && blockId);
  const cache = useRef(new Map<string, LocalState>());
  const active = useRef('');
  const [, refresh] = useState(0);
  let state = cache.current.get(key);
  // Reading the new namespace during its first render prevents an old block's
  // checked state from appearing before an effect runs. Reads never write back.
  if (!state || active.current !== key) {
    const stored = enabled ? readMarks(key) : { marks: emptyMarks(), storageError: false };
    state = { marks: overlayPending(stored.storageError && state ? state.marks : stored.marks, state?.pending ?? new Map()),
      pending: state?.pending ?? new Map(), storageError: stored.storageError || Boolean(state?.pending.size) };
    cache.current.set(key, state);
  }
  active.current = key;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const changed = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) return;
      const current = cache.current.get(key);
      if (!current) return;
      const stored = readMarks(key);
      current.marks = overlayPending(stored.storageError ? current.marks : stored.marks, current.pending);
      current.storageError = stored.storageError || current.pending.size > 0;
      if (active.current === key) refresh(value => value + 1);
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [key, enabled]);

  const isAnnounced = (item: AnnouncementItem) => enabled && active.current === key
    && matchesFingerprint(cache.current.get(key)?.marks[item.id], item);
  const setAnnounced = (item: AnnouncementItem, checked: boolean) => {
    // A delayed click from a previously displayed block cannot write there.
    if (!enabled || active.current !== key) return;
    const current = cache.current.get(key)!;
    const stored = readMarks(key);
    current.pending.set(item.id, checked ? item.fingerprint : null);
    current.marks = overlayPending(stored.storageError ? current.marks : stored.marks, current.pending);
    try {
      window.localStorage.setItem(key, JSON.stringify({ version: 1, marks: current.marks }));
      current.pending.clear();
      current.storageError = false;
    } catch { current.storageError = true; }
    refresh(value => value + 1);
  };
  return { isAnnounced, setAnnounced, storageError: state.storageError };
}
