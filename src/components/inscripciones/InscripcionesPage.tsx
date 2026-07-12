import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Landmark,
  LockKeyhole,
  ReceiptText,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type RegistrationPath = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  href: string;
};

type InscriptionCost = {
  category: string;
  categoryLines?: string[];
  presale: string;
  normal: string;
};

type InscriptionLookupRecord = {
  id: string;
  fullName: string;
  curp: string;
  academyName: string;
  venue: string;
  division?: string | null;
  shirtSize?: string | null;
};

type InscriptionLookupLine = {
  id: string;
  title: string;
  genre: string;
  subgenre: string;
  category: string;
  level?: string | null;
  venue: string;
  academyName: string;
  baseAmount?: number;
  discountAmount?: number;
  discountRate?: number;
  pricingPosition?: number;
  amount: number;
};

type InscriptionOrderStatus = "pending_payment" | "payment_reported" | "paid" | "rejected";

type InscriptionPaymentProof = {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  dataUrl: string;
  status: string;
  uploadedAt: string;
};

type InscriptionOrder = {
  id: string;
  curp: string;
  participantName: string;
  academyId?: string | null;
  academyName: string;
  venue: string;
  reference: string;
  amount: number;
  paidAmount: number;
  status: InscriptionOrderStatus;
  paymentMethod: string;
  notes?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  proof?: InscriptionPaymentProof | null;
};

type InscriptionLookup = {
  curp: string;
  participantName: string;
  academyName: string;
  venue: string;
  reference: string;
  registrations: InscriptionLookupRecord[];
  lines: InscriptionLookupLine[];
  subtotal: number;
  order?: InscriptionOrder | null;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

const consultationPath = "/inscripciones/consulta-curp";
const demoCurp = "DEMO010101MDFLVT09";
const proofUploadAccept = "image/jpeg,image/png,image/webp,application/pdf";
const maxProofUploadBytes = 1800000;

const registrationPaths: RegistrationPath[] = [
  {
    eyebrow: "Academias",
    title: "Registra tu academia, alumnos y coreografías.",
    description: "Para poder hacer el pago de la inscripción es necesario registrarse primero.",
    action: "Registrar alumnos",
    href: "/registro/academias",
  },
  {
    eyebrow: "Familias y tutores",
    title: "Realiza el pago de la inscripción.",
    description: "Para padres y madres de familia o tutores: pago asociado al CURP del participante.",
    action: "Pagar inscripción",
    href: consultationPath,
  },
];

const inscriptionCosts: InscriptionCost[] = [
  { category: "Solo", presale: "$1,500 MXN", normal: "$1,750 MXN" },
  { category: "Dúo", presale: "$1,300 MXN", normal: "$1,400 MXN" },
  { category: "Trío", presale: "$950 MXN", normal: "$1,200 MXN" },
  { category: "Grupo", presale: "$800 MXN", normal: "$1,000 MXN" },
  { category: "Maestros Relevé", categoryLines: ["Maestros", "Relevé"], presale: "$1,000 MXN", normal: "$1,500 MXN" },
];

const inscriptionIncludes = [
  "Acceso a 3 talleres de la elección del participante",
  "Kit de bienvenida Oficial LevitateMX",
];

const demoInscriptionLookup: InscriptionLookup = {
  curp: demoCurp,
  participantName: "Sofía Martínez Demo",
  academyName: "Academia Demo Levitate",
  venue: "edomex",
  reference: "LEV-EDOMEX-DEMO-VT09",
  registrations: [
    {
      id: "demo-participant",
      fullName: "Sofía Martínez Demo",
      curp: demoCurp,
      academyName: "Academia Demo Levitate",
      venue: "edomex",
      division: "teen",
      shirtSize: "m",
    },
  ],
  lines: [
    {
      id: "demo-aerial",
      title: "Demo Aerial Solo",
      genre: "aereo",
      subgenre: "tela",
      category: "solo",
      level: "principiante",
      venue: "edomex",
      academyName: "Academia Demo Levitate",
      baseAmount: 1500,
      discountAmount: 0,
      discountRate: 0,
      pricingPosition: 1,
      amount: 1500,
    },
    {
      id: "demo-motion",
      title: "Demo Motion Crew",
      genre: "motion",
      subgenre: "jazz",
      category: "grupo",
      level: null,
      venue: "edomex",
      academyName: "Academia Demo Levitate",
      baseAmount: 800,
      discountAmount: 400,
      discountRate: 0.5,
      pricingPosition: 2,
      amount: 400,
    },
  ],
  subtotal: 1900,
  order: null,
};

const bankTransferRows = [
  { label: "Beneficiario", value: "Levitate MX" },
  { label: "Banco", value: "BBVA" },
  { label: "CLABE", value: "012 180 00000000000 0" },
  { label: "Cuenta", value: "0000 0000 0000" },
];

const genreLabels: Record<string, string> = {
  aereo: "Aerial",
  motion: "Motion",
};

const subgenreLabels: Record<string, string> = {
  acrojazz: "ACROJAZZ",
  aro: "ARO",
  ballet: "BALLET",
  belly_dance: "BELLY DANCE",
  contemporaneo: "CONTEMPORÁNEO",
  folklore: "FOLKLORE",
  jazz: "JAZZ",
  lirico: "LÍRICO",
  open_aerial: "OPEN: AERIAL",
  open_motion: "OPEN: MOTION",
  tela: "TELA",
  trapecio: "TRAPECIO",
  urbanos: "URBANOS",
};

const categoryLabels: Record<string, string> = {
  duo: "Dúo",
  grupo: "Grupo",
  solo: "Solo",
  trio: "Trío",
};

const levelLabels: Record<string, string> = {
  avanzado: "Avanzado",
  elite: "Élite",
  intermedio: "Intermedio",
  nudo: "Nudo",
  principiante: "Principiante",
};

const venueLabels: Record<string, string> = {
  cdmx: "CDMX",
  edomex: "Estado de México",
  puebla: "Puebla",
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 0,
  style: "currency",
});

