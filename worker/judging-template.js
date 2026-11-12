const text = value => typeof value === 'string' ? value.trim() : '';
const normalized = value => text(value).normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
const stable = value => normalized(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
const sameKey = (left, right) => Boolean(text(left) && text(right)) && (normalized(left) === normalized(right) || stable(left) === stable(right));
const array = value => Array.isArray(value) ? value : [];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};

export const minimumJudgingScore = template => normalized(template?.genre) === 'RELEVE' ? 1 : 0;

export function selectJudgingTemplate(routine, templates) {
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

