import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole } from '../auth.js';
import { ah, err, audit, notifyUser } from '../util.js';
import { notifyMatchingSeekers } from './jobs.js';

const router = Router();
const admin = [auth, requireRole('super-admin')];
const SEEKER_COLS = 'id, full_name, email, phone, barangay_district, skills, employment_status, preferred_position, preferred_location';

router.get('/admin/stats', ...admin, ah(async (req, res) => {
  const q = (sql, p = []) => pool.query(sql, p).then((r) => Number(r.rows[0].c));
  const [seekers, employers, jobs, applications, pendingAccreditations, unreadNotifications,
    pendingJobs, approvedJobs, closedJobs, expiredJobs,
    shortlistedApplicants, acceptedApplicants, placedApplicants, accreditedEmployers] = await Promise.all([
    q('select count(*) c from job_seekers'),
    q('select count(*) c from employers'),
    q('select count(*) c from job_vacancies'),
    q('select count(*) c from job_applications'),
    q(`select count(*) c from employer_accreditations where status = 'pending'`),
    q('select count(*) c from notifications where is_read = false'),
    q(`select count(*) c from job_vacancies where status = 'pending'`),
    q(`select count(*) c from job_vacancies where status = 'approved'`),
    q(`select count(*) c from job_vacancies where status = 'closed'`),
    q(`select count(*) c from job_vacancies where deadline < current_date and status not in ('closed','archived')`),
    q(`select count(*) c from job_applications where status = 'Shortlisted'`),
    q(`select count(*) c from job_applications where status = 'Accepted'`),
    q(`select count(*) c from job_applications where status = 'Placed'`),
    q(`select count(*) c from employers where accreditation_status = 'approved'`),
  ]);
  res.json({ seekers, employers, companies: employers, jobs, applications, pendingAccreditations, unreadNotifications,
    pendingJobs, approvedJobs, closedJobs, expiredJobs,
    shortlistedApplicants, acceptedApplicants, placedApplicants, accreditedEmployers });
}));

const USER_TABLES = { 'job-seeker': 'job_seekers', employer: 'employers', 'super-admin': 'super_admins' };

router.get('/admin/users', ...admin, ah(async (req, res) => {
  const { role = null, search = '', status = null } = req.query;
  const tables = role ? [USER_TABLES[role] || null] : Object.values(USER_TABLES);
  if (role && !tables[0]) return err(res, 400, 'BAD_REQUEST', 'Invalid role filter');
  const out = [];
  for (const table of tables) {
    const vals = [];
    const conds = [];
    if (status) { vals.push(status); conds.push(`status = $${vals.length}`); }
    if (search) { vals.push(`%${search}%`, `%${search}%`); conds.push(`(full_name ilike $${vals.length - 1} or email ilike $${vals.length})`); }
    const userRole = Object.keys(USER_TABLES).find((k) => USER_TABLES[k] === table);
    const { rows } = await pool.query(
      `select *, '${userRole}' as role from ${table}${conds.length ? ` where ${conds.join(' and ')}` : ''} order by created_at desc`, vals);
    out.push(...rows);
  }
  out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(out);
}));

async function findUserTable(id) {
  for (const [role, table] of Object.entries(USER_TABLES)) {
    const { rows } = await pool.query(`select *, '${role}' as role from ${table} where id = $1`, [id]);
    if (rows[0]) return { table, profile: rows[0] };
  }
  return {};
}

router.patch('/admin/users/:id', ...admin, ah(async (req, res) => {
  const { table, profile } = await findUserTable(req.params.id);
  if (!profile) return err(res, 404, 'NOT_FOUND', 'User account not found');
  const patch = { ...(req.body || {}) };
  delete patch.id;
  if (patch.role && patch.role !== profile.role) {
    return err(res, 400, 'BAD_REQUEST', 'Role changes are disabled because each role has its own account table.');
  }
  delete patch.role;
  delete patch.created_at;
  const keys = Object.keys(patch);
  if (!keys.length) return err(res, 400, 'BAD_REQUEST', 'Nothing to update');
  const { rows } = await pool.query(
    `update ${table} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1 returning *`,
    [req.params.id, ...keys.map((k) => patch[k])]);
  void audit(req.user.id, 'user.update', table, req.params.id, { fields: keys });
  res.json(rows[0]);
}));

