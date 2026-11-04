import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Router } from 'react-router-dom'

// An in-memory router that still gives the browser Back/Forward buttons something
// to move through: every in-app navigation pushes a history entry whose URL is
// the *current* one, so the address bar never changes, and `popstate` maps the
// entry's index back to the page we stored for it.
//
// Trade-off (deliberate): the URL stays frozen, so pages are not bookmarkable or
// shareable. The router is seeded from the URL the tab was loaded with, so an
// emailed /auth/callback, /reset-password or /complete-registration?role=… link
// still lands on the right screen.
const ENTRY_INDEX = 'joblinkedEntry'

let seq = 0

function hrefOf(to) {
  if (typeof to === 'string') return to
  return `${to.pathname || '/'}${to.search || ''}${to.hash || ''}`
}

function locationOf(to, state = null) {
  const url = new URL(hrefOf(to), 'http://joblinked.local')
  seq += 1
  return {
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    state,
    key: `static-${seq}`,
  }
}

export default function StaticUrlRouter({ entry = '/', children }) {
  const initial = useMemo(() => locationOf(entry), [entry])
  const stack = useRef([initial])
  const index = useRef(0)
  const [current, setCurrent] = useState({ location: initial, action: 'POP' })

  useLayoutEffect(() => {
    function onPopState(event) {
      const raw = event.state?.[ENTRY_INDEX]
      const target = Number.isInteger(raw) ? raw : 0
      const location = stack.current[target]
      if (!location) return
      index.current = target
      setCurrent({ location, action: 'POP' })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigator = useMemo(() => ({
    createHref: hrefOf,
    push(to, state) {
      const location = locationOf(to, state ?? null)
      stack.current = [...stack.current.slice(0, index.current + 1), location]
      index.current = stack.current.length - 1
      // Same URL on purpose: a new entry, frozen address bar.
      window.history.pushState({ [ENTRY_INDEX]: index.current }, '', window.location.href)
      setCurrent({ location, action: 'PUSH' })
    },
    replace(to, state) {
      const location = locationOf(to, state ?? null)
      stack.current = [...stack.current.slice(0, index.current), location]
      index.current = stack.current.length - 1
      window.history.replaceState({ [ENTRY_INDEX]: index.current }, '', window.location.href)
      setCurrent({ location, action: 'REPLACE' })
    },
    go(delta) {
      window.history.go(delta)
    },
  }), [])

  return (
    <Router location={current.location} navigationType={current.action} navigator={navigator}>
      {children}
    </Router>
  )
}
