import * as XLSX from "npm:xlsx@0.18.5";
import { DEFAULT_TEMPLATES } from "./default_templates.ts";
import { REGISTRATION_COLUMN_ALIASES, RegistrationLinkError, assertRegistrationTokenPrivate,
  collectRegistrationLink, postRegistrationLink, registrationMetadataForRow } from "./registration_link.js";

type AnyRow = Record<string, unknown>;

type Criterion = {
  id: number;
  section: string;
  label: string;
  maxScore: number;
  feedbackRequired?: boolean;
  isRequired?: boolean;
};

type Template = {
  templateID?: string;
  version?: number;
  genre: string;
  title: string;
  maxScore: number;
  appliesTo?: TemplateApplicability;
  feedbackRequired?: boolean;
  criteria: Criterion[];
};

type TemplateApplicability = {
  primary_categories?: string[];
  divisions?: string[];
  levels?: string[];
  categories?: string[];
  segments?: string[];
};

type TemplateSource = {
  readonly templateID?: string;
  readonly version?: number;
  readonly genre: string;
  readonly title: string;
  readonly maxScore: number;
  readonly appliesTo?: TemplateApplicability;
  readonly feedbackRequired?: boolean;
  readonly criteria: readonly {
    readonly id: number;
    readonly section: string;
    readonly label: string;
    readonly maxScore: number;
    readonly feedbackRequired?: boolean;
    readonly isRequired?: boolean;
  }[];
};

type Routine = {
  id: string;
  blockID: string;
  block: string;
  name: string;
  academy: string;
  division: string;
  genre: string;
  level: string;
  category: string;
  choreographer: string;
  participant: string;
  state: string;
  time: string;
  duration: string;
  registrationMetadataPresent?: boolean;
  registrationDanceID?: string;
  registrationEventID?: string;
  registrationToken?: string;
};

type DanceBlock = {
  blockID: string;
  name: string;
  title: string;
  sortOrder: number;
  isActive: boolean;
  routines: Routine[];
};

type AppData = {
  sourceName: string;
  blocks: DanceBlock[];
  routines: Routine[];
  templates: Template[];
  judges: string[];
  warnings: string[];
};

type AccessCodeDelivery = {
  event_id: string;
  judge_id: string;
  judge_name: string;
  role: string;
  access_code: string;
};

type EntryColumn =
  | "entryID"
  | "segment"
  | "name"
  | "academy"
  | "division"
  | "genre"
  | "level"
  | "category"
  | "choreographer"
  | "participant"
  | "state"
  | "time"
  | "duration"
  | "registrationDanceID"
  | "registrationEventID"
  | "registrationToken";

type EntryColumnAliases = Record<EntryColumn, string[]>;

type TemplateColumn = "criterionID" | "section" | "label" | "maxScore";
type TemplateColumnAliases = Record<TemplateColumn, string[]>;

