import { supabase } from '../lib/supabase';

export async function logAudit(action, entity = null, entityId = null, details = null) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('audit_logs').insert({ user_id: user?.id || null, action, entity, entity_id: entityId, details });
  if (error) console.warn('audit log failed:', error.message);
}
