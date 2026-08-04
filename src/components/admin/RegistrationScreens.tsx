import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  Camera,
  ChevronDown,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileText,
  Globe2,
  GraduationCap,
  Home,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Music2,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  Shirt,
  Ticket,
  Upload,
  UserPlus,
  UserRoundPlus,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

type AdminScreenId = "home" | "choreographers" | "participants" | "dance" | "music" | "feedback" | "payments";
type AdminLookupTab = "participants" | "choreographers" | "dances";
type RegistrationAdminDashboardSection = "payments" | "program" | "tickets" | "media" | "registrations";
type AuthMode = "login" | "register" | "forgot" | "reset" | "verify";
type StatusTone = "success" | "error";

type AdminNavItem = {
  label: string;
  icon: LucideIcon;
  screen?: AdminScreenId;
  action?: "logout";
};

type RegistrationAdminDashboardNavItem = {
  label: string;
  icon: LucideIcon;
  section?: RegistrationAdminDashboardSection;
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
    role?: "academy" | "admin";
    emailConfirmedAt?: string | null;
  };
  academy: {
    id: string;
    name: string;
    venue: string;
    contactName: string;
    email: string;
    phone: string | null;
    originType?: "mexico" | "international";
    originState?: string | null;
    originCountry?: string | null;
  };
};

type RegistrationAuthActionResponse = {
  ok: boolean;
  message?: string;
  debugResetUrl?: string;
  debugVerificationUrl?: string;
  user?: {
    email?: string;
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
  isInternational: boolean;
  isReleveTeacher: boolean;
  createdAt: string;
};

type RegistrationAdminParticipant = RegistrationParticipant & {
  academyId: string;
  academyName: string;
  academyVenue: string;
  academyContactName: string | null;
  academyEmail: string | null;
  academyPhone: string | null;
  academyOriginType?: "mexico" | "international";
  academyOriginState?: string | null;
  academyOriginCountry?: string | null;
};

type RegistrationChoreographer = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  shirtSize: string;
  createdAt: string;
};

type RegistrationDanceRelation = {
  division?: string;
  id: string;
  fullName: string;
  shirtSize?: string;
};

type RegistrationMusicUpload = {
  id: string;
  danceId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  dataUrl?: string | null;
  driveFileId?: string | null;
  driveUrl?: string | null;
  storageProvider?: "d1" | "google_drive" | string;
  uploadedAt: string;
};

type RegistrationDance = {
  academyName?: string;
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
  musicUpload?: RegistrationMusicUpload | null;
};

type RegistrationInscriptionOrderStatus = "pending_payment" | "payment_reported" | "paid" | "rejected";
type RegistrationParticipantPaymentStatus = RegistrationInscriptionOrderStatus | "no_order";
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
  count?: number;
  id: string;
  itemType?: string;
  name?: string;
  title: string;
  genre: string;
  subgenre: string;
  category: string;
  productCategory?: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  qty?: number;
  level?: string | null;
  type?: string;
  venue: string;
  visual?: string;
  academyName: string;
  amount: number;
};

type RegistrationInscriptionOrder = {
  orderType?: "registration" | "shop";
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
  discountCode?: string | null;
  discountAmount?: number;
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

type RegistrationAdminProgramPayload = {
  dances: RegistrationDance[];
};

type RegistrationAdminParticipantsPayload = {
  participants: RegistrationAdminParticipant[];
};

type TicketDashboardRow = {
  activeTickets: number;
  academyName: string;
  cancelledTickets: number;
  curp: string;
  generatedTickets: number;
  latestOrderId: string;
  latestReference: string;
  latestStatus: RegistrationInscriptionOrderStatus;
  orderCount: number;
  paidTickets: number;
  participantName: string;
  pendingTickets: number;
  rejectedTickets: number;
  requestedTickets: number;
  updatedAt: string;
  usedTickets: number;
  venue: string;
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
  { label: "Registrar participante", icon: GraduationCap, screen: "participants" },
  { label: "Registrar coreografía", icon: Music2, screen: "dance" },
  { label: "Subir música", icon: Upload, screen: "music" },
  { label: "Feedback", icon: MessageCircle, screen: "feedback" },
  { label: "Salir", icon: LogOut, action: "logout" },
];

const adminLookupTabs: Array<{ id: AdminLookupTab; label: string }> = [
  { id: "participants", label: "Participantes" },
  { id: "choreographers", label: "Coreógrafos" },
  { id: "dances", label: "Coreografías" },
];

const registrationAdminDashboardNavItems: RegistrationAdminDashboardNavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Pagos", icon: CreditCard, section: "payments" },
  { label: "Inscripciones", icon: FileText, section: "registrations" },
  { label: "Programa", icon: ClipboardList, section: "program" },
  { label: "Boletos", icon: Ticket, section: "tickets" },
  { label: "Foto/Video", icon: Camera, section: "media" },
  { label: "Hojas de jueceo", icon: BadgeCheck },
];

const maxMusicUploadBytes = 12000000;

const divisions: FieldOption[] = [
  { value: "baby", label: "Baby: hasta los 6 años" },
  { value: "petite", label: "Petite: 7 a 10 años" },
  { value: "junior", label: "Junior: 11 a 13 años" },
  { value: "teen", label: "Teen: 14 a 17 años" },
  { value: "senior", label: "Senior: 18 años en adelante" },
  { value: "legacy", label: "Legacy: +40 años" },
  { value: "releve", label: "Relevé" },
];

const shirtSizes: FieldOption[] = [
  { value: "6_8", label: "6/8 años" },
  { value: "10_12", label: "10/12" },
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
];

const danceGenres: FieldOption[] = [
  { value: "aereo", label: "Aerial" },
  { value: "motion", label: "Motion" },
];

