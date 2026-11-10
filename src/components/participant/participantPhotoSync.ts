import type { ParticipantPortalData } from './participantTypes';

export type ParticipantPhotoSyncStatus = 'checking' | 'ready' | 'pending' | 'unavailable';
export type ParticipantPhotoSyncResponse = {
  participantId: string;
  eventId: string;
  status: 'ready' | 'pending' | 'checking' | 'unavailable';
  hasMore: boolean;
  imported: number;
};
type Options = {
  participantId: string;
  eventId: string;
  step: (signal: AbortSignal) => Promise<ParticipantPhotoSyncResponse>;
  read: (signal: AbortSignal) => Promise<ParticipantPortalData>;
  isCurrent: () => boolean;
  onData: (data: ParticipantPortalData) => void;
  onStatus: (status: ParticipantPhotoSyncStatus) => void;
  onInvalidAccess: () => void;
};

/** Opening a passport starts bounded server work; no source image enters the browser. */
export function startParticipantPhotoSync({ participantId, eventId, step, read, isCurrent, onData, onStatus, onInvalidAccess }: Options): () => void {
  const controller = new AbortController();
  let stopped = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const current = () => !stopped && !controller.signal.aborted && isCurrent();
  const timed = async <T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    deadline = setTimeout(() => controller.abort(), 45_000);
    try { return await work(controller.signal); }
    finally { clearTimeout(deadline); }
  };
  const pause = () => new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, 1_500);
    controller.signal.addEventListener('abort', done, { once: true });
  });
  void (async () => {
    onStatus('checking');
    try {
      for (let attempt = 0; attempt < 12 && current(); attempt++) {
        const result = await timed(step);
        if (!current()) return;
        if (result.participantId !== participantId || result.eventId !== eventId
          || !['ready', 'pending', 'checking', 'unavailable'].includes(result.status)
          || typeof result.hasMore !== 'boolean' || !Number.isInteger(result.imported) || result.imported < 0) {
          onInvalidAccess(); return;
        }
        if (result.imported > 0 || result.status === 'ready') {
          const profile = await timed(read);
          if (!current()) return;
          if (profile.participant?.id !== participantId || profile.selectedEventId !== eventId
            || !Array.isArray(profile.routines) || !profile.events?.some(event => event.id === eventId)) {
            onInvalidAccess(); return;
          }
          onData(profile);
        }
        if (!result.hasMore) { onStatus(result.status === 'unavailable' ? 'unavailable' : 'ready'); return; }
        if (result.status === 'checking') await pause();
      }
      if (current()) onStatus('pending');
    } catch (cause) {
      if (stopped || !isCurrent()) return;
      if ([401, 403, 404, 410].includes((cause as { status?: number })?.status || 0)) onInvalidAccess();
      else onStatus('unavailable');
    }
  })();
  return () => { stopped = true; clearTimeout(deadline); controller.abort(); };
}
