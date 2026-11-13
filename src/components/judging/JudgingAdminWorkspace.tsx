import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  MoreHorizontal,
  Maximize,
  Minimize,
  FileSpreadsheet,
  Home,
  ImagePlus,
  LoaderCircle,
  LogOut,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Star,
  Sun,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { requestRegistrationApi } from "../admin/registrationApi";
import { DictamenEntry, filterReportSections, ReleveAudienceFavorite } from "../admin/JudgingScoresPanel";
import type {
  ChoreographyScore,
  ReportBlock,
  ReportStanding,
} from "../admin/JudgingScoresPanel";
import "./JudgingAdminWorkspace.css";
import { resolveJudgePortrait } from "./judgePortraits";
import { ReleveVotingAdminPanel } from '../releve/ReleveVotingAdminPanel';
import { compactJudgingCategoryTitle } from '../../../shared/judging-category-title.js';

type Event = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  event_type: string;
  updated_at: string;
  competition_config?: Record<string, unknown>;
};
type Block = { block_id: string; name: string; title: string };
type Routine = {
  routine_id: string;
  program_number?: string | null;
  block_id: string;
  name: string;
  academy: string;
  genre: string;
  division: string;
  level: string;
  category: string;
  updated_at: string;
  [key: string]: unknown;
};
type Judge = {
  judge_id: string;
  name: string;
  role: string;
  photo_data: string;
  assigned_block_ids: string[];
  updated_at?: string;
};
type Score = Omit<ChoreographyScore, "id" | "judges"> & {
  id: string;
  judges: (ChoreographyScore["judges"][number] & { id: string })[];
};
type Bundle = {
  event: Event;
  blocks: Block[];
  routines: Routine[];
  judges: Judge[];
  favorites: {
    block_id: string;
    routine_id: string;
    judge_id: string;
    category: string;
  }[];
  specialAwards: { block_id: string; award: string; manual_value: string }[];
  accounts: {
    judge_id: string;
    username: string;
    user_id: string;
    enabled: number;
  }[];
  snapshot: {
    fetchedAt: string;
    warnings: string[];
    rows: Score[];
    report: { title: string; maximumScore: number; blocks: ReportBlock[] };
  };
};
type Presence = {
  judge_id: string;
  device_id: string;
  state: string;
  routine_id: string | null;
  platform: string;
  updated_at: string;
  sync_reported_at?: string;
  sync_diagnostics?: {
    pending_count?: number;
    last_error?: string;
    last_confirmed_at?: string;
  };
};
type View =
  | "home"
  | "scores"
  | "judges"
  | "report"
  | "favorites"
  | "releve"
  | "import"
  | "settings";
type Modal = { title: string; content: ReactNode } | null;
const primary = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "scores", label: "Editar calificaciones", icon: ClipboardList },
  { id: "judges", label: "Jueces", icon: Users },
  { id: "report", label: "Dictamen final", icon: Trophy },
  { id: "favorites", label: "Favoritos", icon: Star },
  { id: "releve", label: "Votación Relevé", icon: Check },
  { id: "import", label: "Importar Excel", icon: FileSpreadsheet },
] as const;
const compactNavLabels: Record<(typeof primary)[number]["id"], string> = {
  home: "Inicio",
  scores: "Notas",
  judges: "Jueces",
  report: "Dictamen",
  favorites: "Favoritos",
  releve: "Relevé",
  import: "Excel",
};
const base = "/api/registration/admin/judging/workspace/";
const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
const number = (v: number | null | undefined) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(v);
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "No se pudo completar la operación.";
const labels: Record<string, string> = {
  pending: "Pendiente",
  partial: "Incompleta",
  complete: "Completa",
  unavailable: "No disponible",
};
const time = (v: string | undefined) =>
  v
    ? new Date(v).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Sin registro";
function currentJudgeActivity(activity: Presence[], judgeId: string) {
  const latest = activity.filter((row) => row.judge_id === judgeId)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
  const age = latest ? Date.now() - Date.parse(latest.updated_at) : NaN;
  return age >= -60000 && age < 600000 ? latest : undefined;
}
const isScoring = (presence: Presence | undefined) =>
  presence?.state === "viewing_sheet" || presence?.state === "judging";
function judgeSheetSummary(activity: Presence[], judgeId: string, routines: Routine[], blocks: Block[], selectedBlockId: string, includeCurrentBlock = false) {
  const presence = currentJudgeActivity(activity, judgeId);
  if (!presence) return { label: activity.some(row => row.judge_id === judgeId) ? "Sin actividad reciente" : "Sin actividad registrada", sheet: "", block: "" };
  if (!isScoring(presence)) return { label: presence.state === "left_sheet" ? "Hoja cerrada" : presence.state === "home" ? "En inicio" : "Sin hoja abierta", sheet: "", block: "" };
  const routine = routines.find(row => row.routine_id === presence.routine_id);
  const otherBlock = routine && (includeCurrentBlock || selectedBlockId && routine.block_id !== selectedBlockId)
    ? blocks.find(block => block.block_id === routine.block_id) : null;
  return { label: "Hoja abierta", sheet: routine ? `#${routine.program_number?.trim() || routine.routine_id} · ${routine.name}` : "Coreografía no disponible",
    block: routine && (includeCurrentBlock || selectedBlockId && routine.block_id !== selectedBlockId) ? otherBlock?.title || otherBlock?.name || "Otro bloque" : "" };
}
function matrixTotal(row: Score | undefined) {
  if (!row || row.status === "pending") return { text: "—", label: "Pendiente", status: "pending" };
  if (row.status === "unavailable") return { text: "—", label: "No disponible", status: "unavailable" };
  const totals = row.judges.filter(judge => judge.status !== "pending" && typeof judge.total === "number" && Number.isFinite(judge.total)).map(judge => judge.total as number);
  if (!totals.length) return row.status === "complete" ? { text: "—", label: "No disponible", status: "unavailable" } : { text: "—", label: "Pendiente", status: "pending" };
  const total = totals.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total)) return { text: "—", label: "No disponible", status: "unavailable" };
  return { text: new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(total),
    label: row.status === "complete" ? "Oficial" : "Provisional", status: row.status };
}
export function useJudgingFullscreen(onError: (message: string) => void) {
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const update = () => setActive(Boolean(document.fullscreenElement));
    setAvailable(document.fullscreenEnabled === true);
    update();
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Keep the request in the original click so user activation is preserved.
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      onError('El navegador no permitió cambiar a pantalla completa.');
    } finally {
      setActive(Boolean(document.fullscreenElement));
      setBusy(false);
    }
  };
  return { available, active, busy, toggle };
}

function IconButton({
  label,
  children,
  ...props
}: {
  label: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="ja-icon"
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
      <span className="ja-tooltip">{label}</span>
    </button>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`ja-status is-${value}`}>{labels[value] || value}</span>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="ja-empty">{children}</p>;
}
function JudgeAvatar({ judge }: { judge: Judge }) {
  const image = resolveJudgePortrait(judge);
  return image ? (
    <img className="ja-avatar" src={image} alt="" />
  ) : (
    <span className="ja-avatar ja-initial" aria-hidden="true">
      {judge.name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
function ModalFrame({
  modal,
  onClose,
}: {
  modal: NonNullable<Modal>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className="ja-dialog" onCancel={onClose}>
      <header>
        <h2>{modal.title}</h2>
        <IconButton label="Cerrar" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </header>
      {modal.content}
    </dialog>
  );
}
function ConfirmForm({
  message,
  label,
  onConfirm,
  danger = false,
}: {
  message: string;
  label?: string;
  onConfirm: (value: string) => Promise<void>;
  danger?: boolean;
}) {
  const [value, setValue] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onConfirm(value);
        } catch (e) {
          setError(errorText(e));
          setBusy(false);
        }
      }}
    >
      <p>{message}</p>
      {label ? (
        <label>
          {label}
          <input
            autoComplete="off"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="ja-error">
          {error}
        </p>
      ) : null}
      <footer>
        <button disabled={busy} className={danger ? "ja-danger" : "ja-primary"}>
          {busy ? (
            <LoaderCircle size={17} className="ja-spin" />
          ) : (
            <Check size={17} />
          )}
          Confirmar
        </button>
      </footer>
    </form>
  );
}

