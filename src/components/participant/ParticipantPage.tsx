import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ImageOff,
  LockKeyhole,
  Maximize2,
  Medal,
  Check,
} from "lucide-react";
import { ParticipantDialog } from "./ParticipantDialog";
import { ParticipantDiplomaPreview } from "./ParticipantDiplomaPreview";
import {
  downloadParticipantPdf,
  openParticipantAdminPreview,
  openParticipantSession,
  ParticipantApiError,
  participantAdminAssetUrl,
  participantAssetUrl,
  participantRequest,
} from "./participantApi";
import type {
  ParticipantDiplomaGenerator,
  ParticipantPhoto,
  ParticipantPortalData,
} from "./participantTypes";
import { LevitateHeader } from "../home/LevitateHeader";
import { prepareBrowserDownload, startBrowserDownload } from "../../utils/browserDownload";
import { participantPublicationChanged, startParticipantRefresh } from "./participantRefresh";
import { participantReleasedScore } from './participantReleasedScore';
import { startParticipantPhotoSync, type ParticipantPhotoSyncStatus, type ParticipantPhotoSyncResponse } from "./participantPhotoSync";
import "./ParticipantPage.css";

const scoreFormatter = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const medalNames = { oro: "Oro", plata: "Plata", bronce: "Bronce", participacion: "Participación" };

function score(value: number | null): string {
  return value !== null && Number.isFinite(value) ? scoreFormatter.format(value) : "—";
}

function personalName(name: string): [string, string] {
  const words = name.trim().split(/\s+/);
  const split = words.length > 2 ? words.length - 2 : 1;
  return [words.slice(0, split).join(" "), words.slice(split).join(" ")];
}

function participantPageMode(pathname: string, search: string, internalPreview: boolean, development: boolean) {
  if (/^\/mi-levitate\/demo\.?\/?$/.test(pathname)) return "demo";
  if (internalPreview || /^\/admin\/mi-levitate\/resumen\/?$/.test(pathname)) return "internal";
  if (development && new URLSearchParams(search).get("preview") === "1") return "demo";
  return "participant";
}

function participantDiplomaGenerator(
  data: ParticipantPortalData | null,
  event: ParticipantPortalData["events"][number] | undefined,
  internalPreview: boolean,
): ParticipantDiplomaGenerator | undefined {
  const descriptor = data?.diploma?.generator;
  if (data?.diploma?.status !== "available" || !event || !descriptor
    || event.id !== data.selectedEventId || typeof descriptor.preview !== "boolean"
    || (!internalPreview && descriptor.preview)
    || descriptor.templateUrl !== "/assets/participant-recognition-template.pdf"
    || descriptor.name !== data.participant.name || descriptor.academy !== data.participant.academy
    || descriptor.eventTitle !== event.title
    || (descriptor.season !== undefined && descriptor.season !== event.season)
    || (descriptor.venue !== undefined && descriptor.venue !== event.venue)
    || (descriptor.dateLabel !== undefined && descriptor.dateLabel !== (event.startsAt?.slice(0, 10) || ""))) return undefined;
  // Only the authenticated profile and its selected edition supply identity.
  // The generator has no access-grant operation and never invents a QR URL.
  return { name: data.participant.name, academy: data.participant.academy, eventTitle: event.title,
    season: event.season, venue: event.venue, dateLabel: event.startsAt?.slice(0, 10) || "",
    templateUrl: "/assets/participant-recognition-template.pdf", preview: internalPreview || descriptor.preview };
}

