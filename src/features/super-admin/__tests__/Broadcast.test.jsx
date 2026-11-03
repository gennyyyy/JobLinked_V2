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
import Broadcast from '../Broadcast'

beforeEach(() => {
  listNotifications.mockResolvedValue([])
})

describe('Broadcast tabs', () => {
  it('shows the compose form by default', () => {
    render(<Broadcast />)
    expect(screen.getByRole('button', { name: /send broadcast/i })).toBeTruthy()
  })

  it('shows the recent broadcasts empty state when the recent tab is selected', async () => {
    render(<Broadcast />)
    fireEvent.click(screen.getByRole('button', { name: /recent broadcasts/i }))
    expect(await screen.findByText('No system broadcasts yet.')).toBeTruthy()
  })
})
