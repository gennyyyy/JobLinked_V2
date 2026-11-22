import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// The App module reads window.location at import time (ADR-055), so every test
// sets the entry URL first and then dynamically imports a fresh copy of it.
let auth

vi.mock('../shared/hooks/useAuth', () => ({ default: () => auth }))

vi.mock('../shared/lib/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}))

// The HTTP layer now opens the Better Auth client; the app shell is not under
// test here, so keep it on the shared session seam.
vi.mock('../shared/lib/auth-client', async () => {
  const { authClientMock } = await import('../test/authClientMock')
  return { authClient: authClientMock }
})

// The landing page is irrelevant here and heavy; every other route keeps its
// real component so the reset screen under test is the real one.
vi.mock('../shared/lib/routeLoaders', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    routeLoaders: {
      ...actual.routeLoaders,
      '/': () => Promise.resolve({ default: () => null }),
    },
  }
})

async function renderAppAt(url) {
  window.history.replaceState(null, '', url)
  const { default: App } = await import('../App')
  return render(<App />)
}

describe('App recovery entry', () => {
  beforeEach(() => {
    vi.resetModules()
    auth = { user: { id: 'u1' }, loading: false, logout: vi.fn() }
  })

  it('lands on the reset screen from a recovery fragment without signing out', async () => {
    await renderAppAt('/#access_token=x&type=recovery')

    // The fragment is no longer the credential (Better Auth emails ?token=…),
    // so the screen asks for a new link — but it is the reset screen, and the
    // tab's session is left alone (ADR-055's invariant).
    expect(await screen.findByRole('heading', { name: /reset link issue/i }, { timeout: 5000 })).toBeInTheDocument()
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('still signs out a signed-in visitor on an ordinary public visit', async () => {
    await renderAppAt('/')

    await waitFor(() => expect(auth.logout).toHaveBeenCalled())
  })
})
