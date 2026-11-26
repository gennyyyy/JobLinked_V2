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

// GET returns the contract envelope; the browser owns the file, so no server
// Content-Disposition is needed here.
export async function exportAccount() {
  const data = await api.get('account/export')
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'joblinked-export.json'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// ADR-060: the server anonymizes and deletes the auth user; the local session
// is already invalid, so only the client cache and Better Auth state remain.
export async function eraseAccount() {
  await api.del('account', { confirm: 'ERASE' })
  try { await authClient.signOut() } catch { /* best-effort */ }
  clearApiCache()
}
