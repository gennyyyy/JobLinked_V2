import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Login from '../Login'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))

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
  return { default: ({ onToken }) => createElement('button', { type: 'button', onClick: () => onToken('captcha-token') }, 'solve captcha') }
})

import useAuth from '../../../shared/hooks/useAuth'
import { api } from '../../../shared/lib/api'
import { authClientMock, resetAuthClient } from '../../../test/authClientMock'
import { stashApplyIntent } from '../../../shared/lib/applyIntent'

beforeEach(() => {
  captcha.siteKey = ''
  vi.clearAllMocks()
  resetAuthClient()
  const authenticate = vi.fn()
  useAuth.mockReturnValue({ user: null, authenticate })
  authClientMock.signIn.email.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  authClientMock.getSession.mockResolvedValue({ data: { user: { id: 'u1', email: 'good@test.com' } } })
  api.get.mockResolvedValue({ id: 'u1', role: 'employer' })
})

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/employer" element={<div>employer home</div>} />
        <Route path="/job-seeker/jobs/42" element={<div>seeker job page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Login MFA', () => {
  it('shows the code step when BA answers twoFactorRedirect and does not navigate', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] },
      error: null,
    })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument()
    expect(screen.queryByText('employer home')).not.toBeInTheDocument()
    // No session exists until the code step, so no profile read either.
    expect(api.get).not.toHaveBeenCalled()
  })

  it('verifies the code, resolves the profile, and navigates to the portal', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] },
      error: null,
    })
    authClientMock.twoFactor.verifyTotp.mockResolvedValue({ data: { token: 'session' }, error: null })
    const authenticate = vi.fn()
    useAuth.mockReturnValue({ user: null, authenticate })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    const input = await screen.findByLabelText(/verification code/i)
    await userEvent.type(input, '123456')
    await userEvent.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => expect(authClientMock.twoFactor.verifyTotp).toHaveBeenCalledWith({ code: '123456' }))
    await waitFor(() => expect(authenticate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', role: 'employer' }),
    ))
    expect(await screen.findByText('employer home')).toBeInTheDocument()
  })

  it('shows an error and stays on the code step for an invalid code', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] },
      error: null,
    })
    authClientMock.twoFactor.verifyTotp.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_CODE', message: 'Invalid code', status: 401 },
    })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    const input = await screen.findByLabelText(/verification code/i)
    await userEvent.type(input, '000000')
    await userEvent.click(screen.getByRole('button', { name: /verify/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid code/i)
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
    expect(screen.queryByText('employer home')).not.toBeInTheDocument()
  })

  it('signs out and returns to the password step on cancel', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] },
      error: null,
    })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByLabelText(/verification code/i)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => expect(authClientMock.signOut).toHaveBeenCalled())
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('lands a job-seeker on the job page after MFA sign-in', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] },
      error: null,
    })
    authClientMock.twoFactor.verifyTotp.mockResolvedValue({ data: { token: 'session' }, error: null })
    api.get.mockResolvedValue({ id: 'u1', role: 'job-seeker' })
    stashApplyIntent('42')
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    const input = await screen.findByLabelText(/verification code/i)
    await userEvent.type(input, '123456')
    await userEvent.click(screen.getByRole('button', { name: /verify/i }))
    expect(await screen.findByText('seeker job page')).toBeInTheDocument()
  })
})