type ImportPayload = {
  event_slug?: string;
  event_name?: string;
  filename?: string;
  payload_base64?: string;
  field_aliases?: Partial<Record<EntryColumn, string[]>>;
  default_evaluators?: string[];
  admin_evaluator_ids?: string[];
  allow_embedded_templates?: boolean;
  competition_config?: AnyRow;
  activate?: boolean;
  replace_event?: boolean;
  force_replace?: boolean;
  dry_run?: boolean;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_ADMIN_NAME = "Admin";
const DEFAULT_ADMIN_ID = "admin";
const DEFAULT_JUDGE_PROFILES = [
  { name: DEFAULT_ADMIN_NAME, heroImageName: "" },
];
const DEFAULT_JUDGES = DEFAULT_JUDGE_PROFILES.map((profile) => profile.name);
const DEFAULT_ADMIN_EVALUATOR_IDS = [DEFAULT_ADMIN_ID];

const DEFAULT_ENTRY_COLUMN_ALIASES: EntryColumnAliases = {
  ...REGISTRATION_COLUMN_ALIASES,
  entryID: ["#", "ID", "N", "NO", "NRO", "NUMERO", "NÚMERO", "ORDEN", "ENTRY ID", "ROUTINE ID", "CODIGO", "CÓDIGO"],
  segment: ["BLOQUE", "SEGMENTO", "RONDA", "ROUND", "SEGMENT", "HEAT", "GRUPO DE COMPETENCIA"],
  name: [
    "COREOGRAFIA",
    "COREOGRAFÍA",
    "RUTINA",
    "NOMBRE",
    "NOMBRE RUTINA",
    "NOMBRE DE RUTINA",
    "ENTRADA",
    "NOMBRE ENTRADA",
    "NOMBRE DE ENTRADA",
    "ENTRY",
    "ENTRY NAME",
    "ROUTINE",
    "ROUTINE NAME",
    "PRESENTACION",
    "PRESENTACIÓN",
    "PERFORMANCE",
    "OBRA",
    "PROYECTO",
  ],
  academy: [
    "ACADEMIA",
    "ESCUELA",
    "ORGANIZACION",
    "ORGANIZACIÓN",
    "INSTITUCION",
    "INSTITUCIÓN",
    "EQUIPO",
    "CLUB",
    "DELEGACION",
    "DELEGACIÓN",
    "COMPAÑIA",
    "COMPAÑÍA",
    "AGRUPACION",
    "AGRUPACIÓN",
    "STUDIO",
    "SCHOOL",
    "ORGANIZATION",
    "TEAM",
  ],
  division: ["DIVISION", "DIVISIÓN", "RAMA", "GRUPO", "GROUP", "AGE GROUP", "RANGO", "RANGO ETARIO", "CLASE", "DIVISION NAME"],
  genre: ["GENERO", "GÉNERO", "GENERO/SUBGENERO", "MODALIDAD", "DISCIPLINA", "TIPO", "TYPE", "GENRE", "TRACK", "CIRCUITO"],
  level: ["NIVEL", "LEVEL", "DIFICULTAD", "EXPERIENCIA", "CATEGORIA DE NIVEL"],
  category: ["CATEGORIA", "CATEGORÍA", "CATEGORY", "SUBCATEGORIA", "SUBCATEGORÍA", "FORMATO", "CLASS"],
  choreographer: [
    "COREOGRAFO",
    "COREÓGRAFO",
    "RESPONSABLE",
    "ENTRENADOR",
    "COACH",
    "DIRECTOR",
    "CREADOR",
    "AUTOR",
    "TUTOR",
  ],
  participant: ["PARTICIPANTE", "PARTICIPANTES", "ATLETA", "ATLETAS", "INTEGRANTES", "COMPETIDOR", "COMPETIDORES"],
  state: ["ESTADO", "STATUS", "STATE", "SITUACION", "SITUACIÓN"],
  time: ["HORARIO", "HORA", "TIME", "SCHEDULED TIME", "SCHEDULED_TIME", "START TIME", "START_TIME", "TURNO"],
  duration: ["DURACION", "DURACIÓN", "DURATION", "TIEMPO", "MINUTOS"],
};

const REQUIRED_ENTRY_COLUMNS: Partial<Record<EntryColumn, string>> = {
  name: "entrada/coreografia",
};

const TEMPLATE_TITLE_MARKERS = [
  "HOJA DE JUECEO",
  "HOJA DE EVALUACION",
  "HOJA DE EVALUACIÓN",
  "RUBRICA",
  "RÚBRICA",
  "SCORECARD",
  "EVALUATION SHEET",
  "CRITERIOS DE EVALUACION",
  "CRITERIOS DE EVALUACIÓN",
];

const DEFAULT_TEMPLATE_COLUMN_ALIASES: TemplateColumnAliases = {
  criterionID: ["#", "ID", "N", "NO", "NRO", "NUMERO", "NÚMERO", "ORDEN", "CRITERIO ID", "CRITERION ID"],
  section: ["SECCION", "SECCIÓN", "AREA", "ÁREA", "GRUPO", "BLOQUE", "RUBRO", "SECTION", "GROUP"],
  label: ["CRITERIO", "CRITERIOS", "CONCEPTO", "ITEM", "ÍTEM", "INDICADOR", "DESCRIPCION", "DESCRIPCIÓN", "LABEL", "CRITERION", "DESCRIPTION"],
  maxScore: ["PUNTAJE", "PUNTAJE MAXIMO", "PUNTAJE MÁXIMO", "MAXIMO", "MÁXIMO", "VALOR", "PUNTOS", "MAX SCORE", "MAXIMUM SCORE", "POINTS", "SCORE"],
};

const TEMPLATE_ALIASES: Record<string, string> = {
  ARO: "DANZA AEREA",
  TELA: "DANZA AEREA",
  TRAPECIO: "DANZA AEREA",
  URBANOS: "HIP HOP",
  OPEN: "CONTEMPORANEO",
  "BELLY DANCE": "BELLYDANCE",
};

class HTTPError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido." }, 405);
  }

  try {
    const payload = await request.json() as ImportPayload;
    const sourceName = cleanText(payload.filename) || "import.xlsx";
    const slug = stableID(payload.event_slug || sourceName.replace(/\.[^.]+$/, ""));
    const eventName = cleanText(payload.event_name) || sourceName.replace(/\.[^.]+$/, "");
    const payloadBase64 = cleanText(payload.payload_base64);
    if (!payloadBase64) {
      throw new HTTPError(400, "Falta payload_base64.");
    }

    const fieldAliases = mergedEntryColumnAliases(payload.field_aliases);
    const defaultJudges = cleanTextArray(payload.default_evaluators, DEFAULT_JUDGES);
    const adminEvaluatorIDs = cleanTextArray(payload.admin_evaluator_ids, DEFAULT_ADMIN_EVALUATOR_IDS)
      .map(stableID);
    const appData = parseWorkbook(sourceName, payloadBase64, {
      fieldAliases,
      defaultJudges,
      allowEmbeddedTemplates: payload.allow_embedded_templates ?? true,
    });
    const registrationLink = collectRegistrationLink(appData.routines, {
      replaceEvent: payload.replace_event ?? false, forceReplace: payload.force_replace ?? false,
    });
    if (registrationLink) {
      const publicRoutine = (routine: Routine) => {
        const { registrationMetadataPresent: _present, registrationDanceID: _dance,
          registrationEventID: _event, registrationToken: _token, ...publicValue } = routine;
        return publicValue;
      };
      assertRegistrationTokenPrivate({ sourceName, eventName, slug,
        competitionConfig: payload.competition_config,
        routines: appData.routines.map(publicRoutine),
        blocks: appData.blocks.map(block => ({ ...block, routines: block.routines.map(publicRoutine) })),
        templates: appData.templates, judges: appData.judges,
      }, registrationLink.token);
    }
    if (payload.dry_run) {
      return jsonResponse({
        event_id: "",
        event_slug: slug,
        event_name: eventName,
        routines: appData.routines.length,
        blocks: appData.blocks.length,
        templates: appData.templates.length,
        admin_access_code: "",
        access_codes: [],
        dry_run: true,
        warnings: appData.warnings,
      });
    }

    const eventID = await uploadToSupabase(appData, {
      slug,
      name: eventName,
      adminEvaluatorIDs,
      competitionConfig: competitionConfigPayload(payload.competition_config),
      activate: payload.activate ?? true,
      replaceEvent: payload.replace_event ?? false,
      forceReplace: payload.force_replace ?? false,
    });
    if (registrationLink) await postRegistrationLink(registrationLink, eventID);
    const accessCodes = await fetchAccessCodes(eventID);
    const adminAccessCode = accessCodes.find((accessCode) => accessCode.role === "admin")?.access_code ?? "";

    return jsonResponse({
      event_id: eventID,
      event_slug: slug,
      event_name: eventName,
      routines: appData.routines.length,
      blocks: appData.blocks.length,
      templates: appData.templates.length,
      admin_access_code: adminAccessCode,
      access_codes: accessCodes,
      warnings: appData.warnings,
      ...(registrationLink ? { registration_linked: true } : {}),
    });
  } catch (error) {
    const status = error instanceof HTTPError || error instanceof RegistrationLinkError ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, status);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalized(value: unknown): string {
  return cleanText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

function stableID(value: unknown): string {
  const base = normalized(value).toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "sin-dato";
}

function normalizeAccessCode(value: unknown): string {
  return normalized(value).replace(/[^A-Z0-9]/g, "");
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanTextArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const cleaned = value.map(cleanText).filter(Boolean);
  return cleaned.length ? cleaned : [...fallback];
}

function competitionConfigPayload(value: unknown): AnyRow | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return undefined;
  }
  return value as AnyRow;
}

