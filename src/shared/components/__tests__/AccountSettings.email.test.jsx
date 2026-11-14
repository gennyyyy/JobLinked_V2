import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccountSettings from '../AccountSettings'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/account', () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}))
vi.mock('../../services/auth', () => ({
  changeEmail: vi.fn(),
  listMfaFactors: vi.fn().mockResolvedValue([]),
  enrollMfa: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  unenrollMfa: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getPreferences, updatePreferences } from '../../../shared/services/account'
import { changeEmail } from '../../services/auth'

describe('AccountSettings email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'super-admin', email: 'admin@example.com' } })
    getPreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    updatePreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    changeEmail.mockResolvedValue({})
  })

  it('renders the change-email form and submits', async () => {
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)
    await waitFor(() => expect(getPreferences).toHaveBeenCalled())

    expect(screen.getByText('Change email')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'oldpass' } })
    fireEvent.change(screen.getByLabelText(/new email/i), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /update email/i }))

    await waitFor(() => expect(changeEmail).toHaveBeenCalledWith('new@example.com', 'oldpass'))
    expect(await screen.findByRole('status')).toHaveTextContent(/check your inbox/i)
  })
})