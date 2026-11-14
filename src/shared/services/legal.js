import { api } from '@/shared/lib/api'
import { PRIVACY_NOTICE, TERMS_OF_USE } from '@/shared/content/legal'

const FALLBACKS = { privacy: PRIVACY_NOTICE, terms: TERMS_OF_USE }
const cache = new Map()

export function getLegal(key) {
  if (cache.has(key)) return cache.get(key)
  const promise = api.get(`legal/${key}`)
    .then((res) => (res && typeof res.body === 'string' && res.body.trim() ? res.body : (FALLBACKS[key] || '')))
    .catch(() => FALLBACKS[key] || '')
  cache.set(key, promise)
  return promise
}

export function updateLegal(key, body) {
  return api.patch(`admin/legal/${key}`, { body })
}