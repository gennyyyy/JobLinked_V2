import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../services/notifications', () => ({
  listNotifications: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}))

import useAuth from '../../hooks/useAuth'
import { listNotifications } from '../../services/notifications'
import NotificationBell from '../NotificationBell'

const fixture = [{ id: '1', title: 'Hello', message: 'World', type: 'info', is_read: false, created_at: '2026-01-01' }]

describe('NotificationBell link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('links to the portal notification history with the unread count', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue(fixture)
    render(<MemoryRouter><NotificationBell /></MemoryRouter>)
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const link = await screen.findByRole('link', { name: 'Notifications (1 unread)' })
    expect(link).toHaveAttribute('href', '/employer/notifications')
    expect(link).toHaveTextContent('1')
  })

  it('renders without a badge when everything is read', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue([{ ...fixture[0], is_read: true }])
    render(<MemoryRouter><NotificationBell /></MemoryRouter>)
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const link = await screen.findByRole('link', { name: 'Notifications' })
    expect(link).toHaveAttribute('href', '/employer/notifications')
    expect(link).not.toHaveTextContent('1')
  })
})

describe('NotificationBell roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('links job-seekers to their notification history', async () => {
    useAuth.mockReturnValue({ user: { id: 'u2', role: 'job-seeker' } })
    listNotifications.mockResolvedValue(fixture)
    render(<MemoryRouter><NotificationBell /></MemoryRouter>)
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const link = await screen.findByRole('link', { name: 'Notifications (1 unread)' })
    expect(link).toHaveAttribute('href', '/job-seeker/notifications')
  })

  it('links super-admins to their notification history', async () => {
    useAuth.mockReturnValue({ user: { id: 'a1', role: 'super-admin' } })
    listNotifications.mockResolvedValue(fixture)
    render(<MemoryRouter><NotificationBell /></MemoryRouter>)
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const link = await screen.findByRole('link', { name: 'Notifications (1 unread)' })
    expect(link).toHaveAttribute('href', '/super-admin/notifications')
  })
})

describe('NotificationBell states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing and fetches nothing when logged out', async () => {
    useAuth.mockReturnValue({ user: null })
    const { container } = render(<MemoryRouter><NotificationBell /></MemoryRouter>)
    expect(container.firstChild).toBeNull()
    expect(listNotifications).not.toHaveBeenCalled()
  })

  it('shows no badge when the fetch fails', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockRejectedValue(new Error('down'))
    render(<MemoryRouter><NotificationBell /></MemoryRouter>)
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const link = await screen.findByRole('link', { name: 'Notifications' })
    expect(link).toHaveAttribute('href', '/employer/notifications')
  })

  it('caps the badge at 9+ past nine unread', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ ...fixture[0], id: `n${i}` })),
    )
    render(<MemoryRouter><NotificationBell /></MemoryRouter>)
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const link = await screen.findByRole('link', { name: 'Notifications (12 unread)' })
    expect(link).toHaveTextContent('9+')
  })

  it('counts only unread notifications', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'employer' } })
    listNotifications.mockResolvedValue([
      { ...fixture[0], id: 'n1', is_read: false },
      { ...fixture[0], id: 'n2', is_read: false },
      { ...fixture[0], id: 'n3', is_read: true },
    ])
    render(<MemoryRouter><NotificationBell /></MemoryRouter>)
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    const link = await screen.findByRole('link', { name: 'Notifications (2 unread)' })
    expect(link).toHaveTextContent('2')
  })
})
