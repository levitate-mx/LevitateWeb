import {
  AtSign,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  ClipboardList,
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
  Shirt,
  UserPlus,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

type AdminScreenId = "home" | "choreographers" | "participants" | "dance";
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

type RegistrationBootstrap = RegistrationSession & {
  participants: RegistrationParticipant[];
  choreographers: RegistrationChoreographer[];
  dances: RegistrationDance[];
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
    username: string;
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

const studentPortalModules = [
  {
    title: "Pagos",
    text: "Inscripciones, boletos y fotografías asociadas a tu CURP.",
    action: "Ir a pagos",
    href: "/tienda#consulta-curp",
    resourceType: "payment",
    icon: BadgeCheck,
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
  resourceType: StudentRegistrationResource["type"];
  icon: LucideIcon;
}>;

const demoAcademyCredentials = {
  username: "demo_academia",
  password: "levitate123",
};

const demoStudentCredentials = {
  username: "demo_alumno",
  curp: "DEMO010101MDFLVT09",
  password: "levitate123",
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
};

const demoStudentSession: StudentRegistrationSession = {
  user: {
    id: "demo-student-user",
    username: demoStudentCredentials.username,
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
      title: "Pagos demo para Sofia Martinez",
      url: "/tienda#consulta-curp",
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
  username: string;
  password: string;
  curp?: string;
}) {
  return (
    <p className="levitate-auth-demo">
      <span>{label}</span>
      <code>{username}</code>
      {curp ? <code>{curp}</code> : null}
      <code>{password}</code>
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
            Academias administran participantes y bailes. Alumnos consultan lo asociado a su CURP desde una cuenta propia.
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
            <h2>Crear cuenta alumno</h2>
            <p>CURP, usuario y contraseña para pagos, hojas de jueceo y media.</p>
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
      const identifier = getFormValue(formData, "identifier");
      const password = getFormValue(formData, "password");
      const normalizedIdentifier = identifier.toLowerCase();

      if (
        password === demoStudentCredentials.password &&
        (normalizedIdentifier === demoStudentCredentials.username || identifier.toUpperCase() === demoStudentCredentials.curp)
      ) {
        persistDemoRegistrationSession("student");
        onAuthenticated(demoStudentSession);
        return;
      }

      clearPersistedDemoRegistrationSession();
      const session = await requestRegistrationApi<StudentRegistrationSession>("/api/registration/student/login", {
        body: JSON.stringify({
          identifier,
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
      const session = await requestRegistrationApi<StudentRegistrationSession>("/api/registration/student/register", {
        body: JSON.stringify({
          username: getFormValue(formData, "username"),
          curp: getFormValue(formData, "curp"),
          password: getFormValue(formData, "password"),
        }),
        method: "POST",
      });

      form.reset();
      onAuthenticated(session);
    } catch (error) {
      setRegisterError(getErrorMessage(error, "No se pudo crear la cuenta."));
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
          <h1>Tu cuenta Levitate</h1>
          <span aria-hidden="true" />
          <div>
            <ShieldCheck aria-hidden="true" size={22} />
            <strong>Usa tu CURP para consultar pagos, hojas de jueceo y material publicado por Levitate.</strong>
          </div>
        </div>

        <section className="levitate-auth-card" aria-label="Acceso de alumno">
          <div className="levitate-auth-tabs" role="tablist" aria-label="Acceso o registro de alumno">
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
              Crear cuenta
            </button>
          </div>

          {mode === "login" ? (
            <form className="levitate-auth-form" onSubmit={handleLoginSubmit}>
              <AdminStatusMessage message={systemMessage} tone="error" />
              <DemoCredentialsHint
                curp={demoStudentCredentials.curp}
                label="Demo alumno"
                password={demoStudentCredentials.password}
                username={demoStudentCredentials.username}
              />
              <AdminField icon={AtSign} label="Usuario o CURP">
                <input autoComplete="username" name="identifier" required type="text" />
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
              <AdminField icon={AtSign} label="Usuario">
                <input autoComplete="username" name="username" required type="text" />
              </AdminField>
              <AdminField helper="La CURP debe tener 18 caracteres." icon={ClipboardList} label="CURP">
                <input maxLength={18} minLength={18} name="curp" required type="text" />
              </AdminField>
              <AdminField helper="Mínimo 8 caracteres." icon={KeyRound} label="Contraseña">
                <input autoComplete="new-password" minLength={8} name="password" required type="password" />
              </AdminField>
              <AdminStatusMessage message={registerError} tone="error" />
              <button className="levitate-auth-submit" disabled={isSubmitting} type="submit">
                <UserPlus aria-hidden="true" size={18} />
                {isSubmitting ? "Creando..." : "Crear cuenta"}
              </button>
            </form>
          )}
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
          <h1>Hola, {session.registrations[0]?.fullName || session.user.username}.</h1>
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
          const resource = session.resources.find((item) => item.type === module.resourceType && item.url);
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
  onParticipantCreated,
  onChoreographerCreated,
  onDanceCreated,
}: {
  screen: AdminScreenId;
  session: RegistrationSession;
  participants: RegistrationParticipant[];
  choreographers: RegistrationChoreographer[];
  dances: RegistrationDance[];
  onParticipantCreated: (participant: RegistrationParticipant) => void;
  onChoreographerCreated: (choreographer: RegistrationChoreographer) => void;
  onDanceCreated: (dance: RegistrationDance) => void;
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
      setLoadError("");
    } catch (error) {
      setSession(null);
      setParticipants([]);
      setChoreographers([]);
      setDances([]);

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
            onParticipantCreated: handleParticipantCreated,
            onChoreographerCreated: handleChoreographerCreated,
            onDanceCreated: handleDanceCreated,
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
        setLoadError(getErrorMessage(error, "No se pudo cargar tu cuenta de alumno."));
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
