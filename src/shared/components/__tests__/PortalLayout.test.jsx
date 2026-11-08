import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, default: vi.fn() }
})
vi.mock('../NotificationBell', () => ({ default: () => null }))
vi.mock('../../services/notifications', () => ({ listNotifications: vi.fn().mockResolvedValue([]) }))
vi.mock('../../services/admin', () => ({ getStats: vi.fn().mockResolvedValue({ pendingAccreditations: 0 }) }))

import useAuth from '../../hooks/useAuth'
import TopNavLayout from '../TopNavLayout'

function renderLayout(path, props = {}) {
  useAuth.mockReturnValue({ user: { id: 'u1', full_name: 'Gabriel Mendoza' }, logout: vi.fn() })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopNavLayout role="super-admin" profileTo="/super-admin/profile" roleLabel="PESO Admin" homeTo="/super-admin" {...props} />
    </MemoryRouter>,
  )
}

describe('Portal shell logo target', () => {
  it('links the logo to the public home like the reference shell', () => {
    renderLayout('/super-admin')
    expect(screen.getByRole('link', { name: /joblinked home/i })).toHaveAttribute('href', '/')
  })
})

describe('Portal shell AFK modal button order', () => {
  it('keeps the primary "Stay Signed In" action on the right', () => {
    vi.useFakeTimers()
    try {
      renderLayout('/super-admin')
      act(() => { vi.advanceTimersByTime(4 * 60 * 1000) })
      const stay = screen.getByRole('button', { name: /stay signed in/i })
      const out = screen.getByRole('button', { name: /sign out/i })
      expect(stay.compareDocumentPosition(out) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Portal shell dashboard footer', () => {
  it('renders the minimal footer on every portal page through the shared layout', () => {
    renderLayout('/super-admin')
    expect(screen.getByText('JobLinked · Santa Maria, Bulacan')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy Notice' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  })
})

describe('Portal shell navigation', () => {
  beforeEach(() => vi.clearAllMocks())
  it('renders the reference admin navigation landmark and items', () => {
    renderLayout('/super-admin')
    const nav = screen.getByRole('navigation', { name: 'PESO Admin navigation' })
    expect(nav).toHaveTextContent('Overview')
    expect(nav).toHaveTextContent('User management')
    expect(nav).toHaveTextContent('System settings')
  })

  it('exposes the hamburger with an accessible name', () => {
    renderLayout('/super-admin')
    expect(screen.getByRole('button', { name: /open workspace navigation/i })).toBeInTheDocument()
  })

  it('shows the role workspace badge', () => {
    renderLayout('/super-admin')
    expect(screen.getByText(/PESO Admin workspace/i)).toBeInTheDocument()
  })

  it('centers the shield logo when collapsed', () => {
    renderLayout('/super-admin')
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i })
    fireEvent.click(collapseBtn)
    const shieldContainer = screen.getByRole('navigation', { name: /PESO Admin navigation/i }).previousElementSibling
    expect(shieldContainer).toHaveClass('justify-center')
  })

  it('fetches notifications and admin stats once, even after navigating', async () => {
    const { listNotifications } = await import('../../services/notifications')
    const { getStats } = await import('../../services/admin')
    renderLayout('/super-admin')
    await act(async () => {})
    expect(listNotifications).toHaveBeenCalledTimes(1)
    expect(getStats).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('link', { name: /user management/i }))
    await act(async () => {})
    expect(listNotifications).toHaveBeenCalledTimes(1)
    expect(getStats).toHaveBeenCalledTimes(1)
  })
})

describe('Portal shell help widget', () => {
  it('renders the help chat once for a signed-in user', () => {
    renderLayout('/super-admin')
    expect(screen.getAllByRole('button', { name: 'Open help chat' })).toHaveLength(1)
  })

  it('hides the help chat when no user is signed in', () => {
    useAuth.mockReturnValue({ user: null, logout: vi.fn() })
    render(
      <MemoryRouter initialEntries={['/super-admin']}>
        <TopNavLayout role="super-admin" />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Open help chat' })).toBeNull()
  })

  it('hides the help chat for a signed-in but unprovisioned user', () => {
    useAuth.mockReturnValue({ user: { id: 'u1', full_name: 'Someone' }, needsProvisioning: true, logout: vi.fn() })
    render(
      <MemoryRouter initialEntries={['/super-admin']}>
        <TopNavLayout role="super-admin" />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Open help chat' })).toBeNull()
  })
})
