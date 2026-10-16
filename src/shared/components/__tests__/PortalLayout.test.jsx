import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, default: vi.fn() }
})
vi.mock('../NotificationBell', () => ({ default: () => null }))
vi.mock('../SidebarAccount', () => ({ default: () => null }))

import useAuth from '../../hooks/useAuth'
import PortalLayout from '../PortalLayout'

const navItems = [{ to: '/super-admin', label: 'Dashboard', end: true }]

function renderLayout(path, extraProps = {}) {
  useAuth.mockReturnValue({ user: { id: 'u1' }, logout: vi.fn() })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PortalLayout
        navItems={navItems}
        badge="ADMIN"
        eyebrow="PESO"
        subhead="Super Admin"
        profileTo="/super-admin/profile"
        roleLabel="Super Admin"
        {...extraProps}
      />
    </MemoryRouter>
  )
}

const logoHrefs = () => screen.getAllByAltText('JobLinked').map((img) => img.closest('a'))

describe('PortalLayout logo target (U1)', () => {
  it('derives the portal root from the pathname when no homeTo is passed (super-admin)', () => {
    renderLayout('/super-admin')
    const links = logoHrefs()
    expect(links.length).toBeGreaterThan(0)
    links.forEach((a) => expect(a).toHaveAttribute('href', '/super-admin'))
  })

  it('uses only the first path segment for nested portal routes (employer)', () => {
    renderLayout('/employer/job-posts')
    logoHrefs().forEach((a) => expect(a).toHaveAttribute('href', '/employer'))
  })

  it('respects an explicit homeTo when provided', () => {
    renderLayout('/employer', { homeTo: '/employer/company' })
    logoHrefs().forEach((a) => expect(a).toHaveAttribute('href', '/employer/company'))
  })
})

describe('PortalLayout logo sizing (F2)', () => {
  it('reserves the 3:1 intrinsic ratio via width/height attributes', () => {
    renderLayout('/super-admin')
    screen.getAllByAltText('JobLinked').forEach((img) => {
      expect(img).toHaveAttribute('width', '480')
      expect(img).toHaveAttribute('height', '160')
    })
  })
})

describe('PortalLayout AFK modal button order (U6)', () => {
  it('keeps the primary "Stay Signed In" action on the right', () => {
    vi.useFakeTimers()
    try {
      renderLayout('/super-admin')
      act(() => { vi.advanceTimersByTime(4 * 60 * 1000) })
      const stay = screen.getByRole('button', { name: /stay signed in/i })
      const out = screen.getByRole('button', { name: /sign out/i })
      // Primary must come after the secondary "Sign Out" in DOM order.
      expect(stay.compareDocumentPosition(out) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('PortalLayout mobile nav disclosure (A11y)', () => {
  it('exposes the hamburger with aria-expanded and points it at the nav landmark', () => {
    renderLayout('/super-admin')
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('aria-controls', 'portal-mobile-nav')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('labels the sidebar as a navigation landmark', () => {
    renderLayout('/super-admin')
    expect(screen.getByRole('navigation', { name: 'Portal navigation' })).toBeInTheDocument()
  })
})
