import { createClient } from '@supabase/supabase-js';
import { fromNodeHeaders } from 'better-auth/node';
// Aliased: `auth` is the middleware this module exports.
import { auth as baAuth } from './ba.js';
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
//
// `inactive` is the role-move STALE marker and nothing else (the admin UI only
// sets active/suspended; PATCH rejects `inactive`). A suspended CURRENT row
// must therefore outrank a stale row in a higher-precedence table — otherwise
// a suspended account cannot be resolved (or reinstated) at all. Order is:
// non-stale first, then active, then table precedence.
export async function resolveRole(id) {
  const { rows } = await pool.query(
    `select role, profile from (
       select 'super-admin' as role, to_jsonb(s) as profile, 1 as ord from super_admins s where id = $1
       union all
       select 'employer' as role, to_jsonb(e) as profile, 2 as ord from employers e where id = $1
       union all
       select 'job-seeker' as role, to_jsonb(j) as profile, 3 as ord from job_seekers j where id = $1
     ) t order by (profile->>'status' <> 'inactive') desc, (profile->>'status' = 'active') desc, ord limit 1`, [id]);
  const row = rows[0];
  if (!row) return null;
  // ADR-042: the permission bundle is a SECOND query, and only for accounts that
  // actually carry a custom role — the seeded system admin (the common case, and
  // every existing fixture) pays nothing. `custom_role_id` already rides inside
  // the profile row, so the first statement stays untouched. roleFrom() memoizes
  // this whole function per request, so the extra statement runs at most once.
  // The FK is `on delete set null`, so a deleted role reads as "no custom role".
  const customRoleId = row.profile?.custom_role_id ?? null;
  let permissions = [];
  if (customRoleId !== null) {
    const bundle = await pool.query(
      `select coalesce(details->'permissions', '[]'::jsonb) as permissions
         from reference_data where id = $1 and category = 'custom_role'`, [customRoleId]);
    if (Array.isArray(bundle.rows[0]?.permissions)) permissions = bundle.rows[0].permissions;
  }
  return { ...row, custom_role_id: customRoleId, permissions };
}

// One shape for the principal, so every attach site carries the same fields
// (ADR-042 needs customRoleId + permissions on the request). app_metadata is
// the legacy (Supabase) provider-side role signal — a BA principal has none.
function principalOf(resolved, found) {
  return {
    id: resolved.id,
    email: resolved.email,
    role: found.role,
    app_metadata: resolved.source === 'supabase' ? resolved.app_metadata : undefined,
    customRoleId: found.custom_role_id ?? null,
    permissions: Array.isArray(found.permissions) ? found.permissions : [],
  };
}

// ADR-056 dual window (Task 5): a request resolves to the BA cookie first, then
// the legacy Supabase bearer. One memo per request — attachPrincipal and the
// route's own middleware share the lookup. The cookie check is a substring so
// it matches both `better-auth.session_token` and `__Secure-better-auth...`.
const baCookie = (req) => (req.headers.cookie || '').includes('better-auth.session_token');
const bearerToken = (req) => (req.headers.authorization || '').replace(/^bearer\s+/i, '');
const userFromToken = (req) => (req._supaUser ??= (async () => {
  const token = bearerToken(req);
  if (!token) return null;
  try {
    return await cachedGetUser(token, (t) => supa().auth.getUser(t));
  } catch { return null; }
})());

// Never throws: a failed lookup is simply "no principal", so an auth outage
// answers 401 instead of 500 and a BA hiccup still lets the bearer through.
const resolveSession = (req) => (req._session ??= (async () => {
  try {
    const cookie = baCookie(req);
    if (!cookie && !bearerToken(req)) return null;
    if (cookie) {
      try {
        const session = await baAuth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (session?.user) {
          return {
            source: 'ba',
            id: session.user.id,
            email: session.user.email,
            role: session.user.role ?? null,
            // Decision 6 / Task 6: the two-factor plugin's user flag. BA issues no
            // session before the factor step, so this is the whole aal signal.
            twoFactorEnabled: session.user.twoFactorEnabled === true,
          };
        }
      } catch { /* fall through — the Supabase bearer may still be valid */ }
    }
    const user = await userFromToken(req);
    return user ? { source: 'supabase', id: user.id, email: user.email, app_metadata: user.app_metadata } : null;
  } catch { return null; }
})());

