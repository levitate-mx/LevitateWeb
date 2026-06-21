export type MediaSlot = {
  key: string;
  label: string;
  page: string;
  description: string;
  defaultUrl: string;
  mediaType?: "image" | "video";
};

export type MediaOverrides = Record<string, string>;
export type MediaOverrideSource = "api" | "local";

export type MediaOverrideResult = {
  overrides: MediaOverrides;
  source: MediaOverrideSource;
  errorMessage?: string;
};

export const mediaOverrideStorageKey = "levitate-media-overrides";
export const mediaAdminTokenStorageKey = "levitate-media-admin-token";
export const mediaOverrideChangeEvent = "levitate-media-overrides-change";
export const mediaOverrideApiPath = "/api/media/overrides";

export const mediaSlots: MediaSlot[] = [
  {
    key: "visual.hero",
    label: "Hero principal",
    page: "Home y Aerial",
    description: "Imagen escénica usada en hero, CTA final, Aerial y varias secciones de alto impacto.",
    defaultUrl: "/assets/visuals/hero-stage.jpg",
  },
  {
    key: "visual.competition",
    label: "Competencia / Motion",
    page: "Home, Motion y premiación",
    description: "Imagen principal de competencia usada en experiencias, evaluaciones Motion y fondos destacados.",
    defaultUrl: "/assets/visuals/experience-competition.jpg",
  },
  {
    key: "visual.workshops",
    label: "Workshops",
    page: "Home y Workshops",
    description: "Imagen de formación y entrenamiento para secciones de workshops y tarjetas editoriales.",
    defaultUrl: "/assets/visuals/experience-workshops.jpg",
  },
  {
    key: "visual.community",
    label: "Comunidad",
    page: "Home, Sedes y premiación",
    description: "Imagen de comunidad/backstage para galería, sedes, premios especiales y reconocimientos.",
    defaultUrl: "/assets/visuals/gallery-community.jpg",
  },
  {
    key: "visual.venue",
    label: "Sede / escenario",
    page: "Home y Sedes",
    description: "Imagen de venue usada en sedes, trofeos, eventos y bloques de convocatoria.",
    defaultUrl: "/assets/visuals/venue-stage.jpg",
  },
  {
    key: "premiation.hero",
    label: "Hero de premiación",
    page: "Premiación",
    description: "Imagen poster/fallback del hero principal de la página de premiación.",
    defaultUrl: "/assets/visuals/experience-competition.jpg",
  },
  {
    key: "premiation.hero.video",
    label: "Hero de premiación - Video",
    page: "Premiación",
    description: "Video de fondo del hero principal de la página de premiación.",
    defaultUrl: "/assets/visuals/workshops-experience-bg.mp4",
    mediaType: "video",
  },
  {
    key: "premiation.direct.second",
    label: "Ranking directo - 2do lugar",
    page: "Premiación",
    description: "Imagen de la tarjeta de segundo lugar en competencia directa.",
    defaultUrl: "/assets/visuals/gallery-community.jpg",
  },
  {
    key: "premiation.direct.first",
    label: "Ranking directo - 1er lugar",
    page: "Premiación",
    description: "Imagen de la tarjeta destacada de primer lugar en competencia directa.",
    defaultUrl: "/assets/visuals/venue-stage.jpg",
  },
  {
    key: "premiation.direct.third",
    label: "Ranking directo - 3er lugar",
    page: "Premiación",
    description: "Imagen de la tarjeta de tercer lugar en competencia directa.",
    defaultUrl: "/assets/visuals/experience-workshops.jpg",
  },
  {
    key: "premiation.medal-system.motion",
    label: "Medallero - Motion",
    page: "Premiación",
    description: "Imagen del bloque de sistema de medallero para Motion.",
    defaultUrl: "/assets/visuals/experience-competition.jpg",
  },
  {
    key: "premiation.medal-system.aerial",
    label: "Medallero - Aerial",
    page: "Premiación",
    description: "Imagen del bloque de sistema de medallero para Aerial.",
    defaultUrl: "/assets/visuals/hero-stage.jpg",
  },
  {
    key: "premiation.recognition.medals",
    label: "Reconocimientos - Medallas",
    page: "Premiación",
    description: "Imagen de la tarjeta de reconocimientos de medallas.",
    defaultUrl: "/assets/medallero-oro.png",
  },
  {
    key: "premiation.recognition.trophies",
    label: "Reconocimientos - Trofeos",
    page: "Premiación",
    description: "Imagen de la tarjeta de reconocimientos de trofeos.",
    defaultUrl: "/assets/visuals/venue-stage.jpg",
  },
  {
    key: "premiation.recognition.special",
    label: "Reconocimientos - Premios especiales",
    page: "Premiación",
    description: "Imagen de la tarjeta de reconocimientos de premios especiales.",
    defaultUrl: "/assets/visuals/gallery-community.jpg",
  },
  {
    key: "premiation.special.music",
    label: "Premios especiales - Mejor música",
    page: "Premiación",
    description: "Imagen del panel de premio especial a mejor música.",
    defaultUrl: "/assets/visuals/venue-stage.jpg",
  },
  {
    key: "premiation.special.choreography",
    label: "Premios especiales - Mejor coreografía",
    page: "Premiación",
    description: "Imagen del panel de premio especial a mejor coreografía.",
    defaultUrl: "/assets/visuals/experience-workshops.jpg",
  },
  {
    key: "premiation.special.costume",
    label: "Premios especiales - Mejor vestuario",
    page: "Premiación",
    description: "Imagen del panel de premio especial a mejor vestuario.",
    defaultUrl: "/assets/visuals/experience-competition.jpg",
  },
  {
    key: "premiation.special.cheer",
    label: "Premios especiales - Mejor porra",
    page: "Premiación",
    description: "Imagen del panel de premio especial a mejor porra.",
    defaultUrl: "/assets/visuals/gallery-community.jpg",
  },
  {
    key: "premiation.mvp.motion",
    label: "MVP Motion",
    page: "Premiación",
    description: "Imagen de la tarjeta MVP Motion.",
    defaultUrl: "/assets/visuals/experience-workshops.jpg",
  },
  {
    key: "premiation.mvp.aerial",
    label: "MVP Aerial",
    page: "Premiación",
    description: "Imagen de la tarjeta MVP Aerial.",
    defaultUrl: "/assets/visuals/experience-competition.jpg",
  },
  {
    key: "medal.gold",
    label: "Medalla oro",
    page: "Premiación",
    description: "Imagen de medalla para oro y reconocimientos relacionados.",
    defaultUrl: "/assets/medallero-oro.png",
  },
  {
    key: "medal.silver",
    label: "Medalla plata",
    page: "Premiación",
    description: "Imagen de medalla para plata.",
    defaultUrl: "/assets/medallero-plata.png",
  },
  {
    key: "medal.bronze",
    label: "Medalla bronce",
    page: "Premiación",
    description: "Imagen de medalla para bronce.",
    defaultUrl: "/assets/medallero-bronce.png",
  },
  {
    key: "medal.participation",
    label: "Medalla participación",
    page: "Premiación",
    description: "Imagen de medalla para participación.",
    defaultUrl: "/assets/medallero-participacion.png",
  },
  {
    key: "sponsor.electrolit",
    label: "Sponsor Electrolit",
    page: "Home",
    description: "Logo de sponsor mostrado en la página principal.",
    defaultUrl: "/assets/electrolit-logo.png",
  },
  {
    key: "sponsor.costa-rica-open",
    label: "Sponsor Costa Rica Open",
    page: "Home",
    description: "Logo de sponsor disponible para bloques de aliados.",
    defaultUrl: "/assets/costa-rica-open-logo.png",
  },
  {
    key: "sponsor.dnzre",
    label: "Sponsor DNZRE",
    page: "Home",
    description: "Logo de sponsor disponible para bloques de aliados.",
    defaultUrl: "/assets/dnzre-logo.png",
  },
  {
    key: "workshop.aro",
    label: "Icono Aro",
    page: "Workshops",
    description: "Icono de disciplina para workshop de aro.",
    defaultUrl: "/assets/icons/workshops/aro.png",
  },
  {
    key: "workshop.telas",
    label: "Icono Telas",
    page: "Workshops",
    description: "Icono de disciplina para workshop de telas.",
    defaultUrl: "/assets/icons/workshops/telas.png",
  },
  {
    key: "workshop.trapecio",
    label: "Icono Trapecio",
    page: "Workshops",
    description: "Icono de disciplina para workshop de trapecio.",
    defaultUrl: "/assets/icons/workshops/trapecio.png",
  },
  {
    key: "workshop.cintas",
    label: "Icono Cintas",
    page: "Workshops",
    description: "Icono de disciplina para workshop de cintas.",
    defaultUrl: "/assets/icons/workshops/cintas.png",
  },
  {
    key: "workshop.flex",
    label: "Icono Flex",
    page: "Workshops",
    description: "Icono para entrenamientos de flexibilidad.",
    defaultUrl: "/assets/icons/workshops/flex.png",
  },
  {
    key: "workshop.expresion-corporal",
    label: "Icono Expresión corporal",
    page: "Workshops",
    description: "Icono para expresión corporal.",
    defaultUrl: "/assets/icons/workshops/expresion-corporal.png",
  },
  {
    key: "workshop.hair",
    label: "Icono Hair",
    page: "Workshops",
    description: "Icono para styling, cabello o preparación escénica.",
    defaultUrl: "/assets/icons/workshops/hair.png",
  },
  {
    key: "workshop.shirt",
    label: "Icono Vestuario",
    page: "Workshops",
    description: "Icono para vestuario.",
    defaultUrl: "/assets/icons/workshops/shirt.png",
  },
  {
    key: "workshop.water",
    label: "Icono Hidratación",
    page: "Workshops",
    description: "Icono para hidratación o bienestar.",
    defaultUrl: "/assets/icons/workshops/water.png",
  },
  {
    key: "workshop.info",
    label: "Icono Información",
    page: "Workshops",
    description: "Icono auxiliar de información.",
    defaultUrl: "/assets/icons/workshops/info.png",
  },
];

