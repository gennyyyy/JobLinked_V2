import { pool } from './db.js';

// Wrap async route handlers so rejections reach the error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Exact contract error shape: { error: { code, message } }
export const err = (res, status, code, message) => res.status(status).json({ error: { code, message } });

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
    for (const r of rows) await notifyUser(r.id, { type, title, message, link });
  } catch { /* ponytail: best-effort by contract */ }
}
