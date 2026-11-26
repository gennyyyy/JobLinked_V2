import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole } from '../auth.js';
// Aliased: `auth` is the middleware from ../auth.js.
import { auth as baAuth } from '../ba.js';
import { requirePermission, unheldKey } from '../middleware/permissions.js';
import { ah, err, audit, buildFullName, isUuid, pageParams, withTransaction } from '../util.js';
import { USER_TABLES, ACCOUNT_STATUSES, likeFilter } from './admin-shared.js';
import { appOrigin } from '../appOrigin.js';
import { NAME_FIELDS, NAME_STAMP_SQL, NAME_GUARD_SQL, isNameChange, nameLimitMessage } from '../nameChange.js';
import logger from '../logger.js';

const router = Router();
const admin = [auth, requireRole('super-admin'), requirePermission('users.manage')];

// Derived so the role↔table mapping can never drift from USER_TABLES.
const ROLE_BY_TABLE = Object.fromEntries(Object.entries(USER_TABLES).map(([role, table]) => [table, role]));
// Table precedence, shared with resolveRole (auth.js): super-admin → employer
// → job-seeker. Applied AFTER the active-row term there; same shape in the
// /admin/users union below.
const TABLE_ORD = { super_admins: 1, employers: 2, job_seekers: 3 };

// Seeker profile filters (Task 2). Only job_seekers owns these columns, so the
// terms are ignored unless the role filter has narrowed the scan to that table.
const SEEKER_TERM_MAX = 80;
const SEEKER_FILTERS = [
  ['skills', "array_to_string(x.skills, ' ')"],
  ['education', 'x.education_summary'],
  ['experience', 'x.experience_summary'],
];

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
  // Task 2: skills/education/experience narrow the job_seekers branch only.
  // They are read AFTER status/search so the existing params keep their order,
  // and are ignored (not rejected) on any other role range — those tables have
  // no such columns, and the UI only shows the inputs for job-seeker.
  const seekerConds = [];
  if (role === 'job-seeker') {
    for (const [key, column] of SEEKER_FILTERS) {
      const term = String(req.query[key] ?? '').trim();
      if (term.length > SEEKER_TERM_MAX) {
        return err(res, 400, 'BAD_REQUEST', `${key} must be ${SEEKER_TERM_MAX} characters or fewer`);
      }
      if (!term) continue;
      vals.push(likeFilter(term));
      seekerConds.push(`${column} ilike $${vals.length}`);
    }
  }
  const where = conds.length ? ` where ${conds.join(' and ')}` : '';
  // M2: one UNION ALL with ORDER BY/LIMIT/OFFSET in SQL — the old code looped
  // the three tables and sorted every row in JS before slicing. to_jsonb keeps
  // the per-table columns; `role` is re-attached from the branch literal (the
  // same mapping resolveRole uses). x.id breaks created_at ties so page N and
  // page N+1 can never skip or repeat a row.
  const union = tables
    .map((t) => `select '${ROLE_BY_TABLE[t]}' as role, to_jsonb(x) as profile, x.created_at, x.id, ${TABLE_ORD[t]} as ord from ${t} x${
      t === 'job_seekers' && seekerConds.length ? ` where ${seekerConds.join(' and ')}` : ''}`)
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

// G-07: the break-glass recovery path (ADR-042) is an active super-admin with
// no custom role. Every write that removes the target from that set — suspend,
// demote, tag — must leave at least one behind, or no account can recover the
// admin surface.
const LAST_ADMIN_MSG = 'This would remove the last full admin. Assign another full admin first.';
// Both access-change endpoints require it on a REAL change; their same-value
// no-op runs first, so it needs none.
const REASON_INVALID = 'reason must be 10-500 characters';
// The column is an integer and a client may send "14": compare, store, and
// audit the normalized number so a string/number pair is a no-op instead of a
// phantom change. undefined marks a value that is not an integer.
function normalizeCustomRoleId(value) {
  if (value == null) return null;
  const id = Number(value);
  return Number.isInteger(id) ? id : undefined;
}
async function removesLastBreakGlass(table, profile, id) {
  if (table !== 'super_admins' || profile.status !== 'active' || profile.custom_role_id != null) return false;
  const { rows } = await pool.query(
    `select count(*)::int c from super_admins where status = 'active' and custom_role_id is null and id <> $1`, [id]);
  return !(rows[0]?.c > 0); // fail closed: an unreadable count must not remove the last recovery path
}

