import {
  ArrowLeft,
  ArrowUpRight,
  AtSign,
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarRange,
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
  FileSpreadsheet,
  Globe2,
  GraduationCap,
  Home,
  Info,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Music2,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  Shirt,
  Ticket,
  TriangleAlert,
  Upload,
  UserPlus,
  UserRoundPlus,
  Users,
  Wallet,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode } from "react";

type AdminScreenId = "home" | "choreographers" | "participants" | "dance" | "music" | "feedback" | "payments";
type AdminLookupTab = "participants" | "choreographers" | "dances";
type RegistrationAdminDashboardSection = "dashboard" | "academies" | "choreographers" | "payments" | "program" | "tickets" | "media" | "registrations";
type RegistrationDashboardDateRangeId = "today" | "last_7_days" | "last_30_days" | "current_event" | "custom" | "season";
type RegistrationDashboardVenueMetric = "participants" | "choreographies" | "confirmed_registrations" | "revenue" | "tickets";
type RegistrationDashboardAlertSeverity = "critical" | "important" | "info";
type RegistrationAcademyDirectoryStatus = "active" | "incomplete" | "inactive" | "archived";
type RegistrationAcademyDirectorySort = "recent" | "name" | "registrations" | "participants" | "pending" | "alerts";
type RegistrationAcademyProfileTab =
  | "overview"
  | "participants"
  | "choreographers"
  | "choreographies"
  | "payments"
  | "tickets"
  | "media"
  | "activity";
type AuthMode = "login" | "register" | "forgot" | "reset" | "verify";
type StatusTone = "success" | "error" | "warning";

const TICKET_BLOCK_MINIMUM = 3;

type AdminNavItem = {
  label: string;
  icon: LucideIcon;
  screen?: AdminScreenId;
  action?: "logout";
};

type RegistrationAdminDashboardNavItem = {
  badgeKey?: "media" | "payments" | "program" | "tickets";
  group: string;
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
  eventVenues: string[];
  academyContactName: string | null;
  academyEmail: string | null;
  academyPhone: string | null;
  academyOriginType?: "mexico" | "international";
  academyOriginState?: string | null;
  academyOriginCountry?: string | null;
};

type RegistrationAdminAcademy = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string | null;
  originType?: "mexico" | "international";
  originState?: string | null;
  originCountry?: string | null;
  eventVenues: string[];
  userName?: string | null;
  username?: string | null;
  userEmail?: string | null;
  userStatus?: string | null;
  participantCount: number;
  choreographerCount: number;
  danceCount: number;
  inscriptionOrderCount: number;
  shopOrderCount: number;
  musicUploadCount: number;
  createdAt: string;
  updatedAt: string;
};

type RegistrationChoreographer = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  shirtSize: string;
  createdAt: string;
};

type RegistrationAdminChoreographer = RegistrationChoreographer & {
  academyId: string;
  academyName: string;
};

