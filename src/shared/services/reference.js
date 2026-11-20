import { api } from '@/shared/lib/api'

// One in-flight/finished read per category for the life of the page: every form
// mount reuses it instead of even paying the api client's 10 s GET cache. A
// failed read is dropped so a transient outage does not poison the picker.
const cache = new Map()

export function getReferenceValues(category) {
  if (!cache.has(category)) {
    const request = api.get(`reference/${category}`)
      .then((res) => res?.values ?? [])
    request.catch(() => cache.delete(category))
    cache.set(category, request)
  }
  return cache.get(category)
}
