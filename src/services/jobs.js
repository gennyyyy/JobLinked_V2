import { supabase } from '../lib/supabase';
import { logAudit } from './audit';
import { notifyAdmins } from './notifications';

// Left join so jobs are never silently dropped if the employer row has any
// join resolution issue. company_id has a NOT NULL constraint so no orphan rows exist.
const companySelect = '*, employers (id, company_name, logo_path)';

export async function listJobs({ search = '', location = '', employmentType = '', employer = '', salaryMin = null, status = null, page = 1, pageSize = 10, order = 'created_at.desc' } = {}) {
  let query = supabase.from('job_vacancies').select(companySelect, { count: 'exact' });
  if (status) query = query.eq('status', status);
  else query = query.eq('status', 'published');
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  if (location) query = query.ilike('location', `%${location}%`);
  if (employmentType) query = query.eq('employment_type', employmentType);
  if (salaryMin) query = query.or(`salary_min.gte.${salaryMin},salary_max.gte.${salaryMin}`);
  const [column, dir] = order.split('.');
  query = query.order(column, { ascending: dir === 'asc' });
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  // Filter by employer name client-side after fetch — PostgREST embedded table
  // filters don't work reliably as WHERE clauses on the parent row with a left join.
  const jobs = employer
    ? (data || []).filter((j) => j.employers?.company_name?.toLowerCase().includes(employer.toLowerCase()))
    : (data || []);

  void logAudit('job.search', 'job_vacancies', null, { search, location, employmentType, status, page });
  return { jobs, total: count || 0, page, pageSize };
}

export async function getJob(id) {
  const { data, error } = await supabase.from('job_vacancies').select(companySelect).eq('id', id).maybeSingle();
  if (error) throw error;
  void logAudit('job.view', 'job_vacancies', id);
  return data;
}

export async function listEmployerJobs(companyId, { status = null } = {}) {
  let query = supabase
    .from('job_vacancies')
    .select('*, employers (id, company_name, logo_path), job_applications (count)')
    .eq('company_id', companyId);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  void logAudit('job.list.view', 'job_vacancies', null, { companyId, status });
  return (data || []).map((j) => ({
    ...j,
    applicant_count: Array.isArray(j.job_applications)
      ? (j.job_applications[0]?.count ?? j.job_applications.length)
      : 0,
  }));
}

export async function createJob(companyId, job) {
  const { data, error } = await supabase
    .from('job_vacancies')
    .insert({ ...job, company_id: companyId })
    .select(companySelect)
    .maybeSingle();
  if (error) throw error;
  await logAudit('job.create', 'job_vacancies', data.id);
  return data;
}

export async function updateJob(id, patch, { auditAction = 'job.update' } = {}) {
  const { data, error } = await supabase
    .from('job_vacancies')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(companySelect)
    .maybeSingle();
  if (error) throw error;
  await logAudit(auditAction, 'job_vacancies', id);
  return data;
}

export async function changeJobStatus(id, status, remarks = null) {
  const patch = { status, remarks, updated_at: new Date().toISOString() };
  if (status === 'published') patch.published_at = new Date().toISOString();
  if (status === 'closed') patch.closed_at = new Date().toISOString();
  if (status === 'archived') patch.archived_at = new Date().toISOString();
  const job = await updateJob(id, patch, { auditAction: `job.status.${status}` });
  // ponytail: update + history are two client writes (not atomic); a Postgres RPC
  // wrapping both is the upgrade path if history rows must never drift
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase.from('job_status_history').insert({
    job_id: id,
    status,
    remarks,
    changed_by: authData?.user?.id || null,
  });
  if (error) throw new Error(`Job updated but status history was not recorded: ${error.message}`);
  await notifyJobStatusChange(id, status);
  await queueFacebookPost(id, status);
  return job;
}

// Queue a FB post when a job goes live, and only when auto-posting is on.
// ponytail: rows stay 'pending' until a server (edge function) with the page
// token consumes them — the browser must never hold the token.
async function queueFacebookPost(jobId, status) {
  if (status !== 'published') return;
  try {
    const { data: integration } = await supabase
      .from('facebook_integrations')
      .select('id, status, auto_post')
      .order('connected_at', { ascending: false })
      .maybeSingle();
    if (!integration || integration.status !== 'connected' || !integration.auto_post) return;
    await supabase.from('facebook_posts').insert({ job_id: jobId, integration_id: integration.id, status: 'pending' });
  } catch {
    // best effort: a failed queue must not block the publish action
  }
}

async function notifyJobStatusChange(jobId, status) {
  // no approval flow: employers publish themselves, so only admins get a heads-up
  if (status !== 'published') return;
  const { data: job } = await supabase.from('job_vacancies').select('title, employers (company_name)').eq('id', jobId).maybeSingle();
  if (!job) return;
  await notifyAdmins({
    type: 'job',
    title: 'Job published',
    message: `"${job.title}" (${job.employers?.company_name}) is now live on the job board.`,
    link: '/super-admin/job-posts',
  });
}

export async function listJobHistory(jobId) {
  const { data, error } = await supabase
    .from('job_status_history')
    .select('*')
    .eq('job_id', jobId)
    .order('changed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function countApplicants(jobId) {
  const { count, error } = await supabase.from('job_applications').select('*', { count: 'exact', head: true }).eq('job_id', jobId);
  if (error) throw error;
  return count || 0;
}
