import { api } from '../lib/api'

export function getPreferences() {
  return api.get('account/preferences')
}

export function updatePreferences(patch) {
  return api.patch('account/preferences', patch)
}
