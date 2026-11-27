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
// The route this history entry shows, stored beside its index so a reload can
// re-enter the page (the URL bar stays frozen, ADR-041). Module-private: App
// reads it only through restoredEntry().
const LOC_INDEX = 'joblinkedLocation'

// One-time auth flows keep their real URL: it carries the credential and must
// survive a mid-flow refresh. Every other entry (e.g. /login) is normalized to
// the app root, so the frozen bar never shows a page the visitor has left.
const TRANSIENT_ROOTS = ['/auth/callback', '/reset-password', '/accept-invite', '/complete-registration']

function isTransient(pathname) {
  return TRANSIENT_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))
}

function frozenHref() {
  return isTransient(window.location.pathname)
    ? window.location.href
    : new URL('/', window.location.origin).href
}

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

function stateOf(index, location) {
  return {
    [ENTRY_INDEX]: index,
    [LOC_INDEX]: { pathname: location.pathname, search: location.search, hash: location.hash },
  }
}

// The current entry's real index survives a reload. Entries before this one
// still carry theirs, so re-claiming 0 would shadow the tab's oldest page.
function enteredIndex() {
  const stored = window.history.state?.[ENTRY_INDEX]
  return Number.isInteger(stored) && stored >= 0 ? stored : 0
}

// The route of the entry this tab was reloaded on, or null when there is none
// (fresh tab, bookmark, or a history entry written by something else). A path,
// never a credential: the session is still restored by the server.
// eslint-disable-next-line react-refresh/only-export-components -- deliberate: this module also exports its state reader
export function restoredEntry() {
  const stored = window.history.state?.[LOC_INDEX]
  if (!stored || typeof stored.pathname !== 'string') return null
  return `${stored.pathname}${stored.search ?? ''}${stored.hash ?? ''}`
}

export default function StaticUrlRouter({ entry = '/', children }) {
  const initial = useMemo(() => locationOf(entry), [entry])
  const [startIndex] = useState(enteredIndex)
  const stack = useRef([])
  const index = useRef(startIndex)
  const [current, setCurrent] = useState({ location: initial, action: 'POP' })

  useLayoutEffect(() => {
    // Runs before any in-app navigation: seed the sparse stack at the entry's
    // real index (earlier entries rebuild from their own state when Back/Forward
    // reaches them), then point the seeded entry at the frozen URL without
    // changing the route the router already read from `entry`.
    stack.current[startIndex] = initial
    window.history.replaceState(stateOf(startIndex, initial), '', frozenHref())
  }, [initial, startIndex])

  useLayoutEffect(() => {
    function onPopState(event) {
      const raw = event.state?.[ENTRY_INDEX]
      const target = Number.isInteger(raw) ? raw : 0
      let location = stack.current[target]
      if (!location) {
        // The page reloaded: the stack this entry pointed into is gone, but the
        // entry itself still carries the route it showed. Memoize it (sparse;
        // the ref is never rendered) so going forward again also lands here.
        const stored = event.state?.[LOC_INDEX]
        if (!stored || typeof stored.pathname !== 'string') return
        location = {
          pathname: stored.pathname,
          search: stored.search ?? '',
          hash: stored.hash ?? '',
          state: null,
          key: `pop-${target}`,
        }
        stack.current[target] = location
      }
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
      window.history.pushState(stateOf(index.current, location), '', window.location.href)
      setCurrent({ location, action: 'PUSH' })
    },
    replace(to, state) {
      const location = locationOf(to, state ?? null)
      stack.current = [...stack.current.slice(0, index.current), location]
      index.current = stack.current.length - 1
      window.history.replaceState(stateOf(index.current, location), '', window.location.href)
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
