import { describe, it, expect, vi } from 'vitest'
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