function mergedEntryColumnAliases(customAliases: ImportPayload["field_aliases"]): EntryColumnAliases {
  const aliases = Object.fromEntries(
    Object.entries(DEFAULT_ENTRY_COLUMN_ALIASES).map(([key, values]) => [key, [...values]]),
  ) as EntryColumnAliases;
  if (!customAliases || typeof customAliases !== "object") {
    return aliases;
  }

  for (const [column, values] of Object.entries(customAliases)) {
    if (Object.hasOwn(REGISTRATION_COLUMN_ALIASES, column) || !isEntryColumn(column) || !Array.isArray(values)) {
      continue;
    }
    const existing = new Set(aliases[column].map(headerKey));
    for (const value of values) {
      const text = cleanText(value);
      const key = headerKey(text);
      if (text && !existing.has(key)) {
        aliases[column].push(text);
        existing.add(key);
      }
    }
  }
  return aliases;
}

function isEntryColumn(value: string): value is EntryColumn {
  return value in DEFAULT_ENTRY_COLUMN_ALIASES;
}

function headerKey(value: unknown): string {
  return normalized(value).replace(/[^A-Z0-9]+/g, " ").trim();
}

function headerCompactKey(value: unknown): string {
  return normalized(value).replace(/[^A-Z0-9]+/g, "");
}

function columnMatches(value: unknown, aliases: readonly string[]): boolean {
  const compactValue = headerCompactKey(value);
  if (!compactValue) {
    return false;
  }

  return aliases.some((alias) => {
    const compactAlias = headerCompactKey(alias);
    if (!compactAlias) {
      return false;
    }
    if (compactValue === compactAlias) {
      return true;
    }
    return compactAlias.length >= 5 && compactValue.includes(compactAlias);
  });
}

function rowText(row: unknown[], index: number | undefined): string {
  if (index === undefined || index < 0 || index >= row.length) {
    return "";
  }
  return cleanText(row[index]);
}

function parseNumber(value: unknown): number {
  const text = cleanText(value).replace(",", ".");
  if (!text) {
    return Number.NaN;
  }
  return Number(text);
}

function compactNumberText(value: unknown): string {
  const number = parseNumber(value);
  if (!Number.isFinite(number)) {
    return cleanText(value);
  }
  return Number.isInteger(number) ? String(number) : String(Number(number.toPrecision(12)));
}

function routineIDText(value: unknown): string {
  const text = cleanText(value);
  if (!text) {
    return "";
  }
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) && Number.isInteger(number) ? String(number) : text.replace(/\.0$/, "");
}

function parseWorkbook(
  sourceName: string,
  payloadBase64: string,
  options: { fieldAliases: EntryColumnAliases; defaultJudges: string[]; allowEmbeddedTemplates: boolean },
): AppData {
  const workbook = XLSX.read(payloadBase64, {
    type: "base64",
    cellFormula: true,
    cellNF: true,
    cellText: true,
  });

  const blocks: DanceBlock[] = [];
  const templates: Template[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const hasDailySchedule = workbook.SheetNames.some((sheetName) => {
    if (!/^(?:SABADO|DOMINGO)(?:\b|_)/.test(normalized(sheetName))) return false;
    const rows = sheetRows(workbook.Sheets[sheetName]);
    const header = rows.find((row) => hasMinimumEntryColumns(entryColumnMap(row, options.fieldAliases)));
    const columns = entryColumnMap(header || [], options.fieldAliases);
    return columns.time !== undefined && rows.some((row) => programSectionTitle(row, columns))
      && parseBlocks(sheetName, workbook.Sheets[sheetName], options.fieldAliases).some((block) => block.routines.length);
  });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (hasDailySchedule && /^LEVITATE[ _-]+PROGRAMA(?:\s*\(\d+\))?$/.test(normalized(sheetName))) {
      warnings.push(`Se omitió la hoja de referencia ${sheetName}. Se usan las hojas del programa diario.`);
      continue;
    }
    blocks.push(...parseBlocks(sheetName, sheet, options.fieldAliases, warnings));

    const template = parseTemplate(sheetName, sheet);
    if (template) {
      templates.push(template);
    }
  }

  const mergedBlocks = mergeBlocks(blocks);
  const routines = mergedBlocks.flatMap((block) => block.routines);
  if (routines.length && templates.length === 0 && options.allowEmbeddedTemplates) {
    templates.push(...cloneTemplates(DEFAULT_TEMPLATES));
    warnings.push("Se usan plantillas base embebidas en la funcion import-excel.");
  }
  if (routines.length && templates.length === 0 && !options.allowEmbeddedTemplates) {
    errors.push("Faltan hojas de evaluacion o rubricas. Agrega una hoja con criterios y puntaje maximo.");
  }

  const judges = withRequiredPeople(parseJudges(workbook, warnings), options.defaultJudges);
  const routineIDs = new Set<string>();
  for (const routine of routines) {
    if (routineIDs.has(routine.id)) {
      errors.push(`Rutina duplicada: #${routine.id}.`);
    }
    routineIDs.add(routine.id);
  }

  const templateWarnings = ensureTemplatesForRoutines(templates, routines);
  warnings.push(...templateWarnings);

  if (errors.length) {
    throw new HTTPError(422, errors.join("; "));
  }

  return {
    sourceName,
    blocks: mergedBlocks,
    routines,
    templates,
    judges,
    warnings,
  };
}

