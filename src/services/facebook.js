import { supabase } from '../lib/supabase';
import { logAudit } from './audit';

// ponytail: real posting needs a Facebook app + page access token (server-side
// secret). Tokens live in facebook_integrations.access_token, never in the
// browser. Until credentials are configured, connect/test/post are no-ops that
// record state so the workflow UI is fully exercisable.

export async function getIntegration() {
  const { data, error } = await supabase.from('facebook_integrations').select('*').order('connected_at', { ascending: false }).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveIntegration({ pageId, pageName, accessToken, autoPost }) {
  const existing = await getIntegration();
  const payload = { page_id: pageId, page_name: pageName, access_token: accessToken, auto_post: autoPost, status: 'connected', disconnected_at: null };
  const { data, error } = existing
    ? await supabase.from('facebook_integrations').update(payload).eq('id', existing.id).select().maybeSingle()
    : await supabase.from('facebook_integrations').insert(payload).select().maybeSingle();
  if (error) throw error;
  await logAudit('facebook.connect', 'facebook_integrations', data.id);
  return data;
}

export async function disconnectIntegration() {
  const existing = await getIntegration();
  if (!existing) return;
  const { error } = await supabase
    .from('facebook_integrations')
    .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
    .eq('id', existing.id);
  if (error) throw error;
  await logAudit('facebook.disconnect', 'facebook_integrations', existing.id);
}

export async function setAutoPost(enabled) {
  const existing = await getIntegration();
  if (!existing) throw new Error('No Facebook integration configured');
  const { error } = await supabase.from('facebook_integrations').update({ auto_post: enabled }).eq('id', existing.id);
  if (error) throw error;
}

export async function listPosts() {
  const { data, error } = await supabase
    .from('facebook_posts')
    .select('*, job:job_vacancies (id, title)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createPendingPost(jobId) {
  const { data, error } = await supabase
    .from('facebook_posts')
    .insert({ job_id: jobId, status: 'pending' })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePost(id, patch) {
  const { error } = await supabase.from('facebook_posts').update(patch).eq('id', id);
  if (error) throw error;
}

export function buildPostText(job) {
  const salary = job.salary_min || job.salary_max
    ? ` · ₱${job.salary_min ?? '?'}–₱${job.salary_max ?? '?'}`
    : '';
  return `Now hiring: ${job.title}${salary}\n${job.location || ''}\nApply via JobLinked at ${window.location.origin}`;
}
