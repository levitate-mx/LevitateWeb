import type { ParticipantPortalData } from "./participantTypes";

export const PARTICIPANT_REFRESH_INTERVAL_MS = 60_000;
export const PARTICIPANT_REFRESH_FOCUS_THROTTLE_MS = 30_000;
const requestTimeoutMs = 20_000;

type RefreshOptions = {
  participantId: string;
  eventId: string;
  read: (signal: AbortSignal) => Promise<ParticipantPortalData>;
  isCurrent: () => boolean;
  isVisible: () => boolean;
  onData: (data: ParticipantPortalData) => void;
  onInvalidAccess: () => void;
  windowTarget: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  documentTarget: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  now?: () => number;
};

/** Refresh only the already-open identity, without exchanging another QR. */
export function startParticipantRefresh({ participantId, eventId, read, isCurrent, isVisible,
  onData, onInvalidAccess, windowTarget, documentTarget, now = Date.now }: RefreshOptions): () => void {
  let stopped = false;
  let lastStarted = now();
  let pending: AbortController | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    if (timeout !== undefined) clearTimeout(timeout);
    windowTarget.removeEventListener("focus", refresh);
    documentTarget.removeEventListener("visibilitychange", refresh);
    pending?.abort();
  }

  function invalidateAccess() {
    stop();
    onInvalidAccess();
  }

  async function refresh() {
    if (stopped || pending || !isCurrent() || !isVisible()
      || now() - lastStarted < PARTICIPANT_REFRESH_FOCUS_THROTTLE_MS) return;
    const controller = new AbortController();
    pending = controller;
    lastStarted = now();
    timeout = setTimeout(() => {
      controller.abort();
      if (pending === controller) pending = null;
    }, requestTimeoutMs);
    try {
      const response = await read(controller.signal);
      if (stopped || controller.signal.aborted || !isCurrent()) return;
      if (response?.participant?.id !== participantId || response.selectedEventId !== eventId
        || !Array.isArray(response.events) || !response.events.some(event => event.id === eventId)
        || !Array.isArray(response.routines)) {
        invalidateAccess();
        return;
      }
      onData(response);
    } catch (cause) {
      if (stopped || controller.signal.aborted || !isCurrent()) return;
      if ([401, 403, 404, 410].includes((cause as { status?: number })?.status || 0)) invalidateAccess();
      // A transient connection/server failure leaves the current profile intact.
    } finally {
      if (pending === controller) {
        pending = null;
        if (timeout !== undefined) clearTimeout(timeout);
        timeout = undefined;
      }
    }
  }

  const interval = setInterval(refresh, PARTICIPANT_REFRESH_INTERVAL_MS);
  windowTarget.addEventListener("focus", refresh);
  documentTarget.addEventListener("visibilitychange", refresh);
  return stop;
}

export function participantPublicationChanged(before: ParticipantPortalData, after: ParticipantPortalData): boolean {
  return JSON.stringify({ participant: before.participant, diploma: before.diploma, routines: before.routines })
    !== JSON.stringify({ participant: after.participant, diploma: after.diploma, routines: after.routines });
}