export const mediaSlotsByKey = new Map(mediaSlots.map((slot) => [slot.key, slot]));

export function normalizeMediaSource(source: string) {
  if (!source) return "";
  if (source.startsWith("data:")) return source;

  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://levitate.local";
    const url = new URL(source, base);

    return url.origin === base ? url.pathname : url.href;
  } catch {
    return source;
  }
}

export const mediaSlotsByDefaultUrl = new Map(mediaSlots.map((slot) => [normalizeMediaSource(slot.defaultUrl), slot]));

export function mediaCssVariableName(key: string) {
  return `--levitate-media-${key.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}`;
}

let cachedMediaOverrides: MediaOverrides = readLocalMediaOverrides();
let currentMediaOverrideSource: MediaOverrideSource = "local";

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function canUseFetch() {
  return typeof window !== "undefined" && typeof window.fetch === "function";
}

function readLocalMediaOverrides(): MediaOverrides {
  if (!canUseLocalStorage()) return {};

  try {
    const rawOverrides = window.localStorage.getItem(mediaOverrideStorageKey);
    const parsedOverrides = rawOverrides ? JSON.parse(rawOverrides) : {};

    return parsedOverrides && typeof parsedOverrides === "object" ? parsedOverrides : {};
  } catch {
    return {};
  }
}

