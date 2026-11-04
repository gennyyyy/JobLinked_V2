const KEY = 'joblinked.savedJobs'
const EVENT = 'joblinked:saved-jobs-changed'

export function getSavedJobIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function isJobSaved(id) {
  return getSavedJobIds().includes(id)
}

export function toggleSavedJob(id) {
  const current = getSavedJobIds()
  const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
  window.localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(EVENT))
  return next
}

export function subscribeSavedJobs(listener) {
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}
