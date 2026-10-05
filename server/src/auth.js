import { createClient } from '@supabase/supabase-js';
import { pool } from './db.js';
import { err } from './util.js';

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ROLE_TABLES = [
  ['super_admins', 'super-admin'],
  ['employers', 'employer'],
  ['job_seekers', 'job-seeker'],
];

export async function resolveRole(id) {
  for (const [table, role] of ROLE_TABLES) {
    const { rows } = await pool.query(`select * from ${table} where id = $1`, [id]);
    if (rows[0]) return { role, profile: rows[0] };
  }
  return null;
}

// Required auth: validates the Supabase JWT, attaches { id, email, role }.
export async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^bearer\s+/i, '');
  if (!token) return err(res, 401, 'UNAUTHORIZED', 'Missing access token');
  let user;
  try {
    const { data, error } = await supa.auth.getUser(token);
    if (error || !data?.user) return err(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
    user = data.user;
  } catch {
    return err(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  let found;
  try {
    found = await resolveRole(user.id);
  } catch {
    return err(res, 500, 'INTERNAL', 'Role lookup failed');
  }
  if (!found) return err(res, 403, 'FORBIDDEN', 'Account not provisioned');
  if (found.profile.status === 'suspended') return err(res, 403, 'FORBIDDEN', 'This account has been suspended. Contact PESO.');
  req.user = { id: user.id, email: user.email, role: found.role };
  next();
}

// Optional auth for public reads: attaches req.user when a valid token is present.
export async function optionalAuth(req, _res, next) {
  const token = (req.headers.authorization || '').replace(/^bearer\s+/i, '');
  if (!token) return next();
  try {
    const { data } = await supa.auth.getUser(token);
    if (data?.user) {
      const found = await resolveRole(data.user.id);
      if (found && found.profile.status !== 'suspended') {
        req.user = { id: data.user.id, email: data.user.email, role: found.role };
      }
    }
  } catch { /* anonymous */ }
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : err(res, 403, 'FORBIDDEN', 'Insufficient role');

// Token-only auth (Addendum B): validates the Supabase JWT but SKIPS the
// provisioned-row check — a fresh session has no row by definition.
export async function tokenAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^bearer\s+/i, '');
  if (!token) return err(res, 401, 'UNAUTHORIZED', 'Missing access token');
  try {
    const { data, error } = await supa.auth.getUser(token);
    if (error || !data?.user) return err(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
    req.user = { id: data.user.id, email: data.user.email };
  } catch {
    return err(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  next();
}
