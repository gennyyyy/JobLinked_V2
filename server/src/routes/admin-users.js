import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole, supa } from '../auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { ah, err, audit, buildFullName, isUuid, pageParams, withTransaction } from '../util.js';
import { USER_TABLES, ACCOUNT_STATUSES, likeFilter } from './admin-shared.js';
import logger from '../logger.js';

const router = Router();
const admin = [auth, requireRole('super-admin'), requirePermission('users.manage')];

// Derived so the role↔table mapping can never drift from USER_TABLES.
const ROLE_BY_TABLE = Object.fromEntries(Object.entries(USER_TABLES).map(([role, table]) => [table, role]));
// Table precedence, shared with resolveRole (auth.js): super-admin → employer
// → job-seeker. Applied AFTER the active-row term there; same shape in the
// /admin/users union below.
const TABLE_ORD = { super_admins: 1, employers: 2, job_seekers: 3 };

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
    order by id, (profile->>'status' <> 'inactive') desc, (profile->>'status' = 'active') desc, ord) t${where}`;
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
     ) t order by (profile->>'status' <> 'inactive') desc, (profile->>'status' = 'active') desc, ord limit 1`, [id]);
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
  // 'inactive' is the role-move STALE marker, not an admin-selectable state
  // (the UI offers Active/Suspended only). Accepting it here would make the
  // user's current row indistinguishable from the stale row a role move
  // leaves behind, and the next reactivation could target the wrong table.
  if (body.status === 'inactive') {
    return err(res, 400, 'BAD_REQUEST', "status must be 'active' or 'suspended'");
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
  // Explicit editable-field allowlist (Task 58): never trust information_schema,
  // so accreditation_status/status/custom_role_id are validated, not mass-assigned.
  const EDITABLE = new Set(['first_name','middle_name','last_name','suffix','full_name','phone',
    'status','custom_role_id','accreditation_status','accreditation_remarks']);
  const patch = {};
  for (const k of Object.keys(body)) if (EDITABLE.has(k)) patch[k] = body[k];
  if (patch.status !== undefined && !ACCOUNT_STATUSES.includes(patch.status)) {
    return err(res, 400, 'BAD_REQUEST', `status must be one of ${ACCOUNT_STATUSES.join(', ')}`);
  }
  if (patch.accreditation_status !== undefined) {
    const ACC = ['none','pending','approved','rejected','resubmission','revoked'];
    if (!ACC.includes(patch.accreditation_status)) return err(res, 400, 'BAD_REQUEST', `accreditation_status must be one of ${ACC.join(', ')}`);
  }
  if (patch.custom_role_id !== undefined && patch.custom_role_id !== null) {
    const { rows } = await pool.query(`select 1 from reference_data where id = $1 and category = 'custom_role'`, [patch.custom_role_id]);
    if (!rows[0]) return err(res, 400, 'BAD_REQUEST', 'Custom role not found');
  }
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
  if (error) {
    // Never collapse every upstream failure into "already registered": an SMTP
    // or Supabase rate limit told the admin the address existed when it did
    // not, and a retryable outage looked like a permanent conflict.
    const message = String(error.message || '');
    if (error.status === 429 || /rate limit/i.test(message)) {
      return err(res, 429, 'RATE_LIMITED', 'Invite email rate limit reached. Please try again later.');
    }
    if (/invalid format|validate email/i.test(message)) {
      return err(res, 400, 'BAD_REQUEST', 'Enter a valid email address');
    }
    if (/already|registered|exists/i.test(message)) {
      return err(res, 409, 'CONFLICT', 'Email is already registered');
    }
    logger.error('invite_failed', { status: error.status });
    return err(res, 502, 'UPSTREAM_ERROR', 'The invite email could not be sent. Please try again later.');
  }

  // app_metadata is service-role-only, so it is the role signal a client cannot
  // forge: POST /auth/provision honours a 'super-admin' body role only when it
  // matches. The custom-role tag rides in the same write (G-01): provision
  // resolves the tag from here only, so the invitee can never choose its own
  // bundle. Explicit null is the inviter's full-admin grant; the key is always
  // written so provision can tell "no tag" from "pre-fix invite". Set it before
  // the invite is delivered (Task 60) so a failure here does not leave an
  // invitee with role in user_metadata but no app_metadata.
  const { error: metaErr } = await supa().auth.admin.updateUserById(
    data.user.id, { app_metadata: { role, custom_role_id: customRoleId } });
  if (metaErr) return err(res, 500, 'INTERNAL', 'Invite sent, but the account role could not be secured. Please retry the invite.');

  void audit(req.user.id, 'user.invite', null, null, { email, role, custom_role_id: customRoleId });
  res.status(201).json({ invited: true, email, role });
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
        `insert into ${USER_TABLES[role]} (id, email, full_name, status, custom_role_id) values ($1,$2,$3,'active',$4)
         on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, status = 'active', custom_role_id = excluded.custom_role_id, updated_at = now()`,
        [req.params.id, profile.email, profile.full_name, profile.custom_role_id ?? null]);
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
