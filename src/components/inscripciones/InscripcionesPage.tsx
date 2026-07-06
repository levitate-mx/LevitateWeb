import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CreditCard,
  Landmark,
  Search,
  UserRound,
} from "lucide-react";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";

type RegistrationPath = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  href: string;
  icon: LucideIcon;
};

type PriceGroup = {
  title: string;
  detail: string;
  amount: string;
  items: string[];
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
    title: "Anota alumnos y coreografías.",
    description: "Para academias: carga participantes, coreógrafos, modalidad, categoría, sede y datos de inscripción.",
    action: "Anotar alumnos",
    href: "/registro/academias",
    icon: Building2,
  },
  {
    eyebrow: "Familias y tutores",
    title: "Consulta CURP y paga inscripción.",
    description: "Para madres, padres o responsables: busca la CURP del participante y paga sólo la inscripción.",
    action: "Pagar inscripción",
    href: consultationPath,
    icon: UserRound,
  },
];

const priceGroups: PriceGroup[] = [
  {
    title: "Motion",
    detail: "Sin niveles",
    amount: "Desde $800 MXN",
    items: ["ACROJAZZ", "BALLET", "BELLY DANCE", "CONTEMPORÁNEO", "FOLKLORE", "JAZZ", "LÍRICO", "OPEN: MOTION", "URBANOS"],
  },
  {
    title: "Aerial",
    detail: "Niveles disponibles",
    amount: "Desde $1,500 MXN",
    items: ["ARO", "OPEN: AERIAL", "TELA", "TRAPECIO"],
  },
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
      id: "demo-motion",
      title: "Demo Motion Crew",
      genre: "motion",
      subgenre: "jazz",
      category: "grupo",
      level: null,
      venue: "edomex",
      academyName: "Academia Demo Levitate",
      amount: 800,
    },
    {
      id: "demo-aerial",
      title: "Demo Aerial Solo",
      genre: "aereo",
      subgenre: "tela",
      category: "solo",
      level: "principiante",
      venue: "edomex",
      academyName: "Academia Demo Levitate",
      amount: 1500,
    },
  ],
  subtotal: 2300,
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
            <h1>
              Inscripciones
              <strong>abiertas</strong>
            </h1>
            <p>
              Las academias anotan alumnos y coreografías. Madres, padres o tutores consultan por CURP y pagan sólo la
              inscripción, sin mezclarla con compras de tienda.
            </p>
            <div className="inscripciones-hero__actions">
              <a className="inscripciones-button inscripciones-button--light" href="/registro/academias">
                Anotar alumnos
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

      <section className="inscripciones-access" aria-labelledby="inscripciones-access-title">
        <div className="inscripciones-section-head">
          <p className="inscripciones-eyebrow">Accesos</p>
          <h2 id="inscripciones-access-title">Dos caminos claros: registrar y pagar.</h2>
        </div>

        <div className="inscripciones-choice-grid">
          {registrationPaths.map((path) => {
            const Icon = path.icon;

            return (
              <a className="inscripciones-route-card" href={path.href} key={path.title}>
                <span className="inscripciones-route-card__icon">
                  <Icon aria-hidden="true" size={28} />
                </span>
                <span className="inscripciones-route-card__eyebrow">{path.eyebrow}</span>
                <strong>{path.title}</strong>
                <p>{path.description}</p>
                <em>
                  {path.action}
                  <ArrowRight aria-hidden="true" size={18} />
                </em>
              </a>
            );
          })}
        </div>
      </section>

      <section className="inscripciones-pricing" aria-labelledby="inscripciones-pricing-title">
        <div className="inscripciones-section-head">
          <p className="inscripciones-eyebrow">Modalidades</p>
          <h2 id="inscripciones-pricing-title">Motion y Aerial, sin vueltas.</h2>
        </div>

        <div className="inscripciones-price-grid">
          {priceGroups.map((group) => (
            <article className="inscripciones-price-card" key={group.title}>
              <header>
                <div>
                  <span>{group.detail}</span>
                  <h3>{group.title}</h3>
                </div>
                <strong>{group.amount}</strong>
              </header>
              <div className="inscripciones-style-list" aria-label={`Géneros de ${group.title}`}>
                {group.items.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
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
        <div className="inscripciones-hero__backdrop" aria-hidden="true">
          <video autoPlay muted loop playsInline preload="metadata">
            <source src="/assets/levitate-home-hero.mp4" type="video/mp4" />
          </video>
        </div>
        <LevitateHeader activeLabel="Inscripciones" useRootLinks variant="pill" />

        <div className="inscripciones-hero__content inscripciones-lookup-hero__content">
          <div className="inscripciones-section-head inscripciones-section-head--lookup">
            <p className="inscripciones-eyebrow">Consulta y pago</p>
            <h1>Consulta tu inscripción por CURP.</h1>
            <p>
              Revisa los conceptos cargados por tu academia y abre los datos bancarios para transferir sólo la
              inscripción.
            </p>
          </div>

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
  const orderRows = useMemo(
    () => [
      { label: "Participante", value: lookup?.participantName ?? "Pendiente" },
      { label: "Academia", value: lookup?.academyName ?? "Pendiente" },
      { label: "Referencia", value: lookup?.reference ?? "Pendiente" },
      { label: "Sede", value: lookup ? getVenueLabel(lookup.venue) : "Pendiente" },
      { label: "Estado", value: getOrderStatusLabel(lookup?.order?.status) },
    ],
    [lookup],
  );

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
      setIsTransferVisible(Boolean(payload.order));
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
      <article className="inscripciones-curp-card inscripciones-lookup-search">
        <div className="inscripciones-lookup-search__copy">
          <div className="inscripciones-card-icon">
            <Search aria-hidden="true" size={26} />
          </div>
          <div>
            <span>Consulta rápida</span>
            <strong>CURP del participante</strong>
          </div>
        </div>
        <form onSubmit={handleLookupSubmit}>
          <label htmlFor="inscription-curp">CURP del participante</label>
          <div className="inscripciones-curp-card__input">
            <input
              autoComplete="off"
              id="inscription-curp"
              maxLength={18}
              minLength={18}
              onChange={handleCurpChange}
              placeholder="Ingresa tu CURP"
              value={curp}
            />
          </div>
          <button className="inscripciones-button inscripciones-button--solid" disabled={isLookupLoading} type="submit">
            {isLookupLoading ? "Consultando" : "Consultar inscripción"}
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>
        <p>Demo: {demoCurp}</p>
        {lookupError ? (
          <p className="inscripciones-query-message is-error" role="alert">
            {lookupError}
          </p>
        ) : null}
      </article>

      <div className="inscripciones-lookup-body">
        <article className="inscripciones-confirmation-card inscripciones-confirmation-card--receipt">
          <header>
            <div className="inscripciones-card-icon">
              <BadgeCheck aria-hidden="true" size={26} />
            </div>
            <div>
              <span>{lookup ? "Registro encontrado" : "Consulta pendiente"}</span>
              <h3>{lookup ? lookup.participantName : "Ingresa tu CURP"}</h3>
              <p>
                {lookup
                  ? `${lookup.academyName} · ${getVenueLabel(lookup.venue)}`
                  : "Aquí aparecerán solamente los conceptos de inscripción cargados por la academia."}
              </p>
            </div>
          </header>

          <div className="inscripciones-choreography-list" aria-label="Conceptos asociados al CURP">
            {visibleLines.length > 0 ? (
              visibleLines.map((line) => (
                <div className="inscripciones-choreography-row" key={line.id}>
                  <div>
                    <strong>{getLineTitle(line)}</strong>
                    <span>{getLineMeta(line)}</span>
                  </div>
                  <b>{formatCurrency(line.amount)}</b>
                </div>
              ))
            ) : (
              <div className="inscripciones-choreography-row inscripciones-choreography-row--empty">
                <div>
                  <strong>{lookup ? "Sin cargos cargados" : "Sin consulta todavía"}</strong>
                  <span>
                    {lookup
                      ? "La academia todavía no vinculó coreografías pagables a esta CURP."
                      : "Consulta una CURP para ver los cargos de inscripción."}
                  </span>
                </div>
                <b>{formatCurrency(0)}</b>
              </div>
            )}
          </div>

          <div className="inscripciones-subtotal">
            <span>Total de inscripción</span>
            <strong>{formatCurrency(visibleSubtotal)}</strong>
          </div>
        </article>

        <article className="inscripciones-order-card inscripciones-order-card--lookup" aria-labelledby="payment-order-title">
          <header>
            <div className="inscripciones-card-icon">
              <Landmark aria-hidden="true" size={26} />
            </div>
            <div>
              <span>Pago separado</span>
              <h3 id="payment-order-title">Orden de inscripción</h3>
            </div>
          </header>

          <dl>
            {orderRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="inscripciones-order-card__total">
            <span>Monto</span>
            <strong>{formatCurrency(visibleSubtotal)}</strong>
          </div>

          <p>Esta orden cubre sólo inscripción. Boletos, fotografías y videos se compran aparte en tienda.</p>

          <button
            className="inscripciones-button inscripciones-button--solid"
            disabled={!lookup || visibleSubtotal <= 0 || isOrderLoading}
            onClick={handlePaymentOrder}
            type="button"
          >
            {isOrderLoading ? "Generando orden" : lookup?.order ? "Ver datos de pago" : "Pagar inscripción"}
            <CreditCard aria-hidden="true" size={18} />
          </button>

          {orderError ? (
            <p className="inscripciones-query-message is-error" role="alert">
              {orderError}
            </p>
          ) : null}

          {isTransferVisible && lookup ? (
            <section className="inscripciones-bank-details" aria-label="Datos bancarios para transferencia">
              <header>
                <span>Transferencia bancaria</span>
                <strong>Datos para completar el pago</strong>
              </header>
              <dl>
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
                <div>
                  <dt>Monto exacto</dt>
                  <dd>{formatCurrency(visibleSubtotal)}</dd>
                </div>
              </dl>
              <p>Usa la referencia como concepto de transferencia para que el pago pueda validarse correctamente.</p>

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
                    className="inscripciones-button inscripciones-button--ghost"
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
          ) : null}
        </article>
      </div>
    </div>
  );
}
