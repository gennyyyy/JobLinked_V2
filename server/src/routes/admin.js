import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole } from '../auth.js';
import { ah, err, audit, isUuid, pageParams } from '../util.js';
import { ACCOUNT_STATUSES, likeFilter } from './admin-shared.js';
import logger from '../logger.js';

const router = Router();
const admin = [auth, requireRole('super-admin')];
const SEEKER_COLS = 'id, full_name, email, phone, barangay_district, skills, employment_status, preferred_position, preferred_location';
// B6: enum-valued filters are validated before they reach Postgres — an
// unknown value raises 22P02 (500) instead of the 400 the contract wants.
const APPLICATION_STATUSES = ['Applied', 'Under Review', 'Interview', 'Accepted', 'Rejected', 'Placed', 'Terminated'];

router.get('/admin/stats', ...admin, ah(async (req, res) => {
  // One aggregate pass per table (FILTER) instead of 13 separate count(*)
  // queries — job_vacancies 5→1, job_applications 3→1, employers 2→1. Each
  // response key still counts exactly what its old standalone query counted
  // (FILTER conditions copied verbatim); ::int keeps the JSON values numbers
  // like the old Number(bigint) conversion. Queries stay parallel.
  const [s, p, u, e, j, a] = await Promise.all([
    pool.query('select count(*)::int c from job_seekers'),
    pool.query(`select count(*)::int c from employer_accreditations where status = 'pending'`),
    pool.query('select count(*)::int c from notifications where is_read = false and user_id = $1', [req.user.id]),
    pool.query(`select count(*)::int employers, count(*) filter (where accreditation_status = 'approved')::int accredited from employers`),
    pool.query(`select count(*)::int jobs,
        count(*) filter (where status = 'pending')::int pending,
        count(*) filter (where status = 'approved')::int approved,
        count(*) filter (where status = 'closed')::int closed,
        count(*) filter (where deadline < current_date and status not in ('closed','archived'))::int expired
      from job_vacancies`),
    pool.query(`select count(*)::int applications,
        count(*) filter (where status = 'Accepted')::int accepted,
        count(*) filter (where status = 'Placed')::int placed
      from job_applications`),
  ]);
  const seekers = s.rows[0].c;
  const pendingAccreditations = p.rows[0].c;
  const unreadNotifications = u.rows[0].c;
  const { employers, accredited: accreditedEmployers } = e.rows[0];
  const { jobs, pending: pendingJobs, approved: approvedJobs, closed: closedJobs, expired: expiredJobs } = j.rows[0];
  const { applications, accepted: acceptedApplicants, placed: placedApplicants } = a.rows[0];
  res.json({ seekers, employers, companies: employers, jobs, applications, pendingAccreditations, unreadNotifications,
    pendingJobs, approvedJobs, closedJobs, expiredJobs,
    acceptedApplicants, placedApplicants, accreditedEmployers });
}));

router.get('/admin/companies', ...admin, ah(async (req, res) => {
  const pg = pageParams(res, req.query, 25, 500);
  if (!pg) return;
  const vals = [];
  if (req.query.status && !ACCOUNT_STATUSES.includes(req.query.status)) {
    return err(res, 400, 'BAD_REQUEST', `status must be one of ${ACCOUNT_STATUSES.join(', ')}`);
  }
  const cond = req.query.status ? (vals.push(req.query.status), `where status = $1`) : '';
  const total = (await pool.query(`select count(*)::int c from employers ${cond}`, vals)).rows[0].c;
  const { rows } = await pool.query(
    `select * from employers ${cond} order by created_at desc limit $${vals.length + 1} offset $${vals.length + 2}`,
    [...vals, pg.pageSize, (pg.page - 1) * pg.pageSize]);
  res.json({ data: rows, total, page: pg.page, pageSize: pg.pageSize });
}));

