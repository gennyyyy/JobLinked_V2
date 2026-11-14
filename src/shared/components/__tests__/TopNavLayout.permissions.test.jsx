import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../services/notifications', () => ({ listNotifications: vi.fn() }))
vi.mock('../../services/admin', () => ({ getStats: vi.fn() }))

import useAuth from '../../hooks/useAuth'
import { listNotifications } from '../../services/notifications'
import { getStats } from '../../services/admin'
import TopNavLayout from '../TopNavLayout'

const renderNav = () => render(
  <MemoryRouter initialEntries={['/super-admin']}>
    <TopNavLayout role="super-admin" />
  </MemoryRouter>,
)

describe('TopNavLayout super-admin permission display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listNotifications.mockResolvedValue([])
    getStats.mockResolvedValue({ pendingAccreditations: 0 })
  })

  // Version skew: an API older than ADR-042 omits `permissions`. The account
  // is still the break-glass full admin, so the menu must not hide pages.
  it('treats a missing permissions field as a full administrator', () => {
    useAuth.mockReturnValue({
      user: { id: 'a1', role: 'super-admin', full_name: 'PESO Admin', email: 'admin@x.com' },
      logout: vi.fn(),
    })
    renderNav()

    expect(screen.getByText('Full administrator')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'System settings' })).toBeInTheDocument()
  })

  it('labels a tagged admin as a custom role and hides unheld pages', () => {
    useAuth.mockReturnValue({
      user: { id: 'a1', role: 'super-admin', full_name: 'PESO Admin', email: 'admin@x.com', permissions: [] },
      logout: vi.fn(),
    })
    renderNav()

    expect(screen.getByText('Custom role')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'System settings' })).toBeNull()
  })
})
