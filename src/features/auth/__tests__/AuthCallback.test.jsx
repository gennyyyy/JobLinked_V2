import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AuthCallback from '../AuthCallback'
import { getProfile, provision } from '../../../shared/services/auth'

vi.mock('../../../shared/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

vi.mock('../../../shared/services/auth', () => ({
  getProfile: vi.fn(),
  provision: vi.fn(),
}))

const refreshUser = vi.fn()
vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ refreshUser }),
}))

import { supabase } from '../../../shared/lib/supabase'

const sessionFor = (id, meta = {}) => ({
  data: { session: { user: { id, email: `${id}@test.com`, user_metadata: meta } } },
  error: null,
})

function renderCallback() {
  return render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
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
    refreshUser.mockResolvedValue(undefined)
    supabase.auth.getSession.mockResolvedValue(sessionFor('u1'))
  })

  it('sends an employer to /employer instead of the job-seeker error', async () => {
    getProfile.mockResolvedValue({ id: 'u1', role: 'employer' })
    renderCallback()
    expect(await screen.findByText('employer home')).toBeInTheDocument()
    expect(screen.queryByText(/not a jobseeker account/i)).not.toBeInTheDocument()
  })

  it('sends a job-seeker to /job-seeker', async () => {
    getProfile.mockResolvedValue({ id: 'u1', role: 'job-seeker' })
    renderCallback()
    expect(await screen.findByText('seeker home')).toBeInTheDocument()
  })

  it('sends a super-admin to /super-admin', async () => {
    getProfile.mockResolvedValue({ id: 'u1', role: 'super-admin' })
    renderCallback()
    expect(await screen.findByText('admin home')).toBeInTheDocument()
  })

  it('provisions an unprovisioned account then routes by its role', async () => {
    getProfile.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'u1', role: 'employer' })
    supabase.auth.getSession.mockResolvedValue(sessionFor('u1', { role: 'employer' }))
    renderCallback()
    expect(await screen.findByText('employer home')).toBeInTheDocument()
    expect(provision).toHaveBeenCalledTimes(1)
  })

  it('shows the expired-link error when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    renderCallback()
    expect(await screen.findByText(/verification link is invalid or expired/i)).toBeInTheDocument()
  })

  it('shows an error when the role cannot be determined', async () => {
    getProfile.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'u1@test.com', user_metadata: { role: 'employer' } } } }, error: null })
    renderCallback()
    expect(await screen.findByText(/role could not be determined/i)).toBeInTheDocument()
  })
})
