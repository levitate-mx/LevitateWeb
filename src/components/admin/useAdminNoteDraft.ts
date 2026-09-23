import { useEffect, useState } from "react";

const draftPrefix = "levitate-admin-note:";
const memoryDrafts = new Map<string, string>();

function readDraft(key: string) {
  if (memoryDrafts.has(key)) return memoryDrafts.get(key)!;

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: string | null) {
  if (value === null) memoryDrafts.delete(key);
  else memoryDrafts.set(key, value);

  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // The in-memory draft still survives closing and reopening the detail.
  }
}

export function clearAdminNoteDrafts(userId: string) {
  const prefix = `${draftPrefix}${encodeURIComponent(userId)}:`;
  for (const key of memoryDrafts.keys()) {
    if (key.startsWith(prefix)) memoryDrafts.delete(key);
  }
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(prefix)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable in restricted browser sessions.
  }
}

// Mount the order detail with a key per user/order so drafts cannot cross orders.
export function useAdminNoteDraft(userId: string, orderType: string, orderId: string, savedNotes: string) {
  const key = `${draftPrefix}${encodeURIComponent(userId)}:${orderType}:${encodeURIComponent(orderId)}`;
  const [draft, setDraft] = useState<string | null>(() => readDraft(key));
  const notes = draft ?? savedNotes;
  const hasChanges = notes !== savedNotes;

  useEffect(() => {
    if (draft !== null && draft === savedNotes) {
      writeDraft(key, null);
      setDraft(null);
    }
  }, [draft, key, savedNotes]);

  const setNotes = (value: string) => {
    const nextDraft = value === savedNotes ? null : value;
    writeDraft(key, nextDraft);
    setDraft(nextDraft);
  };

  const markSaved = (discard = false) => {
    // A request may finish after the detail was reopened and a newer draft typed.
    if (discard || readDraft(key) === notes) writeDraft(key, null);
    setDraft((current) => discard || current === notes ? null : current);
  };

  return { notes, setNotes, hasChanges, markSaved };
}
