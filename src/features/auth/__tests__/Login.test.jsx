import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
      <Login portalKey="employer" />
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

  it('does not redirect when user is already logged in', () => {
    useAuth.mockReturnValue({ user: { id: '1', role: 'employer' } })
    renderLogin()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })
})
