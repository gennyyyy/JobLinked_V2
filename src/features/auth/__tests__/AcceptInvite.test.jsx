import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../shared/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), updateUser: vi.fn() } },
}))

vi.mock('../../../shared/services/auth', () => ({
  getProfile: vi.fn(),
  provision: vi.fn(),
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ refreshUser: vi.fn() }),
}))

import { supabase } from '../../../shared/lib/supabase'
import { getProfile, provision } from '../../../shared/services/auth'
import AcceptInvite from '../AcceptInvite'

const session = {
  user: {
    id: 'u1',
    email: 'n@x.com',
    user_metadata: { role: 'employer', first_name: 'A', last_name: 'B', company_name: 'Acme' },
  },
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AcceptInvite />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null })
  supabase.auth.updateUser.mockResolvedValue({ error: null })
  getProfile.mockResolvedValue(null)
  provision.mockResolvedValue({ role: 'employer' })
})

describe('AcceptInvite', () => {
  it('provisions a missing profile, shows the form, and submits the new password', async () => {
    renderPage()

    await userEvent.type(await screen.findByLabelText('New Password'), 'password123')
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(provision).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'employer', email: 'n@x.com' })
    )
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'password123' })
  })

  it('does not provision when the profile already exists', async () => {
    getProfile.mockResolvedValue({ role: 'employer' })
    renderPage()

    expect(await screen.findByLabelText('New Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(provision).not.toHaveBeenCalled()
  })

  it('shows an error when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    renderPage()

    expect(await screen.findByText('This invite link is invalid or expired.')).toBeInTheDocument()
    expect(provision).not.toHaveBeenCalled()
  })
})
