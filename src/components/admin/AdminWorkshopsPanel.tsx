import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, RefreshCw, Search, X } from "lucide-react";
import { RegistrationApiError, requestRegistrationApi } from "./registrationApi";
import { normalizeAdminSearch } from "./adminNavigation";
import { AdminPagination } from "./AdminPagination";
import { useAdminPagination } from "./useAdminPagination";
import { prepareBrowserDownload, startBrowserDownload, type BrowserDownload } from "../../utils/browserDownload";
import { formatWorkshopTime } from "../../data/workshopsContent";
import "./AdminWorkshopsPanel.css";

type WorkshopSession = {
  id: string; title: string; coach: string; trackId: string; venue: string;
  start: string; end: string; minAge: number | null; maxAge: number | null;
  capacity: number | null; enrolled: number; available: number | null;
};
type Enrollment = {
  id: string; curp: string; name: string; academyName: string; sessionIds: string[];
  revision: number; count: number; extraCount: number; amountDue: number; paidAmount: number;
  balance: number; paymentStatus: "not_required" | "pending" | "partial" | "paid" | "reported" | "rejected";
  paymentReference: string; latestProof: PaymentProof | null;
  createdAt: string; updatedAt: string;
};
type PaymentProof = {
  id: string; fileName: string; contentType: string; fileSize: number; amount: number;
  status: "reported" | "approved" | "rejected"; notes: string | null;
  createdAt: string; reviewedAt: string | null;
};
type Snapshot = {
  event: { eventId: string; date: string; eventName: string };
  sessions: WorkshopSession[]; enrollments: Enrollment[];
};
type Payload = { workshops: Snapshot };
const money = (amount: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(amount);
const paymentLabels = { not_required: "Incluidos", pending: "Pendiente", partial: "Pago parcial", paid: "Pagado", reported: "Por revisar", rejected: "Rechazado" };
function ages(session: WorkshopSession) {
  return session.maxAge === 12 ? "Hasta 12 años" : session.minAge === 13 ? "Mayores de 12 años" : "Ambos grupos";
}
function message(error: unknown) { return error instanceof Error ? error.message : "No se pudieron cargar los workshops."; }
function prepareProof(proof: PaymentProof & { dataUrl: string }): BrowserDownload {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  const prefix = `data:${proof.contentType};base64,`;
  if (!allowedTypes.includes(proof.contentType) || typeof proof.dataUrl !== "string" || !proof.dataUrl.startsWith(prefix)) {
    throw new Error("No se pudo leer el comprobante.");
  }
  const bytes = Uint8Array.from(atob(proof.dataUrl.slice(prefix.length)), character => character.charCodeAt(0));
  return prepareBrowserDownload(new Blob([bytes], { type: proof.contentType }), proof.fileName);
}

export function AdminWorkshopsPanel({ refreshKey = 0, onUpdated }: { refreshKey?: number; onUpdated?: (date: string) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [query, setQuery] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [review, setReview] = useState<{ curp: string; revision: number; proofId: string; proofStatus: PaymentProof["status"] } | null>(null);
  const [proofStale, setProofStale] = useState(false);
  const [proofFile, setProofFile] = useState<BrowserDownload | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState("");
  const [proofRetry, setProofRetry] = useState(0);
  const [paymentNote, setPaymentNote] = useState("");
  const requestId = useRef(0);
  const mutationInProgress = useRef(false);
  const paymentForm = useRef<HTMLElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const enrollmentHeading = useRef<HTMLHeadingElement>(null);
  const notifyUpdated = useRef(onUpdated);
  notifyUpdated.current = onUpdated;

  const accept = useCallback((payload: Payload) => {
    if (!payload.workshops || !Array.isArray(payload.workshops.sessions) || !Array.isArray(payload.workshops.enrollments)) {
      throw new Error("No se pudo leer la respuesta de workshops. Actualiza para volver a intentar.");
    }
    setSnapshot(payload.workshops);
    notifyUpdated.current?.(new Date().toISOString());
  }, []);
  const refresh = useCallback(async () => {
    if (mutationInProgress.current) return;
    const id = ++requestId.current;
    setLoading(true); setError(""); setNotice("");
    try {
      const payload = await requestRegistrationApi<Payload>("/api/registration/admin/workshops");
      if (id === requestId.current) accept(payload);
    } catch (error) { if (id === requestId.current) setError(message(error)); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [accept]);
  useEffect(() => { void refresh(); return () => { requestId.current++; }; }, [refresh, refreshKey]);
  useEffect(() => { if (notice) noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [notice]);
  useEffect(() => {
    if (!review) return;
    const controller = new AbortController();
    setProofLoading(true); setProofError(""); setProofFile(null);
    paymentForm.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    paymentForm.current?.focus({ preventScroll: true });
    const params = new URLSearchParams({ curp: review.curp, proofId: review.proofId });
    void requestRegistrationApi<{ proof: PaymentProof & { dataUrl: string } }>(`/api/registration/admin/workshops/payment-proof?${params}`, { signal: controller.signal })
      .then(payload => {
        if (controller.signal.aborted) return;
        if (payload.proof?.id !== review.proofId) throw new Error("El comprobante cambió. Vuelve a abrirlo.");
        if (payload.proof.status !== review.proofStatus) { setProofStale(true); return; }
        setProofFile(prepareProof(payload.proof));
      })
      .catch(error => { if (!controller.signal.aborted) setProofError(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setProofLoading(false); });
    return () => controller.abort();
  }, [review, proofRetry]);

  const mutate = async (path: string, body: unknown, success: string) => {
    if (mutationInProgress.current) return false;
    mutationInProgress.current = true;
    setBusy(true); setError(""); setNotice("");
    ++requestId.current;
    try {
      accept(await requestRegistrationApi<Payload>(`/api/registration/admin/workshops/${path}`, { method: "POST", body: JSON.stringify(body) }));
      setNotice(success);
      return true;
    } catch (error) {
      setError(message(error));
      if (!(error instanceof RegistrationApiError) || error.status === 409 || error.status >= 500 || error.code === "invalid_response") setProofStale(true);
      return false;
    }
    finally { mutationInProgress.current = false; setBusy(false); setLoading(false); }
  };
  const filtered = useMemo(() => (snapshot?.enrollments || []).filter(enrollment => {
    const haystack = normalizeAdminSearch(`${enrollment.name} ${enrollment.curp} ${enrollment.academyName}`);
    return haystack.includes(normalizeAdminSearch(query)) && (!sessionFilter || enrollment.sessionIds.includes(sessionFilter))
      && (paymentFilter === "all" || (paymentFilter === "reported" ? enrollment.paymentStatus === "reported" : enrollment.balance > 0));
  }), [snapshot, query, sessionFilter, paymentFilter]);
  const pagination = useAdminPagination(filtered, `${query}|${sessionFilter}|${paymentFilter}`);
  const payment = snapshot?.enrollments.find(enrollment => enrollment.curp === review?.curp);
  const proof = payment?.latestProof;
  const paymentChanged = proofStale || Boolean(payment && (payment.revision !== review?.revision || proof?.id !== review?.proofId));
  const pendingAmount = snapshot?.enrollments.reduce((total, enrollment) => total + enrollment.balance, 0) || 0;
  const reportedCount = snapshot?.enrollments.filter(enrollment => enrollment.paymentStatus === "reported").length || 0;
  const sessionName = (id: string) => {
    const session = snapshot?.sessions.find(session => session.id === id);
    return session ? `${session.title} · ${session.trackId === "aerial" ? "Aerial" : "Motion"} · ${formatWorkshopTime(session.start)}` : id;
  };
  const reviewPayment = async (decision: "approve" | "reject") => {
    if (!payment || !review || paymentChanged || proofLoading || proof?.status !== "reported"
      || (decision === "approve" && !proofFile) || (decision === "reject" && !paymentNote.trim())) return;
    if (await mutate("payment-review", { curp: payment.curp, revision: review.revision, proofId: review.proofId, decision, notes: paymentNote.trim() }, decision === "approve" ? "Pago aprobado." : "Comprobante rechazado.")) setReview(null);
  };
  const exportExcel = async () => {
    if (!snapshot || exporting || loading || busy || !filtered.length) return;
    setExporting(true); setExportError("");
    // Export every matching participant, including results on other pages.
    const rows = filtered.map(enrollment => ({
      ...enrollment, workshops: enrollment.sessionIds.map(sessionName),
      paymentStatus: paymentLabels[enrollment.paymentStatus],
    }));
    try {
      const { createWorkshopExcel } = await import("./workshopExcel");
      const file = await createWorkshopExcel(rows, snapshot.event.eventName);
      startBrowserDownload(prepareBrowserDownload(file, `levitate-workshops-${snapshot.event.date}.xlsx`));
    } catch {
      setExportError("No se pudo generar el Excel. Intenta de nuevo.");
    } finally { setExporting(false); }
  };

  return <div className="admin-workshops" aria-busy={loading || busy}>
    <div className="admin-workshops__toolbar">
      <p>13 de noviembre de 2026 · Estado de México</p>
      <button type="button" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw size={16} />Actualizar</button>
    </div>
    {error && !review && <p className="registration-admin-alert" role="alert">{error}</p>}
    {notice && <p ref={noticeRef} className="admin-workshops__notice" role="status">{notice}</p>}
    {!snapshot ? <p role="status">{loading ? "Cargando workshops…" : "Usa Actualizar para volver a intentar."}</p> : <>
      <div className="admin-workshops__stats">
        <article><span>Participantes</span><strong>{snapshot.enrollments.length}</strong></article>
        <article><span>Lugares reservados</span><strong>{snapshot.sessions.reduce((sum, session) => sum + session.enrolled, 0)}</strong></article>
        <article><span>Extras pendientes</span><strong>{money(pendingAmount)}</strong></article>
        <article><span>Pagos por revisar</span><strong>{reportedCount}</strong></article>
      </div>
      <section aria-label="Inscritos por taller" className="admin-workshops__sessions">
        {snapshot.sessions.map(session => <article key={session.id} className="admin-workshops__session">
          <div><span className="admin-workshops__eyebrow">{session.trackId === "aerial" ? "Aerial" : "Motion"} · {ages(session)}</span><h2>{session.title}</h2><p>{session.coach}</p><small>{formatWorkshopTime(session.start)} – {formatWorkshopTime(session.end)}</small></div>
          <p className="admin-workshops__occupancy"><strong>{session.enrolled}</strong> {session.enrolled === 1 ? "inscrito" : "inscritos"}</p>
          <button type="button" className="admin-workshops__view" aria-label={`Ver inscritos de ${sessionName(session.id)}`} onClick={() => { setSessionFilter(session.id); enrollmentHeading.current?.scrollIntoView({ block: "start", behavior: "smooth" }); enrollmentHeading.current?.focus({ preventScroll: true }); }}>Ver inscritos</button>
        </article>)}
      </section>
      <section className="admin-workshops__enrollments" aria-labelledby="workshop-enrollments-title">
        <header><h2 ref={enrollmentHeading} tabIndex={-1} id="workshop-enrollments-title">Inscritos</h2><button type="button" onClick={() => void exportExcel()} disabled={!filtered.length || exporting || loading || busy} aria-busy={exporting} title="Exporta todos los participantes que coinciden con los filtros"><FileSpreadsheet aria-hidden="true" size={16} />{exporting ? "Generando Excel…" : "Exportar Excel"}</button></header>
        {exportError && <p className="admin-workshops__export-error" role="alert">{exportError}</p>}
        <div className="admin-workshops__filters">
          <label className="admin-workshops__search"><Search size={17} /><input aria-label="Buscar inscritos en workshops" placeholder="Nombre, CURP o academia" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <select aria-label="Filtrar por taller" value={sessionFilter} onChange={event => setSessionFilter(event.target.value)}><option value="">Todos los talleres</option>{snapshot.sessions.map(session => <option key={session.id} value={session.id}>{sessionName(session.id)} · {ages(session)}</option>)}</select>
          <select aria-label="Filtrar por pago" value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)}><option value="all">Todos los pagos</option><option value="reported">Por revisar</option><option value="pending">Con saldo pendiente</option></select>
        </div>
        <div className="admin-workshops__table-scroll"><table><thead><tr><th>Participante</th><th>Talleres</th><th>Extras</th><th>Pago</th></tr></thead><tbody>
          {pagination.visibleItems.map(enrollment => <tr key={enrollment.id}><td><strong>{enrollment.name}</strong><small>{enrollment.curp}</small><small>{enrollment.academyName}</small></td><td><ul>{enrollment.sessionIds.map(id => <li key={id}>{sessionName(id)}</li>)}</ul></td><td><strong>{enrollment.extraCount ? money(enrollment.amountDue) : "—"}</strong><small>{enrollment.extraCount} {enrollment.extraCount === 1 ? "adicional" : "adicionales"}</small></td><td><span className={`admin-workshops__payment-status is-${enrollment.paymentStatus}`}>{paymentLabels[enrollment.paymentStatus]}</span>{enrollment.amountDue > 0 && <><small>{money(enrollment.balance)} pendiente</small><small>{enrollment.paymentReference}</small></>}{enrollment.latestProof && <button type="button" disabled={busy || loading} onClick={() => { setProofFile(null); setProofLoading(true); setProofError(""); setProofStale(false); setError(""); setReview({ curp: enrollment.curp, revision: enrollment.revision, proofId: enrollment.latestProof!.id, proofStatus: enrollment.latestProof!.status }); setPaymentNote(""); }}>{enrollment.paymentStatus === "reported" ? "Revisar pago" : "Ver comprobante"}</button>}</td></tr>)}
          {!filtered.length && <tr><td colSpan={4}>{snapshot.enrollments.length ? "Sin resultados." : "Todavía no hay inscritos."}</td></tr>}
        </tbody></table></div>
        <AdminPagination {...pagination} label="workshops" itemLabel="participantes" />
      </section>
    </>}
    {payment && proof && <section ref={paymentForm} tabIndex={-1} className="admin-workshops__payment-form" aria-labelledby="workshop-payment-title">
      <header><h2 id="workshop-payment-title">Comprobante · {payment.name}</h2><button type="button" aria-label="Cerrar comprobante" onClick={() => setReview(null)} disabled={busy}><X size={18} /></button></header>
      <p>{payment.paymentReference} · {money(proof.amount)} MXN</p>
      {error && <p className="registration-admin-alert" role="alert">{error}</p>}
      {paymentChanged && <div className="registration-admin-alert" role="alert"><p>Actualiza los datos y vuelve a abrir el comprobante para verificar su estado antes de continuar.</p><button type="button" disabled={busy || loading} onClick={() => { setReview(null); void refresh(); }}>Actualizar datos</button></div>}
      {proofLoading && <p role="status">Cargando comprobante…</p>}
      {proofError && <div role="alert"><p>{proofError}</p><button type="button" onClick={() => setProofRetry(retry => retry + 1)}>Volver a cargar</button></div>}
      {proofFile && !paymentChanged && <>
        <div className="admin-workshops__proof-preview">{proof.contentType.startsWith("image/") ? <img src={proofFile.url} alt={`Comprobante de ${payment.name}`} /> : <iframe src={proofFile.url} title={`Comprobante de ${payment.name}`} />}</div>
        <div className="admin-workshops__proof-links"><a href={proofFile.url} target="_blank" rel="noopener noreferrer">Ver comprobante</a><button type="button" onClick={() => startBrowserDownload(proofFile)}><Download size={16} />Descargar</button><small>{proof.fileName}</small></div>
      </>}
      {proof.status === "reported" ? <div className="admin-workshops__review-actions">
        <label>Nota o motivo del rechazo<textarea rows={2} maxLength={1000} value={paymentNote} onChange={event => setPaymentNote(event.target.value)} disabled={busy || paymentChanged} /></label>
        <div><button type="button" className="admin-workshops__approve" disabled={busy || loading || paymentChanged || !proofFile || proofLoading} onClick={() => void reviewPayment("approve")}>{busy ? "Guardando…" : "Aprobar pago"}</button><button type="button" disabled={busy || loading || paymentChanged || proofLoading || !paymentNote.trim()} onClick={() => void reviewPayment("reject")}>Rechazar</button></div>
      </div> : <p role="status">{proof.status === "approved" ? "Pago aprobado." : "Comprobante rechazado."}{proof.notes ? ` ${proof.notes}` : ""}</p>}
    </section>}
  </div>;
}
