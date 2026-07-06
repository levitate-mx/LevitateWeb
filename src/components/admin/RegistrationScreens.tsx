import {
  AtSign,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Home,
  KeyRound,
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
  UserPlus,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
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

type RegistrationPaymentProof = {
  id: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  dataUrl: string;
  status: string;
  uploadedAt: string;
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
  notes?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  proof?: RegistrationPaymentProof | null;
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
  { value: "payment_reported", label: "Pago reportado" },
  { value: "paid", label: "Pagada" },
  { value: "rejected", label: "Rechazada" },
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
const registrationAdminTokenStorageKey = "levitate-registration-admin-token";
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isUnauthorizedRegistrationError(error: unknown) {
  return error instanceof RegistrationApiError && error.status === 401;
}

function LevitateAdminLogo() {
  return (
    <div className="levitate-admin-logo" aria-label="Levitate MX">
      <span>Levitate</span>
      <small>MX</small>
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

function AdminTopBrand() {
  return (
    <header className="levitate-admin-topbar">
      <LevitateAdminLogo />
      <AdminSocials />
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
      <AdminTopBrand />
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
      <AdminTopBrand />
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
          venue: getFormValue(formData, "venue"),
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
      <AdminTopBrand />
      <div className="levitate-admin-rule" aria-hidden="true" />

      <section className="levitate-auth-shell">
        <div className="levitate-auth-copy">
          <p>Panel de academias</p>
          <h1>Acceso Levitate</h1>
          <span aria-hidden="true" />
          <div>
            <ShieldCheck aria-hidden="true" size={22} />
            <strong>Gestión privada para registrar participantes, coreógrafos y bailes.</strong>
          </div>
        </div>

        <section className="levitate-auth-card" aria-label="Acceso de usuario">
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
            <form className="levitate-auth-form" onSubmit={handleLoginSubmit}>
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
            <form className="levitate-auth-form" onSubmit={handleRegisterSubmit}>
              <AdminStatusMessage message={systemMessage} tone="error" />
              <AdminField icon={Users} label="Nombre">
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
              <AdminField icon={Building2} label="Academia">
                <input name="academy" required type="text" />
              </AdminField>
              <AdminField icon={Phone} label="Teléfono">
                <input autoComplete="tel" name="phone" type="tel" />
              </AdminField>
              <AdminField icon={CalendarDays} label="Sede">
                <AdminSelect defaultValue="cdmx" id="auth-venue" name="venue" options={venueOptions} />
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
      <AdminTopBrand />
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
  adminToken,
  emptyMessage = "Todavía no hay órdenes. Se crean cuando una familia consulta una CURP y presiona pagar inscripción.",
  orders,
  onOrderUpdated,
}: {
  adminToken?: string;
  emptyMessage?: string;
  orders: RegistrationInscriptionOrder[];
  onOrderUpdated: (order: RegistrationInscriptionOrder) => void;
}) {
  return (
    <AdminPanel title="Pagos de inscripción" eyebrow="Control">
      <div className="levitate-admin-payment-list">
        {orders.length > 0 ? (
          orders.map((order) => <InscriptionOrderCard adminToken={adminToken} key={order.id} onOrderUpdated={onOrderUpdated} order={order} />)
        ) : (
          <p className="levitate-admin-empty-state">{emptyMessage}</p>
        )}
      </div>
    </AdminPanel>
  );
}

function InscriptionOrderCard({
  adminToken,
  order,
  onOrderUpdated,
}: {
  adminToken?: string;
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

      const isCentralAdmin = adminToken !== undefined;
      const response = await requestRegistrationApi<{ order: RegistrationInscriptionOrder }>(
        isCentralAdmin ? "/api/registration/admin/inscription-order/status" : "/api/registration/inscription/order/status",
        {
          body: JSON.stringify({
            id: order.id,
            notes,
            paidAmount: nextPaidAmount,
            status,
          }),
          headers: isCentralAdmin && adminToken ? { authorization: `Bearer ${adminToken}` } : {},
          method: "POST",
        },
      );

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

function RegistrationAdminMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <article className="passport-admin-metric">
      <Icon aria-hidden="true" size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function LevitateRegistrationAdminPaymentsRoute() {
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get("token") || window.localStorage.getItem(registrationAdminTokenStorageKey) || "";
  });
  const [tokenInput, setTokenInput] = useState(adminToken);
  const [orders, setOrders] = useState<RegistrationInscriptionOrder[]>([]);
  const [totals, setTotals] = useState<RegistrationAdminOrderTotals | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [adminError, setAdminError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadAdminOrders = useCallback(
    async (token = adminToken) => {
      setIsLoading(true);
      setAdminError("");

      try {
        const payload = await requestRegistrationApi<RegistrationAdminOrdersPayload>("/api/registration/admin/inscription-orders", {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        setOrders(payload.orders);
        setTotals(payload.totals);
      } catch (error) {
        setAdminError(getErrorMessage(error, "No se pudo cargar el panel de inscripciones."));
      } finally {
        setIsLoading(false);
      }
    },
    [adminToken],
  );

  useEffect(() => {
    if (!adminToken && typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return;
    }

    void loadAdminOrders(adminToken);
  }, [adminToken, loadAdminOrders]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [order.reference, order.curp, order.participantName, order.academyName, order.venue]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [orders, query, statusFilter]);

  const handleTokenSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    setAdminToken(nextToken);

    if (typeof window !== "undefined") {
      if (nextToken) {
        window.localStorage.setItem(registrationAdminTokenStorageKey, nextToken);
      } else {
        window.localStorage.removeItem(registrationAdminTokenStorageKey);
      }
    }

    void loadAdminOrders(nextToken);
  };

  const handleOrderUpdated = (order: RegistrationInscriptionOrder) => {
    setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
    void loadAdminOrders(adminToken);
  };

  return (
    <main className="levitate-admin-page registration-admin-page">
      <AdminTopBrand />
      <div className="levitate-admin-rule" aria-hidden="true" />

      <div className="levitate-admin-page__body registration-admin-body">
        <section className="levitate-admin-panel passport-admin-panel">
          <div className="levitate-admin-panel__heading">
            <p>Inscripciones</p>
            <h1>Panel admin</h1>
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
                placeholder="REGISTRATION_ADMIN_TOKEN"
                type="password"
                value={tokenInput}
              />
            </label>
            <button className="levitate-admin-save" disabled={isLoading} type="submit">
              <ShieldCheck aria-hidden="true" size={18} />
              {isLoading ? "Cargando" : "Cargar panel"}
            </button>
            <button className="levitate-admin-save passport-admin-secondary" disabled={isLoading} onClick={() => loadAdminOrders()} type="button">
              <Search aria-hidden="true" size={18} />
              Actualizar
            </button>
          </form>

          {adminError ? <p className="passport-admin-alert">{adminError}</p> : null}

          <div className="passport-admin-metrics registration-admin-metrics">
            <RegistrationAdminMetric icon={CreditCard} label="Órdenes" value={totals?.count ?? "—"} />
            <RegistrationAdminMetric icon={CircleAlert} label="Reportadas" value={totals?.reported ?? "—"} />
            <RegistrationAdminMetric icon={BadgeCheck} label="Pagadas" value={totals?.paid ?? "—"} />
            <RegistrationAdminMetric icon={ClipboardList} label="Comprobantes" value={totals?.withProof ?? "—"} />
          </div>

          <div className="registration-admin-totals">
            <div>
              <span>Monto total</span>
              <strong>{formatAdminCurrency(totals?.amount ?? 0)}</strong>
            </div>
            <div>
              <span>Monto pagado</span>
              <strong>{formatAdminCurrency(totals?.paidAmount ?? 0)}</strong>
            </div>
          </div>

          <div className="registration-admin-filters">
            <label>
              <span>Buscar</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="CURP, referencia, participante o academia"
                type="search"
                value={query}
              />
            </label>
            <label>
              <span>Estado</span>
              <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="all">Todos</option>
                {inscriptionOrderStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <InscriptionOrdersPanel
          adminToken={adminToken}
          emptyMessage={isLoading ? "Cargando órdenes..." : "No hay órdenes con esos filtros."}
          onOrderUpdated={handleOrderUpdated}
          orders={filteredOrders}
        />
      </div>
    </main>
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
