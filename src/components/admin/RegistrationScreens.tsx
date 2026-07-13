import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Home,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Menu,
  Minus,
  Music2,
  PanelLeftOpen,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  Shirt,
  Ticket,
  UserPlus,
  UserRoundPlus,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

type AdminScreenId = "home" | "choreographers" | "participants" | "dance" | "payments";
type AuthMode = "login" | "register";
type StatusTone = "success" | "error";

type AdminNavItem = {
  label: string;
  icon: LucideIcon;
  screen?: AdminScreenId;
  action?: "logout";
};

type FieldOption = {
  value: string;
  label: string;
};

type AdminFieldProps = {
  label: string;
  children: ReactNode;
  helper?: string;
  icon?: LucideIcon;
  className?: string;
};

type RegistrationSession = {
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
  academy: {
    id: string;
    name: string;
    venue: string;
    contactName: string;
    email: string;
    phone: string | null;
  };
};

type RegistrationParticipant = {
  id: string;
  fullName: string;
  curp: string;
  birthDate: string | null;
  age: number | null;
  division: string;
  shirtSize: string;
  createdAt: string;
};

type RegistrationChoreographer = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

type RegistrationDanceRelation = {
  id: string;
  fullName: string;
};

type RegistrationDance = {
  id: string;
  title: string;
  genre: string;
  subgenre: string;
  category: string;
  level: string | null;
  venue: string;
  createdAt: string;
  choreographers: RegistrationDanceRelation[];
  participants: RegistrationDanceRelation[];
};

type RegistrationInscriptionOrderStatus = "pending_payment" | "payment_reported" | "paid" | "rejected";
type RegistrationPaymentRejectionReason = "missing_proof" | "incomplete_amount" | "payment_not_found" | "invalid_or_unreadable_proof";

type RegistrationPaymentProof = {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  dataUrl: string;
  status: string;
  uploadedAt: string;
};

type RegistrationEventTicketStatus = "active" | "used" | "cancelled";

type RegistrationEventTicket = {
  id: string;
  sourceOrderType: string;
  sourceOrderId: string;
  ticketCode: string;
  ticketNumber: number;
  ticketLabel: string;
  holderName?: string | null;
  qrPayload: string;
  status: RegistrationEventTicketStatus;
  usedAt?: string | null;
  usedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

type RegistrationInscriptionLineItem = {
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

type RegistrationInscriptionOrder = {
  id: string;
  curp: string;
  participantName: string;
  academyId?: string | null;
  academyName: string;
  venue: string;
  reference: string;
  amount: number;
  paidAmount: number;
  status: RegistrationInscriptionOrderStatus;
  paymentMethod: string;
  lineItems?: RegistrationInscriptionLineItem[];
  buyerPhoneCountryCode?: string | null;
  buyerPhoneNumber?: string | null;
  buyerPhone?: string | null;
  notes?: string | null;
  paidAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: RegistrationPaymentRejectionReason | null;
  rejectionMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  proof?: RegistrationPaymentProof | null;
  tickets?: RegistrationEventTicket[];
};

type RegistrationBootstrap = RegistrationSession & {
  participants: RegistrationParticipant[];
  choreographers: RegistrationChoreographer[];
  dances: RegistrationDance[];
  inscriptionOrders: RegistrationInscriptionOrder[];
};

type RegistrationAdminOrderTotals = {
  amount: number;
  count: number;
  paid: number;
  paidAmount: number;
  pending: number;
  rejected: number;
  reported: number;
  withProof: number;
};

type RegistrationAdminOrdersPayload = {
  orders: RegistrationInscriptionOrder[];
  totals: RegistrationAdminOrderTotals;
};

type StudentRegistrationRecord = {
  id: string;
  fullName: string;
  curp: string;
  academyName: string;
  venue: string;
  division: string;
  shirtSize: string;
};

type StudentRegistrationDance = {
  id: string;
  title: string;
  category: string;
  level: string | null;
  venue: string;
  academyName: string;
};

type StudentRegistrationResource = {
  id: string;
  type: "payment" | "judge_sheet" | "media_drive";
  title: string;
  url: string | null;
  status: string;
};

type StudentRegistrationSession = {
  user: {
    id: string;
    curp: string;
  };
  registrations: StudentRegistrationRecord[];
  dances: StudentRegistrationDance[];
  resources: StudentRegistrationResource[];
};

type RegistrationApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

class RegistrationApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code = "request_error") {
    super(message);
    this.name = "RegistrationApiError";
    this.status = status;
    this.code = code;
  }
}

const adminMenuItems: AdminNavItem[] = [
  { label: "Inicio", icon: Home, screen: "home" },
  { label: "Registrar coreógrafos", icon: UserRoundPlus, screen: "choreographers" },
  { label: "Registrar alumnos", icon: GraduationCap, screen: "participants" },
  { label: "Registrar baile", icon: Music2, screen: "dance" },
  { label: "Pagos inscripción", icon: CreditCard, screen: "payments" },
  { label: "Reporte participante", icon: ClipboardList },
  { label: "Salir", icon: LogOut, action: "logout" },
];

const divisions: FieldOption[] = [
  { value: "baby", label: "Baby: hasta los 6 años" },
  { value: "mini", label: "Mini: 7 a 9 años" },
  { value: "junior", label: "Junior: 10 a 12 años" },
  { value: "teen", label: "Teen: 13 a 17 años" },
  { value: "adulto", label: "Adulto: 18 años en adelante" },
];

const shirtSizes: FieldOption[] = [
  { value: "6", label: "6 años" },
  { value: "8", label: "8 años" },
  { value: "10", label: "10 años" },
  { value: "12", label: "12 años" },
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
];

const danceGenres: FieldOption[] = [
  { value: "aereo", label: "Aerial" },
  { value: "motion", label: "Motion" },
];

const danceSubgenresByGenre: Record<string, FieldOption[]> = {
  aereo: [
    { value: "aro", label: "ARO" },
    { value: "tela", label: "TELA" },
    { value: "trapecio", label: "TRAPECIO" },
    { value: "open_aerial", label: "OPEN: AERIAL" },
  ],
  motion: [
    { value: "acrojazz", label: "ACROJAZZ" },
    { value: "ballet", label: "BALLET" },
    { value: "belly_dance", label: "BELLY DANCE" },
    { value: "contemporaneo", label: "CONTEMPORÁNEO" },
    { value: "folklore", label: "FOLKLORE" },
    { value: "jazz", label: "JAZZ" },
    { value: "lirico", label: "LÍRICO" },
    { value: "open_motion", label: "OPEN: MOTION" },
    { value: "urbanos", label: "URBANOS" },
  ],
};

const defaultDanceGenre = "aereo";
const defaultDanceSubgenre = danceSubgenresByGenre[defaultDanceGenre][0].value;

const danceCategories: FieldOption[] = [
  { value: "solo", label: "Solo" },
  { value: "duo", label: "Dúo" },
  { value: "trio", label: "Trío" },
  { value: "grupo", label: "Grupo" },
];

const danceLevels: FieldOption[] = [
  { value: "nudo", label: "Nudo" },
  { value: "principiante", label: "Principiante" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" },
  { value: "elite", label: "Élite" },
];

const venueOptions: FieldOption[] = [
  { value: "cdmx", label: "CDMX - 29 /31 mayo 2026" },
  { value: "puebla", label: "Puebla - 7 junio 2026" },
  { value: "edomex", label: "Edo. Méx. - 13 /15 noviembre 2026" },
];

const inscriptionOrderStatusOptions: FieldOption[] = [
  { value: "pending_payment", label: "Pendiente de pago" },
  { value: "payment_reported", label: "Pendiente de confirmación" },
  { value: "paid", label: "Pagada" },
  { value: "rejected", label: "Rechazada" },
];

const paymentRejectionReasonOptions: Array<FieldOption & { value: RegistrationPaymentRejectionReason }> = [
  { value: "missing_proof", label: "No subieron comprobante" },
  { value: "incomplete_amount", label: "Pagaron un monto incompleto" },
  { value: "payment_not_found", label: "No se encontró el pago" },
  { value: "invalid_or_unreadable_proof", label: "Comprobante incorrecto o ilegible" },
];

const studentPortalModules = [
  {
    title: "Pago de inscripción",
    text: "Orden, subtotal y comprobante de la inscripción asociada a tu CURP.",
    action: "Ir a inscripción",
    href: "/inscripciones/consulta-curp",
    resourceType: "payment",
    icon: CreditCard,
  },
  {
    title: "Tienda Levitate",
    text: "Compra boletos y paquetes de fotografía o video por separado.",
    action: "Ir a tienda",
    href: "/tienda#boletos",
    icon: ShoppingBag,
  },
  {
    title: "Hojas de jueceo",
    text: "Retroalimentación y resultados publicados por el equipo Levitate.",
    action: "Ver hojas",
    href: "",
    resourceType: "judge_sheet",
    icon: ClipboardList,
  },
  {
    title: "Fotos y videos",
    text: "Acceso al Drive del evento cuando el material esté disponible.",
    action: "Abrir Drive",
    href: "",
    resourceType: "media_drive",
    icon: Music2,
  },
] satisfies Array<{
  title: string;
  text: string;
  action: string;
  href: string;
  resourceType?: StudentRegistrationResource["type"];
  icon: LucideIcon;
}>;

const demoAcademyCredentials = {
  username: "demo_academia",
  password: "levitate123",
};

const demoStudentCredentials = {
  curp: "DEMO010101MDFLVT09",
};
const demoRegistrationSessionStorageKey = "levitate_demo_registration_session";
type DemoRegistrationSessionKind = "academy" | "student";

const demoRegistrationBootstrap: RegistrationBootstrap = {
  user: {
    id: "demo-academy-user",
    name: "Demo Academia",
    username: demoAcademyCredentials.username,
    email: "demo.academia@levitate.mx",
  },
  academy: {
    id: "demo-academy",
    name: "Academia Demo Levitate",
    venue: "edomex",
    contactName: "Demo Academia",
    email: "demo.academia@levitate.mx",
    phone: "55 0000 0000",
  },
  participants: [
    {
      id: "demo-participant-1",
      fullName: "Sofia Martinez Demo",
      curp: demoStudentCredentials.curp,
      birthDate: "2011-01-01",
      age: 15,
      division: "teen",
      shirtSize: "m",
      createdAt: "2026-07-04T00:00:00Z",
    },
    {
      id: "demo-participant-2",
      fullName: "Valentina Ruiz Demo",
      curp: "DEMO020202MDFLVT08",
      birthDate: "2014-02-02",
      age: 12,
      division: "junior",
      shirtSize: "s",
      createdAt: "2026-07-04T00:00:00Z",
    },
  ],
  choreographers: [
    {
      id: "demo-choreographer-1",
      fullName: "Camila Torres Demo",
      email: "camila.demo@levitate.mx",
      phone: "55 1111 1111",
      createdAt: "2026-07-04T00:00:00Z",
    },
  ],
  dances: [
    {
      id: "demo-dance-1",
      title: "Elevate Demo",
      genre: "motion",
      subgenre: "contemporaneo",
      category: "duo",
      level: null,
      venue: "edomex",
      createdAt: "2026-07-04T00:00:00Z",
      choreographers: [{ id: "demo-choreographer-1", fullName: "Camila Torres Demo" }],
      participants: [
        { id: "demo-participant-1", fullName: "Sofia Martinez Demo" },
        { id: "demo-participant-2", fullName: "Valentina Ruiz Demo" },
      ],
    },
  ],
  inscriptionOrders: [
    {
      id: "demo-inscription-order",
      curp: demoStudentCredentials.curp,
      participantName: "Sofia Martinez Demo",
      academyId: "demo-academy",
      academyName: "Academia Demo Levitate",
      venue: "edomex",
      reference: "LEV-EDOMEX-DEMO-VT09",
      amount: 2300,
      paidAmount: 0,
      status: "pending_payment",
      paymentMethod: "bank_transfer",
      notes: null,
      paidAt: null,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      rejectionMessage: null,
      createdAt: "2026-07-04T00:00:00Z",
      updatedAt: "2026-07-04T00:00:00Z",
      proof: null,
    },
  ],
};

const demoStudentSession: StudentRegistrationSession = {
  user: {
    id: "demo-student-user",
    curp: demoStudentCredentials.curp,
  },
  registrations: [
    {
      id: "demo-participant-1",
      fullName: "Sofia Martinez Demo",
      curp: demoStudentCredentials.curp,
      academyName: "Academia Demo Levitate",
      venue: "edomex",
      division: "teen",
      shirtSize: "m",
    },
  ],
  dances: [
    {
      id: "demo-dance-1",
      title: "Elevate Demo",
      category: "duo",
      level: null,
      venue: "edomex",
      academyName: "Academia Demo Levitate",
    },
  ],
  resources: [
    {
      id: "demo-payment",
      type: "payment",
      title: "Pago de inscripción demo para Sofia Martinez",
      url: "/inscripciones/consulta-curp",
      status: "available",
    },
    {
      id: "demo-judge-sheet",
      type: "judge_sheet",
      title: "Hoja de jueceo demo",
      url: "/evaluaciones",
      status: "available",
    },
    {
      id: "demo-media",
      type: "media_drive",
      title: "Drive demo de fotos y videos",
      url: "https://drive.google.com/",
      status: "available",
    },
  ],
};

function persistDemoRegistrationSession(kind: DemoRegistrationSessionKind) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(demoRegistrationSessionStorageKey, kind);
  }
}

function getPersistedDemoRegistrationSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(demoRegistrationSessionStorageKey);
  return value === "academy" || value === "student" ? value : null;
}

function clearPersistedDemoRegistrationSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(demoRegistrationSessionStorageKey);
  }
}

async function requestRegistrationApi<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers,
  });
  const payload = (await response.json().catch(() => null)) as (T & RegistrationApiErrorBody) | null;

  if (!response.ok) {
    throw new RegistrationApiError(
      payload?.error?.message || "No se pudo completar la solicitud.",
      response.status,
      payload?.error?.code,
    );
  }

  return payload as T;
}

function getFormValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function getOptionLabel(options: FieldOption[], value: string) {
  return options.find((option) => option.value === value)?.label || value;
}

function getDanceLevelLabel(level: string | null) {
  return level ? getOptionLabel(danceLevels, level) : "No aplica";
}

const adminCurrencyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatAdminCurrency(amount: number) {
  return adminCurrencyFormatter.format(amount);
}

function formatAdminFileSize(bytes: number) {
  if (bytes >= 1000000) {
    return `${(bytes / 1000000).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

function getInscriptionOrderStatusLabel(status: string) {
  return getOptionLabel(inscriptionOrderStatusOptions, status);
}

function getInscriptionOrderConcept(order: RegistrationInscriptionOrder) {
  return order.lineItems?.[0]?.title || "Inscripción participante";
}

function getAdminOrderDate(order: RegistrationInscriptionOrder) {
  const rawDate = order.updatedAt || order.createdAt;
  const date = new Date(rawDate);

  if (Number.isNaN(date.getTime())) {
    return { date: rawDate || "Sin fecha", time: "" };
  }

  return {
    date: date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
  };
}

function getAdminStatusClass(status: RegistrationInscriptionOrderStatus) {
  return `registration-admin-status registration-admin-status--${status.replace("_", "-")}`;
}

function getAdminPaymentStatusLabel(status: RegistrationInscriptionOrderStatus) {
  const labels: Record<RegistrationInscriptionOrderStatus, string> = {
    paid: "Aprobado",
    payment_reported: "Pendiente de confirmación",
    pending_payment: "Falta comprobante",
    rejected: "Rechazado",
  };

  return labels[status];
}

function getPaymentRejectionReasonLabel(reason?: string | null) {
  return getOptionLabel(paymentRejectionReasonOptions, reason || "");
}

function getDefaultPaymentRejectionReason(order: RegistrationInscriptionOrder): RegistrationPaymentRejectionReason {
  if (!order.proof) {
    return "missing_proof";
  }

  if (order.paidAmount > 0 && order.paidAmount < order.amount) {
    return "incomplete_amount";
  }

  return "invalid_or_unreadable_proof";
}

function buildPaymentRejectionMessage(order: RegistrationInscriptionOrder, reason: RegistrationPaymentRejectionReason) {
  const amount = formatAdminCurrency(order.amount);

  const messages: Record<RegistrationPaymentRejectionReason, string> = {
    incomplete_amount: `No pudimos aprobar tu pago porque el monto recibido no cubre el total de la orden ${order.reference}. El total correcto es ${amount}. Te reenviamos los datos de transferencia para completar el pago y volver a subir tu comprobante.`,
    invalid_or_unreadable_proof: `No pudimos aprobar tu pago porque el comprobante de la orden ${order.reference} no es legible o no corresponde al pago. Te reenviamos los datos de transferencia para que puedas revisar la operación y subir el comprobante correcto.`,
    missing_proof: `No pudimos aprobar tu pago porque falta subir el comprobante de la orden ${order.reference}. Te reenviamos los datos de transferencia para que puedas realizar o confirmar el pago y cargar el comprobante.`,
    payment_not_found: `No pudimos aprobar tu pago porque no encontramos una transferencia asociada a la referencia ${order.reference}. Te reenviamos los datos de transferencia para que puedas realizar el pago y subir el comprobante.`,
  };

  return messages[reason];
}

function getTicketStatusLabel(status: RegistrationEventTicketStatus) {
  const labels: Record<RegistrationEventTicketStatus, string> = {
    active: "Activo",
    cancelled: "Cancelado",
    used: "Usado",
  };

  return labels[status] ?? status;
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 700);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function loadAdminImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("No se pudo cargar la imagen.")), { once: true });
    image.src = src;
  });
}

async function createTicketArtwork(order: RegistrationInscriptionOrder, ticket: RegistrationEventTicket) {
  const scale = 2;
  const width = 842;
  const height = 1191;
  const padding = 64;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const [logo, qrImage] = await Promise.all([
    loadAdminImage("/assets/levitate-logo-mx.png").catch(() => null),
    QRCode.toDataURL(ticket.qrPayload, {
      color: { dark: "#050505", light: "#fffaf4" },
      errorCorrectionLevel: "H",
      margin: 1,
      width: 520,
    }).then(loadAdminImage),
  ]);

  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);

  const ink = "#111111";
  const muted = "rgba(17,17,17,0.58)";
  const paper = "#fffaf4";
  const pink = "#df4f95";
  const cyan = "#57bdd1";
  const line = "rgba(17,17,17,0.14)";

  const setFont = (size: number, weight = 650) => {
    context.font = `${weight} ${size}px Inter, Arial, sans-serif`;
  };

  const drawText = (text: string, x: number, y: number, size: number, color = ink, weight = 650) => {
    setFont(size, weight);
    context.fillStyle = color;
    context.fillText(text, x, y);
  };

  const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, size: number, lineHeight: number, color = ink, weight = 650) => {
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

    lines.slice(0, 4).forEach((lineText, index) => {
      context.fillText(lineText, x, y + index * lineHeight);
    });
  };

  const drawRoundRect = (x: number, y: number, rectWidth: number, rectHeight: number, radius: number, fillStyle?: string, strokeStyle?: string) => {
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

  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = line;
  context.lineWidth = 1;
  context.strokeRect(28, 28, width - 56, height - 56);

  if (logo) {
    const logoWidth = 172;
    const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);
    context.drawImage(logo, padding, 54, logoWidth, logoHeight);
  } else {
    drawText("Levitate", padding, 92, 34, ink, 820);
  }

  drawText("BOLETO DE ENTRADA", padding, 184, 18, pink, 880);
  drawWrappedText(ticket.ticketLabel, padding, 258, width - padding * 2, 64, 66, ink, 760);

  drawRoundRect(padding, 404, width - padding * 2, 424, 12, "rgba(255,255,255,0.62)", line);
  context.drawImage(qrImage, padding + 64, 458, 312, 312);

  drawText("Código", padding + 430, 506, 16, muted, 780);
  drawText(ticket.ticketCode, padding + 430, 548, 34, ink, 860);
  drawText("Estado", padding + 430, 614, 16, muted, 780);
  drawText(getTicketStatusLabel(ticket.status), padding + 430, 654, 30, ticket.status === "active" ? "#35734c" : "#a62c45", 820);
  drawText("Orden", padding + 430, 720, 16, muted, 780);
  drawWrappedText(order.reference, padding + 430, 760, width - padding * 2 - 430, 24, 28, ink, 780);

  const detailsY = 900;
  drawText("Comprador / Participante", padding, detailsY, 16, muted, 780);
  drawWrappedText(ticket.holderName || order.participantName, padding, detailsY + 42, width - padding * 2, 32, 38, ink, 780);
  drawText("Academia", padding, detailsY + 128, 16, muted, 780);
  drawWrappedText(order.academyName, padding, detailsY + 168, width - padding * 2, 28, 34, ink, 720);

  context.fillStyle = cyan;
  context.fillRect(padding, height - 104, width - padding * 2, 3);
  drawText("QR individual. Válido para una sola entrada. No compartir captura.", padding, height - 60, 18, muted, 720);

  return { canvas, height, width };
}

async function createMultiImagePdfBlob(pages: Array<{ canvas: HTMLCanvasElement; height: number; width: number }>) {
  const encodedPages = await Promise.all(
    pages.map(async (page) => {
      const imageBlob = await canvasToBlob(page.canvas, "image/jpeg", 0.94);

      if (!imageBlob) {
        throw new Error("No pudimos preparar una página del PDF.");
      }

      return {
        bytes: new Uint8Array(await imageBlob.arrayBuffer()),
        canvasHeight: page.canvas.height,
        canvasWidth: page.canvas.width,
        height: page.height,
        width: page.width,
      };
    }),
  );
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
  const kids = encodedPages.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  writeText(`<< /Type /Pages /Kids [${kids}] /Count ${encodedPages.length} >>\nendobj\n`);

  encodedPages.forEach((page, index) => {
    const pageObject = 3 + index * 3;
    const imageObject = pageObject + 1;
    const contentObject = pageObject + 2;
    const imageName = `Ticket${index + 1}`;
    const contentStream = `q\n${page.width} 0 0 ${page.height} 0 0 cm\n/${imageName} Do\nQ\n`;

    startObject(pageObject);
    writeText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /${imageName} ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>\nendobj\n`,
    );
    startObject(imageObject);
    writeText(
      `<< /Type /XObject /Subtype /Image /Width ${page.canvasWidth} /Height ${page.canvasHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`,
    );
    writeBytes(page.bytes);
    writeText("\nendstream\nendobj\n");
    startObject(contentObject);
    writeText(`<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}endstream\nendobj\n`);
  });

  const totalObjects = 2 + encodedPages.length * 3;
  const xrefOffset = offset;
  writeText(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);

  for (let objectNumber = 1; objectNumber <= totalObjects; objectNumber += 1) {
    writeText(`${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`);
  }

  writeText(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

async function createTicketsPdfBlob(order: RegistrationInscriptionOrder) {
  const tickets = order.tickets ?? [];

  if (tickets.length === 0) {
    return null;
  }

  await document.fonts?.ready;

  const pages = (
    await Promise.all(tickets.map((ticket) => createTicketArtwork(order, ticket)))
  ).filter((page): page is { canvas: HTMLCanvasElement; height: number; width: number } => Boolean(page));

  if (pages.length === 0) {
    return null;
  }

  return createMultiImagePdfBlob(pages);
}

function getPendingRegistrationAmount(totals: RegistrationAdminOrderTotals | null) {
  return Math.max(0, (totals?.amount ?? 0) - (totals?.paidAmount ?? 0));
}

function toRegistrationCsvValue(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadRegistrationOrdersCsv(orders: RegistrationInscriptionOrder[]) {
  const headers = [
    "Referencia",
    "CURP",
    "WhatsApp",
    "Participante",
    "Academia",
    "Sede",
    "Concepto",
    "Monto",
    "Pagado",
    "Estado",
    "Comprobante",
    "Boletos QR",
    "Revisado por",
    "Revisado el",
    "Motivo rechazo",
    "Mensaje rechazo",
  ];
  const rows = orders.map((order) => [
    order.reference,
    order.curp,
    order.buyerPhone ?? "",
    order.participantName,
    order.academyName,
    getOptionLabel(venueOptions, order.venue),
    getInscriptionOrderConcept(order),
    order.amount,
    order.paidAmount,
    getInscriptionOrderStatusLabel(order.status),
    order.proof?.fileName ?? "",
    order.tickets?.length ?? 0,
    order.reviewedBy ?? "",
    order.reviewedAt ?? "",
    getPaymentRejectionReasonLabel(order.rejectionReason),
    order.rejectionMessage ?? "",
  ]);
  const csv = [headers, ...rows].map((row) => row.map(toRegistrationCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "levitate-inscripciones-pagos.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isUnauthorizedRegistrationError(error: unknown) {
  return error instanceof RegistrationApiError && error.status === 401;
}

function LevitateAdminLogo() {
  return (
    <div className="levitate-admin-logo" aria-label="Levitate MX">
      <img src="/assets/levitate-logo-mx.png" alt="Levitate MX" />
    </div>
  );
}

function AdminSocials() {
  return (
    <div className="levitate-admin-socials" aria-label="Redes sociales">
      <span aria-label="Facebook">f</span>
      <span aria-label="Instagram">◎</span>
      <span aria-label="YouTube">▶</span>
    </div>
  );
}

function AdminTopBrand({ showBack = false }: { showBack?: boolean }) {
  return (
    <header className={`levitate-admin-topbar${showBack ? " levitate-admin-topbar--with-back" : ""}`}>
      {showBack ? (
        <a className="levitate-admin-back" href="/inscripciones">
          <ArrowLeft aria-hidden="true" size={18} />
          <span>Volver</span>
        </a>
      ) : null}
      <a className="levitate-admin-logo-link" href={showBack ? "/inscripciones" : "/"} aria-label="Levitate MX inicio">
        <LevitateAdminLogo />
      </a>
      {showBack ? null : <AdminSocials />}
    </header>
  );
}

function AdminField({ label, helper, icon: Icon, children, className = "" }: AdminFieldProps) {
  return (
    <label className={`levitate-admin-field ${className}`}>
      <span className="levitate-admin-field__label">
        {Icon ? <Icon aria-hidden="true" size={17} /> : null}
        {label}
      </span>
      {children}
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function AdminSelect({
  id,
  name,
  options,
  defaultValue,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  options: FieldOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <span className="levitate-admin-select">
      <select
        defaultValue={value === undefined ? (defaultValue ?? options[0]?.value) : undefined}
        id={id}
        name={name ?? id}
        onChange={onChange}
        required
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" size={18} />
    </span>
  );
}

function AdminPanel({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`levitate-admin-panel ${className}`}>
      <div className="levitate-admin-panel__heading">
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h1>{title}</h1>
      </div>
      {children}
    </section>
  );
}

function AdminStatusMessage({ message, tone = "success" }: { message: string; tone?: StatusTone }) {
  if (!message) {
    return null;
  }

  const Icon = tone === "error" ? CircleAlert : ShieldCheck;

  return (
    <p className={`levitate-auth-message${tone === "error" ? " levitate-auth-message--error" : ""}`}>
      <Icon aria-hidden="true" size={17} />
      {message}
    </p>
  );
}

function DemoCredentialsHint({
  label,
  username,
  password,
  curp,
}: {
  label: string;
  username?: string;
  password?: string;
  curp?: string;
}) {
  return (
    <p className="levitate-auth-demo">
      <span>{label}</span>
      {username ? <code>{username}</code> : null}
      {curp ? <code>{curp}</code> : null}
      {password ? <code>{password}</code> : null}
    </p>
  );
}

function SaveButton({
  disabled = false,
  isSaving = false,
  label = "Guardar registro",
}: {
  disabled?: boolean;
  isSaving?: boolean;
  label?: string;
}) {
  return (
    <button className="levitate-admin-save" disabled={disabled} type="submit">
      <Save aria-hidden="true" size={18} />
      {isSaving ? "Guardando..." : label}
    </button>
  );
}

function TransferList({
  sourceTitle,
  assignedTitle,
  sourceItems,
  selectedIds,
  onSelectionChange,
  emptyMessage,
}: {
  sourceTitle: string;
  assignedTitle: string;
  sourceItems: RegistrationDanceRelation[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  emptyMessage: string;
}) {
  const [query, setQuery] = useState("");
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = sourceItems.filter((item) => selectedIdSet.has(item.id));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? sourceItems.filter((item) => item.fullName.toLowerCase().includes(normalizedQuery))
    : sourceItems;

  const toggleItem = (id: string) => {
    if (selectedIdSet.has(id)) {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }

    onSelectionChange([...selectedIds, id]);
  };

  return (
    <div className="levitate-admin-transfer">
      <div className="levitate-admin-transfer__list">
        <div className="levitate-admin-transfer__title">
          <Users aria-hidden="true" size={18} />
          <h3>{sourceTitle}</h3>
        </div>
        <label className="levitate-admin-transfer__search">
          <Search aria-hidden="true" size={16} />
          <span>Buscar</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" />
        </label>
        <ul aria-label={sourceTitle}>
          {filteredItems.map((item) => (
            <li key={item.id}>
              <label className="levitate-admin-transfer__check">
                <input checked={selectedIdSet.has(item.id)} onChange={() => toggleItem(item.id)} type="checkbox" />
                <span>{item.fullName}</span>
              </label>
            </li>
          ))}
          {filteredItems.length === 0 ? <li className="levitate-admin-transfer__empty">{emptyMessage}</li> : null}
        </ul>
      </div>

      <div className="levitate-admin-transfer__actions" aria-label={`${sourceTitle} acciones`}>
        <button disabled={sourceItems.length === 0} onClick={() => onSelectionChange(sourceItems.map((item) => item.id))} type="button">
          <Plus aria-hidden="true" size={18} />
          Todos
        </button>
        <button disabled={selectedIds.length === 0} onClick={() => onSelectionChange([])} type="button">
          <Minus aria-hidden="true" size={18} />
          Limpiar
        </button>
      </div>

      <div className="levitate-admin-transfer__list">
        <div className="levitate-admin-transfer__title">
          <BadgeCheck aria-hidden="true" size={18} />
          <h3>{assignedTitle}</h3>
        </div>
        <ul aria-label={assignedTitle}>
          {selectedItems.map((item) => (
            <li key={item.id}>{item.fullName}</li>
          ))}
          {selectedItems.length === 0 ? <li className="levitate-admin-transfer__empty">Sin selección todavía.</li> : null}
        </ul>
      </div>
    </div>
  );
}

function RegistrationPageScaffold({ children }: { children: ReactNode }) {
  return (
    <main className="levitate-admin-page">
      <AdminTopBrand />
      <div className="levitate-admin-rule" aria-hidden="true" />
      <div className="levitate-admin-page__body">{children}</div>
    </main>
  );
}

function LoadingRegistrationScreen() {
  return (
    <main className="levitate-admin-page levitate-auth-page">
      <AdminTopBrand showBack />
      <div className="levitate-admin-rule" aria-hidden="true" />
      <section className="levitate-auth-shell">
        <div className="levitate-auth-copy">
          <p>Panel de academias</p>
          <h1>Acceso Levitate</h1>
          <span aria-hidden="true" />
          <div>
            <ShieldCheck aria-hidden="true" size={22} />
            <strong>Preparando tu sesión de registro.</strong>
          </div>
        </div>
        <section className="levitate-auth-card" aria-label="Cargando acceso">
          <div className="levitate-auth-form">
            <AdminStatusMessage message="Validando sesión..." />
          </div>
        </section>
      </section>
    </main>
  );
}

export function LevitateRegistrationEntryRoute() {
  return (
    <main className="levitate-admin-page levitate-auth-page">
      <AdminTopBrand showBack />
      <div className="levitate-admin-rule" aria-hidden="true" />

      <section className="levitate-registration-choice">
        <div className="levitate-registration-choice__copy">
          <p>Registro Levitate</p>
          <h1>Elige tu acceso.</h1>
          <span aria-hidden="true" />
          <strong>
            Academias administran participantes y bailes. Alumnos consultan pagos y materiales asociados directamente a su CURP.
          </strong>
        </div>

        <div className="levitate-registration-choice__cards" aria-label="Tipos de registro">
          <a className="levitate-registration-choice-card" href="/registro/academias">
            <Building2 aria-hidden="true" size={28} />
            <span>Academias</span>
            <h2>Registrar academia</h2>
            <p>Acceso para titulares de academia: participantes, coreógrafos y bailes.</p>
          </a>
          <a className="levitate-registration-choice-card" href="/registro/alumnos">
            <GraduationCap aria-hidden="true" size={28} />
            <span>Alumnos</span>
            <h2>Ingresar con CURP</h2>
            <p>Consulta pagos, hojas de jueceo, fotos y videos sin usuario ni contraseña.</p>
          </a>
        </div>
      </section>
    </main>
  );
}

function LevitateAuthScreen({
  onAuthenticated,
  systemMessage = "",
}: {
  onAuthenticated: (session: RegistrationSession | RegistrationBootstrap) => void;
  systemMessage?: string;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setLoginError("");

    try {
      const username = getFormValue(formData, "username");
      const password = getFormValue(formData, "password");

      if (username.toLowerCase() === demoAcademyCredentials.username && password === demoAcademyCredentials.password) {
        persistDemoRegistrationSession("academy");
        onAuthenticated(demoRegistrationBootstrap);
        return;
      }

      clearPersistedDemoRegistrationSession();
      const session = await requestRegistrationApi<RegistrationSession>("/api/registration/auth/login", {
        body: JSON.stringify({
          username,
          password,
        }),
        method: "POST",
      });

      onAuthenticated(session);
    } catch (error) {
      setLoginError(getErrorMessage(error, "No se pudo iniciar sesión."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSubmitting(true);
    setRegisterError("");

    try {
      const session = await requestRegistrationApi<RegistrationSession>("/api/registration/auth/register", {
        body: JSON.stringify({
          name: getFormValue(formData, "name"),
          username: getFormValue(formData, "username"),
          email: getFormValue(formData, "email"),
          password: getFormValue(formData, "password"),
          academy: getFormValue(formData, "academy"),
          phone: getFormValue(formData, "phone"),
          venue: "cdmx",
        }),
        method: "POST",
      });

      form.reset();
      onAuthenticated(session);
    } catch (error) {
      setRegisterError(getErrorMessage(error, "No se pudo crear el usuario."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="levitate-admin-page levitate-auth-page">
      <AdminTopBrand showBack />
      <div className="levitate-admin-rule" aria-hidden="true" />

      <section className="levitate-auth-shell">
        <div className="levitate-auth-copy">
          <p>Panel de academias</p>
          <h1>Acceso Levitate</h1>
          <span aria-hidden="true" />
          <div>
            <ShieldCheck aria-hidden="true" size={22} />
            <strong>
              Gestión privada para titulares y responsables de academias. Registra a tus participantes, maestros y
              coreografías.
            </strong>
          </div>
        </div>

        <section className={`levitate-auth-card levitate-auth-card--${mode}`} aria-label="Acceso de usuario">
          <div className="levitate-auth-tabs" role="tablist" aria-label="Acceso o registro">
            <button
              aria-selected={mode === "login"}
              className={mode === "login" ? "is-active" : ""}
              onClick={() => {
                setMode("login");
                setLoginError("");
              }}
              role="tab"
              type="button"
            >
              <LogIn aria-hidden="true" size={17} />
              Ingresar
            </button>
            <button
              aria-selected={mode === "register"}
              className={mode === "register" ? "is-active" : ""}
              onClick={() => {
                setMode("register");
                setRegisterError("");
              }}
              role="tab"
              type="button"
            >
              <UserPlus aria-hidden="true" size={17} />
              Crear usuario
            </button>
          </div>

          {mode === "login" ? (
            <form className="levitate-auth-form levitate-auth-form--login" onSubmit={handleLoginSubmit}>
              <AdminStatusMessage message={systemMessage} tone="error" />
              <DemoCredentialsHint
                label="Demo academia"
                password={demoAcademyCredentials.password}
                username={demoAcademyCredentials.username}
              />
              <AdminField icon={AtSign} label="Usuario o correo">
                <input autoComplete="username" name="username" required type="text" />
              </AdminField>
              <AdminField icon={KeyRound} label="Contraseña">
                <input autoComplete="current-password" name="password" required type="password" />
              </AdminField>
              <AdminStatusMessage message={loginError} tone="error" />
              <button className="levitate-auth-submit" disabled={isSubmitting} type="submit">
                <LogIn aria-hidden="true" size={18} />
                {isSubmitting ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          ) : (
            <form className="levitate-auth-form levitate-auth-form--register" onSubmit={handleRegisterSubmit}>
              <AdminStatusMessage message={systemMessage} tone="error" />
              <span className="levitate-auth-form__section-label">Responsable</span>
              <AdminField icon={Users} label="Nombre del responsable">
                <input autoComplete="name" name="name" required type="text" />
              </AdminField>
              <AdminField icon={AtSign} label="Usuario">
                <input autoComplete="username" name="username" required type="text" />
              </AdminField>
              <AdminField icon={Mail} label="Correo electrónico">
                <input autoComplete="email" name="email" required type="email" />
              </AdminField>
              <AdminField helper="Mínimo 8 caracteres." icon={KeyRound} label="Contraseña">
                <input autoComplete="new-password" minLength={8} name="password" required type="password" />
              </AdminField>
              <span className="levitate-auth-form__section-label">Academia</span>
              <AdminField icon={Building2} label="Nombre de la Academia o Escuela">
                <input name="academy" required type="text" />
              </AdminField>
              <AdminField icon={Phone} label="Teléfono">
                <input autoComplete="tel" name="phone" type="tel" />
              </AdminField>
              <AdminStatusMessage message={registerError} tone="error" />
              <button className="levitate-auth-submit" disabled={isSubmitting} type="submit">
                <UserPlus aria-hidden="true" size={18} />
                {isSubmitting ? "Creando..." : "Crear usuario"}
              </button>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}

function LevitateStudentAuthScreen({
  onAuthenticated,
  systemMessage = "",
}: {
  onAuthenticated: (session: StudentRegistrationSession) => void;
  systemMessage?: string;
}) {
  const [accessError, setAccessError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccessSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setAccessError("");

    try {
      const curp = getFormValue(formData, "curp").toUpperCase();

      if (curp === demoStudentCredentials.curp) {
        persistDemoRegistrationSession("student");
        onAuthenticated(demoStudentSession);
        return;
      }

      clearPersistedDemoRegistrationSession();
      const session = await requestRegistrationApi<StudentRegistrationSession>("/api/registration/student/login", {
        body: JSON.stringify({
          curp,
        }),
        method: "POST",
      });

      onAuthenticated(session);
    } catch (error) {
      setAccessError(getErrorMessage(error, "No se pudo acceder al portal."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="levitate-admin-page levitate-auth-page">
      <AdminTopBrand showBack />
      <div className="levitate-admin-rule" aria-hidden="true" />

      <section className="levitate-auth-shell levitate-student-auth-shell">
        <div className="levitate-auth-copy">
          <p>Portal de alumnos</p>
          <h1>Ingresa con tu CURP.</h1>
          <span aria-hidden="true" />
          <div>
            <ShieldCheck aria-hidden="true" size={22} />
            <strong>Consulta pagos, hojas de jueceo, fotos y videos asociados a la CURP registrada por tu academia.</strong>
          </div>
        </div>

        <section className="levitate-auth-card" aria-label="Acceso de alumno">
          <form className="levitate-auth-form" onSubmit={handleAccessSubmit}>
            <AdminStatusMessage message={systemMessage} tone="error" />
            <DemoCredentialsHint curp={demoStudentCredentials.curp} label="Demo alumno" />
            <AdminField helper="La CURP debe tener 18 caracteres." icon={ClipboardList} label="CURP">
              <input autoComplete="off" maxLength={18} minLength={18} name="curp" required type="text" />
            </AdminField>
            <AdminStatusMessage message={accessError} tone="error" />
            <button className="levitate-auth-submit" disabled={isSubmitting} type="submit">
              <LogIn aria-hidden="true" size={18} />
              {isSubmitting ? "Ingresando..." : "Ingresar con CURP"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

function LevitateStudentPortal({
  session,
  onLogout,
}: {
  session: StudentRegistrationSession;
  onLogout: () => void;
}) {
  return (
    <main className="levitate-admin-page levitate-student-portal">
      <AdminTopBrand />
      <div className="levitate-admin-rule" aria-hidden="true" />

      <section className="levitate-student-portal__hero">
        <div>
          <p>Portal de alumnos</p>
          <h1>Hola, {session.registrations[0]?.fullName || "alumno Levitate"}.</h1>
          <div className="levitate-student-portal__meta">
            <span>CURP: {session.user.curp}</span>
            <span>{session.registrations.length} registro(s) asociado(s)</span>
            <span>{session.dances.length} baile(s)</span>
          </div>
        </div>
        <button className="levitate-admin-save levitate-student-portal__logout" onClick={onLogout} type="button">
          <LogOut aria-hidden="true" size={18} />
          Salir
        </button>
      </section>

      <section className="levitate-student-module-grid" aria-label="Acciones de alumno">
        {studentPortalModules.map((module) => {
          const Icon = module.icon;
          const resource = module.resourceType
            ? session.resources.find((item) => item.type === module.resourceType && item.url)
            : undefined;
          const href = resource?.url || module.href;
          const isAvailable = Boolean(href);

          return isAvailable ? (
            <a className="levitate-student-module-card" href={href} key={module.title}>
              <Icon aria-hidden="true" size={24} />
              <h2>{module.title}</h2>
              <p>{resource?.title || module.text}</p>
              <span>{module.action}</span>
            </a>
          ) : (
            <article className="levitate-student-module-card is-disabled" key={module.title}>
              <Icon aria-hidden="true" size={24} />
              <h2>{module.title}</h2>
              <p>{module.text}</p>
              <span>Próximamente</span>
            </article>
          );
        })}
      </section>

      <section className="levitate-student-data-grid">
        <AdminPanel title="Registros asociados" eyebrow="CURP">
          <div className="levitate-student-list">
            {session.registrations.map((registration) => (
              <article key={registration.id}>
                <strong>{registration.fullName}</strong>
                <span>{registration.academyName}</span>
                <p>
                  {getOptionLabel(venueOptions, registration.venue)} · {getOptionLabel(divisions, registration.division)} · Playera{" "}
                  {getOptionLabel(shirtSizes, registration.shirtSize)}
                </p>
              </article>
            ))}
            {session.registrations.length === 0 ? (
              <p className="levitate-admin-empty-state">
                Todavía no hay registros de academia asociados a este CURP. Cuando una academia te registre, aparecerá aquí.
              </p>
            ) : null}
          </div>
        </AdminPanel>

        <AdminPanel title="Bailes" eyebrow="Competencia">
          <div className="levitate-student-list">
            {session.dances.map((dance) => (
              <article key={dance.id}>
                <strong>{dance.title}</strong>
                <span>{dance.academyName}</span>
                <p>
                  {getOptionLabel(venueOptions, dance.venue)} · {getOptionLabel(danceCategories, dance.category)} ·{" "}
                  {getDanceLevelLabel(dance.level)}
                </p>
              </article>
            ))}
            {session.dances.length === 0 ? <p className="levitate-admin-empty-state">Aún no hay bailes asociados a tu CURP.</p> : null}
          </div>
        </AdminPanel>
      </section>
    </main>
  );
}

function AdminSidebar({
  activeScreen,
  session,
  onScreenChange,
  onLogout,
}: {
  activeScreen: AdminScreenId;
  session: RegistrationSession;
  onScreenChange: (screen: AdminScreenId) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="levitate-admin-sidebar" aria-label="Menú administrativo">
      <h2>Menu</h2>
      <nav>
        {adminMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.screen === activeScreen;

          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "is-active" : ""}
              key={item.label}
              onClick={() => {
                if (item.action === "logout") {
                  onLogout();
                  return;
                }

                if (item.screen) {
                  onScreenChange(item.screen);
                }
              }}
              type="button"
            >
              <Icon aria-hidden="true" size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="levitate-admin-sidebar__meta">
        <p>Usuario: {session.user.name}</p>
        <p>Academia: {session.academy.name}</p>
        <p>Sede: {getOptionLabel(venueOptions, session.academy.venue)}</p>
      </div>

      <small>© Levitate. Website: levitate.mx.</small>
    </aside>
  );
}

function ParticipantRegistrationPanel({
  onParticipantCreated,
}: {
  onParticipantCreated: (participant: RegistrationParticipant) => void;
}) {
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await requestRegistrationApi<{ participant: RegistrationParticipant }>("/api/registration/participants", {
        body: JSON.stringify({
          fullName: getFormValue(formData, "fullName"),
          curp: getFormValue(formData, "curp"),
          birthDate: getFormValue(formData, "birthDate"),
          age: getFormValue(formData, "age"),
          division: getFormValue(formData, "division"),
          shirtSize: getFormValue(formData, "shirtSize"),
        }),
        method: "POST",
      });

      onParticipantCreated(response.participant);
      form.reset();
      setStatusMessage("Participante guardado en la base.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "No se pudo guardar el participante."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPanel title="Registro de nuevo participante" eyebrow="Inscripciones">
      <form className="levitate-admin-form" onSubmit={handleSubmit}>
        <AdminField icon={Users} label="Nombre del participante">
          <input name="fullName" required type="text" />
        </AdminField>
        <AdminField helper="Ingrese su CURP (18 caracteres)" icon={ClipboardList} label="CURP">
          <input maxLength={18} minLength={18} name="curp" required type="text" />
        </AdminField>
        <AdminField icon={CalendarDays} label="Fecha de nacimiento">
          <input name="birthDate" type="date" />
        </AdminField>
        <AdminField icon={BadgeCheck} label="Edad">
          <input min={0} name="age" type="number" />
        </AdminField>
        <AdminField icon={GraduationCap} label="División">
          <AdminSelect defaultValue="baby" id="participant-division" name="division" options={divisions} />
        </AdminField>
        <AdminField icon={Shirt} label="Talla playera">
          <AdminSelect defaultValue="8" id="participant-shirt" name="shirtSize" options={shirtSizes} />
        </AdminField>
        <div className="levitate-admin-form__wide-block">
          <AdminStatusMessage message={statusMessage} />
          <AdminStatusMessage message={errorMessage} tone="error" />
        </div>
        <div className="levitate-admin-form__actions">
          <SaveButton disabled={isSaving} isSaving={isSaving} />
        </div>
      </form>
    </AdminPanel>
  );
}

function ChoreographerRegistrationPanel({
  academyName,
  onChoreographerCreated,
}: {
  academyName: string;
  onChoreographerCreated: (choreographer: RegistrationChoreographer) => void;
}) {
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await requestRegistrationApi<{ choreographer: RegistrationChoreographer }>(
        "/api/registration/choreographers",
        {
          body: JSON.stringify({
            fullName: getFormValue(formData, "fullName"),
            email: getFormValue(formData, "email"),
            phone: getFormValue(formData, "phone"),
          }),
          method: "POST",
        },
      );

      onChoreographerCreated(response.choreographer);
      form.reset();
      setStatusMessage("Coreógrafo guardado en la base.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "No se pudo guardar el coreógrafo."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPanel title="Registro de nuevo coreógrafo" eyebrow="Academias">
      <form className="levitate-admin-form levitate-admin-form--compact" onSubmit={handleSubmit}>
        <AdminField icon={Users} label="Nombre del coreógrafo">
          <input name="fullName" required type="text" />
        </AdminField>
        <AdminField icon={Mail} label="Correo electrónico">
          <input name="email" type="email" />
        </AdminField>
        <AdminField icon={Phone} label="Teléfono">
          <input name="phone" type="tel" />
        </AdminField>
        <AdminField icon={Building2} label="Nombre de la academia">
          <input readOnly type="text" value={academyName} />
        </AdminField>
        <div className="levitate-admin-form__wide-block">
          <AdminStatusMessage message={statusMessage} />
          <AdminStatusMessage message={errorMessage} tone="error" />
        </div>
        <div className="levitate-admin-form__actions">
          <SaveButton disabled={isSaving} isSaving={isSaving} />
        </div>
      </form>
    </AdminPanel>
  );
}

function DanceRegistrationPanel({
  academyVenue,
  choreographers,
  participants,
  dances,
  onDanceCreated,
}: {
  academyVenue: string;
  choreographers: RegistrationChoreographer[];
  participants: RegistrationParticipant[];
  dances: RegistrationDance[];
  onDanceCreated: (dance: RegistrationDance) => void;
}) {
  const [selectedChoreographerIds, setSelectedChoreographerIds] = useState<string[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState(defaultDanceGenre);
  const [selectedSubgenre, setSelectedSubgenre] = useState(defaultDanceSubgenre);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const subgenreOptions = danceSubgenresByGenre[selectedGenre] ?? danceSubgenresByGenre[defaultDanceGenre];
  const shouldShowLevel = selectedGenre !== "motion";
  const choreographerItems = choreographers.map((choreographer) => ({
    id: choreographer.id,
    fullName: choreographer.fullName,
  }));
  const participantItems = participants.map((participant) => ({
    id: participant.id,
    fullName: participant.fullName,
  }));
  const cannotSave = isSaving || choreographers.length === 0 || participants.length === 0;

  const handleGenreChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextGenre = event.target.value;
    const nextSubgenre = danceSubgenresByGenre[nextGenre]?.[0]?.value ?? defaultDanceSubgenre;

    setSelectedGenre(nextGenre);
    setSelectedSubgenre(nextSubgenre);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await requestRegistrationApi<{ dance: RegistrationDance }>("/api/registration/dances", {
        body: JSON.stringify({
          title: getFormValue(formData, "title"),
          genre: getFormValue(formData, "genre"),
          subgenre: getFormValue(formData, "subgenre"),
          category: getFormValue(formData, "category"),
          level: shouldShowLevel ? getFormValue(formData, "level") : null,
          venue: academyVenue,
          choreographerIds: selectedChoreographerIds,
          participantIds: selectedParticipantIds,
        }),
        method: "POST",
      });

      onDanceCreated(response.dance);
      form.reset();
      setSelectedGenre(defaultDanceGenre);
      setSelectedSubgenre(defaultDanceSubgenre);
      setSelectedChoreographerIds([]);
      setSelectedParticipantIds([]);
      setStatusMessage("Baile guardado en la base.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "No se pudo guardar el baile."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <AdminPanel className="levitate-admin-panel--dance" title="Registro de nuevo baile" eyebrow="Competencia">
        <form className="levitate-admin-form levitate-admin-form--dance" onSubmit={handleSubmit}>
          <AdminField className="levitate-admin-field--wide" icon={Music2} label="Nombre del baile">
            <input name="title" required type="text" />
          </AdminField>
          <AdminField icon={Music2} label="Género de baile">
            <AdminSelect id="dance-genre" name="genre" onChange={handleGenreChange} options={danceGenres} value={selectedGenre} />
          </AdminField>
          <AdminField icon={Music2} label="Subgénero">
            <AdminSelect
              id="dance-subgenre"
              name="subgenre"
              onChange={(event) => setSelectedSubgenre(event.target.value)}
              options={subgenreOptions}
              value={selectedSubgenre}
            />
          </AdminField>
          <AdminField icon={Users} label="Categoría">
            <AdminSelect defaultValue="solo" id="dance-category" name="category" options={danceCategories} />
          </AdminField>
          {shouldShowLevel ? (
            <AdminField icon={BadgeCheck} label="Nivel">
              <AdminSelect defaultValue="nudo" id="dance-level" name="level" options={danceLevels} />
            </AdminField>
          ) : null}

          <div className="levitate-admin-form__wide-block">
            <TransferList
              assignedTitle="Coreógrafos inscritos"
              emptyMessage="Registra un coreógrafo primero."
              onSelectionChange={setSelectedChoreographerIds}
              selectedIds={selectedChoreographerIds}
              sourceItems={choreographerItems}
              sourceTitle="Coreógrafos"
            />
          </div>

          <div className="levitate-admin-form__wide-block">
            <TransferList
              assignedTitle="Participantes inscritos"
              emptyMessage="Registra un participante primero."
              onSelectionChange={setSelectedParticipantIds}
              selectedIds={selectedParticipantIds}
              sourceItems={participantItems}
              sourceTitle="Alumnos"
            />
          </div>

          <div className="levitate-admin-form__wide-block">
            <AdminStatusMessage message={statusMessage} />
            <AdminStatusMessage message={errorMessage} tone="error" />
          </div>
          <div className="levitate-admin-form__actions">
            <SaveButton disabled={cannotSave} isSaving={isSaving} />
          </div>
        </form>
      </AdminPanel>
      <section className="levitate-admin-panel levitate-admin-registered-panel" aria-label="Bailes registrados">
        <div className="levitate-admin-panel__heading">
          <p>Consulta</p>
          <h2>Bailes registrados</h2>
        </div>
        <div className="levitate-admin-registered-panel__table" role="table" aria-label="Bailes registrados">
          <span role="columnheader">Baile</span>
          <span role="columnheader">Categoría</span>
          <span role="columnheader">Nivel</span>
          <span role="columnheader">Participantes</span>
          {dances.map((dance) => (
            <div className="levitate-admin-registered-panel__row" role="row" key={dance.id}>
              <span role="cell">{dance.title}</span>
              <span role="cell">{getOptionLabel(danceCategories, dance.category)}</span>
              <span role="cell">{getDanceLevelLabel(dance.level)}</span>
              <span role="cell">{dance.participants.map((participant) => participant.fullName).join(", ")}</span>
            </div>
          ))}
          {dances.length === 0 ? <p className="levitate-admin-empty-state">Todavía no hay bailes registrados.</p> : null}
        </div>
      </section>
    </>
  );
}

function InscriptionOrdersPanel({
  emptyMessage = "Todavía no hay órdenes. Se crean cuando una familia consulta una CURP y presiona pagar inscripción.",
  orders,
  onOrderUpdated,
}: {
  emptyMessage?: string;
  orders: RegistrationInscriptionOrder[];
  onOrderUpdated: (order: RegistrationInscriptionOrder) => void;
}) {
  return (
    <AdminPanel title="Pagos de inscripción" eyebrow="Control">
      <div className="levitate-admin-payment-list">
        {orders.length > 0 ? (
          orders.map((order) => <InscriptionOrderCard key={order.id} onOrderUpdated={onOrderUpdated} order={order} />)
        ) : (
          <p className="levitate-admin-empty-state">{emptyMessage}</p>
        )}
      </div>
    </AdminPanel>
  );
}

function InscriptionOrderCard({
  order,
  onOrderUpdated,
}: {
  order: RegistrationInscriptionOrder;
  onOrderUpdated: (order: RegistrationInscriptionOrder) => void;
}) {
  const [status, setStatus] = useState<RegistrationInscriptionOrderStatus>(order.status);
  const [paidAmount, setPaidAmount] = useState(String(order.paidAmount || ""));
  const [notes, setNotes] = useState(order.notes ?? "");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStatus(order.status);
    setPaidAmount(String(order.paidAmount || ""));
    setNotes(order.notes ?? "");
  }, [order]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    const nextPaidAmount = paidAmount === "" ? null : Number(paidAmount);

    try {
      if (order.id.startsWith("demo-")) {
        const now = new Date().toISOString();
        const nextOrder: RegistrationInscriptionOrder = {
          ...order,
          status,
          paidAmount: nextPaidAmount ?? order.paidAmount,
          notes: notes.trim() || null,
          paidAt: status === "paid" ? (order.paidAt ?? now) : null,
          updatedAt: now,
        };

        onOrderUpdated(nextOrder);
        setStatusMessage("Orden demo actualizada.");
        return;
      }

      const response = await requestRegistrationApi<{ order: RegistrationInscriptionOrder }>("/api/registration/inscription/order/status", {
        body: JSON.stringify({
          id: order.id,
          notes,
          paidAmount: nextPaidAmount,
          status,
        }),
        method: "POST",
      });

      onOrderUpdated(response.order);
      setStatusMessage("Orden actualizada.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "No se pudo actualizar la orden."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="levitate-admin-payment-card" onSubmit={handleSubmit}>
      <header>
        <div>
          <span>{order.reference}</span>
          <h3>{order.participantName}</h3>
          <p>
            {order.curp} · {getOptionLabel(venueOptions, order.venue)}
          </p>
        </div>
        <strong>{formatAdminCurrency(order.amount)}</strong>
      </header>

      <dl>
        <div>
          <dt>Academia</dt>
          <dd>{order.academyName}</dd>
        </div>
        <div>
          <dt>Estado actual</dt>
          <dd>{getInscriptionOrderStatusLabel(order.status)}</dd>
        </div>
        <div>
          <dt>Pagado</dt>
          <dd>{formatAdminCurrency(order.paidAmount)}</dd>
        </div>
        <div>
          <dt>Comprobante</dt>
          <dd>{order.proof ? "Recibido" : "Pendiente"}</dd>
        </div>
      </dl>

      {order.proof ? (
        <div className="levitate-admin-payment-proof">
          <div>
            <span>Comprobante</span>
            <strong>{order.proof.fileName}</strong>
            <p>
              {new Date(order.proof.uploadedAt).toLocaleDateString("es-MX")} · {formatAdminFileSize(order.proof.fileSize)}
            </p>
          </div>
          <a download={order.proof.fileName} href={order.proof.dataUrl}>
            Ver comprobante
          </a>
        </div>
      ) : null}

      <div className="levitate-admin-payment-card__fields">
        <AdminField icon={CreditCard} label="Estado">
          <AdminSelect
            id={`order-status-${order.id}`}
            name="status"
            onChange={(event) => setStatus(event.target.value as RegistrationInscriptionOrderStatus)}
            options={inscriptionOrderStatusOptions}
            value={status}
          />
        </AdminField>
        <AdminField icon={CreditCard} label="Monto pagado">
          <input min={0} onChange={(event) => setPaidAmount(event.target.value)} type="number" value={paidAmount} />
        </AdminField>
        <AdminField className="levitate-admin-field--wide" icon={ClipboardList} label="Notas internas">
          <input onChange={(event) => setNotes(event.target.value)} placeholder="Ej. comprobante recibido por WhatsApp" type="text" value={notes} />
        </AdminField>
      </div>

      <div className="levitate-admin-form__wide-block">
        <AdminStatusMessage message={statusMessage} />
        <AdminStatusMessage message={errorMessage} tone="error" />
      </div>

      <div className="levitate-admin-form__actions">
        <SaveButton disabled={isSaving} isSaving={isSaving} label="Actualizar orden" />
      </div>
    </form>
  );
}

export function LevitateRegistrationAdminPaymentsRoute() {
  const [orders, setOrders] = useState<RegistrationInscriptionOrder[]>([]);
  const [totals, setTotals] = useState<RegistrationAdminOrderTotals | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadAdminOrders = useCallback(async () => {
    setIsLoading(true);
    setAdminError("");

    try {
      const payload = await requestRegistrationApi<RegistrationAdminOrdersPayload>("/api/registration/admin/inscription-orders");
      setOrders(payload.orders);
      setTotals(payload.totals);
      setSelectedOrderId((current) => (payload.orders.some((order) => order.id === current) ? current : ""));
    } catch (error) {
      setAdminError(getErrorMessage(error, "No se pudo cargar el panel de inscripciones."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdminOrders();
  }, [loadAdminOrders]);

  useEffect(() => {
    if (!selectedOrderId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedOrderId("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedOrderId]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesVenue = venueFilter === "all" || order.venue === venueFilter;
      const matchesQuery =
        !normalizedQuery ||
        [order.reference, order.curp, order.participantName, order.academyName, order.venue]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesVenue && matchesQuery;
    });
  }, [orders, query, statusFilter, venueFilter]);

  const visibleOrders = filteredOrders.slice(0, 10);
  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) || null : null;

  const handleOrderUpdated = (order: RegistrationInscriptionOrder) => {
    setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
    setSelectedOrderId(order.id);
    void loadAdminOrders();
  };

  return (
    <main className="registration-admin-dashboard">
      <aside className="registration-admin-sidebar" aria-label="Navegación admin">
        <div className="registration-admin-brand">Levitate</div>
        <nav>
          {[
            { icon: LayoutDashboard, label: "Dashboard" },
            { icon: CreditCard, isActive: true, label: "Pagos" },
            { icon: ClipboardList, label: "Órdenes" },
            { icon: FileText, label: "Inscripciones" },
            { icon: Ticket, label: "Boletos" },
            { icon: Music2, label: "Foto/Video" },
            { icon: BadgeCheck, label: "Hojas de jueceo" },
            { icon: BarChart3, label: "Reportes" },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <button className={item.isActive ? "is-active" : ""} key={item.label} type="button">
                <Icon aria-hidden="true" size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button className="registration-admin-collapse" type="button" aria-label="Contraer menú">
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
      </aside>

      <section className="registration-admin-workspace">
        <header className="registration-admin-header">
          <div>
            <h1>Pagos</h1>
            <p>Revisión y confirmación de comprobantes</p>
          </div>
          <button className="registration-admin-export" disabled={filteredOrders.length === 0} onClick={() => downloadRegistrationOrdersCsv(filteredOrders)} type="button">
            <Download aria-hidden="true" size={16} />
            Exportar
          </button>
        </header>

        {adminError ? <p className="registration-admin-alert">{adminError}</p> : null}

        <section className="registration-admin-summary" aria-label="Resumen de pagos">
          <article>
            <span>Pendientes</span>
            <strong>{totals?.pending ?? "—"}</strong>
            <Clock aria-hidden="true" size={24} />
          </article>
          <article>
            <span>Pend. confirmación</span>
            <strong>{totals?.reported ?? "—"}</strong>
            <CircleAlert aria-hidden="true" size={24} />
          </article>
          <article>
            <span>Aprobados hoy</span>
            <strong>{totals?.paid ?? "—"}</strong>
            <CheckCircle2 aria-hidden="true" size={24} />
          </article>
          <article>
            <span>Rechazados</span>
            <strong>{totals?.rejected ?? "—"}</strong>
            <XCircle aria-hidden="true" size={24} />
          </article>
          <article>
            <span>Total pendiente</span>
            <strong>{formatAdminCurrency(getPendingRegistrationAmount(totals))}</strong>
            <CreditCard aria-hidden="true" size={24} />
          </article>
        </section>

        <section className="registration-admin-filters" aria-label="Filtros de pagos">
          <label className="registration-admin-search">
            <Search aria-hidden="true" size={17} />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar nombre, CURP u orden..."
              type="search"
              value={query}
            />
          </label>
          <label>
            <span>Status</span>
            <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="all">Todos</option>
              {inscriptionOrderStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
          <label>
            <span>Evento</span>
            <select onChange={(event) => setVenueFilter(event.target.value)} value={venueFilter}>
              <option value="all">Todos</option>
              {venueOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
          <label>
            <span>Bloque</span>
            <select defaultValue="all">
              <option value="all">Todos</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
          <label>
            <span>Tipo de compra</span>
            <select defaultValue="inscription">
              <option value="inscription">Inscripción</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} />
          </label>
          <label>
            <span>Fecha</span>
            <input readOnly value="01/06/26 - 30/06/26" />
            <CalendarDays aria-hidden="true" size={16} />
          </label>
        </section>

        <section className="registration-admin-grid">
          <div className="registration-admin-table-card">
            <div className="registration-admin-table" role="table" aria-label="Pagos de inscripción">
              <div className="registration-admin-table__head" role="row">
                <span role="columnheader">Orden</span>
                <span role="columnheader">Comprador</span>
                <span role="columnheader">Participante</span>
                <span role="columnheader">Academia</span>
                <span role="columnheader">Concepto</span>
                <span role="columnheader">Monto</span>
                <span role="columnheader">Comprobante</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Fecha</span>
                <span role="columnheader">Acción</span>
              </div>

              {visibleOrders.map((order) => {
                const date = getAdminOrderDate(order);

                return (
                  <button
                    className={`registration-admin-table__row${selectedOrder?.id === order.id ? " is-selected" : ""}`}
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    role="row"
                    type="button"
                  >
                    <span role="cell">{order.reference}</span>
                    <span role="cell">{order.participantName}</span>
                    <span role="cell">{order.participantName}</span>
                    <span role="cell">{order.academyName}</span>
                    <span role="cell">{getInscriptionOrderConcept(order)}</span>
                    <span role="cell">{formatAdminCurrency(order.amount)}</span>
                    <span role="cell">{order.proof ? <FileText aria-label="Comprobante subido" size={18} /> : "—"}</span>
                    <span role="cell">
                      <em className={getAdminStatusClass(order.status)}>{getAdminPaymentStatusLabel(order.status)}</em>
                    </span>
                    <span role="cell">
                      {date.date}
                      <small>{date.time}</small>
                    </span>
                    <span role="cell">
                      <Eye aria-hidden="true" size={18} />
                    </span>
                  </button>
                );
              })}

              {visibleOrders.length === 0 ? <p className="registration-admin-empty">{isLoading ? "Cargando órdenes..." : "No hay pagos con esos filtros."}</p> : null}
            </div>
            <footer className="registration-admin-table-footer">
              <span>
                Mostrando {visibleOrders.length > 0 ? 1 : 0} a {visibleOrders.length} de {filteredOrders.length} resultados
              </span>
              <div>
                <button disabled type="button">
                  1
                </button>
                <button type="button">10 por página</button>
              </div>
            </footer>
          </div>
        </section>
      </section>

      {selectedOrder ? (
        <div className="registration-admin-drawer" role="dialog" aria-modal="true" aria-label={`Detalle de pago ${selectedOrder.reference}`}>
          <button className="registration-admin-drawer__backdrop" onClick={() => setSelectedOrderId("")} type="button" aria-label="Cerrar detalle" />
          <aside className="registration-admin-sidepanel">
            <RegistrationAdminOrderDetail onClose={() => setSelectedOrderId("")} onOrderUpdated={handleOrderUpdated} order={selectedOrder} />
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function RegistrationAdminOrderDetail({
  onClose,
  onOrderUpdated,
  order,
}: {
  onClose: () => void;
  onOrderUpdated: (order: RegistrationInscriptionOrder) => void;
  order: RegistrationInscriptionOrder | null;
}) {
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [rejectionReason, setRejectionReason] = useState<RegistrationPaymentRejectionReason>(
    order?.rejectionReason ?? (order ? getDefaultPaymentRejectionReason(order) : "missing_proof"),
  );
  const [rejectionMessage, setRejectionMessage] = useState(
    order ? order.rejectionMessage ?? buildPaymentRejectionMessage(order, order.rejectionReason ?? getDefaultPaymentRejectionReason(order)) : "",
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTicketPdfLoading, setIsTicketPdfLoading] = useState(false);

  useEffect(() => {
    const nextRejectionReason = order?.rejectionReason ?? (order ? getDefaultPaymentRejectionReason(order) : "missing_proof");

    setNotes(order?.notes ?? "");
    setRejectionReason(nextRejectionReason);
    setRejectionMessage(order ? order.rejectionMessage ?? buildPaymentRejectionMessage(order, nextRejectionReason) : "");
    setStatusMessage("");
    setErrorMessage("");
    setIsTicketPdfLoading(false);
  }, [order]);

  const updateOrder = async (
    status: RegistrationInscriptionOrderStatus,
    paidAmount = order?.paidAmount ?? 0,
    review?: {
      rejectionMessage?: string;
      rejectionReason?: RegistrationPaymentRejectionReason;
    },
  ) => {
    if (!order) {
      return;
    }

    if (status === "rejected" && !review?.rejectionMessage?.trim()) {
      setErrorMessage("Escribe qué debe corregir la familia para aprobar el pago.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await requestRegistrationApi<{ order: RegistrationInscriptionOrder }>(
        "/api/registration/admin/inscription-order/status",
        {
          body: JSON.stringify({
            id: order.id,
            notes: notes.trim(),
            paidAmount,
            rejectionMessage: status === "rejected" ? review?.rejectionMessage?.trim() : undefined,
            rejectionReason: status === "rejected" ? review?.rejectionReason : undefined,
            reviewedBy: "Admin",
            status,
          }),
          method: "POST",
        },
      );

      onOrderUpdated(response.order);
      setStatusMessage(status === "paid" ? "Pago aprobado. La orden quedó lista para confirmar por WhatsApp." : "Pago rechazado. El mensaje de corrección quedó guardado.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "No se pudo actualizar la orden."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectionReasonChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextReason = event.target.value as RegistrationPaymentRejectionReason;
    setRejectionReason(nextReason);

    if (order) {
      setRejectionMessage(buildPaymentRejectionMessage(order, nextReason));
    }
  };

  const handleDownloadTicketsPdf = async () => {
    if (!order || !order.tickets?.length) {
      return;
    }

    setIsTicketPdfLoading(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const pdf = await createTicketsPdfBlob(order);

      if (!pdf) {
        throw new Error("No pudimos generar el PDF de boletos.");
      }

      downloadBlob(pdf, `boletos-${order.reference.toLowerCase()}.pdf`);
      setStatusMessage("PDF de boletos generado.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "No pudimos generar el PDF de boletos."));
    } finally {
      setIsTicketPdfLoading(false);
    }
  };

  if (!order) {
    return (
      <section className="registration-admin-detail">
        <p className="registration-admin-empty">Selecciona un pago para ver el detalle.</p>
      </section>
    );
  }

  const date = getAdminOrderDate(order);

  return (
    <section className="registration-admin-detail" aria-label="Detalle de pago">
      <header>
        <div>
          <span>Orden</span>
          <h2>{order.reference}</h2>
        </div>
        <button className="registration-admin-detail__close" onClick={onClose} type="button" aria-label="Cerrar detalle">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <dl>
        <div>
          <dt>Comprador</dt>
          <dd>{order.participantName}</dd>
        </div>
        <div>
          <dt>CURP</dt>
          <dd>{order.curp}</dd>
        </div>
        <div>
          <dt>WhatsApp</dt>
          <dd>{order.buyerPhone || "Sin teléfono"}</dd>
        </div>
        <div>
          <dt>Participante</dt>
          <dd>{order.participantName}</dd>
        </div>
        <div>
          <dt>Academia</dt>
          <dd>{order.academyName}</dd>
        </div>
        <div>
          <dt>Concepto</dt>
          <dd>{getInscriptionOrderConcept(order)}</dd>
        </div>
        <div>
          <dt>Monto esperado</dt>
          <dd>{formatAdminCurrency(order.amount)}</dd>
        </div>
        <div>
          <dt>Monto reportado</dt>
          <dd>{order.paidAmount > 0 ? formatAdminCurrency(order.paidAmount) : "Sin reportar"}</dd>
        </div>
        <div>
          <dt>Fecha transferencia</dt>
          <dd>
            {date.date} {date.time}
          </dd>
        </div>
        <div>
          <dt>Revisión</dt>
          <dd>
            {order.reviewedAt
              ? `${order.reviewedBy || "Admin"} · ${getAdminOrderDate({ ...order, updatedAt: order.reviewedAt, createdAt: order.reviewedAt }).date}`
              : "Sin revisar"}
          </dd>
        </div>
        {order.rejectionReason ? (
          <div>
            <dt>Motivo rechazo</dt>
            <dd>{getPaymentRejectionReasonLabel(order.rejectionReason)}</dd>
          </div>
        ) : null}
      </dl>

      <section className="registration-admin-proof-preview">
        <span>Comprobante</span>
        {order.proof ? (
          <>
            {order.proof.contentType.startsWith("image/") ? (
              <img alt={`Comprobante ${order.reference}`} src={order.proof.dataUrl} />
            ) : (
              <div className="registration-admin-proof-file">
                <FileText aria-hidden="true" size={38} />
                <strong>{order.proof.fileName}</strong>
              </div>
            )}
            <div>
              <a href={order.proof.dataUrl} target="_blank" rel="noreferrer">
                Ver comprobante
              </a>
              <a download={order.proof.fileName} href={order.proof.dataUrl}>
                Descargar
              </a>
            </div>
          </>
        ) : (
          <p>Sin comprobante cargado.</p>
        )}
      </section>

      {order.tickets?.length ? (
        <section className="registration-admin-ticket-pack" aria-label="Boletos QR">
          <header>
            <div>
              <span>Boletos QR</span>
              <strong>
                {order.tickets.length} {order.tickets.length === 1 ? "boleto generado" : "boletos generados"}
              </strong>
            </div>
            <button disabled={isTicketPdfLoading} onClick={handleDownloadTicketsPdf} type="button">
              {isTicketPdfLoading ? "Generando..." : "Descargar PDF"}
            </button>
          </header>
          <div>
            {order.tickets.map((ticket) => (
              <article key={ticket.id}>
                <Ticket aria-hidden="true" size={18} />
                <span>
                  <strong>{ticket.ticketCode}</strong>
                  <small>
                    {ticket.ticketLabel} · {getTicketStatusLabel(ticket.status)}
                  </small>
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <label className="registration-admin-note">
        <span>Nota interna</span>
        <textarea onChange={(event) => setNotes(event.target.value)} placeholder="Escribe una nota interna (opcional)..." value={notes} />
      </label>

      <section className="registration-admin-review-panel" aria-label="Datos de rechazo">
        <label>
          <span>Motivo de rechazo</span>
          <select onChange={handleRejectionReasonChange} value={rejectionReason}>
            {paymentRejectionReasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Mensaje para WhatsApp</span>
          <textarea
            onChange={(event) => setRejectionMessage(event.target.value)}
            placeholder="Explica qué debe corregir la familia para aprobar el pago."
            value={rejectionMessage}
          />
        </label>
      </section>

      <div className="registration-admin-detail-actions">
        <button disabled={isSaving} onClick={() => updateOrder("paid", order.amount)} type="button">
          Aprobar pago
        </button>
        <button
          disabled={isSaving}
          onClick={() => updateOrder("rejected", order.paidAmount, { rejectionMessage, rejectionReason })}
          type="button"
        >
          Rechazar
        </button>
      </div>

      <AdminStatusMessage message={statusMessage} />
      <AdminStatusMessage message={errorMessage} tone="error" />
    </section>
  );
}

function AdminWelcomePanel({
  session,
  participantCount,
  choreographerCount,
  danceCount,
}: {
  session: RegistrationSession;
  participantCount: number;
  choreographerCount: number;
  danceCount: number;
}) {
  return (
    <section className="levitate-admin-welcome-panel">
      <PanelLeftOpen aria-hidden="true" size={34} />
      <div>
        <p>Panel Levitate</p>
        <h1>Bienvenido.</h1>
        <div className="levitate-admin-welcome-panel__meta">
          <span>{session.academy.name}</span>
          <span>{participantCount} participantes</span>
          <span>{choreographerCount} coreógrafos</span>
          <span>{danceCount} bailes</span>
        </div>
      </div>
    </section>
  );
}

function getAdminScreen({
  screen,
  session,
  participants,
  choreographers,
  dances,
  inscriptionOrders,
  onParticipantCreated,
  onChoreographerCreated,
  onDanceCreated,
  onOrderUpdated,
}: {
  screen: AdminScreenId;
  session: RegistrationSession;
  participants: RegistrationParticipant[];
  choreographers: RegistrationChoreographer[];
  dances: RegistrationDance[];
  inscriptionOrders: RegistrationInscriptionOrder[];
  onParticipantCreated: (participant: RegistrationParticipant) => void;
  onChoreographerCreated: (choreographer: RegistrationChoreographer) => void;
  onDanceCreated: (dance: RegistrationDance) => void;
  onOrderUpdated: (order: RegistrationInscriptionOrder) => void;
}) {
  if (screen === "choreographers") {
    return <ChoreographerRegistrationPanel academyName={session.academy.name} onChoreographerCreated={onChoreographerCreated} />;
  }

  if (screen === "participants") {
    return <ParticipantRegistrationPanel onParticipantCreated={onParticipantCreated} />;
  }

  if (screen === "dance") {
    return (
      <DanceRegistrationPanel
        academyVenue={session.academy.venue}
        choreographers={choreographers}
        dances={dances}
        onDanceCreated={onDanceCreated}
        participants={participants}
      />
    );
  }

  if (screen === "payments") {
    return <InscriptionOrdersPanel onOrderUpdated={onOrderUpdated} orders={inscriptionOrders} />;
  }

  return (
    <AdminWelcomePanel
      choreographerCount={choreographers.length}
      danceCount={dances.length}
      participantCount={participants.length}
      session={session}
    />
  );
}

export function LevitateRegistrationRoute({ initialScreen = "home" }: { initialScreen?: AdminScreenId }) {
  const [activeScreen, setActiveScreen] = useState<AdminScreenId>(initialScreen);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [session, setSession] = useState<RegistrationSession | null>(null);
  const [participants, setParticipants] = useState<RegistrationParticipant[]>([]);
  const [choreographers, setChoreographers] = useState<RegistrationChoreographer[]>([]);
  const [dances, setDances] = useState<RegistrationDance[]>([]);
  const [inscriptionOrders, setInscriptionOrders] = useState<RegistrationInscriptionOrder[]>([]);

  const loadRegistrationData = useCallback(async () => {
    setIsLoadingData(true);

    if (getPersistedDemoRegistrationSession() === "academy") {
      setSession({
        user: demoRegistrationBootstrap.user,
        academy: demoRegistrationBootstrap.academy,
      });
      setParticipants(demoRegistrationBootstrap.participants);
      setChoreographers(demoRegistrationBootstrap.choreographers);
      setDances(demoRegistrationBootstrap.dances);
      setInscriptionOrders(demoRegistrationBootstrap.inscriptionOrders);
      setLoadError("");
      setIsCheckingSession(false);
      setIsLoadingData(false);
      return;
    }

    try {
      const bootstrap = await requestRegistrationApi<RegistrationBootstrap>("/api/registration/bootstrap");
      setSession({
        user: bootstrap.user,
        academy: bootstrap.academy,
      });
      setParticipants(bootstrap.participants);
      setChoreographers(bootstrap.choreographers);
      setDances(bootstrap.dances);
      setInscriptionOrders(bootstrap.inscriptionOrders ?? []);
      setLoadError("");
    } catch (error) {
      setSession(null);
      setParticipants([]);
      setChoreographers([]);
      setDances([]);
      setInscriptionOrders([]);

      if (!isUnauthorizedRegistrationError(error)) {
        setLoadError(getErrorMessage(error, "No se pudo cargar el registro."));
      }
    } finally {
      setIsCheckingSession(false);
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadRegistrationData();
  }, [loadRegistrationData]);

  const handleScreenChange = (screen: AdminScreenId) => {
    setActiveScreen(screen);
    setIsMobileMenuOpen(false);
  };

  const handleAuthenticated = (nextSession: RegistrationSession | RegistrationBootstrap) => {
    setSession({
      user: nextSession.user,
      academy: nextSession.academy,
    });
    setLoadError("");

    if ("participants" in nextSession) {
      setParticipants(nextSession.participants);
      setChoreographers(nextSession.choreographers);
      setDances(nextSession.dances);
      setInscriptionOrders(nextSession.inscriptionOrders ?? []);
      setIsCheckingSession(false);
      setIsLoadingData(false);
      return;
    }

    void loadRegistrationData();
  };

  const handleLogout = async () => {
    clearPersistedDemoRegistrationSession();
    await requestRegistrationApi<{ ok: boolean }>("/api/registration/auth/logout", { method: "POST" }).catch(() => null);
    setSession(null);
    setParticipants([]);
    setChoreographers([]);
    setDances([]);
    setInscriptionOrders([]);
    setIsMobileMenuOpen(false);
    setActiveScreen("home");
  };

  const handleParticipantCreated = (participant: RegistrationParticipant) => {
    setParticipants((current) => [...current.filter((item) => item.id !== participant.id), participant].sort((left, right) => left.fullName.localeCompare(right.fullName)));
  };

  const handleChoreographerCreated = (choreographer: RegistrationChoreographer) => {
    setChoreographers((current) => [...current.filter((item) => item.id !== choreographer.id), choreographer].sort((left, right) => left.fullName.localeCompare(right.fullName)));
  };

  const handleDanceCreated = (dance: RegistrationDance) => {
    setDances((current) => [dance, ...current.filter((item) => item.id !== dance.id)]);
  };

  const handleOrderUpdated = (order: RegistrationInscriptionOrder) => {
    setInscriptionOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
  };

  if (isCheckingSession) {
    return <LoadingRegistrationScreen />;
  }

  if (!session) {
    return <LevitateAuthScreen onAuthenticated={handleAuthenticated} systemMessage={loadError} />;
  }

  return (
    <main className={`levitate-admin-shell${isMobileMenuOpen ? " is-mobile-menu-open" : ""}`}>
      <AdminSidebar activeScreen={activeScreen} onLogout={handleLogout} onScreenChange={handleScreenChange} session={session} />
      <button
        aria-label="Cerrar menú"
        className="levitate-admin-mobile-scrim"
        onClick={() => setIsMobileMenuOpen(false)}
        type="button"
      />

      <section className="levitate-admin-workspace">
        <button
          className="levitate-admin-menu-toggle"
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          type="button"
          aria-label="Abrir menú"
        >
          <Menu aria-hidden="true" size={24} />
        </button>
        <AdminTopBrand />
        <div className="levitate-admin-rule" aria-hidden="true" />
        <div className="levitate-admin-workspace__content">
          {isLoadingData ? <AdminStatusMessage message="Actualizando registros..." /> : null}
          {getAdminScreen({
            screen: activeScreen,
            session,
            participants,
            choreographers,
            dances,
            inscriptionOrders,
            onParticipantCreated: handleParticipantCreated,
            onChoreographerCreated: handleChoreographerCreated,
            onDanceCreated: handleDanceCreated,
            onOrderUpdated: handleOrderUpdated,
          })}
        </div>
      </section>
    </main>
  );
}

export function LevitateStudentRegistrationRoute() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [session, setSession] = useState<StudentRegistrationSession | null>(null);

  const loadStudentData = useCallback(async () => {
    if (getPersistedDemoRegistrationSession() === "student") {
      setSession(demoStudentSession);
      setLoadError("");
      setIsCheckingSession(false);
      return;
    }

    try {
      const studentSession = await requestRegistrationApi<StudentRegistrationSession>("/api/registration/student/me");
      setSession(studentSession);
      setLoadError("");
    } catch (error) {
      setSession(null);

      if (!isUnauthorizedRegistrationError(error)) {
        setLoadError(getErrorMessage(error, "No se pudo cargar tu portal de alumno."));
      }
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    void loadStudentData();
  }, [loadStudentData]);

  const handleAuthenticated = (nextSession: StudentRegistrationSession) => {
    setSession(nextSession);
    setLoadError("");
  };

  const handleLogout = async () => {
    clearPersistedDemoRegistrationSession();
    await requestRegistrationApi<{ ok: boolean }>("/api/registration/student/logout", { method: "POST" }).catch(() => null);
    setSession(null);
  };

  if (isCheckingSession) {
    return <LoadingRegistrationScreen />;
  }

  if (!session) {
    return <LevitateStudentAuthScreen onAuthenticated={handleAuthenticated} systemMessage={loadError} />;
  }

  return <LevitateStudentPortal onLogout={handleLogout} session={session} />;
}

export function LevitateAuthRoute() {
  const handleAuthenticated = () => {
    if (typeof window !== "undefined") {
      window.location.assign("/registro/academias");
    }
  };

  return <LevitateAuthScreen onAuthenticated={handleAuthenticated} />;
}

export function LevitateParticipantRegistrationScreen() {
  return (
    <RegistrationPageScaffold>
      <ParticipantRegistrationPanel onParticipantCreated={() => undefined} />
    </RegistrationPageScaffold>
  );
}

export function LevitateChoreographerRegistrationScreen() {
  return (
    <RegistrationPageScaffold>
      <ChoreographerRegistrationPanel academyName="Levitate MX" onChoreographerCreated={() => undefined} />
    </RegistrationPageScaffold>
  );
}

export function LevitateDanceRegistrationScreen() {
  return (
    <RegistrationPageScaffold>
      <DanceRegistrationPanel
        academyVenue="cdmx"
        choreographers={[]}
        dances={[]}
        onDanceCreated={() => undefined}
        participants={[]}
      />
    </RegistrationPageScaffold>
  );
}

export function LevitateAdminHomeScreen() {
  return <LevitateRegistrationRoute />;
}
