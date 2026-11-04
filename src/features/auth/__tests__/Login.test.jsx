import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: vi.fn(),
}))

vi.mock('../../../shared/services/auth', () => ({
  signIn: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { signIn } from '../../../shared/services/auth'

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login', () => {
  it('renders login form', () => {
    useAuth.mockReturnValue({ user: null })
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error on failed login', async () => {
    useAuth.mockReturnValue({ user: null })
    signIn.mockRejectedValue(new Error('Invalid login credentials'))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'bad@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument()
  })

  it('seeds the auth provider before routing after a successful login', async () => {
    const authenticate = vi.fn()
    useAuth.mockReturnValue({ user: null, authenticate })
    signIn.mockResolvedValue({ id: '1', role: 'employer' })
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(authenticate).toHaveBeenCalledWith(expect.objectContaining({ id: '1', role: 'employer' })))
  })

  it('does not redirect when user is already logged in', () => {
    useAuth.mockReturnValue({ user: { id: '1', role: 'employer' } })
    renderLogin()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })
})
