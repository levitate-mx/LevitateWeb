export function buildWorkshopRosters(rows, sessions = []) {
  const metadata = new Map(sessions.map(session => [session.label, session]));
  const groups = new Map();
  for (const participant of rows) for (const label of new Set(participant.workshops)) {
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(participant);
  }
  const used = new Set(['resumen']);
  return [...groups].sort(([a], [b]) => (metadata.get(a)?.start || '').localeCompare(metadata.get(b)?.start || '') || a.localeCompare(b, 'es'))
    .map(([label, participants]) => {
      const parts = label.split(' · ');
      const title = parts.length === 3 && metadata.get(label)?.start
        ? `${parts[0]} ${parts[1]} ${metadata.get(label).start.replace(':', '.')}` : label;
      const base = title.replace(/[\\/?*\[\]:]/g, '-').replace(/^'+|'+$/g, '').trim() || 'Taller';
      let worksheetName = base.slice(0, 31), suffix = 1;
      while (used.has(worksheetName.toLocaleLowerCase('es'))) {
        const ending = ` (${++suffix})`;
        worksheetName = base.slice(0, 31 - ending.length) + ending;
      }
      used.add(worksheetName.toLocaleLowerCase('es'));
      return { label, worksheetName, participants: [...participants].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }) || a.academyName.localeCompare(b.academyName, 'es')) };
    });
}
