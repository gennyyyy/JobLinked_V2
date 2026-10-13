import { api } from '../lib/api';

export async function getStats() {
  return api.get('admin/stats');
}

export async function listUsers({ role = null, search = '', status = null } = {}) {
  return api.get('admin/users', { role, search, status });
}

export async function updateUser(userId, patch) {
  return api.patch(`admin/users/${userId}`, patch);
}

export async function listCompanies({ status = null } = {}) {
  return api.get('admin/companies', { status });
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

export async function listAllApplications({ status = null, search = '' } = {}) {
  return api.get('admin/applications', { status, search });
}

export async function listAllJobs({ status = null } = {}) {
  return api.get('admin/jobs', { status });
}

export async function listAllEmployees() {
  return api.get('admin/employees');
}

export async function listReferrals() {
  return api.get('admin/referrals');
}

export async function listAllAccreditations() {
  return api.get('admin/accreditations');
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
// Permission keys are the UI gate keys — keep in sync with ROLE_PERMISSIONS
// in server/src/routes/admin.js.
export const ROLE_PERMISSIONS = [
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

// Server-rendered export (CSV/Excel/PDF). 404 = backend item missing → the
// Reports page falls back to its client-side CSV builder.
export async function exportReport(type, format) {
  return api.blob(`admin/reports/${type}/export?format=${format}`);
}