// G-02: a custom-role tag is a grant, so it obeys the same ceiling as an invite
// or a role write. null/undefined clears the tag — for a super-admin that is
// the full-admin break-glass grant, which only a full admin may hand out.
// Returns the HTTP error to send, or null when the grant is within the ceiling.
async function grantError(req, customRoleId, targetRole) {
  if (customRoleId == null) {
    return targetRole === 'super-admin' && req.user?.customRoleId
      ? { status: 403, code: 'FORBIDDEN', message: 'Only a full admin can grant full admin access' }
      : null;
  }
  const { rows } = await pool.query(
    `select coalesce(details->'permissions', '[]'::jsonb) as permissions
       from reference_data where id = $1 and category = 'custom_role'`, [customRoleId]);
  if (!rows[0]) return { status: 400, code: 'BAD_REQUEST', message: 'Custom role not found' };
  const missing = unheldKey(req, rows[0].permissions);
  return missing
    ? { status: 403, code: 'FORBIDDEN', message: `Your assigned role does not include "${missing}"` }
    : null;
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
  if (patch.custom_role_id !== undefined) {
    const denied = await grantError(req, patch.custom_role_id, profile.role);
    if (denied) return err(res, denied.status, denied.code, denied.message);
  }
  // G-07: suspension and tagging are both ways out of the break-glass set.
  if ((patch.status === 'suspended' || patch.custom_role_id != null) &&
      await removesLastBreakGlass(table, profile, req.params.id)) {
    return err(res, 409, 'CONFLICT', LAST_ADMIN_MSG);
  }
  // ADR-058: derive full_name the same way the self-service route does, then
  // decide whether this write changes the displayed name. Admin edits are not
  // exempt from the target's window.
  if (NAME_FIELDS.some((c) => patch[c] !== undefined)) {
    patch.full_name = buildFullName(
      ...NAME_FIELDS.map((c) => (patch[c] !== undefined ? patch[c] : profile[c])),
    );
  }
  const nameChanging = isNameChange(patch, profile);
  const keys = Object.keys(patch);
  if (!keys.length) return err(res, 400, 'BAD_REQUEST', 'Nothing to update');
  try {
    const { rows } = await pool.query(
      `update ${table} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}${nameChanging ? NAME_STAMP_SQL : ''}, updated_at = now()
        where id = $1${nameChanging ? NAME_GUARD_SQL : ''} returning *`,
      [req.params.id, ...keys.map((k) => patch[k])]);
    if (!rows[0] && nameChanging) {
      const { rows: probe } = await pool.query(`select name_changed_at from ${table} where id = $1`, [req.params.id]);
      if (!probe[0]) return err(res, 404, 'NOT_FOUND', 'User account not found');
      return err(res, 409, 'NAME_CHANGE_LIMIT', nameLimitMessage(probe[0].name_changed_at));
    }
    void audit(req.user.id, 'user.update', table, req.params.id, { fields: keys });
    res.json(rows[0]);
  } catch (e) {
    // The per-table email unique index: editing a user onto an email that
    // already exists is a conflict, not a server error.
    if (e.code === '23505') return err(res, 409, 'CONFLICT', 'Another account already uses this email');
    throw e;
  }
}));

