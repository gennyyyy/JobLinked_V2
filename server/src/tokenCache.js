// F2 (docs/arch/audit/phase4-loadtest.md): short-TTL memo of the Supabase
// getUser(token) result — the fix for the 395 req/s ceiling on authenticated
// reads. Every authenticated request used to pay a ~120 ms remote round-trip
// just to learn the user id. Keyed on the EXACT token string (not a hash):
// tokens are already opaque secrets and this map never leaves the process, so
// hashing them would add cost for no gain. Per-process by construction — one
// instance's cache is invisible to another, which is safe because the worst
// case is a missed memo (a Supabase round-trip), never a wrong principal.
// Tradeoff, documented in docs/arch/rework/02-api-contract.md: a Supabase-side
// session revocation (sign-out-all, password reset) stays invisible here for up
// to the TTL. Local account status stays immediate — resolveRole() in auth.js is
// deliberately NOT cached, so suspension/deactivation is read from Postgres on
// every request and a cached principal can never resurrect a stale account.
//
// Own module rather than a variable in auth.js so the test helper
// (server/src/__tests__/helpers/auth.js) can reset it: importing auth.js from
// there would cycle back through the @supabase/supabase-js mock factory and
// hang the whole suite.
const TOKEN_TTL_MS = 60_000;
const TOKEN_CACHE_MAX = 5_000;
const tokenUsers = new Map(); // exact token -> { user, at }

// Called between tests: the mocked Supabase registry is the truth again, so
// principals memoized by a previous test must not leak into the next one.
export function clearTokenCache() { tokenUsers.clear(); }

// Only positives are memoized: an invalid or expired token hits Supabase every
// time, so a transient Supabase error or a revocation is never frozen into the
// cache, and a token that becomes valid again is picked up immediately.
export async function cachedGetUser(token, getUser) {
  const hit = tokenUsers.get(token);
  if (hit && Date.now() - hit.at < TOKEN_TTL_MS) return hit.user;
  const { data, error } = await getUser(token);
  if (error || !data?.user) return null;
  tokenUsers.set(token, { user: data.user, at: Date.now() });
  // FIFO eviction, no LRU library: Map iterates in insertion order, and
  // re-setting an existing key keeps its original position, so a hot token
  // eventually ages out instead of becoming immortal.
  // ponytail: cheapest cap that holds; bump TOKEN_CACHE_MAX before adding
  // eviction logic.
  while (tokenUsers.size > TOKEN_CACHE_MAX) tokenUsers.delete(tokenUsers.keys().next().value);
  return data.user;
}
