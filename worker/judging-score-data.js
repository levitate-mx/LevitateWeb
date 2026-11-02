// Read-only summaries of server-confirmed judging sheets. These totals belong
// to individual judges; they are not an official cross-judge score or ranking.
const array = (value) => Array.isArray(value) ? value : [];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === "string" ? value.trim() : "";
const normalized = (value) => text(value).normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
const stable = (value) => normalized(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
const sameKey = (left, right) => Boolean(text(left) && text(right))
  && (normalized(left) === normalized(right) || stable(left) === stable(right));
const key = (...parts) => JSON.stringify(parts);

function number(value) {
  if (typeof value !== "number" && !(typeof value === "string" && value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ordered(rows) {
  return [...rows].sort((left, right) => (number(left.sort_order) ?? 0) - (number(right.sort_order) ?? 0));
}

function scopedRows(rows, eventId, table, warn) {
  const input = array(rows);
  const scoped = input.filter((row) => text(row?.event_id) === eventId && eventId);
  if (scoped.length !== input.length) warn(`Se omitieron filas de ${table} que no corresponden al evento seleccionado.`);
  return scoped;
}

function uniqueRows(rows, idFor, table, warn) {
  const result = new Map();
  const repeated = new Set();
  for (const row of rows) {
    const id = idFor(row);
    if (!id) {
      warn(`Se omitieron filas de ${table} sin un identificador válido.`);
      continue;
    }
    if (result.has(id)) repeated.add(id);
    else result.set(id, row);
  }
  // Do not silently pick a version of an ambiguous sheet or criterion.
  if (repeated.size) warn(`Hay identificadores repetidos en ${table}; los datos ambiguos se omitieron.`);
  for (const id of repeated) result.delete(id);
  return result;
}

function selectTemplate(routine, templates) {
  const dimensions = [
    ["primary_categories", "primaryCategories", [routine.genre]],
    ["divisions", "divisions", [routine.division]],
    ["levels", "levels", [routine.level]],
    ["categories", "categories", [routine.category]],
    ["segments", "segments", [routine.block_id, routine.block]],
  ];
  let selected = null;
  let bestScore = -1;
  for (const template of templates) {
    const applicability = object(template.applies_to);
    let specificity = 0;
    let matches = true;
    for (const [snake, camel, values] of dimensions) {
      const candidates = array(applicability[snake] ?? applicability[camel]).filter((item) => text(item));
      if (!candidates.length) continue;
      specificity += 1;
      if (!candidates.some((candidate) => values.some((value) => sameKey(candidate, value)))) matches = false;
    }
    const matchScore = specificity
      ? (matches ? 100 + specificity : -1)
      : ([template.template_id, template.genre].some((value) => sameKey(value, routine.genre)) ? 10 : -1);
    if (matchScore > bestScore) {
      bestScore = matchScore;
      selected = template;
    }
  }
  if (selected) return selected;
  // This is the explicit iOS fallback for the supported aerial apparatuses.
  // An unrelated first template is deliberately not used for unknown genres.
  const genre = normalized(routine.genre);
  if (genre.includes("TELA") || genre.includes("ARO")) {
    return templates.find((template) => normalized(template.genre) === "DANZA AEREA") ?? null;
  }
  return null;
}

function criterionWeight(criterion, weights, warn) {
  const candidates = [String(criterion.id), criterion.label, normalized(criterion.label), stable(criterion.label)];
  for (const candidate of candidates) {
    const entry = Object.entries(weights).find(([name]) => name === candidate)
      ?? Object.entries(weights).find(([name]) => normalized(name) === normalized(candidate))
      ?? Object.entries(weights).find(([name]) => stable(name) === stable(candidate));
    if (!entry) continue;
    const value = number(entry[1]);
    if (value === null) {
      warn("Hay ponderaciones de criterios inválidas; los subtotales afectados no están disponibles.");
      return null;
    }
    return Math.max(0, value);
  }
  return 1;
}

function expectedForBlock(judges, block, routine) {
  const assigned = judges.some((judge) => array(judge.assigned_block_ids).some((id) => text(id)));
  if (!assigned || !block) return judges;
  const blockKeys = [block.block_id, block.name, block.title, routine.block_id, routine.block];
  const matches = judges.filter((judge) => array(judge.assigned_block_ids)
    .some((id) => blockKeys.some((blockKey) => sameKey(id, blockKey))));
  // Match the iOS expectedScoringJudges fallback when no judge matches a block.
  return matches.length ? matches : judges;
}

export function buildJudgingScoreSnapshot(input = {}, fetchedAt = new Date().toISOString()) {
  const sourceEvent = object(input.event);
  const eventId = text(sourceEvent.id);
  const warnings = new Set();
  const warn = (message) => warnings.add(message);
  if (!eventId) warn("No se recibió un evento de jueceo válido.");
  const scoped = (table) => scopedRows(input[table], eventId, table, warn);
  const routines = uniqueRows(ordered(scoped("routines")), (row) => text(row.routine_id), "routines", warn);
  const blocks = uniqueRows(ordered(scoped("blocks")), (row) => text(row.block_id), "blocks", warn);
  const allJudges = uniqueRows(ordered(scoped("judges")), (row) => text(row.judge_id), "judges", warn);
  const judges = [...allJudges.values()].filter((judge) => normalized(judge.role) !== "ADMIN");
  const templates = uniqueRows(ordered(scoped("templates")), (row) => text(row.template_id), "templates", warn);
  const criterionRows = scoped("criteria");
  const criteriaByTemplate = new Map();
  for (const template of templates.values()) {
    const raw = ordered(criterionRows.filter((row) => text(row.template_id) === text(template.template_id)));
    const byId = uniqueRows(raw, (row) => {
      const id = number(row.criterion_id);
      return id !== null && Number.isInteger(id) && id >= 0 ? String(id) : "";
    }, "criteria", warn);
    const criteria = [...byId.values()].map((row) => ({
      id: number(row.criterion_id), label: text(row.label), section: text(row.section), maximumScore: number(row.max_score),
    }));
    const valid = raw.length > 0 && criteria.length === raw.length
      && criteria.every((criterion) => criterion.maximumScore !== null && criterion.maximumScore >= 0);
    if (!valid && raw.length) warn("Hay criterios de evaluación inválidos o repetidos; las hojas afectadas no están disponibles.");
    criteriaByTemplate.set(text(template.template_id), valid ? criteria : null);
  }
  if (criterionRows.some((row) => !templates.has(text(row.template_id)))) {
    warn("Se omitieron criterios que no pertenecen a una plantilla del evento seleccionado.");
  }
  const sheetRows = (table, idFor) => {
    const rows = scoped(table).filter((row) => {
      const known = routines.has(text(row.routine_id)) && allJudges.has(text(row.judge_id));
      if (!known) warn(`Se omitieron filas de ${table} que no pertenecen a una rutina y juez del evento seleccionado.`);
      return known;
    });
    return uniqueRows(rows, idFor, table, warn);
  };
  const scoreRows = sheetRows("scores", (row) => {
    const criterionId = number(row.criterion_id);
    return criterionId !== null && Number.isInteger(criterionId) && criterionId >= 0
      ? key(text(row.routine_id), text(row.judge_id), criterionId) : "";
  });
  const penaltyRows = sheetRows("penalties", (row) => key(text(row.routine_id), text(row.judge_id)));
  const feedbackRows = sheetRows("feedback", (row) => key(text(row.routine_id), text(row.judge_id)));
  const configuration = object(sourceEvent.competition_config);
  const scoring = object(configuration.scoring ?? configuration.scoring_rules);
  const configuredWeights = scoring.criterionWeights ?? scoring.criterion_weights;
  const weights = object(configuredWeights);
  const weightsInvalid = configuredWeights != null && (typeof configuredWeights !== "object" || Array.isArray(configuredWeights));
  if (weightsInvalid) warn("La configuración de ponderaciones de criterios es inválida; los subtotales no están disponibles.");
  const usedScores = new Set();
  const rows = [...routines.values()].map((routine) => {
    const routineId = text(routine.routine_id);
    const block = blocks.get(text(routine.block_id))
      ?? [...blocks.values()].find((item) => text(item.name) === text(routine.block))
      ?? (text(routine.block_id) || text(routine.block)
        ? { block_id: text(routine.block_id), name: text(routine.block), title: "" } : null);
    const expected = expectedForBlock(judges, block, routine);
    const template = selectTemplate(routine, [...templates.values()]);
    const criteria = template ? criteriaByTemplate.get(text(template.template_id)) : null;
    if (!criteria?.length) warn("Hay rutinas sin una plantilla de evaluación reconocida con criterios válidos.");
    if (!expected.length) warn("Hay rutinas sin jueces disponibles para consultar sus puntuaciones.");
    const weightedCriteria = array(criteria).map((criterion) => ({ ...criterion, weight: criterionWeight(criterion, weights, warn) }));
    const weightedMaximum = weightedCriteria.reduce((sum, criterion) => sum + criterion.maximumScore * criterion.weight, 0);
    const invalidMaximum = !Number.isFinite(weightedMaximum);
    if (invalidMaximum) warn("La ponderación supera el rango numérico permitido; los subtotales afectados no están disponibles.");
    const unavailable = !criteria?.length || !expected.length || weightsInvalid || invalidMaximum
      || weightedCriteria.some((criterion) => criterion.weight === null);
    let recordedScores = 0;
    const judgeResults = expected.map((judge) => {
      const judgeId = text(judge.judge_id);
      const sheetKey = key(routineId, judgeId);
      let invalidScore = false;
      let attemptedScore = false;
      let recorded = 0;
      const values = weightedCriteria.map((criterion) => {
        const scoreKey = key(routineId, judgeId, criterion.id);
        const row = scoreRows.get(scoreKey);
        let value = null;
        if (row) {
          usedScores.add(scoreKey);
          attemptedScore = true;
          const parsed = number(row.value);
          if (parsed !== null && parsed >= 0 && parsed <= criterion.maximumScore) {
            value = parsed;
            recorded += 1;
          } else {
            invalidScore = true;
            warn("Hay notas inválidas o fuera del máximo del criterio; no se consideran hojas completas.");
          }
        }
        return { id: criterion.id, label: criterion.label, section: criterion.section, value, maximumScore: criterion.maximumScore };
      });
      recordedScores += recorded;
      const penaltyRow = penaltyRows.get(sheetKey);
      const rawPenalty = penaltyRow ? number(penaltyRow.value) : 0;
      const invalidPenalty = rawPenalty === null || rawPenalty < -100 || rawPenalty > 0;
      if (invalidPenalty) warn("Hay penalizaciones inválidas; los totales afectados no están disponibles.");
      const penalty = invalidPenalty ? 0 : rawPenalty;
      const subtotal = recorded && !unavailable
        ? values.reduce((sum, value, index) => sum + (value.value ?? 0) * weightedCriteria[index].weight, 0) : null;
      const maximumScore = unavailable ? null : weightedMaximum;
      const total = subtotal !== null && !invalidPenalty ? Math.max(0, subtotal + penalty) : null;
      const complete = values.length > 0 && recorded === values.length && !invalidScore && !invalidPenalty && !unavailable;
      return {
        id: judgeId, name: text(judge.name), status: complete ? "complete" : attemptedScore ? "partial" : "pending",
        subtotal, penalty, total, maximumScore, criteria: values, feedback: text(feedbackRows.get(sheetKey)?.body),
      };
    });
    const completedJudges = judgeResults.filter((judge) => judge.status === "complete").length;
    return {
      id: routineId, name: text(routine.name), academy: text(routine.academy), genre: text(routine.genre),
      division: text(routine.division), category: text(routine.category), level: text(routine.level),
      blockId: text(routine.block_id) || text(block?.block_id), blockName: text(block?.name) || text(routine.block),
      status: unavailable ? "unavailable" : completedJudges === expected.length ? "complete"
        : judgeResults.some((judge) => judge.status === "partial" || judge.status === "complete") ? "partial" : "pending",
      completedJudges, expectedJudges: expected.length, recordedScores, judges: judgeResults,
    };
  });
  if ([...scoreRows.keys()].some((scoreKey) => !usedScores.has(scoreKey))) {
    warn("Se omitieron notas que no corresponden a los criterios o jueces esperados de la rutina.");
  }
  return {
    event: {
      id: eventId, name: text(sourceEvent.name), sourceName: text(sourceEvent.source_name),
      isActive: sourceEvent.is_active === true, startsAt: text(sourceEvent.starts_at) || null,
    },
    fetchedAt: fetchedAt instanceof Date ? fetchedAt.toISOString() : String(fetchedAt),
    warnings: [...warnings], rows,
  };
}
