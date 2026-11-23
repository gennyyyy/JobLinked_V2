import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import VerificationResend from '../VerificationResend'

// The component runs the real service; the BA client is the seam.
vi.mock('../../../shared/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(), blob: vi.fn() },
  clearApiCache: vi.fn(),
  setApiIdentity: vi.fn(),
}))
vi.mock('../../../shared/lib/auth-client', async () => {
  const { authClientMock } = await import('../../../test/authClientMock')
  return { authClient: authClientMock }
})

import { authClientMock, resetAuthClient } from '../../../test/authClientMock'

beforeEach(() => {
  resetAuthClient()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// fireEvent + a flushed microtask keeps the click deterministic under the
// fake clock (userEvent would wait on timers this suite advances by hand).
async function clickResend() {
  fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' }))
  await act(async () => {})
}

describe('VerificationResend', () => {
  it('renders nothing without an address to send to', () => {
    const { container } = render(<VerificationResend email="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('sends the verification email to the given address', async () => {
    render(<VerificationResend email="new@test.com" />)

    await clickResend()

    expect(authClientMock.sendVerificationEmail).toHaveBeenCalledWith({
      email: 'new@test.com',
      callbackURL: `${window.location.origin}/auth/callback`,
    })
  })

  it('confirms the send and holds the button for 60 seconds', async () => {
    render(<VerificationResend email="new@test.com" />)

    await clickResend()

    expect(screen.getByRole('status')).toHaveTextContent('Verification email sent. Check your inbox.')
    expect(screen.getByRole('button', { name: 'Resend in 60s' })).toBeDisabled()

    act(() => { vi.advanceTimersByTime(60_000) })

    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeEnabled()
  })

  it('shows the failure and re-enables the button', async () => {
    authClientMock.sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { message: 'Too many requests', status: 429 },
    })
    render(<VerificationResend email="new@test.com" />)

    await clickResend()

    expect(screen.getByRole('alert')).toHaveTextContent('Too many attempts. Please wait a moment and try again.')
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeEnabled()
  })
})
