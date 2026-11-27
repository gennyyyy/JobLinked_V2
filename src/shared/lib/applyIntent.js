const KEY = 'joblinked:applyIntent'
const TTL_MS = 24 * 60 * 60 * 1000

// One-shot "log in to apply" intent: which public job the visitor was on when
// they chose to sign in (ADR-063). The entry survives the whole register →
// verify-email → sign-in round trip, so no link threading is needed.
export function stashApplyIntent(jobId) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: String(jobId), at: Date.now() }))
  } catch { /* storage unavailable (private mode): intent silently absent */ }
}

// Reads and clears. Returns the seeker-portal job page, or null when there is
// no live intent. Never navigates to the raw stored value.
export function takeApplyIntent() {
  let raw
  try { raw = localStorage.getItem(KEY) } catch { return null }
  if (!raw) return null
  try { localStorage.removeItem(KEY) } catch { /* removal is best-effort */ }
  try {
    const { id, at } = JSON.parse(raw)
    if (typeof id === 'string' && /^[A-Za-z0-9-]+$/.test(id) && Date.now() - at < TTL_MS) {
      return `/job-seeker/jobs/${id}`
    }
  } catch { /* corrupt entry: fall through to null */ }
  return null
}
