import { api } from '../lib/api';

export async function getStats() {
  return api.get('admin/stats');
}

export async function listUsers({ role = null, search = '', status = null, page = 1, pageSize = 25 } = {}) {
  return api.get('admin/users', { role, search, status, page, pageSize });
}

export async function updateUser(userId, patch) {
  return api.patch(`admin/users/${userId}`, patch);
}

export async function listCompanies({ status = null, page = 1, pageSize = 25 } = {}) {
  return api.get('admin/companies', { status, page, pageSize });
}

export async function listAuditLogs({ limit = 500, userId = '', action = '', from = '', to = '' } = {}) {
  return api.get('admin/audit-logs', { limit, userId, action, from, to });
}

export async function listReferenceData(category) {
  return api.get(`admin/reference/${category}`);
}

export async function addReferenceData(category, value) {
  return api.post(`admin/reference/${category}`, { value });
}

export async function removeReferenceData(id) {
  return api.del(`admin/reference/${id}`);
}

export async function listAllApplications({ status = null, search = '', page = 1, pageSize = 25 } = {}) {
  return api.get('admin/applications', { status, search, page, pageSize });
}

export async function listAllJobs({ status = null, page = 1, pageSize = 25 } = {}) {
  return api.get('admin/jobs', { status, page, pageSize });
}

// Default pageSize 100: the newest-first accreditation list doubles as the
// per-company "latest accreditation" lookup (badges, revoke/reinstate), so it
// needs a fuller page than the row-per-record tables.
export async function listAllAccreditations({ page = 1, pageSize = 100 } = {}) {
  return api.get('admin/accreditations', { page, pageSize });
}

// Admin job edit (PATCH admin/jobs/:id) + publish/unpublish toggles.
export async function editJob(id, patch) {
  return api.patch(`admin/jobs/${id}`, patch);
}

export async function publishJob(id) {
  return api.post(`admin/jobs/${id}/publish`);
}

export async function unpublishJob(id) {
  return api.post(`admin/jobs/${id}/unpublish`);
}

// Request-document resubmission: PATCH accreditations/:id
// { status: 'resubmission', remarks }. Shape matches the admin accreditation
// contract (PATCH …/accreditations/:id { status, remarks? }).
export async function requestDocs(id, remarks) {
  return api.patch(`accreditations/${id}`, { status: 'resubmission', remarks });
}

export async function assignRole(id, role) {
  return api.post(`admin/users/${id}/role`, { role });
}

// ─── Super-admin custom roles (catalog: Roles page; assignment: Users page) ──
// The permission catalog is server-owned: GET /admin/permissions, below as
// listPermissions. No client copy.
export async function listPermissions() {
  return api.get('admin/permissions');
}

export async function listRoles() {
  return api.get('admin/roles');
}

export async function createRole(payload) {
  return api.post('admin/roles', payload);
}

export async function updateRole(id, payload) {
  return api.patch(`admin/roles/${id}`, payload);
}

export async function deleteRole(id) {
  return api.del(`admin/roles/${id}`);
}

// Tag/untag a user with a custom role (Users page only).
export async function assignCustomRole(id, customRoleId) {
  return api.post(`admin/users/${id}/custom-role`, { custom_role_id: customRoleId ?? null });
}

// Admin-initiated invite (ADR-024): Supabase emails the invitee; their role row
// is created by POST /auth/provision when they accept.
export async function inviteUser(payload) {
  return api.post('admin/users/invite', payload);
}

export async function sendSystemNotification({ title, message, link = null, expires_at = null }) {
  return api.post('admin/system-notifications', { title, message, link, expires_at });
}
