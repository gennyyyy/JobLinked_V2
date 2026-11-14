import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmailChangePanel from '../EmailChangePanel'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../services/auth', () => ({
  changeEmail: vi.fn(),
  listMfaFactors: vi.fn().mockResolvedValue([]),
  enrollMfa: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  unenrollMfa: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { changeEmail } from '../../services/auth'

describe('AccountSettings email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'super-admin', email: 'admin@example.com' } })
    changeEmail.mockResolvedValue({})
  })

  it('renders the change-email form and submits', async () => {
    render(<MemoryRouter><EmailChangePanel /></MemoryRouter>)

    expect(screen.getByText('Change email')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'oldpass' } })
    fireEvent.change(screen.getByLabelText(/new email/i), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /update email/i }))

    await waitFor(() => expect(changeEmail).toHaveBeenCalledWith('new@example.com', 'oldpass'))
    expect(await screen.findByRole('status')).toHaveTextContent(/check your inbox/i)
  })
})