function cloneTemplates(templates: readonly TemplateSource[]): Template[] {
  return templates.map((template) => ({
    templateID: template.templateID,
    version: template.version,
    genre: template.genre,
    title: template.title,
    maxScore: template.maxScore,
    appliesTo: template.appliesTo,
    feedbackRequired: template.feedbackRequired,
    criteria: template.criteria.map((criterion) => ({ ...criterion })),
  }));
}

function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  const ref = sheet["!ref"];
  if (!ref) {
    return [];
  }
  const range = XLSX.utils.decode_range(ref);
  const rows: unknown[][] = [];
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row: unknown[] = [];
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      row.push(cellText(sheet, rowIndex, columnIndex));
    }
    rows.push(row);
  }
  return rows;
}

function cellText(sheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] as XLSX.CellObject | undefined;
  if (!cell) {
    return "";
  }
  if (cell.w !== undefined) {
    return cleanText(cell.w);
  }
  if (cell.v instanceof Date) {
    return formatDateCell(cell.v);
  }
  if (typeof cell.v === "number" && cell.v >= 0 && cell.v < 1 && cleanText(cell.z).toLowerCase().includes("h")) {
    return formatExcelTime(cell.v);
  }
  return cleanText(cell.v);
}

function cellFormula(sheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })] as XLSX.CellObject | undefined;
  return cleanText(cell?.f);
}

function formatDateCell(date: Date): string {
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  if (date.getUTCFullYear() <= 1900 || (date.getUTCFullYear() === 1899 && date.getUTCMonth() === 11)) {
    return seconds ? padTime(hours, minutes, seconds) : padTime(hours, minutes);
  }
  return date.toISOString();
}

function formatExcelTime(value: number): string {
  const totalSeconds = Math.round(value * 24 * 60 * 60);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return seconds ? padTime(hours, minutes, seconds) : padTime(hours, minutes);
}

function padTime(hours: number, minutes: number, seconds?: number): string {
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  if (seconds === undefined) {
    return `${hh}:${mm}`;
  }
  return `${hh}:${mm}:${String(seconds).padStart(2, "0")}`;
}

function mergeBlocks(blocks: DanceBlock[]): DanceBlock[] {
  const merged = new Map<string, DanceBlock>();
  for (const block of blocks) {
    const blockID = block.blockID || stableID(block.name);
    const existing = merged.get(blockID);
    if (!existing) {
      merged.set(blockID, { ...block, blockID, routines: [...block.routines] });
      continue;
    }
    existing.title = existing.title || block.title;
    existing.sortOrder = existing.sortOrder || block.sortOrder;
    existing.isActive = existing.isActive || block.isActive;
    existing.routines.push(...block.routines);
  }
  return Array.from(merged.values()).sort((left, right) => {
    const order = (left.sortOrder || 0) - (right.sortOrder || 0);
    return order || normalized(left.name).localeCompare(normalized(right.name));
  });
}

function programSectionTitle(row: unknown[], columns: Partial<Record<EntryColumn, number>>): string {
  if (rowText(row, columns.name)
    && [columns.academy, columns.division, columns.genre, columns.category].some((index) => rowText(row, index))) return "";
  return row.map(cleanText).find((value) => /^(?:BLOQUE|BLOCK)\s+\d+\s*[A-Z]?(?:\b|\s|:)/i.test(value)) || "";
}

function repeatedEntryHeader(row: unknown[], aliases: EntryColumnAliases): Partial<Record<EntryColumn, number>> | null {
  const columns = entryColumnMap(row, aliases);
  if (!aliases.name.some((alias) => headerCompactKey(alias) === headerCompactKey(rowText(row, columns.name)))) return null;
  const matchingLabels = Object.entries(columns).filter(([column, index]) =>
    aliases[column as EntryColumn].some((alias) => headerCompactKey(alias) === headerCompactKey(row[index])));
  return matchingLabels.length >= 3 ? columns : null;
}

