import { prepareBrowserDownload, startBrowserDownload } from "../../utils/browserDownload";
import type { ParticipantAdminPreviewData, ParticipantPortalData } from "./participantTypes";

export class ParticipantApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ParticipantApiError";
  }
}

async function responseError(response: Response): Promise<ParticipantApiError> {
  const body = await response.json().catch(() => null);
  return new ParticipantApiError(
    response.status,
    body?.error?.code || "request_failed",
    body?.error?.message || "No pudimos completar la solicitud. Intenta de nuevo.",
  );
}

export async function participantRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

let initialSessionRequest: Promise<ParticipantPortalData> | null = null;
let pendingAccess: string | null = null;

function normalizeParticipantAccess(value: string | null): string {
  const candidate = value?.trim() || "";
  const valid = /^[A-Za-z0-9_-]{43}$/;
  if (valid.test(candidate)) return candidate;
  // Copying a quoted CSV cell or message can leave its closing quote in the hash.
  // Remove only a single known wrapper; the token itself must remain exactly intact.
  for (const [opening, closing] of [["\"", "\""], ["'", "'"], ["“", "”"], ["‘", "’"]]) {
    if (candidate.startsWith(opening) && candidate.endsWith(closing) && valid.test(candidate.slice(1, -1))) {
      return candidate.slice(1, -1);
    }
    if (candidate.endsWith(closing) && valid.test(candidate.slice(0, -1))) return candidate.slice(0, -1);
  }
  throw new ParticipantApiError(401, "invalid_access", "El enlace personal no es válido. Abre de nuevo el enlace completo.");
}

function cacheSessionRequest(operation: Promise<ParticipantPortalData>, access: string | null) {
  const request = operation.finally(() => {
    if (initialSessionRequest === request) {
      initialSessionRequest = null;
      pendingAccess = null;
    }
  });
  pendingAccess = access;
  initialSessionRequest = request;
  return request;
}

function rejectParticipantAccess(error: unknown): Promise<ParticipantPortalData> {
  const previous = initialSessionRequest;
  const rejection = previous ? previous.catch(() => undefined).then(() => { throw error; }) : Promise.reject(error);
  // A second StrictMode mount must share this rejection instead of opening an old cookie.
  return cacheSessionRequest(rejection, null);
}

export function openParticipantSession(): Promise<ParticipantPortalData> {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const hasAccess = fragment.has("access") || fragment.has("token");
  // Remove the private access link before a request, an image, or another navigation.
  if (hasAccess)
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );

  let access: string | null = null;
  if (hasAccess) {
    const values = [...fragment.values()];
    if (values.length !== 1) {
      return rejectParticipantAccess(new ParticipantApiError(401, "invalid_access", "El enlace personal no es válido. Abre de nuevo el enlace completo."));
    }
    try { access = normalizeParticipantAccess(fragment.get("access") ?? fragment.get("token")); }
    catch (error) { return rejectParticipantAccess(error); }
  }
  if (initialSessionRequest && (!hasAccess || access === pendingAccess)) return initialSessionRequest;

  const previous = initialSessionRequest;
  const open = async () => {
    if (hasAccess) {
      await participantRequest("/api/participant/access/exchange", {
        method: "POST",
        body: JSON.stringify({ token: access }),
      });
    }
    return participantRequest<ParticipantPortalData>("/api/participant/me");
  };
  // StrictMode mounts share the pending request. A different personal link waits
  // for the earlier exchange so that their session cookies cannot finish out of order.
  return cacheSessionRequest(previous ? previous.catch(() => undefined).then(open) : open(), access);
}

export function participantAssetUrl(
  value: string | null | undefined,
  preview = false,
): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return undefined;
    if (url.pathname.startsWith("/api/participant/assets/")) return url.pathname + url.search;
    if (preview && /^\/media\/mi-levitate-demo\/foto-[12]\.jpg$/.test(url.pathname) && !url.search && !url.hash) return url.pathname;
    if (preview && url.pathname.startsWith("/assets/")) return url.pathname;
  } catch {
    /* An unavailable asset is shown as pending by the caller. */
  }
  return undefined;
}

export async function openParticipantAdminPreview(search: string, signal?: AbortSignal): Promise<ParticipantAdminPreviewData> {
  const query = new URLSearchParams(search);
  const eventId = query.get("eventId")?.trim();
  const participantId = query.get("participantId")?.trim();
  if (!eventId || !participantId || eventId.length > 100 || participantId.length > 100) {
    throw new ParticipantApiError(400, "invalid_admin_preview", "Selecciona una edición y un participante desde administración.");
  }
  const params = new URLSearchParams({ preview: "1", eventId, participantId });
  const data = await participantRequest<ParticipantAdminPreviewData>(
    `/api/registration/admin/participant-portal?${params}`, { signal },
  );
  if (data.adminPreview !== true || data.participant?.id !== participantId || data.selectedEventId !== eventId
    || !Array.isArray(data.events) || !Array.isArray(data.routines)) {
    throw new ParticipantApiError(502, "invalid_admin_preview", "No pudimos verificar la vista interna de este participante.");
  }
  return data;
}

export function participantAdminAssetUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    const assetId = url.searchParams.get("assetId");
    const downloads = url.searchParams.getAll("download");
    if (url.origin !== window.location.origin || url.pathname !== "/api/registration/admin/participant-portal"
      || url.username || url.password || url.hash || !assetId || !/^[a-zA-Z0-9_-]{8,100}$/.test(assetId)
      || url.searchParams.getAll("assetId").length !== 1 || downloads.length > 1
      || (downloads.length === 1 && downloads[0] !== "1")
      || [...url.searchParams.keys()].some(key => key !== "assetId" && key !== "download")) return undefined;
    return `${url.pathname}?assetId=${encodeURIComponent(assetId)}${downloads.length ? "&download=1" : ""}`;
  } catch {
    return undefined;
  }
}

export async function downloadParticipantPdf(url: string, fileName: string): Promise<void> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/pdf" },
  });
  if (!response.ok) throw await responseError(response);
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) {
    throw new Error("El documento todavía no está disponible. Intenta de nuevo más tarde.");
  }
  const blob = await response.blob();
  startBrowserDownload(prepareBrowserDownload(blob, fileName));
}
