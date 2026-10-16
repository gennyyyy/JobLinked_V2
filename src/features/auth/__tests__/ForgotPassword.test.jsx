import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from '../ForgotPassword'
import { resetPassword } from '../../../shared/services/auth'

vi.mock('../../../shared/services/auth', () => ({
  resetPassword: vi.fn(),
}))

function renderForgot() {
  return render(<MemoryRouter><ForgotPassword /></MemoryRouter>)
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPassword.mockResolvedValue({})
  })

  it('renders the reset request form', () => {
    renderForgot()
    expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('rejects a blank email without calling resetPassword', async () => {
    // The input is type=email + required, which blocks a plain click on empty
    // input; dispatch submit directly to exercise the trim() guard.
    const { container } = renderForgot()
    fireEvent.submit(container.querySelector('form'))

    expect(await screen.findByText('Please enter your email address')).toBeInTheDocument()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('sends the reset link and shows the success notice', async () => {
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('jane@example.com'))
    expect(await screen.findByText(/check your email for reset instructions/i)).toBeInTheDocument()
  })

  it('shows an error when the reset request fails', async () => {
    resetPassword.mockRejectedValue(new Error('too many requests'))
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('too many requests')).toBeInTheDocument()
  })
})
