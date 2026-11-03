import { pool } from './db.js';

// Wrap async route handlers so rejections reach the error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Exact contract error shape: { error: { code, message } }
export const err = (res, status, code, message) => res.status(status).json({ error: { code, message } });

// S1: every id column is uuid — a non-uuid :id makes Postgres raise 22P02,
// which the handlers never catch, so it 500s instead of answering 400/404.
// One regex in the load helpers (return null) or at the param (err 400)
// closes every caller at once. No dependency: this is the pattern already
// hand-written at admin.js:262 (uuid) and admin.js:463 (bigint).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => UUID_RE.test(v);
export const isNumericId = (v) => /^\d+$/.test(v);

// B15: LIKE metacharacters in user input must match literally (a search of
// `%%` must not match everything). Same escape the skills filter already used.
export const likeEscape = (s) => String(s).replace(/[\\%_]/g, '\\$&');

// S6: the shared transaction wrapper — a failing rollback must never mask
// the original error, and the client is always released.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    try { await client.query('rollback'); } catch { /* original error wins */ }
    throw e;
  } finally {
    client.release();
  }
}

// One definition of the full-name rule, shared by provision and user-invite.
export function buildFullName(first, middle, last, suffix) {
  return [first, middle, last, suffix]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(' ');
}

// B7 pagination guard, shared (was inline in GET /jobs): Number() (not
// parseInt — '1e21' must not silently parse), a present-but-junk value is a
// client error, then clamped so an absurd page cannot overflow the SQL OFFSET.
// Sends the 400 itself and returns null so handlers stay one line.
export function pageParams(res, q, defaultSize = 25, maxSize = 100) {
  const page = Number(q.page || 1);
  const pageSize = Number(q.pageSize || defaultSize);
  if (!Number.isInteger(page) || page < 1) { err(res, 400, 'BAD_REQUEST', 'page must be a positive integer'); return null; }
  if (!Number.isInteger(pageSize) || pageSize < 1) { err(res, 400, 'BAD_REQUEST', 'pageSize must be a positive integer'); return null; }
  return { page: Math.min(1_000_000, page), pageSize: Math.min(maxSize, pageSize) };
}

// Best-effort: audit/notification writes never fail the user's action.
export async function audit(userId, action, entity = null, entityId = null, details = null) {
  try {
    await pool.query(
      'insert into audit_logs (user_id, action, entity, entity_id, details) values ($1,$2,$3,$4,$5)',
      [userId || null, action, entity, entityId ? String(entityId) : null, details ? JSON.stringify(details) : null]
    );
  } catch { /* ponytail: best-effort by contract */ }
}

export async function notifyUser(userId, { type, title, message, link = null }) {
  try {
    await pool.query(
      'insert into notifications (user_id, type, title, message, link) values ($1,$2,$3,$4,$5)',
      [userId, type, title, message, link]
    );
  } catch { /* ponytail: best-effort by contract */ }
}

export async function notifyAdmins({ type, title, message, link = null }) {
  try {
    const { rows } = await pool.query('select id from super_admins');
    if (!rows.length) return;
    // One multi-row insert (same insert…select…union all fan-out as admin.js
    // system-broadcast) instead of a per-admin INSERT loop. ::uuid because the
    // parameterised selects are untyped text by default; the column is uuid.
    const ids = rows.map((r) => r.id);
    const n = ids.length;
    const branches = ids.map((_, i) => `select $${i + 1}::uuid`).join(' union all ');
    await pool.query(
      `insert into notifications (user_id, type, title, message, link)
       select id, $${n + 1}, $${n + 2}, $${n + 3}, $${n + 4} from (${branches}) a(id)`,
      [...ids, type, title, message, link]);
  } catch { /* ponytail: best-effort by contract */ }
}
