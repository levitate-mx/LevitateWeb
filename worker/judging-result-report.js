// The web announces the real sum of the recorded, already penalized jury totals.
// It intentionally does not use the native normalized 150-point score. The web
// announcer report awards every evaluated routine a score medal, plus top-three
// places only within categories with direct competition.
// This module only derives a report from already authorized, event-scoped data.
import { releveCompetitionPollId, releveJudgingEventId, releveStanding } from './releve-competition.js';
import { competitionMedalForScore } from '../shared/competition-medals.js';
const EPSILON = 0.0001;
const CHAMPION_AWARD_ID = "champion_of_champions";
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

function officialResult(row, unavailableRoutineIds, warn) {
  const judges = array(row.judges);
  const validMaximum = judges.length > 0 && judges.every((judge) => numeric(judge.maximumScore) !== null && judge.maximumScore > 0);
  const maximum = validMaximum ? judges.reduce((sum, judge) => sum + judge.maximumScore, 0) : null;
  const maximumScore = maximum !== null && Number.isFinite(maximum) && maximum > 0 ? maximum : null;
  if (row.status === "unavailable" || unavailableRoutineIds.has(row.id) || !judges.length) return { score: null, maximumScore };
  if (maximumScore === null || judges.some((judge) => judge.total !== null
    && (numeric(judge.total) === null || judge.total < 0 || judge.total > judge.maximumScore))) {
    warn("Hay totales o máximos de jueces inválidos; los resultados afectados no están disponibles.");
    return { score: null, maximumScore };
  }
  // Judge totals already include criterion weights and penalties. Missing
  // sheets contribute zero provisionally; never average, rescale, drop a judge
  // or apply that penalty again when announcing the real sum.
  const score = judges.reduce((sum, judge) => sum + (judge.total ?? 0), 0);
  if (!Number.isFinite(score)) {
    warn("La suma de los jueces supera el rango numérico permitido.");
    return { score: null, maximumScore };
  }
  return { score, maximumScore };
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
  return rank === null ? { rank: null, label: "Sin lugar de podio", isFirstPlace: false, isParticipation: true }
    : { rank, label: `${rank}.º lugar`, isFirstPlace: rank === 1, isParticipation: false };
}

function categoryRows(results) {
  const eligibleCount = results.length;
  const directCompetition = eligibleCount >= 2;
  // Missing sheets may have a numeric zero under the official missing-score
  // policy. They cannot receive a place until at least one note is recorded.
  const eligible = results.filter((item) => item.score !== null && item.audience?.ready !== false && item.row.status !== "pending" && item.row.recordedScores > 0)
    .sort((a, b) => Math.abs(a.score - b.score) < EPSILON ? routineOrder(a.row, b.row) : b.score - a.score);
  const byId = new Map();
  const scoredIds = new Set(eligible.map((item) => item.row.id));
  let rank = 0;
  let previous = null;
  eligible.forEach((item, index) => {
    if (previous === null || Math.abs(item.score - previous) >= EPSILON) { rank = index + 1; previous = item.score; }
    if (directCompetition) byId.set(item.row.id, placement(rank <= 3 ? rank : null));
  });
  // Assign places in descending order, then announce/display low to high.
  return [...results].sort((a, b) => {
    if (a.score === null || b.score === null) return a.score === b.score ? routineOrder(a.row, b.row) : a.score === null ? -1 : 1;
    return Math.abs(a.score - b.score) < EPSILON ? routineOrder(a.row, b.row) : a.score - b.score;
  }).map((item) => ({ routineId: item.row.id, score: item.score,
    maximumScore: item.maximumScore,
    medal: scoredIds.has(item.row.id) ? competitionMedalForScore(item.score, item.maximumScore) : null,
    directCompetition, eligibleCount, placement: byId.get(item.row.id) ?? null,
    ...(item.audience ? { juryScore: item.juryScore, audience: item.audience } : {}) }));
}

function genrePriority(label) {
  const value = stable(label);
  return value.includes("tela") ? 0 : value.includes("aro") ? 1 : value.includes("open") ? 2 : 3;
}

function isBlockFour(rows) {
  return rows.some((row) => [row.nativeBlockId ?? row.blockId, row.blockName].some((value) => /(?:^|-)(?:bloque|block)-4(?:-|$)/.test(stable(value))));
}

function isReleveResult(item) {
  return Boolean(item.audience) || ["division", "category", "genre"].some((field) => normalized(item.row[field]) === "RELEVE");
}

