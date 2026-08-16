import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Info,
  MessageCircle,
  ReceiptText,
  Search,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { formatMexicoCityDate } from "../../utils/mexicoCityTime";
import { LevitateFooter } from "../home/LevitateFooter";
import { LevitateHeader } from "../home/LevitateHeader";
import {
  registrationPaymentConceptLabel,
  registrationPaymentConsultationPath,
  registrationPaymentMethodSections,
} from "./paymentDetails";

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
  currency?: string;
  discountAmount?: number;
  discountRate?: number;
  isCourtesy?: boolean;
  pricingPosition?: number;
  pricingType?: string;
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
  paymentReference?: string;
  amount: number;
  paidAmount: number;
  currency?: string;
  status: InscriptionOrderStatus;
  paymentMethod: string;
  buyerPhoneCountryCode?: string | null;
  buyerPhoneNumber?: string | null;
  buyerPhone?: string | null;
  notes?: string | null;
  paidAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  rejectionMessage?: string | null;
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
  paymentReference?: string;
  registrations: InscriptionLookupRecord[];
  lines: InscriptionLookupLine[];
  subtotal: number;
  currency?: string;
  pricingMode?: "mexico" | "international";
  order?: InscriptionOrder | null;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

const consultationPath = registrationPaymentConsultationPath;
const proofUploadAccept = "image/jpeg,image/png,image/webp,application/pdf";
const maxProofUploadBytes = 1800000;
const defaultPhoneCountryCode = "+52";

const phoneCountryOptions = [
  { code: "+52", country: "México" },
  { code: "+1", country: "Estados Unidos / Canadá / Rep. Dominicana" },
  { code: "+54", country: "Argentina" },
  { code: "+591", country: "Bolivia" },
  { code: "+55", country: "Brasil" },
  { code: "+56", country: "Chile" },
  { code: "+57", country: "Colombia" },
  { code: "+506", country: "Costa Rica" },
  { code: "+593", country: "Ecuador" },
  { code: "+503", country: "El Salvador" },
  { code: "+34", country: "España" },
  { code: "+502", country: "Guatemala" },
  { code: "+504", country: "Honduras" },
  { code: "+505", country: "Nicaragua" },
  { code: "+507", country: "Panamá" },
  { code: "+595", country: "Paraguay" },
  { code: "+51", country: "Perú" },
  { code: "+598", country: "Uruguay" },
  { code: "+58", country: "Venezuela" },
];