function parseBlocks(sheetName: string, sheet: XLSX.WorkSheet, aliases: EntryColumnAliases, warnings: string[] = []): DanceBlock[] {
  if (isNonEntrySheet(sheetName)) {
    return [];
  }

  const rows = sheetRows(sheet);
  const headerIndex = rows.findIndex((row) => {
    const columnMap = entryColumnMap(row, aliases);
    return hasMinimumEntryColumns(columnMap);
  });
  if (headerIndex < 0) {
    return [];
  }

  let columnMap = entryColumnMap(rows[headerIndex], aliases);
  const missing = Object.entries(REQUIRED_ENTRY_COLUMNS)
    .filter(([key]) => columnMap[key as EntryColumn] === undefined)
    .map(([, label]) => label);
  if (missing.length) {
    return [];
  }

  const sheetTitle = rows.slice(0, headerIndex)
    .flatMap((row) => row.map(cleanText).filter(Boolean))
    .join(" · ");
  const routinesBySegment = new Map<string, Routine[]>();
  const segmentOrder = new Map<string, number>();
  const segmentTitles = new Map<string, string>();
  let exhibitionCount = 0;
  let currentTitle = sheetTitle;
  let currentSegment = rows.slice(0, headerIndex)
    .map((row) => programSectionTitle(row, columnMap)).filter(Boolean).at(-1) || sheetName;
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const nextHeader = repeatedEntryHeader(row, aliases);
    if (nextHeader) {
      columnMap = nextHeader;
      continue;
    }
    const title = programSectionTitle(row, columnMap);
    if (title) {
      currentSegment = title;
      currentTitle = row.map(cleanText).filter(Boolean).join(" · ");
      continue;
    }
    if ([columnMap.division, columnMap.category].some((index) =>
      /\b(?:EXHIBICION|EXHIBITION)\b/.test(headerKey(rowText(row, index))))) {
      exhibitionCount += 1;
      continue;
    }
    const name = rowText(row, columnMap.name);
    const explicitID = columnMap.entryID !== undefined
      ? rowText(row, columnMap.entryID)
      : columnMap.name === 0 ? "" : routineIDText(row[0]);
    if (!name) {
      if (explicitID && rowText(row, columnMap.academy)
        && [columnMap.division, columnMap.genre, columnMap.category].some((index) => rowText(row, index))) {
        const sourceRow = XLSX.utils.decode_range(sheet["!ref"] || "A1").s.r + rowIndex + 1;
        throw new HTTPError(422, `${sheetName}, fila ${sourceRow}: falta el nombre de la coreografía #${explicitID}.`);
      }
      continue;
    }
    const hasEntryDetails = [columnMap.academy, columnMap.division, columnMap.genre, columnMap.category, columnMap.participant]
      .some((index) => rowText(row, index));
    if (!explicitID && !hasEntryDetails && /^(?:PREMIACION(?:ES)?|RECESO|DESCANSO|INTERMEDIO|BREAK)(?:\b|$)/.test(headerKey(name))) {
      continue;
    }

    const segmentName = rowText(row, columnMap.segment) || currentSegment;
    const blockID = stableID(segmentName);
    const routines = routinesBySegment.get(segmentName) ?? [];
    if (!routinesBySegment.has(segmentName)) {
      routinesBySegment.set(segmentName, routines);
      segmentOrder.set(segmentName, segmentOrder.size + 1);
      segmentTitles.set(segmentName, currentTitle);
    }
    const routineID = routineIDText(explicitID) || `${blockID}-${routines.length + 1}`;
    const duration = rowText(row, columnMap.duration) || inferredDuration(sheet, rowIndex + 1, columnMap.time);
    routines.push({
      id: routineID,
      blockID,
      block: segmentName,
      name,
      academy: rowText(row, columnMap.academy),
      division: rowText(row, columnMap.division),
      genre: rowText(row, columnMap.genre),
      level: rowText(row, columnMap.level),
      category: rowText(row, columnMap.category),
      choreographer: rowText(row, columnMap.choreographer),
      participant: rowText(row, columnMap.participant),
      state: rowText(row, columnMap.state),
      time: rowText(row, columnMap.time),
      duration,
      ...registrationMetadataForRow(row,columnMap),
    });
  }

  if (exhibitionCount) warnings.push(`${sheetName}: se omitieron ${exhibitionCount} presentaciones de exhibición.`);
  return Array.from(routinesBySegment.entries()).map(([segmentName, routines]) => ({
    blockID: stableID(segmentName),
    name: segmentName,
    title: segmentTitles.get(segmentName) || sheetTitle,
    sortOrder: Number.parseInt(routines[0]?.id ?? "", 10) || segmentOrder.get(segmentName) || 0,
    isActive: false,
    routines,
  }));
}

function entryColumnMap(row: unknown[], aliases: EntryColumnAliases): Partial<Record<EntryColumn, number>> {
  const columnMap: Partial<Record<EntryColumn, number>> = {};
  row.forEach((value, index) => {
    const reserved = Object.entries(REGISTRATION_COLUMN_ALIASES)
      .find(([, values]) => columnMatches(value, values))?.[0] as EntryColumn | undefined;
    if (reserved) {
      if (columnMap[reserved] === undefined) columnMap[reserved] = index;
      return; // A capability/header can never become a public field alias.
    }
    for (const column of Object.keys(aliases) as EntryColumn[]) {
      if (columnMap[column] === undefined && columnMatches(value, aliases[column])) {
        columnMap[column] = index;
      }
    }
  });
  const nativeID = row.findIndex((value) => ["ID", "ROUTINEID", "ENTRYID"].includes(headerCompactKey(value)));
  if (nativeID >= 0) columnMap.entryID = nativeID;
  return columnMap;
}

function hasMinimumEntryColumns(columnMap: Partial<Record<EntryColumn, number>>): boolean {
  if (columnMap.name === undefined) {
    return false;
  }
  return [
    columnMap.academy,
    columnMap.division,
    columnMap.genre,
    columnMap.category,
    columnMap.segment,
    columnMap.time,
  ].some((index) => index !== undefined);
}

function isNonEntrySheet(sheetName: string): boolean {
  const sheetKey = normalized(sheetName);
  return sheetKey.startsWith("JUECEO") ||
    sheetKey.startsWith("COPIA DE JUECEO") ||
    sheetKey === "CALIFICACIONES" ||
    sheetKey === "DICTAMEN FINAL" ||
    sheetKey === "REPORTE FINAL" ||
    sheetKey === "RESULTADO FINAL" ||
    ["JUECES", "JURADO", "EVALUADORES", "JUDGES", "EVALUATORS", "SCORERS"].includes(sheetKey);
}

function inferredDuration(sheet: XLSX.WorkSheet, rowNumber: number, timeIndex: number | undefined): string {
  if (timeIndex === undefined) {
    return "";
  }
  const nextRowFormula = cellFormula(sheet, rowNumber, timeIndex);
  const match = nextRowFormula.match(/^=?\s*\$?[A-Z]+\$?(\d+)\s*\+\s*([0-9]+(?:[.,][0-9]+)?)\s*\/\s*1440\s*$/i);
  if (!match || Number(match[1]) !== rowNumber) {
    return "";
  }
  return compactNumberText(match[2]);
}

