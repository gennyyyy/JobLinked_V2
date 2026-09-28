import { supabase } from '../lib/supabase';
import { logAudit } from './audit';
import { notify } from './notifications';

const employerSelect = '*, job:job_vacancies (id, title, location, employment_type, employers (company_name, id)), seeker:job_seekers (id, full_name, email, phone, barangay_district, skills, employment_status, preferred_position, preferred_location)';

// ponytail: job_applications.resume_id has no FK to resumes, so PostgREST cannot
// embed it (PGRST200). Fetch separately until `alter table job_applications add
// constraint job_applications_resume_fk foreign key (resume_id) references resumes(id)` lands.
async function attachResumes(rows) {
  const ids = [...new Set(rows.map((r) => r.resume_id).filter(Boolean))];
  if (!ids.length) return rows;
  const { data } = await supabase.from('resumes').select('id, file_name, file_path').in('id', ids);
  const byId = Object.fromEntries((data || []).map((r) => [r.id, r]));
  return rows.map((r) => ({ ...r, resume: byId[r.resume_id] || null }));
}

export async function applyToJob(jobId, seekerId, resumeId = null) {
  const { data, error } = await supabase
    .from('job_applications')
    .insert({ job_id: jobId, seeker_id: seekerId, resume_id: resumeId })
    .select('id, job_id, seeker_id, resume_id, status, applied_at, updated_at')
    .maybeSingle();
  if (error) {
    if (error.code === '23505') throw new Error('You have already applied to this job.');
    if (error.code === '23503') throw new Error('The selected resume is no longer available. Please reload and try again.');
    throw error;
  }
  if (!data) throw new Error('Application was not saved. Please try again.');
  await logAudit('application.create', 'job_applications', data.id);
  void notifyJobOwner(jobId, seekerId);
  return data;
}

async function notifyJobOwner(jobId, seekerId) {
  const [{ data: job }, { data: seeker }] = await Promise.all([
    supabase.from('job_vacancies').select('title, employers (id)').eq('id', jobId).maybeSingle(),
    supabase.from('job_seekers').select('full_name').eq('id', seekerId).maybeSingle(),
  ]);
  if (!job?.employers?.id) return;
  await notify({
    userId: job.employers.id,
    type: 'application',
    title: 'New applicant',
    message: `${seeker?.full_name || 'A job seeker'} applied for ${job.title}.`,
    link: '/employer/applicants',
  });
}

export async function listBySeeker(seekerId) {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*, job:job_vacancies (id, title, location, employment_type, employers (company_name, id))')
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
  return attachResumes(data || []);
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
  return attachResumes(data || []);
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
  const [withResume] = data ? await attachResumes([data]) : [null];
  // ponytail: two client writes, not atomic — fold into one RPC if history drift matters
  const { data: { user } } = await supabase.auth.getUser();
  const { error: histError } = await supabase.from('application_status_history').insert({ application_id: id, status, remarks, changed_by: user?.id || null });
  if (histError) throw new Error(`Application updated but status history was not recorded: ${histError.message}`);
  await logAudit(`application.status.${status}`, 'job_applications', id);
  if (withResume?.seeker?.id) {
    await notify({
      userId: withResume.seeker.id,
      type: 'application',
      title: `Application ${status}`,
      message: `Your application for "${withResume.job?.title}" is now ${status}.`,
      link: '/job-seeker/applications',
    });
  }
  return withResume;
}

export async function listApplicationHistory(applicationId) {
  const { data, error } = await supabase
    .from('application_status_history')
    .select('*')
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
  return attachResumes(data || []);
}
