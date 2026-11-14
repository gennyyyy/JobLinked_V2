import { Router } from 'express';
import { pool } from '../db.js';
import { tokenAuth, resolveRole } from '../auth.js';
import { ah, err, audit } from '../util.js';
import logger from '../logger.js';

const ROLE_TABLE = { 'super-admin': 'super_admins', employer: 'employers', 'job-seeker': 'job_seekers' };

const router = Router();

router.get('/account/preferences', tokenAuth, ah(async (req, res) => {
  const { rows } = await pool.query(
    'select application_updates, community_announcements from user_preferences where user_id = $1',
    [req.user.id]);
  const row = rows[0];
  res.json({
    application_updates: row ? row.application_updates : true,
    community_announcements: row ? row.community_announcements : true,
  });
}));

router.patch('/account/preferences', tokenAuth, ah(async (req, res) => {
  const body = req.body || {};
  const hasApp = Object.prototype.hasOwnProperty.call(body, 'application_updates');
  const hasComm = Object.prototype.hasOwnProperty.call(body, 'community_announcements');
  if (!hasApp && !hasComm) return err(res, 400, 'INVALID_PREFERENCES', 'At least one preference key is required');
  if (hasApp && typeof body.application_updates !== 'boolean') return err(res, 400, 'INVALID_PREFERENCES', 'application_updates must be a boolean');
  if (hasComm && typeof body.community_announcements !== 'boolean') return err(res, 400, 'INVALID_PREFERENCES', 'community_announcements must be a boolean');

  const changed = {};
  if (hasApp) changed.application_updates = body.application_updates;
  if (hasComm) changed.community_announcements = body.community_announcements;

  const { rows } = await pool.query(
    `insert into user_preferences (user_id, application_updates, community_announcements)
     values ($1, coalesce($2::boolean, true), coalesce($3::boolean, true))
     on conflict (user_id) do update set
       application_updates = coalesce($2::boolean, user_preferences.application_updates),
       community_announcements = coalesce($3::boolean, user_preferences.community_announcements),
       updated_at = now()
     returning application_updates, community_announcements`,
    [req.user.id, hasApp ? body.application_updates : null, hasComm ? body.community_announcements : null]);
  const row = rows[0];
  void audit(req.user.id, 'account.preferences.update', 'user_preferences', req.user.id, changed);
  res.json({ application_updates: row.application_updates, community_announcements: row.community_announcements });
}));

router.post('/account/sessions/revoke-all', tokenAuth, ah(async (req, res) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return err(res, 503, 'SERVICE_UNAVAILABLE', 'Session revocation is not configured. Please try again later.');
  const url = `${String(process.env.SUPABASE_URL || '').replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(req.user.id)}/logout`;
  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    logger.error('revoke_all_sessions_failed', { reason: e?.name === 'TimeoutError' ? 'timeout' : 'network' });
    return err(res, 502, 'UPSTREAM_ERROR', 'The sessions could not be revoked. Please try again later.');
  }
  if (!upstream.ok) {
    try { await upstream.body?.cancel?.(); } catch { /* already gone */ }
    logger.error('revoke_all_sessions_failed', { status: upstream.status });
    return err(res, 502, 'UPSTREAM_ERROR', 'The sessions could not be revoked. Please try again later.');
  }
  void audit(req.user.id, 'account.sessions.revoke', 'user_preferences', req.user.id);
  res.json({ revoked: true });
}));

router.post('/account/deactivate', tokenAuth, ah(async (req, res) => {
  if ((req.body || {}).confirm !== 'DEACTIVATE') {
    return err(res, 400, 'CONFIRM_REQUIRED', 'Confirmation required');
  }
  const found = await resolveRole(req.user.id);
  if (!found) return err(res, 404, 'NOT_FOUND', 'Account not found');
  const role = found.role;
  const table = ROLE_TABLE[role];
  if (!table) return err(res, 404, 'NOT_FOUND', 'Account not found');

  if (role === 'super-admin') {
    const { rows } = await pool.query(
      `select count(*)::int c from super_admins where status = 'active' and custom_role_id is null and id <> $1`,
      [req.user.id]);
    if ((rows[0]?.c ?? 0) === 0) {
      return err(res, 409, 'LAST_ADMIN', 'Cannot deactivate the last full admin');
    }
  }

  await pool.query(`update ${table} set status = 'inactive' where id = $1`, [req.user.id]);
  void audit(req.user.id, 'account.deactivate', table, req.user.id);

  // Best-effort: revoke sessions via GoTrue admin logout, swallowing errors.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = `${String(process.env.SUPABASE_URL || '').replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(req.user.id)}/logout`;
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (upstream && !upstream.ok) {
      try { await upstream.body?.cancel?.(); } catch { /* already gone */ }
    }
  } catch { /* best-effort */ }

  res.json({ deactivated: true });
}));

export default router;
