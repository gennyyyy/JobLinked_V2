import { api } from '../lib/api';

export async function listJobs({ search = '', location = '', employmentType = '', employer = '', salaryMin = null, skills = '', status = null, page = 1, pageSize = 10, order = 'created_at.desc' } = {}) {
  return api.get('jobs', { search, location, employmentType, employer, salaryMin, skills, status, page, pageSize, order });
}

export async function getJob(id) {
  return api.get(`jobs/${id}`);
}

export async function listEmployerJobs(companyId, { status = null } = {}) {
  return api.get(`employers/${companyId}/jobs`, { status });
}

// company_id is taken from the session token server-side, never the body.
export async function createJob(companyId, job) {
  void companyId;
  return api.post('jobs', job);
}

export async function updateJob(id, patch) {
  return api.patch(`jobs/${id}`, patch);
}

export async function changeJobStatus(id, status, remarks = null) {
  return api.post(`jobs/${id}/status`, { status, remarks });
}

export async function duplicateJob(id) {
  return api.post(`jobs/${id}/duplicate`);
}