router.get('/admin/companies', ...admin, ah(async (req, res) => {
  const vals = [];
  const cond = req.query.status ? (vals.push(req.query.status), `where status = $1`) : '';
  const { rows } = await pool.query(`select * from employers ${cond} order by created_at desc`, vals);
  res.json(rows);
}));

router.get('/admin/jobs', ...admin, ah(async (req, res) => {
  const vals = [];
  const cond = req.query.status ? (vals.push(req.query.status), `where j.status = $1`) : '';
  const { rows } = await pool.query(
    `select j.*, json_build_object('id', e.id, 'company_name', e.company_name) as employers
     from job_vacancies j left join employers e on e.id = j.company_id ${cond} order by j.created_at desc`, vals);
  res.json(rows);
}));

router.get('/admin/applications', ...admin, ah(async (req, res) => {
  const { status = null, search = '' } = req.query;
  const vals = [];
  const conds = [];
  if (status) { vals.push(status); conds.push(`a.status = $${vals.length}`); }
  if (search) { vals.push(`%${search}%`); conds.push(`s.full_name ilike $${vals.length}`); }
  const { rows } = await pool.query(
    `select a.*, json_build_object('id', j.id, 'title', j.title, 'location', j.location,
       'employers', json_build_object('company_name', e.company_name)) as job,
     json_build_object(${SEEKER_COLS.split(', ').map((c) => `'${c.trim()}', s.${c.trim()}`).join(', ')}) as seeker
     from job_applications a join job_vacancies j on j.id = a.job_id
     join employers e on e.id = j.company_id join job_seekers s on s.id = a.seeker_id
     ${conds.length ? `where ${conds.join(' and ')}` : ''} order by a.applied_at desc`, vals);
  res.json(rows);
}));

