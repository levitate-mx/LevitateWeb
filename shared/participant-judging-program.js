const maximumRows = 600;
const maximumLength = 2 * 1024 * 1024;
const danceIdPattern = /^[A-Za-z0-9_-]{8,100}$/;
const sourceIdPattern = /^[1-9][0-9]{0,8}$/;
const entities = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
};

function fail(message = "Usa el programa .xls exportado desde esta web con las columnas ID e ID INSCRIPCIÓN.") {
  throw new Error(message);
}

function cellText(value) {
  // Export cells contain escaped text only. Never execute or load imported HTML.
  if (/[<>]/.test(value)) fail();
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity) => {
    if (entity.startsWith("#")) {
      const number = /^#x/i.test(entity) ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      if (!Number.isInteger(number) || number < 1 || number > 0x10ffff || (number >= 0xd800 && number <= 0xdfff)) fail();
      return String.fromCodePoint(number);
    }
    if (!Object.hasOwn(entities, entity)) fail();
    return entities[entity];
  }).trim();
}

/** Read only the two association columns in Levitate's HTML-based XLS export.
 * This is a text parser, not an HTML renderer or a general spreadsheet import.
 */
export function parseParticipantJudgingProgram(html) {
  if (typeof html !== "string" || !html || html.length > maximumLength) fail();
  if (/<\?(?:xml|php)|<!entity\b|<!doctype[^>]*\[|<(?:script|iframe|frame|object|embed|svg|math|img|link|base|a|xml)\b/i.test(html)
    || /<[^>]+\s(?:on[a-z]+|src|href)\s*=/i.test(html)) fail("El archivo contiene elementos ajenos al programa exportado. Vuelve a exportarlo desde esta web.");
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)];
  if (tables.length !== 1 || /<table\b/i.test(tables[0][1])) fail();
  const rows = [...tables[0][1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)];
  if (!rows.length || rows.length > maximumRows * 3) fail();
  const links = [], sourceIds = new Set(), danceIds = new Set();
  let header;
  for (const row of rows) {
    if (/<tr\b/i.test(row[1])) fail();
    const cells = [...row[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)];
    if (!cells.length) fail();
    const span = cells.length === 1 ? cells[0][2].match(/\bcolspan\s*=\s*["']?([0-9]+)/i) : null;
    if (span && Number(span[1]) >= 2) continue;
    const texts = cells.map(cell => cellText(cell[3]));
    if (cells.some(cell => cell[1].toLowerCase() === "th") || (texts.includes("ID") && texts.includes("ID INSCRIPCIÓN"))) {
      const sourceIndex = texts.indexOf("ID"), danceIndex = texts.indexOf("ID INSCRIPCIÓN");
      if (sourceIndex < 0 || danceIndex < 0 || texts.lastIndexOf("ID") !== sourceIndex || texts.lastIndexOf("ID INSCRIPCIÓN") !== danceIndex) fail();
      header = { sourceIndex, danceIndex, count: cells.length };
      continue;
    }
    if (!header || cells.length !== header.count || cells.some(cell => /\b(?:colspan|rowspan)\s*=/i.test(cell[2]))) fail();
    const sourceRoutineId = texts[header.sourceIndex], danceId = texts[header.danceIndex];
    if (!sourceIdPattern.test(sourceRoutineId) || !danceIdPattern.test(danceId)) fail("Hay identificadores inválidos. Usa el archivo original exportado por esta web.");
    if (sourceIds.has(sourceRoutineId) || danceIds.has(danceId)) fail("El programa contiene identificadores repetidos. Revisa el archivo antes de vincularlo.");
    if (links.length >= maximumRows) fail("El programa supera las 600 coreografías permitidas.");
    sourceIds.add(sourceRoutineId); danceIds.add(danceId);
    links.push({ danceId, sourceRoutineId });
  }
  if (!links.length) fail("No encontramos coreografías para vincular en este programa.");
  return links;
}
