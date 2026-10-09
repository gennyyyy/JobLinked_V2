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

export async function purgeOldApplications(monthsOld = 12) {
  const { deleted } = await api.post('admin/purge', { monthsOld });
  return deleted ?? 0;
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

export async function sendSystemNotification({ title, message, link = null, expires_at = null }) {
  return api.post('admin/system-notifications', { title, message, link, expires_at });
}

// Server-rendered export (CSV/Excel/PDF). 404 = backend item missing → the
// Reports page falls back to its client-side CSV builder.
export async function exportReport(type, format) {
  return api.blob(`admin/reports/${type}/export?format=${format}`);
}
