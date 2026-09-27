import { supabase } from '../lib/supabase';
import { logAudit } from './audit';

export async function getStats() {
  const [seekers, employers, companies, jobs, applications, accreditations, unreadNotifs] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'job-seeker'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employer'),
    supabase.from('companies').select('*', { count: 'exact', head: true }),
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
  let query = supabase.from('profiles').select('*');
  if (role) query = query.eq('role', role);
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateUser(userId, patch) {
  const { data, error } = await supabase.from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', userId).select().maybeSingle();
  if (error) throw error;
  await logAudit('user.update', 'profiles', userId, { fields: Object.keys(patch) });
  return data;
}

export async function listCompanies({ status = null } = {}) {
  let query = supabase.from('companies').select('*, owner:profiles (id, full_name, email, status)');
  if (status) query = query.eq('owner.status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listAuditLogs({ limit = 500, userId = '', action = '', from = '', to = '' } = {}) {
  let query = supabase
    .from('audit_logs')
    .select('*, user:profiles (full_name, email)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (userId) query = query.eq('user_id', userId);
  if (action) query = query.eq('action', action);
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

export async function listBarangays() {
  const { data, error } = await supabase.from('barangays').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function addBarangay(name) {
  const { error } = await supabase.from('barangays').insert({ name });
  if (error) throw error;
  await logAudit('settings.barangay.add', 'barangays', name);
}

export async function removeBarangay(id) {
  const { error } = await supabase.from('barangays').delete().eq('id', id);
  if (error) throw error;
  await logAudit('settings.barangay.remove', 'barangays', String(id));
}

export async function listAllApplications({ status = null, search = '' } = {}) {
  let query = supabase
    .from('job_applications')
    .select('*, job:job_vacancies (id, title, location, companies (name)), seeker:profiles (id, full_name, email, phone, barangay)');
  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('seeker.full_name', `%${search}%`);
  const { data, error } = await query.order('applied_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listAllJobs({ status = null } = {}) {
  let query = supabase.from('job_vacancies').select('*, companies (id, name)');
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listAllAccreditations() {
  const { data, error } = await supabase
    .from('employer_accreditations')
    .select('*, companies (id, name), decided_by:profiles (full_name)')
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listDocumentsForAccreditation(accreditationId) {
  const { data, error } = await supabase
    .from('employer_documents')
    .select('*')
    .eq('accreditation_id', accreditationId)
    .order('doc_type');
  if (error) throw error;
  return data || [];
}

export async function listSeekerDetails(seekerId) {
  const [profile, skills, education, experience, applications] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', seekerId).maybeSingle(),
    supabase.from('skills').select('*').eq('seeker_id', seekerId),
    supabase.from('education').select('*').eq('seeker_id', seekerId),
    supabase.from('work_experience').select('*').eq('seeker_id', seekerId),
    supabase.from('job_applications').select('*, job:job_vacancies (id, title, companies (name))').eq('seeker_id', seekerId),
  ]);
  if (profile.error) throw profile.error;
  void logAudit('profile.view', 'profiles', seekerId);
  return {
    profile: profile.data,
    skills: skills.data || [],
    education: education.data || [],
    experience: experience.data || [],
    applications: applications.data || [],
  };
}
