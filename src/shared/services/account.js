import { api, clearApiCache } from '../lib/api'
import { supabase } from '../lib/supabase'

export function getPreferences() {
  return api.get('account/preferences')
}

export function updatePreferences(patch) {
  return api.patch('account/preferences', patch)
}

export async function revokeAllSessions() {
  await api.post('account/sessions/revoke-all')
  try { await supabase.auth.signOut({ scope: 'global' }) } catch { /* best-effort */ }
  clearApiCache()
}