router.get('/admin/employees', ...admin, ah(async (req, res) => {
  const { rows } = await pool.query(
    `select a.*, json_build_object('id', j.id, 'title', j.title, 'company_id', j.company_id,
       'employers', json_build_object('id', e.id, 'company_name', e.company_name)) as job,
     json_build_object(${SEEKER_COLS.split(', ').map((c) => `'${c.trim()}', s.${c.trim()}`).join(', ')}) as seeker
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
  const { rows } = await pool.query(
    `select a.*, e as employers, json_build_object('full_name', s.full_name) as decided_by
     from employer_accreditations a left join employers e on e.id = a.company_id
     left join super_admins s on s.id = a.decided_by order by a.submitted_at desc`);
  res.json(rows);
}));

// Same keep-Accepted/Placed rule as the client purge.
router.post('/admin/purge', ...admin, ah(async (req, res) => {
  const monthsOld = Number(req.body?.monthsOld ?? 12) || 12;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsOld);
  const { rowCount } = await pool.query(
    `delete from job_applications where applied_at < $1 and status not in ('Accepted', 'Placed')`, [cutoff.toISOString()]);
  void audit(req.user.id, 'data.purge', 'job_applications', null, { monthsOld, deleted: rowCount });
  res.json({ deleted: rowCount });
}));

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
  if (action) { vals.push(`%${action}%`); conds.push(`l.action ilike $${vals.length}`); }
  // ponytail: naive-local comparison against timestamptz relies on the Postgres session TZ; fixed UTC+8 (PH, no DST) deployment matches today's behavior — make boundaries TZ-explicit if deploying elsewhere
  if (from) { vals.push(`${from}T00:00:00`); conds.push(`l.created_at >= $${vals.length}`); }
  // ponytail: naive-local comparison against timestamptz relies on the Postgres session TZ; fixed UTC+8 (PH, no DST) deployment matches today's behavior — make boundaries TZ-explicit if deploying elsewhere
  if (to) { vals.push(`${to}T23:59:59.999`); conds.push(`l.created_at <= $${vals.length}`); }
  const parsedLimit = parseInt(limit);
  vals.push(Math.min(2000, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 500)));
  const { rows } = await pool.query(
    `select l.*, coalesce(js.full_name, e.full_name, s.full_name) as actor_name, coalesce(js.email, e.email, s.email) as actor_email from audit_logs l left join job_seekers js on js.id = l.user_id left join employers e on e.id = l.user_id left join super_admins s on s.id = l.user_id${conds.length ? ` where ${conds.join(' and ')}` : ''} order by l.created_at desc limit $${vals.length}`, vals);
  res.json(rows);
}));

router.get('/admin/reference/:category', ...admin, ah(async (req, res) => {
  const { rows } = await pool.query(
    'select * from reference_data where category = $1 order by sort_order', [req.params.category]);
  res.json(rows);
}));

router.post('/admin/reference/:category', ...admin, ah(async (req, res) => {
  const { value, sort_order = 0 } = req.body || {};
  if (!value) return err(res, 400, 'BAD_REQUEST', 'value is required');
  try {
    const { rows } = await pool.query(
      'insert into reference_data (category, value, sort_order) values ($1,$2,$3) returning *',
      [req.params.category, value, sort_order]);
    void audit(req.user.id, 'settings.reference.add', 'reference_data', null, { category: req.params.category, value });
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return err(res, 409, 'CONFLICT', 'Reference value already exists');
    throw e;
  }
}));

router.delete('/admin/reference/:id', ...admin, ah(async (req, res) => {
  const { rowCount } = await pool.query('delete from reference_data where id = $1', [req.params.id]);
  if (!rowCount) return err(res, 404, 'NOT_FOUND', 'Reference not found');
  void audit(req.user.id, 'settings.reference.remove', 'reference_data', req.params.id);
  res.json({ deleted: true });
}));

// Addendum A: admin reads of seeker profile children.
router.get('/admin/seekers/:id/education', ...admin, ah(async (req, res) => {
  const { rows } = await pool.query('select * from education where seeker_id = $1 order by id desc', [req.params.id]);
  res.json(rows);
}));

router.get('/admin/seekers/:id/experience', ...admin, ah(async (req, res) => {
  const { rows } = await pool.query('select * from work_experience where seeker_id = $1 order by id desc', [req.params.id]);
  res.json(rows);
}));

router.get('/admin/seekers/:id/employment', ...admin, ah(async (req, res) => {
  const { rows } = await pool.query('select * from employment_history where seeker_id = $1 order by created_at desc', [req.params.id]);
  res.json(rows);
}));

// user_id always comes from the token, never params.
router.get('/notifications/mine', auth, ah(async (req, res) => {
  const vals = [req.user.id];
  const unread = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1'
    ? (vals.push(false), `and is_read = $2`) : '';
  const { rows } = await pool.query(
    `select * from notifications where user_id = $1 ${unread} order by created_at desc limit 50`, vals);
  res.json(rows);
}));

router.post('/notifications/:id/read', auth, ah(async (req, res) => {
  await pool.query('update notifications set is_read = true where id = $1 and user_id = $2', [req.params.id, req.user.id]);
  res.json({ read: true });
}));

router.post('/notifications/read-all', auth, ah(async (req, res) => {
  await pool.query('update notifications set is_read = true where user_id = $1 and is_read = false', [req.user.id]);
  res.json({ read: true });
}));

// Same JOB_COLS allowlist as employer PATCH /jobs/:id in jobs.js
// (replicated so all edits stay in this file); status goes through the same
// single-transaction job + history write as jobs.js writeStatus.
const ADMIN_JOB_COLS = ['title', 'office', 'location', 'employment_type', 'salary_min', 'salary_max',
  'description', 'requirements', 'benefits', 'vacancies', 'deadline', 'instructions', 'tags', 'status', 'remarks'];
const ADMIN_JOB_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'published', 'closed', 'archived'];

async function adminWriteStatus(client, jobId, status, remarks, changedBy) {
  const stamps = { published: 'published_at', closed: 'closed_at', archived: 'archived_at' };
  await client.query(
    `update job_vacancies set status = $2, remarks = $3, updated_at = now()${stamps[status] ? `, ${stamps[status]} = now()` : ''} where id = $1`,
    [jobId, status, remarks]);
  await client.query(
    'insert into job_status_history (job_id, status, remarks, changed_by) values ($1,$2,$3,$4)',
    [jobId, status, remarks, changedBy]);
}

router.patch('/admin/jobs/:id', ...admin, ah(async (req, res) => {
  const { rows: jrows } = await pool.query('select * from job_vacancies where id = $1', [req.params.id]);
  if (!jrows[0]) return err(res, 404, 'NOT_FOUND', 'Job not found');
  const job = jrows[0];
  const patch = {};
  for (const c of ADMIN_JOB_COLS) if (req.body?.[c] !== undefined) patch[c] = req.body[c] === '' && c !== 'title' ? null : req.body[c];
  if (!Object.keys(patch).length) return err(res, 400, 'BAD_REQUEST', 'Nothing to update');
  if (patch.status !== undefined && !ADMIN_JOB_STATUSES.includes(patch.status)) {
    return err(res, 400, 'BAD_REQUEST', `status must be one of ${ADMIN_JOB_STATUSES.join(', ')}`);
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (patch.status !== undefined) {
      const { status, ...rest } = patch;
      const restKeys = Object.keys(rest).filter((k) => k !== 'remarks');
      if (restKeys.length) {
        await client.query(
          `update job_vacancies set ${restKeys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`,
          [job.id, ...restKeys.map((k) => rest[k])]);
      }
      await adminWriteStatus(client, job.id, status, patch.remarks !== undefined ? patch.remarks : job.remarks, req.user.id);
    } else {
      const keys = Object.keys(patch);
      await client.query(
        `update job_vacancies set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1`,
        [job.id, ...keys.map((k) => patch[k])]);
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  void audit(req.user.id, 'job.update', 'job_vacancies', job.id);
  const { rows } = await pool.query('select * from job_vacancies where id = $1', [job.id]);
  // Review-approve (admin PATCH) → same seeker fan-out as the publish endpoint.
  if (patch.status === 'approved' || patch.status === 'published') void notifyMatchingSeekers(rows[0]);
  res.json(rows[0]);
}));

// Thin adminWriteStatus wrappers: publish → published (+published_at),
// unpublish → draft, each with history row + company notify.
const adminJobPublish = (status, title) => ah(async (req, res) => {
  const { rows: jrows } = await pool.query('select * from job_vacancies where id = $1', [req.params.id]);
  if (!jrows[0]) return err(res, 404, 'NOT_FOUND', 'Job not found');
  const job = jrows[0];
  const client = await pool.connect();
  try {
    await client.query('begin');
    await adminWriteStatus(client, job.id, status, job.remarks, req.user.id);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  void audit(req.user.id, `job.${status === 'published' ? 'publish' : 'unpublish'}`, 'job_vacancies', job.id);
  void notifyUser(job.company_id, { type: 'job', title, message: `"${job.title}" ${status === 'published' ? 'is now live on the job board.' : 'was unpublished by PESO.'}`, link: '/employer/jobs' });
  const { rows } = await pool.query('select * from job_vacancies where id = $1', [job.id]);
  if (status === 'published') void notifyMatchingSeekers(rows[0]);
  res.json(rows[0]);
});
router.post('/admin/jobs/:id/publish', ...admin, adminJobPublish('published', 'Job published'));
router.post('/admin/jobs/:id/unpublish', ...admin, adminJobPublish('draft', 'Job unpublished'));

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

// Cross-table role move: deactivate old row, insert minimal new row with the
// same id/email/full_name. 403 on self-move (lockout footgun).
router.post('/admin/users/:id/role', ...admin, ah(async (req, res) => {
  if (req.params.id === req.user.id) return err(res, 403, 'FORBIDDEN', 'You cannot change your own role');
  const { role } = req.body || {};
  if (!USER_TABLES[role]) return err(res, 400, 'BAD_REQUEST', 'Invalid role');
  const { table, profile } = await findUserTable(req.params.id);
  if (!profile) return err(res, 404, 'NOT_FOUND', 'User account not found');
  if (profile.role === role) return res.json({ id: req.params.id, role });
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`update ${table} set status = 'inactive', updated_at = now() where id = $1`, [req.params.id]);
    await client.query(
      `insert into ${USER_TABLES[role]} (id, email, full_name, status) values ($1,$2,$3,'active')`,
      [req.params.id, profile.email, profile.full_name]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
  void audit(req.user.id, 'user.role.change', USER_TABLES[role], req.params.id, { from: profile.role, to: role });
  res.json({ id: req.params.id, role });
}));

export default router;
