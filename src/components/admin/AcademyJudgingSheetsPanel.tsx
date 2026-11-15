import { Download, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { prepareBrowserDownload, startBrowserDownload } from "../../utils/browserDownload";
import { requestRegistrationApi } from "./registrationApi";
import "./AcademyJudgingSheetsPanel.css";

export type AcademyJudgingDance = {
  categoryLabel: string;
  id: string;
  participantNames: string[];
  title: string;
};

type SheetStatus = "available" | "pending" | "unavailable";
type SheetSummary = {
  danceId: string;
  eventId: string | null;
  eventTitle: string | null;
  judgeCount: number;
  status: SheetStatus;
};
type Criterion = { id: string | number; label: string; section?: string; value: number; maximumScore: number };
type PdfJudge = { id: string; name: string; status: string; criteria: Criterion[]; penalty: number; feedback?: string; sheetMaximumScore?: number | null };
type PdfDescriptor = {
  eventTitle: string;
  preview: boolean;
  routine: { id: string | number; programNumber?: string; title: string; academy?: string; genre?: string; category?: string; division?: string; level?: string; block?: string };
  judges: PdfJudge[];
};
type SheetDetail = SheetSummary & {
  judging?: {
    preview?: boolean;
    source: string;
    sourceStatus: string;
    status: string;
    judges: Array<{ id?: string; status?: string }>;
    pdf?: PdfDescriptor;
  };
};

const endpoint = "/api/registration/judging-sheets";
const statusRank: Record<SheetStatus, number> = { available: 0, pending: 1, unavailable: 2 };

function validKey(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value);
}

function summary(value: unknown): SheetSummary {
  const sheet = value as Partial<SheetSummary> | null;
  const eventId = sheet?.eventId == null ? null : sheet.eventId;
  const eventTitle = sheet?.eventTitle == null ? null : sheet.eventTitle;
  if (!sheet || !validKey(sheet.danceId) || (eventId !== null && !validKey(eventId))
    || (eventTitle !== null && (typeof eventTitle !== "string" || !eventTitle.trim() || eventTitle.length > 200))
    || !["available", "pending", "unavailable"].includes(sheet.status || "")
    || !Number.isSafeInteger(sheet.judgeCount) || Number(sheet.judgeCount) < 0 || Number(sheet.judgeCount) > 20
    || (sheet.status === "available" && (!eventId || !eventTitle || Number(sheet.judgeCount) < 1))) {
    throw new Error("No se pudo comprobar el estado de las hojas.");
  }
  return { danceId: sheet.danceId, eventId, eventTitle: eventTitle?.trim() || null,
    judgeCount: Number(sheet.judgeCount), status: sheet.status as SheetStatus };
}

export function readAcademyJudgingSummaries(payload: unknown): SheetSummary[] {
  const rows = (payload as { sheets?: unknown } | null)?.sheets;
  if (!Array.isArray(rows)) throw new Error("No se pudo comprobar el estado de las hojas.");
  const identities = new Set<string>();
  return rows.map((value) => {
    const row = summary(value), identity = `${row.danceId}:${row.eventId || "unlinked"}`;
    if (identities.has(identity)) throw new Error("No se pudo comprobar el estado de las hojas.");
    identities.add(identity);
    return row;
  });
}

function completeDescriptor(value: unknown): PdfDescriptor | null {
  const judging = (value as SheetDetail | null)?.judging, descriptor = judging?.pdf;
  if (judging?.source !== "jueceocore" || judging.sourceStatus !== "available" || judging.status !== "available"
    || judging.preview !== false
    || !descriptor || descriptor.preview !== false || typeof descriptor.eventTitle !== "string" || !descriptor.eventTitle.trim()
    || !descriptor.routine || !["string", "number"].includes(typeof descriptor.routine.id)
    || typeof descriptor.routine.title !== "string" || !descriptor.routine.title.trim()
    || !Array.isArray(descriptor.judges) || !descriptor.judges.length || descriptor.judges.length > 20
    || !Array.isArray(judging.judges)) return null;
  const approved = new Set(judging.judges.flatMap((judge) => validKey(judge?.id) && judge.status === "complete" ? [judge.id] : []));
  const ids = new Set<string>();
  for (const judge of descriptor.judges) {
    if (!validKey(judge?.id) || ids.has(judge.id) || !approved.has(judge.id) || judge.status !== "complete"
      || typeof judge.name !== "string" || !judge.name.trim() || !Number.isFinite(judge.penalty)
      || !Array.isArray(judge.criteria) || !judge.criteria.length) return null;
    ids.add(judge.id);
    for (const criterion of judge.criteria) {
      if (!["string", "number"].includes(typeof criterion?.id) || typeof criterion.label !== "string" || !criterion.label.trim()
        || !Number.isFinite(criterion.value) || !Number.isFinite(criterion.maximumScore)
        || criterion.maximumScore < 0 || criterion.value < 0 || criterion.value > criterion.maximumScore) return null;
    }
  }
  return ids.size === approved.size ? descriptor : null;
}

