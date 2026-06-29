import {
  ArrowRight,
  Award,
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileDown,
  Gift,
  KeyRound,
  Map,
  MessageCircle,
  QrCode,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  getPassportStationBySlug,
  getPassportStationPath,
  passportPilotEvent,
  type PassportStation,
} from "../../data/passportContent";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type PassportClaimPageProps = {
  token: string | null;
};

type PassportStationPageProps = {
  eventSlug: string;
  stationSlug: string;
};

type PassportApiStation = PassportStation & {
  id?: string;
  completed?: boolean;
  scannedAt?: string | null;
};

type PassportApiState = {
  event: {
    slug: string;
    title: string;
    city: string;
    date: string | null;
    passportName: string;
  };
  passport: {
    id: string;
    code: string;
    status: string;
    participantName: string | null;
    academy: string | null;
    category: string | null;
    contact: string | null;
    claimedAt: string | null;
  };
  stations: PassportApiStation[];
  progress: {
    completed: number;
    total: number;
    isComplete: boolean;
  };
};

type PassportAdminSummary = {
  event: {
    slug: string;
    title: string;
    city: string;
    date: string | null;
    passportName: string;
  };
  totals: {
    passports: number;
    claimed: number;
    available: number;
    disabled: number;
    scans: number;
    completed: number;
    stations: number;
  };
  stations: Array<{
    id: string;
    slug: string;
    order: number;
    title: string;
    shortTitle: string;
    scans: number;
  }>;
  recentPassports: Array<{
    code: string;
    status: string;
    participantName: string | null;
    academy: string | null;
    category: string | null;
    contact: string | null;
    claimedAt: string | null;
    completedStations: number;
    totalStations: number;
  }>;
  recentScans: Array<{
    passportCode: string;
    participantName: string | null;
    stationTitle: string;
    stationSlug: string;
    scannedAt: string | null;
  }>;
};

type PassportRecoverResponse = {
  status: "available" | "claimed";
  state: PassportApiState | null;
};

const stationIcons = {
  bienvenida: Map,
  backstage: ClipboardCheck,
  "photo-spot": Camera,
  "sponsor-zone": Gift,
  feedback: MessageCircle,
} satisfies Record<string, LucideIcon>;

const passportAdminTokenStorageKey = "levitate-passport-admin-token";

function PassportShell({ children }: { children: ReactNode }) {
  return <main className="passport-page">{children}</main>;
}

function PassportHero({ children }: { children: ReactNode }) {
  return (
    <section className="passport-hero">
      <LevitateHeader activeLabel="Inicio" useRootLinks />
      <div className="passport-hero__content">{children}</div>
    </section>
  );
}

async function requestPassportApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || "No pudimos completar la acción";
    throw new Error(message);
  }

  return payload as T;
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "No pudimos completar la acción";

  if (message.includes("DATABASE_URL") || message.includes("POSTGRES_URL")) {
    return "El Pasaporte Colibrí todavía no está conectado a la base de datos.";
  }

  return message;
}

function formatPassportDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function svgText(value: string | null | undefined) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function downloadFile(filename: string, blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function downloadPassportCertificate(passportState: PassportApiState) {
  const participantName = passportState.passport.participantName || "Participante Levitate";
  const academy = passportState.passport.academy || "Levitate MX";
  const eventTitle = passportState.event.title;
  const code = passportState.passport.code;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#050505"/>
      <stop offset="0.48" stop-color="#16070f"/>
      <stop offset="1" stop-color="#050505"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <rect x="66" y="66" width="948" height="1218" rx="34" fill="none" stroke="#e74697" stroke-width="6"/>
  <text x="540" y="194" text-anchor="middle" fill="#e74697" font-family="Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="9">PASAPORTE COLIBRI</text>
  <text x="540" y="428" text-anchor="middle" fill="#fffaf4" font-family="Arial Black, Arial, sans-serif" font-size="104" font-weight="900">COMPLETE</text>
  <text x="540" y="542" text-anchor="middle" fill="#e74697" font-family="Arial Black, Arial, sans-serif" font-size="108" font-weight="900">MI VUELO</text>
  <text x="540" y="688" text-anchor="middle" fill="#fffaf4" font-family="Arial, sans-serif" font-size="44" font-weight="700">${svgText(participantName)}</text>
  <text x="540" y="752" text-anchor="middle" fill="#cfc5ca" font-family="Arial, sans-serif" font-size="30" font-weight="500">${svgText(academy)}</text>
  <text x="540" y="895" text-anchor="middle" fill="#fffaf4" font-family="Arial, sans-serif" font-size="38" font-weight="800">Completé mi vuelo en Levitate MX.</text>
  <text x="540" y="970" text-anchor="middle" fill="#cfc5ca" font-family="Arial, sans-serif" font-size="30">${svgText(eventTitle)} · ${svgText(code)}</text>
  <rect x="396" y="1082" width="288" height="8" rx="4" fill="#e74697"/>
  <text x="540" y="1188" text-anchor="middle" fill="#fffaf4" font-family="Arial Black, Arial, sans-serif" font-size="72" font-weight="900">LEVITATE MX</text>
</svg>`;

  downloadFile(`certificado-${code.toLowerCase()}.svg`, new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
}

function StationSeal({
  station,
  isActive = false,
  isComplete = false,
}: {
  station: PassportApiStation;
  isActive?: boolean;
  isComplete?: boolean;
}) {
  const Icon = stationIcons[station.slug as keyof typeof stationIcons] ?? CheckCircle2;

  return (
    <article className={`passport-seal${isActive ? " is-active" : ""}${isComplete ? " is-complete" : ""}`}>
      <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
      <span>{String(station.order).padStart(2, "0")}</span>
      <strong>{station.shortTitle}</strong>
    </article>
  );
}

function PassportNotFoundPage() {
  return (
    <PassportShell>
      <PassportHero>
        <p className="passport-kicker">Pasaporte Colibrí</p>
        <h1>Estación no encontrada</h1>
        <strong>El vuelo sigue en otra ruta.</strong>
        <p>Revisa el código del QR/NFC o vuelve a tu pasaporte para continuar el recorrido.</p>
        <a className="passport-button" href="/passport">
          Ver mi pasaporte <ArrowRight aria-hidden="true" size={18} />
        </a>
      </PassportHero>
      <LevitateFooter useRootLinks />
    </PassportShell>
  );
}

export function PassportClaimPage({ token }: PassportClaimPageProps) {
  const [claimError, setClaimError] = useState("");
  const [claimMode, setClaimMode] = useState<"checking" | "available" | "restored">(token ? "checking" : "available");
  const [recoveredState, setRecoveredState] = useState<PassportApiState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canClaim = Boolean(token) && claimMode === "available";

  useEffect(() => {
    if (!token) {
      setClaimMode("available");
      return;
    }

    let isMounted = true;
    setClaimMode("checking");
    setClaimError("");

    requestPassportApi<PassportRecoverResponse>("/api/passport/recover", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        if (payload.status === "claimed" && payload.state) {
          setRecoveredState(payload.state);
          setClaimMode("restored");
          window.setTimeout(() => {
            window.location.assign("/passport");
          }, 900);
          return;
        }

        setClaimMode("available");
      })
      .catch((error) => {
        if (isMounted) {
          setClaimMode("available");
          setClaimError(getErrorMessage(error));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClaimError("");

    if (!token) {
      setClaimError("Escanea el QR/NFC de tu pasaporte para activarlo.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);

    try {
      await requestPassportApi<PassportApiState>("/api/passport/claim", {
        method: "POST",
        body: JSON.stringify({
          token,
          name: String(formData.get("name") || ""),
          academy: String(formData.get("academy") || ""),
          category: String(formData.get("category") || ""),
          contact: String(formData.get("contact") || ""),
        }),
      });
      window.location.assign("/passport");
    } catch (error) {
      setClaimError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PassportShell>
      <PassportHero>
        <div className="passport-hero__copy">
          <p className="passport-kicker">{passportPilotEvent.passportName}</p>
          <h1>
            Activa tu <span>vuelo</span>
          </h1>
          <strong>{passportPilotEvent.title}</strong>
          <p>
            Reclama tu pasaporte digital para desbloquear sellos, beneficios y tu certificado al completar las estaciones.
          </p>
        </div>

        <form
          className="passport-claim"
          onSubmit={handleSubmit}
        >
          <div className="passport-claim__status">
            <QrCode aria-hidden="true" size={28} />
            <div>
              <span>
                {claimMode === "checking"
                  ? "Buscando pasaporte"
                  : claimMode === "restored"
                    ? "Pasaporte encontrado"
                    : token
                      ? "Código detectado"
                      : "Código pendiente"}
              </span>
              <strong>
                {claimMode === "checking"
                  ? "Validando QR/NFC personal"
                  : claimMode === "restored"
                    ? `${recoveredState?.passport.participantName || recoveredState?.passport.code || "Tu pasaporte"}, retomando vuelo...`
                    : token
                      ? "Pasaporte listo para reclamar"
                      : "Escanea tu QR/NFC personal"}
              </strong>
            </div>
          </div>

          {claimMode === "restored" ? (
            <div className="passport-recovery">
              <CheckCircle2 aria-hidden="true" size={28} />
              <div>
                <strong>Sesión recuperada</strong>
                <p>
                  No necesitas registrarte otra vez. Este QR/NFC ya está ligado al pasaporte{" "}
                  {recoveredState?.passport.code ?? "Colibrí"}.
                </p>
              </div>
            </div>
          ) : (
            <>
              <label>
                <span>Nombre o nickname</span>
                <input disabled={claimMode === "checking"} name="name" placeholder="Tu nombre" required />
              </label>
              <label>
                <span>Academia</span>
                <input disabled={claimMode === "checking"} name="academy" placeholder="Nombre de tu academia" required />
              </label>
              <label>
                <span>Categoría</span>
                <input disabled={claimMode === "checking"} name="category" placeholder="Opcional" />
              </label>
              <label>
                <span>Email o WhatsApp</span>
                <input disabled={claimMode === "checking"} name="contact" placeholder="Opcional para recuperar tu pasaporte" />
              </label>
            </>
          )}

          {claimError ? <p className="passport-form-error">{claimError}</p> : null}

          {claimMode === "restored" ? (
            <a className="passport-button passport-button--full" href="/passport">
              Ir a mi pasaporte <ArrowRight aria-hidden="true" size={18} />
            </a>
          ) : (
            <button className="passport-button passport-button--full" disabled={!canClaim || isSubmitting} type="submit">
              {claimMode === "checking" ? "Validando..." : isSubmitting ? "Activando..." : "Activar pasaporte"}{" "}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          )}
        </form>
      </PassportHero>
      <LevitateFooter useRootLinks />
    </PassportShell>
  );
}

export function PassportOverviewPage() {
  const firstStation = passportPilotEvent.stations[0];
  const [passportState, setPassportState] = useState<PassportApiState | null>(null);
  const [passportError, setPassportError] = useState("");
  const progress = passportState?.progress ?? { completed: 0, total: passportPilotEvent.stations.length, isComplete: false };
  const stations: PassportApiStation[] = passportState?.stations ?? passportPilotEvent.stations;
  const event = passportState?.event ?? passportPilotEvent;

  useEffect(() => {
    let isMounted = true;

    requestPassportApi<PassportApiState>("/api/passport/me")
      .then((state) => {
        if (isMounted) {
          setPassportState(state);
          setPassportError("");
        }
      })
      .catch((error) => {
        if (isMounted) {
          setPassportError(getErrorMessage(error));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <PassportShell>
      <PassportHero>
        <div className="passport-hero__copy">
          <p className="passport-kicker">{event.passportName}</p>
          <h1>
            Mi <span>pasaporte</span>
          </h1>
          <strong>{event.date}</strong>
          <p>
            {passportState?.passport.participantName
              ? `${passportState.passport.participantName}, completa las estaciones del venue y reúne tus aleteos.`
              : "Completa las estaciones del venue y reúne tus aleteos para desbloquear tu certificado digital."}
          </p>
          <div className="passport-actions">
            <a className="passport-button" href={getPassportStationPath(passportPilotEvent.slug, firstStation.slug)}>
              Abrir primera estación <ArrowRight aria-hidden="true" size={18} />
            </a>
            {!passportState ? (
              <a className="passport-button passport-button--ghost" href={passportPilotEvent.claimPath}>
                Activar demo <QrCode aria-hidden="true" size={18} />
              </a>
            ) : null}
            <a className="passport-button passport-button--ghost" href="/passport/certificate">
              Ver certificado <Award aria-hidden="true" size={18} />
            </a>
          </div>
        </div>

        <aside className="passport-card" aria-label="Progreso del Pasaporte Colibrí">
          <div className="passport-card__topline">
            <Sparkles aria-hidden="true" size={24} />
            <span>{event.city}</span>
          </div>
          <strong>{progress.completed}/{progress.total} aleteos</strong>
          <p>{passportError || "Los sellos aparecerán aquí conforme recorras las estaciones."}</p>
          <div className="passport-seal-grid">
            {stations.map((station) => (
              <StationSeal isComplete={Boolean(station.completed)} key={station.slug} station={station} />
            ))}
          </div>
        </aside>
      </PassportHero>
      <LevitateFooter useRootLinks />
    </PassportShell>
  );
}

export function PassportStationPage({ eventSlug, stationSlug }: PassportStationPageProps) {
  const result = getPassportStationBySlug(eventSlug, stationSlug);
  const [scanState, setScanState] = useState<PassportApiState | null>(null);
  const [scanError, setScanError] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!result) {
      return;
    }

    let isMounted = true;
    setIsScanning(true);

    requestPassportApi<{ state: PassportApiState }>("/api/passport/scan", {
      method: "POST",
      body: JSON.stringify({ eventSlug, stationSlug }),
    })
      .then((payload) => {
        if (isMounted) {
          setScanState(payload.state);
          setScanError("");
        }
      })
      .catch((error) => {
        if (isMounted) {
          setScanError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsScanning(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [eventSlug, stationSlug]);

  if (!result) {
    return <PassportNotFoundPage />;
  }

  const { event, station } = result;
  const Icon = stationIcons[station.slug as keyof typeof stationIcons] ?? CheckCircle2;
  const stationList: PassportApiStation[] = scanState?.stations ?? event.stations;

  return (
    <PassportShell>
      <PassportHero>
        <div className="passport-hero__copy">
          <p className="passport-kicker">{event.passportName}</p>
          <h1>
            Sello <span>{String(station.order).padStart(2, "0")}</span>
          </h1>
          <strong>{station.title}</strong>
          <p>{station.description}</p>
          {scanError ? <p className="passport-status-note">{scanError}</p> : null}
          <div className="passport-actions">
            {scanError ? (
              <a className="passport-button passport-button--ghost" href={passportPilotEvent.claimPath}>
                Activar demo <QrCode aria-hidden="true" size={18} />
              </a>
            ) : null}
            <a className="passport-button" href="/passport">
              Ver progreso <ArrowRight aria-hidden="true" size={18} />
            </a>
          </div>
        </div>

        <aside className="passport-station-card" aria-label={`Sello ${station.title}`}>
          <div className="passport-station-card__icon">
            <Icon aria-hidden="true" size={42} strokeWidth={1.55} />
          </div>
          <span>{station.stampLabel}</span>
          <strong>{isScanning ? "Registrando sello..." : scanError ? "Activa tu pasaporte" : "Sello desbloqueado"}</strong>
          <ul>
            {station.highlights.map((item) => (
              <li key={item}>
                <CheckCircle2 aria-hidden="true" size={17} />
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </PassportHero>
      <section className="passport-section" aria-label="Estaciones del evento">
        <div className="passport-section__heading">
          <span />
          <h2>Estaciones del vuelo</h2>
          <span />
        </div>
        <div className="passport-seal-grid passport-seal-grid--wide">
          {stationList.map((item) => (
            <StationSeal
              isActive={item.slug === station.slug}
              isComplete={Boolean(item.completed) || item.slug === station.slug}
              key={item.slug}
              station={item}
            />
          ))}
        </div>
      </section>
      <LevitateFooter useRootLinks />
    </PassportShell>
  );
}

export function PassportCertificatePage() {
  const [passportState, setPassportState] = useState<PassportApiState | null>(null);
  const [certificateError, setCertificateError] = useState("");

  useEffect(() => {
    let isMounted = true;

    requestPassportApi<PassportApiState>("/api/passport/me")
      .then((state) => {
        if (isMounted) {
          setPassportState(state);
          setCertificateError("");
        }
      })
      .catch((error) => {
        if (isMounted) {
          setPassportState(null);
          setCertificateError(getErrorMessage(error));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const progress = passportState?.progress ?? { completed: 0, total: passportPilotEvent.stations.length, isComplete: false };
  const isComplete = Boolean(passportState?.progress.isComplete);
  const participantName = passportState?.passport.participantName || "Participante Levitate";
  const eventTitle = passportState?.event.title ?? passportPilotEvent.title;

  return (
    <PassportShell>
      <PassportHero>
        <div className="passport-hero__copy">
          <p className="passport-kicker">{passportPilotEvent.passportName}</p>
          <h1>
            Certificado <span>Colibrí</span>
          </h1>
          <strong>{isComplete ? "Completé mi vuelo en Levitate MX." : "Tu certificado está casi listo."}</strong>
          <p>
            {isComplete
              ? "Tu vuelo ya tiene todos los sellos. Descarga tu certificado digital para compartirlo."
              : `${progress.completed}/${progress.total} aleteos completados. Reúne todos los sellos para desbloquear la descarga.`}
          </p>
          {certificateError ? <p className="passport-status-note">{certificateError}</p> : null}
          <div className="passport-actions">
            {isComplete && passportState ? (
              <button className="passport-button" onClick={() => downloadPassportCertificate(passportState)} type="button">
                Descargar sticker <Download aria-hidden="true" size={18} />
              </button>
            ) : null}
            <a className="passport-button passport-button--ghost" href="/passport">
              Volver al pasaporte <ArrowRight aria-hidden="true" size={18} />
            </a>
          </div>
        </div>

        <aside className={`passport-certificate${isComplete ? " is-complete" : " is-locked"}`} aria-label="Certificado digital">
          <span>Levitate MX</span>
          <strong>{isComplete ? "Completé mi vuelo" : "Sigue volando"}</strong>
          <p>{eventTitle}</p>
          <small>{isComplete ? participantName : `${progress.completed}/${progress.total} aleteos`}</small>
          <i aria-hidden="true" />
        </aside>
      </PassportHero>
      <LevitateFooter useRootLinks />
    </PassportShell>
  );
}

function PassportAdminMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <article className="passport-admin-metric">
      <Icon aria-hidden="true" size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function PassportAdminPage() {
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(passportAdminTokenStorageKey) || "";
  });
  const [tokenInput, setTokenInput] = useState(adminToken);
  const [summary, setSummary] = useState<PassportAdminSummary | null>(null);
  const [adminError, setAdminError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function loadAdminSummary(token = adminToken) {
    setIsLoading(true);
    setAdminError("");

    try {
      const payload = await requestPassportApi<PassportAdminSummary>(
        `/api/passport/admin/summary?eventSlug=${encodeURIComponent(passportPilotEvent.slug)}`,
        {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        },
      );
      setSummary(payload);
    } catch (error) {
      setAdminError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!adminToken && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return;
    }

    loadAdminSummary(adminToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTokenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    setAdminToken(nextToken);

    if (typeof window !== "undefined") {
      if (nextToken) {
        window.localStorage.setItem(passportAdminTokenStorageKey, nextToken);
      } else {
        window.localStorage.removeItem(passportAdminTokenStorageKey);
      }
    }

    loadAdminSummary(nextToken);
  }

  async function handleExportCsv() {
    setIsExporting(true);
    setAdminError("");

    try {
      const response = await fetch(
        `/api/passport/admin/export.csv?eventSlug=${encodeURIComponent(passportPilotEvent.slug)}`,
        {
          credentials: "same-origin",
          headers: adminToken ? { authorization: `Bearer ${adminToken}` } : {},
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message || "No pudimos exportar el CSV");
      }

      const blob = await response.blob();
      downloadFile(`${passportPilotEvent.slug}-pasaportes.csv`, blob);
    } catch (error) {
      setAdminError(getErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }

  const totals = summary?.totals;

  return (
    <main className="levitate-admin-page passport-admin-page">
      <header className="levitate-admin-topbar">
        <div className="levitate-admin-logo" aria-label="Levitate MX">
          <span>Levitate</span>
          <small>MX</small>
        </div>
        <a className="passport-admin-back" href="/passport">
          Pasaporte
        </a>
      </header>
      <div className="levitate-admin-rule" aria-hidden="true" />

      <div className="levitate-admin-page__body passport-admin-body">
        <section className="levitate-admin-panel passport-admin-panel">
          <div className="levitate-admin-panel__heading">
            <p>Pasaporte Colibrí</p>
            <h1>Control de vuelo</h1>
          </div>

          <form className="passport-admin-token" onSubmit={handleTokenSubmit}>
            <label>
              <span>
                <KeyRound aria-hidden="true" size={17} />
                Token admin
              </span>
              <input
                autoComplete="off"
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="PASSPORT_ADMIN_TOKEN"
                type="password"
                value={tokenInput}
              />
            </label>
            <button className="levitate-admin-save" disabled={isLoading} type="submit">
              <ShieldCheck aria-hidden="true" size={18} />
              {isLoading ? "Cargando" : "Cargar panel"}
            </button>
            <button className="levitate-admin-save passport-admin-secondary" disabled={isLoading} onClick={() => loadAdminSummary()} type="button">
              <RefreshCcw aria-hidden="true" size={18} />
              Actualizar
            </button>
          </form>

          {adminError ? <p className="passport-admin-alert">{adminError}</p> : null}

          <div className="passport-admin-metrics">
            <PassportAdminMetric icon={TicketCheck} label="Pasaportes" value={totals?.passports ?? "—"} />
            <PassportAdminMetric icon={Users} label="Activados" value={totals?.claimed ?? "—"} />
            <PassportAdminMetric icon={Sparkles} label="Vuelos completos" value={totals?.completed ?? "—"} />
            <PassportAdminMetric icon={BarChart3} label="Escaneos" value={totals?.scans ?? "—"} />
          </div>

          <div className="passport-admin-actions">
            <div>
              <span>{summary?.event.city ?? passportPilotEvent.city}</span>
              <strong>{summary?.event.title ?? passportPilotEvent.title}</strong>
            </div>
            <button className="passport-button" disabled={!summary || isExporting} onClick={handleExportCsv} type="button">
              {isExporting ? "Exportando..." : "Exportar CSV"} <FileDown aria-hidden="true" size={18} />
            </button>
          </div>
        </section>

        <section className="levitate-admin-panel passport-admin-panel">
          <div className="levitate-admin-panel__heading">
            <p>Estaciones</p>
            <h2>Sellos del evento</h2>
          </div>
          <div className="passport-admin-stations">
            {(summary?.stations ?? []).map((station) => (
              <article key={station.id}>
                <span>{String(station.order).padStart(2, "0")}</span>
                <strong>{station.shortTitle}</strong>
                <p>{station.scans} escaneos</p>
              </article>
            ))}
            {!summary ? (
              <article>
                <span>DB</span>
                <strong>Esperando datos</strong>
                <p>Carga el panel para ver actividad real.</p>
              </article>
            ) : null}
          </div>
        </section>

        <section className="levitate-admin-panel passport-admin-panel">
          <div className="levitate-admin-panel__heading">
            <p>Actividad</p>
            <h2>Pasaportes recientes</h2>
          </div>
          <div className="passport-admin-table" role="table" aria-label="Pasaportes recientes">
            <div role="row">
              <span role="columnheader">Código</span>
              <span role="columnheader">Participante</span>
              <span role="columnheader">Academia</span>
              <span role="columnheader">Progreso</span>
            </div>
            {(summary?.recentPassports ?? []).map((passport) => (
              <div role="row" key={passport.code}>
                <span role="cell">{passport.code}</span>
                <span role="cell">{passport.participantName || passport.status}</span>
                <span role="cell">{passport.academy || "—"}</span>
                <span role="cell">
                  {passport.completedStations}/{passport.totalStations}
                </span>
              </div>
            ))}
            {summary && summary.recentPassports.length === 0 ? (
              <p className="passport-admin-empty">Todavía no hay pasaportes generados para este evento.</p>
            ) : null}
          </div>
        </section>

        <section className="levitate-admin-panel passport-admin-panel">
          <div className="levitate-admin-panel__heading">
            <p>Check-ins</p>
            <h2>Últimos escaneos</h2>
          </div>
          <div className="passport-admin-scans">
            {(summary?.recentScans ?? []).map((scan) => (
              <article key={`${scan.passportCode}-${scan.stationSlug}-${scan.scannedAt}`}>
                <Database aria-hidden="true" size={18} />
                <div>
                  <strong>{scan.stationTitle}</strong>
                  <p>
                    {scan.passportCode} · {scan.participantName || "Sin nombre"} · {formatPassportDate(scan.scannedAt)}
                  </p>
                </div>
              </article>
            ))}
            {summary && summary.recentScans.length === 0 ? (
              <p className="passport-admin-empty">Todavía no hay escaneos registrados.</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
