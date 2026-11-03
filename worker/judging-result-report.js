// Mirrors the new iOS DictamenBuilder and official CompetitionScoringEngine.
// This module only derives a report from already authorized, event-scoped data.
const EPSILON = 0.0001;
const MAXIMUM_SCORE = 150;
const array = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === "string" ? value.trim() : "";
const normalized = (value) => text(value).normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
const stable = (value) => normalized(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
const textOrder = new Intl.Collator("es", { sensitivity: "accent" });
const naturalOrder = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
const numeric = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const option = (config, camel, snake, fallback) => config[camel] ?? config[snake] ?? fallback;

function minimumNumber(value) {
  let minimum = 9223372036854775807n;
  for (const digits of text(value).match(/\p{Nd}+/gu) ?? []) {
    try { const parsed = BigInt(digits); if (parsed < minimum) minimum = parsed; } catch { /* Same fallback as Swift Int. */ }
  }
  return minimum;
}

function routineOrder(left, right) {
  const a = minimumNumber(left.id);
  const b = minimumNumber(right.id);
  return a < b ? -1 : a > b ? 1 : naturalOrder.compare(left.id, right.id);
}

function resolvedScoring(event, warn) {
  const config = object(event.competition_config);
  const scoring = object(config.scoring ?? config.scoring_rules);
  const aggregationKey = stable(option(scoring, "aggregation", "score_aggregation", "average"));
  const aggregation = ["average", "avg", "promedio"].includes(aggregationKey) ? "average"
    : ["sum", "suma", "total"].includes(aggregationKey) ? "sum" : null;
  const missingKey = stable(option(scoring, "officialMissingScorePolicy", "official_missing_score_policy", "zero"));
  const missing = ["ignore", "omit", "omitir", "ignorar", "submitted-only", "solo-cargados"].includes(missingKey) ? "ignore"
    : ["zero", "cero", "0", "count-as-zero", "cuenta-como-cero"].includes(missingKey) ? "zero" : null;
  const highest = option(scoring, "dropHighestCount", "drop_highest_count", 0);
  const lowest = option(scoring, "dropLowestCount", "drop_lowest_count", 0);
  const includePenalties = option(scoring, "includePenalties", "include_penalties", true);
  const weightsValue = option(scoring, "evaluatorWeights", "evaluator_weights", {});
  const valid = aggregation && missing && Number.isInteger(highest) && Number.isInteger(lowest)
    && typeof includePenalties === "boolean" && weightsValue !== null && typeof weightsValue === "object" && !Array.isArray(weightsValue);
  if (!valid) warn("La configuración del puntaje oficial no es válida; los resultados afectados no están disponibles.");
  return { valid: Boolean(valid), aggregation, missing, highest: Math.max(0, highest), lowest: Math.max(0, lowest),
    includePenalties, weights: object(weightsValue) };
}

function evaluatorWeight(name, weights) {
  for (const candidate of [name, normalized(name), stable(name)]) {
    const entry = Object.entries(weights).find(([key]) => key === candidate)
      ?? Object.entries(weights).find(([key]) => normalized(key) === normalized(candidate))
      ?? Object.entries(weights).find(([key]) => stable(key) === stable(candidate));
    if (!entry) continue;
    const weight = numeric(entry[1]);
    return weight === null ? null : Math.max(0, weight);
  }
  return 1;
}

function officialScore(row, scoring, unavailableRoutineIds, warn) {
  if (!scoring.valid || row.status === "unavailable" || unavailableRoutineIds.has(row.id) || !row.judges.length) return null;
  const items = [];
  for (const judge of row.judges) {
    const subtotal = judge.subtotal ?? 0;
    const submitted = subtotal > 0;
    const maximum = numeric(judge.maximumScore);
    const weight = evaluatorWeight(judge.name, scoring.weights);
    if (maximum === null || weight === null || numeric(subtotal) === null || numeric(judge.penalty) === null) {
      warn("Hay datos o ponderaciones de jueces inválidos; los resultados oficiales afectados no están disponibles.");
      return null;
    }
    if (!submitted && scoring.missing === "ignore") continue;
    const total = submitted ? Math.max(0, subtotal + (scoring.includePenalties ? judge.penalty : 0)) : 0;
    items.push({ total, maximum: Math.max(0, maximum), weight });
  }
  items.sort((a, b) => Math.abs(a.total - b.total) < EPSILON ? a.maximum - b.maximum : a.total - b.total);
  items.splice(0, Math.min(scoring.lowest, Math.max(0, items.length - 1)));
  const removeHighest = Math.min(scoring.highest, Math.max(0, items.length - 1));
  if (removeHighest) items.splice(items.length - removeHighest, removeHighest);
  if (!items.length) return 0;
  const rawTotal = items.reduce((sum, item) => sum + item.total, 0);
  const rawMaximum = items.reduce((sum, item) => sum + item.maximum, 0);
  const weightedTotal = items.reduce((sum, item) => sum + item.total * item.weight, 0);
  const weightedMaximum = items.reduce((sum, item) => sum + item.maximum * item.weight, 0);
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let total = weightedTotal;
  let maximum = weightedMaximum;
  if (scoring.aggregation === "average") {
    total = totalWeight > 0 ? weightedTotal / totalWeight : rawTotal / items.length;
    maximum = totalWeight > 0 ? weightedMaximum / totalWeight : rawMaximum / items.length;
  }
  if (![total, maximum, totalWeight].every(Number.isFinite)) {
    warn("El cálculo del puntaje oficial supera el rango numérico permitido.");
    return null;
  }
  return maximum > 0 ? Math.min(MAXIMUM_SCORE, Math.max(0, total / maximum * MAXIMUM_SCORE)) : Math.max(0, total);
}

function reportField(value) {
  const key = stable(value);
  if (["primary-category", "primarycategory", "primary-category-name", "genre", "apparatus", "disciplina"].includes(key)) return "genre";
  if (["division"].includes(key)) return "division";
  if (["level", "nivel"].includes(key)) return "level";
  if (["category", "categoria"].includes(key)) return "category";
  if (["state", "estado"].includes(key)) return "state";
  if (["organization", "academy", "academia", "club", "school", "escuela"].includes(key)) return "academy";
  if (["segment", "block", "bloque"].includes(key)) return "blockName";
  return null;
}

function groupLabel(field, row, danceAliases = false) {
  const fallbacks = { genre: "SIN GÉNERO", division: "SIN DIVISIÓN", level: "SIN NIVEL", category: "SIN CATEGORÍA",
    state: "SIN ESTADO", academy: "SIN ACADEMIA", blockName: "SIN BLOQUE" };
  const clean = text(row[field]) || fallbacks[field] || "SIN DATO";
  if (field !== "genre" || !danceAliases) return clean;
  const key = normalized(clean).replace(/\s*:\s*/g, ":");
  return key === "OPEN" ? "OPEN PISO" : key.startsWith("OPEN:") ? "OPEN AÉREO" : clean;
}

function categoryTitle(values) {
  if (!values.length) return "GENERAL";
  const unique = [];
  for (const value of values) {
    const clean = text(value);
    if (clean && !normalized(clean).startsWith("SIN ") && !unique.some((item) => normalized(item) === normalized(clean))) unique.push(clean);
  }
  return unique.join(" ") || "SIN DATO";
}

function placement(rank) {
  return rank === null ? { rank: null, label: "PART.", isFirstPlace: false, isParticipation: true }
    : { rank, label: `${rank}°`, isFirstPlace: rank === 1, isParticipation: false };
}

function categoryRows(results, config) {
  const valid = results.filter((item) => item.score !== null).sort((a, b) => Math.abs(a.score - b.score) < EPSILON
    ? routineOrder(a.row, b.row) : b.score - a.score);
  const byId = new Map();
  if (valid.length === 1 && results.length === 1) {
    const score = valid[0].score;
    const rank = !config.soloThresholds ? (config.rankedPositions > 0 ? 1 : null)
      : score >= MAXIMUM_SCORE * (181 / 210) ? 1 : score >= MAXIMUM_SCORE * (161 / 210) ? 2
        : score >= MAXIMUM_SCORE * (141 / 210) ? 3 : null;
    byId.set(valid[0].row.id, placement(rank));
  } else {
    let rank = 0;
    let previous = null;
    valid.forEach((item, index) => {
      if (previous === null || Math.abs(item.score - previous) >= EPSILON) { rank = index + 1; previous = item.score; }
      byId.set(item.row.id, placement(rank <= config.rankedPositions ? rank : null));
    });
  }
  // iOS assigns places in descending order, then announces/displays low to high.
  return [...results].sort((a, b) => {
    if (a.score === null || b.score === null) return a.score === b.score ? routineOrder(a.row, b.row) : a.score === null ? -1 : 1;
    return Math.abs(a.score - b.score) < EPSILON ? routineOrder(a.row, b.row) : a.score - b.score;
  }).map((item) => ({ routineId: item.row.id, score: item.score, placement: byId.get(item.row.id) ?? null }));
}

function genrePriority(label) {
  const value = stable(label);
  return value.includes("tela") ? 0 : value.includes("aro") ? 1 : value.includes("open") ? 2 : 3;
}

function isBlockFour(rows) {
  return rows.some((row) => [row.nativeBlockId ?? row.blockId, row.blockName].some((value) => /(?:^|-)(?:bloque|block)-4(?:-|$)/.test(stable(value))));
}

function sectionsFor(results, config) {
  const groups = new Map();
  for (const item of results) {
    const label = groupLabel(config.primary, item.row, config.danceAliases);
    if (!groups.has(label)) groups.set(label, new Map());
    const values = config.secondary.map((field) => groupLabel(field, item.row));
    const id = [label, ...values].map(normalized).join("|");
    const group = groups.get(label);
    if (!group.has(id)) group.set(id, { id, title: categoryTitle(values), items: [] });
    group.get(id).items.push(item);
  }
  const customOrder = config.primary === "genre" && config.danceAliases && !isBlockFour(results.map((item) => item.row));
  return [...groups].map(([label, categories]) => ({
    id: normalized(label), label,
    categories: [...categories.values()].sort((a, b) => {
      const aNumber = a.items.reduce((min, item) => minimumNumber(item.row.id) < min ? minimumNumber(item.row.id) : min, 9223372036854775807n);
      const bNumber = b.items.reduce((min, item) => minimumNumber(item.row.id) < min ? minimumNumber(item.row.id) : min, 9223372036854775807n);
      return aNumber < bNumber ? -1 : aNumber > bNumber ? 1 : textOrder.compare(a.title, b.title);
    }).map((category) => ({ id: category.id, title: category.title, rows: categoryRows(category.items, config) })),
  })).sort((a, b) => (customOrder ? genrePriority(a.label) - genrePriority(b.label) : 0) || textOrder.compare(a.label, b.label));
}

function awardId(value) {
  const slug = stable(value);
  const compact = slug.replaceAll("-", "");
  if (["bestcostume", "mejorvestuario"].includes(compact)) return "award_1";
  if (["bestmusic", "mejormusica"].includes(compact)) return "award_2";
  if (["bestchoreographicidea", "mejorideacoreografica", "innovacion"].includes(compact)) return "award_3";
  if (["bestporra", "mejorporra", "espiritudeequipo"].includes(compact)) return "award_4";
  const slot = compact.match(/^(?:award|premio|specialaward|slot)(\d+)$/);
  return slot && Number(slot[1]) > 0 ? `award_${Number(slot[1])}` : slug.replaceAll("-", "_");
}

function awardsFor(block, input, configuration, warn) {
  const configured = configuration.specialAwards ?? configuration.special_awards;
  const defaults = ["Mejor vestuario", "Mejor música", "Mejor idea coreográfica", "Mejor porra"]
    .map((title, index) => ({ category: `award_${index + 1}`, title }));
  const slots = configured == null ? defaults : array(configured);
  const awards = new Map();
  const raw = array(input.specialAwards).filter((row) => text(row.event_id) === text(input.event.id) && text(row.block_id) === block.id);
  for (const award of raw) {
    const id = awardId(award.award);
    if (!id) continue;
    if (!awards.has(id)) awards.set(id, []);
    awards.get(id).push(award);
  }
  const seen = new Set();
  return slots.flatMap((slot) => {
    const id = awardId(slot?.category);
    if (!id || !text(slot?.title)) { warn("Hay premios especiales con una configuración incompleta."); return []; }
    if (seen.has(id) || option(slot, "isEnabled", "is_enabled", true) === false) return [];
    seen.add(id);
    const candidates = [...(awards.get(id) ?? [])].sort((left, right) =>
      Number(text(right.award) === id) - Number(text(left.award) === id));
    // A recorded manual value has priority over a routine-backed legacy value.
    // Conflicting aliases are never resolved by inventing an award winner.
    const manualValues = [...new Set(candidates.map((award) => text(award.manual_value)).filter(Boolean))];
    const routineIds = [...new Set(candidates.map((award) => text(award.routine_id)).filter(Boolean))];
    const ambiguous = manualValues.length > 1 || (!manualValues.length && routineIds.length > 1);
    if (ambiguous) warn("Hay premios especiales con asignaciones contradictorias; se muestran sin asignar hasta revisarlos.");
    const manual = !ambiguous ? manualValues[0] || "" : "";
    const routine = !ambiguous && !manual ? array(input.rows).find((row) => row.id === routineIds[0]) : null;
    if (!ambiguous && !manual && routineIds.length && !routine) warn("Hay premios especiales vinculados a una rutina que no está disponible en este evento.");
    return [{ id, title: text(slot.title), displayValue: manual || (routine ? `#${routine.id} ${routine.name}` : "Sin asignar"),
      isAssigned: Boolean(manual || routine), routineId: routine?.id ?? null }];
  });
}

export function buildJudgingResultReport(input, warn = () => {}) {
  const event = object(input.event);
  const configuration = object(event.competition_config);
  const rawReport = object(configuration.resultReport ?? configuration.result_report);
  const primary = reportField(option(rawReport, "primaryGroupField", "primary_group_field", "primary_category"));
  const rawSecondary = option(rawReport, "secondaryGroupFields", "secondary_group_fields", ["division", "level", "category"]);
  const secondary = array(rawSecondary).map(reportField);
  const validGrouping = primary && Array.isArray(rawSecondary) && secondary.every(Boolean);
  if (!validGrouping) warn("La agrupación del dictamen no está disponible por una configuración inválida.");
  const configuredRanked = option(rawReport, "rankedPositions", "ranked_positions", 3);
  const rankedPositions = Number.isInteger(configuredRanked) ? Math.min(20, Math.max(0, configuredRanked)) : 3;
  const config = { primary, secondary, rankedPositions,
    soloThresholds: option(rawReport, "useSoloPlacementThresholds", "use_solo_placement_thresholds", true) !== false,
    danceAliases: option(rawReport, "useDanceGenreAliases", "use_dance_genre_aliases", true) !== false };
  const scoring = resolvedScoring(event, warn);
  const unavailable = input.unavailableRoutineIds ?? new Set();
  const sourceRoutines = new Map(array(input.routines).filter((routine) => text(routine.event_id) === text(event.id))
    .map((routine) => [text(routine.routine_id), routine]));
  const rows = array(input.rows).map((row) => {
    const source = sourceRoutines.get(row.id);
    // Dictamen groups by the routine's stored block label, even if the block
    // metadata was renamed. Selection still uses the stable resolved block ID.
    return source ? { ...row, blockName: text(source.block), nativeBlockId: text(source.block_id) } : row;
  });
  const blocksById = new Map();
  for (const block of [...array(input.blocks)].sort((left, right) => (numeric(left.sort_order) ?? 0) - (numeric(right.sort_order) ?? 0))) {
    if (text(block.event_id) !== text(event.id) || !text(block.block_id)) continue;
    blocksById.set(text(block.block_id), { id: text(block.block_id), name: text(block.name), title: text(block.title), isActive: block.is_active === true });
  }
  const rowsByBlock = new Map();
  for (const row of rows) {
    const id = text(row.blockId) || stable(row.blockName) || "sin-bloque";
    if (!blocksById.has(id)) blocksById.set(id, { id, name: text(row.blockName) || "Sin bloque", title: "", isActive: false });
    if (!rowsByBlock.has(id)) rowsByBlock.set(id, []);
    rowsByBlock.get(id).push(row);
  }
  const blocks = [...blocksById.values()].map((block) => {
    const results = (rowsByBlock.get(block.id) ?? []).map((row) => ({ row, score: officialScore(row, scoring, unavailable, warn) }));
    const sections = validGrouping ? sectionsFor(results, config) : [];
    const top = results.filter((item) => item.score !== null).sort((a, b) => Math.abs(a.score - b.score) < EPSILON
      ? (minimumNumber(a.row.id) < minimumNumber(b.row.id) ? -1 : minimumNumber(a.row.id) > minimumNumber(b.row.id) ? 1 : textOrder.compare(a.row.name, b.row.name))
      : b.score - a.score)[0];
    return {
      ...block, sections,
      specialAwards: option(rawReport, "showSpecialAwards", "show_special_awards", true) !== false ? awardsFor(block, input, configuration, warn) : [],
      counts: { disciplines: sections.length, categories: sections.reduce((sum, section) => sum + section.categories.length, 0),
        scored: results.filter((item) => item.score !== null && item.score > 0).length, total: results.length },
      topScore: option(rawReport, "showTopScore", "show_top_score", true) !== false && top ? { routineId: top.row.id, score: top.score } : null,
    };
  });
  return { title: text(rawReport.title) || "Dictamen final", subtitle: text(rawReport.subtitle) || "Resultados oficiales de la hoja de jueceo",
    maximumScore: MAXIMUM_SCORE, blocks };
}
