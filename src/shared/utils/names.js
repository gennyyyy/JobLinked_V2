// One client-side definition of the full-name rule (positional so both
// camelCase and snake_case forms can use it).
export function buildFullName(first, middle, last, suffix) {
  return [first, middle, last, suffix]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(' ');
}

// ADR-058: mirrors the server's rolling 30-day window so the profile screens can
// disable the name fields before a save (which the API would refuse with 409).
const NAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export function nameChangeAvailableAt(nameChangedAt, now = new Date()) {
  if (!nameChangedAt) return null;
  const next = new Date(new Date(nameChangedAt).getTime() + NAME_CHANGE_COOLDOWN_MS);
  return next > now ? next : null;
}

export function nameChangeLockHelp(nameChangedAt, now = new Date()) {
  const next = nameChangeAvailableAt(nameChangedAt, now);
  if (!next) return null;
  return `You can change your name again on ${next.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })}.`;
}

