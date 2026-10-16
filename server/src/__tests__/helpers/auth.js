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

// A valid token with NO provisioned row (fresh session — me 404 / provision creates).
export function tokenOnly({ id, email }) {
  const token = `tok-${id}`;
  tokens.set(token, { id, email: email || `${id}@test.local`, app_metadata: {} });
  return token;
}

export function resetAuth() {
  tokens.clear();
  profiles.clear();
  // The mocked registry is the truth again, so the memoized principals the
  // previous test cached in auth.js must not leak into the next one.
  clearTokenCache();
  supabaseAuth.getUser.mockClear();
}