const orderStatusLabels: Record<InscriptionOrderStatus, string> = {
  paid: "Pagada",
  payment_reported: "Pago reportado",
  pending_payment: "Pendiente de pago",
  rejected: "Rechazada",
};

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function normalizeCurp(value: string) {
  return value.replace(/\s+/g, "").toUpperCase().slice(0, 18);
}

function getVenueLabel(venue?: string | null) {
  return venue ? venueLabels[venue] ?? venue : "Pendiente";
}

function getLineTitle(line: InscriptionLookupLine) {
  return line.title || subgenreLabels[line.subgenre] || genreLabels[line.genre] || "Inscripción";
}

function getLineMeta(line: InscriptionLookupLine) {
  const parts = [
    genreLabels[line.genre] ?? line.genre,
    subgenreLabels[line.subgenre] ?? line.subgenre,
    categoryLabels[line.category] ?? line.category,
  ];

  if (line.level) {
    parts.push(levelLabels[line.level] ?? line.level);
  }

  return parts.join(" · ");
}

function getOrderStatusLabel(status?: string | null) {
  return status && status in orderStatusLabels ? orderStatusLabels[status as InscriptionOrderStatus] : "Sin generar";
}

function formatProofSize(bytes: number) {
  if (bytes >= 1000000) {
    return `${(bytes / 1000000).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("No pudimos leer el archivo.")));
    reader.readAsDataURL(file);
  });
}

function resetLookupScroll() {
  if (typeof window === "undefined") {
    return;
  }

  window.requestAnimationFrame(() => {
    window.scrollTo({ behavior: "auto", left: 0, top: 0 });
  });
}

function buildDemoInscriptionOrder(lookup: InscriptionLookup): InscriptionOrder {
  const now = new Date().toISOString();

  return {
    id: "demo-inscription-order",
    curp: lookup.curp,
    participantName: lookup.participantName,
    academyId: "demo-academy",
    academyName: lookup.academyName,
    venue: lookup.venue,
    reference: lookup.reference,
    amount: lookup.subtotal,
    paidAmount: 0,
    status: "pending_payment",
    paymentMethod: "bank_transfer",
    notes: null,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
    proof: null,
  };
}

export function InscripcionesPage() {
  return (
    <main className="levitate-home-redesign inscripciones-page">
      <section className="inscripciones-hero" id="inicio">
        <div className="inscripciones-hero__backdrop" aria-hidden="true">
          <video autoPlay muted loop playsInline preload="metadata">
            <source src="/assets/levitate-home-hero.mp4" type="video/mp4" />
          </video>
        </div>
        <LevitateHeader activeLabel="Inscripciones" useRootLinks variant="pill" />

        <div className="inscripciones-hero__content">
          <div className="inscripciones-hero__copy">
            <p className="inscripciones-eyebrow">Inscripciones</p>
            <h1>No te pierdas el vuelo.</h1>
            <div className="inscripciones-hero__actions">
              <a className="inscripciones-button inscripciones-button--light" href="/registro/academias">
                Registrar alumnos
                <ArrowRight aria-hidden="true" size={18} />
              </a>
              <a className="inscripciones-button inscripciones-button--dark" href={consultationPath}>
                Pagar inscripción
                <Search aria-hidden="true" size={18} />
              </a>
            </div>
          </div>

        </div>
      </section>

      <section className="inscripciones-pricing" aria-labelledby="inscripciones-pricing-title">
        <div className="inscripciones-section-head">
          <p className="inscripciones-eyebrow">Inscripciones</p>
          <h2 id="inscripciones-pricing-title">Costos Oficiales</h2>
        </div>

        <div className="inscripciones-cost-grid">
          <article className="inscripciones-cost-card">
            <div className="inscripciones-cost-table" aria-label="Costos por categoría">
              <div className="inscripciones-cost-table__head" aria-hidden="true">
                <span>Categoría</span>
                <span>Preventa</span>
                <span>Normal</span>
              </div>
              {inscriptionCosts.map((cost) => (
                <div className="inscripciones-cost-row" key={cost.category}>
                  <strong
                    aria-label={cost.category}
                    className={cost.categoryLines ? "inscripciones-cost-category--stacked" : undefined}
                  >
                    {cost.categoryLines
                      ? cost.categoryLines.map((line) => <span key={line}>{line}</span>)
                      : cost.category}
                  </strong>
                  <span>{cost.presale}</span>
                  <span>{cost.normal}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="inscripciones-cost-card inscripciones-cost-card--info">
            <div>
              <span className="inscripciones-cost-card__eyebrow">Descuento</span>
              <h3>Participaciones adicionales al 50%.</h3>
              <p>
                Si te registras en varias coreografías, el sistema ordenará tus inscripciones de mayor a menor costo. El
                descuento del 50% se aplicará automáticamente a tu <strong>2ª, 4ª y 6ª inscripción</strong>. ¡Así de
                fácil!
              </p>
            </div>

            <div>
              <span className="inscripciones-cost-card__eyebrow">¿Qué incluye la inscripción?</span>
              <ul>
                {inscriptionIncludes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section className="inscripciones-access" aria-label="Accesos de inscripción">
        <div className="inscripciones-choice-grid">
          {registrationPaths.map((path) => (
            <a className="inscripciones-route-card" href={path.href} key={path.title}>
              <span className="inscripciones-route-card__eyebrow">{path.eyebrow}</span>
              <strong>{path.title}</strong>
              <p>{path.description}</p>
              <em>
                {path.action}
                <ArrowRight aria-hidden="true" size={18} />
              </em>
            </a>
          ))}
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}

export function InscripcionesConsultaPage() {
  return (
    <main className="levitate-home-redesign inscripciones-page inscripciones-lookup-page">
      <section className="inscripciones-hero inscripciones-lookup-hero" id="consulta-curp">
        <LevitateHeader activeLabel="Inscripciones" tone="light" useRootLinks variant="pill" />

        <div className="inscripciones-hero__content inscripciones-lookup-hero__content">
          <InscriptionLookupPanel />
        </div>
      </section>

      <LevitateFooter useRootLinks />
    </main>
  );
}

function InscriptionLookupPanel() {
  const [curp, setCurp] = useState("");
  const [lookup, setLookup] = useState<InscriptionLookup | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [proofError, setProofError] = useState("");
  const [proofMessage, setProofMessage] = useState("");
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [isTransferVisible, setIsTransferVisible] = useState(false);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [isProofUploading, setIsProofUploading] = useState(false);
  const visibleLines = lookup?.lines ?? [];
  const visibleSubtotal = lookup?.subtotal ?? 0;
  const visibleOriginalSubtotal = visibleLines.reduce((total, line) => total + (line.baseAmount ?? line.amount), 0);
  const visibleDiscount = Math.max(0, visibleOriginalSubtotal - visibleSubtotal);

  useEffect(() => {
    if (!isTransferVisible) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTransferVisible(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTransferVisible]);

  const handleCurpChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextCurp = normalizeCurp(event.target.value);
    setCurp(nextCurp);
    setLookupError("");
    setOrderError("");
    setProofError("");
    setProofMessage("");
    setSelectedProofFile(null);
    setIsTransferVisible(false);

    if (lookup && lookup.curp !== nextCurp) {
      setLookup(null);
    }
  };

  const handleLookupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedCurp = normalizeCurp(curp);
    setCurp(normalizedCurp);
    setLookupError("");
    setOrderError("");
    setProofError("");
    setProofMessage("");
    setSelectedProofFile(null);
    setIsTransferVisible(false);

    if (normalizedCurp.length !== 18) {
      setLookup(null);
      setLookupError("La CURP debe tener 18 caracteres.");
      return;
    }

    if (normalizedCurp === demoCurp) {
      setLookup(demoInscriptionLookup);
      resetLookupScroll();
      return;
    }

    setIsLookupLoading(true);

    try {
      const response = await fetch("/api/registration/inscription/lookup", {
        body: JSON.stringify({ curp: normalizedCurp }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as InscriptionLookup | ApiErrorResponse | null;

      if (!response.ok) {
        const errorPayload = payload as ApiErrorResponse | null;
        throw new Error(errorPayload?.error?.message ?? "No pudimos consultar esa CURP.");
      }

      if (!payload || !("curp" in payload)) {
        throw new Error("La respuesta de la consulta no fue válida.");
      }

      setLookup(payload);
      setIsTransferVisible(false);
      resetLookupScroll();
    } catch (error) {
      setLookup(null);
      setLookupError(error instanceof Error ? error.message : "No pudimos consultar esa CURP.");
    } finally {
      setIsLookupLoading(false);
    }
  };

  const handleProofFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setProofError("");
    setProofMessage("");

    if (!file) {
      setSelectedProofFile(null);
      return;
    }

    if (file.size > maxProofUploadBytes) {
      setSelectedProofFile(null);
      setProofError("El comprobante debe pesar menos de 1.8 MB.");
      event.target.value = "";
      return;
    }

    if (!proofUploadAccept.split(",").includes(file.type)) {
      setSelectedProofFile(null);
      setProofError("Sube una imagen JPG, PNG, WEBP o un PDF.");
      event.target.value = "";
      return;
    }

    setSelectedProofFile(file);
  };

  const handleProofUpload = async () => {
    if (!lookup?.order || !selectedProofFile) {
      return;
    }

    setProofError("");
    setProofMessage("");
    setIsProofUploading(true);

    try {
      const dataUrl = await readFileAsDataUrl(selectedProofFile);

      if (lookup.curp === demoCurp) {
        const now = new Date().toISOString();
        const proof: InscriptionPaymentProof = {
          id: "demo-payment-proof",
          contentType: selectedProofFile.type,
          dataUrl,
          fileName: selectedProofFile.name,
          fileSize: selectedProofFile.size,
          status: "submitted",
          uploadedAt: now,
        };

        setLookup({
          ...lookup,
          order: {
            ...lookup.order,
            proof,
            status: lookup.order.status === "paid" ? lookup.order.status : "payment_reported",
            updatedAt: now,
          },
        });
        setSelectedProofFile(null);
        setProofMessage("Comprobante demo cargado.");
        return;
      }

      const response = await fetch("/api/registration/inscription/order/proof", {
        body: JSON.stringify({
          contentType: selectedProofFile.type,
          curp: lookup.curp,
          dataUrl,
          fileName: selectedProofFile.name,
          fileSize: selectedProofFile.size,
          orderId: lookup.order.id,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { order?: InscriptionOrder } | ApiErrorResponse | null;

      if (!response.ok) {
        const errorPayload = payload as ApiErrorResponse | null;
        throw new Error(errorPayload?.error?.message ?? "No pudimos subir el comprobante.");
      }

      if (!payload || !("order" in payload) || !payload.order) {
        throw new Error("La respuesta del comprobante no fue válida.");
      }

      setLookup((currentLookup) => (currentLookup ? { ...currentLookup, order: payload.order } : currentLookup));
      setSelectedProofFile(null);
      setProofMessage("Comprobante recibido. Tu orden quedó como pago reportado.");
    } catch (error) {
      setProofError(error instanceof Error ? error.message : "No pudimos subir el comprobante.");
    } finally {
      setIsProofUploading(false);
    }
  };

  const handlePaymentOrder = async () => {
    if (!lookup || visibleSubtotal <= 0) {
      return;
    }

    setOrderError("");

    if (lookup.curp === demoCurp) {
      setLookup({ ...lookup, order: lookup.order ?? buildDemoInscriptionOrder(lookup) });
      setIsTransferVisible(true);
      return;
    }

    setIsOrderLoading(true);

    try {
      const response = await fetch("/api/registration/inscription/order", {
        body: JSON.stringify({ curp: lookup.curp }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { order?: InscriptionOrder; lookup?: InscriptionLookup }
        | ApiErrorResponse
        | null;

      if (!response.ok) {
        const errorPayload = payload as ApiErrorResponse | null;
        throw new Error(errorPayload?.error?.message ?? "No pudimos generar la orden de inscripción.");
      }

      if (!payload || !("order" in payload) || !payload.order) {
        throw new Error("La orden de inscripción no fue válida.");
      }

      setLookup((currentLookup) => {
        if (!currentLookup) {
          return currentLookup;
        }

        return {
          ...(payload.lookup ?? currentLookup),
          order: payload.order,
        };
      });
      setIsTransferVisible(true);
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "No pudimos generar la orden de inscripción.");
    } finally {
      setIsOrderLoading(false);
    }
  };

  return (
    <div className="inscripciones-lookup-shell">
      <article className="inscripciones-payment-portal" aria-labelledby="payment-portal-title">
        <header className="inscripciones-payment-portal__header">
          <div>
            <span className="inscripciones-payment-portal__eyebrow">
              <LockKeyhole aria-hidden="true" size={14} />
              Portal de pagos
            </span>
            <h2 id="payment-portal-title">Consulta y paga tu inscripción</h2>
            <p>Ingresa la CURP del participante para revisar los conceptos cargados por su academia.</p>
          </div>
          <div className="inscripciones-payment-portal__trust">
            <ShieldCheck aria-hidden="true" size={22} />
            <span>Consulta protegida</span>
          </div>
        </header>

        <section className="inscripciones-lookup-search" aria-label="Consulta de inscripción por CURP">
          <form onSubmit={handleLookupSubmit}>
            <div className="inscripciones-lookup-search__field">
              <label htmlFor="inscription-curp">CURP del participante</label>
              <div className="inscripciones-curp-card__input">
                <Search aria-hidden="true" size={19} />
                <input
                  autoComplete="off"
                  id="inscription-curp"
                  maxLength={18}
                  minLength={18}
                  onChange={handleCurpChange}
                  placeholder="Ej. DEMO010101MDFLVT09"
                  value={curp}
                />
              </div>
              <span>18 caracteres, sin espacios.</span>
            </div>
            <button className="inscripciones-button inscripciones-button--solid" disabled={isLookupLoading} type="submit">
              {isLookupLoading ? "Consultando..." : "Consultar inscripción"}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </form>
          <button
            className="inscripciones-lookup-search__demo"
            onClick={() => {
              setCurp(demoCurp);
              setLookup(null);
              setLookupError("");
              setOrderError("");
              setProofError("");
              setProofMessage("");
              setSelectedProofFile(null);
              setIsTransferVisible(false);
            }}
            type="button"
          >
            Usar CURP de demostración
          </button>
          {lookupError ? (
            <p className="inscripciones-query-message is-error" role="alert">
              {lookupError}
            </p>
          ) : null}
        </section>

        {lookup ? (
          <section className="inscripciones-lookup-concepts" aria-labelledby="inscription-concepts-title">
            <header>
              <div>
                <span>Participante</span>
                <h3 id="inscription-concepts-title">{lookup.participantName}</h3>
                <p>{lookup.academyName} · {getVenueLabel(lookup.venue)}</p>
              </div>
              <div className="inscripciones-lookup-concepts__count">
                <CheckCircle2 aria-hidden="true" size={17} />
                {visibleLines.length} {visibleLines.length === 1 ? "coreografía" : "coreografías"}
              </div>
            </header>

            {visibleLines.length > 0 ? (
              <div className="inscripciones-choreography-list" aria-label="Conceptos asociados al CURP">
                {visibleLines.map((line) => (
                  <div className="inscripciones-choreography-row" key={line.id}>
                    <div className="inscripciones-choreography-row__icon">
                      <ReceiptText aria-hidden="true" size={19} />
                    </div>
                    <div>
                      <strong>{getLineTitle(line)}</strong>
                      <span>{getLineMeta(line)}</span>
                    </div>
                    <div className="inscripciones-choreography-row__amount">
                      {line.discountAmount ? <em>50% de descuento</em> : null}
                      {line.discountAmount ? <del>{formatCurrency(line.baseAmount ?? line.amount)}</del> : null}
                      <b>{formatCurrency(line.amount)}</b>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="inscripciones-lookup-empty">
                <ReceiptText aria-hidden="true" size={24} />
                <strong>No hay coreografías disponibles</strong>
                <p>La academia todavía no vinculó coreografías pagables a este participante.</p>
              </div>
            )}

            {visibleLines.length > 0 ? (
              <div className="inscripciones-payment-summary">
                <dl>
                  {visibleDiscount > 0 ? (
                    <>
                      <div>
                        <dt>Subtotal</dt>
                        <dd>{formatCurrency(visibleOriginalSubtotal)}</dd>
                      </div>
                      <div className="is-discount">
                        <dt>Descuento aplicado</dt>
                        <dd>-{formatCurrency(visibleDiscount)}</dd>
                      </div>
                    </>
                  ) : null}
                  <div className="is-total">
                    <dt>Total a pagar</dt>
                    <dd>{formatCurrency(visibleSubtotal)}</dd>
                  </div>
                </dl>

                <button
                  className="inscripciones-button inscripciones-button--solid"
                  disabled={visibleSubtotal <= 0 || isOrderLoading}
                  onClick={handlePaymentOrder}
                  type="button"
                >
                  {isOrderLoading ? "Generando orden..." : lookup.order ? "Ver datos de transferencia" : "Pagar inscripción"}
                  <CreditCard aria-hidden="true" size={18} />
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {orderError ? (
          <p className="inscripciones-query-message is-error" role="alert">
            {orderError}
          </p>
        ) : null}
      </article>

      {isTransferVisible && lookup ? (
        <div
          className="inscripciones-payment-modal"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsTransferVisible(false);
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="payment-modal-title"
            aria-modal="true"
            className="inscripciones-payment-modal__dialog"
            role="dialog"
          >
            <header className="inscripciones-payment-modal__header">
              <div className="inscripciones-card-icon">
                <Landmark aria-hidden="true" size={22} />
              </div>
              <div>
                <span>Transferencia bancaria</span>
                <h3 id="payment-modal-title">Completa tu pago</h3>
              </div>
              <button aria-label="Cerrar datos de transferencia" onClick={() => setIsTransferVisible(false)} type="button">
                <X aria-hidden="true" size={20} />
              </button>
            </header>

            <div className="inscripciones-payment-modal__amount">
              <span>Total a transferir</span>
              <strong>{formatCurrency(visibleSubtotal)}</strong>
              <small>{getOrderStatusLabel(lookup.order?.status)}</small>
            </div>

            <dl className="inscripciones-payment-modal__details">
              {bankTransferRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              <div>
                <dt>Concepto</dt>
                <dd>{lookup.order?.reference ?? lookup.reference}</dd>
              </div>
            </dl>

            <p className="inscripciones-payment-modal__notice">
              Transfiere el monto exacto y usa la referencia como concepto para que podamos validar tu pago.
            </p>

            {lookup.order?.proof ? (
              <div className="inscripciones-proof-status">
                <span>Comprobante cargado</span>
                <strong>{lookup.order.proof.fileName}</strong>
                <p>
                  Recibido el {new Date(lookup.order.proof.uploadedAt).toLocaleDateString("es-MX")} ·{" "}
                  {formatProofSize(lookup.order.proof.fileSize)}
                </p>
                <a download={lookup.order.proof.fileName} href={lookup.order.proof.dataUrl}>
                  Ver comprobante
                </a>
              </div>
            ) : null}

            {lookup.order ? (
              <div className="inscripciones-proof-uploader">
                <header>
                  <span>Comprobante</span>
                  <strong>Sube tu captura o PDF</strong>
                </header>
                <label>
                  <input accept={proofUploadAccept} onChange={handleProofFileChange} type="file" />
                  <span>{selectedProofFile ? selectedProofFile.name : "Seleccionar comprobante"}</span>
                </label>
                <button
                  className="inscripciones-button inscripciones-button--solid"
                  disabled={!selectedProofFile || isProofUploading}
                  onClick={handleProofUpload}
                  type="button"
                >
                  {isProofUploading ? "Subiendo..." : "Subir comprobante"}
                  <ArrowRight aria-hidden="true" size={18} />
                </button>
                {proofError ? (
                  <p className="inscripciones-query-message is-error" role="alert">
                    {proofError}
                  </p>
                ) : null}
                {proofMessage ? <p className="inscripciones-query-message is-success">{proofMessage}</p> : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
