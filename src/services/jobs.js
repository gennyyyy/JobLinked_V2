import { supabase } from '../lib/supabase';
import { logAudit } from './audit';

const companySelect = '*, companies (id, name, logo_path)';

export async function listJobs({ search = '', location = '', employmentType = '', status = null, page = 1, pageSize = 10, order = 'created_at.desc' } = {}) {
  let query = supabase.from('job_vacancies').select(companySelect, { count: 'exact' });
  if (status) query = query.eq('status', status);
  else query = query.eq('status', 'published');
  if (search) query = query.ilike('title', `%${search}%`);
  if (location) query = query.ilike('location', `%${location}%`);
  if (employmentType) query = query.eq('employment_type', employmentType);
  const [column, dir] = order.split('.');
  query = query.order(column, { ascending: dir === 'asc' });
  const from = (page - 1) * pageSize;
  const { data, count, error } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  void logAudit('job.search', 'job_vacancies', null, { search, location, employmentType, status, page });
  return { jobs: data || [], total: count || 0, page, pageSize };
}

export async function getJob(id) {
  const { data, error } = await supabase.from('job_vacancies').select(companySelect).eq('id', id).maybeSingle();
  if (error) throw error;
  void logAudit('job.view', 'job_vacancies', id);
  return data;
}

export async function listEmployerJobs(companyId, { status = null } = {}) {
  try {
    let query = supabase
      .from('job_vacancies')
      .select('*, companies (id, name, logo_path), job_applications (count)')
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
  } catch {
    let query = supabase.from('job_vacancies').select(companySelect).eq('company_id', companyId);
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    void logAudit('job.list.view', 'job_vacancies', null, { companyId, status });
    return data || [];
  }
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
  try {
    const { data: authData } = await supabase.auth.getUser();
    await supabase.from('job_status_history').insert({
      job_id: id,
      status,
      remarks,
      changed_by: authData?.user?.id || null,
    });
  } catch (err) {
    console.warn('job status history log failed:', err?.message);
  }
  return job;
}

export async function listJobHistory(jobId) {
  const { data, error } = await supabase
    .from('job_status_history')
    .select('*, changed_by:profiles (full_name)')
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
