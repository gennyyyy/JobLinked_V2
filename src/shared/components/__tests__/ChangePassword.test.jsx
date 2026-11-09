import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChangePassword from '../ChangePassword'
import { changePassword } from '../../services/auth'

vi.mock('../../services/auth', () => ({
  changePassword: vi.fn(),
}))

// Mutable site key: '' (the default) keeps every non-captcha test on today's
// behavior; 'site-key' makes useCaptcha().required true. The widget itself is
// replaced by a button that hands the form a token.
const captcha = vi.hoisted(() => ({ siteKey: '' }))

vi.mock('../../lib/turnstile', () => ({
  get TURNSTILE_SITE_KEY() { return captcha.siteKey },
  loadTurnstile: vi.fn(),
  renderTurnstile: vi.fn(),
  resetTurnstile: vi.fn(),
  removeTurnstile: vi.fn(),
}))

vi.mock('../../components/Turnstile', async () => {
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

function fill(current, next, confirm) {
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: current } })
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: next } })
  fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: confirm } })
}

describe('ChangePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    changePassword.mockResolvedValue({})
  })

  it('renders the three password fields and submit button', () => {
    render(<ChangePassword />)
    expect(screen.getByText('Password settings')).toBeInTheDocument()
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
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

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('oldpass', 'password123', ''))
    expect(await screen.findByText('Password updated successfully.')).toBeInTheDocument()
    expect(screen.getByLabelText(/current password/i)).toHaveValue('')
  })

  it('shows an error when the change fails', async () => {
    changePassword.mockRejectedValue(new Error('wrong current password'))
    render(<ChangePassword />)
    fill('bad', 'password123', 'password123')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('wrong current password')).toBeInTheDocument()
  })
})

describe('ChangePassword captcha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    changePassword.mockResolvedValue({})
    captcha.siteKey = 'site-key'
  })

  it('blocks the update until the challenge is solved', async () => {
    render(<ChangePassword />)
    fill('oldpass', 'password123', 'password123')
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('forwards the solved token and demands a fresh one after a failure', async () => {
    changePassword.mockRejectedValueOnce(new Error('wrong current password'))
    render(<ChangePassword />)
    fill('oldpass', 'password123', 'password123')
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('oldpass', 'password123', 'captcha-token'))
    expect(await screen.findByText('wrong current password')).toBeInTheDocument()

    // The token is single-use: a retry without a fresh challenge is blocked.
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(changePassword).toHaveBeenCalledTimes(1)
  })

  it('updates the password when the challenge was solved', async () => {
    render(<ChangePassword />)
    fill('oldpass', 'password123', 'password123')
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('oldpass', 'password123', 'captcha-token'))
    expect(await screen.findByText('Password updated successfully.')).toBeInTheDocument()
  })
})