function PhotoImage({ photo, className }: { photo: ParticipantPhoto; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className="participant-photo-error">
        <ImageOff size={25} aria-hidden="true" />
        <span>No se pudo cargar esta foto.</span>
      </span>
    );
  return (
    <img
      className={className}
      src={photo.previewUrl}
      alt={photo.caption || "Fotografía de la presentación"}
      width={photo.width || undefined}
      height={photo.height || undefined}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function InternalPreviewBanner() {
  return (
    <div className="participant-preview-banner participant-preview-banner--internal">
      <strong>Vista interna de administración</strong>
      <span>Esta revisión no publica material ni crea un acceso de participante.</span>
      <a href="/admin/mi-levitate">Volver a administración <ArrowLeft size={14} aria-hidden="true" /></a>
    </div>
  );
}

function PortalState({
  mode,
  message,
  onRetry,
  internalPreview = false,
}: {
  mode: "loading" | "access" | "error" | "closed";
  message?: string;
  onRetry: () => void;
  internalPreview?: boolean;
}) {
  return (
    <main className="participant-portal participant-entry">
      {internalPreview && <InternalPreviewBanner />}
      <a href="/" aria-label="Levitate MX, inicio" className="participant-brand">
        <img src="/assets/levitate-logo-mx.png" alt="Levitate MX" />
      </a>
      <div className="participant-entry__content" aria-live="polite" aria-busy={mode === "loading"}>
        <p className="participant-eyebrow">Mi Levitate</p>
        <h1>
          {mode === "loading" ? (
            <>
              Tu historia,
              <br />
              <em>en un instante.</em>
            </>
          ) : mode === "closed" ? (
            <>
              Nos vemos
              <br />
              <em>en el escenario.</em>
            </>
          ) : (
            <>
              Tu espacio.
              <br />
              <em>Tu Levitate.</em>
            </>
          )}
        </h1>
        <p>
          {mode === "loading"
            ? "Estamos abriendo tus presentaciones."
            : mode === "closed"
              ? "Tu sesión se cerró correctamente."
              : message || (internalPreview
                ? "Selecciona una edición y un participante desde administración para revisar su resumen."
                : "Abre tu enlace personal o escanea tu QR para consultar tus presentaciones, resultados y recuerdos.")}
        </p>
        {mode === "loading" && <span className="participant-loading-line" aria-hidden="true" />}
        {mode === "error" && (
          <button
            type="button"
            className="participant-button participant-button--ivory"
            onClick={onRetry}
          >
            Volver a intentar <ArrowRight size={18} aria-hidden="true" />
          </button>
        )}
        {mode !== "loading" && (
          <a className="participant-entry__home" href={internalPreview ? (mode === "access" ? "/login" : "/admin/mi-levitate") : "/"}>
            {internalPreview ? (mode === "access" ? "Iniciar sesión como administrador" : "Volver a administración") : "Ir a Levitate MX"} <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        )}
      </div>
      <p className="participant-entry__footer">
        <LockKeyhole size={13} aria-hidden="true" />
        Un espacio personal de Levitate MX.
      </p>
    </main>
  );
}

export function ParticipantPage({ internalPreview = false }: { internalPreview?: boolean } = {}) {
  const mode = participantPageMode(window.location.pathname, window.location.search, internalPreview, import.meta.env.DEV);
  const preview = mode === "demo";
  const isInternalPreview = mode === "internal";
  const [data, setData] = useState<ParticipantPortalData | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "access" | "error" | "closed">(
    "loading",
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [changingEvent, setChangingEvent] = useState(false);
  const [eventError, setEventError] = useState("");
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const [photoSyncStatus, setPhotoSyncStatus] = useState<ParticipantPhotoSyncStatus>('ready');
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [judgingDownloadBusy, setJudgingDownloadBusy] = useState(false);
  const [judgingDownloadMessage, setJudgingDownloadMessage] = useState("");
  const [judgingDownloadError, setJudgingDownloadError] = useState(false);
  const judgingGeneration = useRef(0);
  const diplomaGeneration = useRef(0);
  const diplomaRequest = useRef<AbortController | null>(null);
  const assetGeneration = useRef(0);
  const assetRequest = useRef<AbortController | null>(null);
  const assetKind = useRef<"diploma" | "jueceo" | null>(null);
  const eventRequest = useRef<AbortController | null>(null);
  const accessNavigation = useRef(0);
  const refreshContext = useRef({ data, phase, changingEvent });
  refreshContext.current = { data, phase, changingEvent };

  function cancelParticipantDownloads(clearMessages = true) {
    ++judgingGeneration.current;
    ++diplomaGeneration.current;
    ++assetGeneration.current;
    diplomaRequest.current?.abort();
    assetRequest.current?.abort();
    assetKind.current = null;
    if (clearMessages) {
      setDownloadBusy(null);
      setDownloadMessage("");
      setJudgingDownloadBusy(false);
      setJudgingDownloadMessage("");
      setJudgingDownloadError(false);
    }
  }

  useEffect(() => {
    if (preview || isInternalPreview) return;
    const openNewLink = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      if (!fragment.has("access") && !fragment.has("token")) return;
      ++accessNavigation.current;
      cancelParticipantDownloads();
      eventRequest.current?.abort();
      setData(null);
      setSelectedRoutineId(null);
      setPhotoIndex(null);
      setChangingEvent(false);
      setError("");
      setPhase("loading");
      setAttempt((value) => value + 1);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    window.addEventListener("hashchange", openNewLink);
    return () => window.removeEventListener("hashchange", openNewLink);
  }, [preview, isInternalPreview]);

  useEffect(() => {
    let active = true;
    const navigation = accessNavigation.current;
    const controller = new AbortController();
    document.title = "Mi Levitate — Levitate MX";
    setPhase("loading");
    const load = preview
      ? import("./participantPreview").then((module) => module.previewParticipantData)
      : isInternalPreview ? openParticipantAdminPreview(window.location.search, controller.signal) : openParticipantSession();
    if (preview && window.location.hash)
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    load
      .then((response) => {
        if (!active || navigation !== accessNavigation.current) return;
        setData(response);
        setError("");
        setSelectedRoutineId(response.routines[0]?.id || null);
        setPhase("ready");
      })
      .catch((cause: unknown) => {
        if (!active || navigation !== accessNavigation.current) return;
        if (cause instanceof ParticipantApiError && [401, 403, 404, 410].includes(cause.status)) {
          setError(
            isInternalPreview ? "Inicia sesión como administrador para revisar este participante."
              : "Abre tu enlace personal o escanea tu QR. Si el enlace venció, solicita uno nuevo a Levitate MX.",
          );
          setPhase("access");
        } else {
          setError(isInternalPreview && cause instanceof ParticipantApiError ? cause.message
            : "No pudimos abrir tu espacio en este momento. Revisa tu conexión e intenta de nuevo.");
          setPhase("error");
        }
      });
    return () => {
      active = false;
      cancelParticipantDownloads(false);
      controller.abort();
      eventRequest.current?.abort();
    };
  }, [preview, isInternalPreview, attempt]);

  useEffect(() => {
    if (preview || isInternalPreview || phase !== "ready" || changingEvent || !data) return;
    const participantId = data.participant.id;
    const eventId = data.selectedEventId;
    const navigation = accessNavigation.current;
    return startParticipantRefresh({
      participantId, eventId,
      windowTarget: window,
      documentTarget: document,
      isVisible: () => document.visibilityState === "visible",
      isCurrent: () => accessNavigation.current === navigation && refreshContext.current.phase === "ready"
        && !refreshContext.current.changingEvent && refreshContext.current.data?.participant.id === participantId
        && refreshContext.current.data.selectedEventId === eventId,
      read: signal => participantRequest<ParticipantPortalData>(`/api/participant/me?eventId=${encodeURIComponent(eventId)}`, { signal }),
      onData: response => {
        const previous = refreshContext.current.data;
        if (previous && participantPublicationChanged(previous, response)) {
          cancelParticipantDownloads();
          setPhotoIndex(null);
        }
        setData(response);
        setSelectedRoutineId(current => response.routines.some(item => item.id === current)
          ? current : response.routines[0]?.id || null);
      },
      onInvalidAccess: () => {
        ++accessNavigation.current;
        cancelParticipantDownloads();
        eventRequest.current?.abort();
        setPhotoIndex(null);
        setData(null);
        setError("Tu sesión cambió o terminó. Abre de nuevo tu enlace personal para continuar.");
        setPhase("access");
      },
    });
  }, [preview, isInternalPreview, phase, changingEvent, data?.participant.id, data?.selectedEventId]);

  useEffect(() => {
    if (preview || phase !== 'ready' || changingEvent || !data) return;
    const participantId = data.participant.id, eventId = data.selectedEventId;
    const navigation = accessNavigation.current;
    return startParticipantPhotoSync({ participantId, eventId,
      isCurrent: () => accessNavigation.current === navigation && refreshContext.current.phase === 'ready'
        && !refreshContext.current.changingEvent && refreshContext.current.data?.participant.id === participantId
        && refreshContext.current.data.selectedEventId === eventId,
      step: signal => participantRequest<ParticipantPhotoSyncResponse>(isInternalPreview
        ? '/api/registration/admin/participant-portal' : '/api/participant/photos/sync', {
          method: 'POST', signal, body: JSON.stringify(isInternalPreview
            ? { action: 'photo.sync', eventId, participantId } : { eventId }),
        }),
      read: signal => isInternalPreview
        ? openParticipantAdminPreview(new URLSearchParams({ eventId, participantId }).toString(), signal)
        : participantRequest<ParticipantPortalData>(`/api/participant/me?eventId=${encodeURIComponent(eventId)}`, { signal }),
      onStatus: setPhotoSyncStatus,
      onData: response => {
        const previous = refreshContext.current.data;
        if (previous && participantPublicationChanged(previous, response)) {
          cancelParticipantDownloads(); setPhotoIndex(null);
        }
        setData(response);
        setSelectedRoutineId(current => response.routines.some(item => item.id === current) ? current : response.routines[0]?.id || null);
      },
      onInvalidAccess: () => {
        ++accessNavigation.current;
        cancelParticipantDownloads(); eventRequest.current?.abort(); setPhotoIndex(null); setData(null);
        setError(isInternalPreview ? 'Inicia sesión como administrador para continuar la revisión.' : 'Tu sesión cambió o terminó. Abre de nuevo tu enlace personal.');
        setPhase('access');
      },
    });
  }, [preview, isInternalPreview, phase, changingEvent, data?.participant.id, data?.selectedEventId]);

  const routine = data?.routines.find((item) => item.id === selectedRoutineId) || data?.routines[0];
  const event = data?.events.find((item) => item.id === data.selectedEventId);
  useEffect(() => {
    cancelParticipantDownloads();
    return () => { cancelParticipantDownloads(false); };
  }, [data?.participant.id, data?.selectedEventId, phase]);
  useEffect(() => {
    ++judgingGeneration.current;
    if (assetKind.current === "jueceo") {
      ++assetGeneration.current;
      assetRequest.current?.abort();
      assetKind.current = null;
      setDownloadBusy(current => current === "jueceo" ? null : current);
    }
    setJudgingDownloadBusy(false);
    setJudgingDownloadMessage("");
    setJudgingDownloadError(false);
    return () => { ++judgingGeneration.current; };
  }, [data?.participant.id, data?.selectedEventId, selectedRoutineId, phase]);
  const photos = useMemo(
    () =>
      (data?.routines || [])
        .flatMap((routineItem) =>
          routineItem.photos.items.flatMap((photo) => {
            const previewUrl = isInternalPreview
              ? participantAdminAssetUrl(photo.previewUrl)
              : participantAssetUrl(photo.previewUrl, preview);
            return previewUrl
              ? [{
                  ...photo,
                  previewUrl,
                  routineId: routineItem.id,
                  routineTitle: routineItem.title,
                  downloadUrl: isInternalPreview
                    ? participantAdminAssetUrl(photo.downloadUrl)
                    : participantAssetUrl(photo.downloadUrl, preview),
                }]
              : [];
          }),
        )
        .slice(0, 2),
    [data?.routines, preview, isInternalPreview],
  );

  useEffect(() => {
    if (phase !== "ready" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("participant-is-visible");
            reveal.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 },
    );
    document
      .querySelectorAll("[data-participant-reveal]")
      .forEach((element) => reveal.observe(element));
    return () => reveal.disconnect();
  }, [phase, selectedRoutineId, data?.selectedEventId]);

  function selectRoutine(id: string) {
    ++judgingGeneration.current;
    setSelectedRoutineId(id);
    setPhotoIndex(null);
    setDownloadMessage("");
  }

  async function selectEvent(eventId: string) {
    if (preview || eventId === data?.selectedEventId) return;
    ++accessNavigation.current;
    cancelParticipantDownloads();
    eventRequest.current?.abort();
    const controller = new AbortController();
    eventRequest.current = controller;
    setChangingEvent(true);
    setEventError("");
    setPhotoIndex(null);
    setDownloadMessage("");
    try {
      const response = isInternalPreview ? await openParticipantAdminPreview(
        new URLSearchParams({ eventId, participantId: data!.participant.id }).toString(), controller.signal,
      ) : await participantRequest<ParticipantPortalData>(
        `/api/participant/me?eventId=${encodeURIComponent(eventId)}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setData(response);
      selectRoutine(response.routines[0]?.id || "");
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ParticipantApiError && cause.status === 401) {
        setData(null);
        setError(isInternalPreview ? "Inicia sesión como administrador para continuar la revisión."
          : "Tu sesión terminó. Abre de nuevo tu enlace personal para continuar.");
        setPhase("access");
      } else setEventError("No pudimos abrir esta edición. Intenta seleccionarla de nuevo.");
    } finally {
      if (!controller.signal.aborted) setChangingEvent(false);
    }
  }

  async function download(url: string, kind: "diploma" | "jueceo") {
    if (downloadBusy || changingEvent) return;
    const generation = ++assetGeneration.current;
    const navigation = accessNavigation.current;
    const judging = judgingGeneration.current;
    const controller = new AbortController();
    assetRequest.current?.abort();
    assetRequest.current = controller;
    assetKind.current = kind;
    const isCurrent = () => !controller.signal.aborted && generation === assetGeneration.current
      && navigation === accessNavigation.current && (kind !== "jueceo" || judging === judgingGeneration.current);
    setDownloadBusy(kind);
    setDownloadMessage("");
    try {
      await downloadParticipantPdf(url, `${preview ? "ejemplo-" : ""}levitate-${kind}.pdf`, { signal: controller.signal, isCurrent });
      if (!isCurrent()) return;
      setDownloadMessage("Tu documento está listo. Revisa las descargas de tu navegador.");
    } catch (cause) {
      if (!isCurrent()) return;
      setDownloadMessage(
        cause instanceof Error
          ? cause.message
          : "No se pudo descargar el documento. Intenta de nuevo.",
      );
    } finally {
      if (generation === assetGeneration.current) {
        assetKind.current = null;
        setDownloadBusy(null);
      }
    }
  }

  async function downloadGeneratedDiploma() {
    if (downloadBusy || changingEvent || !generatedDiploma) return;
    const generation = ++diplomaGeneration.current;
    const controller = new AbortController();
    diplomaRequest.current = controller;
    setDownloadBusy("diploma");
    setDownloadMessage("");
    try {
      const [{ generateParticipantDiploma }, response] = await Promise.all([
        import("../../../shared/participant-diploma.js"),
        fetch("/assets/participant-recognition-template.pdf", {
          credentials: "same-origin", cache: "force-cache", signal: controller.signal,
          headers: { Accept: "application/pdf" },
        }),
      ]);
      if (generation !== diplomaGeneration.current || controller.signal.aborted) return;
      if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/pdf")
        || Number(response.headers.get("content-length")) > 8 * 1024 * 1024) {
        throw new Error("No pudimos preparar tu reconocimiento. Intenta de nuevo más tarde.");
      }
      const templateBytes = await response.arrayBuffer();
      if (generation !== diplomaGeneration.current || controller.signal.aborted) return;
      if (templateBytes.byteLength > 8 * 1024 * 1024) throw new Error("No pudimos preparar tu reconocimiento.");
      const { templateUrl: _templateUrl, ...input } = generatedDiploma;
      let bytes: Uint8Array;
      try {
        bytes = await generateParticipantDiploma({ ...input, templateBytes });
      } catch (cause) {
        if ((cause as Error & { code?: string })?.code !== "diploma_unicode_font_required") throw cause;
        if (generation !== diplomaGeneration.current || controller.signal.aborted) return;
        const fontResponse = await fetch("/assets/participant-recognition-unicode.ttf", {
          credentials: "same-origin", cache: "force-cache", signal: controller.signal,
          headers: { Accept: "font/ttf, application/octet-stream" },
        });
        if (generation !== diplomaGeneration.current || controller.signal.aborted) return;
        if (!fontResponse.ok || !/^(?:font\/(?:ttf|sfnt)|application\/(?:octet-stream|x-font-ttf))(?:;|$)/i.test(fontResponse.headers.get("content-type") || "")
          || Number(fontResponse.headers.get("content-length")) > 2 * 1024 * 1024) {
          throw new Error("No pudimos cargar la fuente de tu reconocimiento. Intenta de nuevo más tarde.");
        }
        const unicodeFontBytes = await fontResponse.arrayBuffer();
        if (generation !== diplomaGeneration.current || controller.signal.aborted) return;
        if (unicodeFontBytes.byteLength > 2 * 1024 * 1024) throw new Error("No pudimos cargar la fuente de tu reconocimiento.");
        bytes = await generateParticipantDiploma({ ...input, templateBytes, unicodeFontBytes });
      }
      if (generation !== diplomaGeneration.current || controller.signal.aborted) return;
      startBrowserDownload(prepareBrowserDownload(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
        `${isInternalPreview ? "revision-interna-" : ""}levitate-reconocimiento.pdf`,
      ));
      setDownloadMessage("Tu reconocimiento está listo. Revisa las descargas de tu navegador.");
    } catch (cause) {
      if (generation !== diplomaGeneration.current || controller.signal.aborted) return;
      setDownloadMessage(cause instanceof Error ? cause.message : "No pudimos preparar tu reconocimiento. Intenta de nuevo.");
    } finally {
      if (generation === diplomaGeneration.current) setDownloadBusy(null);
    }
  }

  async function downloadJudgingSheets() {
    const descriptor = routine?.judging.pdf;
    if (judgingDownloadBusy || changingEvent || !descriptor || !descriptor.judges.length) return;
    // The server enforces ownership and publication. Keep internal draft
    // descriptors out of the participant download path as an additional guard.
    if (!isInternalPreview && (descriptor.preview || routine.judging.status !== "available"
      || descriptor.judges.some(judge => judge.status !== "complete"))) return;
    const generation = ++judgingGeneration.current;
    setJudgingDownloadBusy(true);
    setJudgingDownloadMessage("");
    setJudgingDownloadError(false);
    try {
      const { generateParticipantJudgingPdf } = await import("../../../shared/participant-judging-sheet.js");
      if (generation !== judgingGeneration.current) return;
      const bytes = await generateParticipantJudgingPdf({ ...descriptor, preview: isInternalPreview || descriptor.preview });
      if (generation !== judgingGeneration.current) return;
      const routineName = descriptor.routine.id.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 70);
      startBrowserDownload(prepareBrowserDownload(
        new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
        `${isInternalPreview ? "revision-interna-" : ""}levitate-jueceo-${routineName}.pdf`,
      ));
      setJudgingDownloadMessage("Tus hojas de jueceo están listas. Revisa las descargas de tu navegador.");
    } catch (cause) {
      if (generation !== judgingGeneration.current) return;
      setJudgingDownloadError(true);
      setJudgingDownloadMessage(cause instanceof Error ? cause.message
        : "No pudimos preparar tus hojas de jueceo. Intenta de nuevo.");
    } finally {
      if (generation === judgingGeneration.current) setJudgingDownloadBusy(false);
    }
  }

  if (phase !== "ready" || !data)
    return (
      <>
        <meta name="robots" content="noindex,nofollow" />
        <PortalState
          mode={phase === "ready" ? "loading" : phase}
          message={error}
          onRetry={() => setAttempt((value) => value + 1)}
          internalPreview={isInternalPreview}
        />
      </>
    );

  const [firstName, surname] = personalName(data.participant.name);
  const diploma =
    data.diploma?.status === "available"
      ? isInternalPreview ? participantAdminAssetUrl(data.diploma.url) : participantAssetUrl(data.diploma.url, preview)
      : undefined;
  const generatedDiploma = participantDiplomaGenerator(data, event, isInternalPreview);
  const diplomaAvailable = Boolean(diploma || generatedDiploma);
  const generatedJudging = routine?.judging.pdf;
  const canGenerateJudging = Boolean(generatedJudging?.judges.length && (isInternalPreview
    || (!generatedJudging.preview && routine?.judging.status === "available"
      && generatedJudging.judges.every(judge => judge.status === "complete"))));
  const judgingPdf = generatedJudging ? undefined
    : isInternalPreview ? participantAdminAssetUrl(routine?.judging.url) : participantAssetUrl(routine?.judging.url, preview);
  const published = routine?.result.status === "published";
  const result = routine?.result;
  const displayedScore = published ? result : participantReleasedScore(routine);
  const hasPlace = Boolean(
    published &&
      result?.directCompetition &&
      result.eligibleCount >= 2 &&
      result.place &&
      [1, 2, 3].includes(result.place),
  );
  const activePhoto = photoIndex !== null ? photos[photoIndex] : undefined;

  return (
    <main className="participant-portal">
      <meta name="robots" content="noindex,nofollow" />
      <meta name="referrer" content="same-origin" />
      <a className="participant-skip" href="#tu-diploma">
        Ir a mi diploma
      </a>
      {preview && (
        <div className="participant-preview-banner">
          Vista de ejemplo <span>Datos ilustrativos · Imágenes de archivo</span>
        </div>
      )}
      {isInternalPreview && <InternalPreviewBanner />}
      {!isInternalPreview && <LevitateHeader activeLabel="Inicio" useRootLinks variant="pill" />}
      <section className={`participant-hero${isInternalPreview ? "" : " participant-hero--site-nav"}`} aria-labelledby="participant-name">
        {isInternalPreview && <header className="participant-header">
          <a href="/" aria-label="Levitate MX, inicio" className="participant-brand">
            <img src="/assets/levitate-logo-mx.png" alt="Levitate MX" width="1395" height="420" />
          </a>
          <div className="participant-header__right">
            <span>
              <LockKeyhole size={12} aria-hidden="true" />
              Vista interna
            </span>
            <a className="participant-header__admin-back" href="/admin/mi-levitate">Administración <ArrowLeft size={16} aria-hidden="true" /></a>
          </div>
        </header>}
        {error && (
          <p className="participant-header__message" role="alert">
            {error}
          </p>
        )}
        <div className="participant-hero__content">
          <div className="participant-hero__intro">
            <p className="participant-eyebrow">
              Mi Levitate <span aria-hidden="true">/</span> {event?.season || event?.title}
            </p>
            <p>{data.participant.academy}</p>
          </div>
          <h1
            className="participant-hero__name"
            id="participant-name"
            aria-label={data.participant.name}
          >
            <span aria-hidden="true">{firstName}</span>
            {surname && <em aria-hidden="true">{surname}</em>}
          </h1>
          <div className="participant-hero__story">
            <div>
              <h2>El escenario fue tuyo.</h2>
              <p>
                Gracias por confiar tu talento a Levitate.
                <br />
                Esta edición también lleva tu nombre.
              </p>
            </div>
            <a className="participant-button participant-button--hero" href="#tu-diploma">
              Conserva este momento
              <ArrowDown size={19} aria-hidden="true" />
            </a>
          </div>
          {data.events.length > 1 && (
            <label className="participant-event-switch">
              <span className="participant-eyebrow">Tu edición</span>
              <span className="participant-select-wrap">
                <select
                  aria-label="Seleccionar edición"
                  value={data.selectedEventId}
                  onChange={(change) => void selectEvent(change.target.value)}
                  disabled={changingEvent}
                >
                  {data.events.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · {item.season}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </span>
            </label>
          )}
        </div>
      </section>

      <div className="participant-experience">
        <section
          className="participant-chapter participant-diploma-chapter"
          id="tu-diploma"
          data-participant-chapter
          aria-labelledby="participant-diploma-title"
          aria-busy={changingEvent}
        >
          <div className="participant-chapter__inner">
            <header className="participant-chapter-heading" data-participant-reveal>
              <h2 id="participant-diploma-title">
                Tu diploma<span>.</span>
              </h2>
            </header>
            {eventError && (
              <p className="participant-inline-message" role="alert">
                {eventError}
              </p>
            )}
            <div className="participant-diploma-layout">
              <ParticipantDiplomaPreview
                name={data.participant.name}
                academy={data.participant.academy}
                season={event?.season || ""}
                eventTitle={event?.title || "Levitate MX"}
                preview={preview}
                internalPreview={isInternalPreview}
              />
              <div className="participant-diploma-copy" data-participant-reveal>
                <p className="participant-document-status">
                  {diplomaAvailable ? (
                    <>
                      <Check size={15} aria-hidden="true" />
                      Reconocimiento autenticado y listo
                    </>
                  ) : (
                    "Tu reconocimiento está en preparación"
                  )}
                </p>
                <h3>
                  Tu participación, <br />
                  verificada en <br />
                  <em>esta edición.</em>
                </h3>
                <div className="participant-diploma-action">
                  <button
                    type="button"
                    className="participant-button"
                    disabled={!diplomaAvailable || Boolean(downloadBusy) || changingEvent}
                    onClick={() => diploma ? void download(diploma, "diploma") : void downloadGeneratedDiploma()}
                  >
                    {downloadBusy === "diploma"
                      ? "Preparando reconocimiento…"
                      : diplomaAvailable
                        ? "Descargar reconocimiento"
                        : "Reconocimiento en preparación"}
                    <ArrowDownToLine size={19} aria-hidden="true" />
                  </button>
                </div>
                <p className="participant-download-message" role="status">
                  {downloadMessage}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="participant-chapter participant-judging-chapter"
          id="tu-jueceo"
          data-participant-chapter
          aria-labelledby="participant-judging-title"
          aria-busy={changingEvent}
        >
          <div className="participant-chapter__inner">
            <header className="participant-chapter-heading" data-participant-reveal>
              <h2 id="participant-judging-title">
                Tu jueceo<span>.</span>
              </h2>
            </header>
            {changingEvent ? (
              <p className="participant-status-copy" role="status">
                Abriendo tus presentaciones de esta edición…
              </p>
            ) : routine ? (
              <div
                className="participant-selected"
                aria-live="polite"
                aria-atomic="false"
                data-participant-reveal
              >
                <header className="participant-selected__heading">
                  <label className="participant-routine-dropdown">
                    <select
                      aria-label="Seleccionar coreografía para tu jueceo"
                      value={routine.id}
                      disabled={changingEvent}
                      onChange={(change) => selectRoutine(change.target.value)}
                    >
                      {data.routines.map((routineOption) => (
                        <option key={routineOption.id} value={routineOption.id}>
                          {routineOption.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={28} aria-hidden="true" />
                  </label>
                </header>
                {displayedScore ? (
                  <dl
                    className={`participant-results ${hasPlace ? "participant-results--ranked" : ""}`}
                  >
                    <div className="participant-results__score">
                      <dt>{published ? 'Puntaje final' : 'Puntaje del jurado'}</dt>
                      <dd>
                        {score(displayedScore.score)}
                        {displayedScore.maxScore !== null && <small>/ {score(displayedScore.maxScore)}</small>}
                      </dd>
                    </div>
                    <div
                      className="participant-results__medal"
                      data-medal={published && result?.medal || "pending"}
                    >
                      <dt>{published ? 'Medalla' : 'Reconocimiento'}</dt>
                      <dd>
                        <Medal size={30} strokeWidth={1} aria-hidden="true" />
                        <span>{published ? result?.medal ? medalNames[result.medal] : 'Por publicar' : 'En revisión'}</span>
                      </dd>
                    </div>
                    {hasPlace && (
                      <div className="participant-results__place">
                        <dt>Competencia directa</dt>
                        <dd aria-label={`${result?.place === 1 ? "Primer" : result?.place === 2 ? "Segundo" : "Tercer"} lugar`}>
                          <span className="participant-results__place-rank">
                            {result?.place === 1 ? "1er" : result?.place === 2 ? "2do" : "3er"}
                          </span>
                          <small>lugar</small>
                        </dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <div className="participant-pending">
                    <span aria-hidden="true">↗</span>
                    <div>
                      <h4>Resultados en revisión.</h4>
                      <p>Tu puntaje y reconocimiento aparecerán aquí cuando se publiquen.</p>
                    </div>
                  </div>
                )}
                <div className="participant-judge-access">
                  {canGenerateJudging ? (
                    <button
                      type="button"
                      className="participant-button participant-button--outline"
                      disabled={judgingDownloadBusy || changingEvent}
                      aria-busy={judgingDownloadBusy}
                      onClick={() => void downloadJudgingSheets()}
                    >
                      {judgingDownloadBusy ? "Preparando tus hojas…" : "Descargar hojas de jueceo"}
                      <ArrowDownToLine size={17} aria-hidden="true" />
                    </button>
                  ) : judgingPdf ? (
                    <a
                      className="participant-button participant-button--outline"
                      href={judgingPdf}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir hoja de jueceo
                      <ArrowUpRight size={17} aria-hidden="true" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="participant-button participant-button--outline"
                      disabled
                    >
                      Próximamente
                      <ArrowUpRight size={17} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {routine.judging.sourceStatus && !canGenerateJudging && !judgingPdf && (
                  <p className="participant-status-copy" role="status">
                    {routine.judging.sourceStatus === "unavailable"
                      ? "Tu hoja de jueceo no está disponible en este momento. Vuelve a intentarlo más tarde."
                      : isInternalPreview && routine.judging.sourceStatus === "unlinked"
                        ? "Esta presentación todavía no tiene una evaluación vinculada."
                        : "Tu hoja de jueceo estará disponible cuando se complete y publique la evaluación."}
                  </p>
                )}
                {judgingDownloadMessage && (
                  <p className="participant-status-copy" role={judgingDownloadError ? "alert" : "status"} aria-live="polite">
                    {judgingDownloadMessage}
                  </p>
                )}
              </div>
            ) : (
              <div className="participant-pending">
                <span aria-hidden="true">↗</span>
                <div>
                  <h3>Tu historia sigue aquí.</h3>
                  <p>
                    Las presentaciones de esta edición aparecerán en este espacio cuando estén
                    disponibles.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section
          className="participant-chapter participant-gallery"
          id="tus-fotos"
          data-participant-chapter
          aria-labelledby="participant-gallery-title"
          aria-busy={changingEvent}
        >
          <div className="participant-chapter__inner">
            <header className="participant-chapter-heading" data-participant-reveal>
              <h2 id="participant-gallery-title">
                Tus fotos<span>.</span>
              </h2>
            </header>
            {photoSyncStatus === 'checking' && <p className="participant-status-copy" role="status">Estamos preparando tus fotografías…</p>}
            <div className="participant-gallery__offer" data-participant-reveal>
              <div>
                <h3>Revive tu paso por el escenario.</h3>
                <p>
                  Adquiere tu paquete de fotografía y video y conserva cada momento de tu
                  participación en Levitate.
                </p>
              </div>
              <a
                className="participant-button participant-button--ivory participant-gallery__shop"
                href="/tienda/foto-video"
              >
                Adquirir mi paquete
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </div>
            <p className="participant-gallery__delivery">
              <strong>¿Ya adquiriste tu paquete?</strong>{" "}
              Espera a que te envíen tu acceso (5 a 10 días hábiles).
            </p>
            {changingEvent ? (
              <p className="participant-status-copy" role="status">
                Abriendo las imágenes de esta edición…
              </p>
            ) : photos.length > 0 ? (
              <>
                <div className="participant-gallery__grid" data-participant-reveal>
                  {photos.map((photo, index) => (
                    <button
                      className="participant-gallery__photo"
                      type="button"
                      key={`${photo.routineId}:${photo.id}`}
                      aria-label={`Abrir fotografía ${index + 1} de ${photos.length}${photo.caption ? `. ${photo.caption}` : ""}`}
                      onClick={() => setPhotoIndex(index)}
                    >
                      <PhotoImage photo={photo} />
                      <span className="participant-gallery__photo-overlay">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <Maximize2 size={19} aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="participant-gallery__pending">
                <p>Muy pronto podrás ver un adelanto.</p>
                <span>Las dos fotografías de muestra aparecerán aquí cuando estén disponibles.</span>
              </div>
            )}
          </div>
        </section>

        <section className="participant-community" aria-labelledby="participant-community-title">
          <div className="participant-chapter__inner" data-participant-reveal>
            <h2 id="participant-community-title">
              Ya eres parte
              <br />
              de <span>Levitate.</span>
            </h2>
            <div>
              <p>Nos vemos en la próxima edición.</p>
            </div>
          </div>
        </section>
      </div>

      {activePhoto && photoIndex !== null && (
        <ParticipantDialog
          title={`Fotografía ${photoIndex + 1} de ${photos.length}`}
          className="participant-lightbox"
          onClose={() => setPhotoIndex(null)}
          onKeyDown={(key) => {
            if (key.key === "ArrowRight") {
              key.preventDefault();
              setPhotoIndex((photoIndex + 1) % photos.length);
            }
            if (key.key === "ArrowLeft") {
              key.preventDefault();
              setPhotoIndex((photoIndex - 1 + photos.length) % photos.length);
            }
          }}
        >
          <div className="participant-lightbox__image">
            <PhotoImage key={activePhoto.id} photo={activePhoto} />
            {photos.length > 1 && (
              <>
                <button
                  className="participant-icon-button participant-lightbox__previous"
                  type="button"
                  onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)}
                  aria-label="Fotografía anterior"
                >
                  <ArrowLeft size={24} aria-hidden="true" />
                </button>
                <button
                  className="participant-icon-button participant-lightbox__next"
                  type="button"
                  onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)}
                  aria-label="Fotografía siguiente"
                >
                  <ArrowRight size={24} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <div className="participant-lightbox__caption">
            <p>{activePhoto.caption || activePhoto.routineTitle}</p>
            {activePhoto.downloadUrl && (
              <a
                className="participant-text-button"
                href={activePhoto.downloadUrl}
                download
                target="_blank"
                rel="noreferrer"
              >
                Descargar foto <ArrowDownToLine size={17} aria-hidden="true" />
              </a>
            )}
          </div>
        </ParticipantDialog>
      )}
    </main>
  );
}