function sanitizeMediaOverrides(overrides: unknown): MediaOverrides {
  if (!overrides || typeof overrides !== "object") return {};

  return Object.fromEntries(
    Object.entries(overrides).filter((entry): entry is [string, string] => {
      const [key, value] = entry;
      return mediaSlotsByKey.has(key) && typeof value === "string" && value.trim().length > 0;
    }),
  );
}

function mediaOverrideErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo conectar con la API de imágenes.";
}

export function readMediaAdminToken() {
  if (!canUseLocalStorage()) return "";

  try {
    return window.localStorage.getItem(mediaAdminTokenStorageKey) || "";
  } catch {
    return "";
  }
}

export function writeMediaAdminToken(token: string) {
  if (!canUseLocalStorage()) return false;

  try {
    const nextToken = token.trim();

    if (nextToken) {
      window.localStorage.setItem(mediaAdminTokenStorageKey, nextToken);
    } else {
      window.localStorage.removeItem(mediaAdminTokenStorageKey);
    }

    return true;
  } catch {
    return false;
  }
}

function mediaApiHeaders(hasBody = false) {
  const headers: Record<string, string> = {
    accept: "application/json",
  };
  const token = readMediaAdminToken();

  if (hasBody) {
    headers["content-type"] = "application/json";
  }

  if (token) {
    headers["x-levitate-admin-token"] = token;
  }

  return headers;
}

