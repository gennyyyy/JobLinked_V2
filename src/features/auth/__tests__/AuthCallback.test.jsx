import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import AuthCallback from '../AuthCallback'

// Real service + shared client seam; the API layer answers /auth/me.
vi.mock('../../../shared/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(), blob: vi.fn() },
  clearApiCache: vi.fn(),
  setApiIdentity: vi.fn(),
}))
vi.mock('../../../shared/lib/auth-client', async () => {
  const { authClientMock } = await import('../../../test/authClientMock')
  return { authClient: authClientMock }
})
vi.mock('../../../shared/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn(), updateUser: vi.fn() } },
}))

const refreshUser = vi.fn()
vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ refreshUser }),
}))

import { api } from '../../../shared/lib/api'
import { authClientMock, resetAuthClient } from '../../../test/authClientMock'

const sessionFor = (id = 'u1') => ({ data: { user: { id, email: `${id}@test.com` } } })

function ExpiredStub() {
  const { search } = useLocation()
  return <div>link expired {search}</div>
}

function renderCallback(entry = '/auth/callback') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/link-expired" element={<ExpiredStub />} />
        <Route path="/complete-registration" element={<div>complete registration</div>} />
        <Route path="/employer" element={<div>employer home</div>} />
        <Route path="/job-seeker" element={<div>seeker home</div>} />
        <Route path="/super-admin" element={<div>admin home</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AuthCallback role routing (B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAuthClient()
    refreshUser.mockResolvedValue(undefined)
    authClientMock.getSession.mockResolvedValue(sessionFor('u1'))
  })

  it('sends an employer to /employer instead of the job-seeker error', async () => {
    api.get.mockResolvedValue({ id: 'u1', role: 'employer' })
    renderCallback()
    expect(await screen.findByText('employer home')).toBeInTheDocument()
    expect(screen.queryByText(/not a jobseeker account/i)).not.toBeInTheDocument()
    expect(refreshUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }))
  })

  it('sends a job-seeker to /job-seeker', async () => {
    api.get.mockResolvedValue({ id: 'u1', role: 'job-seeker' })
    renderCallback()
    expect(await screen.findByText('seeker home')).toBeInTheDocument()
  })

  it('sends a super-admin to /super-admin', async () => {
    api.get.mockResolvedValue({ id: 'u1', role: 'super-admin' })
    renderCallback()
    expect(await screen.findByText('admin home')).toBeInTheDocument()
  })

  it('routes a session without a role row to the recovery page (pending profile is claimed there)', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('Account not provisioned'), { status: 403 }))
    renderCallback()
    expect(await screen.findByText('complete registration')).toBeInTheDocument()
  })

  it('shows the verified state with a sign-in link when BA already verified without a session', async () => {
    authClientMock.getSession.mockResolvedValue({ data: null })
    renderCallback()
    expect(await screen.findByText(/you can now sign in/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to sign in/i })).toHaveAttribute('href', '/login')
  })

  it('verifies a token that arrives directly on this route', async () => {
    authClientMock.getSession.mockResolvedValue({ data: null })
    renderCallback('/auth/callback?token=tok_email')

    expect(await screen.findByText(/you can now sign in/i)).toBeInTheDocument()
    expect(authClientMock.verifyEmail).toHaveBeenCalledWith({ query: { token: 'tok_email' } })
  })

  it('redirects to the expired-link page when BA rejects the token', async () => {
    authClientMock.getSession.mockResolvedValue({ data: null })
    renderCallback('/auth/callback?error=INVALID_TOKEN')

    expect(await screen.findByText('link expired ?type=verify')).toBeInTheDocument()
    expect(authClientMock.verifyEmail).not.toHaveBeenCalled()
  })

  it('redirects to the expired-link page when the token does not verify', async () => {
    authClientMock.verifyEmail.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'Invalid token', status: 400 },
    })
    renderCallback('/auth/callback?token=tok_stale')

    expect(await screen.findByText('link expired ?type=verify')).toBeInTheDocument()
    expect(authClientMock.verifyEmail).toHaveBeenCalledWith({ query: { token: 'tok_stale' } })
  })
})
