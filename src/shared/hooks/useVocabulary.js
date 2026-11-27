import { useCallback, useEffect, useState } from 'react'
import { getReferenceValues } from '../services/reference'

// One in-flight read per category shared by every mounted picker, so two forms
// opening together make one request. Resolved values live for the session;
// a failed read is evicted so Retry can fetch again.
const pending = new Map()

function load(category) {
  if (!pending.has(category)) {
    const request = getReferenceValues(category)
    request.catch(() => pending.delete(category))
    pending.set(category, request)
  }
  return pending.get(category)
}

// Controlled vocabulary for one reference_data category (job_field / skill):
//   const { values, loading, error, reload } = useVocabulary('skill')
// Pass `false` as the second argument for a picker that supplies its own static
// options, so it never fetches and reports an empty, settled list.
// State is keyed by category + attempt, so a stale response from a previous
// category or a before-retry mount is ignored instead of flashing old values.
export function useVocabulary(category, enabled = true) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ key: '', values: [], loading: true, error: '' })
  const key = `${category}#${attempt}`
  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    load(category).then(
      (values) => {
        if (alive) setState({ key, values: Array.isArray(values) ? values : [], loading: false, error: '' })
      },
      (error) => {
        if (alive) setState({ key, values: [], loading: false, error: error?.message || 'Could not load the options.' })
      },
    )
    return () => { alive = false }
  }, [category, key, enabled])

  if (!enabled) return { values: [], loading: false, error: '', reload }
  const current = state.key === key ? state : { values: [], loading: true, error: '' }
  return { ...current, reload }
}

export default useVocabulary
