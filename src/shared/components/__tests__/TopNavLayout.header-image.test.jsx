import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../services/notifications', () => ({ listNotifications: vi.fn() }))
vi.mock('../../services/admin', () => ({ getStats: vi.fn() }))
// Keep the real logoUrl (public URL) but spy on the token-guarded seeker fetch.
vi.mock('../../services/images', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAvatarObjectUrl: vi.fn(),
}))
// Base UI's AvatarImage mounts only after the image loads, which jsdom never
// does; render the primitives plainly so the chosen src is observable.
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }) => <div>{children}</div>,
  AvatarImage: ({ src, alt }) => <img src={src} alt={alt} />,
  AvatarFallback: ({ children }) => <span>{children}</span>,
}))

import useAuth from '../../hooks/useAuth'
import { listNotifications } from '../../services/notifications'
import { fetchAvatarObjectUrl } from '../../services/images'
import TopNavLayout from '../TopNavLayout'

const renderNav = () => render(
  <MemoryRouter initialEntries={['/employer/dashboard']}>
    <TopNavLayout role="employer" />
  </MemoryRouter>,
)

describe('TopNavLayout employer header image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listNotifications.mockResolvedValue([])
    fetchAvatarObjectUrl.mockResolvedValue(null)
  })

  it('renders the company logo when the auth user has one', () => {
    useAuth.mockReturnValue({
      user: {
        id: 'emp-1',
        role: 'employer',
        full_name: 'Santa Maria Trading',
        has_logo: true,
        logo_updated_at: '2026-01-01T00:00:00.000Z',
      },
      logout: vi.fn(),
    })
    renderNav()

    const logo = screen.getByRole('img', { name: 'Company logo' })
    expect(logo.getAttribute('src')).toContain('/employers/emp-1/logo')
    // Employers never hit the seeker avatar endpoint.
    expect(fetchAvatarObjectUrl).not.toHaveBeenCalled()
  })

  it('falls back to initials for an employer without a logo', () => {
    useAuth.mockReturnValue({
      user: { id: 'emp-2', role: 'employer', full_name: 'Santa Maria Trading', has_logo: false },
      logout: vi.fn(),
    })
    renderNav()

    expect(screen.queryByRole('img', { name: 'Company logo' })).not.toBeInTheDocument()
    expect(screen.getByText('ST')).toBeInTheDocument()
    expect(fetchAvatarObjectUrl).not.toHaveBeenCalled()
  })
})
