import { vi } from 'vitest';
// The F2 token cache (tokenCache.js) lives above the mocked Supabase client, so
// a memoized principal survives resetAuth(). Drop it too, from its own module —
// importing auth.js here would cycle back through the supabase mock factory and
// hang the suite.
import { clearTokenCache } from '../../tokenCache.js';

// Token + provisioned-profile registries that the REAL auth.js middleware reads
// through the mocked Supabase client (getUser) and mocked pool (resolveRole).
const tokens = new Map(); // bearer token -> { id, email, app_metadata }
const profiles = new Map(); // user id -> { role, profile }

export const supabaseAuth = {
  getUser: vi.fn(async (token) => {
    const u = tokens.get(token);
    return u ? { data: { user: u }, error: null } : { data: null, error: { message: 'invalid token' } };
  }),
  admin: { inviteUserByEmail: vi.fn(), updateUserById: vi.fn() },
};

// --- Better Auth side of the seam (ADR-056 task 5) ---------------------------
// BA sessions are signed cookies, so the mock reads the session token out of
// the Web `Headers` auth.js builds with fromNodeHeaders() and answers the same
// { session, user } shape auth.api.getSession() does.
const baSessions = new Map(); // session token -> { id, email, role }

const cookieOf = (headers) => (typeof headers?.get === 'function' ? headers.get('cookie') : headers?.cookie) || '';
const baSessionToken = (headers) => (/(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/.exec(cookieOf(headers)) || [])[1] ?? null;
const readBaSession = async ({ headers } = {}) => {
  const token = baSessionToken(headers);
  const user = token ? baSessions.get(token) : null;
  return user ? { session: { token }, user } : null;
};

export const baAuth = { api: { getSession: vi.fn(readBaSession) } };

// resolveRole() in auth.js runs one union query and reads rows[0]; the mocked
// pool routes that query here (see helpers/db.js builtin rule).
export const resolveRoleResult = (id) => profiles.get(id) ?? null;

// A provisioned, authenticated account of `role`; returns its bearer token.
export function loginAs({ id, role, status = 'active', email }) {
  const token = `tok-${id}`;
  tokens.set(token, { id, email: email || `${id}@test.local`, app_metadata: { role } });
  profiles.set(id, { role, profile: { id, status } });
  return token;
}

// A provisioned BA account: registers the session cookie AND the same profiles
// entry loginAs() writes, so auth.js resolves both sides of the dual window
// through the same mocked pool. Returns the Cookie header value.
export function loginAsBA({ id, role, status = 'active', email }) {
  const token = `ba-${id}`;
  baSessions.set(token, { id, email: email || `${id}@test.local`, role });
  profiles.set(id, { role, profile: { id, status } });
  return `better-auth.session_token=${token}`;
}

// A valid token with NO provisioned row (fresh session — me 404 / provision creates).
export function tokenOnly({ id, email }) {
  const token = `tok-${id}`;
  tokens.set(token, { id, email: email || `${id}@test.local`, app_metadata: {} });
  return token;
}

export function resetAuth() {
  tokens.clear();
  profiles.clear();
  baSessions.clear();
  // The mocked registry is the truth again, so the memoized principals the
  // previous test cached in auth.js must not leak into the next one.
  clearTokenCache();
  supabaseAuth.getUser.mockClear();
  // Restore readBaSession too: a test may have swapped in mockRejectedValue.
  baAuth.api.getSession.mockReset().mockImplementation(readBaSession);
}