function parseTemplate(sheetName: string, sheet: XLSX.WorkSheet): Template | null {
  if (isNonEntrySheet(sheetName)) {
    return null;
  }

  const rows = sheetRows(sheet);
  const title = rows.flatMap((row) => row)
    .map(cleanText)
    .find((value) => TEMPLATE_TITLE_MARKERS.some((marker) => normalized(value).includes(normalized(marker))));
  const legacyTemplateMarkers = new Set(["TECNICA", "EJECUCION COREOGRAFICA", "INTERPRETACION", "ARTISTICO"]);
  const hasLegacyTemplateMarker = rows.flatMap((row) => row).some((value) => legacyTemplateMarkers.has(normalized(value)));
  const parsedFromHeader = parseTemplateCriteriaFromHeader(rows);
  if (parsedFromHeader.criteria.length) {
    return {
      genre: sheetName,
      title: title || `HOJA DE EVALUACION ${sheetName}`,
      maxScore: parsedFromHeader.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0),
      criteria: parsedFromHeader.criteria,
    };
  }

  let section = "General";
  const criteria: Criterion[] = [];

  rows.forEach((row) => {
    const numberValue = row[1];
    const label = rowText(row, 2);
    const maximum = parseNumber(row[3]);
    const number = parseNumber(numberValue);
    if (cleanText(numberValue) && !Number.isFinite(number) && !["-", "JUEZ", "FEEDBACK"].includes(normalized(numberValue))) {
      section = cleanText(numberValue);
    }
    if (Number.isFinite(number) && number > 0 && label && Number.isFinite(maximum) && maximum > 0) {
      criteria.push({
        id: Math.trunc(number),
        section,
        label,
        maxScore: maximum,
      });
    }
  });

  if (!criteria.length) {
    return null;
  }
  if (!title && !hasLegacyTemplateMarker) {
    return null;
  }

  return {
    genre: sheetName,
    title: title || `HOJA DE EVALUACION ${sheetName}`,
    maxScore: criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0),
    criteria,
  };
}

function parseTemplateCriteriaFromHeader(rows: unknown[][]): { criteria: Criterion[] } {
  const headerIndex = rows.findIndex((row) => {
    const columnMap = templateColumnMap(row);
    return columnMap.label !== undefined && columnMap.maxScore !== undefined;
  });
  if (headerIndex < 0) {
    return { criteria: [] };
  }

  const columnMap = templateColumnMap(rows[headerIndex]);
  const criteria: Criterion[] = [];
  let section = "General";
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const label = rowText(row, columnMap.label);
    const maximum = parseNumber(rowText(row, columnMap.maxScore));
    const sectionValue = rowText(row, columnMap.section);
    if (sectionValue) {
      section = sectionValue;
    }
    if (!label || !Number.isFinite(maximum) || maximum <= 0) {
      continue;
    }
    const explicitID = parseNumber(rowText(row, columnMap.criterionID));
    criteria.push({
      id: Number.isFinite(explicitID) && explicitID > 0 ? Math.trunc(explicitID) : criteria.length + 1,
      section,
      label,
      maxScore: maximum,
    });
  }
  return { criteria };
}

function templateColumnMap(row: unknown[]): Partial<Record<TemplateColumn, number>> {
  const columnMap: Partial<Record<TemplateColumn, number>> = {};
  row.forEach((value, index) => {
    for (const column of Object.keys(DEFAULT_TEMPLATE_COLUMN_ALIASES) as TemplateColumn[]) {
      if (columnMap[column] === undefined && columnMatches(value, DEFAULT_TEMPLATE_COLUMN_ALIASES[column])) {
        columnMap[column] = index;
      }
    }
  });
  return columnMap;
}

function parseJudges(workbook: XLSX.WorkBook, warnings: string[]): string[] {
  const sheetName = workbook.SheetNames.find((name) =>
    ["CALIFICACIONES", "JUECES", "JURADO", "EVALUADORES", "JUDGES", "EVALUATORS", "SCORERS"].includes(normalized(name))
  );
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  const judges: string[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;
  if (sheet) {
    const rows = sheetRows(sheet);
    const headerAliases = ["JUEZ", "JUECES", "JURADO", "EVALUADOR", "EVALUADORES", "JUDGE", "JUDGES", "EVALUATOR", "SCORER", "NOMBRE", "NAME"];
    const headerLocation = findHeaderLocation(rows, headerAliases);
    const judgeColumn = headerLocation?.column ?? (sheetName && normalized(sheetName) === "CALIFICACIONES" ? 2 : 0);
    const firstRow = headerLocation ? headerLocation.row + 1 : 0;
    for (let rowIndex = firstRow; rowIndex < rows.length; rowIndex += 1) {
      const value = rowText(rows[rowIndex], judgeColumn);
      if (!value || value.startsWith("=") || columnMatches(value, headerAliases)) {
        continue;
      }
      const judge = value.toLocaleUpperCase("es-MX");
      const key = normalized(judge);
      if (seen.has(key)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(key);
      judges.push(judge);
    }
  }
  if (!judges.length) {
    warnings.push("No se encontraron evaluadores; se crea Admin por default.");
    return [];
  }
  if (duplicateCount) {
    warnings.push(`${sheetName ?? "Evaluadores"}: ${duplicateCount} evaluadores duplicados omitidos.`);
  }
  return judges;
}

function findHeaderLocation(rows: unknown[][], aliases: readonly string[]): { row: number; column: number } | null {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex += 1) {
      if (columnMatches(rows[rowIndex][columnIndex], aliases)) {
        return { row: rowIndex, column: columnIndex };
      }
    }
  }
  return null;
}

function withRequiredPeople(judges: string[], defaultJudges: string[]): string[] {
  const result = cleanTextArray(defaultJudges, DEFAULT_JUDGES);
  const known = new Set(result.map(stableID));
  for (const judge of judges) {
    const judgeID = stableID(judge);
    if (!known.has(judgeID)) {
      result.push(judge);
      known.add(judgeID);
    }
  }
  return result;
}

