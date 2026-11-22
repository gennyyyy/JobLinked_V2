import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import ChangePassword from '../ChangePassword'
import { AuthContext } from '../../hooks/useAuth'
import { changePassword } from '../../services/auth'

vi.mock('../../services/auth', () => ({
  changePassword: vi.fn(),
}))

function fill(current, next, confirm) {
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: current } })
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: next } })
  fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: confirm } })
}

describe('ChangePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    changePassword.mockResolvedValue({})
  })

  it('renders the three password fields and submit button', () => {
    render(<ChangePassword />)
    expect(screen.getByText('Credentials')).toBeInTheDocument()
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
    const checklist = screen.getByRole('list', { name: /password requirements/i })
    expect(within(checklist).getByText('At least 8 characters')).toBeInTheDocument()
    expect(within(checklist).getByText('One letter')).toBeInTheDocument()
    expect(within(checklist).getByText('One number')).toBeInTheDocument()
    expect(within(checklist).getByText('One symbol (e.g. ! @ # $)')).toBeInTheDocument()
    expect(screen.queryByText(/including one letter, one number, and one symbol/i)).not.toBeInTheDocument()
  })

  it('shows the signed-in login email in a disabled field', () => {
    render(
      <AuthContext.Provider value={{ user: { email: 'maria@company.ph' } }}>
        <ChangePassword />
      </AuthContext.Provider>,
    )

    const email = screen.getByLabelText(/login email/i)
    expect(email).toBeDisabled()
    expect(email).toHaveValue('maria@company.ph')
    expect(screen.getByText('(read only)')).toBeVisible()
    expect(screen.getByText(/this is the email you use to sign in/i)).toBeVisible()
  })

  it('rejects a new password shorter than 8 characters', async () => {
    render(<ChangePassword />)
    fill('oldpass', 'short', 'short')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched new passwords', async () => {
    render(<ChangePassword />)
    fill('oldpass', 'password123!', 'password999!')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('New passwords do not match.')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('updates the password, shows a success notice and clears the fields', async () => {
    render(<ChangePassword />)
    fill('oldpass', 'password123!', 'password123!')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('oldpass', 'password123!'))
    expect(await screen.findByText('Password updated successfully.')).toBeInTheDocument()
    expect(screen.getByLabelText(/current password/i)).toHaveValue('')
  })

  it('shows an error when the change fails', async () => {
    changePassword.mockRejectedValue(new Error('Current password is incorrect.'))
    render(<ChangePassword />)
    fill('bad', 'password123!', 'password123!')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument()
  })

  // BA's change-password verifies the current password itself and is not a
  // captcha-protected endpoint (ADR-056 decision 6): no widget, no token, no
  // challenge to solve before the update.
  it('asks for no verification challenge before the update', async () => {
    render(<ChangePassword />)
    expect(screen.queryByRole('button', { name: /solve captcha/i })).not.toBeInTheDocument()

    fill('oldpass', 'password123!', 'password123!')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1))
    expect(changePassword.mock.calls[0]).toHaveLength(2)
  })
})
