import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// Mutable site key: '' (the default) keeps every non-captcha test on today's
// behavior; 'site-key' makes useCaptcha().required true. The widget itself is
// replaced by a button that hands the form a token.
const captcha = vi.hoisted(() => ({ siteKey: '' }))

vi.mock('../../../shared/lib/turnstile', () => ({
  get TURNSTILE_SITE_KEY() { return captcha.siteKey },
  loadTurnstile: vi.fn(),
  renderTurnstile: vi.fn(),
  resetTurnstile: vi.fn(),
  removeTurnstile: vi.fn(),
}))

vi.mock('../../../shared/components/Turnstile', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ onToken }) => createElement(
      'button',
      { type: 'button', onClick: () => onToken('captcha-token') },
      'solve captcha',
    ),
  }
})

import useAuth from '../../../shared/hooks/useAuth'
import { signIn } from '../../../shared/services/auth'

beforeEach(() => {
  captcha.siteKey = ''
  signIn.mockClear()
})

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

describe('Login captcha', () => {
  it('blocks submit until the verification challenge is solved', async () => {
    captcha.siteKey = 'site-key'
    useAuth.mockReturnValue({ user: null })
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('forwards the solved token and demands a fresh one after a rejection', async () => {
    captcha.siteKey = 'site-key'
    useAuth.mockReturnValue({ user: null })
    signIn.mockRejectedValueOnce(new Error('Invalid login credentials'))
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('good@test.com', 'secret123', 'captcha-token'))
    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument()

    // The token is single-use: a retry without a fresh challenge is blocked.
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(signIn).toHaveBeenCalledTimes(1)
  })
})
