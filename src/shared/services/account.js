import { api, clearApiCache } from '../lib/api'
import { authClient } from '../lib/auth-client'

export function getPreferences() {
  return api.get('account/preferences')
}

export function updatePreferences(patch) {
  return api.patch('account/preferences', patch)
}

export async function revokeAllSessions() {
  await api.post('account/sessions/revoke-all')
  try { await authClient.signOut() } catch { /* best-effort */ }
  clearApiCache()
}

export async function deactivateAccount() {
  await api.post('account/deactivate', { confirm: 'DEACTIVATE' })
  try { await authClient.signOut() } catch { /* best-effort */ }
  clearApiCache()
}
