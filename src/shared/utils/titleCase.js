// Roman numerals (name suffixes, address zones) are canonically upper-case;
// titleCase lower-cases everything first, so restore these whole tokens.
const UPPER_TOKENS = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']);

export function titleCase(value) {
  if (value == null) return "";
  const str = String(value);
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^\s\-']+/g, (w) => (UPPER_TOKENS.has(w) ? w.toUpperCase() : w))
    .replace(/(^|[\s\-'])([a-z\u00e0-\u00ff])/g, (m, pre, ch) => pre + ch.toUpperCase());
}
