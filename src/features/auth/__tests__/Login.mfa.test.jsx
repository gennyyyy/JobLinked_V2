import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Login from '../Login'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))

vi.mock('../../../shared/services/auth', () => ({
  signIn: vi.fn(),
  listMfaFactors: vi.fn(),
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

vi.mock('../../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
      },
      signOut: vi.fn(),
    },
  },
}))

import useAuth from '../../../shared/hooks/useAuth'
import { signIn, listMfaFactors } from '../../../shared/services/auth'
import { supabase } from '../../../shared/lib/supabase'

beforeEach(() => {
  captcha.siteKey = ''
  vi.clearAllMocks()
  const authenticate = vi.fn()
  useAuth.mockReturnValue({ user: null, authenticate })
  signIn.mockResolvedValue({ id: '1', role: 'employer' })
  listMfaFactors.mockResolvedValue([{ id: 'factor-1', status: 'verified' }])
  supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' } })
  supabase.auth.mfa.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
  supabase.auth.mfa.verify.mockResolvedValue({ data: {}, error: null })
  supabase.auth.signOut.mockResolvedValue({})
})

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/employer" element={<div>employer home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Login MFA', () => {
  it('shows the code step when a verified factor exists and does not navigate', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument()
    expect(screen.queryByText('employer home')).not.toBeInTheDocument()
  })

  it('calls verify with the code and navigates on success', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    const input = await screen.findByLabelText(/verification code/i)
    await userEvent.type(input, '123456')
    await userEvent.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => expect(supabase.auth.mfa.verify).toHaveBeenCalledWith(expect.objectContaining({
      factorId: 'factor-1',
      challengeId: 'challenge-1',
      code: '123456',
    })))
    expect(await screen.findByText('employer home')).toBeInTheDocument()
  })

  it('shows an error and stays on the code step for an invalid code', async () => {
    supabase.auth.mfa.verify.mockResolvedValue({ data: null, error: new Error('Invalid code') })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    const input = await screen.findByLabelText(/verification code/i)
    await userEvent.type(input, '000000')
    await userEvent.click(screen.getByRole('button', { name: /verify/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid code/i)
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
  })

  it('signs out and returns to the password step on cancel', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'good@test.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByLabelText(/verification code/i)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalled())
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })
})