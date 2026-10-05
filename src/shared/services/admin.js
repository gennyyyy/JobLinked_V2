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