function sectionsFor(results, config) {
  const groups = new Map();
  for (const item of results) {
    const isReleve = isReleveResult(item);
    const kind = isReleve ? "releve" : "competition";
    const label = isReleve ? "RELEVÉ" : groupLabel(config.primary, item.row, config.danceAliases);
    const sectionKey = `${kind}|${label}`;
    if (!groups.has(sectionKey)) groups.set(sectionKey, { kind, label, categories: new Map() });
    const values = isReleve ? ["RELEVÉ"] : config.secondary.map((field) => groupLabel(field, item.row));
    const id = [label, ...values].map(normalized).join("|");
    const group = groups.get(sectionKey).categories;
    if (!group.has(id)) group.set(id, { id, title: categoryTitle(values), items: [] });
    group.get(id).items.push(item);
  }
  const customOrder = config.primary === "genre" && config.danceAliases && !isBlockFour(results.map((item) => item.row));
  return [...groups.values()].map(({ kind, label, categories }) => ({
    id: kind === "releve" ? "PREMIO_RELEVE" : normalized(label), kind, label,
    categories: [...categories.values()].sort((a, b) => {
      const aNumber = a.items.reduce((min, item) => minimumNumber(item.row.id) < min ? minimumNumber(item.row.id) : min, 9223372036854775807n);
      const bNumber = b.items.reduce((min, item) => minimumNumber(item.row.id) < min ? minimumNumber(item.row.id) : min, 9223372036854775807n);
      return aNumber < bNumber ? -1 : aNumber > bNumber ? 1 : textOrder.compare(a.title, b.title);
    }).map((category) => ({ id: category.id, title: category.title, rows: categoryRows(category.items) })),
  })).sort((a, b) => Number(a.kind === "releve") - Number(b.kind === "releve")
    || (customOrder ? genrePriority(a.label) - genrePriority(b.label) : 0) || textOrder.compare(a.label, b.label));
}

function awardId(value) {
  const slug = stable(value);
  const compact = slug.replaceAll("-", "");
  if (["bestcostume", "mejorvestuario"].includes(compact)) return "award_1";
  if (["bestmusic", "mejormusica"].includes(compact)) return "award_2";
  if (["bestchoreographicidea", "mejorideacoreografica", "innovacion"].includes(compact)) return "award_3";
  if (["porra", "bestporra", "mejorporra", "espiritudeequipo"].includes(compact)) return "award_4";
  const slot = compact.match(/^(?:award|premio|specialaward|slot)(\d+)$/);
  return slot && Number(slot[1]) > 0 ? `award_${Number(slot[1])}` : slug.replaceAll("-", "_");
}

function awardsFor(block, input, configuration, warn) {
  const configured = configuration.specialAwards ?? configuration.special_awards;
  const defaults = [
    { category: "award_2", title: "Mejor música" },
    { category: "award_1", title: "Mejor vestuario" },
    { category: "award_3", title: "Mejor idea coreográfica" },
    { category: "award_4", title: "Mejor porra" },
  ];
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
  const resolved = slots.flatMap((slot) => {
    const id = awardId(slot?.category);
    if (!id || !text(slot?.title)) { warn("Hay premios especiales con una configuración incompleta."); return []; }
    if (seen.has(id) || option(slot, "isEnabled", "is_enabled", true) === false
      || (text(input.event.id) === releveJudgingEventId && id === CHAMPION_AWARD_ID)) return [];
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
    const routineLabel = routine ? [text(routine.name) || "Coreografía sin nombre", text(routine.academy)].filter(Boolean).join(" · ") : "Sin asignar";
    return [{ id, title: text(slot.title), displayValue: manual || routineLabel,
      isAssigned: Boolean(manual || routine), routineId: routine?.id ?? null }];
  });
  // Standard ceremony order is fixed, even when import configuration lists
  // aliases in another order. Additional awards keep their relative order.
  const priority = { award_2: 0, award_1: 1, award_3: 2, award_4: 4 };
  return resolved.sort((left, right) => (priority[left.id] ?? 3) - (priority[right.id] ?? 3));
}

function releveAudienceFavorite(eventId, results, voting) {
  const releve = results.filter(isReleveResult);
  if (!releve.length) return undefined;
  const result = (status, winner = null) => ({ status, winner });
  if (eventId !== releveJudgingEventId || voting?.eventId !== eventId || voting?.pollId !== releveCompetitionPollId
    || releve.some((item) => !item.audience || item.audience.candidateId === null)) return result("pending");
  if (voting.status === "tie_pending" && releve.every((item) => item.audience.status === "tie_pending")) return result("tie");
  if (voting.status !== "closed" || voting.ready !== true || releve.some((item) => item.audience.ready !== true)) return result("pending");
  const favorites = releve.filter((item) => item.audience.bonus === 5 && Number.isSafeInteger(item.audience.votes) && item.audience.votes > 0);
  if (favorites.length === 1) {
    const item = favorites[0];
    return result("ready", { routineId: item.row.id, name: text(item.row.name), academy: text(item.row.academy), votes: item.audience.votes });
  }
  return result(favorites.length === 0 && voting.totalVotes === 0 ? "none" : "pending");
}

