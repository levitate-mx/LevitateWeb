function recipientText(value) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('Revisa los datos del reconocimiento.');
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function measuredWidth(measure, value, size) {
  const width = measure(value, size);
  if (!Number.isFinite(width) || width < 0) throw new Error('No pudimos medir el texto del reconocimiento.');
  return width;
}

function fitSingleLine(value, measure, maximumSize, minimumSize, width) {
  for (let size = maximumSize; size >= minimumSize; size -= 0.5) {
    if (measuredWidth(measure, value, size) <= width) return { size, lines: [value] };
  }
  return null;
}

function fitBalancedLines(value, measure, maximumSize, minimumSize, width) {
  const words = value.split(' ');
  for (let size = maximumSize; size >= minimumSize; size -= 0.5) {
    let selected;
    for (let split = 1; split < words.length; split++) {
      const lines = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
      const widths = lines.map(line => measuredWidth(measure, line, size));
      if (Math.max(...widths) > width) continue;
      const imbalance = Math.abs(widths[0] - widths[1]);
      if (!selected || imbalance < selected.imbalance) selected = { size, lines, imbalance };
    }
    if (selected) return { size: selected.size, lines: selected.lines };
  }
  return null;
}

/** Recipient geometry in top-down points on the 612 × 792 recognition template. */
export function layoutParticipantDiplomaRecipient({ name, academy = '', measureName, measureAcademy }) {
  name = recipientText(name);
  academy = recipientText(academy);
  if (!name) throw new Error('El nombre es obligatorio.');
  if (typeof measureName !== 'function' || typeof measureAcademy !== 'function') throw new Error('Falta la medida del texto del reconocimiento.');

  // Keep both fields between “Se otorga a” and the template's pink rule.
  // A modest reduction is preferable to giving a surname its own short line.
  const fittedName = fitSingleLine(name, measureName, 29, 22, 470)
    || fitBalancedLines(name, measureName, 22, 18, 470);
  if (!fittedName) throw new Error('El nombre no cabe en esta plantilla. Revisa el diploma antes de emitirlo.');
  const fittedAcademy = !academy ? { size: 8, lines: [] }
    : fitSingleLine(academy, measureAcademy, 8, 7, 440)
      || fitBalancedLines(academy, measureAcademy, 7, 6.5, 440);
  if (!fittedAcademy) throw new Error('La academia no cabe en esta plantilla. Revisa el diploma antes de emitirlo.');

  return {
    name: { ...fittedName, baselines: fittedName.lines.length === 1 ? [390] : [366, 396] },
    academy: { ...fittedAcademy, baselines: fittedAcademy.lines.length === 0 ? [] : fittedAcademy.lines.length === 1 ? [420] : [416, 424] },
  };
}
