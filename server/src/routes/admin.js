import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole, supa } from '../auth.js';
import { ah, err, audit, notifyUser, buildFullName, isUuid, isNumericId, likeEscape, pageParams, withTransaction } from '../util.js';
import { notifyMatchingSeekers } from './jobs.js';
import logger from '../logger.js';

const router = Router();
const admin = [auth, requireRole('super-admin')];
const SEEKER_COLS = 'id, full_name, email, phone, barangay_district, skills, employment_status, preferred_position, preferred_location';

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

const USER_TABLES = { 'job-seeker': 'job_seekers', employer: 'employers', 'super-admin': 'super_admins' };
// Derived so the role↔table mapping can never drift from USER_TABLES.
const ROLE_BY_TABLE = Object.fromEntries(Object.entries(USER_TABLES).map(([role, table]) => [table, role]));
// Table precedence, shared with resolveRole (auth.js): super-admin → employer
// → job-seeker. Applied AFTER the active-row term there; same shape in the
// /admin/users union below.
const TABLE_ORD = { super_admins: 1, employers: 2, job_seekers: 3 };
// B6: enum-valued filters are validated before they reach Postgres — an
// unknown value raises 22P02 (500) instead of the 400 the contract wants.
const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'];
const APPLICATION_STATUSES = ['Applied', 'Under Review', 'Interview', 'Accepted', 'Rejected', 'Placed', 'Terminated'];

// B15: LIKE metacharacters in a search must match literally.
const likeFilter = (value) => `%${likeEscape(value)}%`;

router.get('/admin/users', ...admin, ah(async (req, res) => {
  const { role = null, search = '', status = null } = req.query;
  const tables = role ? [USER_TABLES[role] || null] : Object.values(USER_TABLES);
  if (role && !tables[0]) return err(res, 400, 'BAD_REQUEST', 'Invalid role filter');
  const pg = pageParams(res, req.query, 25, 500);
  if (!pg) return;
  const vals = [];
  const conds = [];
  if (status) {
    if (!ACCOUNT_STATUSES.includes(status)) return err(res, 400, 'BAD_REQUEST', `status must be one of ${ACCOUNT_STATUSES.join(', ')}`);
    vals.push(status); conds.push(`t.profile->>'status' = $${vals.length}`);
  }
  if (search) {
    vals.push(likeFilter(search), likeFilter(search));
    conds.push(`(t.profile->>'full_name' ilike $${vals.length - 1} or t.profile->>'email' ilike $${vals.length})`);
  }
  const where = conds.length ? ` where ${conds.join(' and ')}` : '';
  // M2: one UNION ALL with ORDER BY/LIMIT/OFFSET in SQL — the old code looped
  // the three tables and sorted every row in JS before slicing. to_jsonb keeps
  // the per-table columns; `role` is re-attached from the branch literal (the
  // same mapping resolveRole uses). x.id breaks created_at ties so page N and
  // page N+1 can never skip or repeat a row.
  const union = tables
    .map((t) => `select '${ROLE_BY_TABLE[t]}' as role, to_jsonb(x) as profile, x.created_at, x.id, ${TABLE_ORD[t]} as ord from ${t} x`)
    .join(' union all ');
  // One row per id, chosen exactly like resolveRole: an active row wins, then
  // table precedence. A role move deactivates the old row instead of deleting
  // it (the FK cascade would destroy the user's jobs and applications), so one
  // id can sit in two tables — DISTINCT ON keeps the stale row out of the list.
  // The status/search filters run on the deduped row (the user's current
  // account), so a stale row can never leak through a filter either.
  // ponytail: a ?role= filter naming the OLD table still shows the stale row
  // (the union spans that one table). Scan all three tables under a role
  // filter if that view ever matters — it costs the single-table contract.
  const base = `from (select distinct on (id) role, profile, created_at, id from (${union}) t
    order by id, (profile->>'status' = 'active') desc, ord) t${where}`;
  const total = (await pool.query(`select count(*)::int c ${base}`, vals)).rows[0].c;
  const { rows } = await pool.query(
    `select t.role, t.profile ${base} order by t.created_at desc, t.id desc limit $${vals.length + 1} offset $${vals.length + 2}`,
    [...vals, pg.pageSize, (pg.page - 1) * pg.pageSize]);
  res.json({ data: rows.map((r) => ({ ...r.profile, role: r.role })), total, page: pg.page, pageSize: pg.pageSize });
}));

