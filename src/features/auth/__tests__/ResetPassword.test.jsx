import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ResetPassword from '../ResetPassword'
import { supabase } from '../../../shared/lib/supabase'

vi.mock('../../../shared/lib/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}))

function renderReset() {
  return render(<MemoryRouter><ResetPassword /></MemoryRouter>)
}

describe('ResetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.updateUser.mockResolvedValue({ error: null })
  })

  it('renders the new-password form', () => {
    renderReset()
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save new password/i })).toBeInTheDocument()
  })

  it('rejects passwords shorter than 8 characters', async () => {
    renderReset()
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords', async () => {
    renderReset()
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password999' } })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('updates the password and navigates on success', async () => {
    renderReset()
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'password123' }))
  })

  it('shows an error when the update fails', async () => {
    supabase.auth.updateUser.mockResolvedValue({ error: new Error('link expired') })
    renderReset()
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    expect(await screen.findByText('link expired')).toBeInTheDocument()
  })
})