function championAward(results) {
  const candidates = results.filter((item) => !isReleveResult(item));
  const pending = {
    id: CHAMPION_AWARD_ID, title: "Campeón de campeones",
    displayValue: "Pendiente de completar las calificaciones de competencia general",
    isAssigned: false, routineId: null,
  };
  // A complete event read establishes the candidate pool; every general routine
  // must also have its full jury sheet before this becomes a final award.
  if (!candidates.length || candidates.some((item) => item.row.status !== "complete"
    || !Number.isInteger(item.row.expectedJudges) || item.row.expectedJudges < 1
    || item.row.completedJudges !== item.row.expectedJudges || item.row.recordedScores < 1
    || numeric(item.score) === null || numeric(item.maximumScore) === null || item.maximumScore <= 0
    || item.score < 0 || item.score > item.maximumScore)) return pending;
  const maximum = Math.max(...candidates.map((item) => item.score));
  const winners = candidates.filter((item) => Math.abs(item.score - maximum) < EPSILON)
    .sort((left, right) => routineOrder(left.row, right.row));
  const scoreLabel = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(maximum);
  const winnerLabel = (item) => [
    text(item.row.name) || "Coreografía sin nombre",
    text(item.row.academy) || "Sin academia",
  ].join(" · ");
  return {
    id: CHAMPION_AWARD_ID, title: "Campeón de campeones",
    displayValue: `${winners.length > 1 ? "Empate: " : ""}${winners.map(winnerLabel).join(" / ")} · ${scoreLabel} puntos`,
    isAssigned: true, routineId: winners.length === 1 ? winners[0].row.id : null,
  };
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
  const config = { primary, secondary,
    danceAliases: option(rawReport, "useDanceGenreAliases", "use_dance_genre_aliases", true) !== false };
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
  const eventResults = [];
  const blocks = [...blocksById.values()].map((block) => {
    const results = (rowsByBlock.get(block.id) ?? []).map((row) => {
      const result = officialResult(row, unavailable, warn);
      return { row, ...result, ...releveStanding(text(event.id), row, result.score, result.maximumScore, input.releveVoting, warn) };
    });
    eventResults.push(...results);
    const sections = validGrouping ? sectionsFor(results, config) : [];
    const audienceFavorite = releveAudienceFavorite(text(event.id), results, input.releveVoting);
    const top = results.filter((item) => !isReleveResult(item) && item.score !== null).sort((a, b) => Math.abs(a.score - b.score) < EPSILON
      ? (minimumNumber(a.row.id) < minimumNumber(b.row.id) ? -1 : minimumNumber(a.row.id) > minimumNumber(b.row.id) ? 1 : textOrder.compare(a.row.name, b.row.name))
      : b.score - a.score)[0];
    return {
      ...block, sections,
      ...(audienceFavorite ? { releveAudienceFavorite: audienceFavorite } : {}),
      specialAwards: option(rawReport, "showSpecialAwards", "show_special_awards", true) !== false ? awardsFor(block, input, configuration, warn) : [],
      counts: { disciplines: sections.length, categories: sections.reduce((sum, section) => sum + section.categories.length, 0),
        scored: results.filter((item) => item.score !== null && item.score > 0 && (!item.audience || item.row.recordedScores > 0)).length, total: results.length },
      topScore: option(rawReport, "showTopScore", "show_top_score", true) !== false && top ? { routineId: top.row.id, score: top.score } : null,
    };
  });
  if (text(event.id) === releveJudgingEventId && input.completeEvent === true
    && option(rawReport, "showSpecialAwards", "show_special_awards", true) !== false) {
    // Use the configured running order rather than an appended orphan block.
    const finalBlockId = [...array(input.blocks)].filter((block) => text(block.event_id) === text(event.id) && text(block.block_id))
      .sort((left, right) => (numeric(left.sort_order) ?? 0) - (numeric(right.sort_order) ?? 0)).at(-1)?.block_id;
    const finalBlock = blocks.find((block) => block.id === text(finalBlockId));
    if (finalBlock) {
      const porraIndex = finalBlock.specialAwards.findIndex((award) => award.id === "award_4");
      finalBlock.specialAwards.splice(porraIndex < 0 ? finalBlock.specialAwards.length : porraIndex, 0, championAward(eventResults));
    }
  }
  return { title: text(rawReport.title) || "Dictamen final", subtitle: text(rawReport.subtitle) || "Resultados oficiales de la hoja de jueceo",
    maximumScore: eventResults.reduce((maximum, item) => numeric(item.maximumScore) !== null && item.maximumScore > 0
      ? Math.max(maximum, item.maximumScore) : maximum, 0) || 1, blocks };
}
