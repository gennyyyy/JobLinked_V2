import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  sendSystemNotification: vi.fn(),
}))

vi.mock('../../../shared/services/notifications', () => ({
  listNotifications: vi.fn(),
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'u1', role: 'super-admin' } }),
}))

import { listNotifications } from '../../../shared/services/notifications'
import { sendSystemNotification } from '../../../shared/services/admin'
import Broadcast from '../Broadcast'

beforeEach(() => {
  vi.clearAllMocks()
  listNotifications.mockResolvedValue([])
  sendSystemNotification.mockResolvedValue({ sent: 3 })
})

describe('Broadcast', () => {
  it('opens the compose form from the Create announcement action', () => {
    render(<Broadcast />)
    fireEvent.click(screen.getByRole('button', { name: /create announcement/i }))
    expect(screen.getByRole('button', { name: /save notice/i })).toBeTruthy()
  })

  it('shows the published-notices empty state', async () => {
    render(<Broadcast />)
    expect(await screen.findByText('Make space for a useful update.')).toBeTruthy()
  })

  it('lists published notices and filters them by search', async () => {
    listNotifications.mockResolvedValue([
      { id: 'n1', type: 'system', title: 'Job fair', message: 'Saturday at the plaza', created_at: '2026-01-05T00:00:00.000Z' },
      { id: 'n2', type: 'system', title: 'Skills training', message: 'Sign up at PESO', created_at: '2026-01-06T00:00:00.000Z' },
      { id: 'n3', type: 'application', title: 'Not a notice', message: 'ignored' },
    ])
    render(<Broadcast />)
    expect(await screen.findByText('Job fair')).toBeInTheDocument()
    expect(screen.queryByText('Not a notice')).toBeNull()

    fireEvent.change(screen.getByPlaceholderText(/search announcements/i), { target: { value: 'skills' } })
    expect(screen.queryByText('Job fair')).toBeNull()
    expect(screen.getByText('Skills training')).toBeInTheDocument()
  })

  it('sends a broadcast and reports the recipient count', async () => {
    render(<Broadcast />)
    fireEvent.click(screen.getByRole('button', { name: /create announcement/i }))
    fireEvent.change(screen.getByLabelText(/announcement title/i), { target: { value: 'Job fair' } })
    fireEvent.change(screen.getByLabelText(/notice content/i), { target: { value: 'Saturday at the plaza' } })
    fireEvent.click(screen.getByRole('button', { name: /save notice/i }))

    expect(await screen.findByText('Broadcast sent to 3 user(s).')).toBeInTheDocument()
    expect(sendSystemNotification).toHaveBeenCalledWith({ title: 'Job fair', message: 'Saturday at the plaza', expires_at: null })
  })
})
