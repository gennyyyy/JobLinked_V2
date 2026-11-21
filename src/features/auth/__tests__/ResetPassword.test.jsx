import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ResetPassword from '../ResetPassword'

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

import { authClientMock, resetAuthClient } from '../../../test/authClientMock'

const renderReset = (url = '/reset-password?token=tok_1') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/login" element={<div>login page</div>} />
      <Route path="/forgot-password" element={<div>forgot page</div>} />
    </Routes>
  </MemoryRouter>,
)

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAuthClient()
  })

  it('renders the new-password form when the link carries a token', () => {
    renderReset()
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save new password/i })).toBeInTheDocument()
  })

  it('asks for a new link when there is no token', () => {
    renderReset('/reset-password')
    expect(screen.getByText('This reset link is invalid or expired. Request a new one.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
    expect(authClientMock.resetPassword).not.toHaveBeenCalled()
  })

  it('rejects passwords shorter than 8 characters', async () => {
    renderReset()
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(authClientMock.resetPassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords', async () => {
    renderReset()
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password999!' } })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(authClientMock.resetPassword).not.toHaveBeenCalled()
  })

  it('submits the emailed token with the new password and lands on the sign-in page', async () => {
    renderReset()
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    await waitFor(() => expect(authClientMock.resetPassword).toHaveBeenCalledWith({
      newPassword: 'password123!',
      token: 'tok_1',
    }))
    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('shows a clear error when the token expired', async () => {
    authClientMock.resetPassword.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'Invalid token', status: 400 },
    })
    renderReset()
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    expect(await screen.findByText('This link is invalid or expired. Request a new one.')).toBeInTheDocument()
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
  })
})
