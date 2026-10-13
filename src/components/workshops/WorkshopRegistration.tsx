import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, CheckCircle2, Clock3, ReceiptText, Search, UploadCloud } from "lucide-react";
import { emiTransferAccount } from "../../data/paymentAccounts";
import { formatWorkshopTime } from "../../data/workshopsContent";
import { RegistrationApiError, requestRegistrationApi } from "../admin/registrationApi";
import type { WorkshopRegistrationData, WorkshopRegistrationResponse, WorkshopSession } from "./workshopRegistrationTypes";
import "./WorkshopRegistration.css";

const paymentProofAccept = "image/jpeg,image/png,image/webp,application/pdf";

function proofFileError(file: File) {
  if (file.size === 0) return "El comprobante está vacío. Selecciona otro archivo.";
  if (file.size > 1400000) return "El comprobante debe pesar como máximo 1.4 MB.";
  if (!paymentProofAccept.split(",").includes(file.type)) return "Sube una imagen JPG, PNG, WEBP o un PDF.";
  return "";
}

function readProof(file: File, signal: AbortSignal) {
  return new Promise<{ fileName: string; fileSize: number; contentType: string; dataUrl: string }>((resolve, reject) => {
    const invalid = proofFileError(file);
    if (invalid) { reject(new Error(invalid)); return; }
    if (signal.aborted) { reject(new DOMException("Lectura cancelada", "AbortError")); return; }
    const reader = new FileReader();
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => { reader.abort(); cleanup(); reject(new DOMException("Lectura cancelada", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    reader.onerror = () => { cleanup(); reject(new Error("No pudimos leer el comprobante.")); };
    reader.onload = () => {
      cleanup();
      if (signal.aborted) { reject(new DOMException("Lectura cancelada", "AbortError")); return; }
      if (typeof reader.result !== "string" || !reader.result) { reject(new Error("No pudimos leer el comprobante.")); return; }
      resolve({ fileName: file.name, fileSize: file.size, contentType: file.type, dataUrl: reader.result });
    };
    try { reader.readAsDataURL(file); } catch (error) { cleanup(); reject(error); }
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function eventDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" })
    .format(new Date(`${date}T12:00:00Z`));
}

function money(amount: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function readResponse(payload: WorkshopRegistrationResponse, curp: string): WorkshopRegistrationData {
  const data = payload.workshops;
  if (!data || data.participant?.curp !== curp || !data.event || !Array.isArray(data.sessions)
    || !Number.isInteger(data.event.includedCount) || data.event.includedCount < 0
    || !Number.isFinite(data.event.extraUnitPrice) || data.event.extraUnitPrice < 0
    || (data.enrollment && !Array.isArray(data.enrollment.sessionIds))) {
    throw new Error("No se pudo leer la inscripción. Vuelve a consultar tu CURP.");
  }
  return data;
}

function availability(session: WorkshopSession, saved: boolean) {
  if (saved) return "Tu lugar está guardado";
  if (session.capacity === null) return "Inscripción abierta";
  if (session.available !== null && session.available <= 0) return "Cupo completo";
  if (session.available === null) return "Disponibilidad por confirmar";
  return `${session.available} ${session.available === 1 ? "lugar disponible" : "lugares disponibles"}`;
}

export function WorkshopRegistration({ id, isOpen }: { id: string; isOpen: boolean }) {
  const [curp, setCurp] = useState("");
  const [data, setData] = useState<WorkshopRegistrationData | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofError, setProofError] = useState("");
  const [proofMessage, setProofMessage] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [mustLookupAgain, setMustLookupAgain] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const operationInProgress = useRef(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const busy = isLookingUp || isSaving || isUploadingProof;
  const savedIds = data?.enrollment?.sessionIds ?? [];
  const dirty = selectedIds.length !== savedIds.length || selectedIds.some((sessionId) => !savedIds.includes(sessionId));
  const eligibleSessions = data?.sessions.filter((session) => session.eligible) ?? [];
  const maximumSelection = eligibleSessions.length;
  const tracks = Array.from(new Set(eligibleSessions.map((session) => session.trackId)));
  const extraCount = Math.max(0, selectedIds.length - (data?.event.includedCount ?? 3));
  const amountDue = extraCount * (data?.event.extraUnitPrice ?? 200);
  const paidAmount = data?.enrollment?.paidAmount ?? 0;
  const balance = Math.max(0, amountDue - paidAmount);
  const enrollment = data?.enrollment;
  const savedBalance = Math.max(0, (enrollment?.amountDue ?? 0) - paidAmount);
  const latestProof = enrollment?.latestProof;
  const proofPending = latestProof?.status === "reported" || enrollment?.paymentStatus === "reported";
  const hasUnavailableSelection = selectedIds.some((sessionId) => {
    const session = eligibleSessions.find((item) => item.id === sessionId);
    return !session || (!savedIds.includes(sessionId)
      && session.capacity !== null && (session.available === null || session.available <= 0));
  });

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }, [isOpen]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  function beginRequest() {
    if (operationInProgress.current) return null;
    operationInProgress.current = true;
    const controller = new AbortController();
    activeRequest.current?.abort();
    activeRequest.current = controller;
    return controller;
  }

  function isCurrent(controller: AbortController) {
    return !controller.signal.aborted && activeRequest.current === controller;
  }

  function finishRequest(controller: AbortController) {
    if (!isCurrent(controller)) return;
    activeRequest.current = null;
    operationInProgress.current = false;
    setIsLookingUp(false); setIsSaving(false); setIsUploadingProof(false);
  }

  function clearProofFile() {
    setProofFile(null);
    if (proofInputRef.current) proofInputRef.current.value = "";
  }

  function applyData(next: WorkshopRegistrationData) {
    setData(next);
    setSelectedIds(next.enrollment?.sessionIds ?? []);
    setMustLookupAgain(false);
    clearProofFile();
  }

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operationInProgress.current) return;
    const normalizedCurp = curp.trim().toUpperCase();
    if (!/^[A-Z0-9]{18}$/.test(normalizedCurp)) {
      setLookupError("Escribe los 18 caracteres de tu CURP.");
      inputRef.current?.focus();
      return;
    }
    const controller = beginRequest();
    if (!controller) return;
    setIsLookingUp(true);
    setLookupError("");
    setSaveError("");
    setSaveMessage("");
    setProofError(""); setProofMessage(""); clearProofFile();
    setData(null);
    setSelectedIds([]);
    try {
      // Establish the existing participant session before any private CURP lookup.
      await requestRegistrationApi("/api/registration/student/login", {
        method: "POST", body: JSON.stringify({ curp: normalizedCurp }), signal: controller.signal,
      });
      const response = await requestRegistrationApi<WorkshopRegistrationResponse>("/api/registration/workshops/lookup", {
        method: "POST", body: JSON.stringify({ curp: normalizedCurp }), signal: controller.signal,
      });
      if (!isCurrent(controller)) return;
      applyData(readResponse(response, normalizedCurp));
    } catch (error) {
      if (isCurrent(controller)) setLookupError(errorMessage(error, "No se pudo consultar tu inscripción. Intenta nuevamente."));
    } finally {
      finishRequest(controller);
    }
  }

  function toggleSession(sessionId: string, checked: boolean) {
    if (operationInProgress.current || proofPending) return;
    setSelectedIds((current) => checked ? [...current, sessionId] : current.filter((item) => item !== sessionId));
    setSaveError("");
    setSaveMessage("");
    setProofError(""); setProofMessage(""); clearProofFile();
  }

  async function handleWriteError(error: unknown, controller: AbortController, participantCurp: string, fallback: string, showError: (message: string) => void) {
    if (!isCurrent(controller)) return;
    const message = errorMessage(error, fallback);
    if (error instanceof RegistrationApiError && error.status === 409) {
      try {
        const response = await requestRegistrationApi<WorkshopRegistrationResponse>("/api/registration/workshops/lookup", {
          method: "POST", body: JSON.stringify({ curp: participantCurp }), signal: controller.signal,
        });
        if (isCurrent(controller)) {
          applyData(readResponse(response, participantCurp));
          showError(`${message} Actualizamos los datos; revísalos antes de continuar.`);
        }
      } catch {
        if (isCurrent(controller)) {
          setMustLookupAgain(true);
          showError(`${message} Vuelve a consultar tu CURP antes de continuar.`);
        }
      }
    } else {
      const needsCheck = !(error instanceof RegistrationApiError)
        || [401, 403].includes(error.status) || error.status >= 500 || error.code === "invalid_response";
      if (needsCheck) setMustLookupAgain(true);
      showError(needsCheck ? `${message} Vuelve a consultar tu CURP para verificar el estado antes de continuar.` : message);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || busy || proofPending || !data.eligible || mustLookupAgain || !dirty || !selectedIds.length
      || selectedIds.length > maximumSelection || hasUnavailableSelection) return;
    const controller = beginRequest();
    if (!controller) return;
    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");
    setProofError(""); setProofMessage("");
    try {
      const response = await requestRegistrationApi<WorkshopRegistrationResponse>("/api/registration/workshops/enrollment", {
        method: "POST",
        body: JSON.stringify({ curp: data.participant.curp, sessionIds: selectedIds, revision: data.enrollment?.revision ?? 0 }),
        signal: controller.signal,
      });
      if (!isCurrent(controller)) return;
      const next = readResponse(response, data.participant.curp);
      applyData(next);
      const pending = Math.max(0, (next.enrollment?.amountDue ?? 0) - (next.enrollment?.paidAmount ?? 0));
      setSaveMessage(pending > 0
        ? `Selección guardada. Saldo pendiente: ${money(pending, next.event.currency)} ${next.event.currency}.`
        : "Tu selección quedó guardada.");
    } catch (error) {
      await handleWriteError(error, controller, data.participant.curp, "No se pudo guardar tu selección.", setSaveError);
    } finally {
      finishRequest(controller);
    }
  }

  async function uploadProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !enrollment || !proofFile || busy || dirty || proofPending || mustLookupAgain || savedBalance <= 0 || !enrollment.paymentReference) return;
    const controller = beginRequest();
    if (!controller) return;
    setIsUploadingProof(true); setProofError(""); setProofMessage(""); setSaveMessage("");
    let requestSent = false;
    try {
      const file = await readProof(proofFile, controller.signal);
      if (!isCurrent(controller)) return;
      requestSent = true;
      const response = await requestRegistrationApi<WorkshopRegistrationResponse>("/api/registration/workshops/payment-proof", {
        method: "POST", body: JSON.stringify({ curp: data.participant.curp, revision: enrollment.revision, ...file }), signal: controller.signal,
      });
      if (!isCurrent(controller)) return;
      applyData(readResponse(response, data.participant.curp));
      setProofMessage("Comprobante enviado. Pago pendiente de revisión.");
    } catch (error) {
      if (requestSent) await handleWriteError(error, controller, data.participant.curp, "No se pudo enviar el comprobante.", setProofError);
      else if (isCurrent(controller)) setProofError(errorMessage(error, "No pudimos leer el comprobante. Selecciona otro archivo."));
    } finally {
      finishRequest(controller);
    }
  }

  return (
    <section className="workshop-registration" id={id} hidden={!isOpen} ref={panelRef} aria-labelledby={`${id}-title`}>
      <h3 className="workshop-registration__sr-only" id={`${id}-title`}>Inscripción a workshops</h3>
      <form className="workshop-registration__lookup" onSubmit={(event) => void lookup(event)} aria-busy={isLookingUp}>
        <label className="workshop-registration__sr-only" htmlFor={`${id}-curp`}>CURP del participante</label>
        <div className="workshop-registration__search">
          <button className="workshop-registration__search-submit" type="submit" disabled={busy}
            aria-label={isLookingUp ? "Consultando workshops" : "Consultar workshops"}>
            <Search size={23} aria-hidden="true" />
          </button>
          <input id={`${id}-curp`} ref={inputRef} name="curp" type="text" value={curp} required minLength={18} maxLength={18}
            pattern="[A-Za-z0-9]{18}" autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="search"
            placeholder="INGRESA TU CURP..." disabled={busy} aria-invalid={Boolean(lookupError)}
            aria-describedby={lookupError ? `${id}-lookup-error` : undefined}
            onChange={(event) => {
              activeRequest.current?.abort(); activeRequest.current = null; operationInProgress.current = false;
              setCurp(event.target.value.toUpperCase().replace(/\s/g, ""));
              setData(null); setSelectedIds([]); setLookupError(""); setSaveError(""); setSaveMessage("");
              setIsLookingUp(false); setIsSaving(false); setIsUploadingProof(false); setMustLookupAgain(false);
              setProofError(""); setProofMessage(""); clearProofFile();
            }} />
        </div>
      </form>
      {lookupError ? <p className="workshop-registration__error" id={`${id}-lookup-error`} role="alert">{lookupError}</p> : null}
      {!data && !lookupError ? (
        <div className="workshop-registration__preview" role="status">
          <ReceiptText size={24} aria-hidden="true" />
          <strong>{isLookingUp ? "Consultando…" : "Sin consulta todavía."}</strong>
          <p>{isLookingUp ? "Buscando tus talleres." : "Ingresa tu CURP para ver los workshops disponibles."}</p>
        </div>
      ) : null}
      {data ? (
        <>
        <form className="workshop-registration__selection" onSubmit={(event) => void save(event)} aria-busy={isSaving}>
          <header className="workshop-registration__header">
            <h4>Elige tus <span>workshops.</span></h4>
          </header>
          <div className="workshop-registration__participant">
            <div><strong>{data.participant.name}</strong><span>{data.participant.academyName}</span></div>
            <p>{data.participant.age === null ? "Fecha de nacimiento pendiente" : `${data.participant.age} años al ${eventDate(data.event.date)}`}</p>
          </div>
          {!data.eligible ? <p className="workshop-registration__error" role="status">{data.eligibilityReason || "Tu registro aún no está habilitado para elegir workshops."}</p> : null}
          {proofPending ? <p className="workshop-registration__hint" role="status">Tu comprobante está en revisión. Podrás cambiar los talleres cuando termine la revisión.</p> : null}
          <p className="workshop-registration__hint">{maximumSelection > 0 ? `Elige de 1 a ${maximumSelection} workshops. ` : ""}Puedes combinar Aerial y Motion; se realizan en sedes distintas.</p>
          <div className="workshop-registration__tracks">
            {tracks.map((trackId) => {
              const sessions = eligibleSessions.filter((session) => session.trackId === trackId);
              return (
                <fieldset className="workshop-registration__track" key={trackId}>
                  <legend>{trackId === "aerial" ? "Aerial" : trackId === "motion" ? "Motion" : trackId}</legend>
                  <p className="workshop-registration__venue">{sessions[0]?.venue}</p>
                  {sessions.map((session) => {
                    const checked = selectedIds.includes(session.id);
                    const saved = savedIds.includes(session.id);
                    const unavailable = !saved && session.capacity !== null && (session.available === null || session.available <= 0);
                    const disabled = busy || proofPending || !data.eligible || mustLookupAgain || unavailable || (!checked && selectedIds.length >= maximumSelection);
                    return (
                      <label className={`workshop-registration__option${checked ? " is-selected" : ""}${unavailable ? " is-unavailable" : ""}`} key={session.id}>
                        <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => toggleSession(session.id, event.target.checked)} />
                        <span className="workshop-registration__check" aria-hidden="true"><Check size={14} strokeWidth={2.5} /></span>
                        <span className="workshop-registration__option-content">
                          <strong>{session.title}</strong><span>{session.coach}</span>
                          <span className="workshop-registration__option-meta">
                            <span className="workshop-registration__time"><Clock3 size={14} aria-hidden="true" />{formatWorkshopTime(session.start)} – {formatWorkshopTime(session.end)}</span>
                            <small>{availability(session, saved)}</small>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>
          {eligibleSessions.length === 0 ? <p className="workshop-registration__hint">No hay workshops disponibles para este registro.</p> : null}
          <div className="workshop-registration__summary" aria-live="polite">
            <div><strong>{selectedIds.length} seleccionados</strong><span>{Math.min(selectedIds.length, data.event.includedCount)} incluidos · {extraCount} {extraCount === 1 ? "adicional" : "adicionales"}</span></div>
            <div className="workshop-registration__total"><span>Total adicional</span><strong>{money(amountDue, data.event.currency)} <small>{data.event.currency}</small></strong></div>
            {paidAmount > 0 ? <p>Pago registrado: {money(paidAmount, data.event.currency)}. Saldo pendiente: {money(balance, data.event.currency)}.</p> : null}
          </div>
          {saveError ? <p className="workshop-registration__error" role="alert">{saveError}</p> : null}
          <div className="workshop-registration__actions">
            <button type="submit" disabled={busy || proofPending || !data.eligible || mustLookupAgain || !dirty || !selectedIds.length || hasUnavailableSelection}>
              {isSaving ? "Guardando…" : data.enrollment ? "Guardar cambios" : "Guardar selección"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <p className="workshop-registration__saved" role="status">
              {saveMessage ? <><CheckCircle2 size={17} aria-hidden="true" />{saveMessage}</>
                : dirty ? "Cambios sin guardar"
                : data.enrollment ? <><CheckCircle2 size={17} aria-hidden="true" />Selección guardada</> : ""}
            </p>
          </div>
        </form>
        {amountDue > 0 || (enrollment?.amountDue ?? 0) > 0 || latestProof ? (
          <section className="workshop-registration__payment" aria-labelledby={`${id}-payment-title`}>
            <h4 id={`${id}-payment-title`}>Pago de adicionales</h4>
            {dirty ? <p className="workshop-registration__hint">Guarda tu selección para ver el importe y pagar.</p> : mustLookupAgain ? <p className="workshop-registration__hint">Vuelve a consultar tu CURP para verificar el estado del pago.</p> : enrollment ? (
              proofPending ? <div className="workshop-registration__proof-status" role="status">
                <strong>Comprobante en revisión</strong>
                <p>{latestProof?.fileName}</p>
                <p>{money(latestProof?.amount ?? savedBalance, data.event.currency)} {data.event.currency} pendientes de confirmar. No necesitas enviarlo otra vez.</p>
              </div> : savedBalance === 0 ? <p className="workshop-registration__paid" role="status"><CheckCircle2 size={18} aria-hidden="true" />{paidAmount > 0 ? `Pago confirmado: ${money(paidAmount, data.event.currency)} ${data.event.currency}.` : "No hay adicionales por pagar."}</p> : <>
                {latestProof?.status === "rejected" && latestProof.isCurrent ? <div className="workshop-registration__error" role="status">
                  <strong>Comprobante rechazado</strong>
                  {latestProof.notes ? <p>{latestProof.notes}</p> : null}
                  <p>Revisa el motivo y envía un nuevo comprobante.</p>
                </div> : null}
                {paidAmount > 0 ? <p className="workshop-registration__hint">Pago confirmado: {money(paidAmount, data.event.currency)} {data.event.currency}.</p> : null}
                {enrollment.paymentReference ? <>
                  <p className="workshop-registration__transfer-total"><span>{latestProof?.status === "rejected" && latestProof.isCurrent ? "Importe por confirmar" : "Transfiere"}</span><strong>{money(savedBalance, data.event.currency)} <small>{data.event.currency}</small></strong></p>
                  <dl className="workshop-registration__bank">
                    {emiTransferAccount.rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
                    <div><dt>Concepto / referencia</dt><dd>{enrollment.paymentReference}</dd></div>
                  </dl>
                  <form className="workshop-registration__proof-form" onSubmit={(event) => void uploadProof(event)} aria-busy={isUploadingProof}>
                    <label htmlFor={`${id}-proof`}>Comprobante de transferencia</label>
                    <p id={`${id}-proof-help`}>JPG, PNG, WEBP o PDF · Máximo 1.4 MB</p>
                    <input ref={proofInputRef} id={`${id}-proof`} type="file" accept={paymentProofAccept} required disabled={busy || mustLookupAgain}
                      aria-describedby={`${id}-proof-help${proofError ? ` ${id}-proof-error` : ""}`}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        const invalid = file ? proofFileError(file) : "";
                        setProofError(invalid); setProofMessage(""); setProofFile(invalid ? null : file);
                        if (invalid) event.target.value = "";
                      }} />
                    <button type="submit" disabled={busy || mustLookupAgain || !proofFile}><UploadCloud size={18} aria-hidden="true" />{isUploadingProof ? "Enviando…" : "Enviar comprobante"}</button>
                    <p>Confirmaremos el pago después de revisar tu comprobante.</p>
                  </form>
                </> : <p className="workshop-registration__error" role="status">No se pudo obtener la referencia. Vuelve a consultar tu CURP antes de pagar.</p>}
              </>
            ) : null}
          </section>
        ) : null}
        {proofError ? <p className="workshop-registration__error" id={`${id}-proof-error`} role="alert">{proofError}</p> : null}
        {proofMessage ? <p className="workshop-registration__saved workshop-registration__proof-message" role="status"><CheckCircle2 size={17} aria-hidden="true" />{proofMessage}</p> : null}
        </>
      ) : null}
    </section>
  );
}
