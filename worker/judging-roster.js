// Read-only admin results use the jury confirmed for each competition area.
// Keep this separate from judge login permissions and native app assignments.
const identity = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '');
const teams = {
  motion: [['EVA CARRILLO', 'EVA CARRILO'], ['DANIEL MONTALVO'], ['JORGE DIAZ', 'JORGE DIAZ DE LEON']],
  aerial: [['DANIEL HERRERA'], ['RENATA PINAL'], ['ANA KAREN ROJAS']],
};
const genres = {
  motion: new Set(['MOTION', 'DANZASNOAEREAS', 'ACROJAZZ', 'BALLET', 'BELLYDANCE', 'CONTEMPORANEO',
    'DANZACONTEMPORANEA', 'FOLKLORE', 'FOLCLORE', 'JAZZ', 'LIRICO', 'OPENMOTION', 'URBANOS', 'HIPHOP',
    'DANZAURBANA', 'DANZASURBANAS']),
  aerial: new Set(['AEREO', 'AEREA', 'AERIAL', 'DANZAAEREA', 'DANZASAEREAS', 'ARO', 'TELA', 'TELAS',
    'TRAPECIO', 'CUNA', 'LUNA', 'ESFERA', 'POLEAEREO', 'SUSPENSIONCAPILAR', 'OPEN', 'OPENAEREO',
    'OPENAERIAL', 'OPENTRAPECIO', 'OPENCUNA', 'OPENLUNA', 'OPENESFERA', 'OPENPOLEAEREO',
    'OPENSUSPENSIONCAPILAR', 'OPENOTRO', 'CINTAS', 'OPENCINTAS']),
};

function competitionArea(routine, block) {
  const genre = identity(routine.genre);
  for (const [area, values] of Object.entries(genres)) if (values.has(genre)) return area;
  // Historical blocks may be titled "Danzas no aéreas". Do not mistake that
  // label for Aerial, or infer the area from a block's number (demo blocks mix it).
  const label = [block?.title, block?.name, routine.block_title, routine.block]
    .filter(value => typeof value === 'string').join(' ').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  if (/\bMOTION\b|\bNO\s+AERE[AO]S?\b/.test(label)) return 'motion';
  if (/\bAERIAL\b|\bAERE[AO]S?\b/.test(label)) return 'aerial';
  return null;
}

export function levitateJudgesForRoutine(judges, routine, block, warn) {
  const area = competitionArea(routine, block);
  if (!area) {
    warn('Hay coreografías cuyo equipo de jueces no se pudo identificar; revisa su disciplina o el título del bloque.');
    return { judges: [], expectedCount: 0, unavailable: true };
  }
  const selected = [];
  let unavailable = false;
  for (const aliases of teams[area]) {
    const names = new Set(aliases.map(identity));
    const matches = judges.filter(judge => identity(judge.role) === 'JUDGE' && names.has(identity(judge.name)));
    if (matches.length === 1) selected.push(matches[0]);
    else {
      unavailable = true;
      warn(`El equipo de ${area === 'motion' ? 'Motion' : 'Aerial'} requiere tres jueces con identidades únicas; revisa los jueces del evento.`);
    }
  }
  return { judges: selected, expectedCount: 3, unavailable };
}
