import { Router } from 'express';
import { pool } from '../db.js';
import { auth, requireRole } from '../auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { ah, err, audit, isNumericId } from '../util.js';
import { USER_TABLES } from './admin-shared.js';

const router = Router();
const admin = [auth, requireRole('super-admin')];
// ADR-042: the role catalogue is read by Role Management AND by User Management
// (to assign a role), so reads accept either key; mutations stay roles-only.
const rolesRead = [...admin, requirePermission('roles.manage', 'users.manage')];
const rolesWrite = [...admin, requirePermission('roles.manage')];
const settingsAdmin = [...admin, requirePermission('settings.manage')];

router.get('/admin/reference/:category', ...settingsAdmin, ah(async (req, res) => {
  const { rows } = await pool.query(
    'select * from reference_data where category = $1 order by sort_order', [req.params.category]);
  res.json(rows);
}));

router.post('/admin/reference/:category', ...settingsAdmin, ah(async (req, res) => {
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

router.get('/admin/permissions', ...rolesRead, ah(async (_req, res) => {
  res.json(ROLE_PERMISSIONS);
}));

router.get('/admin/roles', ...rolesRead, ah(async (req, res) => {
  const { rows } = await pool.query(
    `select * from reference_data where category = 'custom_role' order by sort_order, value`);
  res.json(rows.map(parseCustomRole));
}));

router.post('/admin/roles', ...rolesWrite, ah(async (req, res) => {
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

router.patch('/admin/roles/:id', ...rolesWrite, ah(async (req, res) => {
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

router.delete('/admin/roles/:id', ...rolesWrite, ah(async (req, res) => {
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

router.delete('/admin/reference/:id', ...settingsAdmin, ah(async (req, res) => {
  if (!isNumericId(req.params.id)) return err(res, 400, 'BAD_REQUEST', 'Invalid id');
  const { rowCount } = await pool.query('delete from reference_data where id = $1', [req.params.id]);
  if (!rowCount) return err(res, 404, 'NOT_FOUND', 'Reference not found');
  void audit(req.user.id, 'settings.reference.remove', 'reference_data', req.params.id);
  res.json({ deleted: true });
}));

export default router;
