// One client-side definition of the full-name rule (positional so both
// camelCase and snake_case forms can use it).
export function buildFullName(first, middle, last, suffix) {
  return [first, middle, last, suffix]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(' ');
}