type RegistrationDanceRelation = {
  age?: number | null;
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
  durationSeconds?: number | null;
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

export type RegistrationTicketPdfOrder = {
  academyName: string;
  participantName: string;
  paymentReference?: string;
  reference: string;
  tickets?: RegistrationEventTicket[];
};

type RegistrationInscriptionLineItem = {
  baseAmount?: number;
  count?: number;
  currency?: string;
  discountAmount?: number;
  discountRate?: number;
  id: string;
  isCourtesy?: boolean;
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
  pricingPosition?: number;
  pricingType?: string;
  type?: string;
  venue: string;
  visual?: string;
  academyName: string;
  amount: number;
};

type RegistrationInscriptionOrder = {
  orderType?: "registration" | "shop";
  id: string;
  accessToken?: string | null;
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
  status: RegistrationInscriptionOrderStatus;
  paymentMethod: string;
  lineItems?: RegistrationInscriptionLineItem[];
  buyerName?: string | null;
  buyerEmail?: string | null;
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
  academies?: RegistrationAdminAcademy[];
  choreographers?: RegistrationAdminChoreographer[];
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

type RegistrationDashboardTarget = {
  mediaStatusFilter?: string;
  orderId?: string;
  purchaseTypeFilter?: string;
  query?: string;
  registrationPaymentStatusFilter?: string;
  section: RegistrationAdminDashboardSection;
  statusFilter?: string;
  ticketStatusFilter?: string;
  venueFilter?: string;
};

type RegistrationDashboardDateWindow = {
  currentEventVenue?: string;
  end: Date | null;
  id: RegistrationDashboardDateRangeId;
  label: string;
  start: Date | null;
};

type RegistrationDashboardVenueSlice = {
  choreographies: number;
  confirmedRegistrations: number;
  label: string;
  participants: number;
  percent: number;
  revenue: number;
  tickets: number;
  value: number;
  venue: string;
};

type RegistrationDashboardActivityItem = {
  academyName: string;
  description: string;
  icon: LucideIcon;
  id: string;
  occurredAt: string;
  target: RegistrationDashboardTarget;
  title: string;
  tone: "pink" | "purple" | "green" | "cyan" | "amber";
};

type RegistrationDashboardAlert = {
  actionLabel: string;
  count: number;
  detail: string;
  id: string;
  reason: string;
  severity: RegistrationDashboardAlertSeverity;
  target: RegistrationDashboardTarget;
  title: string;
};

type RegistrationAcademyDirectorySummary = {
  academy: RegistrationAdminAcademy;
  alerts: string[];
  choreographies: RegistrationDance[];
  confirmedOrders: RegistrationInscriptionOrder[];
  confirmedRegistrationCount: number;
  initials: string;
  latestActivity: {
    date: string;
    description: string;
    title: string;
  };
  locationDetail: string;
  locationLabel: string;
  mediaOrders: RegistrationInscriptionOrder[];
  orders: RegistrationInscriptionOrder[];
  participants: RegistrationAdminParticipant[];
  pendingMediaCount: number;
  pendingOrderCount: number;
  pendingRegistrationCount: number;
  pendingTicketCount: number;
  registrationOrderCount: number;
  status: RegistrationAcademyDirectoryStatus;
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
  { label: "Pagos", icon: CreditCard, screen: "payments" },
  { label: "Salir", icon: LogOut, action: "logout" },
];

const adminLookupTabs: Array<{ id: AdminLookupTab; label: string }> = [
  { id: "participants", label: "Participantes" },
  { id: "choreographers", label: "Coreógrafos" },
  { id: "dances", label: "Coreografías" },
];

const registrationAdminDashboardNavItems: RegistrationAdminDashboardNavItem[] = [
  { group: "Gestión", label: "Panel general", icon: LayoutDashboard, section: "dashboard" },
  { group: "Gestión", label: "Academias", icon: Building2, section: "academies" },
  { group: "Gestión", label: "Participantes", icon: Users, section: "registrations" },
  { group: "Gestión", label: "Coreógrafos", icon: UserRoundPlus, section: "choreographers" },
  { group: "Ventas y pagos", label: "Pagos", icon: CreditCard, section: "payments", badgeKey: "payments" },
  { group: "Ventas y pagos", label: "Boletos", icon: Ticket, section: "tickets", badgeKey: "tickets" },
  { group: "Ventas y pagos", label: "Foto/Video", icon: Camera, section: "media", badgeKey: "media" },
  { group: "Operación de competencia", label: "Programa", icon: ClipboardList, section: "program", badgeKey: "program" },
  { group: "Operación de competencia", label: "Hojas de jueceo", icon: BadgeCheck },
  { group: "Análisis", label: "Reportes", icon: FileSpreadsheet },
];

const maxMusicUploadBytes = 12000000;
const musicDurationGraceSeconds = 10;
const paymentProofAccept = "image/jpeg,image/png,image/webp,application/pdf";
const allowedPaymentProofTypes = paymentProofAccept.split(",");
const maxPaymentProofBytes = 1800000;

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

const registrationDashboardDateRangeOptions: Array<{ label: string; value: RegistrationDashboardDateRangeId }> = [
  { value: "season", label: "Toda la temporada" },
  { value: "today", label: "Hoy" },
  { value: "last_7_days", label: "Últimos 7 días" },
  { value: "last_30_days", label: "Últimos 30 días" },
  { value: "current_event", label: "Evento actual" },
  { value: "custom", label: "Rango personalizado" },
];

const registrationDashboardVenueMetricOptions: Array<{ label: string; value: RegistrationDashboardVenueMetric }> = [
  { value: "participants", label: "Participantes" },
  { value: "choreographies", label: "Coreografías" },
  { value: "confirmed_registrations", label: "Inscripciones confirmadas" },
  { value: "revenue", label: "Ingresos" },
  { value: "tickets", label: "Boletos vendidos" },
];

const registrationDashboardEventStatusByVenue: Record<string, string> = {
  edomex: "Registro abierto",
  veracruz: "En preparación",
};

const registrationAcademyStatusOptions: FieldOption[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activas" },
  { value: "incomplete", label: "Incompletas" },
  { value: "inactive", label: "Inactivas" },
  { value: "archived", label: "Archivadas" },
  { value: "with_registrations", label: "Con inscripciones" },
  { value: "needs_attention", label: "Con alertas" },
];

const registrationAcademySortOptions: Array<{ label: string; value: RegistrationAcademyDirectorySort }> = [
  { value: "recent", label: "Más recientes" },
  { value: "name", label: "Nombre A-Z" },
  { value: "registrations", label: "Más inscripciones" },
  { value: "participants", label: "Más participantes" },
  { value: "pending", label: "Más pendientes" },
  { value: "alerts", label: "Más alertas" },
];

const registrationAcademyProfileTabs: Array<{ label: string; value: RegistrationAcademyProfileTab }> = [
  { value: "overview", label: "Resumen" },
  { value: "participants", label: "Participantes" },
  { value: "choreographers", label: "Coreógrafos" },
  { value: "choreographies", label: "Coreografías" },
  { value: "payments", label: "Pagos" },
  { value: "tickets", label: "Boletos" },
  { value: "media", label: "Foto/Video" },
  { value: "activity", label: "Actividad" },
];

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
const musicDurationLimitsByDivision: Record<string, { maximumSeconds: number; minimumSeconds: number }> = {
  baby: { minimumSeconds: 120, maximumSeconds: 180 },
  junior: { minimumSeconds: 150, maximumSeconds: 210 },
  legacy: { minimumSeconds: 150, maximumSeconds: 210 },
  petite: { minimumSeconds: 120, maximumSeconds: 180 },
  releve: { minimumSeconds: 150, maximumSeconds: 210 },
  senior: { minimumSeconds: 150, maximumSeconds: 210 },
  teen: { minimumSeconds: 150, maximumSeconds: 210 },
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

function getParticipantDivisionFallbackAge(participant: RegistrationDanceRelation) {
  const normalizedDivision = normalizeProgramDivision(participant.division);
  const divisionAgeFallbacks: Record<string, number> = {
    baby: 6,
    petite: 10,
    junior: 13,
    teen: 17,
    senior: 39,
    legacy: 40,
    releve: 100,
  };

  return divisionAgeFallbacks[normalizedDivision] ?? -1;
}

function compareParticipantsByProgramAge(left: RegistrationDanceRelation, right: RegistrationDanceRelation) {
  const leftAge = typeof left.age === "number" ? left.age : getParticipantDivisionFallbackAge(left);
  const rightAge = typeof right.age === "number" ? right.age : getParticipantDivisionFallbackAge(right);

  if (rightAge !== leftAge) {
    return rightAge - leftAge;
  }

  return getProgramDivisionRank(right.division) - getProgramDivisionRank(left.division);
}

function getGroupDanceProgramDivision(participants: RegistrationDanceRelation[]) {
  const divisionCounts = participants.reduce<Map<string, number>>((counts, participant) => {
    const division = normalizeProgramDivision(participant.division);

    if (!division) {
      return counts;
    }

    counts.set(division, (counts.get(division) ?? 0) + 1);
    return counts;
  }, new Map());
  const divisionsByPrevalence = Array.from(divisionCounts.keys()).sort((left, right) => {
    const countDiff = (divisionCounts.get(right) ?? 0) - (divisionCounts.get(left) ?? 0);

    if (countDiff !== 0) {
      return countDiff;
    }

    return getProgramDivisionRank(right) - getProgramDivisionRank(left);
  });
  const predominantDivision = divisionsByPrevalence[0] ?? "";
  const predominantRank = getProgramDivisionRank(predominantDivision);
  const higherDivisions = Array.from(divisionCounts.keys()).filter((division) => (
    getProgramDivisionRank(division) > predominantRank
  ));
  const higherParticipantCount = higherDivisions.reduce((total, division) => total + (divisionCounts.get(division) ?? 0), 0);

  if (!predominantDivision || higherParticipantCount <= 1) {
    return predominantDivision;
  }

  const repeatedHigherDivision = higherDivisions
    .filter((division) => (divisionCounts.get(division) ?? 0) >= 2)
    .sort((left, right) => getProgramDivisionRank(right) - getProgramDivisionRank(left))[0];

  if (repeatedHigherDivision) {
    return repeatedHigherDivision;
  }

  return programDivisionOrder[predominantRank + 1] ?? predominantDivision;
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
  const participantsWithDivision = dance.participants.filter((participant) => Boolean(participant.division));

  if (participantsWithDivision.length === 0) {
    return "";
  }

  const participantsByAge = [...participantsWithDivision].sort(compareParticipantsByProgramAge);
  const normalizedCategory = dance.category;

  if (normalizedCategory === "grupo") {
    return getGroupDanceProgramDivision(participantsByAge);
  }

  const selectedParticipant = participantsByAge[0];

  return selectedParticipant?.division ?? "";
}

function getMusicDurationLimitForDance(dance: RegistrationDance) {
  const division = normalizeProgramDivision(getDanceProgramDivision(dance));
  const limit = musicDurationLimitsByDivision[division];

  return limit ? { ...limit, division } : null;
}

function formatMusicDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getMusicDurationCheck(dance: RegistrationDance, durationSeconds: number) {
  const limit = getMusicDurationLimitForDance(dance);
  const checkedDurationSeconds = Math.max(0, Math.round(durationSeconds));
  const formattedDuration = formatMusicDuration(checkedDurationSeconds);

  if (!limit) {
    return {
      durationSeconds: checkedDurationSeconds,
      message: "No pudimos determinar la división de la coreografía para validar el tiempo del reglamento.",
      status: "blocked" as const,
    };
  }

  const allowedRange = `${formatMusicDuration(limit.minimumSeconds)} a ${formatMusicDuration(limit.maximumSeconds)}`;
  const overageSeconds = Math.max(0, checkedDurationSeconds - limit.maximumSeconds);

  if (overageSeconds >= musicDurationGraceSeconds + 1) {
    return {
      durationSeconds: checkedDurationSeconds,
      message: `La duración detectada es ${formattedDuration}. No es posible recibir el archivo porque excede por ${overageSeconds} segundos el tiempo permitido (${allowedRange}).`,
      status: "blocked" as const,
    };
  }

  if (overageSeconds > 0) {
    return {
      durationSeconds: checkedDurationSeconds,
      message: `La duración detectada es ${formattedDuration}. La duración excede los tiempos estipulados en el reglamento (${allowedRange}).`,
      status: "warning" as const,
    };
  }

  return {
    durationSeconds: checkedDurationSeconds,
    message: `Duración detectada: ${formattedDuration}. Tiempo reglamentario: ${allowedRange}.`,
    status: "valid" as const,
  };
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

const adminCurrencyFormatters = new Map<string, Intl.NumberFormat>();

function getAdminCurrencyFormatter(currency = "MXN") {
  const normalizedCurrency = currency.toUpperCase();
  const existingFormatter = adminCurrencyFormatters.get(normalizedCurrency);

  if (existingFormatter) {
    return existingFormatter;
  }

  const formatter = new Intl.NumberFormat(normalizedCurrency === "USD" ? "en-US" : "es-MX", {
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
    style: "currency",
  });

  adminCurrencyFormatters.set(normalizedCurrency, formatter);
  return formatter;
}

function formatAdminCurrency(amount: number, currency = "MXN") {
  return getAdminCurrencyFormatter(currency).format(amount);
}

function getRegistrationOrderCurrency(order: Pick<RegistrationInscriptionOrder, "currency" | "lineItems">) {
  return order.currency || order.lineItems?.find((lineItem) => lineItem.currency)?.currency || "MXN";
}

function getRegistrationLineTitle(lineItem: RegistrationInscriptionLineItem) {
  return lineItem.title || lineItem.productName || lineItem.name || getOptionLabel(danceSubgenresByGenre[lineItem.genre] ?? [], lineItem.subgenre) || "Inscripción";
}

function getRegistrationLineMeta(lineItem: RegistrationInscriptionLineItem) {
  const categoryOptions = danceCategoriesByGenre[lineItem.genre] ?? danceCategories;
  const parts = [
    getOptionLabel(danceGenres, lineItem.genre),
    getOptionLabel(danceSubgenresByGenre[lineItem.genre] ?? [], lineItem.subgenre),
    getOptionLabel(categoryOptions, lineItem.category),
  ].filter(Boolean);

  if (lineItem.level) {
    parts.push(getDanceLevelLabel(lineItem.level));
  }

  return parts.join(" · ");
}

function canSubmitRegistrationOrderProof(order: RegistrationInscriptionOrder) {
  return getAdminOrderType(order) === "registration" && order.amount > 0 && (!order.proof || order.status === "rejected");
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

function getAdminDateLabel(rawDate?: string | null) {
  if (!rawDate) {
    return "Sin fecha";
  }

  const date = new Date(rawDate);

  if (Number.isNaN(date.getTime())) {
    return rawDate;
  }

  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getAdminAcademyMovementCount(academy: RegistrationAdminAcademy) {
  return (
    academy.participantCount +
    academy.choreographerCount +
    academy.danceCount +
    academy.inscriptionOrderCount +
    academy.shopOrderCount +
    academy.musicUploadCount
  );
}

function normalizeDirectoryText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getRegistrationAcademyInitials(name: string) {
  const words = name
    .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "AC";
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function doesOrderBelongToAcademy(order: RegistrationInscriptionOrder, academy: RegistrationAdminAcademy) {
  return order.academyId === academy.id || normalizeDirectoryText(order.academyName) === normalizeDirectoryText(academy.name);
}

function doesParticipantBelongToAcademy(participant: RegistrationAdminParticipant, academy: RegistrationAdminAcademy) {
  return participant.academyId === academy.id || normalizeDirectoryText(participant.academyName) === normalizeDirectoryText(academy.name);
}

function doesDanceBelongToAcademy(dance: RegistrationDance, academy: RegistrationAdminAcademy) {
  return normalizeDirectoryText(dance.academyName) === normalizeDirectoryText(academy.name);
}

function getRegistrationAcademyLocation(academy: RegistrationAdminAcademy) {
  const origin = getAcademyOriginLabel(academy);
  const venues = academy.eventVenues.map(getVenueLabel);

  return {
    detail: venues.length > 0 ? venues.join(" / ") : "Sin sede asignada",
    label: origin,
  };
}

function getRegistrationAcademyStatusLabel(status: RegistrationAcademyDirectoryStatus) {
  const labels: Record<RegistrationAcademyDirectoryStatus, string> = {
    active: "Activa",
    archived: "Archivada",
    inactive: "Inactiva",
    incomplete: "Incompleta",
  };

  return labels[status];
}

function getRegistrationAcademyStatusClass(status: RegistrationAcademyDirectoryStatus) {
  return `registration-academies-status registration-academies-status--${status}`;
}

function getRegistrationAcademyLatestActivity({
  academy,
  choreographies,
  orders,
  participants,
}: {
  academy: RegistrationAdminAcademy;
  choreographies: RegistrationDance[];
  orders: RegistrationInscriptionOrder[];
  participants: RegistrationAdminParticipant[];
}) {
  const activities: Array<{ date: string; description: string; title: string }> = [
    {
      date: academy.updatedAt || academy.createdAt,
      description: "Ficha de academia",
      title: "Registro actualizado",
    },
    {
      date: academy.createdAt,
      description: "Alta de academia",
      title: "Registro creado",
    },
  ];

  for (const participant of participants) {
    activities.push({
      date: participant.createdAt,
      description: participant.fullName,
      title: "Participante agregado",
    });
  }

  for (const dance of choreographies) {
    activities.push({
      date: dance.createdAt,
      description: dance.title,
      title: "Coreografía registrada",
    });

    if (dance.musicUpload) {
      activities.push({
        date: dance.musicUpload.uploadedAt,
        description: dance.title,
        title: "Música cargada",
      });
    }
  }

  for (const order of orders) {
    const reference = getRegistrationInscriptionPaymentReference(order);
    const isMediaOrder = getOrderMediaItemCount(order) > 0;
    const isTicketOrder = getOrderRequestedTicketCount(order) > 0;
    const orderType = isMediaOrder ? "Foto/Video" : isTicketOrder ? "Boletos" : "Inscripción";

    if (order.status === "paid") {
      activities.push({
        date: order.reviewedAt || order.paidAt || order.updatedAt,
        description: `${orderType} · ${reference}`,
        title: "Pago confirmado",
      });
    } else if (order.status === "payment_reported") {
      activities.push({
        date: order.proof?.uploadedAt || order.updatedAt,
        description: `${orderType} · ${reference}`,
        title: "Comprobante por revisar",
      });
    } else if (order.status === "rejected") {
      activities.push({
        date: order.reviewedAt || order.updatedAt,
        description: `${orderType} · ${reference}`,
        title: "Pago rechazado",
      });
    } else {
      activities.push({
        date: order.createdAt,
        description: `${orderType} · ${reference}`,
        title: "Orden creada",
      });
    }
  }

  return activities
    .filter((activity) => Number.isFinite(Date.parse(activity.date)))
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))[0] ?? {
    date: academy.createdAt,
    description: "Sin actividad reciente",
    title: "Registro creado",
  };
}

function getRegistrationAcademyAlerts({
  academy,
  choreographies,
  orders,
  participants,
}: {
  academy: RegistrationAdminAcademy;
  choreographies: RegistrationDance[];
  orders: RegistrationInscriptionOrder[];
  participants: RegistrationAdminParticipant[];
}) {
  const alerts: string[] = [];
  const pendingReviewCount = orders.filter((order) => order.status === "payment_reported").length;
  const pendingPaymentCount = orders.filter((order) => order.status === "pending_payment").length;
  const rejectedPaymentCount = orders.filter((order) => order.status === "rejected").length;
  const pendingTicketCount = orders.filter((order) => getOrderRequestedTicketCount(order) > 0 && order.status !== "paid").length;
  const pendingMediaCount = orders.filter((order) => getOrderMediaItemCount(order) > 0 && order.status !== "paid").length;
  const incompleteParticipantCount = participants.filter((participant) => !participant.birthDate || participant.age == null || !participant.shirtSize).length;
  const missingMusicCount = choreographies.filter((dance) => !dance.musicUpload).length;

  if (!academy.contactName || !academy.email || !academy.phone) {
    alerts.push("Contacto incompleto");
  }

  if (academy.eventVenues.length === 0) {
    alerts.push("Sin sede asignada");
  }

  if (academy.participantCount === 0) {
    alerts.push("Sin participantes");
  }

  if (academy.danceCount === 0) {
    alerts.push("Sin coreografías");
  }

  if (pendingReviewCount > 0) {
    alerts.push(`${pendingReviewCount} comprobante(s) por revisar`);
  }

  if (pendingPaymentCount > 0) {
    alerts.push(`${pendingPaymentCount} pago(s) pendiente(s)`);
  }

  if (rejectedPaymentCount > 0) {
    alerts.push(`${rejectedPaymentCount} pago(s) rechazado(s)`);
  }

  if (pendingTicketCount > 0) {
    alerts.push(`${pendingTicketCount} orden(es) de boletos pendientes`);
  }

  if (pendingMediaCount > 0) {
    alerts.push(`${pendingMediaCount} paquete(s) Foto/Video pendientes`);
  }

  if (incompleteParticipantCount > 0) {
    alerts.push(`${incompleteParticipantCount} participante(s) incompletos`);
  }

  if (missingMusicCount > 0) {
    alerts.push(`${missingMusicCount} música(s) pendientes`);
  }

  return alerts;
}

function getRegistrationAcademyDirectoryStatus({
  academy,
  alerts,
}: {
  academy: RegistrationAdminAcademy;
  alerts: string[];
}): RegistrationAcademyDirectoryStatus {
  const userStatus = normalizeDirectoryText(academy.userStatus);

  if (userStatus.includes("archiv")) {
    return "archived";
  }

  if (userStatus.includes("inactive") || userStatus.includes("inactiv") || userStatus.includes("disabled") || userStatus.includes("suspend")) {
    return "inactive";
  }

  if (alerts.some((alert) => ["Contacto incompleto", "Sin sede asignada", "Sin participantes", "Sin coreografías"].includes(alert))) {
    return "incomplete";
  }

  if (getAdminAcademyMovementCount(academy) === 0) {
    return "inactive";
  }

  return "active";
}

function buildRegistrationAcademyDirectorySummary({
  academy,
  orders,
  participants,
  programDances,
}: {
  academy: RegistrationAdminAcademy;
  orders: RegistrationInscriptionOrder[];
  participants: RegistrationAdminParticipant[];
  programDances: RegistrationDance[];
}): RegistrationAcademyDirectorySummary {
  const academyOrders = orders.filter((order) => doesOrderBelongToAcademy(order, academy));
  const academyParticipants = participants.filter((participant) => doesParticipantBelongToAcademy(participant, academy));
  const academyDances = programDances.filter((dance) => doesDanceBelongToAcademy(dance, academy));
  const location = getRegistrationAcademyLocation(academy);
  const registrationOrders = academyOrders.filter((order) => getAdminOrderType(order) === "registration");
  const mediaOrders = academyOrders.filter((order) => getOrderMediaItemCount(order) > 0);
  const alerts = getRegistrationAcademyAlerts({
    academy,
    choreographies: academyDances,
    orders: academyOrders,
    participants: academyParticipants,
  });

  return {
    academy,
    alerts,
    choreographies: academyDances,
    confirmedOrders: academyOrders.filter((order) => order.status === "paid"),
    confirmedRegistrationCount: registrationOrders.filter((order) => order.status === "paid").length,
    initials: getRegistrationAcademyInitials(academy.name),
    latestActivity: getRegistrationAcademyLatestActivity({
      academy,
      choreographies: academyDances,
      orders: academyOrders,
      participants: academyParticipants,
    }),
    locationDetail: location.detail,
    locationLabel: location.label,
    mediaOrders,
    orders: academyOrders,
    participants: academyParticipants,
    pendingMediaCount: mediaOrders.filter((order) => order.status === "pending_payment" || order.status === "payment_reported").length,
    pendingOrderCount: academyOrders.filter((order) => order.status === "pending_payment" || order.status === "payment_reported" || order.status === "rejected").length,
    pendingRegistrationCount: registrationOrders.filter((order) => order.status === "pending_payment" || order.status === "payment_reported").length,
    pendingTicketCount: academyOrders.filter((order) => getOrderRequestedTicketCount(order) > 0 && order.status !== "paid").length,
    registrationOrderCount: registrationOrders.length,
    status: getRegistrationAcademyDirectoryStatus({ academy, alerts }),
  };
}

function downloadRegistrationAcademiesDirectoryCsv(summaries: RegistrationAcademyDirectorySummary[]) {
  const headers = [
    "Academia",
    "Contacto",
    "Correo",
    "Teléfono",
    "Ubicación",
    "Sedes",
    "Estado",
    "Inscripciones",
    "Confirmadas",
    "Pendientes",
    "Participantes",
    "Coreógrafos",
    "Coreografías",
    "Órdenes tienda",
    "Última actividad",
    "Alertas",
  ];
  const rows = summaries.map((summary) => [
    summary.academy.name,
    summary.academy.contactName,
    summary.academy.email,
    summary.academy.phone ?? "",
    summary.locationLabel,
    summary.locationDetail,
    getRegistrationAcademyStatusLabel(summary.status),
    summary.registrationOrderCount,
    summary.confirmedRegistrationCount,
    summary.pendingRegistrationCount,
    summary.academy.participantCount,
    summary.academy.choreographerCount,
    summary.academy.danceCount,
    summary.academy.shopOrderCount,
    `${summary.latestActivity.title} · ${getAdminDateLabel(summary.latestActivity.date)}`,
    summary.alerts.join(" | "),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(toRegistrationCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "levitate-academias-directorio.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function getAdminParticipantGroups(participants: RegistrationAdminParticipant[]) {
  const groupMap = new Map<string, RegistrationAdminParticipant[]>();

  for (const participant of participants) {
    const key = participant.academyId || participant.academyName;
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
      venues: Array.from(new Set(groupParticipants.flatMap((participant) => participant.eventVenues))),
    }))
    .sort((left, right) => left.academyName.localeCompare(right.academyName, "es"));
}

function getAdminParticipantTotals(participants: RegistrationAdminParticipant[], orders: RegistrationInscriptionOrder[], academyCount?: number) {
  const groups = getAdminParticipantGroups(participants);
  const visibleAcademyCount = academyCount ?? groups.length;

  return participants.reduce(
    (totals, participant) => {
      const status = getParticipantPaymentStatus(participant, orders);

      return {
        academies: visibleAcademyCount,
        paid: totals.paid + (status === "paid" ? 1 : 0),
        participants: totals.participants + 1,
        pending: totals.pending + (status === "payment_reported" || status === "pending_payment" ? 1 : 0),
        releveTeachers: totals.releveTeachers + (participant.isReleveTeacher ? 1 : 0),
        withoutOrder: totals.withoutOrder + (status === "no_order" ? 1 : 0),
      };
    },
    {
      academies: visibleAcademyCount,
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

function readMusicDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(objectUrl);
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      cleanup();

      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("No pudimos verificar la duración del archivo."));
        return;
      }

      resolve(duration);
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("No pudimos verificar la duración del archivo."));
    };
    audio.src = objectUrl;
  });
}

function readPaymentProofFileAsDataUrl(file: File) {
  return new Promise<{ contentType: string; dataUrl: string; fileName: string; fileSize: number }>((resolve, reject) => {
    if (file.size > maxPaymentProofBytes) {
      reject(new Error("El comprobante debe pesar menos de 1.8 MB."));
      return;
    }

    if (!allowedPaymentProofTypes.includes(file.type)) {
      reject(new Error("Solo se aceptan JPG, PNG, WEBP o PDF."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("No pudimos leer el comprobante."));
    reader.onload = () =>
      resolve({
        contentType: file.type,
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

function getRegistrationInscriptionPaymentReference(
  order: Pick<RegistrationInscriptionOrder, "curp" | "lineItems" | "orderType" | "paymentReference" | "reference">,
) {
  if (order.paymentReference) {
    return order.paymentReference;
  }

  if (getAdminOrderType(order) === "shop") {
    return getAdminShopPaymentReference(order);
  }

  const curpCode = getAdminPaymentCurpCode(order.curp);

  return curpCode ? `INS-${curpCode}` : order.reference;
}

function getAdminPaymentCurpCode(curp: string) {
  const normalizedCurp = String(curp || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  return `${normalizedCurp.slice(0, 4)}${normalizedCurp.slice(-4)}`.replace(/[^A-Z0-9]/g, "");
}

function getAdminShopPaymentReference(order: Pick<RegistrationInscriptionOrder, "curp" | "lineItems" | "reference">) {
  const prefix = getAdminShopPaymentReferencePrefix(order.lineItems ?? []);
  const normalizedReference = order.reference.toUpperCase();
  const compactMatch = normalizedReference.match(/^(?:FV|BOL|SHOP)-([A-Z0-9]{4,16})$/);

  if (compactMatch) {
    return `${prefix}-${compactMatch[1].slice(0, 8)}`;
  }

  const referenceParts = normalizedReference
    .split("-")
    .map((part) => part.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);
  const trailingCode = referenceParts[referenceParts.length - 1]?.slice(-4) || normalizedReference.replace(/[^A-Z0-9]/g, "").slice(-4);
  const curpPrefix = String(order.curp || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4) || "PAGO";

  return `${prefix}-${curpPrefix}${trailingCode || "0000"}`;
}

function getAdminShopPaymentReferencePrefix(lineItems: RegistrationInscriptionLineItem[]) {
  const hasMedia = lineItems.some((lineItem) => (
    lineItem.itemType === "media" ||
    lineItem.productCategory?.toLowerCase().includes("fotograf") ||
    lineItem.productId?.startsWith("photo-")
  ));
  const hasTickets = lineItems.some((lineItem) => (
    lineItem.itemType === "ticket" ||
    lineItem.productCategory?.toLowerCase().includes("boleto") ||
    lineItem.productId?.startsWith("ticket-")
  ));

  if (hasMedia && !hasTickets) {
    return "FV";
  }

  if (hasTickets && !hasMedia) {
    return "BOL";
  }

  return "SHOP";
}

function buildPaymentRejectionMessage(order: RegistrationInscriptionOrder, reason: RegistrationPaymentRejectionReason) {
  const amount = formatAdminCurrency(order.amount, getRegistrationOrderCurrency(order));

  const messages: Record<RegistrationPaymentRejectionReason, string> = {
    incomplete_amount: `El monto recibido no cubre el total de la orden. El importe correcto es ${amount}. Por favor completa la diferencia o compártenos la aclaración correspondiente para continuar con la validación.`,
    invalid_or_unreadable_proof:
      "El comprobante recibido no es legible o no corresponde a esta orden. Por favor envíanos un comprobante claro y relacionado con esta referencia para poder revisarlo nuevamente.",
    missing_proof:
      "No tenemos comprobante cargado para esta orden. Por favor sube o envía el comprobante correspondiente para que podamos validar el pago.",
    payment_not_found:
      "No encontramos una transferencia asociada a esta referencia. Por favor verifica los datos de transferencia y compártenos el comprobante correcto o la aclaración correspondiente.",
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

function getRegistrationOrderBuyerLabel(order: RegistrationInscriptionOrder) {
  return order.buyerName || order.buyerPhone || order.participantName;
}

function getRegistrationOrderBuyerMeta(order: RegistrationInscriptionOrder) {
  const details = [order.buyerEmail, order.buyerPhone].filter(Boolean);
  return details.length ? details.join(" · ") : order.curp;
}

function buildWhatsAppUrl(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildInscriptionProofCorrectionUrl(order: RegistrationInscriptionOrder) {
  if (typeof window === "undefined" || getAdminOrderType(order) !== "registration") {
    return "";
  }

  const url = new URL("/inscripciones/consulta-curp", window.location.origin);
  url.searchParams.set("curp", order.curp);
  url.searchParams.set("orderId", order.id);
  url.searchParams.set("upload", "proof");

  return url.toString();
}

function buildShopTicketDeliveryUrl(order: RegistrationInscriptionOrder) {
  if (typeof window === "undefined" || getAdminOrderType(order) !== "shop" || !order.accessToken || !order.tickets?.length) {
    return "";
  }

  const url = new URL("/taquilla", window.location.origin);
  url.searchParams.set("accessKey", order.accessToken);
  url.searchParams.set("orderId", order.id);
  url.searchParams.set("tickets", "1");

  return url.toString();
}

function buildPaymentApprovalWhatsAppMessage(order: RegistrationInscriptionOrder) {
  const amount = formatAdminCurrency(order.paidAmount || order.amount, getRegistrationOrderCurrency(order));
  const paymentReference = getRegistrationInscriptionPaymentReference(order);
  const ticketCount = order.tickets?.length ?? 0;
  const isShopOrder = getAdminOrderType(order) === "shop";
  const ticketDeliveryUrl = buildShopTicketDeliveryUrl(order);
  const ticketLines =
    ticketCount > 0
      ? [
          `Tus ${ticketCount === 1 ? "boleto ya fue generado" : `${ticketCount} boletos ya fueron generados`}.`,
          ...(ticketDeliveryUrl ? ["", "Puedes ver y descargar tus accesos con QR aquí:", ticketDeliveryUrl] : []),
        ]
      : isShopOrder
        ? ["Tu compra quedó confirmada correctamente."]
        : ["Tu inscripción quedó confirmada correctamente."];

  return [
    "Hola, te escribe el equipo de administración de Levitate MX.",
    "",
    `Te contactamos con relación al pago ${isShopOrder ? "de tienda" : "de inscripción"} de ${order.participantName}. Confirmamos que fue aprobado correctamente.`,
    "",
    `Orden: ${paymentReference}`,
    `Monto confirmado: ${amount}`,
    `Academia: ${order.academyName}`,
    "",
    ...ticketLines,
    "",
    "Gracias por formar parte de Levitate MX.",
  ].join("\n");
}

function buildPaymentCorrectionWhatsAppMessage(order: RegistrationInscriptionOrder, correctionMessage: string) {
  const isShopOrder = getAdminOrderType(order) === "shop";
  const paymentReference = getRegistrationInscriptionPaymentReference(order);
  const message =
    (order.rejectionMessage || correctionMessage || buildPaymentRejectionMessage(order, order.rejectionReason ?? getDefaultPaymentRejectionReason(order))).trim();
  const correctionUrl = isShopOrder && order.accessToken
    ? (() => {
        const url = new URL("/taquilla", window.location.origin);
        url.searchParams.set("accessKey", order.accessToken);
        url.searchParams.set("orderId", order.id);
        url.searchParams.set("upload", "proof");
        return url.toString();
      })()
    : buildInscriptionProofCorrectionUrl(order);
  const correctionLinkLines = correctionUrl
    ? ["", "Puedes subir nuevamente el comprobante en esta liga:", correctionUrl]
    : [];

  return [
    "Hola, te escribe el equipo de administración de Levitate MX.",
    "",
    `Te contactamos con relación al pago ${isShopOrder ? "de tienda" : "de inscripción"} de ${order.participantName}. Por el momento no pudimos aprobarlo por el siguiente motivo:`,
    "",
    message,
    "",
    `Orden: ${paymentReference}`,
    `Monto esperado: ${formatAdminCurrency(order.amount, getRegistrationOrderCurrency(order))}`,
    `Concepto para transferencia: ${paymentReference}`,
    ...correctionLinkLines,
    "",
    "Por favor revisa la información y, cuando tengas la corrección, responde a este chat para que podamos validar nuevamente tu caso.",
  ].join("\n");
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
        latestReference: getRegistrationInscriptionPaymentReference(order),
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
      existingRow.latestReference = getRegistrationInscriptionPaymentReference(order);
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
      blockReadyChildren: totals.blockReadyChildren + (isTicketBlockReady(row) ? 1 : 0),
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
      blockReadyChildren: 0,
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

function isTicketBlockReady(row: TicketDashboardRow) {
  return row.paidTickets >= TICKET_BLOCK_MINIMUM;
}

function getTicketBlockMissingCount(row: TicketDashboardRow) {
  return Math.max(0, TICKET_BLOCK_MINIMUM - row.paidTickets);
}

function getDashboardStartOfDay(date: Date) {
  const nextDate = new Date(date);

  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getDashboardEndOfDay(date: Date) {
  const nextDate = new Date(date);

  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function addDashboardDays(date: Date, days: number) {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function parseDashboardInputDate(value: string, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return endOfDay ? getDashboardEndOfDay(date) : getDashboardStartOfDay(date);
}

function getDashboardDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDashboardCurrentEventVenue(now = new Date()) {
  const eventEntries = Object.entries(venueEventDates)
    .map(([venue, rawDate]) => ({ date: parseDashboardInputDate(rawDate), venue }))
    .filter((entry): entry is { date: Date; venue: string } => Boolean(entry.date))
    .sort((left, right) => left.date.getTime() - right.date.getTime());
  const today = getDashboardStartOfDay(now);
  const upcomingEvent = eventEntries.find((entry) => entry.date.getTime() >= today.getTime());

  return upcomingEvent?.venue ?? eventEntries[eventEntries.length - 1]?.venue ?? venueOptions[0]?.value;
}

function formatDashboardDateLabel(date: Date) {
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function getDashboardDateWindow(
  rangeId: RegistrationDashboardDateRangeId,
  customStart: string,
  customEnd: string,
): RegistrationDashboardDateWindow {
  const today = new Date();

  if (rangeId === "today") {
    return {
      end: getDashboardEndOfDay(today),
      id: rangeId,
      label: "Hoy",
      start: getDashboardStartOfDay(today),
    };
  }

  if (rangeId === "last_7_days" || rangeId === "last_30_days") {
    const days = rangeId === "last_7_days" ? 7 : 30;
    const start = getDashboardStartOfDay(addDashboardDays(today, -(days - 1)));
    const end = getDashboardEndOfDay(today);

    return {
      end,
      id: rangeId,
      label: `${formatDashboardDateLabel(start)} - ${formatDashboardDateLabel(end)}`,
      start,
    };
  }

  if (rangeId === "current_event") {
    const currentEventVenue = getDashboardCurrentEventVenue(today);

    return {
      currentEventVenue,
      end: null,
      id: rangeId,
      label: `Evento actual: ${getVenueLabel(currentEventVenue)}`,
      start: null,
    };
  }

  if (rangeId === "custom") {
    const start = parseDashboardInputDate(customStart);
    const end = parseDashboardInputDate(customEnd, true);

    return {
      end,
      id: rangeId,
      label: start && end ? `${formatDashboardDateLabel(start)} - ${formatDashboardDateLabel(end)}` : "Rango personalizado",
      start,
    };
  }

  return {
    end: null,
    id: "season",
    label: "Toda la temporada",
    start: null,
  };
}

function getPreviousDashboardDateWindow(window: RegistrationDashboardDateWindow): RegistrationDashboardDateWindow | null {
  if (!window.start || !window.end) {
    return null;
  }

  const duration = window.end.getTime() - window.start.getTime() + 1;
  const previousEnd = new Date(window.start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration + 1);

  return {
    end: previousEnd,
    id: window.id,
    label: "Periodo anterior",
    start: previousStart,
  };
}

function isDateInDashboardWindow(rawDate: string | null | undefined, window: RegistrationDashboardDateWindow | null) {
  if (!window?.start && !window?.end) {
    return true;
  }

  if (!rawDate) {
    return false;
  }

  const time = Date.parse(rawDate);

  if (!Number.isFinite(time)) {
    return false;
  }

  return (!window.start || time >= window.start.getTime()) && (!window.end || time <= window.end.getTime());
}

function getDashboardEffectiveVenueFilter(window: RegistrationDashboardDateWindow, venueFilter: string) {
  return venueFilter !== "all" ? venueFilter : window.currentEventVenue ?? "all";
}

function doesDashboardOrderMatchVenue(order: RegistrationInscriptionOrder, venueFilter: string) {
  return venueFilter === "all" || order.venue === venueFilter;
}

function doesDashboardParticipantMatchVenue(participant: RegistrationAdminParticipant, venueFilter: string) {
  return venueFilter === "all" || participant.eventVenues.includes(venueFilter);
}

function doesDashboardDanceMatchVenue(dance: RegistrationDance, venueFilter: string) {
  return venueFilter === "all" || dance.venue === venueFilter;
}

function getDashboardOrderRangeDate(order: RegistrationInscriptionOrder) {
  if (order.status === "paid") {
    return order.paidAt || order.reviewedAt || order.updatedAt || order.createdAt;
  }

  if (order.status === "rejected") {
    return order.reviewedAt || order.updatedAt || order.createdAt;
  }

  if (order.status === "payment_reported") {
    return order.proof?.uploadedAt || order.updatedAt || order.createdAt;
  }

  return order.createdAt || order.updatedAt;
}

function getDashboardScopedOrders(
  orders: RegistrationInscriptionOrder[],
  window: RegistrationDashboardDateWindow,
  venueFilter: string,
) {
  const effectiveVenueFilter = getDashboardEffectiveVenueFilter(window, venueFilter);

  return orders.filter((order) => isDateInDashboardWindow(getDashboardOrderRangeDate(order), window) && doesDashboardOrderMatchVenue(order, effectiveVenueFilter));
}

function getDashboardScopedParticipants(
  participants: RegistrationAdminParticipant[],
  window: RegistrationDashboardDateWindow,
  venueFilter: string,
) {
  const effectiveVenueFilter = getDashboardEffectiveVenueFilter(window, venueFilter);

  return participants.filter((participant) => isDateInDashboardWindow(participant.createdAt, window) && doesDashboardParticipantMatchVenue(participant, effectiveVenueFilter));
}

function getDashboardScopedDances(dances: RegistrationDance[], window: RegistrationDashboardDateWindow, venueFilter: string) {
  const effectiveVenueFilter = getDashboardEffectiveVenueFilter(window, venueFilter);

  return dances.filter((dance) => isDateInDashboardWindow(dance.createdAt, window) && doesDashboardDanceMatchVenue(dance, effectiveVenueFilter));
}

function getDashboardUniqueParticipantCount(participants: RegistrationAdminParticipant[]) {
  const participantKeys = new Set<string>();

  for (const participant of participants) {
    participantKeys.add(normalizeCurpInput(participant.curp) || participant.id);
  }

  return participantKeys.size;
}

function getDashboardAcademyKeys(participants: RegistrationAdminParticipant[], orders: RegistrationInscriptionOrder[]) {
  const academyKeys = new Set<string>();

  for (const participant of participants) {
    academyKeys.add(participant.academyId || participant.academyName);
  }

  for (const order of orders) {
    academyKeys.add(order.academyId || order.academyName);
  }

  academyKeys.delete("");
  return academyKeys;
}

function getDashboardParticipantPaymentCounts(participants: RegistrationAdminParticipant[], orders: RegistrationInscriptionOrder[]) {
  return participants.reduce(
    (counts, participant) => {
      const status = getParticipantPaymentStatus(participant, orders);

      return {
        incomplete: counts.incomplete + (!participant.birthDate || participant.age == null || !participant.shirtSize ? 1 : 0),
        paid: counts.paid + (status === "paid" ? 1 : 0),
        pending: counts.pending + (status === "pending_payment" || status === "payment_reported" ? 1 : 0),
        withoutConfirmedOrder: counts.withoutConfirmedOrder + (status !== "paid" ? 1 : 0),
        withoutOrder: counts.withoutOrder + (status === "no_order" ? 1 : 0),
      };
    },
    {
      incomplete: 0,
      paid: 0,
      pending: 0,
      withoutConfirmedOrder: 0,
      withoutOrder: 0,
    },
  );
}

function getDashboardPaidRevenue(orders: RegistrationInscriptionOrder[]) {
  return orders.reduce((total, order) => total + (order.status === "paid" ? order.paidAmount || order.amount : 0), 0);
}

function getDashboardPendingVerificationRevenue(orders: RegistrationInscriptionOrder[]) {
  return orders.reduce((total, order) => total + (order.status === "payment_reported" ? order.paidAmount || order.amount : 0), 0);
}

function getDashboardTrendLabel(currentValue: number, previousValue: number, formatter: (value: number) => string = String) {
  const diff = currentValue - previousValue;

  if (diff === 0) {
    return "Sin cambio vs. periodo anterior";
  }

  return `${diff > 0 ? "+" : ""}${formatter(diff)} vs. periodo anterior`;
}

function getDashboardPercentTrendLabel(currentValue: number, previousValue: number) {
  if (previousValue <= 0) {
    return currentValue > 0 ? "Nuevo en el periodo" : "Sin cambio vs. periodo anterior";
  }

  const percent = Math.round(((currentValue - previousValue) / previousValue) * 100);

  if (percent === 0) {
    return "Sin cambio vs. periodo anterior";
  }

  return `${percent > 0 ? "+" : ""}${percent}% vs. periodo anterior`;
}

function getDashboardRevenueBreakdown(orders: RegistrationInscriptionOrder[]) {
  return orders.reduce(
    (breakdown, order) => {
      if (order.status !== "paid") {
        return breakdown;
      }

      const amount = order.paidAmount || order.amount;
      const hasTickets = getOrderRequestedTicketCount(order) > 0;
      const hasMedia = getOrderMediaItemCount(order) > 0;

      if (getAdminOrderType(order) === "registration") {
        breakdown.registrations += amount;
      } else if (hasTickets && !hasMedia) {
        breakdown.tickets += amount;
      } else if (hasMedia && !hasTickets) {
        breakdown.media += amount;
      } else {
        breakdown.other += amount;
      }

      return breakdown;
    },
    {
      media: 0,
      other: 0,
      registrations: 0,
      tickets: 0,
    },
  );
}

function getDashboardVenueMetricValue(
  slice: Omit<RegistrationDashboardVenueSlice, "percent" | "value">,
  metric: RegistrationDashboardVenueMetric,
) {
  if (metric === "choreographies") {
    return slice.choreographies;
  }

  if (metric === "confirmed_registrations") {
    return slice.confirmedRegistrations;
  }

  if (metric === "revenue") {
    return slice.revenue;
  }

  if (metric === "tickets") {
    return slice.tickets;
  }

  return slice.participants;
}

function getDashboardVenueMetricLabel(metric: RegistrationDashboardVenueMetric, value: number) {
  return metric === "revenue" ? formatAdminCurrency(value) : value.toLocaleString("es-MX");
}

function buildDashboardVenueSlices({
  metric,
  orders,
  participants,
  programDances,
  ticketRows,
}: {
  metric: RegistrationDashboardVenueMetric;
  orders: RegistrationInscriptionOrder[];
  participants: RegistrationAdminParticipant[];
  programDances: RegistrationDance[];
  ticketRows: TicketDashboardRow[];
}) {
  const sliceMap = new Map<string, Omit<RegistrationDashboardVenueSlice, "percent" | "value">>();
  const ensureSlice = (venue: string) => {
    const key = venue || "sin-sede";
    const existingSlice = sliceMap.get(key);

    if (existingSlice) {
      return existingSlice;
    }

    const nextSlice = {
      choreographies: 0,
      confirmedRegistrations: 0,
      label: key === "sin-sede" ? "Sin sede" : getVenueLabel(key),
      participants: 0,
      revenue: 0,
      tickets: 0,
      venue: key,
    };

    sliceMap.set(key, nextSlice);
    return nextSlice;
  };
  const participantsByVenue = new Map<string, Set<string>>();
  const confirmedRegistrationsByVenue = new Map<string, Set<string>>();

  for (const participant of participants) {
    const participantKey = normalizeCurpInput(participant.curp) || participant.id;
    const venues = participant.eventVenues.length > 0 ? participant.eventVenues : ["sin-sede"];

    for (const venue of venues) {
      ensureSlice(venue);
      const venueParticipants = participantsByVenue.get(venue) ?? new Set<string>();

      venueParticipants.add(participantKey);
      participantsByVenue.set(venue, venueParticipants);
    }
  }

  for (const dance of programDances) {
    ensureSlice(dance.venue).choreographies += 1;
  }

  for (const order of orders) {
    const slice = ensureSlice(order.venue);

    if (order.status === "paid") {
      slice.revenue += order.paidAmount || order.amount;

      if (getAdminOrderType(order) === "registration") {
        const venueRegistrations = confirmedRegistrationsByVenue.get(order.venue) ?? new Set<string>();

        venueRegistrations.add(normalizeCurpInput(order.curp) || order.id);
        confirmedRegistrationsByVenue.set(order.venue, venueRegistrations);
      }
    }
  }

  for (const ticketRow of ticketRows) {
    ensureSlice(ticketRow.venue).tickets += ticketRow.paidTickets;
  }

  for (const [venue, participantKeys] of participantsByVenue) {
    const slice = ensureSlice(venue);

    slice.participants = participantKeys.size;
  }

  const rawSlices = Array.from(sliceMap.values()).map((slice) => {
    const confirmedRegistrations = confirmedRegistrationsByVenue.get(slice.venue)?.size ?? slice.confirmedRegistrations;
    const metricSource = {
      ...slice,
      confirmedRegistrations,
    };
    const value = getDashboardVenueMetricValue(metricSource, metric);

    return {
      ...slice,
      choreographies: metricSource.choreographies,
      confirmedRegistrations,
      value,
    };
  });
  const total = rawSlices.reduce((sum, slice) => sum + slice.value, 0);

  return rawSlices
    .filter((slice) => slice.value > 0)
    .map((slice) => ({
      ...slice,
      percent: total > 0 ? (slice.value / total) * 100 : 0,
    }))
    .sort((left, right) => right.value - left.value);
}

function getDashboardPieGradient(slices: RegistrationDashboardVenueSlice[]) {
  if (slices.length === 0) {
    return "conic-gradient(rgba(255,255,255,0.1) 0 100%)";
  }

  const colors = ["#f05293", "#8b5fd8", "#55a8e8", "#72cf72", "#f0b44c", "#56c4d5"];
  let start = 0;
  const stops = slices.map((slice, index) => {
    const end = start + slice.percent;
    const stop = `${colors[index % colors.length]} ${start}% ${end}%`;

    start = end;
    return stop;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

function getDashboardOrderTarget(order: RegistrationInscriptionOrder): RegistrationDashboardTarget {
  const section = getOrderRequestedTicketCount(order) > 0 ? "tickets" : getOrderMediaItemCount(order) > 0 ? "media" : "payments";

  return {
    mediaStatusFilter: order.status,
    orderId: order.id,
    query: getRegistrationInscriptionPaymentReference(order),
    section,
    statusFilter: order.status,
    ticketStatusFilter: order.status === "paid" ? "paid" : order.status === "rejected" ? "rejected" : "pending",
    venueFilter: order.venue,
  };
}

function buildDashboardActivityItems({
  orders,
  participants,
  programDances,
}: {
  orders: RegistrationInscriptionOrder[];
  participants: RegistrationAdminParticipant[];
  programDances: RegistrationDance[];
}) {
  const items: RegistrationDashboardActivityItem[] = [];

  for (const participant of participants) {
    items.push({
      academyName: participant.academyName,
      description: `${participant.fullName} · ${participant.academyName}`,
      icon: Users,
      id: `participant-${participant.id}`,
      occurredAt: participant.createdAt,
      target: {
        query: participant.fullName,
        registrationPaymentStatusFilter: "all",
        section: "registrations",
        venueFilter: participant.eventVenues[0] ?? "all",
      },
      title: "Nuevo participante registrado",
      tone: "purple",
    });
  }

  for (const dance of programDances) {
    items.push({
      academyName: dance.academyName ?? "Sin academia",
      description: `${dance.title} · ${getVenueLabel(dance.venue)}`,
      icon: Music2,
      id: `dance-${dance.id}`,
      occurredAt: dance.createdAt,
      target: { section: "program", venueFilter: dance.venue },
      title: "Coreografía creada",
      tone: "cyan",
    });

    if (dance.musicUpload) {
      items.push({
        academyName: dance.academyName ?? "Sin academia",
        description: `${dance.musicUpload.fileName} · ${dance.title}`,
        icon: Upload,
        id: `music-${dance.musicUpload.id}`,
        occurredAt: dance.musicUpload.uploadedAt,
        target: { section: "program", venueFilter: dance.venue },
        title: "Música subida",
        tone: "green",
      });
    }
  }

  for (const order of orders) {
    const orderTarget = getDashboardOrderTarget(order);
    const reference = getRegistrationInscriptionPaymentReference(order);
    const hasTickets = getOrderRequestedTicketCount(order) > 0;
    const hasMedia = getOrderMediaItemCount(order) > 0;
    const reviewer = order.reviewedBy ? ` · ${order.reviewedBy}` : "";
    const activityBase = {
      academyName: order.academyName,
      description: `${reference} · ${order.participantName}${reviewer}`,
      target: orderTarget,
    };

    if (order.status === "paid") {
      items.push({
        ...activityBase,
        icon: hasTickets ? Ticket : hasMedia ? Camera : CreditCard,
        id: `order-paid-${order.id}`,
        occurredAt: order.reviewedAt || order.paidAt || order.updatedAt,
        title: hasTickets ? "Boletos confirmados" : hasMedia ? "Foto/Video aprobado" : "Pago aprobado",
        tone: hasMedia ? "purple" : "green",
      });
      continue;
    }

    if (order.status === "rejected") {
      items.push({
        ...activityBase,
        icon: XCircle,
        id: `order-rejected-${order.id}`,
        occurredAt: order.reviewedAt || order.updatedAt,
        title: "Pago rechazado",
        tone: "amber",
      });
      continue;
    }

    if (order.status === "payment_reported") {
      items.push({
        ...activityBase,
        icon: FileText,
        id: `order-proof-${order.id}`,
        occurredAt: order.proof?.uploadedAt || order.updatedAt,
        title: "Comprobante subido",
        tone: "pink",
      });
      continue;
    }

    items.push({
      ...activityBase,
      icon: hasTickets ? Ticket : hasMedia ? ShoppingBag : ClipboardList,
      id: `order-created-${order.id}`,
      occurredAt: order.createdAt,
      title: hasTickets ? "Orden de boletos enviada" : hasMedia ? "Paquete Foto/Video adquirido" : "Orden de inscripción enviada",
      tone: hasTickets ? "pink" : "purple",
    });
  }

  return items
    .filter((item) => Number.isFinite(Date.parse(item.occurredAt)))
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
}

function getDashboardActivityTimeLabel(rawDate: string) {
  const date = new Date(rawDate);

  if (Number.isNaN(date.getTime())) {
    return rawDate || "Sin fecha";
  }

  const today = getDashboardStartOfDay(new Date());
  const activityDay = getDashboardStartOfDay(date);
  const time = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

  if (activityDay.getTime() === today.getTime()) {
    return `Hoy, ${time}`;
  }

  if (activityDay.getTime() === addDashboardDays(today, -1).getTime()) {
    return `Ayer, ${time}`;
  }

  return `${date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}, ${time}`;
}

function buildDashboardUpcomingEvents(programDances: RegistrationDance[]) {
  const danceCountByVenue = programDances.reduce<Map<string, number>>((counts, dance) => {
    counts.set(dance.venue, (counts.get(dance.venue) ?? 0) + 1);
    return counts;
  }, new Map());
  const venues = Array.from(new Set([...venueOptions.map((option) => option.value), ...programDances.map((dance) => dance.venue)]));

  return venues
    .map((venue) => {
      const eventDate = venueEventDates[venue] ? parseDashboardInputDate(venueEventDates[venue]) : null;
      const danceCount = danceCountByVenue.get(venue) ?? 0;
      const status = registrationDashboardEventStatusByVenue[venue] ?? (danceCount > 0 ? "En preparación" : "Borrador");

      return {
        date: eventDate,
        detail: danceCount > 0 ? `${danceCount} coreografías en programa` : "Programa pendiente",
        status,
        target: { section: "program" as const, venueFilter: venue },
        title: getVenueLabel(venue),
        type: "Competencia",
        venue,
      };
    })
    .sort((left, right) => {
      if (!left.date && !right.date) {
        return left.title.localeCompare(right.title, "es");
      }

      if (!left.date) {
        return 1;
      }

      if (!right.date) {
        return -1;
      }

      return left.date.getTime() - right.date.getTime();
    });
}

function getDashboardAlertSeverityLabel(severity: RegistrationDashboardAlertSeverity) {
  const labels: Record<RegistrationDashboardAlertSeverity, string> = {
    critical: "Crítico",
    important: "Importante",
    info: "Informativo",
  };

  return labels[severity];
}

function buildDashboardAlerts({
  orders,
  participants,
  programDances,
}: {
  orders: RegistrationInscriptionOrder[];
  participants: RegistrationAdminParticipant[];
  programDances: RegistrationDance[];
}) {
  const alerts: RegistrationDashboardAlert[] = [];
  const now = Date.now();
  const fortyEightHours = 48 * 60 * 60 * 1000;
  const paymentReviewOrders = orders.filter((order) => order.status === "payment_reported");
  const delayedPaymentReviewOrders = paymentReviewOrders.filter((order) => {
    const uploadedAt = Date.parse(order.proof?.uploadedAt || order.updatedAt || order.createdAt);

    return Number.isFinite(uploadedAt) && now - uploadedAt > fortyEightHours;
  });
  const pendingRegistrationOrders = orders.filter((order) => getAdminOrderType(order) === "registration" && order.status === "pending_payment");
  const missingInfoParticipants = participants.filter((participant) => !participant.birthDate || participant.age == null || !participant.shirtSize);
  const curpCounts = participants.reduce<Map<string, number>>((counts, participant) => {
    const curp = normalizeCurpInput(participant.curp);

    if (!curp) {
      return counts;
    }

    counts.set(curp, (counts.get(curp) ?? 0) + 1);
    return counts;
  }, new Map());
  const duplicateCurpCount = Array.from(curpCounts.values()).filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  const dancesWithoutParticipants = programDances.filter((dance) => dance.participants.length === 0);
  const dancesWithoutMusic = programDances.filter((dance) => !dance.musicUpload);
  const ticketIssueOrders = orders.filter(
    (order) => getOrderRequestedTicketCount(order) > 0 && (order.status === "pending_payment" || order.status === "payment_reported" || order.status === "rejected"),
  );
  const mediaPendingOrders = orders.filter(
    (order) => getOrderMediaItemCount(order) > 0 && (order.status === "pending_payment" || order.status === "payment_reported"),
  );
  const programmedVenues = new Set(programDances.map((dance) => dance.venue));
  const eventsWithoutProgram = venueOptions.filter((venue) => !programmedVenues.has(venue.value));

  if (delayedPaymentReviewOrders.length > 0) {
    alerts.push({
      actionLabel: "Revisar pagos",
      count: delayedPaymentReviewOrders.length,
      detail: "Comprobantes con más de 48 horas sin aprobar o rechazar.",
      id: "delayed-payments",
      reason: "Bloquea confirmaciones y comunicación con familias.",
      severity: "critical",
      target: { section: "payments", statusFilter: "payment_reported" },
      title: "Pagos atrasados en revisión",
    });
  }

  if (paymentReviewOrders.length > 0) {
    alerts.push({
      actionLabel: "Validar comprobantes",
      count: paymentReviewOrders.length,
      detail: "Pagos reportados esperando decisión administrativa.",
      id: "payment-review",
      reason: "Requiere aprobación o rechazo para cerrar la orden.",
      severity: "important",
      target: { section: "payments", statusFilter: "payment_reported" },
      title: "Pagos esperando revisión",
    });
  }

  if (pendingRegistrationOrders.length > 0) {
    alerts.push({
      actionLabel: "Dar seguimiento",
      count: pendingRegistrationOrders.length,
      detail: "Órdenes de inscripción creadas sin comprobante.",
      id: "pending-registration-payments",
      reason: "Aún no hay pago reportado.",
      severity: "important",
      target: { purchaseTypeFilter: "registration", section: "payments", statusFilter: "pending_payment" },
      title: "Inscripciones pendientes de pago",
    });
  }

  if (missingInfoParticipants.length > 0) {
    alerts.push({
      actionLabel: "Ver participantes",
      count: missingInfoParticipants.length,
      detail: "Participantes con edad, fecha de nacimiento o talla incompleta.",
      id: "missing-participant-info",
      reason: "Puede afectar programa, división o producción.",
      severity: "important",
      target: { query: "", section: "registrations" },
      title: "Participantes con información incompleta",
    });
  }

  if (duplicateCurpCount > 0) {
    alerts.push({
      actionLabel: "Revisar duplicados",
      count: duplicateCurpCount,
      detail: "CURPs repetidos entre participantes del periodo.",
      id: "duplicate-curps",
      reason: "Puede duplicar conteos o pagos asociados.",
      severity: "critical",
      target: { section: "registrations" },
      title: "CURPs duplicados",
    });
  }

  if (dancesWithoutParticipants.length > 0) {
    alerts.push({
      actionLabel: "Abrir programa",
      count: dancesWithoutParticipants.length,
      detail: "Coreografías registradas sin participantes asignados.",
      id: "dances-without-participants",
      reason: "No se pueden programar correctamente.",
      severity: "critical",
      target: { section: "program" },
      title: "Coreografías sin participantes",
    });
  }

  if (dancesWithoutMusic.length > 0) {
    alerts.push({
      actionLabel: "Abrir programa",
      count: dancesWithoutMusic.length,
      detail: "Coreografías sin archivo musical cargado.",
      id: "dances-without-music",
      reason: "Requiere seguimiento antes del evento.",
      severity: "important",
      target: { section: "program" },
      title: "Música pendiente",
    });
  }

  if (ticketIssueOrders.length > 0) {
    alerts.push({
      actionLabel: "Revisar boletos",
      count: ticketIssueOrders.length,
      detail: "Órdenes de boletos pendientes o rechazadas.",
      id: "ticket-issues",
      reason: "Afecta confirmación de entrada y QR.",
      severity: "important",
      target: { section: "tickets", ticketStatusFilter: "pending" },
      title: "Boletos con seguimiento",
    });
  }

  if (mediaPendingOrders.length > 0) {
    alerts.push({
      actionLabel: "Revisar Foto/Video",
      count: mediaPendingOrders.length,
      detail: "Paquetes de foto/video con pago pendiente o comprobante por revisar.",
      id: "media-pending",
      reason: "Aún requieren acción administrativa.",
      severity: "info",
      target: { mediaStatusFilter: "payment_reported", section: "media" },
      title: "Foto/Video pendiente",
    });
  }

  if (eventsWithoutProgram.length > 0) {
    alerts.push({
      actionLabel: "Abrir programa",
      count: eventsWithoutProgram.length,
      detail: "Sedes configuradas sin coreografías en el programa.",
      id: "events-without-program",
      reason: "Útil revisarlo antes de publicar calendario.",
      severity: "info",
      target: { section: "program" },
      title: "Eventos sin programa cargado",
    });
  }

  return alerts.sort((left, right) => {
    const severityRank: Record<RegistrationDashboardAlertSeverity, number> = {
      critical: 0,
      important: 1,
      info: 2,
    };

    return severityRank[left.severity] - severityRank[right.severity] || right.count - left.count;
  });
}

function getTicketStatusLabel(status: RegistrationEventTicketStatus) {
  const labels: Record<RegistrationEventTicketStatus, string> = {
    active: "Activo",
    cancelled: "Cancelado",
    used: "Usado",
  };

  return labels[status] ?? status;
}

export function downloadBlob(blob: Blob, fileName: string) {
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

async function createTicketArtwork(order: RegistrationTicketPdfOrder, ticket: RegistrationEventTicket) {
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
  drawWrappedText(order.paymentReference || order.reference, padding + 430, 760, width - padding * 2 - 430, 24, 28, ink, 780);

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

async function createPaymentProofImagePdfBlob(proof: RegistrationPaymentProof) {
  const image = await loadAdminImage(proof.dataUrl);
  const scale = 2;
  const width = 842;
  const height = 1191;
  const padding = 48;
  const headerHeight = 92;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo preparar el comprobante.");
  }

  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#111111";
  context.font = "900 18px Inter, Arial, sans-serif";
  context.fillText("COMPROBANTE DE PAGO", padding, 44);
  context.fillStyle = "rgba(17,17,17,0.58)";
  context.font = "700 13px Inter, Arial, sans-serif";
  context.fillText(proof.fileName, padding, 68);
  context.strokeStyle = "rgba(17,17,17,0.14)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding, headerHeight);
  context.lineTo(width - padding, headerHeight);
  context.stroke();

  const areaWidth = width - padding * 2;
  const areaHeight = height - headerHeight - padding;
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const areaRatio = areaWidth / areaHeight;
  const drawWidth = imageRatio > areaRatio ? areaWidth : areaHeight * imageRatio;
  const drawHeight = imageRatio > areaRatio ? areaWidth / imageRatio : areaHeight;
  const drawX = padding + (areaWidth - drawWidth) / 2;
  const drawY = headerHeight + (areaHeight - drawHeight) / 2;

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  return createMultiImagePdfBlob([{ canvas, height, width }]);
}

async function getPaymentProofPdfBlob(proof: RegistrationPaymentProof) {
  const sourceBlob = await fetch(proof.dataUrl).then((response) => response.blob());
  const sourceType = sourceBlob.type || proof.contentType;

  if (sourceType === "application/pdf" || proof.contentType === "application/pdf") {
    if (sourceBlob.type === "application/pdf") {
      return sourceBlob;
    }

    return new Blob([await sourceBlob.arrayBuffer()], { type: "application/pdf" });
  }

  if (sourceType.startsWith("image/") || proof.contentType.startsWith("image/")) {
    return createPaymentProofImagePdfBlob(proof);
  }

  throw new Error("Este comprobante no se puede abrir como PDF.");
}

function writePaymentProofWindowMessage(targetWindow: Window, title: string, message: string) {
  targetWindow.document.title = title;
  targetWindow.document.body.innerHTML = "";
  targetWindow.document.body.style.margin = "0";
  targetWindow.document.body.style.fontFamily = "Inter, Arial, sans-serif";
  targetWindow.document.body.style.background = "#fffaf4";
  targetWindow.document.body.style.color = "#171717";

  const wrapper = targetWindow.document.createElement("main");
  wrapper.style.minHeight = "100vh";
  wrapper.style.display = "grid";
  wrapper.style.placeItems = "center";
  wrapper.style.padding = "32px";
  wrapper.style.boxSizing = "border-box";

  const text = targetWindow.document.createElement("p");
  text.textContent = message;
  text.style.margin = "0";
  text.style.fontSize = "18px";
  text.style.fontWeight = "800";

  wrapper.append(text);
  targetWindow.document.body.append(wrapper);
}

async function openPaymentProofPdfInNewWindow(proof: RegistrationPaymentProof, title: string) {
  const targetWindow = window.open("", "_blank");

  if (!targetWindow) {
    throw new Error("No se pudo abrir una ventana nueva. Revisa si el navegador bloqueó popups.");
  }

  writePaymentProofWindowMessage(targetWindow, title, "Preparando comprobante...");

  try {
    const pdfBlob = await getPaymentProofPdfBlob(proof);
    const objectUrl = URL.createObjectURL(pdfBlob);

    targetWindow.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  } catch (error) {
    writePaymentProofWindowMessage(targetWindow, title, "No se pudo preparar el comprobante como PDF.");
    throw error;
  }
}

export async function createTicketsPdfBlob(order: RegistrationTicketPdfOrder) {
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
    "Comprador",
    "Correo comprador",
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
    getRegistrationOrderBuyerLabel(order),
    order.buyerEmail ?? "",
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
    "Alumno",
    "CURP",
    "Academia",
    "Eventos",
    "Boletos pedidos",
    "Boletos confirmados",
    "Listo para bloque",
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
    isTicketBlockReady(row) ? "Sí" : "No",
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
    "Comprador",
    "Correo comprador",
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
    getRegistrationOrderBuyerLabel(order),
    order.buyerEmail ?? "",
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

function downloadAdminParticipantsCsv(academies: RegistrationAdminAcademy[], participants: RegistrationAdminParticipant[], orders: RegistrationInscriptionOrder[]) {
  const headers = [
    "Academia",
    "Origen academia",
    "Contacto",
    "Email",
    "Teléfono",
    "Usuario",
    "Sede",
    "Participantes academia",
    "Coreógrafos",
    "Coreografías",
    "Órdenes inscripción",
    "Órdenes tienda",
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
  const participantsByAcademy = participants.reduce((map, participant) => {
    const current = map.get(participant.academyId) ?? [];

    current.push(participant);
    map.set(participant.academyId, current);
    return map;
  }, new Map<string, RegistrationAdminParticipant[]>());
  const csvRows = academies.flatMap((academy) => {
    const academyParticipants = participantsByAcademy.get(academy.id) ?? [];
    const baseRow = [
      academy.name,
      getAcademyOriginLabel(academy),
      academy.contactName,
      academy.email,
      academy.phone ?? "",
      academy.username ?? academy.userEmail ?? "",
      academy.eventVenues.map(getVenueLabel).join(" / ") || "Sin coreografía",
      academy.participantCount,
      academy.choreographerCount,
      academy.danceCount,
      academy.inscriptionOrderCount,
      academy.shopOrderCount,
    ];

    if (academyParticipants.length === 0) {
      return [[...baseRow, "", "", "", "", "", "", "", "Academia registrada sin movimientos", academy.createdAt]];
    }

    return academyParticipants.map((participant) => [
      ...baseRow,
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
  });

  for (const participant of participants) {
    if (academies.some((academy) => academy.id === participant.academyId)) {
      continue;
    }

    csvRows.push([
      participant.academyName,
      getAcademyOriginLabel({
        originCountry: participant.academyOriginCountry,
        originState: participant.academyOriginState,
        originType: participant.academyOriginType,
      }),
      participant.academyContactName ?? "",
      participant.academyEmail ?? "",
      participant.academyPhone ?? "",
      "",
      participant.eventVenues.map(getVenueLabel).join(" / ") || "Sin coreografía",
      "",
      "",
      "",
      "",
      "",
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
  }

  const csv = [headers, ...csvRows].map((row) => row.map(toRegistrationCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "levitate-participantes-por-academia.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadAdminChoreographersCsv(choreographers: RegistrationAdminChoreographer[]) {
  const headers = ["Nombre", "Academia", "Talla"];
  const rows = choreographers.map((choreographer) => [
    choreographer.fullName,
    choreographer.academyName,
    getOptionLabel(shirtSizes, choreographer.shirtSize),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(toRegistrationCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "levitate-coreografos.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadRegistrationDashboardCsv({
  dateWindow,
  mediaTotals,
  orders,
  participants,
  programDances,
  ticketTotals,
  venueFilter,
  venueMetric,
  venueSlices,
}: {
  dateWindow: RegistrationDashboardDateWindow;
  mediaTotals: ReturnType<typeof getMediaDashboardTotals>;
  orders: RegistrationInscriptionOrder[];
  participants: RegistrationAdminParticipant[];
  programDances: RegistrationDance[];
  ticketTotals: ReturnType<typeof getTicketDashboardTotals>;
  venueFilter: string;
  venueMetric: RegistrationDashboardVenueMetric;
  venueSlices: RegistrationDashboardVenueSlice[];
}) {
  const academyCount = getDashboardAcademyKeys(participants, orders).size;
  const participantPaymentCounts = getDashboardParticipantPaymentCounts(participants, orders);
  const revenueBreakdown = getDashboardRevenueBreakdown(orders);
  const summaryRows = [
    ["Reporte", "Panel general Levitate MX"],
    ["Periodo", dateWindow.label],
    ["Filtro sede", venueFilter === "all" ? "Todas" : getVenueLabel(venueFilter)],
    ["Generado", new Date().toLocaleString("es-MX")],
    [],
    ["Métrica", "Valor"],
    ["Academias con actividad", academyCount],
    ["Participantes únicos", getDashboardUniqueParticipantCount(participants)],
    ["Participantes sin inscripción confirmada", participantPaymentCounts.withoutConfirmedOrder],
    ["Coreografías en programa", programDances.length],
    ["Boletos confirmados", ticketTotals.paidTickets],
    ["Boletos pendientes", ticketTotals.pendingTickets],
    ["Paquetes Foto/Video comprados", mediaTotals.requestedItems],
    ["Foto/Video pendientes de pago", mediaTotals.pending],
    ["Ingresos confirmados", getDashboardPaidRevenue(orders)],
    ["Pendiente de verificación", getDashboardPendingVerificationRevenue(orders)],
    [],
    ["Ingresos por tipo", "Monto"],
    ["Inscripciones", revenueBreakdown.registrations],
    ["Boletos", revenueBreakdown.tickets],
    ["Foto/Video", revenueBreakdown.media],
    ["Otros", revenueBreakdown.other],
    [],
    [`Distribución por sede (${getOptionLabel(registrationDashboardVenueMetricOptions, venueMetric)})`, "Valor", "Porcentaje"],
    ...venueSlices.map((slice) => [slice.label, slice.value, `${Math.round(slice.percent)}%`]),
  ];
  const csv = summaryRows.map((row) => row.map(toRegistrationCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "levitate-panel-general-resumen.csv";
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

function redirectRegistrationAdmin(session: RegistrationSession | RegistrationBootstrap) {
  if (session.user.role !== "admin" || typeof window === "undefined") {
    return false;
  }

  window.location.replace("/admin/inscripciones");
  return true;
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

  const Icon = tone === "success" ? ShieldCheck : CircleAlert;
  const toneClass =
    tone === "error"
      ? " levitate-auth-message--error"
      : tone === "warning"
        ? " levitate-auth-message--warning"
        : "";

  return (
    <p className={`levitate-auth-message${toneClass}`}>
      <Icon aria-hidden="true" size={17} />
      {message}
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
              <AdminField icon={Phone} label="Teléfono">
                <input autoComplete="tel" name="phone" type="tel" />
              </AdminField>
              <AdminField icon={Globe2} label="Origen de la academia">
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
                  {getProgramDivisionLabel(registration.division)} · Playera {getOptionLabel(shirtSizes, registration.shirtSize)}
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
  isInternationalAcademy,
  onScreenChange,
  onLogout,
}: {
  activeScreen: AdminScreenId;
  isInternationalAcademy: boolean;
  onScreenChange: (screen: AdminScreenId) => void;
  onLogout: () => void;
}) {
  const visibleMenuItems = adminMenuItems.filter((item) => item.screen !== "payments" || isInternationalAcademy);

  return (
    <aside className="levitate-admin-sidebar" aria-label="Menú administrativo">
      <h2>Registro</h2>
      <nav>
        {visibleMenuItems.map((item) => {
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

function RegistrationDashboardMetricCard({
  accent,
  detail,
  icon: Icon,
  label,
  meta,
  onClick,
  progress,
  value,
}: {
  accent: "pink" | "purple" | "green" | "cyan" | "amber";
  detail?: string;
  icon: LucideIcon;
  label: string;
  meta: string;
  onClick: () => void;
  progress?: number | null;
  value: string;
}) {
  return (
    <button className={`registration-dashboard-metric registration-dashboard-metric--${accent}`} onClick={onClick} type="button">
      <span className="registration-dashboard-metric__icon" aria-hidden="true">
        <Icon size={24} />
      </span>
      <span className="registration-dashboard-metric__body">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      {progress != null ? (
        <span
          className="registration-dashboard-metric__progress"
          style={{ "--dashboard-progress": `${Math.max(0, Math.min(100, progress))}%` } as CSSProperties}
          aria-hidden="true"
        />
      ) : null}
      <em>
        {meta}
        <ArrowUpRight aria-hidden="true" size={15} />
      </em>
    </button>
  );
}

function RegistrationDashboardSectionHeader({
  actionLabel,
  children,
  onAction,
  title,
}: {
  actionLabel?: string;
  children?: ReactNode;
  onAction?: () => void;
  title: string;
}) {
  return (
    <header className="registration-dashboard-panel__header">
      <div>
        <h2>{title}</h2>
        {children}
      </div>
      {actionLabel && onAction ? (
        <button onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </header>
  );
}

function RegistrationAdminDashboardOverview({
  customEndDate,
  customStartDate,
  dateRange,
  dateWindow,
  isLoading,
  isParticipantsLoading,
  isProgramLoading,
  lastUpdatedAt,
  onCustomEndDateChange,
  onCustomStartDateChange,
  onDateRangeChange,
  onNavigate,
  onRefresh,
  onVenueFilterChange,
  orders,
  participants,
  programDances,
  userName,
  venueFilter,
  venueMetric,
}: {
  customEndDate: string;
  customStartDate: string;
  dateRange: RegistrationDashboardDateRangeId;
  dateWindow: RegistrationDashboardDateWindow;
  isLoading: boolean;
  isParticipantsLoading: boolean;
  isProgramLoading: boolean;
  lastUpdatedAt: string;
  onCustomEndDateChange: (value: string) => void;
  onCustomStartDateChange: (value: string) => void;
  onDateRangeChange: (value: RegistrationDashboardDateRangeId) => void;
  onNavigate: (target: RegistrationDashboardTarget) => void;
  onRefresh: () => void;
  onVenueFilterChange: (value: string) => void;
  orders: RegistrationInscriptionOrder[];
  participants: RegistrationAdminParticipant[];
  programDances: RegistrationDance[];
  userName: string;
  venueFilter: string;
  venueMetric: RegistrationDashboardVenueMetric;
}) {
  const effectiveVenueFilter = getDashboardEffectiveVenueFilter(dateWindow, venueFilter);
  const scopedOrders = useMemo(() => getDashboardScopedOrders(orders, dateWindow, venueFilter), [dateWindow, orders, venueFilter]);
  const scopedParticipants = useMemo(
    () => getDashboardScopedParticipants(participants, dateWindow, venueFilter),
    [dateWindow, participants, venueFilter],
  );
  const scopedProgramDances = useMemo(
    () => getDashboardScopedDances(programDances, dateWindow, venueFilter),
    [dateWindow, programDances, venueFilter],
  );
  const previousDateWindow = useMemo(() => getPreviousDashboardDateWindow(dateWindow), [dateWindow]);
  const previousOrders = useMemo(
    () => (previousDateWindow ? getDashboardScopedOrders(orders, previousDateWindow, venueFilter) : []),
    [orders, previousDateWindow, venueFilter],
  );
  const previousParticipants = useMemo(
    () => (previousDateWindow ? getDashboardScopedParticipants(participants, previousDateWindow, venueFilter) : []),
    [participants, previousDateWindow, venueFilter],
  );
  const ticketRows = useMemo(() => getTicketDashboardRows(scopedOrders), [scopedOrders]);
  const ticketTotals = useMemo(() => getTicketDashboardTotals(ticketRows), [ticketRows]);
  const previousTicketTotals = useMemo(() => getTicketDashboardTotals(getTicketDashboardRows(previousOrders)), [previousOrders]);
  const mediaOrders = useMemo(
    () => scopedOrders.filter((order) => getAdminOrderType(order) === "shop" && getOrderMediaLineItems(order).length > 0),
    [scopedOrders],
  );
  const mediaTotals = useMemo(() => getMediaDashboardTotals(mediaOrders), [mediaOrders]);
  const previousMediaOrders = useMemo(
    () => previousOrders.filter((order) => getAdminOrderType(order) === "shop" && getOrderMediaLineItems(order).length > 0),
    [previousOrders],
  );
  const previousMediaTotals = useMemo(() => getMediaDashboardTotals(previousMediaOrders), [previousMediaOrders]);
  const academyCount = getDashboardAcademyKeys(scopedParticipants, scopedOrders).size;
  const previousAcademyCount = getDashboardAcademyKeys(previousParticipants, previousOrders).size;
  const participantCount = getDashboardUniqueParticipantCount(scopedParticipants);
  const previousParticipantCount = getDashboardUniqueParticipantCount(previousParticipants);
  const participantPaymentCounts = getDashboardParticipantPaymentCounts(scopedParticipants, scopedOrders);
  const paidMediaPackages = mediaOrders.reduce(
    (total, order) => total + (order.status === "paid" ? getOrderMediaItemCount(order) : 0),
    0,
  );
  const previousPaidMediaPackages = previousMediaOrders.reduce(
    (total, order) => total + (order.status === "paid" ? getOrderMediaItemCount(order) : 0),
    0,
  );
  const confirmedRevenue = getDashboardPaidRevenue(scopedOrders);
  const previousConfirmedRevenue = getDashboardPaidRevenue(previousOrders);
  const pendingRevenue = getDashboardPendingVerificationRevenue(scopedOrders);
  const revenueBreakdown = getDashboardRevenueBreakdown(scopedOrders);
  const venueSlices = useMemo(
    () =>
      buildDashboardVenueSlices({
        metric: venueMetric,
        orders: scopedOrders,
        participants: scopedParticipants,
        programDances: scopedProgramDances,
        ticketRows,
      }),
    [scopedOrders, scopedParticipants, scopedProgramDances, ticketRows, venueMetric],
  );
  const alerts = useMemo(
    () => buildDashboardAlerts({ orders: scopedOrders, participants: scopedParticipants, programDances: scopedProgramDances }).slice(0, 5),
    [scopedOrders, scopedParticipants, scopedProgramDances],
  );
  const hasAnyDashboardData = scopedOrders.length > 0 || scopedParticipants.length > 0 || scopedProgramDances.length > 0;
  const isDashboardLoading = isLoading || isParticipantsLoading || isProgramLoading;
  const ticketProgress = ticketTotals.requestedTickets > 0 ? (ticketTotals.paidTickets / ticketTotals.requestedTickets) * 100 : 0;
  const lastUpdatedLabel = lastUpdatedAt ? getDashboardActivityTimeLabel(lastUpdatedAt) : "Sin actualizar";
  const firstName = userName.trim().split(/\s+/)[0] || "equipo";

  const handleExportDashboard = () => {
    downloadRegistrationDashboardCsv({
      dateWindow,
      mediaTotals,
      orders: scopedOrders,
      participants: scopedParticipants,
      programDances: scopedProgramDances,
      ticketTotals,
      venueFilter: effectiveVenueFilter,
      venueMetric,
      venueSlices,
    });
  };

  return (
    <section className="registration-dashboard-overview" aria-label="Panel operativo Levitate">
      <div className="registration-dashboard-topline">
        <div>
          <h1>¡Bienvenida, {firstName}!</h1>
          <p>Resumen operativo de Levitate MX con los datos disponibles en el periodo seleccionado.</p>
        </div>
        <div className="registration-dashboard-controls" aria-label="Controles globales del panel">
          <label>
            <CalendarRange aria-hidden="true" size={17} />
            <span>Periodo</span>
            <select
              onChange={(event) => onDateRangeChange(event.target.value as RegistrationDashboardDateRangeId)}
              value={dateRange}
            >
              {registrationDashboardDateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={15} />
          </label>
          {dateRange === "custom" ? (
            <>
              <label className="registration-dashboard-controls__date">
                <span>Inicio</span>
                <input onChange={(event) => onCustomStartDateChange(event.target.value)} type="date" value={customStartDate} />
              </label>
              <label className="registration-dashboard-controls__date">
                <span>Fin</span>
                <input onChange={(event) => onCustomEndDateChange(event.target.value)} type="date" value={customEndDate} />
              </label>
            </>
          ) : null}
          <label>
            <MapPin aria-hidden="true" size={17} />
            <span>Sede</span>
            <select onChange={(event) => onVenueFilterChange(event.target.value)} value={venueFilter}>
              <option value="all">Todas</option>
              {venueLabelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={15} />
          </label>
          <button className="registration-dashboard-icon-button" onClick={onRefresh} type="button">
            <RefreshCw aria-hidden="true" size={17} />
            Actualizar
          </button>
          <button className="registration-dashboard-export" disabled={!hasAnyDashboardData} onClick={handleExportDashboard} type="button">
            <Download aria-hidden="true" size={17} />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="registration-dashboard-filterbar">
        <span>
          <ListFilter aria-hidden="true" size={16} />
          {dateWindow.label}
          {effectiveVenueFilter !== "all" ? ` · Viendo: ${getVenueLabel(effectiveVenueFilter)}` : ""}
        </span>
        <small>Actualizado: {lastUpdatedLabel}</small>
        {effectiveVenueFilter !== "all" ? (
          <button
            onClick={() => {
              onVenueFilterChange("all");

              if (dateWindow.currentEventVenue) {
                onDateRangeChange("season");
              }
            }}
            type="button"
          >
            Quitar filtro
          </button>
        ) : null}
      </div>

      {isDashboardLoading && !hasAnyDashboardData ? (
        <div className="registration-dashboard-skeleton-grid" aria-label="Cargando panel">
          {Array.from({ length: 7 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : null}

      <section className="registration-dashboard-metrics" aria-label="Métricas principales">
        <RegistrationDashboardMetricCard
          accent="pink"
          detail={`${academyCount} activas con registros u órdenes`}
          icon={Building2}
          label="Academias con actividad"
          meta={previousDateWindow ? getDashboardTrendLabel(academyCount, previousAcademyCount) : "Agrupadas desde registros actuales"}
          onClick={() => onNavigate({ section: "registrations" })}
          value={academyCount.toLocaleString("es-MX")}
        />
        <RegistrationDashboardMetricCard
          accent="purple"
          detail={`${participantPaymentCounts.incomplete} con información incompleta`}
          icon={Users}
          label="Participantes"
          meta={previousDateWindow ? getDashboardTrendLabel(participantCount, previousParticipantCount) : `${participantPaymentCounts.withoutConfirmedOrder} sin inscripción confirmada`}
          onClick={() => onNavigate({ section: "registrations" })}
          value={participantCount.toLocaleString("es-MX")}
        />
        <RegistrationDashboardMetricCard
          accent="pink"
          detail={`${ticketTotals.paidTickets.toLocaleString("es-MX")} de ${ticketTotals.requestedTickets.toLocaleString("es-MX")} pedidos`}
          icon={Ticket}
          label="Boletos vendidos"
          meta={previousDateWindow ? getDashboardTrendLabel(ticketTotals.paidTickets, previousTicketTotals.paidTickets) : `${ticketTotals.pendingTickets} pendientes`}
          onClick={() => onNavigate({ section: "tickets", ticketStatusFilter: "paid" })}
          progress={ticketProgress}
          value={ticketTotals.paidTickets.toLocaleString("es-MX")}
        />
        <RegistrationDashboardMetricCard
          accent="purple"
          detail={`${mediaTotals.pending} compras pendientes de pago`}
          icon={Camera}
          label="Paquetes Foto/Video"
          meta={previousDateWindow ? getDashboardTrendLabel(paidMediaPackages, previousPaidMediaPackages) : `${mediaTotals.requestedItems} paquetes pedidos`}
          onClick={() => onNavigate({ section: "media", mediaStatusFilter: "paid" })}
          value={paidMediaPackages.toLocaleString("es-MX")}
        />
        <RegistrationDashboardMetricCard
          accent="green"
          detail={`Pendiente verificación: ${formatAdminCurrency(pendingRevenue)}`}
          icon={Wallet}
          label="Ingresos confirmados"
          meta={previousDateWindow ? getDashboardPercentTrendLabel(confirmedRevenue, previousConfirmedRevenue) : "Solo pagos aprobados"}
          onClick={() => onNavigate({ section: "payments", statusFilter: "paid" })}
          value={formatAdminCurrency(confirmedRevenue)}
        />
      </section>

      <section className="registration-dashboard-bottom-grid">
        <article className="registration-dashboard-panel registration-dashboard-status">
          <RegistrationDashboardSectionHeader title="Estado general" />
          <div className="registration-dashboard-status__grid">
            <button onClick={() => onNavigate({ registrationPaymentStatusFilter: "requires_payment", section: "registrations" })} type="button">
              <Building2 aria-hidden="true" size={22} />
              <span>Inscripciones</span>
              <strong>{participantCount.toLocaleString("es-MX")}</strong>
              <small>{participantPaymentCounts.withoutConfirmedOrder} requieren pago o confirmación</small>
            </button>
            <button onClick={() => onNavigate({ section: "payments", statusFilter: "payment_reported" })} type="button">
              <CreditCard aria-hidden="true" size={22} />
              <span>Pagos</span>
              <strong>{formatAdminCurrency(revenueBreakdown.registrations + revenueBreakdown.tickets + revenueBreakdown.media + revenueBreakdown.other)}</strong>
              <small>{scopedOrders.filter((order) => order.status === "payment_reported").length} pagos por revisar</small>
            </button>
            <button onClick={() => onNavigate({ section: "tickets", ticketStatusFilter: "pending" })} type="button">
              <Ticket aria-hidden="true" size={22} />
              <span>Boletos</span>
              <strong>
                {ticketTotals.paidTickets.toLocaleString("es-MX")} / {ticketTotals.requestedTickets.toLocaleString("es-MX")}
              </strong>
              <small>{ticketTotals.pendingTickets} pendientes de confirmación</small>
            </button>
            <button onClick={() => onNavigate({ mediaStatusFilter: "payment_reported", section: "media" })} type="button">
              <Camera aria-hidden="true" size={22} />
              <span>Foto/Video</span>
              <strong>{mediaTotals.requestedItems.toLocaleString("es-MX")}</strong>
              <small>{mediaTotals.pending} pendientes de pago o revisión</small>
            </button>
          </div>
        </article>

        <article className="registration-dashboard-panel registration-dashboard-alerts">
          <RegistrationDashboardSectionHeader
            actionLabel="Ver todas"
            onAction={() => onNavigate({ section: "payments", statusFilter: "payment_reported" })}
            title="Alertas"
          />
          <div className="registration-dashboard-alerts__list">
            {alerts.map((alert) => {
              const Icon = alert.severity === "critical" ? TriangleAlert : alert.severity === "important" ? CircleAlert : Info;

              return (
                <button key={alert.id} onClick={() => onNavigate(alert.target)} type="button">
                  <span className={`registration-dashboard-alerts__icon registration-dashboard-alerts__icon--${alert.severity}`}>
                    <Icon aria-hidden="true" size={18} />
                  </span>
                  <span>
                    <strong>
                      {alert.count} · {alert.title}
                    </strong>
                    <small>
                      {getDashboardAlertSeverityLabel(alert.severity)} · {alert.reason}
                    </small>
                  </span>
                  <em>{alert.actionLabel}</em>
                </button>
              );
            })}
            {alerts.length === 0 ? (
              <p className="registration-dashboard-empty">No hay alertas accionables para este periodo.</p>
            ) : null}
          </div>
        </article>
      </section>
    </section>
  );
}

function RegistrationAcademySummaryCard({
  icon: Icon,
  label,
  meta,
  onClick,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  meta: string;
  onClick: () => void;
  tone: "pink" | "purple" | "green" | "amber" | "red";
  value: string;
}) {
  return (
    <button className={`registration-academies-summary-card registration-academies-summary-card--${tone}`} onClick={onClick} type="button">
      <span aria-hidden="true">
        <Icon size={22} />
      </span>
      <strong>{value}</strong>
      <small>{label}</small>
      <em>{meta}</em>
    </button>
  );
}

function RegistrationAcademyLogo({ initials, name }: { initials: string; name: string }) {
  return (
    <span className="registration-academies-logo" aria-label={`Logo de ${name}`}>
      {initials}
    </span>
  );
}

function RegistrationAcademyAlerts({ alerts, limit = 2 }: { alerts: string[]; limit?: number }) {
  if (alerts.length === 0) {
    return <span className="registration-academies-alerts registration-academies-alerts--clear">Sin alertas</span>;
  }

  const visibleAlerts = alerts.slice(0, limit);
  const hiddenCount = alerts.length - visibleAlerts.length;

  return (
    <span className="registration-academies-alerts">
      {visibleAlerts.map((alert) => (
        <em key={alert}>{alert}</em>
      ))}
      {hiddenCount > 0 ? <em>+{hiddenCount}</em> : null}
    </span>
  );
}

function RegistrationAcademiesDirectoryPanel({
  eventFilter,
  filteredSummaries,
  isLoading,
  onEventFilterChange,
  onMetricNavigate,
  onNewAcademy,
  onOpenAcademy,
  onQueryChange,
  onSortChange,
  onStatusFilterChange,
  query,
  sort,
  statusFilter,
  summaries,
}: {
  eventFilter: string;
  filteredSummaries: RegistrationAcademyDirectorySummary[];
  isLoading: boolean;
  onEventFilterChange: (value: string) => void;
  onMetricNavigate: (target: RegistrationDashboardTarget) => void;
  onNewAcademy: () => void;
  onOpenAcademy: (academyId: string, tab?: RegistrationAcademyProfileTab) => void;
  onQueryChange: (value: string) => void;
  onSortChange: (value: RegistrationAcademyDirectorySort) => void;
  onStatusFilterChange: (value: string) => void;
  query: string;
  sort: RegistrationAcademyDirectorySort;
  statusFilter: string;
  summaries: RegistrationAcademyDirectorySummary[];
}) {
  const activeCount = summaries.filter((summary) => summary.status === "active").length;
  const withRegistrationsCount = summaries.filter((summary) => summary.registrationOrderCount > 0).length;
  const incompleteCount = summaries.filter((summary) => summary.status === "incomplete").length;
  const inactiveCount = summaries.filter((summary) => summary.status === "inactive" || summary.status === "archived").length;
  const newAcademiesThisWeek = summaries.filter((summary) => {
    const createdAt = Date.parse(summary.academy.createdAt);

    return Number.isFinite(createdAt) && Date.now() - createdAt <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <section className="registration-academies-panel" aria-label="Directorio de academias">
      <section className="registration-academies-summary" aria-label="Resumen de academias">
        <RegistrationAcademySummaryCard
          icon={Building2}
          label="Total academias"
          meta={`+${newAcademiesThisWeek} esta semana`}
          onClick={() => onStatusFilterChange("all")}
          tone="pink"
          value={summaries.length.toLocaleString("es-MX")}
        />
        <RegistrationAcademySummaryCard
          icon={UserPlus}
          label="Academias activas"
          meta={`${summaries.length > 0 ? Math.round((activeCount / summaries.length) * 100) : 0}% del total`}
          onClick={() => onStatusFilterChange("active")}
          tone="purple"
          value={activeCount.toLocaleString("es-MX")}
        />
        <RegistrationAcademySummaryCard
          icon={CheckCircle2}
          label="Con inscripciones"
          meta={`${summaries.length > 0 ? Math.round((withRegistrationsCount / summaries.length) * 100) : 0}% del total`}
          onClick={() => onStatusFilterChange("with_registrations")}
          tone="green"
          value={withRegistrationsCount.toLocaleString("es-MX")}
        />
        <RegistrationAcademySummaryCard
          icon={Clock}
          label="Pendientes de completar"
          meta={`${summaries.length > 0 ? Math.round((incompleteCount / summaries.length) * 100) : 0}% del total`}
          onClick={() => onStatusFilterChange("incomplete")}
          tone="amber"
          value={incompleteCount.toLocaleString("es-MX")}
        />
        <RegistrationAcademySummaryCard
          icon={XCircle}
          label="Inactivas"
          meta={`${summaries.length > 0 ? Math.round((inactiveCount / summaries.length) * 100) : 0}% del total`}
          onClick={() => onStatusFilterChange("inactive")}
          tone="red"
          value={inactiveCount.toLocaleString("es-MX")}
        />
      </section>

      <section className="registration-academies-toolbar" aria-label="Filtros de academias">
        <label className="registration-academies-search">
          <Search aria-hidden="true" size={17} />
          <input
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar academia, contacto o ciudad..."
            type="search"
            value={query}
          />
        </label>
        <label>
          <span>Estado</span>
          <select onChange={(event) => onStatusFilterChange(event.target.value)} value={statusFilter}>
            {registrationAcademyStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={16} />
        </label>
        <label>
          <span>Evento / Sede</span>
          <select onChange={(event) => onEventFilterChange(event.target.value)} value={eventFilter}>
            <option value="all">Todas</option>
            {venueLabelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={16} />
        </label>
        <label>
          <span>Ordenar por</span>
          <select onChange={(event) => onSortChange(event.target.value as RegistrationAcademyDirectorySort)} value={sort}>
            {registrationAcademySortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={16} />
        </label>
        <button onClick={() => onStatusFilterChange("needs_attention")} type="button">
          <ListFilter aria-hidden="true" size={17} />
          Alertas
        </button>
        <button className="registration-academies-new-mobile" onClick={onNewAcademy} type="button">
          <Plus aria-hidden="true" size={17} />
          Nueva academia
        </button>
      </section>

      <section className="registration-academies-directory" aria-label="Academias registradas">
        <div className="registration-academies-directory__head" role="row">
          <span role="columnheader">Academia</span>
          <span role="columnheader">Ubicación</span>
          <span role="columnheader">Inscripciones</span>
          <span role="columnheader">Participantes</span>
          <span role="columnheader">Coreógrafos</span>
          <span role="columnheader">Última actividad</span>
          <span role="columnheader">Alertas</span>
          <span role="columnheader">Acciones</span>
        </div>

        {filteredSummaries.map((summary) => (
          <article
            className="registration-academies-directory__row"
            key={summary.academy.id}
            onClick={() => onOpenAcademy(summary.academy.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenAcademy(summary.academy.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="registration-academies-directory__academy">
              <RegistrationAcademyLogo initials={summary.initials} name={summary.academy.name} />
              <span>
                <strong>{summary.academy.name}</strong>
                <small>{summary.academy.contactName || "Sin contacto principal"}</small>
                <small>{[summary.academy.email, summary.academy.phone].filter(Boolean).join(" · ") || "Sin correo o teléfono"}</small>
              </span>
            </div>
            <div>
              <strong>{summary.locationLabel}</strong>
              <small>{summary.locationDetail}</small>
            </div>
            <button
              className="registration-academies-directory__metric"
              onClick={(event) => {
                event.stopPropagation();
                onMetricNavigate({ purchaseTypeFilter: "registration", query: summary.academy.name, section: "payments" });
              }}
              type="button"
            >
              <strong>{summary.registrationOrderCount.toLocaleString("es-MX")}</strong>
              <small>{summary.confirmedRegistrationCount} confirmadas</small>
              <small>{summary.pendingRegistrationCount} pendientes</small>
            </button>
            <button
              className="registration-academies-directory__metric"
              onClick={(event) => {
                event.stopPropagation();
                onMetricNavigate({ query: summary.academy.name, section: "registrations" });
              }}
              type="button"
            >
              <strong>{summary.academy.participantCount.toLocaleString("es-MX")}</strong>
              <small>Ver detalle</small>
            </button>
            <button
              className="registration-academies-directory__metric"
              onClick={(event) => {
                event.stopPropagation();
                onOpenAcademy(summary.academy.id, "choreographers");
              }}
              type="button"
            >
              <strong>{summary.academy.choreographerCount.toLocaleString("es-MX")}</strong>
              <small>Ver detalle</small>
            </button>
            <div>
              <strong>{getDashboardActivityTimeLabel(summary.latestActivity.date)}</strong>
              <small>{summary.latestActivity.title}</small>
            </div>
            <RegistrationAcademyAlerts alerts={summary.alerts} />
            <button
              className="registration-academies-directory__action"
              onClick={(event) => {
                event.stopPropagation();
                onOpenAcademy(summary.academy.id);
              }}
              type="button"
              aria-label={`Abrir ${summary.academy.name}`}
            >
              <Eye aria-hidden="true" size={17} />
            </button>
          </article>
        ))}

        {filteredSummaries.length === 0 ? (
          <p className="registration-academies-empty">
            {isLoading ? "Cargando academias..." : "No hay academias que coincidan con esos filtros."}
          </p>
        ) : null}

        <footer className="registration-academies-directory__footer">
          <span>
            Mostrando {filteredSummaries.length} de {summaries.length} academias
          </span>
          <small>10 por página</small>
        </footer>
      </section>
    </section>
  );
}

function RegistrationAcademyProfileList({
  emptyMessage,
  items,
}: {
  emptyMessage: string;
  items: Array<{
    detail?: string;
    meta?: string;
    title: string;
  }>;
}) {
  if (items.length === 0) {
    return <p className="registration-academy-profile__empty">{emptyMessage}</p>;
  }

  return (
    <div className="registration-academy-profile__list">
      {items.map((item) => (
        <article key={`${item.title}-${item.meta ?? item.detail ?? ""}`}>
          <strong>{item.title}</strong>
          {item.detail ? <span>{item.detail}</span> : null}
          {item.meta ? <small>{item.meta}</small> : null}
        </article>
      ))}
    </div>
  );
}

function getRegistrationAcademyProfileActivity(summary: RegistrationAcademyDirectorySummary) {
  const activities: Array<{ date: string; detail: string; title: string }> = [];

  for (const participant of summary.participants) {
    activities.push({
      date: participant.createdAt,
      detail: participant.fullName,
      title: "Participante agregado",
    });
  }

  for (const dance of summary.choreographies) {
    activities.push({
      date: dance.createdAt,
      detail: dance.title,
      title: "Coreografía registrada",
    });

    if (dance.musicUpload) {
      activities.push({
        date: dance.musicUpload.uploadedAt,
        detail: dance.title,
        title: "Música cargada",
      });
    }
  }

  for (const order of summary.orders) {
    activities.push({
      date: order.reviewedAt || order.proof?.uploadedAt || order.updatedAt || order.createdAt,
      detail: `${getRegistrationInscriptionPaymentReference(order)} · ${getAdminPaymentStatusLabel(order.status)}`,
      title: getAdminOrderTypeLabel(order),
    });
  }

  return activities
    .filter((activity) => Number.isFinite(Date.parse(activity.date)))
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
}

function RegistrationAcademyQuickPanel({
  onClose,
  onNavigate,
  onTabChange,
  summary,
  tab,
}: {
  onClose: () => void;
  onNavigate: (target: RegistrationDashboardTarget) => void;
  onTabChange: (value: RegistrationAcademyProfileTab) => void;
  summary: RegistrationAcademyDirectorySummary;
  tab: RegistrationAcademyProfileTab;
}) {
  const ticketOrders = summary.orders.filter((order) => getOrderRequestedTicketCount(order) > 0);
  const mediaOrders = summary.orders.filter((order) => getOrderMediaItemCount(order) > 0);
  const choreographerNames = Array.from(
    new Set(summary.choreographies.flatMap((dance) => dance.choreographers.map((choreographer) => choreographer.fullName)).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "es"));
  const activities = getRegistrationAcademyProfileActivity(summary);

  return (
    <aside className="registration-academy-profile" aria-label={`Perfil de ${summary.academy.name}`}>
      <header className="registration-academy-profile__header">
        <RegistrationAcademyLogo initials={summary.initials} name={summary.academy.name} />
        <div>
          <span>Academia</span>
          <h2>{summary.academy.name}</h2>
          <p>{summary.academy.contactName || "Sin contacto principal"}</p>
        </div>
        <button onClick={onClose} type="button" aria-label="Cerrar perfil">
          <X aria-hidden="true" size={18} />
        </button>
      </header>

      <div className="registration-academy-profile__meta">
        <span>{summary.locationLabel}</span>
        <span>{summary.locationDetail}</span>
      </div>

      <nav className="registration-academy-profile__tabs" aria-label="Secciones del perfil de academia">
        {registrationAcademyProfileTabs.map((profileTab) => (
          <button
            className={tab === profileTab.value ? "is-active" : ""}
            key={profileTab.value}
            onClick={() => onTabChange(profileTab.value)}
            type="button"
          >
            {profileTab.label}
          </button>
        ))}
      </nav>

      <div className="registration-academy-profile__body">
        {tab === "overview" ? (
          <>
            <section className="registration-academy-profile__stats" aria-label="Resumen rápido">
              <button onClick={() => onNavigate({ purchaseTypeFilter: "registration", query: summary.academy.name, section: "payments" })} type="button">
                <span>Inscripciones</span>
                <strong>{summary.registrationOrderCount}</strong>
                <small>{summary.confirmedRegistrationCount} confirmadas · {summary.pendingRegistrationCount} pendientes</small>
              </button>
              <button onClick={() => onNavigate({ query: summary.academy.name, section: "registrations" })} type="button">
                <span>Participantes</span>
                <strong>{summary.academy.participantCount}</strong>
                <small>{summary.participants.length} en datos cargados</small>
              </button>
              <button onClick={() => onTabChange("choreographies")} type="button">
                <span>Coreografías</span>
                <strong>{summary.academy.danceCount}</strong>
                <small>{summary.choreographies.length} en programa</small>
              </button>
              <button onClick={() => onTabChange("activity")} type="button">
                <span>Pendientes</span>
                <strong>{summary.pendingOrderCount}</strong>
                <small>{summary.alerts.length} alerta(s)</small>
              </button>
            </section>
            <section className="registration-academy-profile__block">
              <h3>Última acción</h3>
              <p>
                <strong>{summary.latestActivity.title}</strong>
                <span>{summary.latestActivity.description} · {getDashboardActivityTimeLabel(summary.latestActivity.date)}</span>
              </p>
            </section>
            <section className="registration-academy-profile__block">
              <h3>Alertas</h3>
              <RegistrationAcademyAlerts alerts={summary.alerts} limit={6} />
            </section>
          </>
        ) : null}

        {tab === "participants" ? (
          <RegistrationAcademyProfileList
            emptyMessage="No hay participantes asociados en los datos cargados."
            items={summary.participants.map((participant) => ({
              detail: `${participant.curp} · ${getProgramDivisionLabel(participant.division)} · ${getParticipantPaymentStatusLabel(getParticipantPaymentStatus(participant, summary.orders))}`,
              meta: `Edad ${participant.age ?? "sin dato"} · Playera ${getOptionLabel(shirtSizes, participant.shirtSize)}`,
              title: participant.fullName,
            }))}
          />
        ) : null}

        {tab === "choreographers" ? (
          <RegistrationAcademyProfileList
            emptyMessage="No hay coreógrafos asociados a coreografías del programa cargado."
            items={choreographerNames.map((name) => ({
              detail: `${summary.choreographies.filter((dance) => dance.choreographers.some((choreographer) => choreographer.fullName === name)).length} coreografía(s)`,
              title: name,
            }))}
          />
        ) : null}

        {tab === "choreographies" ? (
          <RegistrationAcademyProfileList
            emptyMessage="No hay coreografías para esta academia en el programa cargado."
            items={summary.choreographies.map((dance) => ({
              detail: `${getVenueLabel(dance.venue)} · ${getOptionLabel(danceCategories, dance.category)} · ${getDanceLevelLabel(dance.level)}`,
              meta: `${dance.participants.length} participante(s) · ${dance.musicUpload ? "Música cargada" : "Música pendiente"}`,
              title: dance.title,
            }))}
          />
        ) : null}

        {tab === "payments" ? (
          <RegistrationAcademyProfileList
            emptyMessage="No hay pagos u órdenes para esta academia."
            items={summary.orders.map((order) => ({
              detail: `${getAdminOrderTypeLabel(order)} · ${formatAdminCurrency(order.amount, getRegistrationOrderCurrency(order))}`,
              meta: `${getAdminPaymentStatusLabel(order.status)} · ${getAdminDateLabel(order.updatedAt || order.createdAt)}`,
              title: getRegistrationInscriptionPaymentReference(order),
            }))}
          />
        ) : null}

        {tab === "tickets" ? (
          <RegistrationAcademyProfileList
            emptyMessage="No hay órdenes de boletos para esta academia."
            items={ticketOrders.map((order) => ({
              detail: `${getOrderRequestedTicketCount(order)} boleto(s) · ${getAdminPaymentStatusLabel(order.status)}`,
              meta: getRegistrationOrderBuyerLabel(order),
              title: getRegistrationInscriptionPaymentReference(order),
            }))}
          />
        ) : null}

        {tab === "media" ? (
          <RegistrationAcademyProfileList
            emptyMessage="No hay paquetes Foto/Video para esta academia."
            items={mediaOrders.map((order) => ({
              detail: `${getOrderMediaItemCount(order)} paquete(s) · ${getAdminPaymentStatusLabel(order.status)}`,
              meta: getOrderMediaConcept(order),
              title: getRegistrationInscriptionPaymentReference(order),
            }))}
          />
        ) : null}

        {tab === "activity" ? (
          <RegistrationAcademyProfileList
            emptyMessage="No hay actividad reciente para esta academia."
            items={activities.slice(0, 12).map((activity) => ({
              detail: activity.detail,
              meta: getDashboardActivityTimeLabel(activity.date),
              title: activity.title,
            }))}
          />
        ) : null}
      </div>
    </aside>
  );
}

function RegistrationAdminChoreographersPanel({
  choreographers,
  filteredChoreographers,
  isLoading,
  onQueryChange,
  query,
}: {
  choreographers: RegistrationAdminChoreographer[];
  filteredChoreographers: RegistrationAdminChoreographer[];
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  query: string;
}) {
  return (
    <>
      <section className="registration-admin-filters registration-admin-filters--choreographers" aria-label="Filtros de coreógrafos">
        <label className="registration-admin-search">
          <Search aria-hidden="true" size={17} />
          <input
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar por nombre, academia o talla..."
            type="search"
            value={query}
          />
        </label>
      </section>

      <section className="registration-admin-grid">
        <div className="registration-admin-table-card">
          <div className="registration-admin-table registration-admin-choreographers-table" role="table" aria-label="Coreógrafos registrados">
            <div className="registration-admin-table__head" role="row">
              <span role="columnheader">Nombre</span>
              <span role="columnheader">Academia</span>
              <span role="columnheader">Talla</span>
            </div>

            {filteredChoreographers.map((choreographer) => (
              <div className="registration-admin-table__row registration-admin-table__row--static" key={choreographer.id} role="row">
                <span role="cell">{choreographer.fullName}</span>
                <span role="cell">{choreographer.academyName}</span>
                <span role="cell">{getOptionLabel(shirtSizes, choreographer.shirtSize)}</span>
              </div>
            ))}

            {filteredChoreographers.length === 0 ? (
              <p className="registration-admin-empty">
                {isLoading ? "Cargando coreógrafos..." : "No hay coreógrafos registrados con esos filtros."}
              </p>
            ) : null}
          </div>
          <footer className="registration-admin-table-footer">
            <span>
              Mostrando {filteredChoreographers.length} de {choreographers.length} coreógrafos
            </span>
          </footer>
        </div>
      </section>
    </>
  );
}

function ParticipantRegistrationPanel({
  isAcademyInternational,
  registeredDanceCount,
  onParticipantCreated,
}: {
  isAcademyInternational: boolean;
  registeredDanceCount: number;
  onParticipantCreated: (participant: RegistrationParticipant) => void;
}) {
  const eventDate = venueEventDates.edomex;
  const isInternational = isAcademyInternational;
  const releveTeacherMinimumDances = 3;
  const canRegisterReleveTeacher = registeredDanceCount >= releveTeacherMinimumDances;
  const [curp, setCurp] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [ageValue, setAgeValue] = useState("");
  const [division, setDivision] = useState("baby");
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
  }, [isInternational]);

  const handleCurpChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextCurp = isInternational ? normalizeDocumentInput(event.target.value) : normalizeCurpInput(event.target.value);
    setCurp(nextCurp);
    setErrorMessage("");

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
      setErrorMessage("No pudimos leer la fecha de nacimiento. Revisa la CURP.");
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
        <AdminField icon={ClipboardList} label={documentFieldLabel}>
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
        <AdminField icon={CalendarDays} label="Fecha de nacimiento">
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
        <AdminField icon={BadgeCheck} label="Edad">
          <input aria-readonly="true" min={0} name="age" readOnly required type="number" value={ageValue} />
        </AdminField>
        <AdminField icon={GraduationCap} label="División">
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
  choreographers,
  participants,
  onDanceCreated,
}: {
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
          venue: getFormValue(formData, "venue"),
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
        <AdminField icon={MapPin} label="Sede de competencia">
          <AdminSelect defaultValue="edomex" id="dance-venue" name="venue" options={venueOptions} />
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
  const [selectedMusicDurationCheck, setSelectedMusicDurationCheck] = useState<ReturnType<typeof getMusicDurationCheck> | null>(null);
  const [fileInputVersion, setFileInputVersion] = useState(0);
  const [isCheckingMusicDuration, setIsCheckingMusicDuration] = useState(false);
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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = event.target.files?.[0] ?? null;

    setUploadError("");
    setUploadMessage("");
    setSelectedFile(null);
    setSelectedMusicDurationCheck(null);

    if (!file) {
      return;
    }

    if (!selectedDance) {
      input.value = "";
      setUploadError("Selecciona una coreografía antes de subir la música.");
      return;
    }

    if (file.size > maxMusicUploadBytes) {
      input.value = "";
      setUploadError("La canción debe pesar menos de 12 MB.");
      return;
    }

    if (!isMp3File(file)) {
      input.value = "";
      setUploadError("Solo se aceptan archivos en formato MP3.");
      return;
    }

    setIsCheckingMusicDuration(true);

    try {
      const durationSeconds = await readMusicDuration(file);
      const durationCheck = getMusicDurationCheck(selectedDance, durationSeconds);

      setSelectedMusicDurationCheck(durationCheck);

      if (durationCheck.status === "blocked") {
        input.value = "";
        setUploadError(durationCheck.message);
        return;
      }

      setSelectedFile(file);
    } catch (error) {
      input.value = "";
      setUploadError(error instanceof Error ? error.message : "No pudimos verificar la duración del archivo.");
    } finally {
      setIsCheckingMusicDuration(false);
    }
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

    if (!selectedMusicDurationCheck || selectedMusicDurationCheck.status === "blocked") {
      setUploadError("Selecciona un archivo MP3 con duración válida.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setUploadMessage("");

    try {
      const musicFile = await readMusicFileAsDataUrl(selectedFile);

      const response = await requestRegistrationApi<{ dance: RegistrationDance; musicUpload: RegistrationMusicUpload }>(
        "/api/registration/music",
        {
          body: JSON.stringify({
            danceId: selectedDance.id,
            durationSeconds: selectedMusicDurationCheck.durationSeconds,
            ...musicFile,
          }),
          method: "POST",
        },
      );

      onDanceUpdated(response.dance);
      setUploadMessage("Música subida para la coreografía seleccionada.");
      setSelectedFile(null);
      setSelectedMusicDurationCheck(null);
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
              setSelectedMusicDurationCheck(null);
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
            {isCheckingMusicDuration
              ? "Verificando duración del archivo..."
              : selectedFile
                ? `Archivo listo para subir · ${formatAdminFileSize(selectedFile.size)} · ${formatMusicDuration(selectedMusicDurationCheck?.durationSeconds ?? 0)}`
              : currentMusicUpload
                ? `Último archivo: ${currentMusicUpload.fileName} · ${formatAdminFileSize(currentMusicUpload.fileSize)}`
                : "Selecciona únicamente un archivo .mp3."}
          </span>
          <input
            key={fileInputVersion}
            accept=".mp3,audio/mpeg"
            disabled={!selectedDance || isUploading || isCheckingMusicDuration}
            onChange={handleFileChange}
            type="file"
          />
        </label>

        <button
          className="levitate-admin-save"
          disabled={!selectedDance || !selectedFile || isUploading || isCheckingMusicDuration || selectedMusicDurationCheck?.status === "blocked"}
          type="submit"
        >
          <Upload aria-hidden="true" size={18} />
          {isUploading ? "Subiendo música..." : "Subir música"}
        </button>

        {selectedMusicDurationCheck && selectedMusicDurationCheck.status !== "blocked" ? (
          <AdminStatusMessage
            message={selectedMusicDurationCheck.message}
            tone={selectedMusicDurationCheck.status === "warning" ? "warning" : "success"}
          />
        ) : null}
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

function AcademyInternationalPaymentsPanel({
  orders,
  participants,
  onOrderUpdated,
}: {
  orders: RegistrationInscriptionOrder[];
  participants: RegistrationParticipant[];
  onOrderUpdated: (order: RegistrationInscriptionOrder) => void;
}) {
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState(participants[0]?.id ?? "");
  const participantOptions = useMemo(
    () =>
      [...participants]
        .sort((left, right) => left.fullName.localeCompare(right.fullName, "es"))
        .map((participant) => ({
          value: participant.id,
          label: `${participant.fullName} · ${participant.curp}`,
        })),
    [participants],
  );
  const selectedParticipant = participants.find((participant) => participant.id === selectedParticipantId) ?? null;
  const selectedParticipantDocumentKey = selectedParticipant?.curp.trim().toUpperCase() ?? "";
  const registrationOrders = orders
    .filter(
      (order) =>
        getAdminOrderType(order) === "registration" &&
        Boolean(selectedParticipantDocumentKey) &&
        order.curp.trim().toUpperCase() === selectedParticipantDocumentKey,
    )
    .sort((left, right) => left.participantName.localeCompare(right.participantName, "es"));

  useEffect(() => {
    if (participants.length === 0) {
      setSelectedParticipantId("");
      return;
    }

    if (!participants.some((participant) => participant.id === selectedParticipantId)) {
      setSelectedParticipantId(participants[0]?.id ?? "");
    }
  }, [participants, selectedParticipantId]);

  const handleSyncOrder = async () => {
    if (!selectedParticipant) {
      setErrorMessage("Selecciona un participante para generar su orden.");
      return;
    }

    setIsSyncing(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await requestRegistrationApi<{ order: RegistrationInscriptionOrder | null }>(
        "/api/registration/inscription/order",
        {
          body: JSON.stringify({ curp: selectedParticipant.curp }),
          method: "POST",
        },
      );

      if (!response.order) {
        setStatusMessage(`No hay coreografías cobrables para ${selectedParticipant.fullName}.`);
        return;
      }

      onOrderUpdated(response.order);
      setStatusMessage(`Se generó la orden de pago para ${selectedParticipant.fullName}.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "No se pudo generar el pago."));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <AdminPanel className="levitate-admin-panel--international-payments" title="Pagos internacionales" eyebrow="Registro">
      <div className="levitate-admin-payment-toolbar">
        <AdminField icon={Users} label="Participante">
          <AdminSelect
            disabled={participantOptions.length === 0}
            id="international-payment-participant"
            name="participantId"
            onChange={(event) => {
              setSelectedParticipantId(event.target.value);
              setStatusMessage("");
              setErrorMessage("");
            }}
            options={participantOptions}
            value={selectedParticipantId}
          />
        </AdminField>
        <button className="levitate-admin-save" disabled={isSyncing || !selectedParticipant} onClick={handleSyncOrder} type="button">
          <CreditCard aria-hidden="true" size={18} />
          {isSyncing ? "Actualizando..." : "Generar / actualizar pago"}
        </button>
      </div>

      <AdminStatusMessage message={statusMessage} />
      <AdminStatusMessage message={errorMessage} tone="error" />

      <div className="levitate-admin-payment-list">
        {registrationOrders.length > 0 ? (
          registrationOrders.map((order) => (
            <AcademyInternationalPaymentCard key={order.id} order={order} />
          ))
        ) : (
          <p className="levitate-admin-empty-state">
            {participants.length === 0
              ? "Registra participantes para generar pagos."
              : "Genera el pago para ver la orden de este participante."}
          </p>
        )}
      </div>
    </AdminPanel>
  );
}

function AcademyInternationalPaymentCard({
  order,
}: {
  order: RegistrationInscriptionOrder;
}) {
  const currency = getRegistrationOrderCurrency(order);
  const lineItems = order.lineItems ?? [];

  return (
    <article className="levitate-admin-payment-card levitate-admin-payment-card--academy">
      <header>
        <div>
          <span>{getRegistrationInscriptionPaymentReference(order)}</span>
          <h3>{order.participantName}</h3>
          <p>
            {order.curp} · {getVenueLabel(order.venue)}
          </p>
        </div>
        <strong>{formatAdminCurrency(order.amount, currency)}</strong>
      </header>

      <dl>
        <div>
          <dt>Estado</dt>
          <dd>{getInscriptionOrderStatusLabel(order.status)}</dd>
        </div>
        <div>
          <dt>Moneda</dt>
          <dd>{currency}</dd>
        </div>
        <div>
          <dt>Pagado</dt>
          <dd>{formatAdminCurrency(order.paidAmount, currency)}</dd>
        </div>
      </dl>

      {lineItems.length > 0 ? (
        <div className="levitate-admin-payment-lines" aria-label="Coreografías incluidas">
          {lineItems.map((lineItem, index) => {
            const lineCurrency = lineItem.currency || currency;
            const baseAmount = lineItem.baseAmount ?? lineItem.amount;
            const hasDiscount = Boolean(lineItem.discountAmount);

            return (
              <div className="levitate-admin-payment-line" key={`${order.id}-${lineItem.id || index}`}>
                <span>{lineItem.pricingPosition ?? index + 1}</span>
                <div>
                  <strong>{getRegistrationLineTitle(lineItem)}</strong>
                  <small>{getRegistrationLineMeta(lineItem)}</small>
                  {lineItem.isCourtesy ? <em>Cortesía Levitate</em> : hasDiscount ? <em>Descuento aplicado</em> : null}
                </div>
                <b>
                  {hasDiscount ? <del>{formatAdminCurrency(baseAmount, lineCurrency)}</del> : null}
                  {lineItem.isCourtesy ? "Cortesía" : formatAdminCurrency(lineItem.amount, lineCurrency)}
                </b>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

function InscriptionOrdersPanel({
  emptyMessage = "Todavía no hay órdenes. Se crean cuando una familia consulta una CURP y presiona pagar inscripción.",
  orders,
}: {
  emptyMessage?: string;
  orders: RegistrationInscriptionOrder[];
}) {
  return (
    <AdminPanel title="Pagos de inscripción" eyebrow="Consulta">
      <div className="levitate-admin-payment-list">
        {orders.length > 0 ? (
          orders.map((order) => <InscriptionOrderCard key={order.id} order={order} />)
        ) : (
          <p className="levitate-admin-empty-state">{emptyMessage}</p>
        )}
      </div>
    </AdminPanel>
  );
}

function InscriptionOrderCard({
  order,
}: {
  order: RegistrationInscriptionOrder;
}) {
  const [errorMessage, setErrorMessage] = useState("");

  const handleOpenProof = () => {
    if (!order.proof) {
      return;
    }

    setErrorMessage("");
    void openPaymentProofPdfInNewWindow(order.proof, `Comprobante ${getRegistrationInscriptionPaymentReference(order)}`).catch((error) => {
      setErrorMessage(getErrorMessage(error, "No se pudo abrir el comprobante como PDF."));
    });
  };

  return (
    <article className="levitate-admin-payment-card">
      <header>
        <div>
          <span>{getRegistrationInscriptionPaymentReference(order)}</span>
          <h3>{order.participantName}</h3>
          <p>
            {order.curp} · {getVenueLabel(order.venue)}
          </p>
        </div>
        <strong>{formatAdminCurrency(order.amount, getRegistrationOrderCurrency(order))}</strong>
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
          <dd>{formatAdminCurrency(order.paidAmount, getRegistrationOrderCurrency(order))}</dd>
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
          <button onClick={handleOpenProof} type="button">
            Ver comprobante
          </button>
        </div>
      ) : null}

      <div className="levitate-admin-form__wide-block">
        <AdminStatusMessage message={errorMessage} tone="error" />
      </div>
    </article>
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
  const [adminAcademies, setAdminAcademies] = useState<RegistrationAdminAcademy[]>([]);
  const [adminChoreographers, setAdminChoreographers] = useState<RegistrationAdminChoreographer[]>([]);
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
  const [registrationPaymentStatusFilter, setRegistrationPaymentStatusFilter] = useState("all");
  const [choreographerQuery, setChoreographerQuery] = useState("");
  const [academyQuery, setAcademyQuery] = useState("");
  const [academyEventFilter, setAcademyEventFilter] = useState("all");
  const [academyStatusFilter, setAcademyStatusFilter] = useState("all");
  const [academySort, setAcademySort] = useState<RegistrationAcademyDirectorySort>("recent");
  const [ticketQuery, setTicketQuery] = useState("");
  const [ticketVenueFilter, setTicketVenueFilter] = useState("all");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all");
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaVenueFilter, setMediaVenueFilter] = useState("all");
  const [mediaStatusFilter, setMediaStatusFilter] = useState("all");
  const [dashboardDateRange, setDashboardDateRange] = useState<RegistrationDashboardDateRangeId>("season");
  const [dashboardCustomStartDate, setDashboardCustomStartDate] = useState(() => getDashboardDateInputValue(addDashboardDays(new Date(), -29)));
  const [dashboardCustomEndDate, setDashboardCustomEndDate] = useState(() => getDashboardDateInputValue(new Date()));
  const [dashboardVenueFilter, setDashboardVenueFilter] = useState("all");
  const [dashboardVenueMetric] = useState<RegistrationDashboardVenueMetric>("participants");
  const [adminLastUpdatedAt, setAdminLastUpdatedAt] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedAcademyId, setSelectedAcademyId] = useState("");
  const [academyProfileTab, setAcademyProfileTab] = useState<RegistrationAcademyProfileTab>("overview");
  const [adminAuthMessage, setAdminAuthMessage] = useState("");
  const [adminError, setAdminError] = useState("");
  const [isCheckingAdminSession, setIsCheckingAdminSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(false);
  const [isProgramLoading, setIsProgramLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const activeAdminNavItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth > 680 || !adminSession) {
      return;
    }

    const activeButton = activeAdminNavItemRef.current;
    const nav = activeButton?.parentElement;

    if (!activeButton || !nav) {
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const activeButtonRect = activeButton.getBoundingClientRect();

    nav.scrollTo({
      left:
        nav.scrollLeft +
        activeButtonRect.left -
        navRect.left -
        (navRect.width - activeButtonRect.width) / 2,
      behavior: "auto",
    });
  }, [activeSection, adminSession]);

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
      setAdminLastUpdatedAt(new Date().toISOString());
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
      setAdminAcademies(payload.academies ?? []);
      setAdminChoreographers(payload.choreographers ?? []);
      setAdminParticipants(payload.participants);
      setAdminLastUpdatedAt(new Date().toISOString());
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
      setAdminLastUpdatedAt(new Date().toISOString());
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
    if (adminSession?.user.role === "admin" && (activeSection === "program" || activeSection === "dashboard" || activeSection === "academies")) {
      void loadAdminProgram();
    }
  }, [activeSection, adminSession?.user.role, loadAdminProgram]);

  useEffect(() => {
    if (adminSession?.user.role === "admin" && (activeSection === "registrations" || activeSection === "dashboard" || activeSection === "academies" || activeSection === "choreographers")) {
      void loadAdminParticipants();
    }
  }, [activeSection, adminSession?.user.role, loadAdminParticipants]);

  useEffect(() => {
    if (typeof window === "undefined" || adminSession?.user.role !== "admin") {
      return;
    }

    if (activeSection === "choreographers") {
      const intervalId = window.setInterval(() => {
        void loadAdminParticipants();
      }, 60000);

      return () => window.clearInterval(intervalId);
    }

    if (activeSection !== "dashboard" && activeSection !== "academies") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadAdminOrders();
      void loadAdminParticipants();
      void loadAdminProgram();
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [activeSection, adminSession?.user.role, loadAdminOrders, loadAdminParticipants, loadAdminProgram]);

  useEffect(() => {
    if (!selectedOrderId && !selectedAcademyId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedOrderId("");
        setSelectedAcademyId("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAcademyId, selectedOrderId]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesVenue = venueFilter === "all" || order.venue === venueFilter;
      const matchesPurchaseType = purchaseTypeFilter === "all" || getAdminOrderType(order) === purchaseTypeFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          getRegistrationInscriptionPaymentReference(order),
          order.reference,
          order.curp,
          order.participantName,
          order.buyerName ?? "",
          order.buyerEmail ?? "",
          order.buyerPhone ?? "",
          order.academyName,
          order.venue,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesVenue && matchesPurchaseType && matchesQuery;
    });
  }, [orders, purchaseTypeFilter, query, statusFilter, venueFilter]);

  const visibleOrders = filteredOrders.slice(0, 10);
  const registrationAcademyOptions = useMemo(() => {
    const optionMap = new Map<string, string>();

    for (const academy of adminAcademies) {
      optionMap.set(academy.id, academy.name);
    }

    for (const participant of adminParticipants) {
      optionMap.set(participant.academyId, participant.academyName);
    }

    return Array.from(optionMap.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((left, right) => left.label.localeCompare(right.label, "es"));
  }, [adminAcademies, adminParticipants]);
  const filteredAdminAcademies = useMemo(() => {
    const normalizedQuery = registrationQuery.trim().toLowerCase();

    return adminAcademies.filter((academy) => {
      const matchesAcademy = registrationAcademyFilter === "all" || academy.id === registrationAcademyFilter;
      const matchesVenue = registrationVenueFilter === "all" || academy.eventVenues.includes(registrationVenueFilter);
      const matchesDivision =
        registrationDivisionFilter === "all" ||
        adminParticipants.some((participant) => participant.academyId === academy.id && participant.division === registrationDivisionFilter);
      const matchesQuery =
        !normalizedQuery ||
        [
          academy.name,
          academy.contactName,
          academy.email,
          academy.phone ?? "",
          academy.username ?? "",
          academy.userEmail ?? "",
          getAcademyOriginLabel(academy),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery) ||
        adminParticipants.some(
          (participant) =>
            participant.academyId === academy.id &&
            [participant.fullName, participant.curp].join(" ").toLowerCase().includes(normalizedQuery),
        );

      return matchesAcademy && matchesVenue && matchesDivision && matchesQuery;
    });
  }, [adminAcademies, adminParticipants, registrationAcademyFilter, registrationDivisionFilter, registrationQuery, registrationVenueFilter]);
  const filteredAdminParticipants = useMemo(() => {
    const normalizedQuery = registrationQuery.trim().toLowerCase();

    return adminParticipants.filter((participant) => {
      const paymentStatus = getParticipantPaymentStatus(participant, orders);
      const matchesAcademy = registrationAcademyFilter === "all" || participant.academyId === registrationAcademyFilter;
      const matchesVenue = registrationVenueFilter === "all" || participant.eventVenues.includes(registrationVenueFilter);
      const matchesDivision = registrationDivisionFilter === "all" || participant.division === registrationDivisionFilter;
      const matchesPaymentStatus =
        registrationPaymentStatusFilter === "all" ||
        paymentStatus === registrationPaymentStatusFilter ||
        (registrationPaymentStatusFilter === "requires_payment" && paymentStatus !== "paid");
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

      return matchesAcademy && matchesVenue && matchesDivision && matchesPaymentStatus && matchesQuery;
    });
  }, [adminParticipants, orders, registrationAcademyFilter, registrationDivisionFilter, registrationPaymentStatusFilter, registrationQuery, registrationVenueFilter]);
  const filteredAdminChoreographers = useMemo(() => {
    const normalizedQuery = normalizeDirectoryText(choreographerQuery);

    return adminChoreographers
      .filter((choreographer) => {
        if (!normalizedQuery) {
          return true;
        }

        return [
          choreographer.fullName,
          choreographer.academyName,
          getOptionLabel(shirtSizes, choreographer.shirtSize),
        ]
          .map(normalizeDirectoryText)
          .join(" ")
          .includes(normalizedQuery);
      })
      .sort((left, right) => left.academyName.localeCompare(right.academyName, "es") || left.fullName.localeCompare(right.fullName, "es"));
  }, [adminChoreographers, choreographerQuery]);
  const participantGroups = useMemo(() => getAdminParticipantGroups(filteredAdminParticipants), [filteredAdminParticipants]);
  const visibleRegistrationAcademyCount = Math.max(filteredAdminAcademies.length, participantGroups.length);
  const participantTotals = useMemo(
    () => getAdminParticipantTotals(filteredAdminParticipants, orders, visibleRegistrationAcademyCount),
    [filteredAdminParticipants, orders, visibleRegistrationAcademyCount],
  );
  const ticketRows = useMemo(() => getTicketDashboardRows(orders), [orders]);
  const filteredTicketRows = useMemo(() => {
    const normalizedQuery = ticketQuery.trim().toLowerCase();

    return ticketRows.filter((row) => {
      const matchesVenue = ticketVenueFilter === "all" || row.venue === ticketVenueFilter;
      const matchesStatus =
        ticketStatusFilter === "all" ||
        (ticketStatusFilter === "block-ready" && isTicketBlockReady(row)) ||
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
          order.buyerName ?? "",
          order.buyerEmail ?? "",
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
  const academySummaries = useMemo(
    () =>
      adminAcademies.map((academy) =>
        buildRegistrationAcademyDirectorySummary({
          academy,
          orders,
          participants: adminParticipants,
          programDances,
        }),
      ),
    [adminAcademies, adminParticipants, orders, programDances],
  );
  const filteredAcademySummaries = useMemo(() => {
    const normalizedQuery = normalizeDirectoryText(academyQuery);

    return academySummaries
      .filter((summary) => {
        const matchesQuery =
          !normalizedQuery ||
          [
            summary.academy.name,
            summary.academy.contactName,
            summary.academy.email,
            summary.academy.phone ?? "",
            summary.locationLabel,
            summary.locationDetail,
            summary.academy.username ?? "",
            summary.academy.userEmail ?? "",
          ]
            .map(normalizeDirectoryText)
            .join(" ")
            .includes(normalizedQuery);
        const matchesEvent = academyEventFilter === "all" || summary.academy.eventVenues.includes(academyEventFilter);
        const matchesStatus =
          academyStatusFilter === "all" ||
          summary.status === academyStatusFilter ||
          (academyStatusFilter === "with_registrations" && summary.registrationOrderCount > 0) ||
          (academyStatusFilter === "needs_attention" && summary.alerts.length > 0);

        return matchesQuery && matchesEvent && matchesStatus;
      })
      .sort((left, right) => {
        if (academySort === "name") {
          return left.academy.name.localeCompare(right.academy.name, "es");
        }

        if (academySort === "registrations") {
          return right.registrationOrderCount - left.registrationOrderCount || left.academy.name.localeCompare(right.academy.name, "es");
        }

        if (academySort === "participants") {
          return right.academy.participantCount - left.academy.participantCount || left.academy.name.localeCompare(right.academy.name, "es");
        }

        if (academySort === "pending") {
          return right.pendingOrderCount - left.pendingOrderCount || left.academy.name.localeCompare(right.academy.name, "es");
        }

        if (academySort === "alerts") {
          return right.alerts.length - left.alerts.length || left.academy.name.localeCompare(right.academy.name, "es");
        }

        return Date.parse(right.latestActivity.date) - Date.parse(left.latestActivity.date);
      });
  }, [academyEventFilter, academyQuery, academySort, academyStatusFilter, academySummaries]);
  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) || null : null;
  const selectedAcademySummary = selectedAcademyId ? academySummaries.find((summary) => summary.academy.id === selectedAcademyId) || null : null;
  const dashboardDateWindow = useMemo(
    () => getDashboardDateWindow(dashboardDateRange, dashboardCustomStartDate, dashboardCustomEndDate),
    [dashboardCustomEndDate, dashboardCustomStartDate, dashboardDateRange],
  );
  const isDashboardSection = activeSection === "dashboard";
  const isAcademiesSection = activeSection === "academies";
  const isChoreographersSection = activeSection === "choreographers";
  const isTicketSection = activeSection === "tickets";
  const isProgramSection = activeSection === "program";
  const isMediaSection = activeSection === "media";
  const isRegistrationsSection = activeSection === "registrations";
  const adminNavBadges = useMemo(() => {
    const ticketRowsForBadges = getTicketDashboardRows(orders);
    const ticketTotalsForBadges = getTicketDashboardTotals(ticketRowsForBadges);
    const mediaOrdersForBadges = orders.filter((order) => getAdminOrderType(order) === "shop" && getOrderMediaLineItems(order).length > 0);

    return {
      media: mediaOrdersForBadges.filter((order) => order.status === "pending_payment" || order.status === "payment_reported").length,
      payments: orders.filter((order) => order.status === "payment_reported").length,
      program: programDances.filter((dance) => !dance.musicUpload || dance.participants.length === 0).length,
      tickets: ticketTotalsForBadges.pendingTickets + ticketTotalsForBadges.rejectedTickets,
    };
  }, [orders, programDances]);

  const handleOrderUpdated = (order: RegistrationInscriptionOrder) => {
    setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
    setSelectedOrderId(order.id);
    void loadAdminOrders();
  };

  const updateAdminSectionPath = (section: RegistrationAdminDashboardSection) => {
    if (typeof window !== "undefined") {
      let nextPath = "/admin/inscripciones";

      if (section === "dashboard") {
        nextPath = "/admin/dashboard";
      } else if (section === "academies") {
        nextPath = "/admin/academias";
      } else if (section === "choreographers") {
        nextPath = "/admin/coreografos";
      } else if (section === "tickets") {
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

  const handleSectionChange = (section: RegistrationAdminDashboardSection) => {
    setActiveSection(section);
    setSelectedOrderId("");
    setSelectedAcademyId("");
    updateAdminSectionPath(section);
  };

  const handleDashboardNavigate = (target: RegistrationDashboardTarget) => {
    setActiveSection(target.section);
    setSelectedOrderId(target.orderId ?? "");
    setSelectedAcademyId("");
    updateAdminSectionPath(target.section);

    if (target.section === "payments") {
      setQuery(target.query ?? "");
      setStatusFilter(target.statusFilter ?? "all");
      setVenueFilter(target.venueFilter ?? "all");
      setPurchaseTypeFilter(target.purchaseTypeFilter ?? "all");
    } else if (target.section === "tickets") {
      setTicketQuery(target.query ?? "");
      setTicketStatusFilter(target.ticketStatusFilter ?? "all");
      setTicketVenueFilter(target.venueFilter ?? "all");
    } else if (target.section === "media") {
      setMediaQuery(target.query ?? "");
      setMediaStatusFilter(target.mediaStatusFilter ?? "all");
      setMediaVenueFilter(target.venueFilter ?? "all");
    } else if (target.section === "registrations") {
      setRegistrationQuery(target.query ?? "");
      setRegistrationVenueFilter(target.venueFilter ?? "all");
      setRegistrationPaymentStatusFilter(target.registrationPaymentStatusFilter ?? "all");
      setRegistrationAcademyFilter("all");
      setRegistrationDivisionFilter("all");
    } else if (target.section === "academies") {
      setAcademyQuery(target.query ?? "");
      setAcademyEventFilter(target.venueFilter ?? "all");
      setAcademyStatusFilter("all");
    }
  };

  const handleOpenAcademyProfile = (academyId: string, tab: RegistrationAcademyProfileTab = "overview") => {
    setSelectedAcademyId(academyId);
    setAcademyProfileTab(tab);
  };

  const handleNewAcademy = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/registro/academias";
    }
  };

  const handleDashboardRefresh = () => {
    void loadAdminOrders();
    void loadAdminParticipants();
    void loadAdminProgram();
  };

  const handleAdminLogout = async () => {
    setIsLoggingOut(true);
    setAdminError("");

    try {
      await requestRegistrationApi<{ ok: boolean }>("/api/registration/auth/logout", { method: "POST" });
      setAdminSession(null);
      setAdminAcademies([]);
      setAdminChoreographers([]);
      setOrders([]);
      setAdminParticipants([]);
      setProgramDances([]);
      setTotals(null);
      setSelectedOrderId("");
      window.location.replace("/login");
    } catch (error) {
      setAdminError(getErrorMessage(error, "No se pudo cerrar la sesión."));
      setIsLoggingOut(false);
    }
  };

  let headerTitle = "Pagos";
  let headerDescription = "Revisión y confirmación de comprobantes";

  if (isDashboardSection) {
    headerTitle = "Panel general";
    headerDescription = "Control operativo del periodo seleccionado";
  } else if (isAcademiesSection) {
    headerTitle = "Academias";
    headerDescription = "Gestiona todas las academias registradas en la competencia";
  } else if (isChoreographersSection) {
    headerTitle = "Coreógrafos";
    headerDescription = "Coreógrafos registrados por academia";
  } else if (isTicketSection) {
    headerTitle = "Boletos";
    headerDescription = "Boletos confirmados por alumno y quiénes ya llegan a 3+ para bloque de competencia";
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
          {Array.from(new Set(registrationAdminDashboardNavItems.map((item) => item.group))).map((group) => (
            <div className="registration-admin-nav-group" key={group}>
              <span>{group}</span>
              {registrationAdminDashboardNavItems
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = item.section === activeSection;
                  const badgeCount = item.badgeKey ? adminNavBadges[item.badgeKey] : 0;

                  return (
                    <button
                      aria-current={isActive ? "page" : undefined}
                      className={isActive ? "is-active" : ""}
                      disabled={!item.section}
                      key={item.label}
                      onClick={() => {
                        if (item.section) {
                          handleSectionChange(item.section);
                        }
                      }}
                      ref={isActive ? activeAdminNavItemRef : undefined}
                      type="button"
                    >
                      <Icon aria-hidden="true" size={17} />
                      <span>{item.label}</span>
                      {badgeCount > 0 ? <em>{badgeCount}</em> : null}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="registration-admin-sidebar__footer">
          <button
            aria-label={isLoggingOut ? "Cerrando sesión" : "Cerrar sesión"}
            className="registration-admin-logout"
            disabled={isLoggingOut}
            onClick={handleAdminLogout}
            type="button"
          >
            <LogOut aria-hidden="true" size={17} />
            <span>{isLoggingOut ? "Cerrando..." : "Cerrar sesión"}</span>
          </button>
          <button className="registration-admin-collapse" type="button" aria-label="Contraer menú">
            <ArrowLeft aria-hidden="true" size={18} />
          </button>
        </div>
      </aside>

      <section className={`registration-admin-workspace${isDashboardSection || isAcademiesSection ? " registration-admin-workspace--dashboard" : ""}`}>
        {!isDashboardSection ? (
          <header className="registration-admin-header">
            <div>
              <h1>{headerTitle}</h1>
              <p>{headerDescription}</p>
            </div>
            {!isProgramSection ? (
              <div className="registration-admin-header__actions">
                {isAcademiesSection ? (
                  <button className="registration-admin-new-action" onClick={handleNewAcademy} type="button">
                    <Plus aria-hidden="true" size={16} />
                    Nueva academia
                  </button>
                ) : null}
                <button
                  className="registration-admin-export"
                  disabled={
                    isAcademiesSection
                      ? filteredAcademySummaries.length === 0
                      : isChoreographersSection
                        ? filteredAdminChoreographers.length === 0
                        : isTicketSection
                          ? filteredTicketRows.length === 0
                          : isMediaSection
                            ? filteredMediaOrders.length === 0
                            : isRegistrationsSection
                              ? filteredAdminAcademies.length === 0 && filteredAdminParticipants.length === 0
                              : filteredOrders.length === 0
                  }
                  onClick={() => {
                    if (isAcademiesSection) {
                      downloadRegistrationAcademiesDirectoryCsv(filteredAcademySummaries);
                      return;
                    }

                    if (isChoreographersSection) {
                      downloadAdminChoreographersCsv(filteredAdminChoreographers);
                      return;
                    }

                    if (isTicketSection) {
                      downloadTicketDashboardCsv(filteredTicketRows);
                      return;
                    }

                    if (isMediaSection) {
                      downloadMediaOrdersCsv(filteredMediaOrders);
                      return;
                    }

                    if (isRegistrationsSection) {
                      downloadAdminParticipantsCsv(filteredAdminAcademies, filteredAdminParticipants, orders);
                      return;
                    }

                    downloadRegistrationOrdersCsv(filteredOrders);
                  }}
                  type="button"
                >
                  <Download aria-hidden="true" size={16} />
                  Exportar
                </button>
              </div>
            ) : null}
          </header>
        ) : null}

        {adminError ? <p className="registration-admin-alert">{adminError}</p> : null}

        {isDashboardSection ? (
          <RegistrationAdminDashboardOverview
            customEndDate={dashboardCustomEndDate}
            customStartDate={dashboardCustomStartDate}
            dateRange={dashboardDateRange}
            dateWindow={dashboardDateWindow}
            isLoading={isLoading}
            isParticipantsLoading={isParticipantsLoading}
            isProgramLoading={isProgramLoading}
            lastUpdatedAt={adminLastUpdatedAt}
            onCustomEndDateChange={setDashboardCustomEndDate}
            onCustomStartDateChange={setDashboardCustomStartDate}
            onDateRangeChange={setDashboardDateRange}
            onNavigate={handleDashboardNavigate}
            onRefresh={handleDashboardRefresh}
            onVenueFilterChange={setDashboardVenueFilter}
            orders={orders}
            participants={adminParticipants}
            programDances={programDances}
            userName={adminSession.user.name}
            venueFilter={dashboardVenueFilter}
            venueMetric={dashboardVenueMetric}
          />
        ) : isAcademiesSection ? (
          <RegistrationAcademiesDirectoryPanel
            eventFilter={academyEventFilter}
            filteredSummaries={filteredAcademySummaries}
            isLoading={isParticipantsLoading || isProgramLoading || isLoading}
            onEventFilterChange={setAcademyEventFilter}
            onMetricNavigate={handleDashboardNavigate}
            onNewAcademy={handleNewAcademy}
            onOpenAcademy={handleOpenAcademyProfile}
            onQueryChange={setAcademyQuery}
            onSortChange={setAcademySort}
            onStatusFilterChange={setAcademyStatusFilter}
            query={academyQuery}
            sort={academySort}
            statusFilter={academyStatusFilter}
            summaries={academySummaries}
          />
        ) : isChoreographersSection ? (
          <RegistrationAdminChoreographersPanel
            choreographers={adminChoreographers}
            filteredChoreographers={filteredAdminChoreographers}
            isLoading={isParticipantsLoading}
            onQueryChange={setChoreographerQuery}
            query={choreographerQuery}
          />
        ) : isProgramSection ? (
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
              <label>
                <span>Pago</span>
                <select onChange={(event) => setRegistrationPaymentStatusFilter(event.target.value)} value={registrationPaymentStatusFilter}>
                  <option value="all">Todos</option>
                  <option value="paid">Pagados</option>
                  <option value="payment_reported">Por confirmar</option>
                  <option value="pending_payment">Pendiente de pago</option>
                  <option value="rejected">Rechazados</option>
                  <option value="no_order">Sin orden</option>
                  <option value="requires_payment">Requieren acción</option>
                </select>
                <ChevronDown aria-hidden="true" size={16} />
              </label>
            </section>

            <section className="registration-admin-grid">
              <div className="registration-admin-table-card registration-admin-academies-card">
                <div className="registration-admin-table registration-admin-academies-table" role="table" aria-label="Academias registradas">
                  <div className="registration-admin-table__head" role="row">
                    <span role="columnheader">Academia</span>
                    <span role="columnheader">Contacto</span>
                    <span role="columnheader">Usuario</span>
                    <span role="columnheader">Origen</span>
                    <span role="columnheader">Registro</span>
                    <span role="columnheader">Participantes</span>
                    <span role="columnheader">Coreógrafos</span>
                    <span role="columnheader">Coreografías</span>
                    <span role="columnheader">Órdenes</span>
                  </div>

                  {filteredAdminAcademies.map((academy) => {
                    const orderCount = academy.inscriptionOrderCount + academy.shopOrderCount;
                    const movementCount = getAdminAcademyMovementCount(academy);

                    return (
                      <div className="registration-admin-table__row registration-admin-table__row--static" key={academy.id} role="row">
                        <span role="cell">
                          {academy.name}
                          <small>{movementCount === 0 ? "Sin movimientos todavía" : `${movementCount} movimiento(s)`}</small>
                        </span>
                        <span role="cell">
                          {academy.contactName}
                          <small>{[academy.email, academy.phone].filter(Boolean).join(" · ") || "Sin contacto"}</small>
                        </span>
                        <span role="cell">
                          {academy.username ?? academy.userEmail ?? "Sin usuario"}
                          <small>{academy.userStatus === "active" ? "Activo" : academy.userStatus || "Sin estado"}</small>
                        </span>
                        <span role="cell">{getAcademyOriginLabel(academy)}</span>
                        <span role="cell">{getAdminDateLabel(academy.createdAt)}</span>
                        <span role="cell">{academy.participantCount}</span>
                        <span role="cell">{academy.choreographerCount}</span>
                        <span role="cell">{academy.danceCount}</span>
                        <span role="cell">{orderCount}</span>
                      </div>
                    );
                  })}

                  {filteredAdminAcademies.length === 0 ? (
                    <p className="registration-admin-empty">{isParticipantsLoading ? "Cargando academias..." : "No hay academias registradas con esos filtros."}</p>
                  ) : null}
                </div>
                <footer className="registration-admin-table-footer">
                  <span>
                    Mostrando {filteredAdminAcademies.length} de {adminAcademies.length} academias registradas
                  </span>
                </footer>
              </div>

              <div className="registration-admin-table-card registration-admin-participants-card">
                {participantGroups.map((group) => (
                  <section className="registration-admin-participant-group" key={group.key}>
                    <header>
                      <div>
                        <strong>{group.academyName}</strong>
                        <span>
                          {group.originLabel} · {group.venues.length > 0 ? group.venues.map(getVenueLabel).join(" / ") : "Sin coreografías"} ·{" "}
                          {group.participants.length} participante(s)
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
                      {visibleRegistrationAcademyCount} academia(s)
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
                <span>Alumnos con boleto</span>
                <strong>{ticketTotals.childCount}</strong>
                <Users aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Boletos pedidos</span>
                <strong>{ticketTotals.requestedTickets}</strong>
                <Ticket aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Confirmados</span>
                <strong>{ticketTotals.paidTickets}</strong>
                <CheckCircle2 aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Pendientes</span>
                <strong>{ticketTotals.pendingTickets}</strong>
                <Clock aria-hidden="true" size={24} />
              </article>
              <article>
                <span>Listos para bloque</span>
                <strong>{ticketTotals.blockReadyChildren}</strong>
                <BadgeCheck aria-hidden="true" size={24} />
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
                  <option value="block-ready">Listos para bloque</option>
                  <option value="paid">Con confirmados</option>
                  <option value="pending">Con pendientes</option>
                  <option value="rejected">Con rechazados</option>
                  <option value="used">Con QR usados</option>
                </select>
                <ChevronDown aria-hidden="true" size={16} />
              </label>
            </section>

            <section className="registration-admin-grid">
              <div className="registration-admin-table-card">
                <div className="registration-admin-table registration-admin-ticket-table" role="table" aria-label="Boletos comprados por alumno">
                  <div className="registration-admin-table__head" role="row">
                    <span role="columnheader">Alumno</span>
                    <span role="columnheader">CURP</span>
                    <span role="columnheader">Academia</span>
                    <span role="columnheader">Sede</span>
                    <span role="columnheader">Pedidos</span>
                    <span role="columnheader">Confirmados</span>
                    <span role="columnheader">QR activos</span>
                    <span role="columnheader">Pendientes</span>
                    <span role="columnheader">Rechazados</span>
                    <span role="columnheader">Última orden</span>
                  </div>

                  {visibleTicketRows.map((row) => {
                    const date = getAdminOrderDate({ createdAt: row.updatedAt, updatedAt: row.updatedAt } as RegistrationInscriptionOrder);
                    const isBlockReady = isTicketBlockReady(row);

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
                          <small
                            className={`registration-admin-ticket-readiness${
                              isBlockReady ? " registration-admin-ticket-readiness--ready" : ""
                            }`}
                          >
                            {isBlockReady ? "Listo para bloque" : `Faltan ${getTicketBlockMissingCount(row)}`}
                          </small>
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
                    Mostrando {visibleTicketRows.length > 0 ? 1 : 0} a {visibleTicketRows.length} de {filteredTicketRows.length} alumnos
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
                          {getRegistrationOrderBuyerLabel(order)}
                          <small>{getRegistrationOrderBuyerMeta(order)}</small>
                        </span>
                        <span role="cell">{order.participantName}</span>
                        <span role="cell">{order.academyName}</span>
                        <span role="cell">
                          {getOrderMediaConcept(order)}
                          <small>{getOrderMediaItemCount(order)} paquete(s)</small>
                        </span>
                        <span role="cell">{formatAdminCurrency(order.amount, getRegistrationOrderCurrency(order))}</span>
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
                        <span role="cell">
                          {getRegistrationOrderBuyerLabel(order)}
                          <small>{getRegistrationOrderBuyerMeta(order)}</small>
                        </span>
                        <span role="cell">{order.participantName}</span>
                        <span role="cell">{order.academyName}</span>
                        <span role="cell">{getInscriptionOrderConcept(order)}</span>
                        <span role="cell">{formatAdminCurrency(order.amount, getRegistrationOrderCurrency(order))}</span>
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

      {selectedAcademySummary ? (
        <div
          className="registration-admin-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={`Perfil de academia ${selectedAcademySummary.academy.name}`}
        >
          <button className="registration-admin-drawer__backdrop" onClick={() => setSelectedAcademyId("")} type="button" aria-label="Cerrar perfil" />
          <aside className="registration-admin-sidepanel registration-admin-sidepanel--academy">
            <RegistrationAcademyQuickPanel
              onClose={() => setSelectedAcademyId("")}
              onNavigate={handleDashboardNavigate}
              onTabChange={setAcademyProfileTab}
              summary={selectedAcademySummary}
              tab={academyProfileTab}
            />
          </aside>
        </div>
      ) : null}

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
  const [isRejectionOpen, setIsRejectionOpen] = useState(order?.status === "rejected");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTicketPdfLoading, setIsTicketPdfLoading] = useState(false);

  useEffect(() => {
    const nextRejectionReason = order?.rejectionReason ?? (order ? getDefaultPaymentRejectionReason(order) : "missing_proof");

    setNotes(order?.notes ?? "");
    setRejectionReason(nextRejectionReason);
    setIsRejectionOpen(order?.status === "rejected");
    setStatusMessage("");
    setErrorMessage("");
    setIsTicketPdfLoading(false);
  }, [order]);

  const handleOpenProof = () => {
    if (!order?.proof) {
      return;
    }

    setErrorMessage("");
    void openPaymentProofPdfInNewWindow(order.proof, `Comprobante ${getRegistrationInscriptionPaymentReference(order)}`).catch((error) => {
      setErrorMessage(getErrorMessage(error, "No se pudo abrir el comprobante como PDF."));
    });
  };

  const updateOrder = async (
    status: RegistrationInscriptionOrderStatus,
    paidAmount = order?.paidAmount ?? 0,
    review?: {
      rejectionMessage?: string;
      rejectionReason?: RegistrationPaymentRejectionReason;
    },
  ) => {
    if (!order) {
      return null;
    }

    if (status === "rejected" && !review?.rejectionMessage?.trim()) {
      setErrorMessage("Escribe qué debe corregir la familia para aprobar el pago.");
      return null;
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
      return response.order;
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "No se pudo actualizar la orden."));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectionReasonChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextReason = event.target.value as RegistrationPaymentRejectionReason;
    setRejectionReason(nextReason);
  };

  const openPendingWhatsAppWindow = () => {
    if (!whatsappPhone || typeof window === "undefined") {
      return null;
    }

    const pendingWindow = window.open("about:blank", "_blank");

    if (pendingWindow) {
      pendingWindow.document.title = "Abriendo WhatsApp";
      pendingWindow.document.body.style.fontFamily = "Arial, sans-serif";
      pendingWindow.document.body.style.padding = "24px";
      pendingWindow.document.body.textContent = "Preparando WhatsApp...";
    }

    return pendingWindow;
  };

  const openWhatsAppForOrder = (updatedOrder: RegistrationInscriptionOrder, message: string, pendingWindow: Window | null) => {
    const phone = getRegistrationOrderWhatsAppPhone(updatedOrder);

    if (!phone) {
      pendingWindow?.close();
      setErrorMessage("La orden se actualizó, pero no tiene WhatsApp cargado.");
      return false;
    }

    const href = buildWhatsAppUrl(phone, message);

    if (pendingWindow && !pendingWindow.closed) {
      pendingWindow.opener = null;
      pendingWindow.location.href = href;
    } else if (typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
    }

    return true;
  };

  const handleApprovePayment = async () => {
    if (!order) {
      return;
    }

    const pendingWindow = openPendingWhatsAppWindow();
    const updatedOrder = await updateOrder("paid", order.amount);

    if (!updatedOrder) {
      pendingWindow?.close();
      return;
    }

    const didOpenWhatsApp = openWhatsAppForOrder(updatedOrder, buildPaymentApprovalWhatsAppMessage(updatedOrder), pendingWindow);

    if (didOpenWhatsApp) {
      setIsRejectionOpen(false);
      setStatusMessage("Pago aprobado. Se abrió WhatsApp con la confirmación.");
    }
  };

  const handleRejectToggle = () => {
    setIsRejectionOpen((currentValue) => !currentValue);
    setStatusMessage("");
    setErrorMessage("");
  };

  const handleRejectPayment = async () => {
    if (!order) {
      return;
    }

    const nextRejectionMessage = buildPaymentRejectionMessage(order, rejectionReason);
    const pendingWindow = openPendingWhatsAppWindow();
    const updatedOrder = await updateOrder("rejected", order.paidAmount, {
      rejectionMessage: nextRejectionMessage,
      rejectionReason,
    });

    if (!updatedOrder) {
      pendingWindow?.close();
      return;
    }

    const didOpenWhatsApp = openWhatsAppForOrder(
      updatedOrder,
      buildPaymentCorrectionWhatsAppMessage(updatedOrder, nextRejectionMessage),
      pendingWindow,
    );

    if (didOpenWhatsApp) {
      setStatusMessage("Pago rechazado. Se abrió WhatsApp con el motivo.");
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
          <dd>{formatAdminCurrency(order.amount, getRegistrationOrderCurrency(order))}</dd>
        </div>
        <div>
          <dt>Monto reportado</dt>
          <dd>{order.paidAmount > 0 ? formatAdminCurrency(order.paidAmount, getRegistrationOrderCurrency(order)) : "Sin reportar"}</dd>
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
            <div className="registration-admin-proof-preview__actions">
              <button onClick={handleOpenProof} type="button">
                Ver comprobante
              </button>
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

      <div className="registration-admin-detail-actions">
        <button disabled={isSaving} onClick={handleApprovePayment} type="button">
          Aprobar pago
        </button>
        <button aria-expanded={isRejectionOpen} disabled={isSaving} onClick={handleRejectToggle} type="button">
          Rechazar
        </button>
      </div>

      {isRejectionOpen ? (
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
          <button className="registration-admin-review-panel__submit" disabled={isSaving} onClick={handleRejectPayment} type="button">
            <MessageCircle aria-hidden="true" size={17} />
            Enviar rechazo por WhatsApp
          </button>
        </section>
      ) : null}

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
  isInternationalAcademy,
}: {
  participants: RegistrationParticipant[];
  choreographers: RegistrationChoreographer[];
  dances: RegistrationDance[];
  inscriptionOrders: RegistrationInscriptionOrder[];
  isInternationalAcademy: boolean;
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
            className={`levitate-admin-lookup-table levitate-admin-lookup-table--participants${
              isInternationalAcademy ? " levitate-admin-lookup-table--participants-international" : ""
            }`}
            role="table"
            aria-label="Participantes registrados"
          >
            <span role="columnheader">Participante</span>
            <span role="columnheader">CURP / Documento</span>
            <span role="columnheader">División</span>
            <span role="columnheader">Edad</span>
            <span role="columnheader">Maestro Relevé</span>
            {!isInternationalAcademy ? <span role="columnheader">Pago</span> : null}
            {participants.map((participant) => {
              const isPaid = !isInternationalAcademy && isParticipantInscriptionPaid(participant, inscriptionOrders);
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
                  {!isInternationalAcademy ? (
                    <span className={`levitate-admin-payment-badge${isPaid ? " is-paid" : ""}`} role="cell">
                      {isPaid ? "Pagado" : "Falta pagar"}
                    </span>
                  ) : null}
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
            <span role="columnheader">Sede</span>
            <span role="columnheader">Género</span>
            <span role="columnheader">Categoría</span>
            <span role="columnheader">División</span>
            <span role="columnheader">Nivel</span>
            <span role="columnheader">Participantes</span>
            {dances.map((dance) => {
              const categoryOptions = danceCategoriesByGenre[dance.genre] ?? danceCategories;
              const subgenreOptions = danceSubgenresByGenre[dance.genre] ?? [];
              const divisionLabel = getProgramDivisionLabel(getDanceProgramDivision(dance));
              const compactDivisionLabel = divisionLabel.split(":")[0] || "Sin división";
              const participantNames = dance.participants.map((participant) => participant.fullName).join(", ");

              return (
                <div className="levitate-admin-lookup-table__row" role="row" key={dance.id}>
                  <span role="cell">{dance.title}</span>
                  <span role="cell">{getVenueLabel(dance.venue)}</span>
                  <span role="cell">{getOptionLabel(subgenreOptions, dance.subgenre)}</span>
                  <span role="cell">{getOptionLabel(categoryOptions, dance.category)}</span>
                  <span role="cell" title={divisionLabel}>{compactDivisionLabel}</span>
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
  isInternationalAcademy,
}: {
  academyName: string;
  participants: RegistrationParticipant[];
  choreographers: RegistrationChoreographer[];
  dances: RegistrationDance[];
  inscriptionOrders: RegistrationInscriptionOrder[];
  isInternationalAcademy: boolean;
}) {
  return (
    <section className="levitate-admin-home">
      <div className="levitate-admin-home__intro">
        <h1>¡Hola, {academyName}!</h1>
      </div>

      <AdminLookupPanel
        choreographers={choreographers}
        dances={dances}
        inscriptionOrders={inscriptionOrders}
        isInternationalAcademy={isInternationalAcademy}
        participants={participants}
      />
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
        isAcademyInternational={session.academy.originType === "international"}
        onParticipantCreated={onParticipantCreated}
        registeredDanceCount={dances.length}
      />
    );
  }

  if (screen === "dance") {
    return (
      <DanceRegistrationPanel
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
    if (session.academy.originType === "international") {
      return (
        <AcademyInternationalPaymentsPanel
          onOrderUpdated={onOrderUpdated}
          orders={inscriptionOrders}
          participants={participants}
        />
      );
    }

    return (
      <AdminWelcomePanel
        academyName={session.academy.name}
        choreographers={choreographers}
        dances={dances}
        inscriptionOrders={inscriptionOrders}
        isInternationalAcademy={false}
        participants={participants}
      />
    );
  }

  return (
    <AdminWelcomePanel
      academyName={session.academy.name}
      choreographers={choreographers}
      dances={dances}
      inscriptionOrders={inscriptionOrders}
      isInternationalAcademy={session.academy.originType === "international"}
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

    try {
      const currentSession = await requestRegistrationApi<RegistrationSession>("/api/registration/me");

      if (redirectRegistrationAdmin(currentSession)) {
        return;
      }

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
    if (redirectRegistrationAdmin(nextSession)) {
      return;
    }

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
      <AdminSidebar
        activeScreen={activeScreen}
        isInternationalAcademy={session.academy.originType === "international"}
        onLogout={handleLogout}
        onScreenChange={handleScreenChange}
      />
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
  const handleAuthenticated = (session: RegistrationSession | RegistrationBootstrap) => {
    if (typeof window !== "undefined") {
      window.location.replace(session.user.role === "admin" ? "/admin/inscripciones" : "/registro/academias");
    }
  };

  return <LevitateAuthScreen onAuthenticated={handleAuthenticated} />;
}

export function LevitateParticipantRegistrationScreen() {
  return (
    <RegistrationPageScaffold>
      <ParticipantRegistrationPanel isAcademyInternational={false} onParticipantCreated={() => undefined} registeredDanceCount={0} />
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
