import { supabase } from '../lib/supabase';
import { NOTIFICATION_TYPES } from '../constants';

export async function listNotifications(userId, { unreadOnly = false } = {}) {
  let query = supabase.from('notifications').select('*').eq('user_id', userId);
  if (unreadOnly) query = query.eq('is_read', false);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data || [];
}

export async function createNotification({ userId, type, title, message, link = null }) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, type, title, message, link });
  if (error) throw error;
}

export async function markRead(id) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllRead(userId) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  if (error) throw error;
}

export async function unreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return count || 0;
}

export { NOTIFICATION_TYPES };
