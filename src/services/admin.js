import { supabase } from '../lib/supabase';
import { logAudit } from './audit';
import { getProfile } from './auth';

export async function getStats() {
  const [seekers, employers, companies, jobs, applications, accreditations, unreadNotifs] = await Promise.all([
    supabase.from('job_seekers').select('*', { count: 'exact', head: true }),
    supabase.from('employers').select('*', { count: 'exact', head: true }),
    supabase.from('employers').select('*', { count: 'exact', head: true }),
    supabase.from('job_vacancies').select('*', { count: 'exact', head: true }),
    supabase.from('job_applications').select('*', { count: 'exact', head: true }),
    supabase.from('employer_accreditations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_read', false),
  ]);
  return {
    seekers: seekers.count || 0,
    employers: employers.count || 0,
    companies: companies.count || 0,
    jobs: jobs.count || 0,
    applications: applications.count || 0,
    pendingAccreditations: accreditations.count || 0,
    unreadNotifications: unreadNotifs.count || 0,
  };
}

export async function listUsers({ role = null, search = '', status = null } = {}) {
  const tables = role ? [role === 'job-seeker' ? 'job_seekers' : role === 'super-admin' ? 'super_admins' : 'employers'] : ['job_seekers', 'employers', 'super_admins'];
  const rows = await Promise.all(tables.map(async (table) => {
    let query = supabase.from(table).select('*');
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    const userRole = table === 'job_seekers' ? 'job-seeker' : table === 'super_admins' ? 'super-admin' : 'employer';
    return (data || []).map((user) => ({ ...user, role: userRole }));
  }));
  return rows.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function updateUser(userId, patch) {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('User account not found');
  if (patch.role && patch.role !== profile.role) throw new Error('Role changes are disabled because each role has its own account table.');
  const table = profile.role === 'job-seeker' ? 'job_seekers' : profile.role === 'super-admin' ? 'super_admins' : 'employers';
  const { data, error } = await supabase.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', userId).select().maybeSingle();
  if (error) throw error;
  await logAudit('user.update', table, userId, { fields: Object.keys(patch) });
  return data;
}

export async function listCompanies({ status = null } = {}) {
  let query = supabase.from('employers').select('*');
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listAuditLogs({ limit = 500, userId = '', action = '', from = '', to = '' } = {}) {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (userId) query = query.eq('user_id', userId);
  if (action) query = query.ilike('action', `%${action}%`);
  if (from) query = query.gte('created_at', `${from}T00:00:00`);
  if (to) query = query.lte('created_at', `${to}T23:59:59.999`);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listReferenceData(category) {
  const { data, error } = await supabase.from('reference_data').select('*').eq('category', category).order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function addReferenceData(category, value) {
  const { error } = await supabase.from('reference_data').insert({ category, value });
  if (error) throw error;
  await logAudit('settings.reference.add', 'reference_data', null, { category, value });
}

export async function removeReferenceData(id) {
  const { error } = await supabase.from('reference_data').delete().eq('id', id);
  if (error) throw error;
  await logAudit('settings.reference.remove', 'reference_data', String(id));
}

export async function listAllApplications({ status = null, search = '' } = {}) {
  let query = supabase
    .from('job_applications')
    .select('*, job:job_vacancies (id, title, location, employers (company_name)), seeker:job_seekers (id, full_name, email, phone, barangay_district)');
  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('seeker.full_name', `%${search}%`);
  const { data, error } = await query.order('applied_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listAllJobs({ status = null } = {}) {
  let query = supabase.from('job_vacancies').select('*, employers (id, company_name)');
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listAllEmployees() {
  // Returns all Accepted/Terminated applications with seeker + job + employer joins,
  // ordered by company then hire date so the UI can group by company easily.
  const { data, error } = await supabase
    .from('job_applications')
    .select(
      '*, ' +
      'seeker:job_seekers (id, full_name, email, phone, barangay_district), ' +
      'job:job_vacancies (id, title, company_id, employers (id, company_name))'
    )
    .in('status', ['Accepted', 'Terminated'])
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listAllAccreditations() {
  const { data, error } = await supabase
    .from('employer_accreditations')
    .select('*, employers (*), decided_by:super_admins (full_name)')
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
