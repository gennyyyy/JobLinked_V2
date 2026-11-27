import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SessionsPanel from '../SessionsPanel'
import { revokeAllSessions } from '../../services/account'

vi.mock('../../services/account', () => ({ revokeAllSessions: vi.fn() }))

describe('SessionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    revokeAllSessions.mockResolvedValue({})
  })

  it('renders the sessions card and sign-out button', () => {
    render(<SessionsPanel />)
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out all devices/i })).toBeInTheDocument()
  })

  it('revokes all sessions and shows the confirmation', async () => {
    render(<SessionsPanel />)
    fireEvent.click(screen.getByRole('button', { name: /sign out all devices/i }))

    await waitFor(() => expect(revokeAllSessions).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Signed out of all devices.')).toBeInTheDocument()
  })
})
