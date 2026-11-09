import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ForgotPassword from '../ForgotPassword'
import { resetPassword } from '../../../shared/services/auth'

vi.mock('../../../shared/services/auth', () => ({
  resetPassword: vi.fn(),
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

beforeEach(() => {
  captcha.siteKey = ''
})

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
    expect(screen.getByRole('heading', { name: /back on track/i })).toBeInTheDocument()
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

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('jane@example.com', ''))
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

describe('ForgotPassword captcha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPassword.mockResolvedValue({})
    captcha.siteKey = 'site-key'
  })

  it('blocks the request until the challenge is solved', async () => {
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('forwards the solved token and demands a fresh one after a failure', async () => {
    resetPassword.mockRejectedValueOnce(new Error('too many requests'))
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('jane@example.com', 'captcha-token'))
    expect(await screen.findByText('too many requests')).toBeInTheDocument()

    // The token is single-use: a retry without a fresh challenge is blocked.
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(resetPassword).toHaveBeenCalledTimes(1)
  })

  it('keeps the success notice when the challenge was solved', async () => {
    renderForgot()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('jane@example.com', 'captcha-token'))
    expect(await screen.findByText(/check your email for reset instructions/i)).toBeInTheDocument()
  })
})
