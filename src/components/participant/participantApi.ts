import { prepareBrowserDownload, startBrowserDownload } from "../../utils/browserDownload";
import type { ParticipantPortalData } from "./participantTypes";

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

export function openParticipantSession(): Promise<ParticipantPortalData> {
  if (initialSessionRequest) return initialSessionRequest;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const hasAccess = fragment.has("access") || fragment.has("token");
  const access = fragment.get("access") ?? fragment.get("token");
  // Remove the private access link before a request, an image, or another navigation.
  if (hasAccess)
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
  initialSessionRequest = (async () => {
    if (hasAccess) {
      if (!access?.trim())
        throw new ParticipantApiError(401, "invalid_access", "El enlace no es válido.");
      await participantRequest("/api/participant/access/exchange", {
        method: "POST",
        body: JSON.stringify({ token: access }),
      });
    }
    return participantRequest<ParticipantPortalData>("/api/participant/me");
  })().finally(() => {
    initialSessionRequest = null;
  });
  return initialSessionRequest;
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
    if (preview && url.pathname.startsWith("/assets/")) return url.pathname;
  } catch {
    /* An unavailable asset is shown as pending by the caller. */
  }
  return undefined;
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