// Admin-initiated invite (ADR-024, ADR-056). The invitee's identity lands in
// auth."user" now (so the reset link works immediately) and the pending app
// profile + grant wait in public.admin_invites for POST /auth/provision to
// consume. app_metadata is retired: BA's admin-plugin user.role is the only
// provider-side role signal, and only the server writes it.
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
      `select id, details->>'base_role' as base_role, coalesce(details->'permissions', '[]'::jsonb) as permissions
        from reference_data where id = $1 and category = 'custom_role'`, [b.custom_role_id]);
    if (!rows[0]) return err(res, 400, 'BAD_REQUEST', 'Custom role not found');
    role = rows[0].base_role;
    customRoleId = rows[0].id;
    if (b.role && b.role !== role) {
      return err(res, 400, 'BAD_REQUEST', 'role must match the custom role base role');
    }
    // G-02: an invite is a grant — the inviter cannot hand out a key it lacks.
    const missing = unheldKey(req, rows[0].permissions);
    if (missing) return err(res, 403, 'FORBIDDEN', `Your assigned role does not include "${missing}"`);
  }
  if (!INVITE_BASE_ROLES.includes(role)) {
    return err(res, 400, 'BAD_REQUEST', 'role must be job-seeker, employer, or super-admin');
  }
  // G-02b: only a full admin may mint another full admin. A tagged inviter
  // must name a custom role — its null tag is the break-glass grant.
  if (role === 'super-admin' && customRoleId === null && req.user?.customRoleId) {
    return err(res, 403, 'FORBIDDEN', 'Only a full admin can invite an admin without a custom role');
  }
  if (role === 'employer' && !String(b.company_name || '').trim()) {
    return err(res, 400, 'BAD_REQUEST', 'company_name is required for employer accounts');
  }

  const { rows: dupe } = await pool.query(
    `select 1 from auth."user" where lower(email) = lower($1)
     union all select 1 from job_seekers where lower(email) = lower($1)
     union all select 1 from employers where lower(email) = lower($1)
     union all select 1 from super_admins where lower(email) = lower($1) limit 1`, [email]);
  if (dupe[0]) return err(res, 409, 'CONFLICT', 'Email is already registered');

  const appUrl = appOrigin();
  // The pending app profile. Role and tag are COLUMNS on admin_invites, not
  // part of the jsonb: provision reads role/custom_role_id from there and the
  // body can never widen them (Review Focus 6).
  const profile = {
    first_name: b.first_name, middle_name: b.middle_name || '', last_name: b.last_name,
    suffix: b.suffix || '', phone: b.phone || null,
    full_name: buildFullName(b.first_name, b.middle_name, b.last_name, b.suffix),
    company_name: b.company_name || null,
  };
  // Identity + pending grant in ONE transaction: a half-written invite would
  // either claim the email with no grant or leave a grant with no user. The
  // id comes from gen_random_uuid() so it is the same uuid the role row will
  // use at provision (Decision 2/3).
  let userId;
  try {
    userId = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into auth."user" ("name", email, "emailVerified", image, "createdAt", "updatedAt", "role", "banned", "twoFactorEnabled")
         values ($1, $2, true, null, now(), now(), $3, false, false) returning "id"`,
        [profile.full_name || email, email, role === 'super-admin' ? 'super-admin' : null]);
      const id = rows[0].id;
      await client.query(
        `insert into public.admin_invites (user_id, role, custom_role_id, profile) values ($1, $2, $3, $4)`,
        [id, role, customRoleId, JSON.stringify(profile)]);
      return id;
    });
  } catch (e) {
    // The auth.user email unique constraint fired between the dupe check and
    // the insert: still a conflict, not a server error.
    if (e.code === '23505') return err(res, 409, 'CONFLICT', 'Email is already registered');
    throw e;
  }

  // The email is BA's public reset flow (the dual-window note in the plan: the
  // acting admin may still hold a Supabase session, and auth.api.createUser
  // requires a BA admin session, so the user was written directly above).
  try {
    await baAuth.api.requestPasswordReset({ body: { email, redirectTo: `${appUrl}/reset-password` } });
  } catch (e) {
    // Compensate: the identity exists but the invitee will never get a link,
    // so the address must not stay claimed. admin_invites cascades.
    try { await pool.query('delete from auth."user" where "id" = $1', [userId]); } catch { /* best effort */ }
    // Never forward the upstream message: it can name the address.
    if (e?.statusCode === 429 || /rate limit/i.test(String(e?.message || ''))) {
      return err(res, 429, 'RATE_LIMITED', 'Invite email rate limit reached. Please try again later.');
    }
    logger.error('invite_failed', { status: e?.statusCode });
    return err(res, 502, 'UPSTREAM_ERROR', 'The invite email could not be sent. Please try again later.');
  }

  void audit(req.user.id, 'user.invite', null, null, { email, role, custom_role_id: customRoleId });
  res.status(201).json({ invited: true, email, role });
}));

// Admin-initiated password reset (Task 5/6): Better Auth emails its recovery
// link, so the admin never chooses or sees a password. The response is
// identical whether or not the address exists upstream (BA answers 200 for an
// unknown address), and no email is echoed or logged — only the audit row
// records the acting admin and the target id.
router.post('/admin/users/:id/reset-password', ...admin, ah(async (req, res) => {
  const { table, profile } = await findUserTable(req.params.id);
  if (!profile) return err(res, 404, 'NOT_FOUND', 'User account not found');
  try {
    await baAuth.api.requestPasswordReset({
      body: { email: profile.email, redirectTo: `${appOrigin()}/reset-password` },
    });
  } catch (e) {
    // Same mapping as the invite route: a retryable rate limit must not look
    // like a permanent failure, and the upstream message is never forwarded
    // (it can name the address).
    if (e?.statusCode === 429 || /rate limit/i.test(String(e?.message || ''))) {
      return err(res, 429, 'RATE_LIMITED', 'Password reset rate limit reached. Please try again later.');
    }
    logger.error('password_reset_failed', { status: e?.statusCode });
    return err(res, 502, 'UPSTREAM_ERROR', 'The password reset email could not be sent. Please try again later.');
  }
  void audit(req.user.id, 'user.password.reset', table, req.params.id);
  res.json({ sent: true });
}));

// Force sign-out (Task 6): GoTrue's admin endpoint revokes every refresh token
// for the auth user, so every legacy device is signed out. During the dual
// window (ADR-056) the same user can also hold BA sessions in auth."session" —
// those are deleted here too, in the same request: a user who only ever signed
// in through Better Auth still has a Supabase row, and leaving the BA session
// alive would make "signed out" a lie. Impersonation is NOT offered — an admin
// acting as a user defeats the audit trail, which is why no route, UI, or token
// exchange exists for it.
router.post('/admin/users/:id/sign-out', ...admin, ah(async (req, res) => {
  const { table, profile } = await findUserTable(req.params.id);
  if (!profile) return err(res, 404, 'NOT_FOUND', 'User account not found');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = `${String(process.env.SUPABASE_URL || '').replace(/\/+$/, '')}/auth/v1/admin/users/${encodeURIComponent(req.params.id)}/logout`;
  let upstream;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    // Log the failure class only — never the URL (it carries the user id) and
    // never the service key.
    logger.error('force_sign_out_failed', { reason: e?.name === 'TimeoutError' ? 'timeout' : 'network' });
    return err(res, 502, 'UPSTREAM_ERROR', 'The sessions could not be revoked. Please try again later.');
  }
  if (!upstream.ok) {
    try { await upstream.body?.cancel?.(); } catch { /* already gone */ }
    logger.error('force_sign_out_failed', { status: upstream.status });
    return err(res, 502, 'UPSTREAM_ERROR', 'The sessions could not be revoked. Please try again later.');
  }
  await pool.query('delete from auth."session" where "userId" = $1', [req.params.id]);
  void audit(req.user.id, 'user.sessions.revoke', table, req.params.id);
  res.json({ signedOut: true });
}));

// Tag a user with a custom role (assignment lives on the Users page only).
router.post('/admin/users/:id/custom-role', ...admin, ah(async (req, res) => {
  if (req.params.id === req.user.id) return err(res, 403, 'FORBIDDEN', 'You cannot change your own role');
  const { custom_role_id: rawCustomRoleId = null, reason: rawReason, change_id: changeId } = req.body || {};
  const custom_role_id = normalizeCustomRoleId(rawCustomRoleId);
  if (custom_role_id === undefined) return err(res, 400, 'BAD_REQUEST', 'custom_role_id must be an integer');
  if (changeId != null && !isUuid(changeId)) return err(res, 400, 'BAD_REQUEST', 'change_id must be a UUID');
  const { table, profile } = await findUserTable(req.params.id);
  if (!profile) return err(res, 404, 'NOT_FOUND', 'User account not found');
  const denied = await grantError(req, custom_role_id, profile.role);
  if (denied) return err(res, denied.status, denied.code, denied.message);
  if (custom_role_id != null && await removesLastBreakGlass(table, profile, req.params.id)) {
    return err(res, 409, 'CONFLICT', LAST_ADMIN_MSG);
  }
  // Same tag → nothing to write or audit, and no reason required.
  if (normalizeCustomRoleId(profile.custom_role_id) === custom_role_id) {
    return res.json({ ...profile, custom_role_id });
  }
  // The reason is contract, not decoration: the history table reads it back.
  const reason = String(rawReason ?? '').trim();
  if (reason.length < 10 || reason.length > 500) return err(res, 400, 'BAD_REQUEST', REASON_INVALID);
  const { rows } = await pool.query(
    `update ${table} set custom_role_id = $2, updated_at = now() where id = $1 returning *`,
    [req.params.id, custom_role_id]);
  void audit(req.user.id, 'user.custom-role.assign', table, req.params.id, {
    from_custom_role_id: profile.custom_role_id ?? null, to_custom_role_id: custom_role_id, reason,
    ...(changeId ? { change_id: changeId } : {}),
  });
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
  const { role, reason: rawReason, change_id: changeId } = req.body || {};
  if (!USER_TABLES[role]) return err(res, 400, 'BAD_REQUEST', 'Invalid role');
  if (changeId != null && !isUuid(changeId)) return err(res, 400, 'BAD_REQUEST', 'change_id must be a UUID');
  const { table, profile } = await findUserTable(req.params.id);
  if (!profile) return err(res, 404, 'NOT_FOUND', 'User account not found');
  if (profile.role === role) return res.json({ id: req.params.id, role });
  // G-07: demoting the last break-glass super-admin removes the recovery path.
  if (await removesLastBreakGlass(table, profile, req.params.id)) {
    return err(res, 409, 'CONFLICT', LAST_ADMIN_MSG);
  }
  const reason = String(rawReason ?? '').trim();
  if (reason.length < 10 || reason.length > 500) return err(res, 400, 'BAD_REQUEST', REASON_INVALID);
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
  void audit(req.user.id, 'user.role.change', USER_TABLES[role], req.params.id, {
    from: profile.role, to: role, reason, ...(changeId ? { change_id: changeId } : {}),
  });
  res.json({ id: req.params.id, role });
}));

export default router;