router.get('/admin/applications', ...admin, ah(async (req, res) => {
  const { status = null, search = '' } = req.query;
  const pg = pageParams(res, req.query, 25, 500);
  if (!pg) return;
  const vals = [];
  const conds = [];
  if (status) {
    if (!APPLICATION_STATUSES.includes(status)) {
      return err(res, 400, 'BAD_REQUEST', `status must be one of ${APPLICATION_STATUSES.join(', ')}`);
    }
    vals.push(status); conds.push(`a.status = $${vals.length}`);
  }
  if (search) { vals.push(likeFilter(search)); conds.push(`s.full_name ilike $${vals.length}`); }
  const where = conds.length ? `where ${conds.join(' and ')}` : '';
  const base = `from job_applications a join job_vacancies j on j.id = a.job_id
      join employers e on e.id = j.company_id join job_seekers s on s.id = a.seeker_id ${where}`;
  const total = (await pool.query(`select count(*)::int c ${base}`, vals)).rows[0].c;
  const { rows } = await pool.query(
    `select a.*, json_build_object('id', j.id, 'title', j.title, 'location', j.location,
       'employers', json_build_object('company_name', e.company_name)) as job,
     json_build_object(${SEEKER_COLS.split(', ').map((c) => `'${c.trim()}', s.${c.trim()}`).join(', ')}) as seeker ${base}
     order by a.applied_at desc limit $${vals.length + 1} offset $${vals.length + 2}`,
    [...vals, pg.pageSize, (pg.page - 1) * pg.pageSize]);
  res.json({ data: rows, total, page: pg.page, pageSize: pg.pageSize });
}));

router.get('/admin/employees', ...admin, ah(async (req, res) => {
  const { rows } = await pool.query(
    `select a.*, json_build_object('id', j.id, 'title', j.title, 'company_id', j.company_id,
       'employment_type', j.employment_type, 'location', j.location, 'office', j.office,
       'employers', json_build_object('id', e.id, 'company_name', e.company_name)) as job,
     json_build_object(${SEEKER_COLS.split(', ').map((c) => `'${c.trim()}', s.${c.trim()}`).join(', ')}) as seeker,
     (select json_build_object('start_date', h.start_date, 'end_date', h.end_date, 'is_current', h.is_current, 'created_at', h.created_at)
      from employment_history h where h.application_id = a.id limit 1) as employment
     from job_applications a join job_vacancies j on j.id = a.job_id
     join employers e on e.id = j.company_id join job_seekers s on s.id = a.seeker_id
     where a.status in ('Accepted', 'Terminated') order by a.updated_at desc`);
  res.json(rows);
}));

router.get('/admin/referrals', ...admin, ah(async (req, res) => {
  const { rows } = await pool.query(
    `select a.*, json_build_object('id', j.id, 'title', j.title,
       'employers', json_build_object('company_name', e.company_name)) as job,
     json_build_object(${SEEKER_COLS.split(', ').map((c) => `'${c.trim()}', s.${c.trim()}`).join(', ')}) as seeker
     from job_applications a join job_vacancies j on j.id = a.job_id
     join employers e on e.id = j.company_id join job_seekers s on s.id = a.seeker_id
     where a.referred_by is not null order by a.applied_at desc`);
  res.json(rows);
}));

router.get('/admin/accreditations', ...admin, ah(async (req, res) => {
  const pg = pageParams(res, req.query, 25, 500);
  if (!pg) return;
  const base = `from employer_accreditations a left join employers e on e.id = a.company_id
      left join super_admins s on s.id = a.decided_by`;
  const total = (await pool.query(`select count(*)::int c ${base}`)).rows[0].c;
  const { rows } = await pool.query(
    `select a.*, e as employers, json_build_object('full_name', s.full_name) as decided_by ${base}
     order by a.submitted_at desc limit $1 offset $2`, [pg.pageSize, (pg.page - 1) * pg.pageSize]);
  res.json({ data: rows, total, page: pg.page, pageSize: pg.pageSize });
}));

// Automated retention job implementing Terms §4 (Protection and Retention —
// read-only): runs on a fixed server-side schedule, no manual trigger and no
// request input. Deletes stale non-employment applications only (12+ months
// old). Accepted / Placed / Terminated are lawfully retained as employment
// records (closing an account does not erase records that must be retained)
// and feed municipal reports (§2); deleting them would cascade-wipe linked
// employment_history rows. Runs as user_id NULL (system) in the audit log.
const RETENTION_MONTHS = 12;
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETAINED_STATUSES = ['Accepted', 'Placed', 'Terminated'];

