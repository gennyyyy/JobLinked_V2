import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccountSettings from '../AccountSettings'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/account', () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  deactivateAccount: vi.fn(),
}))
vi.mock('../../services/auth', () => ({
  changeEmail: vi.fn(),
  listMfaFactors: vi.fn().mockResolvedValue([]),
  enrollMfa: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  unenrollMfa: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getPreferences, updatePreferences, deactivateAccount } from '../../../shared/services/account'

describe('AccountSettings danger zone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'super-admin', email: 'admin@example.com' } })
    getPreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    updatePreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    deactivateAccount.mockResolvedValue(undefined)
    window.confirm = vi.fn(() => true)
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/', assign: vi.fn() },
      writable: true,
      configurable: true,
    })
  })

  it('deactivates account and redirects to /login', async () => {
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)
    await waitFor(() => expect(getPreferences).toHaveBeenCalled())

    expect(screen.getByText('Danger zone')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /deactivate account/i }))

    await waitFor(() => expect(deactivateAccount).toHaveBeenCalled())
    expect(window.location.assign).toHaveBeenCalledWith('/login')
  })
})