// The role-table lookup is memoized per request (one round-trip, shared by
// attachPrincipal and the route's own middleware). It sits on top of the
// cross-request Supabase token cache (F2, tokenCache.js) — a different scope.
const roleFrom = (req, id) => (req._role ??= resolveRole(id));

// App-level principal attachment for the rate limiter's keyGenerator.
// Best-effort — an invalid, unprovisioned, or inactive session simply leaves
// req.user unset (the limiter falls back to the IP), and the route's own auth
// middleware still enforces its 401/403 unchanged.
export async function attachPrincipal(req, _res, next) {
  try {
    const resolved = await resolveSession(req);
    if (resolved) {
      const found = await roleFrom(req, resolved.id).catch(() => null);
      if (found?.profile.status === 'active') {
        req.user = principalOf(resolved, found);
      }
    }
  } catch { /* never let the limiter's helper fail a request */ }
  next();
}

// Required auth: BA cookie or legacy Supabase bearer, then the role-table gate.
export async function auth(req, res, next) {
  const cookie = baCookie(req);
  if (!cookie && !bearerToken(req)) return err(res, 401, 'UNAUTHORIZED', 'Missing access token');
  const resolved = await resolveSession(req);
  if (!resolved) return err(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  let found;
  try {
    found = await roleFrom(req, resolved.id);
  } catch {
    return err(res, 500, 'INTERNAL', 'Role lookup failed');
  }
  if (!found) return err(res, 403, 'FORBIDDEN', 'Account not provisioned');
  if (found.profile.status !== 'active') {
    return err(res, 403, 'FORBIDDEN', 'This account has been suspended or deactivated. Contact PESO.');
  }
  // Defense-in-depth (ADR-056 decision 7): a super_admins row only grants admin
  // when the provider-side signal agrees — BA's admin-plugin user.role now, the
  // service-role-only app_metadata during the dual window. A forged/escalated
  // row is rejected.
  const providerRole = resolved.source === 'ba' ? resolved.role : resolved.app_metadata?.role;
  if (found.role === 'super-admin' && providerRole !== 'super-admin') {
    return err(res, 403, 'FORBIDDEN', 'Insufficient privileges');
  }
  req.user = principalOf(resolved, found);
  next();
}

// Optional auth for public reads: attaches req.user when a valid session is present.
export async function optionalAuth(req, _res, next) {
  const resolved = await resolveSession(req);
  if (!resolved) return next();
  const found = await roleFrom(req, resolved.id).catch(() => null);
  if (found && found.profile.status === 'active') {
    req.user = principalOf(resolved, found);
  }
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : err(res, 403, 'FORBIDDEN', 'Insufficient role');

// Token-only auth (Addendum B): validates the session but SKIPS the
// provisioned-row check — a fresh session has no row by definition. Carries
// the provider role so provision can authorize a super-admin grant (BA's
// user.role, or app_metadata — service-role-only — during the dual window),
// plus `source` and `twoFactorEnabled` for the /auth/me aal mapping.
export async function tokenAuth(req, res, next) {
  const cookie = baCookie(req);
  if (!cookie && !bearerToken(req)) return err(res, 401, 'UNAUTHORIZED', 'Missing access token');
  const resolved = await resolveSession(req);
  if (!resolved) return err(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  req.user = {
    id: resolved.id,
    email: resolved.email,
    role: resolved.role ?? null,
    app_metadata: resolved.app_metadata,
    // Task 6: routes branch on the source (never read app_metadata for BA) and
    // derive /auth/me's aal from the BA user flag instead of re-querying BA.
    source: resolved.source,
    twoFactorEnabled: resolved.twoFactorEnabled === true,
  };
  next();
}
