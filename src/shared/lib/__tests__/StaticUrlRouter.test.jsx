import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import StaticUrlRouter, { restoredEntry } from '../StaticUrlRouter'

function Page({ name }) {
  return (
    <div>
      <h1>{name}</h1>
      <Link to={name === 'Home' ? '/second' : '/first'}>{name === 'Home' ? 'Go second' : 'Go first'}</Link>
    </div>
  )
}

function renderApp(entry = '/first') {
  return render(
    <StaticUrlRouter entry={entry}>
      <Routes>
        <Route path="/first" element={<Page name="Home" />} />
        <Route path="/second" element={<Page name="Second" />} />
        <Route path="/login" element={<Page name="Home" />} />
        <Route path="/reset-password" element={<Page name="Reset" />} />
      </Routes>
    </StaticUrlRouter>
  )
}

describe('StaticUrlRouter', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('renders the route for the entry path', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
  })

  it('navigates without touching the URL', async () => {
    const before = window.location.href
    renderApp()

    await userEvent.click(screen.getByRole('link', { name: /go second/i }))

    expect(screen.getByRole('heading', { name: 'Second' })).toBeInTheDocument()
    expect(window.location.href).toBe(before)
  })

  it('shows the app root instead of the page the tab was opened on', () => {
    window.history.replaceState(null, '', '/login')
    renderApp('/login')

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('keeps a one-time auth URL so a refresh can resume it', () => {
    window.history.replaceState(null, '', '/reset-password?code=x')
    renderApp('/reset-password?code=x')

    expect(screen.getByRole('heading', { name: 'Reset' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/reset-password')
    expect(window.location.search).toBe('?code=x')
  })
})

// A reload keeps the session (HttpOnly cookie + server-side session row), so
// the router must re-enter the page the tab was on — never `/`, which would be
// a PublicRoute and sign the user out (ADR-021). The route rides in
// history.state, which is per-history-entry: a fresh tab still has none.
function Path() {
  const { pathname } = useLocation()
  return <p>{pathname}</p>
}

function NavigateProbe({ to }) {
  const navigate = useNavigate()
  return (
    <>
      <Path />
      <button onClick={() => navigate(to)}>Go {to}</button>
    </>
  )
}

function renderRoutes(entry = '/') {
  return render(
    <StaticUrlRouter entry={entry}>
      <Routes>
        <Route path="/" element={<NavigateProbe to="/employer/jobs" />} />
        <Route path="/employer/jobs" element={<NavigateProbe to="/employer/applicants" />} />
        <Route path="/employer/applicants" element={<Path />} />
      </Routes>
    </StaticUrlRouter>,
  )
}

describe('StaticUrlRouter route restoration', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('push persists the route in history state', async () => {
    renderRoutes('/')

    await userEvent.click(screen.getByRole('button', { name: 'Go /employer/jobs' }))

    expect(window.history.state.joblinkedLocation).toEqual({
      pathname: '/employer/jobs',
      search: '',
      hash: '',
    })
  })

  it('restoredEntry returns the persisted route', async () => {
    renderRoutes('/')

    await userEvent.click(screen.getByRole('button', { name: 'Go /employer/jobs' }))

    expect(restoredEntry()).toBe('/employer/jobs')
  })

  // Tested directly on the App entry expression (exported for this pin): a
  // recovery fragment (ADR-055) must beat a stale stored route, and with no
  // fragment the stored route must beat the tab's frozen URL.
  it('recovery-style entry URL wins in App seeding', async () => {
    window.history.replaceState(
      { joblinkedLocation: { pathname: '/employer/jobs', search: '', hash: '' } },
      '',
      '/#access_token=x&type=recovery',
    )
    vi.resetModules()
    let app = await import('../../../App')
    expect(app.entryPath).toBe('/reset-password#access_token=x&type=recovery')

    window.history.replaceState(
      { joblinkedLocation: { pathname: '/employer/jobs', search: '', hash: '' } },
      '',
      '/',
    )
    vi.resetModules()
    app = await import('../../../App')
    expect(app.entryPath).toBe('/employer/jobs')
  })

  it('popstate restores a route after the stack is lost', async () => {
    const view = renderRoutes('/')
    const atRoot = window.history.state

    await userEvent.click(screen.getByRole('button', { name: 'Go /employer/jobs' }))
    const atJobs = window.history.state
    await userEvent.click(screen.getByRole('button', { name: 'Go /employer/applicants' }))
    const atApplicants = window.history.state

    // Reload at index 2 the way App.jsx seeds it: the fresh router starts on the
    // stored route, and the entry keeps its real index.
    view.unmount()
    renderRoutes(restoredEntry())
    expect(window.history.state).toEqual({
      joblinkedEntry: 2,
      joblinkedLocation: { pathname: '/employer/applicants', search: '', hash: '' },
    })

    // The in-memory stack is gone, so each entry restores its own stored route.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: atJobs }))
    })
    expect(screen.getByText('/employer/jobs')).toBeInTheDocument()

    // Index 0 of the tab's oldest entry must not be shadowed by the seed.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: atRoot }))
    })
    expect(screen.getByText('/')).toBeInTheDocument()

    // Forward again: every old entry keeps its own page.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: atJobs }))
    })
    expect(screen.getByText('/employer/jobs')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: atApplicants }))
    })
    expect(screen.getByText('/employer/applicants')).toBeInTheDocument()
  })

  it('restoredEntry returns null without stored state', () => {
    expect(restoredEntry()).toBe(null)
  })
})