const registrationPaths: RegistrationPath[] = [
  {
    eyebrow: "Academias",
    title: "Registra tu academia, participantes y coreografías.",
    description: "Para poder hacer el pago de la inscripción es necesario registrarse primero.",
    action: "Registrar participante",
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

const paymentMethodSections = registrationPaymentMethodSections;
const paymentConceptLabel = registrationPaymentConceptLabel;

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
  open_cuna: "OPEN: Cuna",
  open_esfera: "OPEN: Esfera",
  open_luna: "OPEN: Luna",
  open_motion: "OPEN: MOTION",
  open_otro: "OPEN: Otro",
  open_pole_aereo: "OPEN: Pole Aereo",
  open_suspension_capilar: "OPEN: Suspensión Capilar",
  open_trapecio: "OPEN: Trapecio",
  tela: "TELA",
  trapecio: "TRAPECIO",
  urbanos: "URBANOS",
};

const categoryLabels: Record<string, string> = {
  duo: "Dúo",
  duo_2_aparatos: "Duo: 2 Aparatos",
  dupla_1_aparato: "Duplas: 1 Aparato",
  grupo: "Grupo",
  solo: "Solo",
  terna_1_aparato: "Ternas: 1 Aparato",
  trio: "Trío",
  trio_3_aparatos: "Trios: 3 Aparatos",
};

const levelLabels: Record<string, string> = {
  avanzado: "Avanzado",
  elite: "Élite",
  intermedio: "Intermedio",
  nudo: "Nudo",
  principiante: "Principiante",
};

const venueLabels: Record<string, string> = {
  cdmx: "CDMX - 29 /31 mayo 2026",
  edomex: "Otoño 2026 - Estado de México",
  puebla: "Puebla",
  veracruz: "Primavera 2027 - Veracruz",
};

const currencyFormatters = new Map<string, Intl.NumberFormat>();

const orderStatusLabels: Record<InscriptionOrderStatus, string> = {
  paid: "Pagada",
  payment_reported: "Pendiente de confirmación",
  pending_payment: "Pendiente de pago",
  rejected: "Rechazada",
};

function getCurrencyFormatter(currency = "MXN") {
  const normalizedCurrency = currency.toUpperCase();
  const existingFormatter = currencyFormatters.get(normalizedCurrency);

  if (existingFormatter) {
    return existingFormatter;
  }

  const formatter = new Intl.NumberFormat(normalizedCurrency === "USD" ? "en-US" : "es-MX", {
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
    style: "currency",
  });

  currencyFormatters.set(normalizedCurrency, formatter);
  return formatter;
}

function formatCurrency(amount: number, currency = "MXN") {
  return getCurrencyFormatter(currency).format(amount);
}

function getLookupCurrency(lookup?: InscriptionLookup | null) {
  return lookup?.currency || lookup?.order?.currency || lookup?.lines.find((line) => line.currency)?.currency || "MXN";
}

function normalizeCurp(value: string) {
  return value.replace(/\s+/g, "").toUpperCase().slice(0, 18);
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

function formatPhoneNumber(value: string) {
  const digits = normalizePhoneNumber(value);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return digits;
}

function normalizePhoneCountryCode(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits.slice(0, 4)}` : defaultPhoneCountryCode;
}

function buildBuyerPhone(countryCode: string, phoneNumber: string) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  return normalizedPhoneNumber ? `${normalizePhoneCountryCode(countryCode)}${normalizedPhoneNumber}` : "";
}

function isPhoneNumberValid(phoneNumber: string) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  return normalizedPhoneNumber.length >= 7 && normalizedPhoneNumber.length <= 15;
}

function getPaymentConcept(lookup: InscriptionLookup) {
  return lookup.order?.paymentReference || lookup.paymentReference || lookup.order?.reference || lookup.reference;
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

function canSubmitPaymentProof(order?: InscriptionOrder | null) {
  return Boolean(order && (!order.proof || order.status === "rejected"));
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

export function InscripcionesPage() {
  return (
    <main className="levitate-home-redesign inscripciones-page">
      <section className="inscripciones-hero" id="inicio">
        <div className="inscripciones-hero__backdrop" aria-hidden="true">
          <img alt="" src="/assets/inscripciones-hero-color-4.jpg" />
        </div>
        <LevitateHeader activeLabel="Inscripciones" useRootLinks variant="pill" />

        <div className="inscripciones-hero__content">
          <div className="inscripciones-hero__copy">
            <h1>No te pierdas el vuelo.</h1>
            <div className="inscripciones-hero__actions">
              <a className="inscripciones-button inscripciones-button--light" href="/registro/academias">
                Registrar participante
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

        <aside className="inscripciones-presale-note" aria-label="Vigencia de preventa">
          <p>
            <CircleAlert aria-hidden="true" size={20} />
            <span className="inscripciones-presale-note__copy">
              <span>
                El precio preventa es aplicable hasta el <strong>12 de octubre de 2026.</strong> A partir del 13 de
                octubre de 2026 se aplica el precio real.
              </span>
              <span>
                El cierre de las inscripciones se realiza hasta el <strong>5 de noviembre de 2026</strong>, como fecha
                última para realizar el pago.
              </span>
            </span>
          </p>
        </aside>
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
      <section className="inscripciones-payment-screen" id="consulta-curp">
        <LevitateHeader activeLabel="Inscripciones" tone="light" useRootLinks variant="pill" />

        <div className="inscripciones-payment-screen__content">
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
  const [phoneCountryCode, setPhoneCountryCode] = useState(defaultPhoneCountryCode);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [isShareFallbackVisible, setIsShareFallbackVisible] = useState(false);
  const [proofError, setProofError] = useState("");
  const [proofMessage, setProofMessage] = useState("");
  const [whatsappError, setWhatsappError] = useState("");
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [isTransferVisible, setIsTransferVisible] = useState(false);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [isProofUploading, setIsProofUploading] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const paymentPanelRef = useRef<HTMLElement | null>(null);
  const proofCorrectionRef = useRef<HTMLDivElement | null>(null);
  const proofFileInputRef = useRef<HTMLInputElement | null>(null);
  const proofUploaderRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToProofRef = useRef(false);
  const selectedPaymentMethod = paymentMethodSections.find((method) => method.id === selectedPaymentMethodId) ?? null;
  const visibleLines = lookup?.lines ?? [];
  const visibleSubtotal = lookup?.subtotal ?? 0;
  const visibleCurrency = getLookupCurrency(lookup);
  const visibleOriginalSubtotal = visibleLines.reduce((total, line) => total + (line.baseAmount ?? line.amount), 0);
  const visibleDiscount = Math.max(0, visibleOriginalSubtotal - visibleSubtotal);
  const hasUploadedPaymentProof = Boolean(lookup?.order?.proof);
  const canUploadPaymentProof = canSubmitPaymentProof(lookup?.order);
  const isRejectedPaymentOrder = lookup?.order?.status === "rejected";

  useEffect(() => {
    if (!isTransferVisible) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTransferVisible(false);
        setSelectedPaymentMethodId("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTransferVisible]);

  useEffect(() => {
    if (!isTransferVisible || !selectedPaymentMethod || !shouldScrollToProofRef.current) {
      return;
    }

    const scrollToProofUploader = () => {
      const panel = paymentPanelRef.current;
      const target = proofCorrectionRef.current ?? proofUploaderRef.current;

      if (!panel || !target) {
        return;
      }

      const panelRect = panel.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextScrollTop = panel.scrollTop + targetRect.top - panelRect.top - 16;

      panel.scrollTo({
        behavior: "auto",
        top: Math.max(0, nextScrollTop),
      });
      shouldScrollToProofRef.current = false;
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToProofUploader);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isTransferVisible, selectedPaymentMethod]);

  const handleCurpChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextCurp = normalizeCurp(event.target.value);
    setCurp(nextCurp);
    setLookupError("");
    setOrderError("");
    setCopyMessage("");
    setIsShareFallbackVisible(false);
    setProofError("");
    setProofMessage("");
    setWhatsappError("");
    setSelectedProofFile(null);
    setIsTransferVisible(false);
    setSelectedPaymentMethodId("");

    if (lookup && lookup.curp !== nextCurp) {
      setLookup(null);
    }
  };

  const handlePhoneNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(normalizePhoneNumber(event.target.value));
    setLookupError("");
    setOrderError("");
    setWhatsappError("");
  };

  const lookupPaymentByCurp = async (
    normalizedCurp: string,
    options: { autoOpenPayment?: boolean; expectedOrderId?: string } = {},
  ) => {
    setIsLookupLoading(true);

    try {
      const response = await fetch("/api/registration/inscription/payment-lookup", {
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
      setPhoneCountryCode(payload.order?.buyerPhoneCountryCode ?? defaultPhoneCountryCode);
      setPhoneNumber(payload.order?.buyerPhoneNumber ?? "");
      shouldScrollToProofRef.current = Boolean(options.autoOpenPayment && payload.order);
      setIsTransferVisible(Boolean(options.autoOpenPayment && payload.order));
      setSelectedPaymentMethodId(options.autoOpenPayment && payload.order ? paymentMethodSections[0]?.id ?? "" : "");

      if (options.expectedOrderId && payload.order?.id && payload.order.id !== options.expectedOrderId) {
        setProofMessage("Te mostramos la orden vigente asociada a esta CURP.");
      }

      resetLookupScroll();
      return payload;
    } catch (error) {
      setLookup(null);
      setLookupError(error instanceof Error ? error.message : "No pudimos consultar esa CURP.");
      return null;
    } finally {
      setIsLookupLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedCurp = normalizeCurp(params.get("curp") ?? "");

    if (!linkedCurp) {
      return;
    }

    setCurp(linkedCurp);

    if (linkedCurp.length !== 18) {
      setLookupError("La liga de corrección no tiene una CURP válida.");
      return;
    }

    void lookupPaymentByCurp(linkedCurp, {
      autoOpenPayment: params.get("upload") === "proof",
      expectedOrderId: params.get("orderId") ?? "",
    });
  }, []);

  const handleLookupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedCurp = normalizeCurp(curp);
    setCurp(normalizedCurp);
    setLookupError("");
    setOrderError("");
    setCopyMessage("");
    setIsShareFallbackVisible(false);
    setProofError("");
    setProofMessage("");
    setWhatsappError("");
    setSelectedProofFile(null);
    setIsTransferVisible(false);
    setSelectedPaymentMethodId("");

    if (normalizedCurp.length !== 18) {
      setLookup(null);
      setLookupError("La CURP debe tener 18 caracteres.");
      return;
    }

    void lookupPaymentByCurp(normalizedCurp);
  };

  const uploadProofFile = async (proofFile: File) => {
    if (!lookup?.order) {
      return;
    }

    if (!canSubmitPaymentProof(lookup.order)) {
      setSelectedProofFile(null);
      setProofError("");
      setProofMessage("");
      return;
    }

    setProofError("");
    setProofMessage("");
    setSelectedProofFile(proofFile);
    setIsProofUploading(true);

    try {
      const dataUrl = await readFileAsDataUrl(proofFile);

      const response = await fetch("/api/registration/inscription/payment-proof", {
        body: JSON.stringify({
          contentType: proofFile.type,
          curp: lookup.curp,
          dataUrl,
          fileName: proofFile.name,
          fileSize: proofFile.size,
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
      setProofMessage("Comprobante recibido. Tu orden quedó pendiente de confirmación.");
    } catch (error) {
      setProofError(error instanceof Error ? error.message : "No pudimos subir el comprobante.");
    } finally {
      setIsProofUploading(false);

      if (proofFileInputRef.current) {
        proofFileInputRef.current.value = "";
      }
    }
  };

  const handleProofFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0] ?? null;
    setProofError("");
    setProofMessage("");

    if (!canSubmitPaymentProof(lookup?.order)) {
      setSelectedProofFile(null);
      input.value = "";
      return;
    }

    if (!file) {
      setSelectedProofFile(null);
      return;
    }

    if (file.size > maxProofUploadBytes) {
      setSelectedProofFile(null);
      setProofError("El comprobante debe pesar menos de 1.8 MB.");
      input.value = "";
      return;
    }

    if (!proofUploadAccept.split(",").includes(file.type)) {
      setSelectedProofFile(null);
      setProofError("Sube una imagen JPG, PNG, WEBP o un PDF.");
      input.value = "";
      return;
    }

    setSelectedProofFile(file);
    input.value = "";
  };

  const handleProofSubmit = () => {
    if (!canSubmitPaymentProof(lookup?.order)) {
      setSelectedProofFile(null);
      return;
    }

    if (!selectedProofFile) {
      proofFileInputRef.current?.click();
      return;
    }

    void uploadProofFile(selectedProofFile);
  };

  const getPaymentShareData = () => {
    if (!lookup) {
      return null;
    }

    const concept = getPaymentConcept(lookup);

    return {
      concept,
      fileName: `datos-pago-${concept.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
    };
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 700);
  };

  const loadPaymentArtworkImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => reject(new Error("No pudimos cargar el logo.")), { once: true });
      image.src = src;
    });

  const createPaymentArtwork = async () => {
    if (!lookup || !selectedPaymentMethod) {
      return null;
    }

    const scale = 2;
    const width = 1440;
    const leftWidth = 760;
    const gutter = 54;
    const padding = 56;
    const rightX = padding + leftWidth + gutter;
    const rightWidth = width - rightX - padding;
    const rowHeights = visibleLines.map((line) => (line.discountAmount ? 124 : 98));
    const listHeight = rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0);
    const contentHeight = Math.max(1010, padding + 164 + listHeight + 260);
    const height = contentHeight + padding;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const logo = await loadPaymentArtworkImage("/assets/levitate-logo-mx.png").catch(() => null);

    if (!context) {
      return null;
    }

    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);

    const ink = "#2a2928";
    const muted = "rgba(42, 41, 40, 0.58)";
    const border = "rgba(42, 41, 40, 0.14)";
    const softBorder = "rgba(42, 41, 40, 0.1)";
    const paper = "#f8f6f1";
    const card = "rgba(255, 255, 255, 0.46)";
    const pink = "#df4f95";
    const green = "#2f7b4d";
    const greenSoft = "rgba(53, 134, 82, 0.12)";

    const setFont = (size: number, weight = 560) => {
      context.font = `${weight} ${size}px Inter, Arial, sans-serif`;
    };

    const drawRoundRect = (
      x: number,
      y: number,
      rectWidth: number,
      rectHeight: number,
      radius: number,
      fillStyle?: string,
      strokeStyle?: string,
    ) => {
      const nextRadius = Math.min(radius, rectWidth / 2, rectHeight / 2);

      context.beginPath();
      context.moveTo(x + nextRadius, y);
      context.lineTo(x + rectWidth - nextRadius, y);
      context.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + nextRadius);
      context.lineTo(x + rectWidth, y + rectHeight - nextRadius);
      context.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - nextRadius, y + rectHeight);
      context.lineTo(x + nextRadius, y + rectHeight);
      context.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - nextRadius);
      context.lineTo(x, y + nextRadius);
      context.quadraticCurveTo(x, y, x + nextRadius, y);
      context.closePath();

      if (fillStyle) {
        context.fillStyle = fillStyle;
        context.fill();
      }

      if (strokeStyle) {
        context.strokeStyle = strokeStyle;
        context.lineWidth = 1;
        context.stroke();
      }
    };

    const drawText = (text: string, x: number, y: number, size: number, color = ink, weight = 560) => {
      setFont(size, weight);
      context.fillStyle = color;
      context.fillText(text, x, y);
    };

    const drawRightText = (text: string, x: number, y: number, size: number, color = ink, weight = 680) => {
      setFont(size, weight);
      context.fillStyle = color;
      context.textAlign = "right";
      context.fillText(text, x, y);
      context.textAlign = "left";
    };

    const drawWrappedText = (
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      lineHeight: number,
      size: number,
      color = ink,
      weight = 560,
      maxLines = 2,
    ) => {
      setFont(size, weight);
      context.fillStyle = color;

      const words = text.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      words.forEach((word) => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;

        if (context.measureText(candidate).width <= maxWidth || !currentLine) {
          currentLine = candidate;
          return;
        }

        lines.push(currentLine);
        currentLine = word;
      });

      if (currentLine) {
        lines.push(currentLine);
      }

      lines.slice(0, maxLines).forEach((line, index) => {
        const renderedLine = index === maxLines - 1 && lines.length > maxLines ? `${line.replace(/\s+\S*$/, "")}...` : line;
        context.fillText(renderedLine, x, y + index * lineHeight);
      });

      return y + Math.min(lines.length, maxLines) * lineHeight;
    };

    const drawRightFittedText = (
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      size: number,
      color = ink,
      weight = 680,
    ) => {
      setFont(size, weight);
      context.fillStyle = color;

      let renderedText = text;

      while (context.measureText(renderedText).width > maxWidth && renderedText.length > 4) {
        renderedText = `${renderedText.slice(0, -4).trim()}...`;
      }

      context.textAlign = "right";
      context.fillText(renderedText, x, y);
      context.textAlign = "left";
    };

    const drawCenteredText = (text: string, x: number, y: number, maxWidth: number, size: number, color = ink, weight = 760) => {
      setFont(size, weight);
      context.fillStyle = color;

      let renderedText = text;

      while (context.measureText(renderedText).width > maxWidth && renderedText.length > 4) {
        renderedText = `${renderedText.slice(0, -4).trim()}...`;
      }

      context.textAlign = "center";
      context.fillText(renderedText, x, y);
      context.textAlign = "left";
    };

    context.fillStyle = paper;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(42, 41, 40, 0.08)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(rightX - gutter / 2, 0);
    context.lineTo(rightX - gutter / 2, height);
    context.stroke();

    if (logo) {
      const logoWidth = 176;
      const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);

      context.save();
      context.globalAlpha = 0.92;
      context.drawImage(logo, width - padding - logoWidth, 34, logoWidth, logoHeight);
      context.restore();
    }

    drawText("Portal de pagos", padding, 58, 16, pink, 860);
    drawWrappedText(lookup.participantName, padding, 126, leftWidth, 58, 54, ink, 560, 1);
    drawText(`${lookup.academyName} · ${getVenueLabel(lookup.venue)}`.toUpperCase(), padding, 172, 16, pink, 860);
    drawRightText(
      `${visibleLines.length} ${visibleLines.length === 1 ? "coreografía" : "coreografías"}`,
      padding + leftWidth,
      172,
      18,
      muted,
      720,
    );

    const listY = 216;
    drawRoundRect(padding, listY, leftWidth, listHeight, 8, card, border);

    let rowY = listY;
    visibleLines.forEach((line, index) => {
      const rowHeight = rowHeights[index];
      const rowCenter = rowY + rowHeight / 2;

      if (index > 0) {
        context.strokeStyle = softBorder;
        context.beginPath();
        context.moveTo(padding, rowY);
        context.lineTo(padding + leftWidth, rowY);
        context.stroke();
      }

      context.beginPath();
      context.arc(padding + 42, rowCenter, 24, 0, Math.PI * 2);
      context.fillStyle = ink;
      context.fill();
      drawRightText(String(index + 1), padding + 49, rowCenter + 7, 20, "#fff", 780);

      const textX = padding + 92;
      const titleY = rowY + (line.discountAmount ? 36 : 42);
      const titleText = getLineTitle(line);
      const badgeWidth = 174;
      const titleMaxWidth = line.discountAmount ? leftWidth - 280 - badgeWidth - 18 : leftWidth - 280;

      drawWrappedText(titleText, textX, titleY, titleMaxWidth, 26, 23, ink, 760, 1);

      if (line.discountAmount) {
        setFont(23, 760);
        const titleWidth = Math.min(context.measureText(titleText).width, titleMaxWidth);
        const badgeX = textX + titleWidth + 16;
        const badgeY = titleY - 22;

        drawRoundRect(badgeX, badgeY, badgeWidth, 34, 17, greenSoft);
        drawText(line.isCourtesy ? "CORTESIA LEVITATE" : "50% DE DESCUENTO", badgeX + 18, badgeY + 23, 15, green, 820);
      }

      drawText(getLineMeta(line).toUpperCase(), textX, titleY + 36, 16, muted, 820);

      const amountX = padding + leftWidth - 28;

      if (line.discountAmount) {
        const lineCurrency = line.currency || visibleCurrency;
        const original = formatCurrency(line.baseAmount ?? line.amount, lineCurrency);

        drawRightText(original, amountX, rowCenter - 10, 20, "rgba(42, 41, 40, 0.48)", 660);
        context.strokeStyle = "rgba(42, 41, 40, 0.48)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(amountX - context.measureText(original).width, rowCenter - 17);
        context.lineTo(amountX, rowCenter - 17);
        context.stroke();
        drawRightText(line.isCourtesy ? "Cortesía" : formatCurrency(line.amount, lineCurrency), amountX, rowCenter + 28, 29, ink, 820);
      } else {
        drawRightText(formatCurrency(line.amount, line.currency || visibleCurrency), amountX, rowCenter + 10, 27, ink, 820);
      }

      rowY += rowHeight;
    });

    const summaryY = listY + listHeight + 38;
    drawText("Subtotal", padding, summaryY, 23, ink, 820);
    drawRightText(formatCurrency(visibleOriginalSubtotal, visibleCurrency), padding + leftWidth, summaryY, 23, ink, 760);

    if (visibleDiscount > 0) {
      drawText(lookup?.pricingMode === "international" ? "Cortesías" : "Descuentos", padding, summaryY + 48, 23, green, 820);
      drawRightText(`-${formatCurrency(visibleDiscount, visibleCurrency)}`, padding + leftWidth, summaryY + 48, 23, green, 760);
    }

    context.strokeStyle = "rgba(42, 41, 40, 0.62)";
    context.beginPath();
    context.moveTo(padding, summaryY + 88);
    context.lineTo(padding + leftWidth, summaryY + 88);
    context.stroke();

    drawText("Total a pagar", padding, summaryY + 142, 24, ink, 840);
    drawRightText(visibleCurrency, padding + leftWidth, summaryY + 142, 21, ink, 820);
    drawRightText(formatCurrency(visibleSubtotal, visibleCurrency), padding + leftWidth - 54, summaryY + 142, 42, ink, 820);

    drawText("Datos para pago", rightX, 58, 16, ink, 840);
    drawText("Opciones de pago", rightX, 122, 42, ink, 560);
    context.strokeStyle = "rgba(42, 41, 40, 0.18)";
    context.beginPath();
    context.moveTo(rightX, 178);
    context.lineTo(rightX + rightWidth, 178);
    context.stroke();
    drawText("Total a transferir", rightX, 226, 18, muted, 540);
    drawText(getOrderStatusLabel(lookup.order?.status), rightX, 262, 17, muted, 540);
    drawRightText(formatCurrency(visibleSubtotal, visibleCurrency), rightX + rightWidth, 248, 38, pink, 820);
    context.beginPath();
    context.moveTo(rightX, 292);
    context.lineTo(rightX + rightWidth, 292);
    context.stroke();

    let detailY = 328;
    const paymentTabGap = 8;
    const paymentTabHeight = 44;
    const paymentTabWidth = (rightWidth - paymentTabGap) / paymentMethodSections.length;

    paymentMethodSections.forEach((method, methodIndex) => {
      const tabX = rightX + methodIndex * (paymentTabWidth + paymentTabGap);
      const isActive = method.id === selectedPaymentMethod.id;

      drawRoundRect(
        tabX,
        detailY,
        paymentTabWidth,
        paymentTabHeight,
        8,
        isActive ? ink : "rgba(255, 255, 255, 0.54)",
        isActive ? "rgba(42, 41, 40, 0.24)" : softBorder,
      );
      drawCenteredText(method.title, tabX + paymentTabWidth / 2, detailY + 29, paymentTabWidth - 28, 16, isActive ? "#fff" : ink, 820);
    });

    detailY += paymentTabHeight + 12;

    const paymentCardHeight = 24 + selectedPaymentMethod.rows.length * 70;

    drawRoundRect(rightX, detailY, rightWidth, paymentCardHeight, 8, "rgba(255, 255, 255, 0.54)", softBorder);

    selectedPaymentMethod.rows.forEach((row, rowIndex) => {
      const rowTop = detailY + 12 + rowIndex * 70;
      const rowBaseline = rowTop + 43;

      if (rowIndex > 0) {
        context.beginPath();
        context.strokeStyle = softBorder;
        context.moveTo(rightX + 24, rowTop);
        context.lineTo(rightX + rightWidth - 24, rowTop);
        context.stroke();
      }

      drawText(row.label.toUpperCase(), rightX + 24, rowBaseline, 13, muted, 820);
      drawRightFittedText(row.value, rightX + rightWidth - 24, rowBaseline + 1, rightWidth - 230, 21, ink, 760);
    });

    detailY += paymentCardHeight + 18;

    const conceptLabel = paymentConceptLabel.toUpperCase();
    const conceptLabelX = rightX + 24;

    drawRoundRect(rightX, detailY, rightWidth, 74, 8, card, softBorder);
    drawText(conceptLabel, conceptLabelX, detailY + 45, 16, ink, 820);
    setFont(16, 820);

    const conceptLabelWidth = context.measureText(conceptLabel).width;
    const asteriskX = conceptLabelX + conceptLabelWidth + 8;
    const infoX = asteriskX + 22;

    drawText("*", asteriskX, detailY + 45, 17, pink, 860);

    context.beginPath();
    context.arc(infoX, detailY + 39, 10, 0, Math.PI * 2);
    context.strokeStyle = "rgba(42, 41, 40, 0.42)";
    context.stroke();
    drawText("i", infoX - 2, detailY + 45, 14, ink, 820);
    drawRightFittedText(getPaymentConcept(lookup), rightX + rightWidth - 24, detailY + 46, rightWidth - 214, 22, ink, 840);
    detailY += 88;

    drawWrappedText(
      "Este concepto es personalizado e individual para cada participante. Úsalo exactamente como aparece para validar el pago.",
      rightX,
      detailY + 22,
      rightWidth,
      26,
      20,
      "rgba(42, 41, 40, 0.62)",
      520,
      3,
    );

    return { canvas, height, width };
  };

  const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, type, quality);
    });

  const createImagePdfBlob = async (imageBlob: Blob, pageWidth: number, pageHeight: number) => {
    const imageBytes = new Uint8Array(await imageBlob.arrayBuffer());
    const contentStream = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/PaymentCapture Do\nQ\n`;
    const encoder = new TextEncoder();
    const chunks: BlobPart[] = [];
    const offsets = [0];
    let offset = 0;

    const toBlobPart = (bytes: Uint8Array) =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    const writeText = (text: string) => {
      const bytes = encoder.encode(text);
      chunks.push(toBlobPart(bytes));
      offset += bytes.length;
    };

    const writeBytes = (bytes: Uint8Array) => {
      chunks.push(toBlobPart(bytes));
      offset += bytes.length;
    };

    const startObject = (objectNumber: number) => {
      offsets[objectNumber] = offset;
      writeText(`${objectNumber} 0 obj\n`);
    };

    writeText("%PDF-1.4\n");
    startObject(1);
    writeText("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    startObject(2);
    writeText("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    startObject(3);
    writeText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /PaymentCapture 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    );
    startObject(4);
    writeText(
      `<< /Type /XObject /Subtype /Image /Width ${pageWidth * 2} /Height ${pageHeight * 2} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
    );
    writeBytes(imageBytes);
    writeText("\nendstream\nendobj\n");
    startObject(5);
    writeText(`<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}endstream\nendobj\n`);

    const xrefOffset = offset;
    writeText("xref\n0 6\n0000000000 65535 f \n");
    [1, 2, 3, 4, 5].forEach((objectNumber) => {
      writeText(`${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`);
    });
    writeText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Blob(chunks, { type: "application/pdf" });
  };

  const createPaymentPdfBlob = async () => {
    await document.fonts?.ready;

    const artwork = await createPaymentArtwork();

    if (!artwork) {
      return null;
    }

    const imageBlob = await canvasToBlob(artwork.canvas, "image/jpeg", 0.94);

    if (!imageBlob) {
      return null;
    }

    return createImagePdfBlob(imageBlob, artwork.width, artwork.height);
  };

  const openPaymentPanel = () => {
    const scrollLeft = window.scrollX;
    const scrollTop = window.scrollY;
    const restoreScroll = () => window.scrollTo({ behavior: "auto", left: scrollLeft, top: scrollTop });

    setSelectedPaymentMethodId(paymentMethodSections[0]?.id ?? "");
    setIsTransferVisible(true);
    window.requestAnimationFrame(() => {
      restoreScroll();
      window.requestAnimationFrame(restoreScroll);
    });
  };

  const handleDownloadPaymentPdf = async () => {
    const shareData = getPaymentShareData();

    if (!shareData || !selectedPaymentMethod) {
      return;
    }

    const paymentPdf = await createPaymentPdfBlob();

    if (paymentPdf) {
      downloadBlob(paymentPdf, `${shareData.fileName}.pdf`);
    }
  };

  const handleDownloadPaymentImage = async () => {
    const shareData = getPaymentShareData();

    if (!shareData || !selectedPaymentMethod) {
      return;
    }

    await document.fonts?.ready;

    const artwork = await createPaymentArtwork();

    if (!artwork) {
      return;
    }

    const imageBlob = await canvasToBlob(artwork.canvas, "image/png");

    if (imageBlob) {
      downloadBlob(imageBlob, `${shareData.fileName}.png`);
    }
  };

  const handleSharePaymentDetails = async () => {
    const shareData = getPaymentShareData();

    if (!shareData || !selectedPaymentMethod) {
      return;
    }

    setIsShareFallbackVisible(false);
    setCopyMessage("");

    try {
      const paymentPdf = await createPaymentPdfBlob();

      if (!paymentPdf) {
        setIsShareFallbackVisible(true);
        return;
      }

      const paymentFile = new File([paymentPdf], `${shareData.fileName}.pdf`, { type: "application/pdf" });

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [paymentFile] }))) {
        await navigator.share({
          files: [paymentFile],
          text: "PDF con el resumen y datos de transferencia para inscripción Levitate MX.",
          title: "Datos de pago Levitate MX",
        });
        setCopyMessage("Compartido");
        return;
      }

      setIsShareFallbackVisible(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setIsShareFallbackVisible(true);
    }
  };

  const handlePaymentOrder = async () => {
    if (!lookup || visibleSubtotal <= 0) {
      return;
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    setPhoneNumber(normalizedPhoneNumber);
    setOrderError("");
    setWhatsappError("");

    if (!isPhoneNumberValid(normalizedPhoneNumber)) {
      setWhatsappError("Ingresa un número de WhatsApp válido.");
      return;
    }

    setIsOrderLoading(true);

    try {
      const response = await fetch("/api/registration/inscription/payment-order", {
        body: JSON.stringify({
          buyerPhone: buildBuyerPhone(phoneCountryCode, normalizedPhoneNumber),
          buyerPhoneCountryCode: phoneCountryCode,
          buyerPhoneNumber: normalizedPhoneNumber,
          curp: lookup.curp,
        }),
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
      openPaymentPanel();
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "No pudimos generar la orden de inscripción.");
    } finally {
      setIsOrderLoading(false);
    }
  };

  return (
    <div className="inscripciones-lookup-shell">
      <article
        className={`inscripciones-payment-portal${isTransferVisible && lookup ? " is-payment-open" : ""}`}
        aria-label="Portal de pagos de inscripción"
      >
        <section className="inscripciones-payment-main">
          <section className="inscripciones-lookup-search" aria-label="Consulta de inscripción por CURP">
            <form onSubmit={handleLookupSubmit}>
              <div className="inscripciones-lookup-search__field">
                <label htmlFor="inscription-curp">Buscar por CURP</label>
                <div className="inscripciones-curp-card__input">
                  <input
                    autoComplete="off"
                    className="inscripciones-lookup-search__curp-input"
                    id="inscription-curp"
                    maxLength={18}
                    minLength={18}
                    onChange={handleCurpChange}
                    placeholder="INGRESA TU CURP..."
                    value={curp}
                  />
                  <button
                    aria-label={isLookupLoading ? "Consultando inscripción" : "Consultar inscripción"}
                    className="inscripciones-lookup-search__submit"
                    disabled={isLookupLoading}
                    type="submit"
                  >
                    <Search aria-hidden="true" size={23} />
                  </button>
                </div>
              </div>
            </form>
            {lookupError ? (
              <p className="inscripciones-query-message is-error" role="alert">
                {lookupError}
              </p>
            ) : null}
          </section>

          {lookup ? (
            <section className="inscripciones-lookup-concepts" aria-labelledby="inscription-concepts-title">
              <header className="inscripciones-checkout-participant">
                <h2 id="inscription-concepts-title">{lookup.participantName}</h2>
                <span>{lookup.academyName} · {getVenueLabel(lookup.venue)}</span>
              </header>

              <div className="inscripciones-checkout-subhead">
                <span>
                  <CheckCircle2 aria-hidden="true" size={17} />
                  {lookup.pricingMode === "international" ? "Primeras 2 participaciones cortesía" : "Precio preventa respetado"}
                </span>
              </div>

              {visibleLines.length > 0 ? (
                <div className="inscripciones-choreography-list" aria-label="Conceptos asociados al CURP">
                  {visibleLines.map((line, index) => (
                    <div className="inscripciones-choreography-row" key={line.id}>
                      <div className="inscripciones-choreography-row__index">{index + 1}</div>
                      <div>
                        <div className="inscripciones-choreography-row__title-line">
                          <strong>{getLineTitle(line)}</strong>
                          {line.discountAmount ? (
                            <em className="inscripciones-choreography-row__discount">
                              {line.isCourtesy ? "Cortesía Levitate" : "50% de descuento"}
                            </em>
                          ) : null}
                        </div>
                        <span>{getLineMeta(line)}</span>
                      </div>
                      <div className="inscripciones-choreography-row__amount">
                        <span>
                          {line.discountAmount ? <del>{formatCurrency(line.baseAmount ?? line.amount, line.currency || visibleCurrency)}</del> : null}
                          <b>{line.isCourtesy ? "Cortesía" : formatCurrency(line.amount, line.currency || visibleCurrency)}</b>
                        </span>
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
                    <div>
                      <dt>Subtotal</dt>
                      <dd>{formatCurrency(visibleOriginalSubtotal, visibleCurrency)}</dd>
                    </div>
                    {visibleDiscount > 0 ? (
                      <div className="is-discount">
                        <dt>{lookup.pricingMode === "international" ? "Cortesías" : "Descuentos"}</dt>
                        <dd>-{formatCurrency(visibleDiscount, visibleCurrency)}</dd>
                      </div>
                    ) : null}
                    <div className="is-total">
                      <dt>Total a pagar</dt>
                      <dd>
                        <strong>{formatCurrency(visibleSubtotal, visibleCurrency)}</strong>
                        <span>{visibleCurrency}</span>
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="inscripciones-lookup-preview" aria-label="Estado de consulta">
              <ReceiptText aria-hidden="true" size={24} />
              <strong>Sin consulta todavía.</strong>
              <p>Ingresa el CURP para ver participante, coreografías y monto final.</p>
            </section>
          )}

          {orderError ? (
            <p className="inscripciones-query-message is-error" role="alert">
              {orderError}
            </p>
          ) : null}
        </section>

        <aside
          className={`inscripciones-payment-visual${isTransferVisible && lookup ? " is-payment-open" : ""}`}
          aria-label="Momento Levitate"
        >
          <img alt="" src="/assets/inscripciones-payment-moment.jpg" />

          {lookup && visibleLines.length > 0 && !isTransferVisible ? (
            <form
              className="inscripciones-photo-payment-actions"
              onSubmit={(event) => {
                event.preventDefault();
                void handlePaymentOrder();
              }}
            >
              <label className="inscripciones-photo-whatsapp">
                <MessageCircle aria-hidden="true" size={19} />
                <span>
                  WhatsApp para comprobante
                  <input
                    aria-invalid={Boolean(whatsappError)}
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={17}
                    onChange={handlePhoneNumberChange}
                    placeholder="(XX) XXXX-XXXX"
                    type="tel"
                    value={formatPhoneNumber(phoneNumber)}
                  />
                </span>
              </label>
              <button
                className="inscripciones-photo-payment-button"
                disabled={visibleSubtotal <= 0 || isOrderLoading}
                type="submit"
              >
                <span>{isOrderLoading ? "Generando..." : lookup.order ? "Ver datos de pago" : "Datos de pago"}</span>
                <ArrowRight aria-hidden="true" size={22} />
              </button>
              {whatsappError ? (
                <span className="inscripciones-photo-whatsapp__error" role="alert">
                  {whatsappError}
                </span>
              ) : null}
            </form>
          ) : null}

          {isTransferVisible && lookup ? (
            <section className="inscripciones-payment-sidepanel" aria-labelledby="payment-panel-title" ref={paymentPanelRef}>
              <header className="inscripciones-payment-sidepanel__header">
                <div>
                  <span>Datos para pago</span>
                  <h3 id="payment-panel-title">Opciones de pago</h3>
                </div>
                <div className="inscripciones-payment-sidepanel__actions">
                  <button
                    aria-label={
                      selectedPaymentMethod
                        ? "Compartir datos de pago"
                        : "Selecciona una opción de pago para compartir los datos"
                    }
                    className="inscripciones-share-button"
                    disabled={!selectedPaymentMethod}
                    onClick={handleSharePaymentDetails}
                    title={copyMessage || (selectedPaymentMethod ? "Compartir datos de pago" : "Selecciona una opción de pago")}
                    type="button"
                  >
                    <Upload aria-hidden="true" size={20} />
                  </button>
                  <button
                    aria-label="Cerrar datos de transferencia"
                    className="inscripciones-payment-sidepanel__close"
                    onClick={() => {
                      setIsTransferVisible(false);
                      setIsShareFallbackVisible(false);
                      setSelectedPaymentMethodId("");
                    }}
                    type="button"
                  >
                    <X aria-hidden="true" size={20} />
                  </button>
                </div>
              </header>

              <div className="inscripciones-payment-sidepanel__amount">
                <span>Total a transferir</span>
                <strong>{formatCurrency(visibleSubtotal, visibleCurrency)}</strong>
                <small>{getOrderStatusLabel(lookup.order?.status)}</small>
              </div>

              {isShareFallbackVisible ? (
                <div className="inscripciones-share-fallback" role="status">
                  <p>Tu navegador no abrió compartir. Guarda los datos para tenerlos a mano.</p>
                  <div>
                    <button onClick={handleDownloadPaymentPdf} type="button">
                      Descargar PDF
                    </button>
                    <button onClick={handleDownloadPaymentImage} type="button">
                      Guardar imagen
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="inscripciones-payment-methods" aria-label="Opciones disponibles para pagar">
                <div className="inscripciones-payment-method-tabs" role="tablist" aria-label="Selecciona una opción de pago">
                  {paymentMethodSections.map((method) => (
                    <button
                      aria-selected={selectedPaymentMethod?.id === method.id}
                      className={selectedPaymentMethod?.id === method.id ? "is-active" : ""}
                      key={method.id}
                      onClick={() => {
                        setSelectedPaymentMethodId(method.id);
                        setCopyMessage("");
                        setIsShareFallbackVisible(false);
                      }}
                      role="tab"
                      type="button"
                    >
                      {method.title}
                    </button>
                  ))}
                </div>

                {selectedPaymentMethod ? (
                  <>
                    <section className="inscripciones-payment-method" aria-label={`Datos de ${selectedPaymentMethod.title}`} role="tabpanel">
                      <dl className="inscripciones-payment-sidepanel__details inscripciones-payment-sidepanel__details--compact">
                        {selectedPaymentMethod.rows.map((row) => (
                          <div key={`${selectedPaymentMethod.id}-${row.label}`}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>

                    <dl className="inscripciones-payment-sidepanel__details inscripciones-payment-sidepanel__details--concept">
                      <div className="inscripciones-payment-sidepanel__concept">
                        <dt>
                          <span>Concepto</span>
                          <em aria-hidden="true">*</em>
                          <button
                            aria-label="Este concepto es personalizado e individual para cada participante."
                            data-tooltip="Este concepto es personalizado e individual para cada participante. Inclúyelo exactamente como aparece para identificar y validar tu pago."
                            type="button"
                          >
                            <Info aria-hidden="true" size={15} />
                          </button>
                        </dt>
                        <dd>
                          <strong>{getPaymentConcept(lookup)}</strong>
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : null}
              </div>

              {selectedPaymentMethod ? (
                <>
                  <p className="inscripciones-payment-sidepanel__notice">
                    Paga el monto exacto y usa este concepto personalizado e individual para que podamos identificar y validar tu pago.
                  </p>

                  {lookup.order?.proof ? (
                    <div className="inscripciones-proof-status">
                      <span>{isRejectedPaymentOrder ? "Comprobante anterior" : "Comprobante cargado"}</span>
                      <strong>{lookup.order.proof.fileName}</strong>
                      <p>
                        Recibido el {formatMexicoCityDate(lookup.order.proof.uploadedAt)} · {formatProofSize(lookup.order.proof.fileSize)}
                      </p>
                      <a download={lookup.order.proof.fileName} href={lookup.order.proof.dataUrl}>
                        Descargar comprobante
                      </a>
                    </div>
                  ) : null}

                  {lookup.order?.status === "rejected" && lookup.order.rejectionMessage ? (
                    <div className="inscripciones-proof-status inscripciones-proof-status--rejected" ref={proofCorrectionRef}>
                      <span>Pago no aprobado</span>
                      <strong>Hay que corregir el pago</strong>
                      <p>{lookup.order.rejectionMessage}</p>
                    </div>
                  ) : null}

                  {lookup.order && canUploadPaymentProof ? (
                    <div className="inscripciones-proof-uploader" ref={proofUploaderRef}>
                      <header>
                        <UploadCloud aria-hidden="true" size={34} />
                        <strong>{hasUploadedPaymentProof ? "Subir nuevo comprobante" : "Subir comprobante de pago"}</strong>
                        <span>
                          {hasUploadedPaymentProof
                            ? "Reemplazará el comprobante anterior para una nueva revisión"
                            : "JPG, PNG, WEBP o PDF menor a 1.8 MB"}
                        </span>
                      </header>
                      <input
                        accept={proofUploadAccept}
                        onChange={handleProofFileChange}
                        ref={proofFileInputRef}
                        type="file"
                      />
                      {selectedProofFile ? (
                        <p className="inscripciones-proof-selection">
                          <span>Archivo seleccionado</span>
                          <strong>{selectedProofFile.name}</strong>
                        </p>
                      ) : null}
                      <button
                        className="inscripciones-button inscripciones-button--solid"
                        disabled={isProofUploading}
                        onClick={handleProofSubmit}
                        type="button"
                      >
                        {isProofUploading ? "Enviando..." : selectedProofFile ? "Enviar comprobante" : "Seleccionar comprobante"}
                        <ArrowRight aria-hidden="true" size={18} />
                      </button>
                      {selectedProofFile ? (
                        <button
                          className="inscripciones-proof-change"
                          disabled={isProofUploading}
                          onClick={() => proofFileInputRef.current?.click()}
                          type="button"
                        >
                          Cambiar archivo
                        </button>
                      ) : null}
                      {proofError ? (
                        <p className="inscripciones-query-message is-error" role="alert">
                          {proofError}
                        </p>
                      ) : null}
                      {proofMessage ? <p className="inscripciones-query-message is-success">{proofMessage}</p> : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}
        </aside>
      </article>
    </div>
  );
}
