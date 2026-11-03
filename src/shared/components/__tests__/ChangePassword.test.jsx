import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChangePassword from '../ChangePassword'
import { changePassword } from '../../services/auth'

vi.mock('../../services/auth', () => ({
  changePassword: vi.fn(),
}))

function fill(current, next, confirm) {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } })
}

describe('ChangePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    changePassword.mockResolvedValue({})
  })

  it('renders the three password fields and submit button', () => {
    render(<ChangePassword />)
    expect(screen.getByRole('heading', { name: /change password/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Current password')).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
  })

  it('rejects a new password shorter than 8 characters', async () => {
    render(<ChangePassword />)
    fill('oldpass', 'short', 'short')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('New password must be at least 8 characters.')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched new passwords', async () => {
    render(<ChangePassword />)
    fill('oldpass', 'password123', 'password999')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('New passwords do not match.')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('updates the password, shows a success notice and clears the fields', async () => {
    render(<ChangePassword />)
    fill('oldpass', 'password123', 'password123')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('oldpass', 'password123'))
    expect(await screen.findByText('Password updated successfully.')).toBeInTheDocument()
    expect(screen.getByLabelText('Current password')).toHaveValue('')
  })

  it('shows an error when the change fails', async () => {
    changePassword.mockRejectedValue(new Error('wrong current password'))
    render(<ChangePassword />)
    fill('bad', 'password123', 'password123')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('wrong current password')).toBeInTheDocument()
  })
})
