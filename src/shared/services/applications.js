import { api } from '../lib/api';

// Seeker identity comes from the session token; seeker embeds and history
// writes moved server-side (single-query embeds, one transaction).
export async function applyToJob(jobId, seekerId, resumeId = null) {
  void seekerId;
  return api.post('applications', { job_id: jobId, resume_id: resumeId || null });
}

export async function listBySeeker(seekerId) {
  void seekerId;
  return api.get('applications/mine');
}

export async function listByCompany(companyId) {
  return api.get(`applications/company/${companyId}`);
}

export async function updateApplicationStatus(id, status, { remarks = null, employerNotes = null, interviewAt = null, interviewInstructions = null } = {}) {
  return api.post(`applications/${id}/status`, { status, remarks, employerNotes, interviewAt, interviewInstructions });
}
