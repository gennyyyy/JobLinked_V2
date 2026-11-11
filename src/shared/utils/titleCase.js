// Display-layer capitalization helper.
//
// The database stores names, company names, and address fields in lowercase
// (see LOWERCASE_FIELDS in server/src/routes/profiles.js) so search and
// matching stay case-insensitive. This helper is the single source of truth
// for how those values are shown to users.
//
// Rules:
//   - Roman numerals (I II III IV V VI VII VIII IX X) stay upper-case.
//   - Particles (the, of, de, del, la, las, los, van, von, der, da, do, dos,
//     das, le, les, du, des, di, et) and ordinal words (second..tenth) stay
//     lowercase unless they are the first word of the whole value.
//   - Hyphen and apostrophe boundaries each start a new capitalized token
//     (Maria-Clara, D'Cruz), even for particles.
// Do NOT use this for emails, URLs, skills/tags, or enum values (statuses,
// employment types) - those are matching tokens or identifiers, not names.
const UPPER_TOKENS = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']);
const LOWER_TOKENS = new Set(['the', 'of', 'de', 'del', 'la', 'las', 'los', 'van', 'von', 'der', 'da', 'do', 'dos', 'das', 'le', 'les', 'du', 'des', 'di', 'et', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']);

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

export function titleCase(value) {
  if (value == null) return '';
  const str = String(value);
  if (!str) return '';
  return str.toLowerCase().replace(/[^\s\-']+/g, (w, offset, full) => {
    if (UPPER_TOKENS.has(w)) return w.toUpperCase();
    const prefix = full.slice(0, offset);
    const atStart = prefix.trim() === '';
    const afterBoundary = /[-']$/.test(prefix);
    if (atStart || afterBoundary) return cap(w);
    if (LOWER_TOKENS.has(w)) return w;
    return cap(w);
  });
}