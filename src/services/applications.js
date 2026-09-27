import { supabase } from '../lib/supabase';
import { logAudit } from './audit';

const employerSelect = '*, job:job_vacancies (id, title, location, employment_type, companies (name)), seeker:profiles (id, full_name, email, phone, barangay), resume:resumes (id, file_name, file_path)';

export async function applyToJob(jobId, seekerId, resumeId = null) {
  const { data, error } = await supabase
    .from('job_applications')
    .insert({ job_id: jobId, seeker_id: seekerId, resume_id: resumeId })
    .select(employerSelect)
    .maybeSingle();
  if (error) {
    if (error.code === '23505') throw new Error('You have already applied to this job.');
    throw error;
  }
  await logAudit('application.create', 'job_applications', data.id);
  return data;
}

export async function listBySeeker(seekerId) {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*, job:job_vacancies (id, title, location, employment_type, companies (name))')
    .eq('seeker_id', seekerId)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  void logAudit('application.list.view', 'job_applications', null, { seekerId });
  return data || [];
}

export async function listByJob(jobId) {
  const { data, error } = await supabase
    .from('job_applications')
    .select(employerSelect)
    .eq('job_id', jobId)
    .order('applied_at', { ascending: false });
  if (error) throw error;
  void logAudit('application.list.view', 'job_applications', null, { jobId });
  return data || [];
}

export async function listByCompany(companyId) {
  const { data: jobs, error: jobsError } = await supabase
    .from('job_vacancies')
    .select('id')
    .eq('company_id', companyId);
  if (jobsError) throw jobsError;
  if (!jobs?.length) return [];

  const { data, error } = await supabase
    .from('job_applications')
    .select(employerSelect)
    .in('job_id', jobs.map((job) => job.id))
    .order('applied_at', { ascending: false });
  if (error) throw error;
  void logAudit('application.list.view', 'job_applications', null, { companyId });
  return data || [];
}

export async function updateApplicationStatus(id, status, { remarks = null, employerNotes = null, interviewAt = null, interviewInstructions = null } = {}) {
  const patch = { status, updated_at: new Date().toISOString() };
  if (remarks !== null) patch.employer_notes = remarks;
  if (employerNotes !== null) patch.employer_notes = employerNotes;
  if (interviewAt !== null) patch.interview_at = interviewAt;
  if (interviewInstructions !== null) patch.interview_instructions = interviewInstructions;
  const { data, error } = await supabase
    .from('job_applications')
    .update(patch)
    .eq('id', id)
    .select(employerSelect)
    .maybeSingle();
  if (error) throw error;
  await supabase.from('application_status_history').insert({ application_id: id, status, remarks });
  await logAudit(`application.status.${status}`, 'job_applications', id);
  return data;
}

export async function listApplicationHistory(applicationId) {
  const { data, error } = await supabase
    .from('application_status_history')
    .select('*, changed_by:profiles (full_name)')
    .eq('application_id', applicationId)
    .order('changed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listByCompanyIds(companyIds, { status = null } = {}) {
  if (!companyIds?.length) return [];
  const { data: jobs, error: jobsError } = await supabase
    .from('job_vacancies')
    .select('id')
    .in('company_id', companyIds);
  if (jobsError) throw jobsError;
  if (!jobs?.length) return [];

  let query = supabase
    .from('job_applications')
    .select(employerSelect)
    .in('job_id', jobs.map((job) => job.id));
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('applied_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
