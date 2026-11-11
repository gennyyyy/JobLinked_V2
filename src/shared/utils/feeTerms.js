export function normalizeFeeText(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function findFeeMatches(text, terms) {
  const norm = normalizeFeeText(text);
  const padded = ` ${norm} `;
  return (terms || []).filter((t) => padded.includes(` ${String(t).toLowerCase()} `));
}