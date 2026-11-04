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

describe('Broadcast', () => {
  it('opens the compose form from the Create announcement action', () => {
    render(<Broadcast />)
    fireEvent.click(screen.getByRole('button', { name: /create announcement/i }))
    expect(screen.getByRole('button', { name: /send broadcast/i })).toBeTruthy()
  })

  it('shows the published-notices empty state', async () => {
    render(<Broadcast />)
    expect(await screen.findByText('No published notices yet.')).toBeTruthy()
  })
})