function roleForPerson(name: string, adminEvaluatorIDs: string[]): string {
  return adminEvaluatorIDs.includes(stableID(name)) ? "admin" : "judge";
}

function heroImageForPerson(name: string): string {
  const judgeID = stableID(name);
  return DEFAULT_JUDGE_PROFILES.find((profile) => stableID(profile.name) === judgeID)?.heroImageName ?? "";
}

function aliasBaseForGenre(genre: string): string | undefined {
  const genreKey = normalized(genre);
  if (headerCompactKey(genre) === "OPENMOTION") return "CONTEMPORANEO";
  if (genreKey.startsWith("OPEN:")) {
    return "DANZA AEREA";
  }
  return TEMPLATE_ALIASES[genreKey];
}

function ensureTemplatesForRoutines(templates: Template[], routines: Routine[]): string[] {
  const warnings: string[] = [];
  const templatesByGenre = new Map(templates.map((template) => [normalized(template.genre), template]));
  const genres = Array.from(new Set(routines.map((routine) => routine.genre).filter(Boolean)))
    .sort((left, right) => normalized(left).localeCompare(normalized(right)));

  for (const genre of genres) {
    const genreKey = normalized(genre);
    if (templatesByGenre.has(genreKey)) {
      continue;
    }
    const baseKey = aliasBaseForGenre(genre);
    const baseTemplate = baseKey ? templatesByGenre.get(baseKey) : undefined;
    if (!baseTemplate) {
      throw new HTTPError(422, `Categoria principal sin hoja de evaluacion: ${genre}.`);
    }
    const aliased = {
      ...baseTemplate,
      genre,
      title: `HOJA DE EVALUACION ${genre}`,
      criteria: baseTemplate.criteria.map((criterion) => ({ ...criterion })),
    };
    templates.push(aliased);
    templatesByGenre.set(genreKey, aliased);
    warnings.push(`${genre}: se usa la plantilla base ${baseTemplate.genre}.`);
  }
  return warnings;
}

async function uploadToSupabase(
  appData: AppData,
  options: {
    slug: string;
    name: string;
    adminEvaluatorIDs: string[];
    competitionConfig?: AnyRow;
    activate: boolean;
    replaceEvent: boolean;
    forceReplace: boolean;
  },
): Promise<string> {
  const eventRows = await supabaseRequest("POST", "events?on_conflict=slug", [{
    slug: options.slug,
    name: options.name,
    source_name: appData.sourceName,
    event_type: "event",
    ...(options.competitionConfig ? { competition_config: options.competitionConfig } : {}),
  }], "resolution=merge-duplicates,return=representation") as AnyRow[];

  const eventID = cleanText(eventRows?.[0]?.id);
  if (!eventID) {
    throw new HTTPError(500, "Supabase no devolvio el evento importado.");
  }

  const importedBlockIDs = appData.blocks.map((block) => block.blockID || stableID(block.name));
  if (options.replaceEvent) {
    if (!options.forceReplace && (
      await eventRowsExist("scores", eventID) ||
      await eventRowsExist("feedback", eventID) ||
      await eventRowsExist("penalties", eventID) ||
      await eventRowsExist("special_awards", eventID)
    )) {
      throw new HTTPError(409, "El evento ya tiene puntajes, feedback, penalizaciones o premios especiales.");
    }
    await deleteEventRows(eventID);
  } else {
    await deleteBlockRows(eventID, importedBlockIDs, options.forceReplace);
  }

  const blockTitles = new Map(appData.blocks.map((block) => [block.name, block.title || ""]));
  const blockIDs = new Map(appData.blocks.map((block) => [block.name, block.blockID || stableID(block.name)]));
  const blockRows = appData.blocks.map((block, index) => ({
    event_id: eventID,
    block_id: block.blockID || stableID(block.name),
    name: block.name,
    title: block.title || "",
    sort_order: block.sortOrder || index + 1,
    is_active: Boolean(block.isActive),
  }));
  const routineRows = appData.routines.map((routine, index) => ({
    event_id: eventID,
    routine_id: routine.id,
    block_id: routine.blockID || blockIDs.get(routine.block) || stableID(routine.block),
    block: routine.block,
    block_title: blockTitles.get(routine.block) || "",
    sort_order: index + 1,
    name: routine.name,
    academy: routine.academy,
    division: routine.division,
    genre: routine.genre,
    level: routine.level,
    category: routine.category,
    choreographer: routine.choreographer,
    participant: routine.participant,
    state: routine.state,
    scheduled_time: routine.time,
    duration: routine.duration,
  }));
  const judgeRows = appData.judges.map((judge, index) => ({
    event_id: eventID,
    judge_id: stableID(judge),
    name: judge,
    role: roleForPerson(judge, options.adminEvaluatorIDs),
    sort_order: index + 1,
    hero_image_name: heroImageForPerson(judge),
  }));
  const templateRows: AnyRow[] = [];
  const criterionRows: AnyRow[] = [];
  appData.templates.forEach((template, templateIndex) => {
    const templateID = stableID(template.templateID || template.genre);
    templateRows.push({
      event_id: eventID,
      template_id: templateID,
      genre: template.genre,
      title: template.title,
      max_score: template.maxScore,
      template_version: template.version ?? 1,
      applies_to: template.appliesTo ?? { primary_categories: [template.genre] },
      feedback_required: template.feedbackRequired ?? false,
      sort_order: templateIndex + 1,
    });
    template.criteria.forEach((criterion, criterionIndex) => {
      criterionRows.push({
        event_id: eventID,
        template_id: templateID,
        criterion_id: criterion.id,
        section: criterion.section,
        label: criterion.label,
        max_score: criterion.maxScore,
        feedback_required: criterion.feedbackRequired ?? false,
        is_required: criterion.isRequired ?? true,
        sort_order: criterionIndex + 1,
      });
    });
  });

  await upsertRows("blocks", blockRows, "event_id,block_id");
  await upsertRows("routines", routineRows, "event_id,routine_id");
  await upsertRows("judges", judgeRows, "event_id,judge_id");
  await upsertRows("criteria_templates", templateRows, "event_id,template_id");
  await upsertRows("criteria", criterionRows, "event_id,template_id,criterion_id");
  if (options.activate) {
    await supabaseRequest("PATCH", "events?is_active=eq.true", { is_active: false }, "return=minimal");
    await supabaseRequest("PATCH", `events?id=eq.${encodeURIComponent(eventID)}`, { is_active: true }, "return=minimal");
  }
  return eventID;
}

