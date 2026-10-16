import { createClient } from '@supabase/supabase-js';
import { pool } from './db.js';
import { err } from './util.js';
import { cachedGetUser } from './tokenCache.js';

// S7: built lazily — a module-scope createClient throws when SUPABASE_URL is
// unset, which crashed every importing test. First use builds and caches it.
let _supa;
export function supa() { return _supa ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); }

// One round-trip instead of a per-table scan. `ord` keeps the old loop
// precedence explicit: super-admin, then employer, then job-seeker — among
// rows of the SAME status. An active row always wins over an inactive one:
// a role move deactivates the old table's row instead of deleting it (the FK
// cascade would destroy the user's jobs and applications), so without the
// status term the stale row would shadow the user's current role.
export async function resolveRole(id) {
  const { rows } = await pool.query(
    `select role, profile from (
       select 'super-admin' as role, to_jsonb(s) as profile, 1 as ord from super_admins s where id = $1
       union all
       select 'employer' as role, to_jsonb(e) as profile, 2 as ord from employers e where id = $1
       union all
       select 'job-seeker' as role, to_jsonb(j) as profile, 3 as ord from job_seekers j where id = $1
     ) t order by (profile->>'status' = 'active') desc, ord limit 1`, [id]);
  return rows[0] || null;
}

// F2 (docs/arch/audit/phase4-loadtest.md): the cross-request memo of the
// Supabase JWT -> user resolution lives in tokenCache.js (own module so the
// test helper can reset it without importing auth.js). The per-request
// userFromToken memo below still sits on top of it: within one request the
// principal is resolved once and shared by attachPrincipal and the route's own
// auth middleware, so no request ever pays two round-trips.
export const roleFrom = (req, id) => (req._role ??= resolveRole(id));

// Per-request memo of the JWT -> user resolution, layered over the cross-request
// memo in tokenCache.js: within one request attachPrincipal + the route's own
// auth middleware share one resolution, so no request ever pays two
// round-trips. The per-request memo stays because it is what the F-01 limiter
// keying already relies on; the TTL cache is what removes the round-trip
// itself, and the two are different scopes (request vs process).
const userFromToken = (req) => (req._supaUser ??= (async () => {
  const token = (req.headers.authorization || '').replace(/^bearer\s+/i, '');
  if (!token) return null;
  try {
    return await cachedGetUser(token, (t) => supa().auth.getUser(t));
  } catch { return null; }
})());

// App-level principal attachment for the rate limiter's keyGenerator.
// Best-effort — an invalid, unprovisioned, or inactive token simply leaves
// req.user unset (the limiter falls back to the IP), and the route's own auth
// middleware still enforces its 401/403 unchanged.
export async function attachPrincipal(req, _res, next) {
  try {
    const user = await userFromToken(req);
    if (user) {
      const found = await roleFrom(req, user.id).catch(() => null);
      if (found?.profile.status === 'active') {
        req.user = { id: user.id, email: user.email, role: found.role, app_metadata: user.app_metadata };
      }
    }
  } catch { /* never let the limiter's helper fail a request */ }
  next();
}

// Required auth: validates the Supabase JWT, attaches { id, email, role, app_metadata }.
export async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^bearer\s+/i, '');
  if (!token) return err(res, 401, 'UNAUTHORIZED', 'Missing access token');
  const user = await userFromToken(req);
  if (!user) return err(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  let found;
  try {
    found = await roleFrom(req, user.id);
  } catch {
    return err(res, 500, 'INTERNAL', 'Role lookup failed');
  }
  if (!found) return err(res, 403, 'FORBIDDEN', 'Account not provisioned');
  if (found.profile.status !== 'active') {
    return err(res, 403, 'FORBIDDEN', 'This account has been suspended or deactivated. Contact PESO.');
  }
  req.user = { id: user.id, email: user.email, role: found.role, app_metadata: user.app_metadata };
  next();
}

// Optional auth for public reads: attaches req.user when a valid token is present.
export async function optionalAuth(req, _res, next) {
  const user = await userFromToken(req);
  if (!user) return next();
  const found = await roleFrom(req, user.id).catch(() => null);
  if (found && found.profile.status === 'active') {
    req.user = { id: user.id, email: user.email, role: found.role, app_metadata: user.app_metadata };
  }
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : err(res, 403, 'FORBIDDEN', 'Insufficient role');

// Token-only auth (Addendum B): validates the Supabase JWT but SKIPS the
// provisioned-row check — a fresh session has no row by definition.
// app_metadata is service-role-only, so it is the one role signal the client
// cannot forge (provision trusts it for super-admin, never the body).
export async function tokenAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^bearer\s+/i, '');
  if (!token) return err(res, 401, 'UNAUTHORIZED', 'Missing access token');
  const user = await userFromToken(req);
  if (!user) return err(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  req.user = { id: user.id, email: user.email, app_metadata: user.app_metadata };
  next();
}
