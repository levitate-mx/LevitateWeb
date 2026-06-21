import {
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  KeyRound,
  Link2,
  RotateCcw,
  Save,
  Search,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  deleteMediaOverride,
  loadMediaOverrides,
  mediaSlots,
  readMediaAdminToken,
  readMediaOverrides,
  saveMediaOverride,
  writeMediaAdminToken,
  type MediaOverrideSource,
  type MediaSlot,
} from "../../data/mediaRegistry";

type Notice = {
  tone: "success" | "warning" | "error";
  text: string;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function matchesSlot(slot: MediaSlot, query: string, page: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const matchesPage = page === "Todas" || slot.page === page;

  if (!matchesPage) return false;
  if (!normalizedQuery) return true;

  return [slot.label, slot.page, slot.description, slot.defaultUrl].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

export function MediaManagerPanel() {
  const [drafts, setDrafts] = useState(readMediaOverrides);
  const [query, setQuery] = useState("");
  const [activePage, setActivePage] = useState("Todas");
  const [source, setSource] = useState<MediaOverrideSource>("local");
  const [adminToken, setAdminToken] = useState(readMediaAdminToken);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<Notice | null>(null);

  const pageOptions = useMemo(() => ["Todas", ...Array.from(new Set(mediaSlots.map((slot) => slot.page)))], []);
  const visibleSlots = useMemo(
    () => mediaSlots.filter((slot) => matchesSlot(slot, query, activePage)),
    [activePage, query],
  );

  useEffect(() => {
    let isMounted = true;

    void loadMediaOverrides().then((result) => {
      if (!isMounted) return;

      setDrafts(result.overrides);
      setSource(result.source);
      setIsLoading(false);

      if (result.source === "local" && result.errorMessage) {
        setNotice({
          tone: "warning",
          text: "La API de imágenes no respondió. El panel está usando el respaldo local de este navegador.",
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateDraft = (key: string, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
  };

  const handleAdminTokenSave = () => {
    const wasSaved = writeMediaAdminToken(adminToken);

    setNotice({
      tone: wasSaved ? "success" : "error",
      text: wasSaved
        ? "Token de edición guardado en este navegador."
        : "No se pudo guardar el token en este navegador.",
    });
  };

  const handleFileChange = async (slot: MediaSlot, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setNotice({ tone: "error", text: "El archivo debe ser una imagen." });
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      updateDraft(slot.key, dataUrl);
      setNotice({ tone: "success", text: `Imagen cargada para ${slot.label}. Guarda para aplicarla.` });
    } catch {
      setNotice({ tone: "error", text: "No se pudo cargar la imagen." });
    }
  };

  const handleSave = async (slot: MediaSlot) => {
    setSavingKeys((current) => new Set(current).add(slot.key));

    try {
      const result = await saveMediaOverride(slot.key, drafts[slot.key] || "");
      setDrafts(result.overrides);
      setSource(result.source);
      setNotice({
        tone: result.source === "api" ? "success" : "warning",
        text:
          result.source === "api"
            ? `${slot.label} actualizada en la API.`
            : `${slot.label} quedó guardada solo en este navegador. Revisa la conexión con la API.`,
      });
    } finally {
      setSavingKeys((current) => {
        const next = new Set(current);
        next.delete(slot.key);
        return next;
      });
    }
  };

  const handleReset = async (slot: MediaSlot) => {
    setSavingKeys((current) => new Set(current).add(slot.key));

    try {
      const result = await deleteMediaOverride(slot.key);
      setDrafts(result.overrides);
      setSource(result.source);
      setNotice({
        tone: result.source === "api" ? "success" : "warning",
        text:
          result.source === "api"
            ? `${slot.label} volvió a la imagen original en la API.`
            : `${slot.label} volvió a la imagen original solo en este navegador.`,
      });
    } finally {
      setSavingKeys((current) => {
        const next = new Set(current);
        next.delete(slot.key);
        return next;
      });
    }
  };

  return (
    <section className="levitate-admin-panel levitate-media-manager">
      <div className="levitate-admin-panel__heading">
        <p>Contenido editable</p>
        <h1>Imágenes del sitio</h1>
      </div>

      <div className="levitate-media-manager__body">
        <div className="levitate-media-manager__intro">
          <ImageIcon aria-hidden="true" size={30} strokeWidth={2.2} />
          <div>
            <strong>Cambia las imágenes sin tocar código.</strong>
            <p>
              Usa una URL pública o sube una imagen. Los cambios se guardan en la API cuando el backend está
              disponible.
            </p>
            <small>Origen actual: {source === "api" ? "API / base de datos" : "respaldo local"}</small>
          </div>
        </div>

        <div className="levitate-media-manager__toolbar" aria-label="Filtros de imágenes">
          <label className="levitate-admin-field">
            <span className="levitate-admin-field__label">
              <Search aria-hidden="true" size={18} /> Buscar imagen
            </span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hero, medalla, sponsor..."
              type="search"
              value={query}
            />
          </label>

          <label className="levitate-admin-field">
            <span className="levitate-admin-field__label">
              <KeyRound aria-hidden="true" size={18} /> Token de edición
            </span>
            <span className="levitate-media-manager__token-field">
              <input
                autoComplete="off"
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder="Opcional si no hay secret"
                type="password"
                value={adminToken}
              />
              <button onClick={handleAdminTokenSave} type="button">
                Guardar token
              </button>
            </span>
          </label>

          <label className="levitate-admin-field">
            <span className="levitate-admin-field__label">
              <ImageIcon aria-hidden="true" size={18} /> Página
            </span>
            <span className="levitate-admin-select">
              <select onChange={(event) => setActivePage(event.target.value)} value={activePage}>
                {pageOptions.map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>

        {notice ? (
          <p className={`levitate-media-manager__notice is-${notice.tone}`}>
            {notice.tone === "success" ? (
              <CheckCircle2 aria-hidden="true" size={18} />
            ) : (
              <AlertTriangle aria-hidden="true" size={18} />
            )}
            {notice.text}
          </p>
        ) : null}

        <div className="levitate-media-grid">
          {visibleSlots.map((slot) => {
            const draft = drafts[slot.key] || "";
            const previewSource = draft || slot.defaultUrl;
            const hasOverride = Boolean(draft.trim());
            const isSaving = savingKeys.has(slot.key);

            return (
              <article className={`levitate-media-card${hasOverride ? " has-override" : ""}`} key={slot.key}>
                <figure className="levitate-media-card__preview">
                  <img alt={slot.label} src={previewSource} loading="lazy" />
                </figure>

                <div className="levitate-media-card__body">
                  <div className="levitate-media-card__heading">
                    <div>
                      <span>{slot.page}</span>
                      <h2>{slot.label}</h2>
                    </div>
                    <small>{hasOverride ? "Personalizada" : "Original"}</small>
                  </div>

                  <p>{slot.description}</p>

                  <label className="levitate-admin-field">
                    <span className="levitate-admin-field__label">
                      <Link2 aria-hidden="true" size={17} /> URL de imagen
                    </span>
                    <input
                      onChange={(event) => updateDraft(slot.key, event.target.value)}
                      placeholder={slot.defaultUrl}
                      type="url"
                      value={draft}
                    />
                    <small>Original: {slot.defaultUrl}</small>
                  </label>

                  <div className="levitate-media-card__actions">
                    <label className="levitate-media-card__upload">
                      <Upload aria-hidden="true" size={18} />
                      Subir imagen
                      <input
                        accept="image/*"
                        disabled={isLoading || isSaving}
                        onChange={(event) => void handleFileChange(slot, event)}
                        type="file"
                      />
                    </label>

                    <button disabled={isLoading || isSaving} onClick={() => void handleSave(slot)} type="button">
                      <Save aria-hidden="true" size={18} />
                      {isSaving ? "Guardando" : "Guardar"}
                    </button>

                    <button
                      disabled={isLoading || isSaving || !hasOverride}
                      onClick={() => void handleReset(slot)}
                      type="button"
                    >
                      <RotateCcw aria-hidden="true" size={18} />
                      Original
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