async function readMediaApiResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`La API respondió ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("La API no devolvió JSON.");
  }

  return response.json();
}

function announceMediaOverrideChange() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(mediaOverrideChangeEvent, {
      detail: {
        overrides: cachedMediaOverrides,
        source: currentMediaOverrideSource,
      },
    }),
  );
}

export function readMediaOverrides(): MediaOverrides {
  return cachedMediaOverrides;
}

export function getMediaOverrideSource() {
  return currentMediaOverrideSource;
}

export function writeMediaOverrides(overrides: MediaOverrides, source: MediaOverrideSource = "local") {
  cachedMediaOverrides = sanitizeMediaOverrides(overrides);
  currentMediaOverrideSource = source;

  let wasStoredLocally = true;

  try {
    if (canUseLocalStorage()) {
      window.localStorage.setItem(mediaOverrideStorageKey, JSON.stringify(cachedMediaOverrides));
    }
  } catch {
    wasStoredLocally = false;
  }

  announceMediaOverrideChange();

  return wasStoredLocally;
}

export function setMediaOverride(key: string, value: string) {
  const overrides = { ...cachedMediaOverrides };
  const nextValue = value.trim();

  if (nextValue) {
    overrides[key] = nextValue;
  } else {
    delete overrides[key];
  }

  return writeMediaOverrides(overrides);
}

export function resetMediaOverride(key: string) {
  const overrides = { ...cachedMediaOverrides };
  delete overrides[key];

  return writeMediaOverrides(overrides);
}

export async function loadMediaOverrides(): Promise<MediaOverrideResult> {
  if (!canUseFetch()) {
    const overrides = readLocalMediaOverrides();
    writeMediaOverrides(overrides, "local");

    return { overrides, source: "local" };
  }

  try {
    const response = await fetch(mediaOverrideApiPath, {
      headers: mediaApiHeaders(),
    });

    const payload = await readMediaApiResponse(response);
    const overrides = sanitizeMediaOverrides(payload.overrides);
    writeMediaOverrides(overrides, "api");

    return { overrides, source: "api" };
  } catch (error) {
    const overrides = readLocalMediaOverrides();
    writeMediaOverrides(overrides, "local");

    return { overrides, source: "local", errorMessage: mediaOverrideErrorMessage(error) };
  }
}

export async function saveMediaOverride(key: string, value: string): Promise<MediaOverrideResult> {
  const nextValue = value.trim();

  if (!nextValue) {
    return deleteMediaOverride(key);
  }

  if (!canUseFetch()) {
    setMediaOverride(key, nextValue);

    return { overrides: cachedMediaOverrides, source: "local" };
  }

  try {
    const response = await fetch(mediaOverrideApiPath, {
      method: "PUT",
      headers: mediaApiHeaders(true),
      body: JSON.stringify({ key, value: nextValue }),
    });

    const payload = await readMediaApiResponse(response);
    const overrides = sanitizeMediaOverrides(payload.overrides);
    writeMediaOverrides(overrides, "api");

    return { overrides, source: "api" };
  } catch (error) {
    setMediaOverride(key, nextValue);

    return { overrides: cachedMediaOverrides, source: "local", errorMessage: mediaOverrideErrorMessage(error) };
  }
}

export async function deleteMediaOverride(key: string): Promise<MediaOverrideResult> {
  if (!canUseFetch()) {
    resetMediaOverride(key);

    return { overrides: cachedMediaOverrides, source: "local" };
  }

  try {
    const response = await fetch(`${mediaOverrideApiPath}?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: mediaApiHeaders(),
    });

    const payload = await readMediaApiResponse(response);
    const overrides = sanitizeMediaOverrides(payload.overrides);
    writeMediaOverrides(overrides, "api");

    return { overrides, source: "api" };
  } catch (error) {
    resetMediaOverride(key);

    return { overrides: cachedMediaOverrides, source: "local", errorMessage: mediaOverrideErrorMessage(error) };
  }
}

export function getMediaUrl(key: string, fallback = "") {
  return cachedMediaOverrides[key] || mediaSlotsByKey.get(key)?.defaultUrl || fallback;
}
