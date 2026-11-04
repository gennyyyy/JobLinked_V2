import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../services/notifications', () => ({ listNotifications: vi.fn() }))
vi.mock('../../services/admin', () => ({ getStats: vi.fn().mockResolvedValue({ pendingAccreditations: 0 }) }))

import useAuth from '../../hooks/useAuth'
import { listNotifications } from '../../services/notifications'
import TopNavLayout from '../TopNavLayout'

describe('TopNavLayout unprovisioned recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', email: 'person@example.com' }, logout: vi.fn() })
    listNotifications.mockRejectedValue({
      error: { code: 'FORBIDDEN', message: 'Account not provisioned' },
    })
  })

  it('shows registration links when notification bootstrap says the account is unprovisioned', async () => {
    render(
      <MemoryRouter initialEntries={['/job-seeker']}>
        <TopNavLayout role="job-seeker" />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /complete your registration/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Job seeker registration' })).toHaveAttribute('href', '/register/job-seeker')
    expect(screen.getByRole('link', { name: 'Employer registration' })).toHaveAttribute('href', '/register/employer')
  })
})
