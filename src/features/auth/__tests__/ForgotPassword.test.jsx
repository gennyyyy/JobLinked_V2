import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from '../ForgotPassword'

// The screen runs the real service against the shared BA client seam.
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

import { authClientMock, resetAuthClient } from '../../../test/authClientMock'

beforeEach(() => {
  captcha.siteKey = ''
  vi.clearAllMocks()
  resetAuthClient()
})

function renderForgot() {
  return render(<MemoryRouter><ForgotPassword /></MemoryRouter>)
}

describe('ForgotPassword', () => {
  it('renders the reset request form', () => {
    renderForgot()
    expect(screen.getByRole('heading', { name: /back on track/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('rejects a blank email without requesting a reset', async () => {
    // The input is type=email + required, which blocks a plain click on empty
    // input; dispatch submit directly to exercise the trim() guard.
    const { container } = renderForgot()
    fireEvent.submit(container.querySelector('form'))

    expect(await screen.findByText('Please enter your email address')).toBeInTheDocument()
    expect(authClientMock.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('sends the reset link and shows the success notice', async () => {
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(authClientMock.requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com' }),
    ))
    expect(authClientMock.requestPasswordReset.mock.calls[0][0].redirectTo)
      .toContain('/reset-password')
    expect(await screen.findByText(/check your email for reset instructions/i)).toBeInTheDocument()
  })

  it('shows an error when the reset request fails', async () => {
    authClientMock.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { message: 'Email delivery failed', status: 500 },
    })
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Email delivery failed')).toBeInTheDocument()
  })
})

// The server allows 3 sends per 60s per IP and the button mirrors that window.
// fireEvent + a flushed microtask keeps the click deterministic under the fake
// clock (findBy/waitFor would need real timers).
async function submitAndFlush() {
  fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
  await act(async () => {})
}

describe('ForgotPassword cooldown', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('holds the button for 60 seconds after a successful request', async () => {
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })

    await submitAndFlush()

    expect(screen.getByText(/check your email for reset instructions/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send again in 60s' })).toBeDisabled()

    act(() => { vi.advanceTimersByTime(1_000) })
    expect(screen.getByRole('button', { name: 'Send again in 59s' })).toBeDisabled()

    act(() => { vi.advanceTimersByTime(59_000) })
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeEnabled()
  })

  it('sends once when the form is submitted twice in the same tick', async () => {
    const { container } = renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    const form = container.querySelector('form')

    // Both submits land before React can re-render, so only the in-flight ref
    // (not the `busy` state) can stop the second request.
    await act(async () => {
      fireEvent.submit(form)
      fireEvent.submit(form)
    })

    expect(authClientMock.requestPasswordReset).toHaveBeenCalledTimes(1)
  })

  it('starts the cooldown on a server 429 and shows the friendly message', async () => {
    authClientMock.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { message: 'Too many requests', status: 429 },
    })
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })

    await submitAndFlush()

    expect(screen.getByRole('alert')).toHaveTextContent('Too many attempts. Please wait a moment and try again.')
    expect(screen.getByRole('button', { name: 'Send again in 60s' })).toBeDisabled()
    expect(authClientMock.requestPasswordReset).toHaveBeenCalledTimes(1)
  })
})

describe('ForgotPassword captcha', () => {
  beforeEach(() => {
    captcha.siteKey = 'site-key'
  })

  it('blocks the request until the challenge is solved', async () => {
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(authClientMock.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('sends the solved token in the captcha header and demands a fresh one after a failure', async () => {
    authClientMock.requestPasswordReset.mockResolvedValueOnce({
      data: null,
      error: { message: 'Email delivery failed', status: 500 },
    })
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(authClientMock.requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchOptions: { headers: { 'x-captcha-response': 'captcha-token' } },
      }),
    ))
    expect(await screen.findByText('Email delivery failed')).toBeInTheDocument()

    // The token is single-use: a retry without a fresh challenge is blocked.
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(authClientMock.requestPasswordReset).toHaveBeenCalledTimes(1)
  })

  it('keeps the success notice when the challenge was solved', async () => {
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(authClientMock.requestPasswordReset).toHaveBeenCalled())
    expect(await screen.findByText(/check your email for reset instructions/i)).toBeInTheDocument()
  })
})