const danceSubgenresByGenre: Record<string, FieldOption[]> = {
  aereo: [
    { value: "aro", label: "ARO" },
    { value: "tela", label: "TELA" },
    { value: "open_aerial", label: "OPEN: AERIAL" },
    { value: "open_trapecio", label: "OPEN: Trapecio" },
    { value: "open_cuna", label: "OPEN: Cuna" },
    { value: "open_luna", label: "OPEN: Luna" },
    { value: "open_esfera", label: "OPEN: Esfera" },
    { value: "open_pole_aereo", label: "OPEN: Pole Aereo" },
    { value: "open_suspension_capilar", label: "OPEN: Suspensión Capilar" },
    { value: "open_otro", label: "OPEN: Otro" },
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

const motionDanceCategories: FieldOption[] = [
  { value: "solo", label: "Solo" },
  { value: "duo", label: "Dúo" },
  { value: "trio", label: "Trío" },
  { value: "grupo", label: "Grupo" },
];

const aerialDanceCategories: FieldOption[] = [
  { value: "solo", label: "Solo" },
  { value: "dupla_1_aparato", label: "Duplas: 1 Aparato" },
  { value: "duo_2_aparatos", label: "Duo: 2 Aparatos" },
  { value: "terna_1_aparato", label: "Ternas: 1 Aparato" },
  { value: "trio_3_aparatos", label: "Trios: 3 Aparatos" },
];

const danceCategoriesByGenre: Record<string, FieldOption[]> = {
  aereo: aerialDanceCategories,
  motion: motionDanceCategories,
};

const danceCategories = [...motionDanceCategories, ...aerialDanceCategories.filter((option) => !motionDanceCategories.some((category) => category.value === option.value))];
const defaultDanceCategory = danceCategoriesByGenre[defaultDanceGenre][0].value;
const danceCategoryParticipantRequirements: Record<string, number> = {
  solo: 1,
  duo: 2,
  dueto: 2,
  dupla_1_aparato: 2,
  duo_2_aparatos: 2,
  trio: 3,
  terna_1_aparato: 3,
  trio_3_aparatos: 3,
};

const danceLevels: FieldOption[] = [
  { value: "nudo", label: "Nudo" },
  { value: "principiante", label: "Principiante" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" },
  { value: "elite", label: "Élite" },
];

const venueOptions: FieldOption[] = [
  { value: "edomex", label: "Otoño 2026 - Estado de México" },
  { value: "veracruz", label: "Primavera 2027 - Veracruz" },
];

const venueLabelOptions: FieldOption[] = [
  ...venueOptions,
  { value: "cdmx", label: "CDMX - 29 /31 mayo 2026" },
  { value: "puebla", label: "Puebla - 7 junio 2026" },
];

const venueEventDates: Record<string, string> = {
  edomex: "2026-11-13",
  veracruz: "2027-03-21",
};

const academyOriginTypeOptions: FieldOption[] = [
  { value: "mexico", label: "México" },
  { value: "international", label: "Internacional" },
];

const mexicoStateOptions: FieldOption[] = [
  { value: "aguascalientes", label: "Aguascalientes" },
  { value: "baja_california", label: "Baja California" },
  { value: "baja_california_sur", label: "Baja California Sur" },
  { value: "campeche", label: "Campeche" },
  { value: "chiapas", label: "Chiapas" },
  { value: "chihuahua", label: "Chihuahua" },
  { value: "ciudad_de_mexico", label: "Ciudad de México" },
  { value: "coahuila", label: "Coahuila" },
  { value: "colima", label: "Colima" },
  { value: "durango", label: "Durango" },
  { value: "estado_de_mexico", label: "Estado de México" },
  { value: "guanajuato", label: "Guanajuato" },
  { value: "guerrero", label: "Guerrero" },
  { value: "hidalgo", label: "Hidalgo" },
  { value: "jalisco", label: "Jalisco" },
  { value: "michoacan", label: "Michoacán" },
  { value: "morelos", label: "Morelos" },
  { value: "nayarit", label: "Nayarit" },
  { value: "nuevo_leon", label: "Nuevo León" },
  { value: "oaxaca", label: "Oaxaca" },
  { value: "puebla", label: "Puebla" },
  { value: "queretaro", label: "Querétaro" },
  { value: "quintana_roo", label: "Quintana Roo" },
  { value: "san_luis_potosi", label: "San Luis Potosí" },
  { value: "sinaloa", label: "Sinaloa" },
  { value: "sonora", label: "Sonora" },
  { value: "tabasco", label: "Tabasco" },
  { value: "tamaulipas", label: "Tamaulipas" },
  { value: "tlaxcala", label: "Tlaxcala" },
  { value: "veracruz", label: "Veracruz" },
  { value: "yucatan", label: "Yucatán" },
  { value: "zacatecas", label: "Zacatecas" },
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
    href: "/tienda/taquilla",
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

const registrationDemoPassword = import.meta.env.DEV ? (import.meta.env.VITE_REGISTRATION_DEMO_PASSWORD ?? "") : "";
const isRegistrationDemoEnabled = import.meta.env.DEV && registrationDemoPassword.length > 0;
const isRegistrationStudentDemoEnabled = import.meta.env.DEV;

const demoAcademyCredentials = {
  username: "demo_academia",
  password: registrationDemoPassword,
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
    role: "academy",
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
      isInternational: false,
      isReleveTeacher: false,
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
      isInternational: false,
      isReleveTeacher: false,
      createdAt: "2026-07-04T00:00:00Z",
    },
  ],
  choreographers: [
    {
      id: "demo-choreographer-1",
      fullName: "Camila Torres Demo",
      email: "camila.demo@levitate.mx",
      phone: "55 1111 1111",
      shirtSize: "m",
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
      buyerPhoneCountryCode: "+52",
      buyerPhoneNumber: "5512345678",
      buyerPhone: "+525512345678",
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

function getVenueLabel(venue: string) {
  return getOptionLabel(venueLabelOptions, venue);
}

function getAcademyOriginLabel({
  originCountry,
  originState,
  originType,
}: {
  originCountry?: string | null;
  originState?: string | null;
  originType?: string | null;
}) {
  if (originType === "international") {
    return originCountry || "Internacional";
  }

  return originState ? getOptionLabel(mexicoStateOptions, originState) : "México";
}

function getDanceLevelLabel(level: string | null) {
  return level ? getOptionLabel(danceLevels, level) : "No aplica";
}

const legacyProgramDivisionMap: Record<string, string> = {
  adulto: "senior",
  mini: "petite",
};

const programDivisionOrder = ["baby", "petite", "junior", "teen", "senior", "legacy", "releve"];
const programAerialLevelOrder = ["nudo", "principiante", "intermedio", "avanzado", "elite"];
const programMotionSubgenreOrder = danceSubgenresByGenre.motion.map((option) => option.value);
const programCategoryOrder: Record<string, number> = {
  solo: 0,
  duo: 1,
  dupla_1_aparato: 1,
  duo_2_aparatos: 1,
  trio: 2,
  terna_1_aparato: 2,
  trio_3_aparatos: 2,
  grupo: 3,
};

type ProgramRow = {
  academyName: string;
  blockId: number;
  blockTitle: string;
  category: string;
  choreographers: string;
  danceId: string;
  danceTitle: string;
  division: string;
  genre: string;
  level: string;
  participants: string;
  subgenre: string;
  venue: string;
};

type ProgramBlock = {
  id: number;
  title: string;
  rows: ProgramRow[];
};

function normalizeProgramDivision(division?: string) {
  const value = String(division || "").trim();
  return legacyProgramDivisionMap[value] || value;
}

function getProgramDivisionLabel(division?: string) {
  return getOptionLabel(divisions, normalizeProgramDivision(division || ""));
}

function getProgramDivisionRank(division?: string) {
  const index = programDivisionOrder.indexOf(normalizeProgramDivision(division));
  return index === -1 ? 999 : index;
}

function normalizeCurpInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 18);
}

function normalizeDocumentInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
}

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return { day, month, year };
}

function calculateAgeAtDate(birthDate: string, referenceDate: string) {
  const birth = parseDateInput(birthDate);
  const reference = parseDateInput(referenceDate);

  if (!birth || !reference) {
    return null;
  }

  let age = reference.year - birth.year;

  if (reference.month < birth.month || (reference.month === birth.month && reference.day < birth.day)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function getDivisionFromAge(age: number) {
  if (age <= 6) {
    return "baby";
  }

  if (age <= 10) {
    return "petite";
  }

  if (age <= 13) {
    return "junior";
  }

  if (age <= 17) {
    return "teen";
  }

  if (age >= 40) {
    return "legacy";
  }

  return "senior";
}

function getBirthDateFromCurp(curp: string, referenceDate: string) {
  const normalizedCurp = normalizeCurpInput(curp);

  if (normalizedCurp.length !== 18) {
    return "";
  }

  const datePart = normalizedCurp.slice(4, 10);

  if (!/^\d{6}$/.test(datePart)) {
    return "";
  }

  const yearSuffix = Number(datePart.slice(0, 2));
  const month = datePart.slice(2, 4);
  const day = datePart.slice(4, 6);
  const centuryMarker = normalizedCurp.charAt(16);
  const century = /[A-Z]/.test(centuryMarker) ? 2000 : 1900;
  const birthDate = `${century + yearSuffix}-${month}-${day}`;

  if (!parseDateInput(birthDate) || calculateAgeAtDate(birthDate, referenceDate) === null) {
    return "";
  }

  return birthDate;
}

function getDanceProgramDivision(dance: RegistrationDance) {
  const participantDivisions = dance.participants.map((participant) => participant.division).filter(Boolean);

  if (participantDivisions.length === 0) {
    return "";
  }

  return participantDivisions.sort((left, right) => getProgramDivisionRank(right) - getProgramDivisionRank(left))[0] ?? "";
}

function getProgramBlock(dance: RegistrationDance, division: string) {
  const normalizedDivision = normalizeProgramDivision(division);

  if (dance.genre === "aereo") {
    if (normalizedDivision === "baby" || normalizedDivision === "petite") {
      return { id: 4, title: "BLOQUE 4: BABY + PETITE" };
    }

    if (normalizedDivision === "junior") {
      return { id: 5, title: "BLOQUE 5: JUNIOR" };
    }

    if (normalizedDivision === "teen" || normalizedDivision === "legacy") {
      return { id: 6, title: "BLOQUE 6: TEEN + LEGACY" };
    }

    if (normalizedDivision === "senior" || normalizedDivision === "releve") {
      return { id: 7, title: "BLOQUE 7: SENIORS + RELEVÉ" };
    }
  }

  if (normalizedDivision === "baby" || normalizedDivision === "petite") {
    return { id: 1, title: "BLOQUE 1: BABY + PETITE" };
  }

  if (normalizedDivision === "junior" || normalizedDivision === "teen") {
    return { id: 2, title: "BLOQUE 2: JUNIOR + TEEN" };
  }

  if (normalizedDivision === "senior" || normalizedDivision === "legacy" || normalizedDivision === "releve") {
    return { id: 3, title: "BLOQUE 3: SENIOR + LEGACY + RELEVÉ" };
  }

  return { id: 99, title: "SIN BLOQUE" };
}

function getAerialSubgenreRank(subgenre: string) {
  if (subgenre.startsWith("open_")) {
    return 0;
  }

  if (subgenre === "aro") {
    return 1;
  }

  if (subgenre === "tela") {
    return 3;
  }

  return 2;
}

function getMotionSubgenreRank(subgenre: string) {
  const index = programMotionSubgenreOrder.indexOf(subgenre);
  return index === -1 ? 999 : index;
}

function getAerialLevelRank(level: string) {
  const index = programAerialLevelOrder.indexOf(level);
  return index === -1 ? 999 : index;
}

function getProgramCategoryRank(category: string) {
  return programCategoryOrder[category] ?? 999;
}

function compareProgramRows(firstRow: ProgramRow, secondRow: ProgramRow) {
  if (firstRow.blockId !== secondRow.blockId) {
    return firstRow.blockId - secondRow.blockId;
  }

  const divisionDiff = getProgramDivisionRank(firstRow.division) - getProgramDivisionRank(secondRow.division);

  if (divisionDiff !== 0) {
    return divisionDiff;
  }

  if (firstRow.genre === "aereo" || secondRow.genre === "aereo") {
    const subgenreDiff = getAerialSubgenreRank(firstRow.subgenre) - getAerialSubgenreRank(secondRow.subgenre);

    if (subgenreDiff !== 0) {
      return subgenreDiff;
    }

    const levelDiff = getAerialLevelRank(firstRow.level) - getAerialLevelRank(secondRow.level);

    if (levelDiff !== 0) {
      return levelDiff;
    }
  } else {
    const subgenreDiff = getMotionSubgenreRank(firstRow.subgenre) - getMotionSubgenreRank(secondRow.subgenre);

    if (subgenreDiff !== 0) {
      return subgenreDiff;
    }
  }

  const categoryDiff = getProgramCategoryRank(firstRow.category) - getProgramCategoryRank(secondRow.category);

  if (categoryDiff !== 0) {
    return categoryDiff;
  }

  return firstRow.danceTitle.localeCompare(secondRow.danceTitle, "es");
}

function toProgramUpper(value: unknown) {
  return String(value ?? "").toLocaleUpperCase("es-MX");
}

function toProgramHtmlValue(value: unknown) {
  return toProgramUpper(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildProgramRows(dances: RegistrationDance[], fallbackAcademyName = "") {
  return dances
    .map((dance) => {
      const division = getDanceProgramDivision(dance);
      const block = getProgramBlock(dance, division);

      return {
        academyName: dance.academyName || fallbackAcademyName,
        blockId: block.id,
        blockTitle: block.title,
        category: dance.category,
        choreographers: dance.choreographers.map((choreographer) => choreographer.fullName).join(", "),
        danceId: dance.id,
        danceTitle: dance.title,
        division,
        genre: dance.genre,
        level: dance.level || "",
        participants: dance.participants.map((participant) => participant.fullName).join(", "),
        subgenre: dance.subgenre,
        venue: dance.venue,
      };
    })
    .sort(compareProgramRows);
}

function buildProgramBlocks(rows: ProgramRow[]) {
  const blocks = new Map<number, ProgramBlock>();

  for (const row of rows) {
    const current = blocks.get(row.blockId) ?? { id: row.blockId, title: row.blockTitle, rows: [] };
    current.rows.push(row);
    blocks.set(row.blockId, current);
  }

  return Array.from(blocks.values()).sort((left, right) => left.id - right.id);
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

function getAdminOrderType(order: Pick<RegistrationInscriptionOrder, "orderType">) {
  return order.orderType === "shop" ? "shop" : "registration";
}

function getAdminOrderTypeLabel(order: RegistrationInscriptionOrder) {
  return getAdminOrderType(order) === "shop" ? "Tienda" : "Inscripción";
}

function getInscriptionOrderConcept(order: RegistrationInscriptionOrder) {
  if (!order.lineItems?.length) {
    return getAdminOrderType(order) === "shop" ? "Compra de tienda" : "Inscripción participante";
  }

  if (getAdminOrderType(order) === "shop" && order.lineItems.length > 1) {
    return `${order.lineItems[0].title} + ${order.lineItems.length - 1}`;
  }

  return order.lineItems[0].title || (getAdminOrderType(order) === "shop" ? "Compra de tienda" : "Inscripción participante");
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

function isParticipantInscriptionPaid(participant: RegistrationParticipant, inscriptionOrders: RegistrationInscriptionOrder[]) {
  const participantCurp = normalizeCurpInput(participant.curp);

  return inscriptionOrders.some((order) => getAdminOrderType(order) === "registration" && normalizeCurpInput(order.curp) === participantCurp && order.status === "paid");
}

function getParticipantRegistrationOrders(participant: RegistrationParticipant, orders: RegistrationInscriptionOrder[]) {
  const participantCurp = normalizeCurpInput(participant.curp);

  if (!participantCurp) {
    return [];
  }

  return orders.filter((order) => getAdminOrderType(order) === "registration" && normalizeCurpInput(order.curp) === participantCurp);
}

function getParticipantPaymentStatus(participant: RegistrationParticipant, orders: RegistrationInscriptionOrder[]): RegistrationParticipantPaymentStatus {
  const participantOrders = getParticipantRegistrationOrders(participant, orders);

  if (participantOrders.some((order) => order.status === "paid")) {
    return "paid";
  }

  if (participantOrders.some((order) => order.status === "payment_reported")) {
    return "payment_reported";
  }

  if (participantOrders.some((order) => order.status === "rejected")) {
    return "rejected";
  }

  if (participantOrders.some((order) => order.status === "pending_payment")) {
    return "pending_payment";
  }

  return "no_order";
}

function getParticipantPaymentStatusLabel(status: RegistrationParticipantPaymentStatus) {
  return status === "no_order" ? "Sin orden" : getAdminPaymentStatusLabel(status);
}

function getParticipantPaymentStatusClass(status: RegistrationParticipantPaymentStatus) {
  return `registration-admin-status registration-admin-status--${status.replace("_", "-")}`;
}

function getAdminParticipantGroups(participants: RegistrationAdminParticipant[]) {
  const groupMap = new Map<string, RegistrationAdminParticipant[]>();

  for (const participant of participants) {
    const key = participant.academyId || `${participant.academyName}-${participant.academyVenue}`;
    const current = groupMap.get(key) ?? [];

    current.push(participant);
    groupMap.set(key, current);
  }

  return Array.from(groupMap.entries())
    .map(([key, groupParticipants]) => ({
      academyName: groupParticipants[0]?.academyName || "Sin academia",
      key,
      originLabel: getAcademyOriginLabel({
        originCountry: groupParticipants[0]?.academyOriginCountry,
        originState: groupParticipants[0]?.academyOriginState,
        originType: groupParticipants[0]?.academyOriginType,
      }),
      participants: groupParticipants.sort((left, right) => left.fullName.localeCompare(right.fullName, "es")),
      venue: groupParticipants[0]?.academyVenue || "",
    }))
    .sort((left, right) => {
      const academyDiff = left.academyName.localeCompare(right.academyName, "es");

      if (academyDiff !== 0) {
        return academyDiff;
      }

      return left.venue.localeCompare(right.venue, "es");
    });
}

function getAdminParticipantTotals(participants: RegistrationAdminParticipant[], orders: RegistrationInscriptionOrder[]) {
  const groups = getAdminParticipantGroups(participants);

  return participants.reduce(
    (totals, participant) => {
      const status = getParticipantPaymentStatus(participant, orders);

      return {
        academies: groups.length,
        paid: totals.paid + (status === "paid" ? 1 : 0),
        participants: totals.participants + 1,
        pending: totals.pending + (status === "payment_reported" || status === "pending_payment" ? 1 : 0),
        releveTeachers: totals.releveTeachers + (participant.isReleveTeacher ? 1 : 0),
        withoutOrder: totals.withoutOrder + (status === "no_order" ? 1 : 0),
      };
    },
    {
      academies: groups.length,
      paid: 0,
      participants: 0,
      pending: 0,
      releveTeachers: 0,
      withoutOrder: 0,
    },
  );
}

function isMp3File(file: File) {
  const normalizedName = file.name.toLowerCase();
  const normalizedType = file.type.toLowerCase();

  return normalizedName.endsWith(".mp3") && (!normalizedType || normalizedType === "audio/mpeg" || normalizedType === "audio/mp3");
}

function readMusicFileAsDataUrl(file: File) {
  return new Promise<{ contentType: string; dataUrl: string; fileName: string; fileSize: number }>((resolve, reject) => {
    if (file.size > maxMusicUploadBytes) {
      reject(new Error("La canción debe pesar menos de 12 MB."));
      return;
    }

    if (!isMp3File(file)) {
      reject(new Error("Solo se aceptan archivos en formato MP3."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("No pudimos leer la canción."));
    reader.onload = () =>
      resolve({
        contentType: file.type || "audio/mpeg",
        dataUrl: String(reader.result),
        fileName: file.name,
        fileSize: file.size,
      });
    reader.readAsDataURL(file);
  });
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

function getRegistrationInscriptionPaymentReference(order: Pick<RegistrationInscriptionOrder, "curp" | "orderType" | "reference">) {
  if (getAdminOrderType(order) === "shop") {
    return order.reference;
  }

  const curpPrefix = String(order.curp || "").replace(/\s/g, "").toUpperCase().slice(0, 4);

  return curpPrefix ? `LEVITATE-${curpPrefix}-26` : order.reference;
}

function buildPaymentRejectionMessage(order: RegistrationInscriptionOrder, reason: RegistrationPaymentRejectionReason) {
  const amount = formatAdminCurrency(order.amount);
  const paymentReference = getRegistrationInscriptionPaymentReference(order);

  const messages: Record<RegistrationPaymentRejectionReason, string> = {
    incomplete_amount: `No pudimos aprobar tu pago porque el monto recibido no cubre el total de la orden ${paymentReference}. El total correcto es ${amount}. Te reenviamos los datos de transferencia para completar el pago y contactar a administración con el seguimiento de la diferencia.`,
    invalid_or_unreadable_proof: `No pudimos aprobar tu pago porque el comprobante de la orden ${paymentReference} no es legible o no corresponde al pago. Te reenviamos los datos de transferencia para que puedas revisar la operación y contactar a administración con la corrección.`,
    missing_proof: `No pudimos aprobar tu pago porque falta subir el comprobante de la orden ${paymentReference}. Te reenviamos los datos de transferencia para que puedas realizar o confirmar el pago y cargar el comprobante.`,
    payment_not_found: `No pudimos aprobar tu pago porque no encontramos una transferencia asociada a la referencia ${paymentReference}. Te reenviamos los datos de transferencia para que puedas revisar o realizar el pago y contactar a administración.`,
  };

  return messages[reason];
}

function getRegistrationOrderWhatsAppPhone(order: RegistrationInscriptionOrder) {
  const rawPhone = order.buyerPhone || `${order.buyerPhoneCountryCode ?? ""}${order.buyerPhoneNumber ?? ""}`;
  const phone = rawPhone.replace(/\D/g, "");

  if (phone.startsWith("00")) {
    return phone.slice(2);
  }

  return phone.length >= 8 ? phone : "";
}

function buildWhatsAppUrl(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildPaymentApprovalWhatsAppMessage(order: RegistrationInscriptionOrder) {
  const amount = formatAdminCurrency(order.paidAmount || order.amount);
  const paymentReference = getRegistrationInscriptionPaymentReference(order);
  const ticketCount = order.tickets?.length ?? 0;
  const isShopOrder = getAdminOrderType(order) === "shop";
  const ticketLine =
    ticketCount > 0
      ? `Tus boletos ya quedaron generados. Te enviaremos ${ticketCount === 1 ? "1 boleto" : `${ticketCount} boletos`} en PDF por este chat.`
      : isShopOrder
        ? "Tu compra ya quedó confirmada."
        : "Tu inscripción ya quedó confirmada.";

  return [
    `Hola, te confirmamos que el pago ${isShopOrder ? "de tienda" : "de inscripción"} de ${order.participantName} fue aprobado.`,
    "",
    `Orden: ${paymentReference}`,
    `Monto confirmado: ${amount}`,
    `Academia: ${order.academyName}`,
    "",
    ticketLine,
    "",
    "Gracias por formar parte de Levitate MX.",
  ].join("\n");
}

function buildPaymentCorrectionWhatsAppMessage(order: RegistrationInscriptionOrder, correctionMessage: string) {
  const isShopOrder = getAdminOrderType(order) === "shop";
  const paymentReference = getRegistrationInscriptionPaymentReference(order);
  const message =
    (order.rejectionMessage || correctionMessage || buildPaymentRejectionMessage(order, order.rejectionReason ?? getDefaultPaymentRejectionReason(order))).trim();

  return [
    `Hola, necesitamos corregir el pago ${isShopOrder ? "de tienda" : "de inscripción"} de ${order.participantName}.`,
    "",
    message,
    "",
    `Orden: ${paymentReference}`,
    `Monto esperado: ${formatAdminCurrency(order.amount)}`,
    `Concepto para transferencia: ${paymentReference}`,
    "",
    "Cuando tengas la corrección, contacta a administración para que podamos revisar tu caso.",
  ].join("\n");
}

function getPaymentWhatsAppAction(order: RegistrationInscriptionOrder, correctionMessage: string) {
  const phone = getRegistrationOrderWhatsAppPhone(order);

  if (order.status === "paid") {
    const message = buildPaymentApprovalWhatsAppMessage(order);

    return {
      href: phone ? buildWhatsAppUrl(phone, message) : "",
      label: "Enviar confirmación",
      message,
      title: "Pago aprobado",
    };
  }

  if (order.status === "rejected") {
    const message = buildPaymentCorrectionWhatsAppMessage(order, correctionMessage);

    return {
      href: phone ? buildWhatsAppUrl(phone, message) : "",
      label: "Enviar corrección",
      message,
      title: "Pago rechazado",
    };
  }

  return {
    href: "",
    label: "WhatsApp no disponible",
    message: "Aprueba o rechaza el pago para generar el mensaje de WhatsApp.",
    title: "Pendiente de revisión",
  };
}

function isAdminTicketLineItem(lineItem: RegistrationInscriptionLineItem) {
  const category = String(lineItem.productCategory || lineItem.category || "").toLowerCase();
  const itemType = String(lineItem.itemType || "").toLowerCase();
  const lineType = String(lineItem.type || "").toLowerCase();
  const visual = String(lineItem.visual || "").toLowerCase();
  const productId = String(lineItem.productId || lineItem.id || "").toLowerCase();

  return category === "boletos" || category === "tickets" || itemType === "ticket" || lineType === "ticket" || visual === "ticket" || productId.startsWith("ticket-");
}

function getAdminTicketLineQuantity(lineItem: RegistrationInscriptionLineItem) {
  const quantity = Number(lineItem.quantity ?? lineItem.qty ?? lineItem.count ?? 1);

  if (!Number.isFinite(quantity) || quantity < 1) {
    return 1;
  }

  return Math.min(100, Math.floor(quantity));
}

function getOrderRequestedTicketCount(order: RegistrationInscriptionOrder) {
  const lineItemCount = (order.lineItems ?? []).reduce((total, lineItem) => {
    if (!isAdminTicketLineItem(lineItem)) {
      return total;
    }

    return total + getAdminTicketLineQuantity(lineItem);
  }, 0);

  return Math.max(lineItemCount, order.tickets?.length ?? 0);
}

function isAdminMediaLineItem(lineItem: RegistrationInscriptionLineItem) {
  const category = String(lineItem.productCategory || lineItem.category || "").toLowerCase();
  const itemType = String(lineItem.itemType || "").toLowerCase();
  const lineType = String(lineItem.type || "").toLowerCase();
  const visual = String(lineItem.visual || "").toLowerCase();
  const productId = String(lineItem.productId || lineItem.id || "").toLowerCase();

  return (
    itemType === "media" ||
    lineType === "media" ||
    visual === "photo" ||
    category.includes("foto") ||
    category.includes("video") ||
    productId.startsWith("photo-") ||
    productId.startsWith("media-")
  );
}

function getOrderMediaLineItems(order: RegistrationInscriptionOrder) {
  return (order.lineItems ?? []).filter(isAdminMediaLineItem);
}

function getOrderMediaItemCount(order: RegistrationInscriptionOrder) {
  return getOrderMediaLineItems(order).reduce((total, lineItem) => total + getAdminTicketLineQuantity(lineItem), 0);
}

function getOrderMediaConcept(order: RegistrationInscriptionOrder) {
  const mediaItems = getOrderMediaLineItems(order);

  if (mediaItems.length === 0) {
    return getInscriptionOrderConcept(order);
  }

  return mediaItems
    .map((lineItem) => {
      const quantity = getAdminTicketLineQuantity(lineItem);
      const label = lineItem.productName || lineItem.title || lineItem.name || "Foto/Video";

      return quantity > 1 ? `${label} x${quantity}` : label;
    })
    .join(", ");
}

function getMediaDashboardTotals(orders: RegistrationInscriptionOrder[]) {
  return orders.reduce(
    (totals, order) => ({
      amount: totals.amount + order.amount,
      orderCount: totals.orderCount + 1,
      paid: totals.paid + (order.status === "paid" ? 1 : 0),
      pending: totals.pending + (order.status === "pending_payment" || order.status === "payment_reported" ? 1 : 0),
      proofCount: totals.proofCount + (order.proof ? 1 : 0),
      requestedItems: totals.requestedItems + getOrderMediaItemCount(order),
      rejected: totals.rejected + (order.status === "rejected" ? 1 : 0),
    }),
    {
      amount: 0,
      orderCount: 0,
      paid: 0,
      pending: 0,
      proofCount: 0,
      requestedItems: 0,
      rejected: 0,
    },
  );
}

function getTicketDashboardRows(orders: RegistrationInscriptionOrder[]) {
  const rowMap = new Map<string, TicketDashboardRow>();

  for (const order of orders) {
    const requestedTickets = getOrderRequestedTicketCount(order);

    if (requestedTickets === 0) {
      continue;
    }

    const normalizedCurp = order.curp.trim().toUpperCase();
    const rowKey = normalizedCurp || order.participantName.trim().toLowerCase() || order.id;
    const existingRow =
      rowMap.get(rowKey) ??
      ({
        activeTickets: 0,
        academyName: order.academyName,
        cancelledTickets: 0,
        curp: normalizedCurp,
        generatedTickets: 0,
        latestOrderId: order.id,
        latestReference: order.reference,
        latestStatus: order.status,
        orderCount: 0,
        paidTickets: 0,
        participantName: order.participantName,
        pendingTickets: 0,
        rejectedTickets: 0,
        requestedTickets: 0,
        updatedAt: order.updatedAt || order.createdAt,
        usedTickets: 0,
        venue: order.venue,
      } satisfies TicketDashboardRow);

    existingRow.orderCount += 1;
    existingRow.requestedTickets += requestedTickets;

    if (order.status === "paid") {
      existingRow.paidTickets += requestedTickets;
    } else if (order.status === "rejected") {
      existingRow.rejectedTickets += requestedTickets;
    } else {
      existingRow.pendingTickets += requestedTickets;
    }

    for (const ticket of order.tickets ?? []) {
      existingRow.generatedTickets += 1;

      if (ticket.status === "active") {
        existingRow.activeTickets += 1;
      } else if (ticket.status === "used") {
        existingRow.usedTickets += 1;
      } else if (ticket.status === "cancelled") {
        existingRow.cancelledTickets += 1;
      }
    }

    const currentDate = Date.parse(existingRow.updatedAt);
    const orderDate = Date.parse(order.updatedAt || order.createdAt);

    if (!Number.isFinite(currentDate) || (Number.isFinite(orderDate) && orderDate >= currentDate)) {
      existingRow.latestOrderId = order.id;
      existingRow.latestReference = order.reference;
      existingRow.latestStatus = order.status;
      existingRow.updatedAt = order.updatedAt || order.createdAt;
    }

    rowMap.set(rowKey, existingRow);
  }

  return Array.from(rowMap.values()).sort((left, right) => {
    const paidDiff = right.paidTickets - left.paidTickets;

    if (paidDiff !== 0) {
      return paidDiff;
    }

    const requestedDiff = right.requestedTickets - left.requestedTickets;

    if (requestedDiff !== 0) {
      return requestedDiff;
    }

    return left.participantName.localeCompare(right.participantName, "es");
  });
}

function getTicketDashboardTotals(rows: TicketDashboardRow[]) {
  return rows.reduce(
    (totals, row) => ({
      activeTickets: totals.activeTickets + row.activeTickets,
      childCount: totals.childCount + 1,
      generatedTickets: totals.generatedTickets + row.generatedTickets,
      paidTickets: totals.paidTickets + row.paidTickets,
      pendingTickets: totals.pendingTickets + row.pendingTickets,
      rejectedTickets: totals.rejectedTickets + row.rejectedTickets,
      requestedTickets: totals.requestedTickets + row.requestedTickets,
      usedTickets: totals.usedTickets + row.usedTickets,
    }),
    {
      activeTickets: 0,
      childCount: 0,
      generatedTickets: 0,
      paidTickets: 0,
      pendingTickets: 0,
      rejectedTickets: 0,
      requestedTickets: 0,
      usedTickets: 0,
    },
  );
}

function formatTicketAverage(requestedTickets: number, childCount: number) {
  if (childCount === 0) {
    return "0";
  }

  const average = requestedTickets / childCount;
  return Number.isInteger(average) ? String(average) : average.toFixed(1);
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
  drawWrappedText(getRegistrationInscriptionPaymentReference(order), padding + 430, 760, width - padding * 2 - 430, 24, 28, ink, 780);

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
    "Tipo",
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
    getAdminOrderTypeLabel(order),
    getRegistrationInscriptionPaymentReference(order),
    order.curp,
    order.buyerPhone ?? "",
    order.participantName,
    order.academyName,
    getVenueLabel(order.venue),
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

function downloadTicketDashboardCsv(rows: TicketDashboardRow[]) {
  const headers = [
    "Niño",
    "CURP",
    "Academia",
    "Sede",
    "Boletos pedidos",
    "Boletos aprobados",
    "QR generados",
    "QR activos",
    "QR usados",
    "Pendientes",
    "Rechazados",
    "Órdenes",
    "Última orden",
    "Estado última orden",
  ];
  const csvRows = rows.map((row) => [
    row.participantName,
    row.curp,
    row.academyName,
    getVenueLabel(row.venue),
    row.requestedTickets,
    row.paidTickets,
    row.generatedTickets,
    row.activeTickets,
    row.usedTickets,
    row.pendingTickets,
    row.rejectedTickets,
    row.orderCount,
    row.latestReference,
    getAdminPaymentStatusLabel(row.latestStatus),
  ]);
  const csv = [headers, ...csvRows].map((row) => row.map(toRegistrationCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "levitate-boletos-por-nino.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadMediaOrdersCsv(orders: RegistrationInscriptionOrder[]) {
  const headers = [
    "Referencia",
    "CURP",
    "WhatsApp",
    "Participante",
    "Academia",
    "Sede",
    "Paquete",
    "Cantidad",
    "Monto",
    "Pagado",
    "Estado",
    "Comprobante",
    "Fecha",
  ];
  const csvRows = orders.map((order) => [
    getRegistrationInscriptionPaymentReference(order),
    order.curp,
    order.buyerPhone ?? "",
    order.participantName,
    order.academyName,
    getVenueLabel(order.venue),
    getOrderMediaConcept(order),
    getOrderMediaItemCount(order),
    order.amount,
    order.paidAmount,
    getAdminPaymentStatusLabel(order.status),
    order.proof?.fileName ?? "",
    getAdminOrderDate(order).date,
  ]);
  const csv = [headers, ...csvRows].map((row) => row.map(toRegistrationCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "levitate-foto-video.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadAdminParticipantsCsv(participants: RegistrationAdminParticipant[], orders: RegistrationInscriptionOrder[]) {
  const headers = [
    "Academia",
    "Origen academia",
    "Sede",
    "Participante",
    "CURP",
    "División",
    "Edad",
    "Talla",
    "Internacional",
    "Maestro Relevé",
    "Estado pago",
    "Fecha registro",
  ];
  const csvRows = participants.map((participant) => [
    participant.academyName,
    getAcademyOriginLabel({
      originCountry: participant.academyOriginCountry,
      originState: participant.academyOriginState,
      originType: participant.academyOriginType,
    }),
    getVenueLabel(participant.academyVenue),
    participant.fullName,
    participant.curp,
    getProgramDivisionLabel(participant.division),
    participant.age ?? "",
    getOptionLabel(shirtSizes, participant.shirtSize),
    participant.isInternational ? "Sí" : "No",
    participant.isReleveTeacher ? "Sí" : "No",
    getParticipantPaymentStatusLabel(getParticipantPaymentStatus(participant, orders)),
    participant.createdAt,
  ]);
  const csv = [headers, ...csvRows].map((row) => row.map(toRegistrationCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "levitate-participantes-por-academia.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function getProgramRowDisplay(row: ProgramRow) {
  return [
    row.danceTitle,
    row.academyName,
    getProgramDivisionLabel(row.division),
    getOptionLabel(danceSubgenresByGenre[row.genre] ?? [], row.subgenre),
    getOptionLabel(danceCategories, row.category),
    row.choreographers,
    row.participants,
    getVenueLabel(row.venue),
  ];
}

function downloadProgramXls(blocks: ProgramBlock[]) {
  const headers = ["COREOGRAFÍA", "ACADEMIA", "DIVISIÓN", "SUBGÉNERO", "CATEGORÍA", "COREÓGRAFOS", "PARTICIPANTE", "ESTADO"];
  const rows = blocks.flatMap((block) => [
    `<tr><td colspan="${headers.length}" style="font-weight:700;background:#f0f0f0;">${toProgramHtmlValue(block.title)}</td></tr>`,
    `<tr>${headers.map((header) => `<th>${toProgramHtmlValue(header)}</th>`).join("")}</tr>`,
    ...block.rows.map((row) => `<tr>${getProgramRowDisplay(row).map((value) => `<td>${toProgramHtmlValue(value)}</td>`).join("")}</tr>`),
  ]);
  const worksheet = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; }
      th, td { border: 1px solid #999; padding: 6px 8px; mso-number-format:"\\@"; }
      th { background: #111; color: #fff; font-weight: 700; }
    </style>
  </head>
  <body>
    <table>${rows.join("")}</table>
  </body>
</html>`;
  const blob = new Blob([worksheet], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "levitate-programa.xls";
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
      <a href="https://www.facebook.com/mx.levitate/" aria-label="Facebook" rel="noreferrer" target="_blank">
        f
      </a>
      <a href="https://www.instagram.com/levitate.mx/" aria-label="Instagram" rel="noreferrer" target="_blank">
        ◎
      </a>
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
  disabled = false,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  options: FieldOption[];
  defaultValue?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <span className="levitate-admin-select">
      <select
        defaultValue={value === undefined ? (defaultValue ?? options[0]?.value) : undefined}
        disabled={disabled}
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
  maxSelection,
  selectionHint,
}: {
  sourceTitle: string;
  assignedTitle: string;
  sourceItems: RegistrationDanceRelation[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  emptyMessage: string;
  maxSelection?: number | null;
  selectionHint?: string;
}) {
  const [query, setQuery] = useState("");
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = sourceItems.filter((item) => selectedIdSet.has(item.id));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? sourceItems.filter((item) => item.fullName.toLowerCase().includes(normalizedQuery))
    : sourceItems;
  const hasReachedLimit = Boolean(maxSelection && selectedIds.length >= maxSelection);

  const toggleItem = (id: string) => {
    if (selectedIdSet.has(id)) {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }

    if (maxSelection === 1) {
      onSelectionChange([id]);
      return;
    }

    if (hasReachedLimit) {
      return;
    }

    onSelectionChange([...selectedIds, id]);
  };

  return (
    <section className="levitate-admin-picker" aria-label={sourceTitle}>
      <header className="levitate-admin-picker__header">
        <div className="levitate-admin-picker__title">
          <Users aria-hidden="true" size={20} />
          <div>
            <h3>{sourceTitle}</h3>
            <p>{selectionHint || `Selecciona ${sourceTitle.toLowerCase()} para esta coreografía.`}</p>
          </div>
        </div>

        <div className="levitate-admin-picker__actions" aria-label={`${sourceTitle} acciones`}>
          <span>
            {selectedIds.length}
            {maxSelection ? `/${maxSelection}` : ""} seleccionados
          </span>
          <button
            disabled={sourceItems.length === 0 || Boolean(maxSelection)}
            onClick={() => onSelectionChange(sourceItems.map((item) => item.id))}
            type="button"
          >
            Todos
          </button>
          <button disabled={selectedIds.length === 0} onClick={() => onSelectionChange([])} type="button">
            Limpiar
          </button>
        </div>
      </header>

      <label className="levitate-admin-picker__search">
        <Search aria-hidden="true" size={17} />
        <span>Buscar</span>
        <input placeholder={`Buscar ${sourceTitle.toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} type="search" />
      </label>

      <div className="levitate-admin-picker__selected" aria-label={assignedTitle}>
        <BadgeCheck aria-hidden="true" size={18} />
        <div>
          <strong>{assignedTitle}</strong>
          {selectedItems.map((item) => (
            <button key={item.id} onClick={() => toggleItem(item.id)} type="button">
              <X aria-hidden="true" size={14} />
              {item.fullName}
            </button>
          ))}
          {selectedItems.length === 0 ? <span>Sin selección todavía.</span> : null}
        </div>
      </div>

      <ul className="levitate-admin-picker__options" aria-label={sourceTitle}>
        {filteredItems.map((item) => {
          const isSelected = selectedIdSet.has(item.id);
          const isDisabled = !isSelected && hasReachedLimit && maxSelection !== 1;
          const actionLabel = isSelected ? "Seleccionado" : isDisabled ? "Límite alcanzado" : hasReachedLimit && maxSelection === 1 ? "Reemplazar" : "Agregar";

          return (
            <li key={item.id}>
              <button
                aria-pressed={isSelected}
                className={isSelected ? "is-selected" : ""}
                disabled={isDisabled}
                onClick={() => toggleItem(item.id)}
                type="button"
              >
                <span className="levitate-admin-picker__check" aria-hidden="true">
                  {isSelected ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                </span>
                <span>{item.fullName}</span>
                <small>{actionLabel}</small>
              </button>
            </li>
          );
        })}
        {filteredItems.length === 0 ? <li className="levitate-admin-picker__empty">{emptyMessage}</li> : null}
      </ul>
    </section>
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
            Academias administran participantes y coreografías. Participantes consultan pagos y materiales asociados directamente a su CURP.
          </strong>
        </div>

        <div className="levitate-registration-choice__cards" aria-label="Tipos de registro">
          <a className="levitate-registration-choice-card" href="/registro/academias">
            <Building2 aria-hidden="true" size={28} />
            <span>Academias</span>
            <h2>Registrar academia</h2>
            <p>Acceso para titulares de academia: participantes, coreógrafos y coreografías.</p>
          </a>
          <a className="levitate-registration-choice-card" href="/registro/alumnos">
            <GraduationCap aria-hidden="true" size={28} />
            <span>Participantes</span>
            <h2>Ingresar con CURP</h2>
            <p>Consulta pagos, hojas de jueceo, fotos y videos sin usuario ni contraseña.</p>
          </a>
        </div>
      </section>
    </main>
  );
}

function LevitateAuthScreen({
  allowRegistration = true,
  onAuthenticated,
  systemMessage = "",
}: {
  allowRegistration?: boolean;
  onAuthenticated: (session: RegistrationSession | RegistrationBootstrap) => void;
  systemMessage?: string;
}) {
  const getInitialToken = (name: string) => {
    if (typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get(name) || "";
  };
  const [verifyToken] = useState(() => getInitialToken("verifyToken"));
  const [resetToken] = useState(() => getInitialToken("resetToken"));
  const [mode, setMode] = useState<AuthMode>(() => {
    if (getInitialToken("verifyToken")) {
      return "verify";
    }

    if (getInitialToken("resetToken")) {
      return "reset";
    }

    return "login";
  });
  const [loginNotice, setLoginNotice] = useState(() =>
    getInitialToken("confirmed") ? "Correo confirmado. Ya puedes ingresar al panel." : "",
  );
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [forgotNotice, setForgotNotice] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [resetError, setResetError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [debugActionUrl, setDebugActionUrl] = useState("");
  const [academyOriginType, setAcademyOriginType] = useState("mexico");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setLoginNotice("");
    setLoginError("");
    setDebugActionUrl("");

    try {
      const username = getFormValue(formData, "username");
      const password = getFormValue(formData, "password");

      if (isRegistrationDemoEnabled && username.toLowerCase() === demoAcademyCredentials.username && password === demoAcademyCredentials.password) {
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

  const handleForgotPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setForgotNotice("");
    setForgotError("");
    setDebugActionUrl("");

    try {
      const response = await requestRegistrationApi<RegistrationAuthActionResponse>(
        "/api/registration/auth/forgot-password",
        {
          body: JSON.stringify({
            identifier: getFormValue(formData, "identifier"),
          }),
          method: "POST",
        },
      );

      setForgotNotice(response.message || "Si encontramos una cuenta confirmada, enviaremos un enlace.");
      setDebugActionUrl(response.debugResetUrl || "");
    } catch (error) {
      setForgotError(getErrorMessage(error, "No se pudo solicitar el cambio de contraseña."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const password = getFormValue(formData, "password");
    const passwordConfirmation = getFormValue(formData, "passwordConfirmation");
    setIsSubmitting(true);
    setResetError("");

    try {
      if (password !== passwordConfirmation) {
        throw new Error("Las contraseñas no coinciden.");
      }

      const session = await requestRegistrationApi<RegistrationSession>("/api/registration/auth/reset-password", {
        body: JSON.stringify({
          password,
          token: resetToken,
        }),
        method: "POST",
      });

      onAuthenticated(session);
    } catch (error) {
      setResetError(getErrorMessage(error, "No se pudo cambiar la contraseña."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitEmailVerification = useCallback(async () => {
    if (!verifyToken) {
      setVerifyError("El enlace de confirmación no incluye token.");
      return;
    }

    setIsSubmitting(true);
    setVerifyError("");

    try {
      const session = await requestRegistrationApi<RegistrationSession>("/api/registration/auth/verify-email", {
        body: JSON.stringify({
          token: verifyToken,
        }),
        method: "POST",
      });

      onAuthenticated(session);
    } catch (error) {
      setVerifyError(getErrorMessage(error, "No se pudo confirmar el correo."));
    } finally {
      setIsSubmitting(false);
    }
  }, [onAuthenticated, verifyToken]);

  const handleRegisterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    setIsSubmitting(true);
    setRegisterError("");
    setDebugActionUrl("");

    try {
      const response = await requestRegistrationApi<RegistrationAuthActionResponse>("/api/registration/auth/register", {
        body: JSON.stringify({
          name: getFormValue(formData, "name"),
          username: getFormValue(formData, "username"),
          email: getFormValue(formData, "email"),
          password: getFormValue(formData, "password"),
          academy: getFormValue(formData, "academy"),
          phone: getFormValue(formData, "phone"),
          venue: getFormValue(formData, "venue"),
          academyOriginType,
          academyState: getFormValue(formData, "academyState"),
          academyCountry: getFormValue(formData, "academyCountry"),
        }),
        method: "POST",
      });

      form.reset();
      setAcademyOriginType("mexico");
      setLoginNotice(response.message || "Te enviamos un correo para confirmar tu cuenta antes de ingresar.");
      setDebugActionUrl(response.debugVerificationUrl || "");
      setMode("login");
    } catch (error) {
      setRegisterError(getErrorMessage(error, "No se pudo crear el usuario."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showTabs = allowRegistration && (mode === "login" || mode === "register");

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
          {showTabs ? (
            <div className="levitate-auth-tabs" role="tablist" aria-label="Acceso o registro">
              <button
                aria-selected={mode === "login"}
                className={mode === "login" ? "is-active" : ""}
                onClick={() => {
                  setMode("login");
                  setLoginError("");
                  setRegisterError("");
                  setDebugActionUrl("");
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
                  setLoginNotice("");
                  setLoginError("");
                  setRegisterError("");
                  setDebugActionUrl("");
                }}
                role="tab"
                type="button"
              >
                <UserPlus aria-hidden="true" size={17} />
                Crear usuario
              </button>
            </div>
          ) : null}

          {mode === "login" ? (
            <form className="levitate-auth-form levitate-auth-form--login" onSubmit={handleLoginSubmit}>
              <AdminStatusMessage message={systemMessage} tone="error" />
              <AdminStatusMessage message={loginNotice} />
              {debugActionUrl ? (
                <a className="levitate-auth-debug-link" href={debugActionUrl}>
                  Abrir enlace local
                </a>
              ) : null}
              {allowRegistration && isRegistrationDemoEnabled ? (
                <DemoCredentialsHint
                  label="Demo academia"
                  password={demoAcademyCredentials.password}
                  username={demoAcademyCredentials.username}
                />
              ) : null}
              <AdminField icon={AtSign} label="Usuario o correo">
                <input autoComplete="username" name="username" required type="text" />
              </AdminField>
              <AdminField icon={KeyRound} label="Contraseña">
                <input autoComplete="current-password" name="password" required type="password" />
              </AdminField>
              <button
                className="levitate-auth-text-button"
                onClick={() => {
                  setMode("forgot");
                  setForgotNotice("");
                  setForgotError("");
                  setDebugActionUrl("");
                }}
                type="button"
              >
                Olvidé mi contraseña
              </button>
              <AdminStatusMessage message={loginError} tone="error" />
              <button className="levitate-auth-submit" disabled={isSubmitting} type="submit">
                <LogIn aria-hidden="true" size={18} />
                {isSubmitting ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          ) : null}

          {allowRegistration && mode === "register" ? (
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
              <AdminField helper="Elige a qué evento se está registrando tu academia." icon={MapPin} label="Evento de inscripción">
                <AdminSelect defaultValue="edomex" id="academy-venue" name="venue" options={venueOptions} />
              </AdminField>
              <AdminField icon={Phone} label="Teléfono">
                <input autoComplete="tel" name="phone" type="tel" />
              </AdminField>
              <AdminField helper="Indica si la academia es mexicana o internacional." icon={Globe2} label="Origen de la academia">
                <AdminSelect
                  id="academy-origin-type"
                  name="academyOriginType"
                  onChange={(event) => setAcademyOriginType(event.target.value)}
                  options={academyOriginTypeOptions}
                  value={academyOriginType}
                />
              </AdminField>
              {academyOriginType === "mexico" ? (
                <AdminField icon={MapPin} label="Estado">
                  <AdminSelect defaultValue="estado_de_mexico" id="academy-origin-state" name="academyState" options={mexicoStateOptions} />
                </AdminField>
              ) : (
                <AdminField icon={Globe2} label="País">
                  <input autoComplete="country-name" name="academyCountry" placeholder="País de la academia" required type="text" />
                </AdminField>
              )}
              <AdminStatusMessage message={registerError} tone="error" />
              <button className="levitate-auth-submit" disabled={isSubmitting} type="submit">
                <UserPlus aria-hidden="true" size={18} />
                {isSubmitting ? "Creando..." : "Crear usuario"}
              </button>
            </form>
          ) : null}

          {mode === "forgot" ? (
            <form className="levitate-auth-form levitate-auth-form--forgot" onSubmit={handleForgotPasswordSubmit}>
              <div className="levitate-auth-action-heading">
                <Mail aria-hidden="true" size={20} />
                <div>
                  <span>Recuperar contraseña</span>
                  <p>Escribe tu usuario o correo confirmado y te enviaremos un enlace temporal.</p>
                </div>
              </div>
              <AdminField icon={AtSign} label="Usuario o correo">
                <input autoComplete="username" name="identifier" required type="text" />
              </AdminField>
              <AdminStatusMessage message={forgotNotice} />
              {debugActionUrl ? (
                <a className="levitate-auth-debug-link" href={debugActionUrl}>
                  Abrir enlace local
                </a>
              ) : null}
              <AdminStatusMessage message={forgotError} tone="error" />
              <button className="levitate-auth-submit" disabled={isSubmitting} type="submit">
                <Mail aria-hidden="true" size={18} />
                {isSubmitting ? "Enviando..." : "Enviar enlace"}
              </button>
              <button
                className="levitate-auth-text-button levitate-auth-text-button--center"
                onClick={() => {
                  setMode("login");
                  setForgotNotice("");
                  setForgotError("");
                  setDebugActionUrl("");
                }}
                type="button"
              >
                Volver al login
              </button>
            </form>
          ) : null}

          {mode === "reset" ? (
            <form className="levitate-auth-form levitate-auth-form--reset" onSubmit={handleResetPasswordSubmit}>
              <div className="levitate-auth-action-heading">
                <KeyRound aria-hidden="true" size={20} />
                <div>
                  <span>Nueva contraseña</span>
                  <p>Define una contraseña nueva para entrar al panel de academias.</p>
                </div>
              </div>
              <AdminField helper="Mínimo 8 caracteres." icon={KeyRound} label="Contraseña nueva">
                <input autoComplete="new-password" minLength={8} name="password" required type="password" />
              </AdminField>
              <AdminField icon={KeyRound} label="Confirmar contraseña">
                <input autoComplete="new-password" minLength={8} name="passwordConfirmation" required type="password" />
              </AdminField>
              <AdminStatusMessage message={resetError} tone="error" />
              <button className="levitate-auth-submit" disabled={isSubmitting || !resetToken} type="submit">
                <KeyRound aria-hidden="true" size={18} />
                {isSubmitting ? "Guardando..." : "Cambiar contraseña"}
              </button>
              <button
                className="levitate-auth-text-button levitate-auth-text-button--center"
                onClick={() => {
                  setMode("login");
                  setResetError("");
                }}
                type="button"
              >
                Volver al login
              </button>
            </form>
          ) : null}

          {mode === "verify" ? (
            <form
              className="levitate-auth-form levitate-auth-form--verify"
              onSubmit={(event) => {
                event.preventDefault();
                void submitEmailVerification();
              }}
            >
              <div className="levitate-auth-action-heading">
                <ShieldCheck aria-hidden="true" size={20} />
                <div>
                  <span>Confirmando correo</span>
                  <p>Estamos validando el enlace para activar tu acceso de academia.</p>
                </div>
              </div>
              <AdminStatusMessage message={verifyError} tone="error" />
              <button className="levitate-auth-submit" disabled={isSubmitting || !verifyToken} type="submit">
                <ShieldCheck aria-hidden="true" size={18} />
                {isSubmitting ? "Confirmando..." : "Confirmar correo"}
              </button>
              <button
                className="levitate-auth-text-button levitate-auth-text-button--center"
                onClick={() => {
                  setMode("login");
                  setVerifyError("");
                }}
                type="button"
              >
                Volver al login
              </button>
            </form>
          ) : null}
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

      if (isRegistrationStudentDemoEnabled && curp === demoStudentCredentials.curp) {
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
          <p>Portal de participante</p>
          <h1>Ingresa con tu CURP.</h1>
          <span aria-hidden="true" />
          <div>
            <ShieldCheck aria-hidden="true" size={22} />
            <strong>Consulta pagos, hojas de jueceo, fotos y videos asociados a la CURP registrada por tu academia.</strong>
          </div>
        </div>

        <section className="levitate-auth-card" aria-label="Acceso de participante">
          <form className="levitate-auth-form" onSubmit={handleAccessSubmit}>
            <AdminStatusMessage message={systemMessage} tone="error" />
            {isRegistrationStudentDemoEnabled ? <DemoCredentialsHint curp={demoStudentCredentials.curp} label="Demo participante" /> : null}
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
          <p>Portal de participante</p>
          <h1>Hola, {session.registrations[0]?.fullName || "participante Levitate"}.</h1>
          <div className="levitate-student-portal__meta">
            <span>CURP: {session.user.curp}</span>
            <span>{session.registrations.length} registro(s) asociado(s)</span>
            <span>{session.dances.length} coreografía(s)</span>
          </div>
        </div>
        <button className="levitate-admin-save levitate-student-portal__logout" onClick={onLogout} type="button">
          <LogOut aria-hidden="true" size={18} />
          Salir
        </button>
      </section>

      <section className="levitate-student-module-grid" aria-label="Acciones de participante">
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
                  {getVenueLabel(registration.venue)} · {getProgramDivisionLabel(registration.division)} · Playera{" "}
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

        <AdminPanel title="Coreografías" eyebrow="Competencia">
          <div className="levitate-student-list">
            {session.dances.map((dance) => (
              <article key={dance.id}>
                <strong>{dance.title}</strong>
                <span>{dance.academyName}</span>
                <p>
                  {getVenueLabel(dance.venue)} · {getOptionLabel(danceCategories, dance.category)} ·{" "}
                  {getDanceLevelLabel(dance.level)}
                </p>
              </article>
            ))}
            {session.dances.length === 0 ? <p className="levitate-admin-empty-state">Aún no hay coreografías asociadas a tu CURP.</p> : null}
          </div>
        </AdminPanel>
      </section>
    </main>
  );
}

function AdminSidebar({
  activeScreen,
  onScreenChange,
  onLogout,
}: {
  activeScreen: AdminScreenId;
  onScreenChange: (screen: AdminScreenId) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="levitate-admin-sidebar" aria-label="Menú administrativo">
      <h2>Registro</h2>
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
    </aside>
  );
}

function ParticipantRegistrationPanel({
  academyVenue,
  isAcademyInternational,
  registeredDanceCount,
  onParticipantCreated,
}: {
  academyVenue: string;
  isAcademyInternational: boolean;
  registeredDanceCount: number;
  onParticipantCreated: (participant: RegistrationParticipant) => void;
}) {
  const eventDate = venueEventDates[academyVenue] ?? venueEventDates.edomex;
  const isInternational = isAcademyInternational;
  const defaultCurpHelper = isInternational ? "Ingrese el número de documento." : "Ingrese su CURP (18 caracteres)";
  const releveTeacherMinimumDances = 3;
  const canRegisterReleveTeacher = registeredDanceCount >= releveTeacherMinimumDances;
  const releveTeacherHelper = canRegisterReleveTeacher
    ? "Disponible porque tu academia ya tiene 3 coreografías inscritas."
    : `Disponible al tener mínimo ${releveTeacherMinimumDances} coreografías inscritas de tu academia. Actualmente tienes ${registeredDanceCount}.`;
  const [curp, setCurp] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [ageValue, setAgeValue] = useState("");
  const [division, setDivision] = useState("baby");
  const [curpHelper, setCurpHelper] = useState(defaultCurpHelper);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const documentFieldLabel = isInternational ? "Número de Documento" : "CURP";

  const clearAutoFields = () => {
    setBirthDate("");
    setAgeValue("");
    setDivision("baby");
  };

  const updateAgeAndDivision = (nextBirthDate: string) => {
    const nextAge = calculateAgeAtDate(nextBirthDate, eventDate);

    if (nextAge == null) {
      setAgeValue("");
      setDivision("baby");
      return;
    }

    setAgeValue(String(nextAge));
    setDivision(getDivisionFromAge(nextAge));
  };

  useEffect(() => {
    setCurp("");
    clearAutoFields();
    setCurpHelper(defaultCurpHelper);
  }, [defaultCurpHelper]);

  const handleCurpChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextCurp = isInternational ? normalizeDocumentInput(event.target.value) : normalizeCurpInput(event.target.value);
    setCurp(nextCurp);
    setCurpHelper(defaultCurpHelper);

    if (isInternational) {
      return;
    }

    if (nextCurp.length !== 18) {
      clearAutoFields();
      return;
    }

    const nextBirthDate = getBirthDateFromCurp(nextCurp, eventDate);

    if (!nextBirthDate) {
      clearAutoFields();
      setCurpHelper("No pudimos leer la fecha de nacimiento. Revisa la CURP.");
      return;
    }

    setBirthDate(nextBirthDate);
    updateAgeAndDivision(nextBirthDate);
  };

  const handleBirthDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextBirthDate = event.target.value;
    setBirthDate(nextBirthDate);

    if (!nextBirthDate) {
      setAgeValue("");
      setDivision("baby");
      return;
    }

    updateAgeAndDivision(nextBirthDate);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const wantsReleveTeacher = formData.get("isReleveTeacher") === "on";
    setIsSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    if (wantsReleveTeacher && !canRegisterReleveTeacher) {
      setErrorMessage(
        `Para registrar un Maestro Relevé, tu academia debe tener al menos ${releveTeacherMinimumDances} coreografías inscritas.`,
      );
      setIsSaving(false);
      return;
    }

    try {
      const response = await requestRegistrationApi<{ participant: RegistrationParticipant }>("/api/registration/participants", {
        body: JSON.stringify({
          fullName: getFormValue(formData, "fullName"),
          curp: getFormValue(formData, "curp"),
          birthDate: getFormValue(formData, "birthDate"),
          age: getFormValue(formData, "age"),
          division: getFormValue(formData, "division"),
          shirtSize: getFormValue(formData, "shirtSize"),
          isInternational,
          isReleveTeacher: wantsReleveTeacher,
        }),
        method: "POST",
      });

      onParticipantCreated(response.participant);
      form.reset();
      setCurp("");
      clearAutoFields();
      setCurpHelper(defaultCurpHelper);
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
        <AdminField helper={curpHelper} icon={ClipboardList} label={documentFieldLabel}>
          <input
            maxLength={isInternational ? 32 : 18}
            minLength={isInternational ? 3 : 18}
            name="curp"
            onChange={handleCurpChange}
            required
            type="text"
            value={curp}
          />
        </AdminField>
        <AdminField
          helper={isInternational ? "Se usa para calcular edad y división." : "Se calcula automáticamente con la CURP."}
          icon={CalendarDays}
          label="Fecha de nacimiento"
        >
          <input
            aria-readonly={!isInternational}
            name="birthDate"
            onChange={handleBirthDateChange}
            readOnly={!isInternational}
            required
            type="date"
            value={birthDate}
          />
        </AdminField>
        <AdminField
          helper={isInternational ? "Se calcula automáticamente con la fecha de nacimiento." : "Se calcula automáticamente con la CURP."}
          icon={BadgeCheck}
          label="Edad"
        >
          <input aria-readonly="true" min={0} name="age" readOnly required type="number" value={ageValue} />
        </AdminField>
        <AdminField helper="Se asigna automáticamente según la edad al día del evento." icon={GraduationCap} label="División">
          <input name="division" type="hidden" value={division} />
          <AdminSelect
            disabled
            id="participant-division"
            name="participantDivisionDisplay"
            options={divisions}
            value={division}
          />
        </AdminField>
        <AdminField icon={Shirt} label="Talla playera">
          <AdminSelect defaultValue="6_8" id="participant-shirt" name="shirtSize" options={shirtSizes} />
        </AdminField>
        <label className={`levitate-admin-check-card${canRegisterReleveTeacher ? "" : " levitate-admin-check-card--disabled"}`}>
          <input disabled={!canRegisterReleveTeacher} name="isReleveTeacher" type="checkbox" />
          <span>
            <strong>Soy Maestro Relevé</strong>
            <small>{releveTeacherHelper}</small>
          </span>
        </label>
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
            phone: getFormValue(formData, "phone"),
            shirtSize: getFormValue(formData, "shirtSize"),
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
        <AdminField icon={Phone} label="Teléfono">
          <input name="phone" required type="tel" />
        </AdminField>
        <AdminField icon={Shirt} label="Talla playera">
          <AdminSelect defaultValue="m" id="choreographer-shirt" name="shirtSize" options={shirtSizes} />
        </AdminField>
        <AdminField icon={Building2} label="Nombre de la academia">
          <input readOnly required type="text" value={academyName} />
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
  onDanceCreated,
}: {
  academyVenue: string;
  choreographers: RegistrationChoreographer[];
  participants: RegistrationParticipant[];
  onDanceCreated: (dance: RegistrationDance) => void;
}) {
  const [selectedChoreographerIds, setSelectedChoreographerIds] = useState<string[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState(defaultDanceGenre);
  const [selectedSubgenre, setSelectedSubgenre] = useState(defaultDanceSubgenre);
  const [selectedCategory, setSelectedCategory] = useState(defaultDanceCategory);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const subgenreOptions = danceSubgenresByGenre[selectedGenre] ?? danceSubgenresByGenre[defaultDanceGenre];
  const categoryOptions = danceCategoriesByGenre[selectedGenre] ?? danceCategoriesByGenre[defaultDanceGenre];
  const shouldShowLevel = selectedGenre !== "motion";
  const choreographerItems = choreographers.map((choreographer) => ({
    id: choreographer.id,
    fullName: choreographer.fullName,
  }));
  const participantItems = participants.map((participant) => ({
    id: participant.id,
    fullName: participant.fullName,
  }));
  const participantRequirement = danceCategoryParticipantRequirements[selectedCategory] ?? null;
  const participantRequirementMessage =
    participantRequirement && selectedParticipantIds.length !== participantRequirement
      ? `Esta categoría requiere exactamente ${participantRequirement} ${participantRequirement === 1 ? "participante" : "participantes"}. Seleccionaste ${selectedParticipantIds.length}.`
      : "";
  const choreographerSelectionMessage =
    choreographers.length > 0 && selectedChoreographerIds.length === 0 ? "Selecciona al menos un coreógrafo." : "";
  const participantSelectionMessage =
    participantRequirementMessage ||
    (participants.length > 0 && selectedParticipantIds.length === 0 ? "Selecciona al menos un participante." : "");
  const cannotSave =
    isSaving ||
    choreographers.length === 0 ||
    participants.length === 0;

  const handleGenreChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextGenre = event.target.value;
    const nextSubgenre = danceSubgenresByGenre[nextGenre]?.[0]?.value ?? defaultDanceSubgenre;
    const nextCategory = danceCategoriesByGenre[nextGenre]?.[0]?.value ?? defaultDanceCategory;

    setSelectedGenre(nextGenre);
    setSelectedSubgenre(nextSubgenre);
    setSelectedCategory(nextCategory);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    setHasAttemptedSubmit(true);
    setStatusMessage("");
    setErrorMessage("");

    if (choreographerSelectionMessage || participantSelectionMessage) {
      return;
    }

    setIsSaving(true);

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
      setSelectedCategory(defaultDanceCategory);
      setSelectedChoreographerIds([]);
      setSelectedParticipantIds([]);
      setHasAttemptedSubmit(false);
      setStatusMessage("Coreografía guardada en la base.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "No se pudo guardar la coreografía."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPanel className="levitate-admin-panel--dance" title="Registro de nueva coreografía" eyebrow="Competencia">
      <form className="levitate-admin-form levitate-admin-form--dance" onSubmit={handleSubmit}>
        <AdminField className="levitate-admin-field--wide" icon={Music2} label="Nombre de la coreografía">
          <input name="title" required type="text" />
        </AdminField>
        <AdminField icon={Music2} label="Género de coreografía">
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
          <AdminSelect
            id="dance-category"
            name="category"
            onChange={(event) => setSelectedCategory(event.target.value)}
            options={categoryOptions}
            value={selectedCategory}
          />
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
            selectionHint="Marca uno o más coreógrafos responsables."
            sourceItems={choreographerItems}
            sourceTitle="Coreógrafos"
          />
        </div>

        <div className="levitate-admin-form__wide-block">
          <TransferList
            assignedTitle="Participantes inscritos"
            emptyMessage="Registra un participante primero."
            maxSelection={participantRequirement}
            onSelectionChange={setSelectedParticipantIds}
            selectedIds={selectedParticipantIds}
            selectionHint={
              participantRequirement
                ? `Marca exactamente ${participantRequirement} ${participantRequirement === 1 ? "participante" : "participantes"} para esta categoría.`
                : "Marca los participantes de esta coreografía."
            }
            sourceItems={participantItems}
            sourceTitle="Participantes"
          />
        </div>

        <div className="levitate-admin-form__wide-block">
          <AdminStatusMessage message={statusMessage} />
          <AdminStatusMessage message={hasAttemptedSubmit ? choreographerSelectionMessage : ""} tone="error" />
          <AdminStatusMessage message={hasAttemptedSubmit ? participantSelectionMessage : ""} tone="error" />
          <AdminStatusMessage message={errorMessage} tone="error" />
        </div>
        <div className="levitate-admin-form__actions">
          <SaveButton disabled={cannotSave} isSaving={isSaving} />
        </div>
      </form>
    </AdminPanel>
  );
}

function ProgramPanel({
  academyName = "",
  dances,
  emptyMessage = "Todavía no hay coreografías para armar el programa.",
}: {
  academyName?: string;
  dances: RegistrationDance[];
  emptyMessage?: string;
}) {
  const programRows = useMemo(() => buildProgramRows(dances, academyName), [academyName, dances]);
  const programBlocks = useMemo(() => buildProgramBlocks(programRows), [programRows]);
  const totalRows = programRows.length;

  return (
    <section className="levitate-admin-program" aria-label="Programa de competencia">
      {programBlocks.map((block) => (
        <section className="levitate-admin-program-block" key={block.id} aria-label={block.title}>
          <header>
            <div>
              <span>{toProgramUpper(block.title)}</span>
              <strong>
                {block.rows.length} {block.rows.length === 1 ? "COREOGRAFÍA" : "COREOGRAFÍAS"}
              </strong>
            </div>
          </header>

          <div className="levitate-admin-program-table" role="table" aria-label={`Programa ${block.title}`}>
            <div className="levitate-admin-program-table__head" role="row">
              <span role="columnheader">COREOGRAFÍA</span>
              <span role="columnheader">ACADEMIA</span>
              <span role="columnheader">DIVISIÓN</span>
              <span role="columnheader">SUBGÉNERO</span>
              <span role="columnheader">CATEGORÍA</span>
              <span role="columnheader">COREÓGRAFOS</span>
              <span role="columnheader">PARTICIPANTE</span>
              <span role="columnheader">ESTADO</span>
            </div>
            {block.rows.map((row) => {
              const [danceTitle, rowAcademyName, division, subgenre, category, choreographers, participants, venue] = getProgramRowDisplay(row);

              return (
                <div className="levitate-admin-program-table__row" key={row.danceId} role="row">
                  <span role="cell">{toProgramUpper(danceTitle)}</span>
                  <span role="cell">{toProgramUpper(rowAcademyName)}</span>
                  <span role="cell">{toProgramUpper(division)}</span>
                  <span role="cell">{toProgramUpper(subgenre)}</span>
                  <span role="cell">{toProgramUpper(category)}</span>
                  <span role="cell">{toProgramUpper(choreographers)}</span>
                  <span role="cell">{toProgramUpper(participants)}</span>
                  <span role="cell">{toProgramUpper(venue)}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {totalRows === 0 ? <p className="levitate-admin-empty-state">{emptyMessage}</p> : null}
    </section>
  );
}

function MusicUploadPanel({
  academyName,
  dances,
  onDanceUpdated,
}: {
  academyName: string;
  dances: RegistrationDance[];
  onDanceUpdated: (dance: RegistrationDance) => void;
}) {
  const [selectedDanceId, setSelectedDanceId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputVersion, setFileInputVersion] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const selectedDance = dances.find((dance) => dance.id === selectedDanceId) ?? dances[0] ?? null;
  const selectedDanceValue = selectedDance?.id ?? "";
  const currentMusicUpload = selectedDance?.musicUpload ?? null;
  const selectedCategoryOptions = selectedDance ? danceCategoriesByGenre[selectedDance.genre] ?? danceCategories : danceCategories;
  const selectedDivision = selectedDance ? getDanceProgramDivision(selectedDance) : "";
  const selectedDivisionLabel = selectedDivision ? getProgramDivisionLabel(selectedDivision).split(":")[0] : "";
  const suggestedFileName = selectedDance
    ? `${selectedDance.title} - ${academyName} - ${getOptionLabel(danceGenres, selectedDance.genre)} ${getOptionLabel(
        danceSubgenresByGenre[selectedDance.genre] ?? [],
        selectedDance.subgenre,
      )} - ${getOptionLabel(selectedCategoryOptions, selectedDance.category)}${selectedDivisionLabel ? ` - ${selectedDivisionLabel}` : ""}`
    : "";
  const danceOptions = dances.map((dance) => ({
    value: dance.id,
      label: dance.title,
    }));

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    setUploadError("");
    setUploadMessage("");
    setSelectedFile(null);

    if (!file) {
      return;
    }

    if (file.size > maxMusicUploadBytes) {
      event.currentTarget.value = "";
      setUploadError("La canción debe pesar menos de 12 MB.");
      return;
    }

    if (!isMp3File(file)) {
      event.currentTarget.value = "";
      setUploadError("Solo se aceptan archivos en formato MP3.");
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedDance) {
      setUploadError("Selecciona una coreografía.");
      return;
    }

    if (!selectedFile) {
      setUploadError("Selecciona un archivo MP3.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setUploadMessage("");

    try {
      const musicFile = await readMusicFileAsDataUrl(selectedFile);

      if (getPersistedDemoRegistrationSession() === "academy") {
        const demoUpload: RegistrationMusicUpload = {
          ...musicFile,
          id: `demo-music-upload-${selectedDance.id}`,
          danceId: selectedDance.id,
          uploadedAt: new Date().toISOString(),
        };

        onDanceUpdated({
          ...selectedDance,
          musicUpload: demoUpload,
        });
        setUploadMessage("Música subida para la coreografía seleccionada.");
        setSelectedFile(null);
        setFileInputVersion((current) => current + 1);
        return;
      }

      const response = await requestRegistrationApi<{ dance: RegistrationDance; musicUpload: RegistrationMusicUpload }>(
        "/api/registration/music",
        {
          body: JSON.stringify({
            danceId: selectedDance.id,
            ...musicFile,
          }),
          method: "POST",
        },
      );

      onDanceUpdated(response.dance);
      setUploadMessage("Música subida para la coreografía seleccionada.");
      setSelectedFile(null);
      setFileInputVersion((current) => current + 1);
    } catch (error) {
      setUploadError(getErrorMessage(error, "No pudimos subir la música."));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AdminPanel className="levitate-admin-panel--music" eyebrow="Música" title="Subir música">
      <form className="levitate-admin-music-form" onSubmit={handleSubmit}>
        <AdminField icon={Music2} label="Coreografía">
          <AdminSelect
            disabled={dances.length === 0}
            id="music-dance"
            name="danceId"
            onChange={(event) => {
              setSelectedDanceId(event.target.value);
              setSelectedFile(null);
              setFileInputVersion((current) => current + 1);
              setUploadMessage("");
              setUploadError("");
            }}
            options={danceOptions}
            value={selectedDanceValue}
          />
        </AdminField>

        {selectedDance ? (
          <div className="levitate-admin-music-selected">
            <span>{getOptionLabel(danceGenres, selectedDance.genre)}</span>
            <strong>{selectedDance.title}</strong>
            <p>{selectedDance.participants.map((participant) => participant.fullName).join(", ") || "Sin participantes asignados"}</p>
            <small>
              {currentMusicUpload
                ? `Música actual: ${currentMusicUpload.fileName}${
                    currentMusicUpload.storageProvider === "google_drive" ? " · Google Drive" : ""
                  }`
                : `${suggestedFileName}.mp3`}
            </small>
          </div>
        ) : null}

        <label className={`levitate-admin-music-dropzone${selectedFile ? " has-file" : ""}`}>
          <Upload aria-hidden="true" size={26} />
          <strong>{selectedFile?.name || "Sube la canción en MP3"}</strong>
          <span>
            {selectedFile
              ? `Archivo listo para subir · ${formatAdminFileSize(selectedFile.size)}`
              : currentMusicUpload
                ? `Último archivo: ${currentMusicUpload.fileName} · ${formatAdminFileSize(currentMusicUpload.fileSize)}`
                : "Selecciona únicamente un archivo .mp3."}
          </span>
          <input key={fileInputVersion} accept=".mp3,audio/mpeg" disabled={!selectedDance || isUploading} onChange={handleFileChange} type="file" />
        </label>

        <button className="levitate-admin-save" disabled={!selectedDance || !selectedFile || isUploading} type="submit">
          <Upload aria-hidden="true" size={18} />
          {isUploading ? "Subiendo música..." : "Subir música"}
        </button>

        <AdminStatusMessage message={uploadMessage} />
        <AdminStatusMessage message={uploadError} tone="error" />
        {dances.length === 0 ? <p className="levitate-admin-empty-state">Registra una coreografía para poder subir su música.</p> : null}
      </form>
    </AdminPanel>
  );
}

function FeedbackPanel({ dances }: { dances: RegistrationDance[] }) {
  return (
    <AdminPanel className="levitate-admin-panel--feedback" eyebrow="Jueceo" title="Feedback">
      <div className="levitate-admin-feedback-list">
        {dances.map((dance) => (
          <article className="levitate-admin-feedback-card" key={dance.id}>
            <div>
              <span>{getOptionLabel(danceCategories, dance.category)}</span>
              <h2>{dance.title}</h2>
              <p>{dance.participants.map((participant) => participant.fullName).join(", ")}</p>
            </div>
            <strong>Por publicar</strong>
          </article>
        ))}
        {dances.length === 0 ? (
          <p className="levitate-admin-empty-state">Todavía no hay coreografías registradas para mostrar feedback.</p>
        ) : null}
      </div>
    </AdminPanel>
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
          <span>{getRegistrationInscriptionPaymentReference(order)}</span>
          <h3>{order.participantName}</h3>
          <p>
            {order.curp} · {getVenueLabel(order.venue)}
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

export function LevitateRegistrationAdminPaymentsRoute({
  initialSection = "payments",
}: {
  initialSection?: RegistrationAdminDashboardSection;
} = {}) {
  const [adminSession, setAdminSession] = useState<RegistrationSession | null>(null);
  const [activeSection, setActiveSection] = useState<RegistrationAdminDashboardSection>(initialSection);
  const [orders, setOrders] = useState<RegistrationInscriptionOrder[]>([]);
  const [adminParticipants, setAdminParticipants] = useState<RegistrationAdminParticipant[]>([]);
  const [programDances, setProgramDances] = useState<RegistrationDance[]>([]);
  const [totals, setTotals] = useState<RegistrationAdminOrderTotals | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState("all");
  const [registrationQuery, setRegistrationQuery] = useState("");
  const [registrationAcademyFilter, setRegistrationAcademyFilter] = useState("all");
  const [registrationVenueFilter, setRegistrationVenueFilter] = useState("all");
  const [registrationDivisionFilter, setRegistrationDivisionFilter] = useState("all");
  const [ticketQuery, setTicketQuery] = useState("");
  const [ticketVenueFilter, setTicketVenueFilter] = useState("all");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaVenueFilter, setMediaVenueFilter] = useState("all");
  const [mediaStatusFilter, setMediaStatusFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [adminAuthMessage, setAdminAuthMessage] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isCheckingAdminSession, setIsCheckingAdminSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(false);
  const [isProgramLoading, setIsProgramLoading] = useState(false);

  const handleAdminAuthenticated = useCallback((nextSession: RegistrationSession | RegistrationBootstrap) => {
    if (nextSession.user.role !== "admin") {
      setAdminSession(null);
      setAdminAuthMessage("Este usuario no tiene acceso al panel admin.");
      return;
    }

    setAdminSession({
      user: nextSession.user,
      academy: nextSession.academy,
    });
    setAdminAuthMessage("");
  }, []);

  const loadAdminSession = useCallback(async () => {
    setIsCheckingAdminSession(true);

    try {
      const session = await requestRegistrationApi<RegistrationSession>("/api/registration/me");

      handleAdminAuthenticated(session);
    } catch (error) {
      setAdminSession(null);

      if (isUnauthorizedRegistrationError(error)) {
        setAdminAuthMessage("");
      } else {
        setAdminAuthMessage(getErrorMessage(error, "No se pudo validar el acceso admin."));
      }
    } finally {
      setIsCheckingAdminSession(false);
    }
  }, [handleAdminAuthenticated]);

  const loadAdminOrders = useCallback(async () => {
    if (adminSession?.user.role !== "admin") {
      return;
    }

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
  }, [adminSession?.user.role]);

  const loadAdminParticipants = useCallback(async () => {
    if (adminSession?.user.role !== "admin") {
      return;
    }

    setIsParticipantsLoading(true);
    setAdminError("");

    try {
      const payload = await requestRegistrationApi<RegistrationAdminParticipantsPayload>("/api/registration/admin/participants");
      setAdminParticipants(payload.participants);
    } catch (error) {
      setAdminError(getErrorMessage(error, "No se pudieron cargar los participantes."));
    } finally {
      setIsParticipantsLoading(false);
    }
  }, [adminSession?.user.role]);

  const loadAdminProgram = useCallback(async () => {
    if (adminSession?.user.role !== "admin") {
      return;
    }

    setIsProgramLoading(true);
    setAdminError("");

    try {
      const payload = await requestRegistrationApi<RegistrationAdminProgramPayload>("/api/registration/admin/program");
      setProgramDances(payload.dances);
    } catch (error) {
      setAdminError(getErrorMessage(error, "No se pudo cargar el programa."));
    } finally {
      setIsProgramLoading(false);
    }
  }, [adminSession?.user.role]);

  useEffect(() => {
    void loadAdminSession();
  }, [loadAdminSession]);

  useEffect(() => {
    if (adminSession?.user.role === "admin") {
      void loadAdminOrders();
    }
  }, [adminSession?.user.role, loadAdminOrders]);

  useEffect(() => {
    if (adminSession?.user.role === "admin" && activeSection === "program") {
      void loadAdminProgram();
    }
  }, [activeSection, adminSession?.user.role, loadAdminProgram]);

  useEffect(() => {
    if (adminSession?.user.role === "admin" && activeSection === "registrations") {
      void loadAdminParticipants();
    }
  }, [activeSection, adminSession?.user.role, loadAdminParticipants]);

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
      const matchesPurchaseType = purchaseTypeFilter === "all" || getAdminOrderType(order) === purchaseTypeFilter;
      const matchesQuery =
        !normalizedQuery ||
        [getRegistrationInscriptionPaymentReference(order), order.reference, order.curp, order.participantName, order.academyName, order.venue]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesVenue && matchesPurchaseType && matchesQuery;
    });
  }, [orders, purchaseTypeFilter, query, statusFilter, venueFilter]);

  const visibleOrders = filteredOrders.slice(0, 10);
  const registrationAcademyOptions = useMemo(() => {
    const optionMap = new Map<string, string>();

    for (const participant of adminParticipants) {
      optionMap.set(participant.academyId, participant.academyName);
    }

    return Array.from(optionMap.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((left, right) => left.label.localeCompare(right.label, "es"));
  }, [adminParticipants]);
  const filteredAdminParticipants = useMemo(() => {
    const normalizedQuery = registrationQuery.trim().toLowerCase();

    return adminParticipants.filter((participant) => {
      const matchesAcademy = registrationAcademyFilter === "all" || participant.academyId === registrationAcademyFilter;
      const matchesVenue = registrationVenueFilter === "all" || participant.academyVenue === registrationVenueFilter;
      const matchesDivision = registrationDivisionFilter === "all" || participant.division === registrationDivisionFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          participant.fullName,
          participant.curp,
          participant.academyName,
          participant.academyContactName ?? "",
          participant.academyEmail ?? "",
          participant.academyPhone ?? "",
          getAcademyOriginLabel({
            originCountry: participant.academyOriginCountry,
            originState: participant.academyOriginState,
            originType: participant.academyOriginType,
          }),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesAcademy && matchesVenue && matchesDivision && matchesQuery;
    });
  }, [adminParticipants, registrationAcademyFilter, registrationDivisionFilter, registrationQuery, registrationVenueFilter]);
  const participantGroups = useMemo(() => getAdminParticipantGroups(filteredAdminParticipants), [filteredAdminParticipants]);
  const participantTotals = useMemo(() => getAdminParticipantTotals(filteredAdminParticipants, orders), [filteredAdminParticipants, orders]);
  const ticketRows = useMemo(() => getTicketDashboardRows(orders), [orders]);
  const filteredTicketRows = useMemo(() => {
    const normalizedQuery = ticketQuery.trim().toLowerCase();

    return ticketRows.filter((row) => {
      const matchesVenue = ticketVenueFilter === "all" || row.venue === ticketVenueFilter;
      const matchesStatus =
        ticketStatusFilter === "all" ||
        (ticketStatusFilter === "paid" && row.paidTickets > 0) ||
        (ticketStatusFilter === "pending" && row.pendingTickets > 0) ||
        (ticketStatusFilter === "rejected" && row.rejectedTickets > 0) ||
        (ticketStatusFilter === "used" && row.usedTickets > 0);
      const matchesQuery =
        !normalizedQuery ||
        [row.participantName, row.curp, row.academyName, row.latestReference, row.venue].join(" ").toLowerCase().includes(normalizedQuery);

      return matchesVenue && matchesStatus && matchesQuery;
    });
  }, [ticketRows, ticketQuery, ticketVenueFilter, ticketStatusFilter]);
  const visibleTicketRows = filteredTicketRows.slice(0, 10);
  const ticketTotals = useMemo(() => getTicketDashboardTotals(filteredTicketRows), [filteredTicketRows]);
  const mediaOrders = useMemo(
    () => orders.filter((order) => getAdminOrderType(order) === "shop" && getOrderMediaLineItems(order).length > 0),
    [orders],
  );
  const filteredMediaOrders = useMemo(() => {
    const normalizedQuery = mediaQuery.trim().toLowerCase();

    return mediaOrders.filter((order) => {
      const matchesVenue = mediaVenueFilter === "all" || order.venue === mediaVenueFilter;
      const matchesStatus = mediaStatusFilter === "all" || order.status === mediaStatusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          getRegistrationInscriptionPaymentReference(order),
          order.reference,
          order.curp,
          order.participantName,
          order.academyName,
          order.buyerPhone ?? "",
          order.venue,
          getOrderMediaConcept(order),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesVenue && matchesStatus && matchesQuery;
    });
  }, [mediaOrders, mediaQuery, mediaStatusFilter, mediaVenueFilter]);
  const visibleMediaOrders = filteredMediaOrders.slice(0, 10);
  const mediaTotals = useMemo(() => getMediaDashboardTotals(filteredMediaOrders), [filteredMediaOrders]);
  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) || null : null;
  const isTicketSection = activeSection === "tickets";
  const isProgramSection = activeSection === "program";
  const isMediaSection = activeSection === "media";
  const isRegistrationsSection = activeSection === "registrations";

  const handleOrderUpdated = (order: RegistrationInscriptionOrder) => {
    setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
    setSelectedOrderId(order.id);
    void loadAdminOrders();
  };

  const handleSectionChange = (section: RegistrationAdminDashboardSection) => {
    setActiveSection(section);
    setSelectedOrderId("");

    if (typeof window !== "undefined") {
      let nextPath = "/admin/inscripciones";

      if (section === "tickets") {
        nextPath = "/admin/boletos";
      } else if (section === "program") {
        nextPath = "/admin/programa";
      } else if (section === "media") {
        nextPath = "/admin/foto-video";
      } else if (section === "registrations") {
        nextPath = "/admin/inscripciones/participantes";
      }

      window.history.replaceState(null, "", nextPath);
    }
  };

  let headerTitle = "Pagos";
  let headerDescription = "Revisión y confirmación de comprobantes";

  if (isTicketSection) {
    headerTitle = "Boletos";
    headerDescription = "Boletos pedidos por niño, estado de pago y QR generados";
  } else if (isProgramSection) {
    headerTitle = "Programa";
    headerDescription = "Orden de salida global con coreografías de todas las academias";
  } else if (isMediaSection) {
    headerTitle = "Foto/Video";
    headerDescription = "Compras de paquetes de fotografía y video realizadas en tienda";
  } else if (isRegistrationsSection) {
    headerTitle = "Inscripciones";
    headerDescription = "Participantes registrados por academia";
  }

  if (isCheckingAdminSession) {
    return <LoadingRegistrationScreen />;
  }

  if (!adminSession) {
    return (
      <LevitateAuthScreen
        allowRegistration={false}
        onAuthenticated={handleAdminAuthenticated}
        systemMessage={adminAuthMessage}
      />
    );
  }

  return (
    <main className="registration-admin-dashboard">
      <aside className="registration-admin-sidebar" aria-label="Navegación admin">
        <div className="registration-admin-brand">Levitate</div>
        <nav>
          {registrationAdminDashboardNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.section === activeSection;

            return (
              <button
                className={isActive ? "is-active" : ""}
                disabled={!item.section}
                key={item.label}
                onClick={() => {
                  if (item.section) {
                    handleSectionChange(item.section);
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
        <button className="registration-admin-collapse" type="button" aria-label="Contraer menú">
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
      </aside>

      <section className="registration-admin-workspace">
        <header className="registration-admin-header">
          <div>
            <h1>{headerTitle}</h1>
            <p>{headerDescription}</p>
          </div>
          {!isProgramSection ? (
            <button
              className="registration-admin-export"
              disabled={
                isTicketSection
                  ? filteredTicketRows.length === 0
                  : isMediaSection
                    ? filteredMediaOrders.length === 0
                    : isRegistrationsSection
                      ? filteredAdminParticipants.length === 0
                    : filteredOrders.length === 0
              }
              onClick={() => {
                if (isTicketSection) {
                  downloadTicketDashboardCsv(filteredTicketRows);
                  return;
                }

                if (isMediaSection) {
                  downloadMediaOrdersCsv(filteredMediaOrders);
                  return;
                }

                if (isRegistrationsSection) {
                  downloadAdminParticipantsCsv(filteredAdminParticipants, orders);
                  return;
                }

                downloadRegistrationOrdersCsv(filteredOrders);
              }}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Exportar
            </button>
          ) : null}
        </header>

        {adminError ? <p className="registration-admin-alert">{adminError}</p> : null}

        {isProgramSection ? (
          <ProgramPanel
            dances={programDances}
            emptyMessage={isProgramLoading ? "Cargando programa..." : "Todavía no hay coreografías para armar el programa."}
          />
        ) : isRegistrationsSection ? (
          <>
            <section className="registration-admin-summary registration-admin-summary--registrations" aria-label="Resumen de participantes registrados">
              <article>
                <span>Academias</span>
                <strong>{participantTotals.academies}</strong>
                <Building2 aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Participantes</span>
                <strong>{participantTotals.participants}</strong>
                <Users aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Pagados</span>
                <strong>{participantTotals.paid}</strong>
                <CheckCircle2 aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Pendientes</span>
                <strong>{participantTotals.pending}</strong>
                <Clock aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Sin orden</span>
                <strong>{participantTotals.withoutOrder}</strong>
                <CircleAlert aria-hidden="true" size={24} />
              </article>
            </section>

            <section className="registration-admin-filters registration-admin-filters--registrations" aria-label="Filtros de inscripciones">
              <label className="registration-admin-search">
                <Search aria-hidden="true" size={17} />
                <input
                  onChange={(event) => setRegistrationQuery(event.target.value)}
                  placeholder="Buscar participante, CURP o academia..."
                  type="search"
                  value={registrationQuery}
                />
              </label>
              <label>
                <span>Academia</span>
                <select onChange={(event) => setRegistrationAcademyFilter(event.target.value)} value={registrationAcademyFilter}>
                  <option value="all">Todas</option>
                  {registrationAcademyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={16} />
              </label>
              <label>
                <span>Evento</span>
                <select onChange={(event) => setRegistrationVenueFilter(event.target.value)} value={registrationVenueFilter}>
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
                <span>División</span>
                <select onChange={(event) => setRegistrationDivisionFilter(event.target.value)} value={registrationDivisionFilter}>
                  <option value="all">Todas</option>
                  {divisions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={16} />
              </label>
            </section>

            <section className="registration-admin-grid">
              <div className="registration-admin-table-card registration-admin-participants-card">
                {participantGroups.map((group) => (
                  <section className="registration-admin-participant-group" key={group.key}>
                    <header>
                      <div>
                        <strong>{group.academyName}</strong>
                        <span>
                          {group.originLabel} · {getVenueLabel(group.venue)} · {group.participants.length} participante(s)
                        </span>
                      </div>
                    </header>
                    <div className="registration-admin-table registration-admin-participants-table" role="table" aria-label={`Participantes de ${group.academyName}`}>
                      <div className="registration-admin-table__head" role="row">
                        <span role="columnheader">Participante</span>
                        <span role="columnheader">CURP</span>
                        <span role="columnheader">División</span>
                        <span role="columnheader">Edad</span>
                        <span role="columnheader">Talla</span>
                        <span role="columnheader">Relevé</span>
                        <span role="columnheader">Pago</span>
                        <span role="columnheader">Registro</span>
                      </div>

                      {group.participants.map((participant) => {
                        const paymentStatus = getParticipantPaymentStatus(participant, orders);
                        const createdAt = new Date(participant.createdAt);
                        const createdDate = Number.isNaN(createdAt.getTime())
                          ? participant.createdAt || "Sin fecha"
                          : createdAt.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });

                        return (
                          <div className="registration-admin-table__row registration-admin-table__row--static" key={participant.id} role="row">
                            <span role="cell">
                              {participant.fullName}
                              {participant.isInternational ? <small>Internacional</small> : null}
                            </span>
                            <span role="cell">{participant.curp}</span>
                            <span role="cell">{getProgramDivisionLabel(participant.division)}</span>
                            <span role="cell">{participant.age ?? "—"}</span>
                            <span role="cell">{getOptionLabel(shirtSizes, participant.shirtSize)}</span>
                            <span role="cell">{participant.isReleveTeacher ? "Sí" : "No"}</span>
                            <span role="cell">
                              <em className={getParticipantPaymentStatusClass(paymentStatus)}>{getParticipantPaymentStatusLabel(paymentStatus)}</em>
                            </span>
                            <span role="cell">{createdDate}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}

                {participantGroups.length === 0 ? (
                  <p className="registration-admin-empty">
                    {isParticipantsLoading ? "Cargando participantes..." : "No hay participantes registrados con esos filtros."}
                  </p>
                ) : null}
                <footer className="registration-admin-table-footer">
                  <span>
                    Mostrando {filteredAdminParticipants.length} de {adminParticipants.length} participantes
                  </span>
                  <div>
                    <button disabled type="button">
                      {participantGroups.length} academia(s)
                    </button>
                  </div>
                </footer>
              </div>
            </section>
          </>
        ) : isTicketSection ? (
          <>
            <section className="registration-admin-summary registration-admin-summary--tickets" aria-label="Resumen de boletos por niño">
              <article>
                <span>Niños con boleto</span>
                <strong>{ticketTotals.childCount}</strong>
                <Users aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Boletos pedidos</span>
                <strong>{ticketTotals.requestedTickets}</strong>
                <Ticket aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Aprobados</span>
                <strong>{ticketTotals.paidTickets}</strong>
                <CheckCircle2 aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Pendientes</span>
                <strong>{ticketTotals.pendingTickets}</strong>
                <Clock aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Promedio por niño</span>
                <strong>{formatTicketAverage(ticketTotals.requestedTickets, ticketTotals.childCount)}</strong>
                <BarChart3 aria-hidden="true" size={24} />
              </article>
            </section>

            <section className="registration-admin-filters registration-admin-filters--tickets" aria-label="Filtros de boletos">
              <label className="registration-admin-search">
                <Search aria-hidden="true" size={17} />
                <input
                  onChange={(event) => setTicketQuery(event.target.value)}
                  placeholder="Buscar niño, CURP, academia u orden..."
                  type="search"
                  value={ticketQuery}
                />
              </label>
              <label>
                <span>Evento</span>
                <select onChange={(event) => setTicketVenueFilter(event.target.value)} value={ticketVenueFilter}>
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
                <span>Estado boletos</span>
                <select onChange={(event) => setTicketStatusFilter(event.target.value)} value={ticketStatusFilter}>
                  <option value="all">Todos</option>
                  <option value="paid">Con aprobados</option>
                  <option value="pending">Con pendientes</option>
                  <option value="rejected">Con rechazados</option>
                  <option value="used">Con QR usados</option>
                </select>
                <ChevronDown aria-hidden="true" size={16} />
              </label>
            </section>

            <section className="registration-admin-grid">
              <div className="registration-admin-table-card">
                <div className="registration-admin-table registration-admin-ticket-table" role="table" aria-label="Boletos comprados por niño">
                  <div className="registration-admin-table__head" role="row">
                    <span role="columnheader">Niño</span>
                    <span role="columnheader">CURP</span>
                    <span role="columnheader">Academia</span>
                    <span role="columnheader">Sede</span>
                    <span role="columnheader">Pedidos</span>
                    <span role="columnheader">Comprados</span>
                    <span role="columnheader">QR activos</span>
                    <span role="columnheader">Pendientes</span>
                    <span role="columnheader">Rechazados</span>
                    <span role="columnheader">Última orden</span>
                  </div>

                  {visibleTicketRows.map((row) => {
                    const date = getAdminOrderDate({ createdAt: row.updatedAt, updatedAt: row.updatedAt } as RegistrationInscriptionOrder);

                    return (
                      <button
                        className={`registration-admin-table__row${selectedOrder?.id === row.latestOrderId ? " is-selected" : ""}`}
                        key={row.curp || row.latestOrderId}
                        onClick={() => setSelectedOrderId(row.latestOrderId)}
                        role="row"
                        type="button"
                      >
                        <span role="cell">{row.participantName}</span>
                        <span role="cell">{row.curp || "Sin CURP"}</span>
                        <span role="cell">{row.academyName}</span>
                        <span role="cell">{getVenueLabel(row.venue)}</span>
                        <span role="cell">
                          <strong className="registration-admin-ticket-number">{row.requestedTickets}</strong>
                        </span>
                        <span role="cell">
                          <strong className="registration-admin-ticket-number registration-admin-ticket-number--primary">{row.paidTickets}</strong>
                        </span>
                        <span role="cell">
                          <strong className="registration-admin-ticket-number">{row.activeTickets}</strong>
                          <small>{row.usedTickets} usados</small>
                        </span>
                        <span role="cell">{row.pendingTickets}</span>
                        <span role="cell">{row.rejectedTickets}</span>
                        <span role="cell">
                          {row.latestReference}
                          <small>
                            {getAdminPaymentStatusLabel(row.latestStatus)} · {date.date}
                          </small>
                        </span>
                      </button>
                    );
                  })}

                  {visibleTicketRows.length === 0 ? (
                    <p className="registration-admin-empty">{isLoading ? "Cargando boletos..." : "No hay compras de boletos con esos filtros."}</p>
                  ) : null}
                </div>
                <footer className="registration-admin-table-footer">
                  <span>
                    Mostrando {visibleTicketRows.length > 0 ? 1 : 0} a {visibleTicketRows.length} de {filteredTicketRows.length} niños
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
          </>
        ) : isMediaSection ? (
          <>
            <section className="registration-admin-summary registration-admin-summary--media" aria-label="Resumen de foto y video">
              <article>
                <span>Compras</span>
                <strong>{mediaTotals.orderCount}</strong>
                <Camera aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Paquetes</span>
                <strong>{mediaTotals.requestedItems}</strong>
                <ShoppingBag aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Con comprobante</span>
                <strong>{mediaTotals.proofCount}</strong>
                <FileText aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Aprobadas</span>
                <strong>{mediaTotals.paid}</strong>
                <CheckCircle2 aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Monto total</span>
                <strong>{formatAdminCurrency(mediaTotals.amount)}</strong>
                <CreditCard aria-hidden="true" size={24} />
              </article>
            </section>

            <section className="registration-admin-filters registration-admin-filters--media" aria-label="Filtros de foto y video">
              <label className="registration-admin-search">
                <Search aria-hidden="true" size={17} />
                <input
                  onChange={(event) => setMediaQuery(event.target.value)}
                  placeholder="Buscar contacto, CURP, academia u orden..."
                  type="search"
                  value={mediaQuery}
                />
              </label>
              <label>
                <span>Evento</span>
                <select onChange={(event) => setMediaVenueFilter(event.target.value)} value={mediaVenueFilter}>
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
                <span>Status</span>
                <select onChange={(event) => setMediaStatusFilter(event.target.value)} value={mediaStatusFilter}>
                  <option value="all">Todos</option>
                  {inscriptionOrderStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" size={16} />
              </label>
            </section>

            <section className="registration-admin-grid">
              <div className="registration-admin-table-card">
                <div className="registration-admin-table registration-admin-media-table" role="table" aria-label="Compras de foto y video">
                  <div className="registration-admin-table__head" role="row">
                    <span role="columnheader">Orden</span>
                    <span role="columnheader">Contacto</span>
                    <span role="columnheader">Participante</span>
                    <span role="columnheader">Academia</span>
                    <span role="columnheader">Paquete</span>
                    <span role="columnheader">Monto</span>
                    <span role="columnheader">Comprobante</span>
                    <span role="columnheader">Status</span>
                    <span role="columnheader">Fecha</span>
                    <span role="columnheader">Acción</span>
                  </div>

                  {visibleMediaOrders.map((order) => {
                    const date = getAdminOrderDate(order);

                    return (
                      <button
                        className={`registration-admin-table__row${selectedOrder?.id === order.id ? " is-selected" : ""}`}
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        role="row"
                        type="button"
                      >
                        <span role="cell">
                          {getRegistrationInscriptionPaymentReference(order)}
                          <small>Tienda</small>
                        </span>
                        <span role="cell">
                          {order.buyerPhone || "Sin WhatsApp"}
                          <small>{order.curp || "Sin CURP"}</small>
                        </span>
                        <span role="cell">{order.participantName}</span>
                        <span role="cell">{order.academyName}</span>
                        <span role="cell">
                          {getOrderMediaConcept(order)}
                          <small>{getOrderMediaItemCount(order)} paquete(s)</small>
                        </span>
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

                  {visibleMediaOrders.length === 0 ? (
                    <p className="registration-admin-empty">{isLoading ? "Cargando compras..." : "No hay compras de foto/video con esos filtros."}</p>
                  ) : null}
                </div>
                <footer className="registration-admin-table-footer">
                  <span>
                    Mostrando {visibleMediaOrders.length > 0 ? 1 : 0} a {visibleMediaOrders.length} de {filteredMediaOrders.length} compras
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
          </>
        ) : (
          <>
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
                <select onChange={(event) => setPurchaseTypeFilter(event.target.value)} value={purchaseTypeFilter}>
                  <option value="all">Todas</option>
                  <option value="registration">Inscripción</option>
                  <option value="shop">Tienda</option>
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
                        <span role="cell">
                          {getRegistrationInscriptionPaymentReference(order)}
                          <small>{getAdminOrderTypeLabel(order)}</small>
                        </span>
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
          </>
        )}
      </section>

      {selectedOrder ? (
        <div
          className="registration-admin-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de pago ${getRegistrationInscriptionPaymentReference(selectedOrder)}`}
        >
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
            orderType: getAdminOrderType(order),
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

      downloadBlob(pdf, `boletos-${getRegistrationInscriptionPaymentReference(order).toLowerCase()}.pdf`);
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
  const whatsappPhone = getRegistrationOrderWhatsAppPhone(order);
  const whatsappAction = getPaymentWhatsAppAction(order, rejectionMessage);
  const whatsappDisabledReason = whatsappPhone ? "Primero aprueba o rechaza el pago." : "Esta orden no tiene WhatsApp cargado.";

  return (
    <section className="registration-admin-detail" aria-label="Detalle de pago">
      <header>
        <div>
          <span>Orden</span>
          <h2>{getRegistrationInscriptionPaymentReference(order)}</h2>
          <p>{getAdminOrderTypeLabel(order)}</p>
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
              <img alt={`Comprobante ${getRegistrationInscriptionPaymentReference(order)}`} src={order.proof.dataUrl} />
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

      <section className="registration-admin-whatsapp-panel" aria-label="Mensaje de WhatsApp">
        <header>
          <div>
            <span>WhatsApp</span>
            <strong>{whatsappAction.title}</strong>
          </div>
          <MessageCircle aria-hidden="true" size={20} />
        </header>
        <textarea readOnly value={whatsappAction.message} aria-label="Mensaje preparado para WhatsApp" />
        {whatsappAction.href ? (
          <a href={whatsappAction.href} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden="true" size={17} />
            {whatsappAction.label}
          </a>
        ) : (
          <button disabled type="button">
            {whatsappDisabledReason}
          </button>
        )}
      </section>

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

function AdminLookupPanel({
  participants,
  choreographers,
  dances,
  inscriptionOrders,
}: {
  participants: RegistrationParticipant[];
  choreographers: RegistrationChoreographer[];
  dances: RegistrationDance[];
  inscriptionOrders: RegistrationInscriptionOrder[];
}) {
  const [activeLookupTab, setActiveLookupTab] = useState<AdminLookupTab>("participants");

  return (
    <section className="levitate-admin-panel levitate-admin-home__lookup levitate-admin-lookup-panel" aria-label="Consulta de registros">
      <div className="levitate-admin-panel__heading">
        <p>Consulta</p>
        <h2>Registros guardados</h2>
      </div>

      <div className="levitate-admin-lookup-tabs" role="tablist" aria-label="Tipo de registro">
        {adminLookupTabs.map((tab) => (
          <button
            aria-selected={activeLookupTab === tab.id}
            className={activeLookupTab === tab.id ? "is-active" : ""}
            key={tab.id}
            onClick={() => setActiveLookupTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeLookupTab === "participants" ? (
        <div className="levitate-admin-lookup-table-scroll">
          <div
            className="levitate-admin-lookup-table levitate-admin-lookup-table--participants"
            role="table"
            aria-label="Participantes registrados"
          >
            <span role="columnheader">Participante</span>
            <span role="columnheader">CURP / Documento</span>
            <span role="columnheader">División</span>
            <span role="columnheader">Edad</span>
            <span role="columnheader">Maestro Relevé</span>
            <span role="columnheader">Pago</span>
            {participants.map((participant) => {
              const isPaid = isParticipantInscriptionPaid(participant, inscriptionOrders);
              const divisionLabel = getProgramDivisionLabel(participant.division);
              const compactDivisionLabel = divisionLabel.split(":")[0];

              return (
                <div className="levitate-admin-lookup-table__row" role="row" key={participant.id}>
                  <span role="cell">{participant.fullName}</span>
                  <span className="levitate-admin-lookup-table__document" role="cell">
                    <strong>{participant.curp}</strong>
                    {participant.isInternational ? <small>Internacional</small> : null}
                  </span>
                  <span role="cell" title={divisionLabel}>
                    {compactDivisionLabel}
                  </span>
                  <span role="cell">{participant.age || "Sin edad"}</span>
                  <span role="cell">{participant.isReleveTeacher ? "Sí" : "No"}</span>
                  <span className={`levitate-admin-payment-badge${isPaid ? " is-paid" : ""}`} role="cell">
                    {isPaid ? "Pagado" : "Falta pagar"}
                  </span>
                </div>
              );
            })}
            {participants.length === 0 ? <p className="levitate-admin-empty-state">Todavía no hay participantes registrados.</p> : null}
          </div>
        </div>
      ) : null}

      {activeLookupTab === "choreographers" ? (
        <div className="levitate-admin-lookup-table-scroll">
          <div
            className="levitate-admin-lookup-table levitate-admin-lookup-table--choreographers"
            role="table"
            aria-label="Coreógrafos registrados"
          >
            <span role="columnheader">Coreógrafo</span>
            <span role="columnheader">Teléfono</span>
            <span role="columnheader">Talla</span>
            {choreographers.map((choreographer) => (
              <div className="levitate-admin-lookup-table__row" role="row" key={choreographer.id}>
                <span role="cell">{choreographer.fullName}</span>
                <span role="cell">{choreographer.phone || "Sin teléfono"}</span>
                <span role="cell">{getOptionLabel(shirtSizes, choreographer.shirtSize)}</span>
              </div>
            ))}
            {choreographers.length === 0 ? <p className="levitate-admin-empty-state">Todavía no hay coreógrafos registrados.</p> : null}
          </div>
        </div>
      ) : null}

      {activeLookupTab === "dances" ? (
        <div className="levitate-admin-lookup-table-scroll">
          <div className="levitate-admin-lookup-table levitate-admin-lookup-table--dances" role="table" aria-label="Coreografías registradas">
            <span role="columnheader">Coreografía</span>
            <span role="columnheader">Modalidad</span>
            <span role="columnheader">Categoría</span>
            <span role="columnheader">Nivel</span>
            <span role="columnheader">Participantes</span>
            {dances.map((dance) => {
              const categoryOptions = danceCategoriesByGenre[dance.genre] ?? danceCategories;
              const participantNames = dance.participants.map((participant) => participant.fullName).join(", ");

              return (
                <div className="levitate-admin-lookup-table__row" role="row" key={dance.id}>
                  <span role="cell">{dance.title}</span>
                  <span role="cell">{getOptionLabel(danceGenres, dance.genre)}</span>
                  <span role="cell">{getOptionLabel(categoryOptions, dance.category)}</span>
                  <span role="cell">{getDanceLevelLabel(dance.level)}</span>
                  <span role="cell">{participantNames || "Sin participantes"}</span>
                </div>
              );
            })}
            {dances.length === 0 ? <p className="levitate-admin-empty-state">Todavía no hay coreografías registradas.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AdminWelcomePanel({
  academyName,
  participants,
  choreographers,
  dances,
  inscriptionOrders,
}: {
  academyName: string;
  participants: RegistrationParticipant[];
  choreographers: RegistrationChoreographer[];
  dances: RegistrationDance[];
  inscriptionOrders: RegistrationInscriptionOrder[];
}) {
  return (
    <section className="levitate-admin-home">
      <div className="levitate-admin-home__intro">
        <h1>¡Hola, {academyName}!</h1>
      </div>

      <AdminLookupPanel choreographers={choreographers} dances={dances} inscriptionOrders={inscriptionOrders} participants={participants} />
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
    return (
      <ParticipantRegistrationPanel
        academyVenue={session.academy.venue}
        isAcademyInternational={session.academy.originType === "international"}
        onParticipantCreated={onParticipantCreated}
        registeredDanceCount={dances.length}
      />
    );
  }

  if (screen === "dance") {
    return (
      <DanceRegistrationPanel
        academyVenue={session.academy.venue}
        choreographers={choreographers}
        onDanceCreated={onDanceCreated}
        participants={participants}
      />
    );
  }

  if (screen === "music") {
    return <MusicUploadPanel academyName={session.academy.name} dances={dances} onDanceUpdated={onDanceCreated} />;
  }

  if (screen === "feedback") {
    return <FeedbackPanel dances={dances} />;
  }

  if (screen === "payments") {
    return <InscriptionOrdersPanel onOrderUpdated={onOrderUpdated} orders={inscriptionOrders} />;
  }

  return (
    <AdminWelcomePanel
      academyName={session.academy.name}
      choreographers={choreographers}
      dances={dances}
      inscriptionOrders={inscriptionOrders}
      participants={participants}
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
      <AdminSidebar activeScreen={activeScreen} onLogout={handleLogout} onScreenChange={handleScreenChange} />
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
        setLoadError(getErrorMessage(error, "No se pudo cargar tu portal de participante."));
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
      <ParticipantRegistrationPanel academyVenue="edomex" isAcademyInternational={false} onParticipantCreated={() => undefined} registeredDanceCount={0} />
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
        academyVenue="edomex"
        choreographers={[]}
        onDanceCreated={() => undefined}
        participants={[]}
      />
    </RegistrationPageScaffold>
  );
}

export function LevitateAdminHomeScreen() {
  return <LevitateRegistrationRoute />;
}