// One round-trip instead of a per-table scan. Same super-admin → employer →
// job-seeker precedence as resolveRole (and the same status-aware term: a
// role move leaves the old table's row deactivated, and it must never shadow
// the user's current row); the table name comes back from the
// query so callers can use it in `update ${table} …`, and profile keeps the
// `role` key the old `'${role}' as role` projection added.
export async function findUserTable(id) {
  if (!isUuid(id)) return {}; // S1: answer 404 instead of letting Postgres raise 22P02
  const { rows } = await pool.query(
    `select tbl, profile from (
       select 'super_admins' as tbl, to_jsonb(s) as profile, 1 as ord from super_admins s where id = $1
       union all
       select 'employers' as tbl, to_jsonb(e) as profile, 2 as ord from employers e where id = $1
       union all
       select 'job_seekers' as tbl, to_jsonb(j) as profile, 3 as ord from job_seekers j where id = $1
     ) t order by (profile->>'status' = 'active') desc, ord limit 1`, [id]);
  const row = rows[0];
  return row ? { table: row.tbl, profile: { ...row.profile, role: ROLE_BY_TABLE[row.tbl] } } : {};
}

router.patch('/admin/users/:id', ...admin, ah(async (req, res) => {
  const body = { ...(req.body || {}) };
  // Lone super-admin footgun: suspending or re-tagging yourself here (unlike
  // the dedicated /role and /custom-role endpoints) has no second admin to
  // undo it — refuse self-edits that could lock the account out.
  if (req.params.id === req.user.id && (body.status !== undefined || body.custom_role_id !== undefined)) {
    return err(res, 403, 'FORBIDDEN', 'You cannot change your own status or custom role');
  }
  const { table, profile } = await findUserTable(req.params.id);
  if (!profile) return err(res, 404, 'NOT_FOUND', 'User account not found');
  delete body.id;
  // Email lives in the role table AND in Supabase auth (the login identity).
  // No admin flow rewrites it — every caller PATCHes { status } only — and a
  // local-only change desyncs login/display, so strip it like id/role.
  delete body.email;
  if (body.role && body.role !== profile.role) {
    return err(res, 400, 'BAD_REQUEST', 'Role changes are disabled because each role has its own account table.');
  }
  delete body.role;
  delete body.created_at;
  delete body.updated_at; // the route owns updated_at = now() — a body value lands in the same SET list (PG 42701)
  // Allowlist from the live table: always in sync with db/schema.sql, and no
  // client-supplied key can ever reach SQL as a column identifier.
  const { rows: cols } = await pool.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`, [table]);
  const valid = new Set(cols.map((c) => c.column_name));
  const patch = {};
  for (const k of Object.keys(body)) if (valid.has(k)) patch[k] = body[k];
  const keys = Object.keys(patch);
  if (!keys.length) return err(res, 400, 'BAD_REQUEST', 'Nothing to update');
  try {
    const { rows } = await pool.query(
      `update ${table} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1 returning *`,
      [req.params.id, ...keys.map((k) => patch[k])]);
    void audit(req.user.id, 'user.update', table, req.params.id, { fields: keys });
    res.json(rows[0]);
  } catch (e) {
    // The per-table email unique index: editing a user onto an email that
    // already exists is a conflict, not a server error.
    if (e.code === '23505') return err(res, 409, 'CONFLICT', 'Another account already uses this email');
    throw e;
  }
}));

// Admin-initiated invite (ADR-024). No DB row here — the invitee's role row is
// created lazily by POST /auth/provision when they accept (see AcceptInvite.jsx).
router.post('/admin/users/invite', ...admin, ah(async (req, res) => {
  const INVITE_BASE_ROLES = ['job-seeker', 'employer', 'super-admin'];
  const b = req.body || {};
  const email = String(b.email || '').trim();
  if (!email || !b.first_name?.trim?.() || !b.last_name?.trim?.()) {
    return err(res, 400, 'BAD_REQUEST', 'email, first_name, and last_name are required');
  }

  // Resolve the effective base role: a custom role overrides `role` with its base_role.
  let role = b.role;
  let customRoleId = null;
  if (b.custom_role_id != null) {
    const { rows } = await pool.query(
      `select id, details->>'base_role' as base_role from reference_data
        where id = $1 and category = 'custom_role'`, [b.custom_role_id]);
    if (!rows[0]) return err(res, 400, 'BAD_REQUEST', 'Custom role not found');
    role = rows[0].base_role;
    customRoleId = rows[0].id;
    if (b.role && b.role !== role) {
      return err(res, 400, 'BAD_REQUEST', 'role must match the custom role base role');
    }
  }
  if (!INVITE_BASE_ROLES.includes(role)) {
    return err(res, 400, 'BAD_REQUEST', 'role must be job-seeker, employer, or super-admin');
  }
  if (role === 'employer' && !String(b.company_name || '').trim()) {
    return err(res, 400, 'BAD_REQUEST', 'company_name is required for employer accounts');
  }

  const { rows: dupe } = await pool.query(
    `select 1 from job_seekers where lower(email) = lower($1)
     union all select 1 from employers where lower(email) = lower($1)
     union all select 1 from super_admins where lower(email) = lower($1) limit 1`, [email]);
  if (dupe[0]) return err(res, 409, 'CONFLICT', 'Email is already registered');

  const appOrigin = String(process.env.CORS_ORIGIN || '').split(',')[0].trim();
  const metadata = {
    role, custom_role_id: customRoleId,
    first_name: b.first_name, middle_name: b.middle_name || '', last_name: b.last_name,
    suffix: b.suffix || '', phone: b.phone || null,
    full_name: buildFullName(b.first_name, b.middle_name, b.last_name, b.suffix),
    company_name: b.company_name || null,
  };
  const { data, error } = await supa().auth.admin.inviteUserByEmail(email, {
    data: metadata, redirectTo: `${appOrigin}/accept-invite`,
  });
  if (error) return err(res, 409, 'CONFLICT', 'Could not send the invite — the email may already be registered');

  // app_metadata is service-role-only, so it is the role signal a client cannot
  // forge: POST /auth/provision honours a 'super-admin' body role only when it
  // matches. The `?.` tolerates clients without the admin surface — provision
  // then fails closed (a body role alone can never create a super_admins row).
  const meta = await supa().auth.admin.updateUserById?.(data.user.id, { app_metadata: { role } });
  if (meta?.error) return err(res, 500, 'INTERNAL', 'Invite sent, but the account role could not be secured. Please retry the invite.');

  void audit(req.user.id, 'user.invite', null, null, { email, role, custom_role_id: customRoleId });
  res.status(201).json({ invited: true, email, role });
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

router.get('/admin/jobs', ...admin, ah(async (req, res) => {
  const pg = pageParams(res, req.query, 25, 500);
  if (!pg) return;
  const vals = [];
  if (req.query.status && !ADMIN_JOB_STATUSES.includes(req.query.status)) {
    return err(res, 400, 'BAD_REQUEST', `status must be one of ${ADMIN_JOB_STATUSES.join(', ')}`);
  }
  const cond = req.query.status ? (vals.push(req.query.status), `where j.status = $1`) : '';
  const base = `from job_vacancies j left join employers e on e.id = j.company_id ${cond}`;
  const total = (await pool.query(`select count(*)::int c ${base}`, vals)).rows[0].c;
  const { rows } = await pool.query(
    `select j.*, json_build_object('id', e.id, 'company_name', e.company_name) as employers ${base}
     order by j.created_at desc limit $${vals.length + 1} offset $${vals.length + 2}`,
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

// ─── Custom roles (super-admin defined, tag-only) ──────────────────────────
// Permission bundles stored as reference_data rows (category = 'custom_role').
// The 3 system roles stay fixed in the user_role enum + role tables; a custom
// role never creates a login identity. Assignment is a tag on the user's row
// (custom_role_id) — editable only from the Users page.
// Canonical permission catalog — labels included so the UI never needs a copy.
// validateRolePayload validates against ROLE_PERMISSION_KEYS (derived from the
// same list), so the two can never drift.
const ROLE_PERMISSIONS = [
  { key: "dashboard.view", label: "View Dashboard" },
  { key: "accreditation.manage", label: "Manage Accreditations" },
  { key: "jobs.manage", label: "Manage Job Posts" },
  { key: "users.manage", label: "Manage Users" },
  { key: "roles.manage", label: "Manage Roles" },
  { key: "reports.view", label: "View Reports" },
  { key: "logs.view", label: "View Audit Logs" },
  { key: "notifications.send", label: "Send System Notifications" },
  { key: "settings.manage", label: "Manage Settings" },
];
const ROLE_PERMISSION_KEYS = new Set(ROLE_PERMISSIONS.map((p) => p.key));
const ROLE_BASE_ROLES = ["super-admin", "employer", "job-seeker"];

function parseCustomRole(row) {
  const details = row.details || {};
  return {
    id: row.id,
    name: row.value,
    description: details.description || "",
    permissions: Array.isArray(details.permissions) ? details.permissions : [],
    base_role: ROLE_BASE_ROLES.includes(details.base_role) ? details.base_role : "super-admin",
    sort_order: row.sort_order ?? 0,
  };
}

function validateRolePayload(body) {
  const { name, description = "", permissions = [], base_role = "super-admin" } = body || {};
  if (!name || !String(name).trim()) return { error: "Role name is required" };
  if (!ROLE_BASE_ROLES.includes(base_role)) return { error: "base_role must be super-admin, employer, or job-seeker" };
  const clean = [...new Set((Array.isArray(permissions) ? permissions : []).filter((p) => ROLE_PERMISSION_KEYS.has(p)))];
  return { value: { name: String(name).trim(), description: String(description || "").trim(), permissions: clean, base_role } };
}

async function roleNameTaken(name, excludeId = null) {
  const { rows } = await pool.query(
    `select id from reference_data
      where category = 'custom_role' and lower(value) = lower($1)${excludeId ? ' and id <> $2' : ''}
      limit 1`,
    excludeId ? [name, excludeId] : [name]);
  return rows.length > 0;
}

router.get('/admin/permissions', ...admin, ah(async (_req, res) => {
  res.json(ROLE_PERMISSIONS);
}));

router.get('/admin/roles', ...admin, ah(async (req, res) => {
  const { rows } = await pool.query(
    `select * from reference_data where category = 'custom_role' order by sort_order, value`);
  res.json(rows.map(parseCustomRole));
}));

router.post('/admin/roles', ...admin, ah(async (req, res) => {
  const checked = validateRolePayload(req.body);
  if (checked.error) return err(res, 400, 'BAD_REQUEST', checked.error);
  if (await roleNameTaken(checked.value.name)) return err(res, 409, 'CONFLICT', 'A role with this name already exists');
  const { rows } = await pool.query(
    `insert into reference_data (category, value, sort_order, details)
     values ('custom_role', $1, coalesce((select max(sort_order) + 1 from reference_data where category = 'custom_role'), 0), $2)
     returning *`,
    [checked.value.name, JSON.stringify({ description: checked.value.description, permissions: checked.value.permissions, base_role: checked.value.base_role })]);
  void audit(req.user.id, 'role.create', 'reference_data', rows[0].id, { name: checked.value.name });
  res.status(201).json(parseCustomRole(rows[0]));
}));

router.patch('/admin/roles/:id', ...admin, ah(async (req, res) => {
  if (!isNumericId(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
  const { rows: existing } = await pool.query(
    `select * from reference_data where id = $1 and category = 'custom_role'`, [req.params.id]);
  if (!existing[0]) return err(res, 404, 'NOT_FOUND', 'Custom role not found');
  const checked = validateRolePayload({ ...parseCustomRole(existing[0]), ...(req.body || {}) });
  if (checked.error) return err(res, 400, 'BAD_REQUEST', checked.error);
  if (await roleNameTaken(checked.value.name, req.params.id)) return err(res, 409, 'CONFLICT', 'A role with this name already exists');
  const { rows } = await pool.query(
    `update reference_data set value = $2, details = $3 where id = $1 and category = 'custom_role' returning *`,
    [req.params.id, checked.value.name,
      JSON.stringify({ description: checked.value.description, permissions: checked.value.permissions, base_role: checked.value.base_role })]);
  void audit(req.user.id, 'role.update', 'reference_data', req.params.id, { name: checked.value.name });
  res.json(parseCustomRole(rows[0]));
}));

router.delete('/admin/roles/:id', ...admin, ah(async (req, res) => {
  if (!isNumericId(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
  const { rows: existing } = await pool.query(
    `select * from reference_data where id = $1 and category = 'custom_role'`, [req.params.id]);
  if (!existing[0]) return err(res, 404, 'NOT_FOUND', 'Custom role not found');
  for (const table of Object.values(USER_TABLES)) {
    await pool.query(`update ${table} set custom_role_id = null, updated_at = now() where custom_role_id = $1`, [req.params.id]);
  }
  await pool.query(`delete from reference_data where id = $1 and category = 'custom_role'`, [req.params.id]);
  void audit(req.user.id, 'role.delete', 'reference_data', req.params.id, { name: existing[0].value });
  res.json({ deleted: true });
}));

// Tag a user with a custom role (assignment lives on the Users page only).
router.post('/admin/users/:id/custom-role', ...admin, ah(async (req, res) => {
  if (req.params.id === req.user.id) return err(res, 403, 'FORBIDDEN', 'You cannot change your own role');
  const { table, profile } = await findUserTable(req.params.id);
  if (!profile) return err(res, 404, 'NOT_FOUND', 'User account not found');
  const { custom_role_id = null } = req.body || {};
  if (custom_role_id !== null) {
    const { rows } = await pool.query(
      `select id from reference_data where id = $1 and category = 'custom_role'`, [custom_role_id]);
    if (!rows[0]) return err(res, 400, 'BAD_REQUEST', 'Custom role not found');
  }
  const { rows } = await pool.query(
    `update ${table} set custom_role_id = $2, updated_at = now() where id = $1 returning *`,
    [req.params.id, custom_role_id]);
  void audit(req.user.id, 'user.custom-role.assign', table, req.params.id, { custom_role_id });
  res.json({ ...rows[0], role: profile.role });
}));

router.delete('/admin/reference/:id', ...admin, ah(async (req, res) => {
  if (!isNumericId(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
  const { rowCount } = await pool.query('delete from reference_data where id = $1', [req.params.id]);
  if (!rowCount) return err(res, 404, 'NOT_FOUND', 'Reference not found');
  void audit(req.user.id, 'settings.reference.remove', 'reference_data', req.params.id);
  res.json({ deleted: true });
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
  if (!isNumericId(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid notification id');
  // Addendum C: match DELETE — another user's id answers 404, not a
  // non-informative 200 (the update is scoped, but the response must not
  // imply the caller's row was touched).
  const { rows } = await pool.query(
    'update notifications set is_read = true where id = $1 and user_id = $2 returning id',
    [req.params.id, req.user.id]);
  if (!rows[0]) return err(res, 404, 'NOT_FOUND', 'Notification not found');
  res.json({ read: true });
}));

router.post('/notifications/read-all', auth, ah(async (req, res) => {
  await pool.query('update notifications set is_read = true where user_id = $1 and is_read = false', [req.user.id]);
  res.json({ read: true });
}));

router.delete('/notifications/:id', auth, ah(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid notification id');
  const { rowCount } = await pool.query('delete from notifications where id = $1 and user_id = $2', [req.params.id, req.user.id]);
  if (!rowCount) return err(res, 404, 'NOT_FOUND', 'Notification not found');
  res.json({ deleted: true });
}));

// Same JOB_COLS allowlist as employer PATCH /jobs/:id in jobs.js
// (replicated so all edits stay in this file); status goes through the same
// single-transaction job + history write as jobs.js writeStatus.
const ADMIN_JOB_COLS = ['title', 'office', 'location', 'employment_type', 'work_arrangement', 'salary_min', 'salary_max',
  'description', 'requirements', 'benefits', 'vacancies', 'deadline', 'instructions', 'tags', 'status', 'remarks'];
const ADMIN_JOB_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'published', 'closed', 'archived'];
const ADMIN_JOB_ARRANGEMENTS = ['On-site', 'Remote / Work from home', 'Hybrid'];

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
  if (!isUuid(req.params.id)) return err(res, 404, 'NOT_FOUND', 'Job not found');
  const { rows: jrows } = await pool.query('select * from job_vacancies where id = $1', [req.params.id]);
  if (!jrows[0]) return err(res, 404, 'NOT_FOUND', 'Job not found');
  const job = jrows[0];
  const patch = {};
  for (const c of ADMIN_JOB_COLS) if (req.body?.[c] !== undefined) patch[c] = req.body[c] === '' && c !== 'title' ? null : req.body[c];
  if (!Object.keys(patch).length) return err(res, 400, 'BAD_REQUEST', 'Nothing to update');
  if (patch.status !== undefined && !ADMIN_JOB_STATUSES.includes(patch.status)) {
    return err(res, 400, 'BAD_REQUEST', `status must be one of ${ADMIN_JOB_STATUSES.join(', ')}`);
  }
  if (patch.work_arrangement !== undefined && !ADMIN_JOB_ARRANGEMENTS.includes(patch.work_arrangement)) {
    return err(res, 400, 'BAD_REQUEST', `work_arrangement must be one of ${ADMIN_JOB_ARRANGEMENTS.join(', ')}`);
  }
  // '' is coerced to null above, and `vacancies int not null` (schema.sql:190)
  // cannot store null — an emptied or non-integer value must answer 400 here
  // instead of raising 23502 on the UPDATE.
  if (patch.vacancies !== undefined && (patch.vacancies === null || !Number.isInteger(Number(patch.vacancies)))) {
    return err(res, 400, 'BAD_REQUEST', 'vacancies must be a whole number');
  }
  await withTransaction(async (client) => {
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
  });
  void audit(req.user.id, 'job.update', 'job_vacancies', job.id);
  const { rows } = await pool.query('select * from job_vacancies where id = $1', [job.id]);
  // Review-approve (admin PATCH) → same seeker fan-out as the publish endpoint.
  if (patch.status === 'approved' || patch.status === 'published') void notifyMatchingSeekers(rows[0]);
  res.json(rows[0]);
}));

// Thin adminWriteStatus wrappers: publish → published (+published_at),
// unpublish → draft, each with history row + company notify.
const adminJobPublish = (status, title) => ah(async (req, res) => {
  if (!isUuid(req.params.id)) return err(res, 404, 'NOT_FOUND', 'Job not found');
  const { rows: jrows } = await pool.query('select * from job_vacancies where id = $1', [req.params.id]);
  if (!jrows[0]) return err(res, 404, 'NOT_FOUND', 'Job not found');
  const job = jrows[0];
  await withTransaction(async (client) => {
    await adminWriteStatus(client, job.id, status, job.remarks, req.user.id);
  });
  void audit(req.user.id, `job.${status === 'published' ? 'publish' : 'unpublish'}`, 'job_vacancies', job.id);
  void notifyUser(job.company_id, { type: 'job', title, message: `"${job.title}" ${status === 'published' ? 'is now live on the job board.' : 'was unpublished by PESO.'}`, link: '/employer/job-posts' });
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

// Cross-table role move: the old-table row is DEACTIVATED, never deleted.
// Deleting it cascades (job_vacancies.company_id → employers ON DELETE
// CASCADE, then job_applications, resumes, education, history rows) and would
// destroy the user's job postings, every application with its applicant PII,
// and all status history — one request, no confirmation. The target row is
// upserted, so a move BACK onto a table that still holds the old deactivated
// row reactivates it instead of hitting the PK (the original B2 500).
// Deactivate and upsert share one transaction; a same-email row already in
// the target table is a 409. 403 on self-move (lockout footgun).
router.post('/admin/users/:id/role', ...admin, ah(async (req, res) => {
  if (req.params.id === req.user.id) return err(res, 403, 'FORBIDDEN', 'You cannot change your own role');
  const { role } = req.body || {};
  if (!USER_TABLES[role]) return err(res, 400, 'BAD_REQUEST', 'Invalid role');
  const { table, profile } = await findUserTable(req.params.id);
  if (!profile) return err(res, 404, 'NOT_FOUND', 'User account not found');
  if (profile.role === role) return res.json({ id: req.params.id, role });
  try {
    await withTransaction(async (client) => {
      await client.query(`update ${table} set status = 'inactive', updated_at = now() where id = $1`, [req.params.id]);
      await client.query(
        `insert into ${USER_TABLES[role]} (id, email, full_name, status) values ($1,$2,$3,'active')
         on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, status = 'active', updated_at = now()`,
        [req.params.id, profile.email, profile.full_name]);
    });
  } catch (e) {
    // The target table's per-email unique index: moving onto an email that
    // already lives there is a conflict, not a server error.
    if (e.code === '23505') return err(res, 409, 'CONFLICT', 'Another account already uses this email');
    throw e;
  }
  void audit(req.user.id, 'user.role.change', USER_TABLES[role], req.params.id, { from: profile.role, to: role });
  res.json({ id: req.params.id, role });
}));

export default router;
