import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../Login'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: vi.fn(),
}))

// The screens run the real service; the one seam below it is the BA client and
// the API layer.
vi.mock('../../../shared/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(), blob: vi.fn() },
  clearApiCache: vi.fn(),
  setApiIdentity: vi.fn(),
}))
vi.mock('../../../shared/lib/auth-client', async () => {
  const { authClientMock } = await import('../../../test/authClientMock')
  return { authClient: authClientMock }
})
vi.mock('../../../shared/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn(), updateUser: vi.fn() } },
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
import { api } from '../../../shared/lib/api'
import { authClientMock, resetAuthClient } from '../../../test/authClientMock'

beforeEach(() => {
  captcha.siteKey = ''
  vi.clearAllMocks()
  resetAuthClient()
})

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

const signsIn = (user = { id: '1', email: 'good@test.com' }) => {
  authClientMock.signIn.email.mockResolvedValue({ data: { user }, error: null })
  authClientMock.getSession.mockResolvedValue({ data: { user } })
  api.get.mockResolvedValue({ id: '1', role: 'employer' })
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
    authClientMock.signIn.email.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password', status: 401 },
    })
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'bad@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
  })

  it('asks an unverified account to verify its email', async () => {
    useAuth.mockReturnValue({ user: null })
    authClientMock.signIn.email.mockResolvedValue({
      data: null,
      error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified', status: 403 },
    })
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'new@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/verify your email address/i)).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /resend verification email/i }))
    await waitFor(() => expect(authClientMock.sendVerificationEmail).toHaveBeenCalledWith({
      email: 'new@test.com',
      callbackURL: `${window.location.origin}/auth/callback`,
    }))
  })

  it('seeds the auth provider before routing after a successful login', async () => {
    const authenticate = vi.fn()
    useAuth.mockReturnValue({ user: null, authenticate })
    signsIn()
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', role: 'employer' }),
    ))
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
    expect(authClientMock.signIn.email).not.toHaveBeenCalled()
  })

  it('forwards the solved token and demands a fresh one after a rejection', async () => {
    captcha.siteKey = 'site-key'
    useAuth.mockReturnValue({ user: null })
    authClientMock.signIn.email.mockResolvedValueOnce({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password', status: 401 },
    })
    renderLogin()

    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(authClientMock.signIn.email).toHaveBeenCalledWith({
      email: 'good@test.com',
      password: 'secret123',
      fetchOptions: { headers: { 'x-captcha-response': 'captcha-token' } },
    }))
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()

    // The token is single-use: a retry without a fresh challenge is blocked.
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(authClientMock.signIn.email).toHaveBeenCalledTimes(1)
  })
})
