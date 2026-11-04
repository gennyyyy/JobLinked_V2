import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NOTIFICATIONS_CHANGED } from '../../utils/notificationEvents'

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
    expect(screen.getByRole('link', { name: 'Job seeker registration' })).toHaveAttribute('href', '/complete-registration?role=job-seeker')
    expect(screen.getByRole('link', { name: 'Employer registration' })).toHaveAttribute('href', '/complete-registration?role=employer')
  })

  it('returns to the portal after a successful notification refresh', async () => {
    listNotifications
      .mockReset()
      .mockRejectedValueOnce({ error: { code: 'FORBIDDEN', message: 'Account not provisioned' } })
      .mockResolvedValueOnce([])
    render(
      <MemoryRouter initialEntries={['/job-seeker']}>
        <TopNavLayout role="job-seeker" />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /complete your registration/i })).toBeInTheDocument()
    await act(async () => { window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)) })

    await waitFor(() => expect(listNotifications).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('heading', { name: /complete your registration/i })).not.toBeInTheDocument()
  })

  it('does not show recovery for other notification errors', async () => {
    listNotifications.mockReset().mockRejectedValueOnce({ error: { code: 'INTERNAL', message: 'boom' } })
    render(
      <MemoryRouter initialEntries={['/job-seeker']}>
        <TopNavLayout role="job-seeker" />
      </MemoryRouter>,
    )

    await waitFor(() => expect(listNotifications).toHaveBeenCalledTimes(1))
    await act(async () => { await Promise.resolve() })

    expect(screen.queryByRole('heading', { name: /complete your registration/i })).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Job Seeker navigation' })).toBeInTheDocument()
  })
})
