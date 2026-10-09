import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../../hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../services/notifications', () => ({
  listNotifications: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}))
vi.mock('../NotificationsPage', () => ({
  SystemBadge: () => <span>System</span>,
  NotificationItem: ({ n, onMarkRead }) => (
    <div data-testid="shared-item">
      <span>{n.title}</span>
      <button onClick={() => onMarkRead(n.id)}>Mark read</button>
    </div>
  ),
}))

import useAuth from '../../hooks/useAuth'
import { listNotifications } from '../../services/notifications'
import NotificationBell from '../NotificationBell'

const fixture = [{ id: '1', title: 'Hello', message: 'World', type: 'info', is_read: false, created_at: '2026-01-01' }]

describe('NotificationBell reuse', () => {
  it('renders the shared NotificationItem for each notification', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1' } })
    listNotifications.mockResolvedValue(fixture)
    render(<NotificationBell />)
    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    // open the dropdown
    screen.getByLabelText('Notifications').click()
    expect(await screen.findByTestId('shared-item')).toHaveTextContent('Hello')
  })
})
