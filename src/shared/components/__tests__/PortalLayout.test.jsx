import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, default: vi.fn() }
})
vi.mock('../NotificationBell', () => ({ default: () => null }))

import useAuth from '../../hooks/useAuth'
import TopNavLayout from '../TopNavLayout'

const navItems = [
  { to: '/super-admin', label: 'Dashboard', end: true },
  { to: '/super-admin/users', label: 'Users' },
]

function renderLayout(path, extraProps = {}) {
  useAuth.mockReturnValue({ user: { id: 'u1', full_name: 'Super Admin' }, logout: vi.fn() })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopNavLayout
        navItems={navItems}
        badge="ADMIN"
        eyebrow="PESO"
        subhead="Super Admin"
        profileTo="/super-admin/profile"
        roleLabel="Super Admin"
        {...extraProps}
      />
    </MemoryRouter>,
  )
}

describe('Portal shell logo target', () => {
  it('derives the portal root from the pathname when no homeTo is passed', () => {
    renderLayout('/super-admin')
    const logo = screen.getByRole('link', { name: /joblinked home/i })
    expect(logo).toHaveAttribute('href', '/super-admin')
  })

  it('uses only the first path segment for nested portal routes', () => {
    renderLayout('/super-admin/users')
    const logo = screen.getByRole('link', { name: /joblinked home/i })
    expect(logo).toHaveAttribute('href', '/super-admin')
  })

  it('respects an explicit homeTo when provided', () => {
    renderLayout('/employer', { homeTo: '/employer/company', roleLabel: 'Employer' })
    const logo = screen.getByRole('link', { name: /joblinked home/i })
    expect(logo).toHaveAttribute('href', '/employer/company')
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

describe('Portal shell mobile navigation', () => {
  it('exposes the hamburger with an accessible name', () => {
    renderLayout('/super-admin')
    expect(screen.getByRole('button', { name: /open workspace navigation/i })).toBeInTheDocument()
  })

  it('labels the sidebar as a navigation landmark', () => {
    renderLayout('/super-admin')
    expect(screen.getByRole('navigation', { name: 'Super Admin navigation' })).toBeInTheDocument()
  })

  it('renders every nav item as a link', () => {
    renderLayout('/super-admin')
    const nav = screen.getByRole('navigation', { name: 'Super Admin navigation' })
    expect(nav).toHaveTextContent('Dashboard')
    expect(nav).toHaveTextContent('Users')
  })
})