export function JudgingAdminWorkspace() {
  const params = new URLSearchParams(location.search);
  const [events, setEvents] = useState<Event[]>([]),
    [eventId, setEventId] = useState(params.get("event") || ""),
    [bundle, setBundle] = useState<Bundle | null>(null);
  const [view, setView] = useState<View>(
    (params.get("view") === "activity"
      ? "scores"
      : params.get("view") === "ranking"
        ? "report"
        : [...primary.map((p) => p.id), "settings"].includes(params.get("view") || "")
          ? params.get("view")
          : "home") as View,
  );
  const [blockId, setBlockId] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [activity, setActivity] = useState<Presence[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [user, setUser] = useState("Admin"),
    [userRole, setUserRole] = useState<"admin" | "judging_admin" | undefined>(),
    [modal, setModal] = useState<Modal>(null);
  const fullscreen = useJudgingFullscreen(setNotice);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("levitate-judging-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  const canManagePrograms = userRole === "admin";
  const primaryItems = primary.filter((item) => canManagePrograms || item.id !== "import");
  useEffect(() => {
    if (userRole === "judging_admin" && (view === "import" || view === "settings")) {
      setView("home");
      setModal(null);
    }
  }, [userRole, view]);
  const generation = useRef(0);
  const api = useCallback(
    <T,>(action: string, body?: unknown, selected = eventId) =>
      requestRegistrationApi<T>(
        `${base}${action}${selected ? `?eventId=${encodeURIComponent(selected)}` : ""}`,
        body === undefined
          ? {}
          : { method: "POST", body: JSON.stringify(body) },
      ),
    [eventId],
  );
  useEffect(() => {
    localStorage.setItem("levitate-judging-theme", theme);
  }, [theme]);
  const loadEvents = useCallback(async () => {
    const response = await requestRegistrationApi<{
      events: Event[];
      user: { name: string; role: "admin" | "judging_admin" };
    }>(`${base}events`);
    setEvents(response.events);
    setUser(response.user.name || "Admin");
    setUserRole(response.user.role);
    return response.events;
  }, []);
  useEffect(() => {
    let live = true;
    loadEvents()
      .then((rows) => {
        if (live)
          setEventId((current) =>
            rows.some((e) => e.id === current)
              ? current
              : rows.find((e) => e.event_type !== "archived")?.id || "",
          );
      })
      .catch((e) => {
        if (live) {
          setError(errorText(e));
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [loadEvents]);
  const refresh = useCallback(
    async (quiet = false) => {
      if (!eventId) {
        setLoading(false);
        return;
      }
      const current = ++generation.current;
      if (!quiet) {
        setLoading(true);
        setError("");
      }
      try {
        const data = await api<Bundle>("snapshot");
        if (current !== generation.current) return;
        setBundle(data);
        setBlockId((old) =>
          data.blocks.some((b) => b.block_id === old)
            ? old
            : data.blocks[0]?.block_id || "",
        );
        setError("");
      } catch (e) {
        if (current === generation.current) setError(errorText(e));
      } finally {
        if (current === generation.current) setLoading(false);
      }
    },
    [eventId, api],
  );
  useEffect(() => {
    setBundle(null);
    setActivity([]);
    setQuery("");
    setBlockId("");
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  useEffect(() => {
    const url = new URL(location.href);
    if (eventId) url.searchParams.set("event", eventId);
    url.searchParams.set("view", view);
    history.replaceState(null, "", url);
  }, [eventId, view]);
  useEffect(() => {
    if (!eventId || !bundle) return;
    let live = true;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const r = await api<{ activity: Presence[] }>("activity");
        if (live) setActivity(r.activity);
      } catch {
        /* Keep the last confirmed presence until the next read. */
      }
    };
    void poll();
    const timer = setInterval(poll, 10000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [eventId, !!bundle, api]);
  useEffect(() => {
    if (!bundle || modal || busy) return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [!!bundle, modal, busy, refresh]);
  async function mutate(action: string, data: unknown) {
    await api(action, data);
    await refresh(true);
    setNotice("Cambios guardados.");
  }
  function openEditor(routine: Routine, judge: Judge) {
    const p = new URLSearchParams({
      mode: "admin-editor",
      event: eventId,
      judge: judge.judge_id,
      routine: routine.routine_id,
    });
    location.assign(`/jueceo/app/?${p}`);
  }
  function metadata(routine: Routine, field = "level") {
    if (!canManagePrograms) return;
    setModal({
      title: `#${routine.program_number?.trim() || routine.routine_id} · Datos de coreografía`,
      content: (
        <MetadataForm
          routine={routine}
          initialField={field}
          onSave={async (data) => {
            await mutate("metadata", data);
            setModal(null);
          }}
        />
      ),
    });
  }
  function move(routine: Routine) {
    if (!canManagePrograms) return;
    setModal({
      title: "Mover coreografía",
      content: (
        <MoveForm
          routine={routine}
          blocks={bundle!.blocks}
          onSave={async (block) => {
            await mutate("move-routine", {
              routine_id: routine.routine_id,
              expected_updated_at: routine.updated_at,
              target_block_id: block,
            });
            setModal(null);
          }}
        />
      ),
    });
  }
  function remove(routine: Routine) {
    if (!canManagePrograms) return;
    setModal({
      title: "Eliminar coreografía",
      content: (
        <ConfirmForm
          danger
          message={`Se eliminarán ${routine.name}, sus notas, devoluciones, penalizaciones y favoritos. Esta acción no se puede deshacer desde la web.`}
          label={`Escribe el ID interno ${routine.routine_id} para confirmar`}
          onConfirm={async (confirmation) => {
            await mutate("delete-routine", {
              routine_id: routine.routine_id,
              expected_updated_at: routine.updated_at,
              confirmation,
            });
            setModal(null);
          }}
        />
      ),
    });
  }
  const judges =
    bundle?.judges.filter(
      (j) => j.role === "judge" && !["ati", "admin"].includes(j.judge_id),
    ) || [];
  const routines = (bundle?.routines || []).filter(
    (r) => r.block_id === blockId,
  );
  const scores = new Map(bundle?.snapshot.rows.map((row) => [row.id, row]));
  const scoreJudgeIds = new Set(
    routines.flatMap((routine) =>
      (scores.get(routine.routine_id)?.judges || []).map((judge) => judge.id),
    ),
  );
  const scoreJudges = judges.filter((judge) => scoreJudgeIds.has(judge.judge_id));
  const blockReport = bundle?.snapshot.report.blocks.find(
    (b) => b.id === blockId,
  );
  const visible = routines.filter(
    (r) =>
      norm(
        `${r.program_number || ""} ${r.routine_id} ${r.name} ${r.academy} ${r.genre} ${r.division} ${r.level} ${r.category}`,
      ).includes(norm(query)) &&
      (status === "all" || scores.get(r.routine_id)?.status === status),
  );
  const completed = routines.filter(
    (r) => scores.get(r.routine_id)?.status === "complete",
  ).length;
  const title =
    primary.find((p) => p.id === view)?.label ||
    (
      {
        settings: "Configuración",
      } as const
    )[view as "settings"];
  async function downloadSheets() {
    if (!visible.length) return;
    setBusy("Preparando hojas de jueceo");
    setError("");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const { generateParticipantJudgingPdf } =
        await import("../../../shared/participant-judging-sheet.js");
      const merged = await PDFDocument.create();
      const logoBytes = new Uint8Array(
        await (await fetch("/assets/judging-sheet-logo-white.png")).arrayBuffer(),
      );
      for (const r of visible) {
        const row = scores.get(r.routine_id);
        if (!row?.judges.length) continue;
        const bytes = await generateParticipantJudgingPdf({
          eventTitle: bundle!.event.name,
          routine: {
            ...r,
            id: r.routine_id,
            programNumber: r.program_number?.trim() || undefined,
            title: r.name,
            block: bundle!.blocks.find((b) => b.block_id === blockId)?.name,
          },
          judges: row.judges,
          logoBytes,
        });
        const source = await PDFDocument.load(bytes);
        for (const page of await merged.copyPages(
          source,
          source.getPageIndices(),
        ))
          merged.addPage(page);
      }
      if (!merged.getPageCount()) throw new Error("No hay hojas disponibles.");
      savePdf(await merged.save(), `Levitate-hojas-${blockId}.pdf`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function downloadReport() {
    setBusy("Preparando dictamen");
    try {
      const { generateAdminReportPdf } = await import("./judgingAdminPdf");
      savePdf(
        await generateAdminReportPdf(bundle!, blockId),
        `Levitate-dictamen-${blockId}.pdf`,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function logout() {
    setBusy("Cerrando sesión");
    setError("");
    try {
      await requestRegistrationApi("/api/registration/auth/logout", { method: "POST" });
      location.replace("/login");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  const homePath = userRole === "admin" ? "/admin/dashboard" : "/jueceo/admin";
  const homeLabel = userRole === "admin" ? "Panel Levitate" : "Inicio de jueceo";
  return (
    <div className="ja-app" data-theme={theme}>
      <aside className="ja-sidebar">
        <div className="ja-brand">
          <img src="/assets/levitate-logo-mx.png" alt="Levitate MX" />
          <span>Espacio de jueceo</span>
        </div>
        <a
          href={homePath}
          className="ja-back"
          title={homeLabel}
          aria-label={homeLabel}
        >
          <ArrowLeft size={21} />
          <span>{homeLabel}</span>
        </a>
        <p className="ja-nav-caption">COMPETENCIA</p>
        <nav aria-label="Administración de jueceo">
          {primaryItems.map((item) => (
            <button
              key={item.id}
              title={item.label}
              aria-label={item.label}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => {
                setView(item.id);
                setQuery("");
                setStatus("all");
              }}
            >
              <item.icon size={23} />
              <span className="ja-nav-label">{item.label}</span>
              <span className="ja-nav-short" aria-hidden="true">
                {compactNavLabels[item.id]}
              </span>
            </button>
          ))}
        </nav>
        <div className="ja-sidebar-bottom">
          {canManagePrograms ? (
            <button aria-pressed={view === "settings"} onClick={() => setView("settings")}>
              <Settings size={21} />
              <span>Configuración</span>
            </button>
          ) : null}
        </div>
        <div className="ja-profile">
          <span className="ja-profile-initial" aria-hidden="true">
            {user.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{user}</strong>
            <small>{userRole === "admin" ? "Administrador" : "Administración de jueceo"}</small>
          </span>
        </div>
        <button className="ja-logout" disabled={!!busy} onClick={() => void logout()}>
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </aside>
      <div className="ja-main">
        <header className="ja-topbar">
          <img className="ja-mobile-brand" src="/assets/levitate-logo-mx.png" alt="Levitate MX" />
          <div className="ja-event">
            <label htmlFor="ja-event">Evento</label>
            <select
              id="ja-event"
              value={eventId}
              disabled={!!busy}
              onChange={(e) => {
                setEventId(e.target.value);
                setModal(null);
              }}
            >
              <option value="" disabled>
                Seleccionar evento
              </option>
              {events
                .filter((e) => e.event_type !== "archived")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.is_active ? " · Activo" : ""}
                  </option>
                ))}
            </select>
          </div>
          <div className="ja-top-status">
            <i className={error ? "is-error" : ""} />
            <span>
              {error ? "Revisar conexión" : "Online"}
              <small>
                {loading
                  ? "Actualizando…"
                  : bundle
                    ? `Sincronizado ${time(bundle.snapshot.fetchedAt)}`
                    : "Conectando…"}
              </small>
            </span>
          </div>
          {fullscreen.available && <IconButton
            label={fullscreen.active ? 'Salir de pantalla completa' : 'Pantalla completa'}
            aria-pressed={fullscreen.active}
            disabled={fullscreen.busy}
            onClick={() => void fullscreen.toggle()}
          >
            {fullscreen.active ? <Minimize size={21} /> : <Maximize size={21} />}
          </IconButton>}
          <IconButton
            label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={21} /> : <Moon size={21} />}
          </IconButton>
          <details className="ja-more">
            <summary aria-label="Más opciones">
              <MoreHorizontal size={22} />
            </summary>
            <nav>
              {canManagePrograms ? (
                <button onClick={() => setView("settings")}>
                  <Settings size={18} />
                  Configuración
                </button>
              ) : null}
              <a href={homePath}>
                <ArrowLeft size={18} />
                {homeLabel}
              </a>
              <button disabled={!!busy} onClick={() => void logout()}>
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </nav>
          </details>
        </header>
        <main className="ja-content">
          <div className="ja-heading">
            <div>
              <p>LEVITATE · JUECEO</p>
              <h1>{title}</h1>
            </div>
            <div className="ja-heading-actions">
              {view === "report" ? (
                <IconButton
                  label="Descargar dictamen PDF"
                  disabled={!blockReport || !!busy}
                  onClick={() => void downloadReport()}
                >
                  <Download size={20} />
                </IconButton>
              ) : null}
              <IconButton
                label="Actualizar datos"
                disabled={loading || !!busy}
                onClick={() => void refresh()}
              >
                <RefreshCw className={loading ? "ja-spin" : ""} size={20} />
              </IconButton>
            </div>
          </div>
          {error ? (
            <div className="ja-error" role="alert">
              {error}{" "}
              {error.includes("sesión") || error.includes("permisos") ? (
                <a href="/login">Iniciar sesión</a>
              ) : null}
            </div>
          ) : null}
          {notice ? (
            <div className="ja-notice" role="status">
              {notice}
              <IconButton label="Cerrar aviso" onClick={() => setNotice("")}>
                <X size={16} />
              </IconButton>
            </div>
          ) : null}
          {loading && !bundle ? <Empty>Cargando programa…</Empty> : null}
          {bundle && (view === "home" || view === "scores") ? (
            <section className="ja-score-activity" aria-label="Actividad de jueces">
              <header><Activity size={18} /><h2>Actividad de jueces</h2><span>Todos los bloques · cada 10 s</span></header>
              <ActivityPanel judges={judges} activity={activity} routines={bundle.routines} blocks={bundle.blocks} selectedBlockId={blockId} />
            </section>
          ) : null}
          {bundle &&
          view !== "import" &&
          view !== "judges" &&
          view !== "settings" &&
          view !== "releve" &&
          view !== "report" ? (
            <div className={`ja-toolbar${view === "home" ? " ja-toolbar-overview" : ""}`}>
              <label className="ja-block">
                Bloque
                <select
                  value={blockId}
                  disabled={!bundle.blocks.length}
                  onChange={(e) => setBlockId(e.target.value)}
                >
                  {!bundle.blocks.length ? (
                    <option value="">Sin bloques registrados</option>
                  ) : null}
                  {bundle.blocks.map((b) => (
                    <option key={b.block_id} value={b.block_id}>
                      {b.title || b.name}
                    </option>
                  ))}
                </select>
              </label>
              {view !== "home" ? (
                <label className="ja-search">
                  <Search size={18} />
                  <input
                    type="search"
                    aria-label="Buscar coreografía"
                    placeholder="Buscar coreografía o academia"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              ) : null}
              {view === "scores" ? (
                <>
                  <select
                    aria-label="Estado de evaluación"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">Todas</option>
                    {Object.entries(labels).map(([v, label]) => (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <IconButton
                    label="Descargar hojas PDF"
                    disabled={!!busy || !visible.length}
                    onClick={() => void downloadSheets()}
                  >
                    <Download size={20} />
                  </IconButton>
                </>
              ) : null}
            </div>
          ) : null}
          {bundle?.snapshot.warnings.length &&
          ["report", "scores"].includes(view) ? (
            <details className="ja-warnings">
              <summary>
                {bundle.snapshot.warnings.length} avisos del programa
              </summary>
              <ul>
                {bundle.snapshot.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {bundle && view === "home" ? (
            <>
              <div className="ja-overview">
                <section className="ja-overview-intro">
                  <div>
                    <p>HOLA, {user.split(" ")[0].toUpperCase()}</p>
                    <h2>
                      {bundle.blocks.find((b) => b.block_id === blockId)?.title ||
                        bundle.blocks.find((b) => b.block_id === blockId)?.name ||
                        "Programa de competencia"}
                    </h2>
                    <p className="ja-home-context">{bundle.event.name}</p>
                    <button
                      className="ja-primary"
                      onClick={() => setView("scores")}
                    >
                      Editar calificaciones
                      <ArrowRight size={18} />
                    </button>
                  </div>
                  <img
                    src="/jueceo/app/assets/assets/images/levitate_dancer_hero.png"
                    alt="Artista Levitate"
                  />
                  <span className="ja-home-signature" aria-hidden="true">See you on stage.</span>
                </section>
                <section className="ja-progress-card" aria-label="Avance del bloque">
                  <div className="ja-section-caption"><span /> EN ESTE BLOQUE</div>
                  <h2>El avance<br />de la <span>competencia.</span></h2>
                  <div className="ja-progress-count">
                    <strong>{completed}</strong>
                    <span>de {routines.length}<br />coreografías completas</span>
                  </div>
                  <progress
                    aria-label="Coreografías completas"
                    max={Math.max(1, routines.length)}
                    value={completed}
                  />
                  <p>{routines.length - completed} por completar</p>
                  <button onClick={() => setView("report")}>
                    Consultar dictamen <ArrowRight size={17} />
                  </button>
                </section>
              </div>
              <section className="ja-metrics">
                <article>
                  <ClipboardList />
                  <div><strong>{routines.length}</strong><span>Coreografías en este bloque</span></div>
                </article>
                <article>
                  <Users />
                  <div><strong>{judges.length}</strong><span>Jueces del evento</span></div>
                  <button onClick={() => setView("scores")}>
                    Ver actividad
                    <ChevronRight size={16} />
                  </button>
                </article>
                <article>
                  <Trophy />
                  <div><strong>{bundle.blocks.length}</strong><span>Bloques en el programa</span></div>
                </article>
              </section>
              <section className="ja-upcoming">
                <header>
                  <div><p className="ja-section-caption">EL PROGRAMA CONTINÚA</p><h2>Próximas coreografías</h2></div>
                  <button onClick={() => setView("scores")}>
                    Ver todas
                    <ChevronRight size={16} />
                  </button>
                </header>
                {routines
                  .filter(
                    (r) => scores.get(r.routine_id)?.status !== "complete",
                  )
                  .slice(0, 3)
                  .map((r) => (
                    <article key={r.routine_id}>
                      <b>#{r.program_number?.trim() || r.routine_id}</b>
                      <div>
                        <strong>{r.name}</strong>
                        <small>{r.academy}</small>
                      </div>
                      <span>{r.level}</span>
                      <Status
                        value={scores.get(r.routine_id)?.status || "pending"}
                      />
                      <IconButton
                        label={`Ver ${r.name}`}
                        onClick={() => {
                          setQuery(r.routine_id);
                          setView("scores");
                        }}
                      >
                        <ChevronRight size={20} />
                      </IconButton>
                    </article>
                  ))}
                {!routines.length ? (
                  <Empty>Este bloque todavía no tiene coreografías.</Empty>
                ) : completed === routines.length ? (
                  <Empty>Bloque completo.</Empty>
                ) : null}
              </section>
            </>
          ) : null}
          {view === 'releve' ? <ReleveVotingAdminPanel refreshToken={bundle?.snapshot.fetchedAt || ''} onChanged={() => void refresh(true)} /> : null}
          {bundle && view === "scores" ? (
            <div
              className="ja-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Calificaciones por juez"
            >
              <table className="ja-matrix">
                <thead>
                  <tr>
                    <th>
                      Coreografía <small>{visible.length}</small>
                    </th>
                    {scoreJudges.map((j) => {
                      const summary = judgeSheetSummary(activity, j.judge_id, bundle.routines, bundle.blocks, blockId);
                      return (
                      <th key={j.judge_id}>
                        <JudgeAvatar judge={j} />
                        <span className="ja-column-label">Juez</span>
                        <strong>{j.name}</strong>
                        <div className="ja-judge-sheet-status"><small>{summary.label}</small>{summary.sheet ? <span>{summary.sheet}</span> : null}{summary.block ? <small className="ja-judge-sheet-block">{summary.block}</small> : null}</div>
                      </th>
                    );})}
                    <th>
                      Puntaje total
                    </th>
                    {canManagePrograms ? <th className="ja-actions-column">
                      <span className="ja-sr">Acciones</span>
                    </th> : null}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const row = scores.get(r.routine_id);
                    const total = matrixTotal(row);
                    return (
                      <tr key={r.routine_id}>
                        <th scope="row">
                          <div className="ja-routine-heading">
                            <b>#{r.program_number?.trim() || r.routine_id}</b>
                            {canManagePrograms ? <IconButton
                              label={`Editar datos de ${r.name}`}
                              onClick={() => metadata(r, "name")}
                            >
                              <Pencil size={14} />
                            </IconButton> : null}
                          </div>
                          <strong>{r.name}</strong>
                          <small>{r.academy}</small>
                          <div className="ja-chips">
                            {(
                              [
                                "division",
                                "genre",
                                "level",
                                "category",
                              ] as const
                            ).map((f) => (
                              canManagePrograms ? <button
                                key={f}
                                title={`Editar ${f}`}
                                onClick={() => metadata(r, f)}
                              >
                                {r[f] || "Sin dato"}
                              </button> : <span key={f}>{r[f] || "Sin dato"}</span>
                            ))}
                          </div>
                        </th>
                        {scoreJudges.map((j) => {
                          const js = row?.judges.find(
                            (s) => s.id === j.judge_id,
                          );
                          const assigned = Boolean(js);
                          const presence = currentJudgeActivity(activity, j.judge_id);
                          const active = assigned && isScoring(presence) && presence?.routine_id === r.routine_id;
                          return (
                            <td key={j.judge_id}>
                              <button
                                className={`ja-score ${active ? "is-active" : ""}`}
                                title={`Editar hoja de ${j.name} · ${r.name}`}
                                disabled={!assigned}
                                onClick={() => openEditor(r, j)}
                              >
                                <strong>{number(js?.total)}</strong>
                                <small>
                                  {assigned
                                    ? active ? "Hoja abierta" : labels[js?.status || "pending"]
                                    : "No asignado"}
                                </small>
                                {js?.penalty ? (
                                  <span className="ja-penalty">
                                    {number(js.penalty)}
                                  </span>
                                ) : null}
                                {active ? <span className="ja-presence-dot" role="img" aria-label="Juez con esta hoja abierta" /> : null}
                              </button>
                            </td>
                          );
                        })}
                        <td className="ja-total">
                          <strong>
                            {total.text}
                          </strong>
                          <small>
                            {row?.completedJudges || 0}/
                            {row?.expectedJudges || 0} jueces
                          </small>
                          <span className={`ja-status is-${total.status}`}>{total.label}</span>
                        </td>
                        {canManagePrograms ? <td>
                          <div className="ja-row-actions">
                            <IconButton
                              label={`Mover ${r.name} a otro bloque`}
                              onClick={() => move(r)}
                            >
                              <ArrowRight size={17} />
                            </IconButton>
                            <IconButton
                              label={`Eliminar ${r.name}`}
                              onClick={() => remove(r)}
                            >
                              <Trash2 size={17} />
                            </IconButton>
                          </div>
                        </td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visible.length ? (
                <Empty>No hay coreografías que coincidan.</Empty>
              ) : null}
            </div>
          ) : null}
          {bundle && view === "judges" ? (
            <JudgesPanel
              key={eventId}
              bundle={bundle}
              judges={judges}
              api={api}
              mutate={mutate}
              setModal={setModal}
              setNotice={setNotice}
              refresh={() => refresh(true)}
            />
          ) : null}
          {bundle && view === "report" ? (
            <ReportPanel
              key={`${eventId}:${blockId}:${view}`}
              report={blockReport}
              bundle={bundle}
              blockId={blockId}
              onBlockChange={setBlockId}
            />
          ) : null}
          {bundle && view === "favorites" ? (
            <FavoritesPanel
              bundle={bundle}
              blockId={blockId}
              query={query}
              mutate={mutate}
            />
          ) : null}
          {canManagePrograms && view === "import" ? (
            <ImportPanel
              events={events}
              api={api}
              onImported={async (id) => {
                await loadEvents();
                setEventId(id);
                setView("scores");
                setNotice("Programa importado como evento inactivo.");
              }}
              onEventAction={async (action, e) => {
                setModal({
                  title:
                    action === "archive"
                      ? "Archivar evento"
                      : action === "restore"
                        ? "Restaurar evento"
                        : "Activar evento",
                  content: (
                    <ConfirmForm
                      message={
                        action === "archive"
                          ? "El programa se conservará, pero dejará de estar disponible para jueceo."
                          : action === "restore"
                            ? "El evento se restaurará como inactivo."
                            : "Este evento será el activo de Levitate. No se modificarán otras marcas."
                      }
                      label={
                        action === "archive" ? `Escribe ${e.slug}` : undefined
                      }
                      onConfirm={async (confirmation) => {
                        await api(
                          action,
                          { expected_updated_at: e.updated_at, confirmation },
                          e.id,
                        );
                        await loadEvents();
                        if (action === "archive" && eventId === e.id) {
                          setEventId("");
                          setBundle(null);
                        } else if (e.id === eventId) await refresh();
                        setModal(null);
                        setNotice("Evento actualizado.");
                      }}
                    />
                  ),
                });
              }}
            />
          ) : null}
          {canManagePrograms && bundle && view === "settings" ? (
            <SettingsPanel
              key={`${eventId}-${bundle.event.updated_at}`}
              event={bundle.event}
              onSave={(data) => mutate("configuration", data)}
            />
          ) : null}
          {!bundle && !loading && !error && view !== "import" ? (
            <Empty>No hay un evento seleccionado.</Empty>
          ) : null}
        </main>
      </div>
      {busy ? (
        <div className="ja-busy" role="status">
          <LoaderCircle size={18} className="ja-spin" />
          {busy}
        </div>
      ) : null}
      {modal ? (
        <ModalFrame modal={modal} onClose={() => setModal(null)} />
      ) : null}
    </div>
  );
}

function MetadataForm({
  routine,
  initialField,
  onSave,
}: {
  routine: Routine;
  initialField: string;
  onSave: (data: unknown) => Promise<void>;
}) {
  const [field, setField] = useState(initialField),
    [value, setValue] = useState(String(routine[initialField] || "")),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const fields = {
    name: "Nombre",
    academy: "Academia",
    genre: "Género",
    division: "División",
    level: "Nivel",
    category: "Categoría",
    choreographer: "Coreógrafo",
    state: "Estado",
    scheduled_time: "Horario",
    duration: "Duración",
  };
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave({
            routine_id: routine.routine_id,
            expected_updated_at: routine.updated_at,
            field,
            value,
          });
        } catch (e) {
          setError(errorText(e));
          setBusy(false);
        }
      }}
    >
      <label>
        Campo
        <select
          value={field}
          onChange={(e) => {
            setField(e.target.value);
            setValue(String(routine[e.target.value] || ""));
          }}
        >
          {Object.entries(fields).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label>
        {fields[field as keyof typeof fields]}
        <input
          value={value}
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
          required={field === "name" || field === "genre"}
        />
      </label>
      {error ? (
        <p className="ja-error" role="alert">
          {error}
        </p>
      ) : null}
      <footer>
        <button className="ja-primary" disabled={busy}>
          <Check size={18} />
          Guardar
        </button>
      </footer>
    </form>
  );
}
function MoveForm({
  routine,
  blocks,
  onSave,
}: {
  routine: Routine;
  blocks: Block[];
  onSave: (id: string) => Promise<void>;
}) {
  const [id, setId] = useState(
      blocks.find((b) => b.block_id !== routine.block_id)?.block_id || "",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(id);
        } catch (e) {
          setError(errorText(e));
          setBusy(false);
        }
      }}
    >
      <p>
        #{routine.program_number?.trim() || routine.routine_id} · {routine.name}
      </p>
      <label>
        Bloque destino
        <select value={id} onChange={(e) => setId(e.target.value)} required>
          {blocks
            .filter((b) => b.block_id !== routine.block_id)
            .map((b) => (
              <option key={b.block_id} value={b.block_id}>
                {b.title || b.name}
              </option>
            ))}
        </select>
      </label>
      <p>Se conservarán las notas, devoluciones, penalizaciones y favoritos.</p>
      {error ? (
        <p className="ja-error" role="alert">
          {error}
        </p>
      ) : null}
      <footer>
        <button disabled={!id || busy} className="ja-primary">
          <ArrowRight size={18} />
          Mover
        </button>
      </footer>
    </form>
  );
}

type Api = <T>(action: string, body?: unknown, selected?: string) => Promise<T>;
function JudgesPanel({
  bundle,
  judges,
  api,
  mutate,
  setModal,
  setNotice,
  refresh,
}: {
  bundle: Bundle;
  judges: Judge[];
  api: Api;
  mutate: (a: string, d: unknown) => Promise<void>;
  setModal: (m: Modal) => void;
  setNotice: (m: string) => void;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState(judges[0]?.judge_id || ""),
    [creating, setCreating] = useState(false),
    [codes, setCodes] = useState<{ judge_id: string; access_code: string }[]>(
      [],
    ),
    [error, setError] = useState("");
  const judge = creating
    ? null
    : judges.find((j) => j.judge_id === selected) || null;
  useEffect(() => {
    let live = true;
    api<{ codes: { judge_id: string; access_code: string }[] }>("access-codes")
      .then((r) => {
        if (live) setCodes(r.codes);
      })
      .catch((e) => {
        if (live) setError(errorText(e));
      });
    return () => {
      live = false;
    };
  }, [api, judges.length]);
  return (
    <section className="ja-judges">
      <aside>
        <header>
          <h2>
            Jueces <small>{judges.length}</small>
          </h2>
          <IconButton label="Agregar juez" onClick={() => setCreating(true)}>
            <Plus size={20} />
          </IconButton>
        </header>
        {judges.map((j) => (
          <button
            className={judge?.judge_id === j.judge_id ? "is-selected" : ""}
            key={j.judge_id}
            onClick={() => {
              setSelected(j.judge_id);
              setCreating(false);
            }}
          >
            <JudgeAvatar judge={j} />
            <span>
              <strong>{j.name}</strong>
              <small>
                {j.assigned_block_ids.length
                  ? `${j.assigned_block_ids.length} bloques`
                  : "Todos los bloques"}
              </small>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
      </aside>
      <div className="ja-judge-editor">
        {error ? (
          <p role="alert" className="ja-error">
            {error}
          </p>
        ) : null}
        {judge || creating ? (
          <JudgeForm
            key={creating ? "new" : `${judge!.judge_id}-${judge!.updated_at}`}
            judge={judge}
            blocks={bundle.blocks}
            code={
              codes.find((c) => c.judge_id === judge?.judge_id)?.access_code
            }
            account={bundle.accounts.find(
              (a) => a.judge_id === judge?.judge_id,
            )}
            api={api}
            onSave={async (data) => {
              await mutate("upsert-judge", data);
              setSelected((data as { judge_id: string }).judge_id);
              setCreating(false);
            }}
            onDelete={() =>
              setModal({
                title: "Eliminar juez",
                content: (
                  <ConfirmForm
                    danger
                    message={`Se eliminará ${judge!.name} y sus datos de jueceo del evento, incluidas sus calificaciones. Se deshabilitará su acceso web a este evento.`}
                    label={`Escribe ${judge!.judge_id}`}
                    onConfirm={async (confirmation) => {
                      await mutate("delete-judge", {
                        judge_id: judge!.judge_id,
                        expected_updated_at: judge!.updated_at,
                        confirmation,
                      });
                      setSelected("");
                      setModal(null);
                    }}
                  />
                ),
              })
            }
            onAccount={async (data) => {
              const result = await api<{
                username?: string;
                password?: string;
              }>("web-account", data);
              await refresh();
              if (result.password)
                setModal({
                  title: "Acceso web creado",
                  content: (
                    <div className="ja-credentials">
                      <p>
                        Usuario <strong>{result.username}</strong>
                      </p>
                      <p>
                        Contraseña <code>{result.password}</code>
                      </p>
                      <a href="/login">levitate.mx/login</a>
                      <p>La contraseña se muestra solo esta vez.</p>
                      <button
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            `Usuario: ${result.username}\nContraseña: ${result.password}\nhttps://levitate.mx/login`,
                          )
                        }
                      >
                        <Copy size={17} />
                        Copiar acceso
                      </button>
                    </div>
                  ),
                });
              else setNotice("Acceso actualizado.");
            }}
          />
        ) : (
          <Empty>Selecciona o agrega un juez.</Empty>
        )}
      </div>
    </section>
  );
}
function JudgeForm({
  judge,
  blocks,
  code,
  account,
  onSave,
  onDelete,
  onAccount,
}: {
  judge: Judge | null;
  blocks: Block[];
  code?: string;
  account?: Bundle["accounts"][number];
  api: Api;
  onSave: (d: unknown) => Promise<void>;
  onDelete: () => void;
  onAccount: (d: unknown) => Promise<void>;
}) {
  const [name, setName] = useState(judge?.name || ""),
    [id, setId] = useState(judge?.judge_id || ""),
    [assigned, setAssigned] = useState(judge?.assigned_block_ids || []),
    [photo, setPhoto] = useState<string | undefined>(undefined),
    [all, setAll] = useState(!judge?.assigned_block_ids.length),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [username, setUsername] = useState("");
  async function loadPhoto(file: File) {
    setError("");
    if (
      file.size > 1000000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Usa una imagen JPEG, PNG o WebP de hasta 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  }
  const image = photo === undefined && judge ? resolveJudgePortrait(judge) : photo;
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave({
              judge_id: id,
              name,
              assigned_block_ids: all ? [] : assigned,
              ...(photo === undefined ? {} : { photo_data: photo }),
              ...(judge ? { expected_updated_at: judge.updated_at } : {}),
            });
          } catch (e) {
            setError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="ja-photo-editor">
          {image ? (
            <img src={image} alt={name || "Foto del juez"} />
          ) : (
            <Users size={55} />
          )}
          <label className="ja-upload">
            <ImagePlus size={18} />
            Elegir foto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                if (e.target.files?.[0]) void loadPhoto(e.target.files[0]);
              }}
            />
          </label>
          {image ? (
            <IconButton label="Quitar foto" onClick={() => setPhoto("")}>
              <Trash2 size={18} />
            </IconButton>
          ) : null}
        </div>
        <label>
          Nombre
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!judge)
                setId(
                  norm(e.target.value)
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
            }}
          />
        </label>
        <label>
          ID del juez
          <input
            required
            pattern="[A-Za-z0-9_-]{1,160}"
            value={id}
            readOnly={!!judge}
            onChange={(e) => setId(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Bloques asignados</legend>
          <label className="ja-check">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
            />
            Todos los bloques
          </label>
          {!all
            ? blocks.map((b) => (
                <label className="ja-check" key={b.block_id}>
                  <input
                    type="checkbox"
                    checked={assigned.includes(b.block_id)}
                    onChange={(e) =>
                      setAssigned(
                        e.target.checked
                          ? [...assigned, b.block_id]
                          : assigned.filter((id) => id !== b.block_id),
                      )
                    }
                  />
                  {b.title || b.name}
                </label>
              ))
            : null}
          {!all && !assigned.length ? (
            <p className="ja-error">Selecciona al menos un bloque.</p>
          ) : null}
        </fieldset>
        {code ? (
          <div className="ja-access-code">
            <span>Código app</span>
            <code>{code}</code>
            <IconButton
              label="Copiar código"
              onClick={() => void navigator.clipboard.writeText(code)}
            >
              <Copy size={17} />
            </IconButton>
          </div>
        ) : null}
        {error ? (
          <p className="ja-error" role="alert">
            {error}
          </p>
        ) : null}
        <footer>
          {judge ? (
            <IconButton label="Eliminar juez" onClick={onDelete}>
              <Trash2 size={19} />
            </IconButton>
          ) : null}
          <button
            className="ja-primary"
            disabled={busy || (!all && !assigned.length)}
          >
            <Check size={18} />
            {busy ? "Guardando…" : "Guardar juez"}
          </button>
        </footer>
      </form>
      {judge ? (
        <section className="ja-account">
          <h3>Acceso web</h3>
          {account ? (
            <>
              <p>
                {account.username} ·{" "}
                {account.enabled ? "Habilitado" : "Deshabilitado"}
              </p>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onAccount({
                      judge_id: id,
                      user_id: account.user_id,
                      enabled: !account.enabled,
                    });
                  } catch (e) {
                    setError(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {account.enabled ? "Deshabilitar acceso" : "Habilitar acceso"}
              </button>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await onAccount({ judge_id: id, username });
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Usuario
                <input
                  required
                  pattern="[a-z0-9][a-z0-9._-]{2,59}"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  autoComplete="off"
                />
              </label>
              <button disabled={busy}>
                <Plus size={17} />
                Crear acceso web
              </button>
            </form>
          )}
        </section>
      ) : null}
    </>
  );
}

export function SheetReleaseControl({ eventId, blockId, revision }: { eventId: string; blockId: string; revision?: string }) {
  type Release = { blockId: string; state: "pending" | "ready" | "released" | "changed"; complete: boolean; canRelease: boolean; routines: number; availableRoutines: number; availableSheets: number; releasedRoutines: number; releasedSheets: number; releasedAt: string | null };
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const path = `/api/registration/admin/judging/workspace/sheet-release?eventId=${encodeURIComponent(eventId)}`;
  useEffect(() => {
    const controller = new AbortController();
    setRelease(null);
    setLoading(true);
    setError("");
    requestRegistrationApi<Release>(`${path}&blockId=${encodeURIComponent(blockId)}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.blockId !== blockId) throw new Error("No se pudo comprobar el bloque seleccionado.");
        setRelease(data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo comprobar el estado de las hojas.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, blockId, revision]);
  const availableLabel = release ? `${release.availableSheets} ${release.availableSheets === 1 ? "hoja disponible" : "hojas disponibles"} de ${release.availableRoutines} ${release.availableRoutines === 1 ? "coreografía" : "coreografías"}` : "";
  const releasedLabel = release ? `${release.releasedSheets} ${release.releasedSheets === 1 ? "hoja habilitada" : "hojas habilitadas"} de ${release.releasedRoutines} ${release.releasedRoutines === 1 ? "coreografía" : "coreografías"}` : "";
  const message = loading ? "Comprobando hojas de este bloque…"
    : release?.canRelease === true ? `${availableLabel}. Puedes ${release.availableSheets === 1 ? "enviarla" : "enviarlas"} ahora.`
      : release && release.releasedSheets > 0 ? `${releasedLabel} en Mi Levitate. Las nuevas hojas requieren otro envío.`
        : "Todavía no hay hojas terminadas para enviar.";
  return <section className="ja-sheet-release" aria-label="Hojas de jueceo en Mi Levitate" aria-busy={loading || sending}>
    <div><h3>Hojas de jueceo del bloque</h3><p role="status">{message}</p></div>
    <button type="button" disabled={loading || sending || release?.canRelease !== true} onClick={async () => {
      if (release?.canRelease !== true || sending) return;
      setSending(true);
      setError("");
      try {
        const data = await requestRegistrationApi<Release>(path, { method: "POST", body: JSON.stringify({ block_id: blockId }) });
        if (data.blockId !== blockId) throw new Error("No se pudo comprobar el bloque seleccionado.");
        setRelease(data);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "No se pudieron habilitar las hojas.");
      } finally { setSending(false); }
    }}>{sending ? "Habilitando hojas…" : release && !release.canRelease && release.releasedSheets > 0 ? "Hojas habilitadas" : "Enviar hojas de jueceo"}</button>
    {error ? <p className="ja-error" role="alert">{error}</p> : null}
  </section>;
}

export function ReportPanel({
  report,
  bundle,
  blockId,
  onBlockChange,
  readOnly = false,
}: {
  report: ReportBlock | undefined;
  bundle: Pick<Bundle, "event" | "blocks" | "snapshot">;
  readOnly?: boolean;
  blockId: string;
  onBlockChange: (blockId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("all");
  const [status, setStatus] = useState("all");
  const [expandedId, setExpandedId] = useState("");
  const lookup = new Map(bundle.snapshot.rows.map((r) => [r.id, r]));
  const sections = report ? filterReportSections(report, bundle.snapshot.rows, {
    query,
    discipline,
    status,
  }) : [];
  const visibleCount = sections.reduce(
    (total, section) =>
      total +
      section.categories.reduce((sum, category) => sum + category.rows.length, 0),
    0,
  );
  const totalCount = (report?.sections || []).reduce(
    (total, section) =>
      total +
      section.categories.reduce((sum, category) => sum + category.rows.length, 0),
    0,
  );
  const hasFilters = !!query.trim() || discipline !== "all" || status !== "all";
  const resetFilters = () => {
    setQuery("");
    setDiscipline("all");
    setStatus("all");
    setExpandedId("");
  };
  const render = (standing: ReportStanding) => {
    const row = lookup.get(standing.routineId);
    if (!row) return null;
    return (
      <DictamenEntry
        key={row.id}
        standing={standing}
        row={row}
        maximumScore={standing.maximumScore ?? bundle.snapshot.report.maximumScore}
        eventId={bundle.event.id}
        blockId={blockId}
        expanded={expandedId === row.id}
        onToggle={() => setExpandedId(expandedId === row.id ? "" : row.id)}
        showMetadata
        allowDetails={!readOnly}
      />
    );
  };
  return (
    <section className="ja-report judging-scores">
      <div
        className="ja-report-filters"
        role="group"
        aria-label="Filtros del dictamen"
      >
        <label>
          Bloque
          <select value={blockId} onChange={(e) => onBlockChange(e.target.value)} disabled={!bundle.blocks.length}>
            {!bundle.blocks.length ? <option value="">Sin bloques registrados</option> : null}
            {bundle.blocks.map((block) => <option key={block.block_id} value={block.block_id}>{block.title || block.name}</option>)}
          </select>
        </label>
        <label>
          Buscar coreografía
          <input
            type="search"
            placeholder="Nombre, academia, estado o ID"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setExpandedId("");
            }}
          />
        </label>
        <label>
          Disciplina
          <select
            value={discipline}
            onChange={(e) => {
              setDiscipline(e.target.value);
              setExpandedId("");
            }}
          >
            <option value="all">Todas</option>
            {(report?.sections || []).map((section) => (
              <option key={section.id} value={section.id}>
                {compactJudgingCategoryTitle(section.label)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado de evaluación
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setExpandedId("");
            }}
          >
            <option value="all">Todos</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <header>
        <h2>{report?.title || report?.name || "Dictamen final"}</h2>
      </header>
      {!readOnly && report && blockId ? <SheetReleaseControl key={`${bundle.event.id}:${blockId}`} eventId={bundle.event.id} blockId={blockId} revision={bundle.snapshot.fetchedAt} /> : null}
      {hasFilters ? (
        <div className="ja-report-filter-summary">
          <p role="status">
            {visibleCount} de {totalCount} coreografías del bloque.
          </p>
          <button type="button" onClick={resetFilters}>
            <X size={16} />
            Limpiar filtros
          </button>
        </div>
      ) : null}
      {sections.map((section) => (
          <section className={section.kind === "releve" ? "ja-report-releve" : undefined} aria-label={section.kind === "releve" ? "Premio Relevé" : compactJudgingCategoryTitle(section.label)} key={section.id}>
            {section.kind === "releve" ? <header><h2>Premio Relevé</h2><p>Premiación independiente</p></header> : <h2>{compactJudgingCategoryTitle(section.label)}</h2>}
            {section.kind === "releve" ? <ReleveAudienceFavorite favorite={report?.releveAudienceFavorite} /> : null}
            {section.categories.map((c) => (
              <section className="ja-report-category" key={c.id}>
                <h3>{compactJudgingCategoryTitle(c.title)}</h3>
                <div className="judging-scores__standings">
                  {c.rows.map(({ standing }) => render(standing))}
                </div>
              </section>
            ))}
          </section>
        ))}
      {!visibleCount ? (
        <Empty>
          {hasFilters
            ? "No hay coreografías que coincidan con los filtros de este bloque."
            : "No hay resultados disponibles para mostrar en este bloque."}
        </Empty>
      ) : null}
      <section className="ja-awards-report">
        <h2>Premios especiales</h2>
        {(report?.specialAwards || []).map((a) => (
          <div className={`${a.id === "champion_of_champions" ? "is-champion" : ""}${a.isAssigned ? "" : " is-unassigned"}`} key={a.id}>
            <span>{a.title}</span>
            <strong>{a.displayValue || "Sin asignar"}</strong>
          </div>
        ))}
      </section>
    </section>
  );
}
function FavoritesPanel({
  bundle,
  blockId,
  query,
  mutate,
}: {
  bundle: Bundle;
  blockId: string;
  query: string;
  mutate: (a: string, d: unknown) => Promise<void>;
}) {
  const categories = [
    { key: "costume", alias: "favorite_1", title: "Mejor vestuario" },
    {
      key: "choreography",
      alias: "favorite_2",
      title: "Mejor idea coreográfica",
    },
    { key: "music", alias: "favorite_3", title: "Mejor música" },
  ];
  return (
    <section className="ja-favorites">
      {categories.map((c) => {
        const votes = bundle.favorites.filter(
          (f) =>
            f.block_id === blockId && [c.key, c.alias].includes(f.category),
        );
        const routines = bundle.routines
          .filter(
            (r) =>
              r.block_id === blockId &&
              votes.some((v) => v.routine_id === r.routine_id) &&
              norm(`${r.name} ${r.academy}`).includes(norm(query)),
          )
          .map((r) => ({
            r,
            judges: [
              ...new Set(
                votes
                  .filter((v) => v.routine_id === r.routine_id)
                  .map((v) => v.judge_id),
              ),
            ],
          }))
          .sort((a, b) => b.judges.length - a.judges.length);
        return (
          <section key={c.key}>
            <header>
              <Star size={22} />
              <h2>{c.title}</h2>
            </header>
            {routines.map(({ r, judges }) => (
              <article key={r.routine_id}>
                <b className="ja-votes">
                  {judges.length}
                  <small>{judges.length === 1 ? "voto" : "votos"}</small>
                </b>
                <div>
                  <strong>
                    #{r.program_number?.trim() || r.routine_id} · {r.name}
                  </strong>
                  <p>{r.academy}</p>
                  <small>
                    {judges
                      .map(
                        (id) =>
                          bundle.judges.find((j) => j.judge_id === id)?.name ||
                          id,
                      )
                      .join(" · ")}
                  </small>
                </div>
              </article>
            ))}
            {!routines.length ? <Empty>Sin votos registrados.</Empty> : null}
          </section>
        );
      })}
      <section className="ja-manual-awards">
        <h2>Premios especiales</h2>
        {[
          "Mejor vestuario",
          "Mejor música",
          "Mejor idea coreográfica",
          "Mejor porra",
        ].map((label, index) => {
          const award = `award_${index + 1}`;
          return (
            <AwardForm
              key={`${blockId}-${award}-${bundle.specialAwards.find((a) => a.block_id === blockId && a.award === award)?.manual_value || ""}`}
              label={label}
              value={
                bundle.specialAwards.find(
                  (a) => a.block_id === blockId && a.award === award,
                )?.manual_value || ""
              }
              onSave={(value) =>
                mutate("special-award", {
                  block_id: blockId,
                  award,
                  manual_value: value,
                })
              }
            />
          );
        })}
      </section>
    </section>
  );
}
function AwardForm({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [text, setText] = useState(value),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave(text);
        } catch (e) {
          setError(errorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {label}
        <input
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          placeholder="Sin asignar"
        />
      </label>
      <IconButton
        label={`Guardar ${label}`}
        disabled={busy || text === value}
        onClick={() => {}}
        type="submit"
      >
        <Check size={19} />
      </IconButton>
      {error ? (
        <p className="ja-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
function ActivityPanel({
  judges,
  activity,
  routines,
  blocks,
  selectedBlockId,
}: {
  judges: Judge[];
  activity: Presence[];
  routines: Routine[];
  blocks: Block[];
  selectedBlockId: string;
}) {
  return (
    <section className="ja-activity">
      {judges.map((j) => {
        const devices = activity.filter((a) => a.judge_id === j.judge_id);
        const presence = currentJudgeActivity(activity, j.judge_id);
        const summary = judgeSheetSummary(activity, j.judge_id, routines, blocks, selectedBlockId, true);
        return (
          <article key={j.judge_id}>
            <details>
            <summary>
              <JudgeAvatar judge={j} />
              <span className="ja-activity-person"><strong>{j.name}</strong><small className="ja-activity-current">{summary.label}{summary.sheet ? ` · ${summary.sheet}` : ""}</small>{summary.block ? <small className="ja-activity-block">{summary.block}</small> : null}</span>
              <span
                className={`ja-status ${presence ? "is-complete" : "is-pending"}`}
              >
                {presence ? "Activo" : "Inactivo"}
              </span>
              <ChevronRight className="ja-activity-chevron" size={14} aria-hidden="true" />
            </summary>
            {devices.map((a) => {
              const stale =
                !a.sync_reported_at ||
                Date.now() - Date.parse(a.sync_reported_at) > 120000;
              return (
                <div className="ja-device" key={a.device_id}>
                  <strong>
                    {a.platform || "Dispositivo"} ·{" "}
                    {isScoring(a) ? "Hoja abierta" : a.state === "left_sheet" ? "Hoja cerrada" : a.state === "home" ? "En inicio" : "Sin hoja abierta"}
                  </strong>
                  <small>{a.device_id}</small>
                  <dl>
                    <div>
                      <dt>Última actividad</dt>
                      <dd>{time(a.updated_at)}</dd>
                    </div>
                    <div>
                      <dt>Coreografía</dt>
                      <dd>
                        {routines.find((r) => r.routine_id === a.routine_id)
                          ?.name || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Datos pendientes</dt>
                      <dd>
                        {stale
                          ? "Sin reporte reciente"
                          : (a.sync_diagnostics?.pending_count ??
                            "Sin reporte")}
                      </dd>
                    </div>
                    <div>
                      <dt>Última confirmación</dt>
                      <dd>
                        {time(
                          a.sync_diagnostics?.last_confirmed_at || undefined,
                        )}
                      </dd>
                    </div>
                  </dl>
                  {a.sync_diagnostics?.last_error ? (
                    <p className="ja-error">{a.sync_diagnostics.last_error}</p>
                  ) : null}
                </div>
              );
            })}
            {!devices.length ? <Empty>Sin actividad registrada.</Empty> : null}
            </details>
          </article>
        );
      })}
    </section>
  );
}
function ImportPanel({
  events,
  api,
  onImported,
  onEventAction,
}: {
  events: Event[];
  api: Api;
  onImported: (id: string) => Promise<void>;
  onEventAction: (a: string, e: Event) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("El Excel supera 20 MB.");
      const data = await fileBase64(file);
      const result = await api<{ event_id: string }>("import", {
        filename: file.name,
        name,
        payload_base64: data.split(",")[1],
      });
      await onImported(result.event_id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ja-import">
      <form onSubmit={submit}>
        <h2>Importar programa</h2>
        <label>
          Nombre del evento
          <input
            required
            maxLength={150}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="ja-drop">
          <FileSpreadsheet size={32} />
          <span>{file?.name || "Seleccionar Excel"}</span>
          <input
            type="file"
            required
            accept=".xls,.xlsx"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setConfirmed(false);
            }}
          />
        </label>
        <label className="ja-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Crear un evento nuevo e inactivo
        </label>
        {error ? (
          <p className="ja-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="ja-primary" disabled={!file || !confirmed || busy}>
          {busy ? (
            <LoaderCircle className="ja-spin" size={18} />
          ) : (
            <Plus size={18} />
          )}{" "}
          {busy ? "Importando…" : "Importar"}
        </button>
      </form>
      <section>
        <h2>Eventos de Levitate</h2>
        {events.map((e) => (
          <article className="ja-event-row" key={e.id}>
            <div>
              <strong>{e.name}</strong>
              <small>
                {e.event_type === "archived"
                  ? "Archivado"
                  : e.is_active
                    ? "Activo"
                    : "Inactivo"}
              </small>
            </div>
            <div>
              {e.event_type === "archived" ? (
                <button onClick={() => void onEventAction("restore", e)}>
                  Restaurar
                </button>
              ) : (
                <>
                  {!e.is_active ? (
                    <button onClick={() => void onEventAction("activate", e)}>
                      Activar
                    </button>
                  ) : null}
                  <button onClick={() => void onEventAction("archive", e)}>
                    Archivar
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
function SettingsPanel({
  event,
  onSave,
}: {
  event: Event;
  onSave: (d: unknown) => Promise<void>;
}) {
  const original = (event.competition_config?.scoring || {}) as Record<
    string,
    unknown
  >;
  const [aggregation, setAggregation] = useState(
      String(original.aggregation || "average"),
    ),
    [missing, setMissing] = useState(
      String(original.officialMissingScorePolicy || "zero"),
    ),
    [high, setHigh] = useState(Number(original.dropHighestCount || 0)),
    [low, setLow] = useState(Number(original.dropLowestCount || 0)),
    [penalties, setPenalties] = useState(original.includePenalties !== false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="ja-settings"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave({
            expected_updated_at: event.updated_at,
            configuration: {
              scoring: {
                ...original,
                aggregation,
                officialMissingScorePolicy: missing,
                missingScorePolicy: original.missingScorePolicy || "ignore",
                dropHighestCount: high,
                dropLowestCount: low,
                includePenalties: penalties,
              },
            },
          });
        } catch (e) {
          setError(errorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Cálculo oficial</h2>
      <label>
        Agregación
        <select
          value={aggregation}
          onChange={(e) => setAggregation(e.target.value)}
        >
          <option value="average">Promedio</option>
          <option value="sum">Suma</option>
        </select>
      </label>
      <label>
        Calificaciones faltantes
        <select value={missing} onChange={(e) => setMissing(e.target.value)}>
          <option value="zero">Contar como cero</option>
          <option value="ignore">Omitir</option>
        </select>
      </label>
      <div className="ja-two-fields">
        <label>
          Descartar mayores
          <input
            type="number"
            min={0}
            max={20}
            required
            value={high}
            onChange={(e) => setHigh(Number(e.target.value))}
          />
        </label>
        <label>
          Descartar menores
          <input
            type="number"
            min={0}
            max={20}
            required
            value={low}
            onChange={(e) => setLow(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="ja-check">
        <input
          type="checkbox"
          checked={penalties}
          onChange={(e) => setPenalties(e.target.checked)}
        />
        Incluir penalizaciones
      </label>
      {error ? (
        <p className="ja-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="ja-primary" disabled={busy}>
        <Check size={18} />
        Guardar configuración
      </button>
    </form>
  );
}
function savePdf(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(file);
  });
}