export function readAcademyJudgingDetail(payload: unknown, expected: SheetSummary): PdfDescriptor {
  const value = (payload as { sheet?: unknown } | null)?.sheet;
  const current = summary(value);
  const descriptor = completeDescriptor(value);
  if (current.danceId !== expected.danceId || current.eventId !== expected.eventId || current.status !== "available"
    || current.judgeCount < 1 || !descriptor
    || descriptor.judges.length !== current.judgeCount) {
    throw new Error("Estas hojas cambiaron o todavía no están habilitadas. Actualiza e intenta de nuevo.");
  }
  return descriptor;
}

function safeFilePart(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "presentacion";
}

export function AcademyJudgingSheetsPanel({ dances }: { dances: AcademyJudgingDance[] }) {
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    requestRegistrationApi<unknown>(endpoint, { signal: controller.signal })
      .then((payload) => { if (!controller.signal.aborted) setSheets(readAcademyJudgingSummaries(payload)); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudieron consultar las hojas."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const sheetByDance = useMemo(() => {
    const grouped = new Map<string, SheetSummary[]>();
    for (const sheet of sheets) grouped.set(sheet.danceId, [...(grouped.get(sheet.danceId) || []), sheet]);
    return new Map([...grouped].map(([danceId, rows]) => [danceId, [...rows].sort((a, b) => statusRank[a.status] - statusRank[b.status] || (a.eventTitle || "").localeCompare(b.eventTitle || "", "es"))[0]]));
  }, [sheets]);

  const download = useCallback(async (dance: AcademyJudgingDance, sheet: SheetSummary) => {
    if (downloading || sheet.status !== "available") return;
    setDownloading(dance.id); setDownloadError("");
    try {
      const payload = await requestRegistrationApi<unknown>(`${endpoint}?danceId=${encodeURIComponent(dance.id)}`);
      const descriptor = readAcademyJudgingDetail(payload, sheet);
      const { generateParticipantJudgingPdf } = await import("../../../shared/participant-judging-sheet.js");
      const bytes = await generateParticipantJudgingPdf(descriptor);
      const sourceId = String(descriptor.routine.id).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 70);
      startBrowserDownload(prepareBrowserDownload(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
        `levitate-jueceo-${safeFilePart(descriptor.routine.title)}-${sourceId}.pdf`));
    } catch (failure) {
      setDownloadError(failure instanceof Error ? failure.message : "No se pudieron preparar las hojas.");
    } finally { setDownloading(""); }
  }, [downloading]);

  return <>
    <div className="levitate-admin-feedback-toolbar">
      <p>Consulta aquí las mismas hojas habilitadas en Mi Levitate.</p>
      <button disabled={loading} onClick={() => { setDownloadError(""); setRefresh((value) => value + 1); }} type="button"><RefreshCw aria-hidden="true" size={17} />{loading ? "Actualizando…" : "Actualizar"}</button>
    </div>
    {error ? <p className="levitate-admin-feedback-alert" role="alert">{error}</p> : null}
    {downloadError ? <p className="levitate-admin-feedback-alert" role="alert">{downloadError}</p> : null}
    <div className="levitate-admin-feedback-list" aria-busy={loading}>
      {dances.map((dance) => {
        const sheet = sheetByDance.get(dance.id), status = loading && !sheet ? "loading" : sheet?.status || "unavailable";
        const available = status === "available";
        const label = status === "loading" ? "Comprobando…" : available
          ? `${sheet?.judgeCount} ${sheet?.judgeCount === 1 ? "hoja disponible" : "hojas disponibles"}`
          : status === "pending" ? "Pendiente de publicación" : "No disponible por el momento";
        return <article className="levitate-admin-feedback-card" key={dance.id}>
          <div><span>{dance.categoryLabel}</span><h2>{dance.title}</h2><p>{dance.participantNames.join(", ") || "Sin participantes registrados"}</p></div>
          <div className="levitate-admin-feedback-actions">
            <strong className={`is-${status}`}>{label}</strong>
            {available && sheet ? <button disabled={Boolean(downloading)} onClick={() => void download(dance, sheet)} type="button"><Download aria-hidden="true" size={17} />{downloading === dance.id ? "Preparando…" : "Descargar hojas"}</button> : null}
          </div>
        </article>;
      })}
      {!dances.length ? <p className="levitate-admin-empty-state">Todavía no hay coreografías registradas para mostrar hojas de jueceo.</p> : null}
    </div>
  </>;
}