async function fetchAccessCodes(eventID: string): Promise<AccessCodeDelivery[]> {
  const encodedEventID = encodeURIComponent(eventID);
  const judgeRows = await supabaseRequest(
    "GET",
    `judges?select=event_id,judge_id,name,role,sort_order&event_id=eq.${encodedEventID}&order=sort_order.asc,name.asc`,
  ) as AnyRow[];
  const codeRows = await supabaseRequest(
    "GET",
    `judge_access_codes?select=event_id,judge_id,access_code&event_id=eq.${encodedEventID}`,
  ) as AnyRow[];
  const codesByJudgeID = new Map(
    codeRows.map((row) => [cleanText(row.judge_id), normalizeAccessCode(row.access_code)]),
  );

  return judgeRows.map((judge) => {
    const judgeID = cleanText(judge.judge_id);
    return {
      event_id: eventID,
      judge_id: judgeID,
      judge_name: cleanText(judge.name),
      role: cleanText(judge.role) || "judge",
      access_code: codesByJudgeID.get(judgeID) || "",
    };
  });
}

async function deleteEventRows(eventID: string): Promise<void> {
  for (const table of ["special_awards", "penalties", "feedback", "scores", "criteria", "criteria_templates", "judges", "routines", "blocks"]) {
    await supabaseRequest("DELETE", `${table}?event_id=eq.${encodeURIComponent(eventID)}`, undefined, "return=minimal");
  }
}

async function deleteBlockRows(eventID: string, blockIDs: string[], forceReplace: boolean): Promise<void> {
  if (!blockIDs.length) {
    return;
  }
  if (!forceReplace && (
    await rowsExist("scores", eventID, blockIDs) ||
    await rowsExist("feedback", eventID, blockIDs) ||
    await rowsExist("penalties", eventID, blockIDs) ||
    await rowsExist("special_awards", eventID, blockIDs)
  )) {
    throw new HTTPError(409, "El bloque ya tiene puntajes, feedback, penalizaciones o premios especiales.");
  }
  const blockFilter = blockIDs.map(encodeURIComponent).join(",");
  await supabaseRequest(
    "DELETE",
    `routines?event_id=eq.${encodeURIComponent(eventID)}&block_id=in.(${blockFilter})`,
    undefined,
    "return=minimal",
  );
}

async function rowsExist(table: string, eventID: string, blockIDs: string[]): Promise<boolean> {
  const blockFilter = blockIDs.map(encodeURIComponent).join(",");
  const rows = await supabaseRequest(
    "GET",
    `${table}?select=event_id&event_id=eq.${encodeURIComponent(eventID)}&block_id=in.(${blockFilter})&limit=1`,
  ) as unknown[];
  return rows.length > 0;
}

async function eventRowsExist(table: string, eventID: string): Promise<boolean> {
  const rows = await supabaseRequest(
    "GET",
    `${table}?select=event_id&event_id=eq.${encodeURIComponent(eventID)}&limit=1`,
  ) as unknown[];
  return rows.length > 0;
}

async function upsertRows(table: string, rows: AnyRow[], conflict: string): Promise<void> {
  if (!rows.length) {
    return;
  }
  const query = new URLSearchParams({ on_conflict: conflict }).toString();
  for (let index = 0; index < rows.length; index += 500) {
    const chunk = rows.slice(index, index + 500);
    try {
      await supabaseRequest("POST", `${table}?${query}`, chunk, "resolution=merge-duplicates,return=minimal");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const fallbackColumns = table === "judges"
        ? ["role", "hero_image_name"]
        : table === "routines"
        ? ["participant"]
        : [];
      const missingColumns = fallbackColumns.filter((column) => detail.includes(column));
      if (!missingColumns.length) {
        throw error;
      }
      const fallbackChunk = chunk.map((row) => {
        const fallbackRow = { ...row };
        for (const column of missingColumns) {
          delete fallbackRow[column];
        }
        return fallbackRow;
      });
      await supabaseRequest("POST", `${table}?${query}`, fallbackChunk, "resolution=merge-duplicates,return=minimal");
    }
  }
}

async function supabaseRequest(method: string, path: string, payload?: unknown, prefer?: string): Promise<unknown> {
  const baseURL = cleanText(Deno.env.get("SUPABASE_URL")).replace(/\/+$/, "");
  const serviceKey = supabaseSecretKey();
  if (!baseURL || !serviceKey) {
    throw new HTTPError(500, "Faltan SUPABASE_URL y una secret key en la Edge Function.");
  }

  const response = await fetch(`${baseURL}/rest/v1/${path.replace(/^\/+/, "")}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new HTTPError(response.status, `Supabase ${method} ${path} fallo: ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function supabaseSecretKey(): string {
  const directKey = cleanText(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY"));
  if (directKey) {
    return directKey;
  }

  const encodedKeys = cleanText(Deno.env.get("SUPABASE_SECRET_KEYS"));
  if (!encodedKeys) {
    return "";
  }

  try {
    const keys = JSON.parse(encodedKeys) as Record<string, unknown>;
    const preferred = cleanText(keys.service_role) || cleanText(keys.default);
    if (preferred) {
      return preferred;
    }
    const firstKey = Object.values(keys).map(cleanText).find(Boolean);
    return firstKey || "";
  } catch {
    return "";
  }
}