export async function runRetentionPurge() {
  // B10: the cutoff is computed by Postgres (`now() - make_interval`), never by
  // JS setMonth — that overflows short months (Jan 31 - 12mo lands in early
  // March) and purged rows inside the Terms §4 window on those dates.
  const { rowCount } = await pool.query(
    `delete from job_applications where applied_at < now() - make_interval(months => $1) and status not in ('Accepted', 'Placed', 'Terminated')`, [RETENTION_MONTHS]);
  void audit(null, 'data.purge', 'job_applications', null, { automated: true, monthsOld: RETENTION_MONTHS, retainedStatuses: RETAINED_STATUSES, deleted: rowCount });
  return rowCount;
}

if (process.env.RETENTION_DISABLE !== '1') {
  setInterval(() => {
    runRetentionPurge().catch((e) => logger.error('retention purge failed', { message: e?.message }));
  }, RETENTION_INTERVAL_MS).unref?.();
}

router.get('/admin/audit-logs', ...admin, ah(async (req, res) => {
  const { limit = 500, userId = '', action = '', from = '', to = '' } = req.query;
  const vals = [];
  const conds = [];
  if (userId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return err(res, 400, 'BAD_REQUEST', 'Invalid userId');
    }
    vals.push(userId); conds.push(`l.user_id = $${vals.length}`);
  }
  if (action) { vals.push(likeFilter(action)); conds.push(`l.action ilike $${vals.length}`); }
  // ponytail: naive-local comparison against timestamptz relies on the Postgres session TZ; fixed UTC+8 (PH, no DST) deployment matches today's behavior — make boundaries TZ-explicit if deploying elsewhere
  if (from) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return err(res, 400, 'BAD_REQUEST', 'from must be a YYYY-MM-DD date');
    vals.push(`${from}T00:00:00`); conds.push(`l.created_at >= $${vals.length}`);
  }
  // ponytail: naive-local comparison against timestamptz relies on the Postgres session TZ; fixed UTC+8 (PH, no DST) deployment matches today's behavior — make boundaries TZ-explicit if deploying elsewhere
  if (to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return err(res, 400, 'BAD_REQUEST', 'to must be a YYYY-MM-DD date');
    vals.push(`${to}T23:59:59.999`); conds.push(`l.created_at <= $${vals.length}`);
  }
  const parsedLimit = parseInt(limit);
  vals.push(Math.min(2000, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 500)));
  const { rows } = await pool.query(
    `select l.*, coalesce(js.full_name, e.full_name, s.full_name) as actor_name, coalesce(js.email, e.email, s.email) as actor_email from audit_logs l left join job_seekers js on js.id = l.user_id left join employers e on e.id = l.user_id left join super_admins s on s.id = l.user_id${conds.length ? ` where ${conds.join(' and ')}` : ''} order by l.created_at desc limit $${vals.length}`, vals);
  res.json(rows);
}));

// Addendum A: admin reads of seeker profile children.
const seekerChildRead = (sql, order) => ah(async (req, res) => {
  if (!isUuid(req.params.id)) return err(res, 404, 'NOT_FOUND', 'Seeker not found');
  const { rows } = await pool.query(`select * from ${sql} where seeker_id = $1 order by ${order}`, [req.params.id]);
  res.json(rows);
});
router.get('/admin/seekers/:id/education', ...admin, seekerChildRead('education', 'id desc'));
router.get('/admin/seekers/:id/experience', ...admin, seekerChildRead('work_experience', 'id desc'));
router.get('/admin/seekers/:id/employment', ...admin, seekerChildRead('employment_history', 'created_at desc'));

// System broadcast: one 'system' row per ACTIVE user (fan-out, never a NULL
// user_id — the column is NOT NULL). expires_at lives only in the audit
// details jsonb (notifications has no details column — adding one is DDL,
// needs arch approval).
// ponytail: single multi-row INSERT; per-user queue table if user count explodes
router.post('/admin/system-notifications', ...admin, ah(async (req, res) => {
  const { title, message, link = null, expires_at = null } = req.body || {};
  if (!title || !message) return err(res, 400, 'BAD_REQUEST', 'title and message are required');
  const { rowCount } = await pool.query(
    `insert into notifications (user_id, type, title, message, link)
     select id, 'system', $1, $2, $3 from (
       select id from job_seekers where status = 'active'
       union all select id from employers where status = 'active'
       union all select id from super_admins where status = 'active') u`,
    [title, message, link]);
  void audit(req.user.id, 'notification.broadcast', null, null, { title, expires_at, sent: rowCount });
  res.json({ sent: rowCount });
}));

export default router;
