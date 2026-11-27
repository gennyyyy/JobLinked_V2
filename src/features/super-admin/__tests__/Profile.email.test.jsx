import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Profile from '../Profile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({
  updateProfile: vi.fn(),
  changeEmail: vi.fn(),
  listMfaFactors: vi.fn(),
  enrollMfa: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  unenrollMfa: vi.fn(),
}))
vi.mock('../../../shared/services/account', () => ({
  revokeAllSessions: vi.fn(),
  getPreferences: vi.fn().mockResolvedValue({ application_updates: true, community_announcements: true }),
  updatePreferences: vi.fn(),
  exportAccount: vi.fn(),
}))
vi.mock('../../../shared/components/ChangePassword', () => ({ default: () => <div>ChangePassword</div> }))

import useAuth from '../../../shared/hooks/useAuth'
import { updateProfile, listMfaFactors } from '../../../shared/services/auth'


describe('super-admin Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'a1', full_name: 'Admin User', email: 'admin@example.com' }, refreshUser: vi.fn() })
    updateProfile.mockResolvedValue({})
    listMfaFactors.mockResolvedValue([])
  })

  it('renders the email field as read-only', () => {
    render(<MemoryRouter><Profile /></MemoryRouter>)
    const email = screen.getByLabelText(/email address/i)
    expect(email).toHaveValue('admin@example.com')
    expect(email.readOnly).toBe(true)
  })

  it('submitting updates only full_name', async () => {
    render(<MemoryRouter><Profile /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('a1', { full_name: 'New Name' })
    expect(updateProfile.mock.calls[0][1]).not.toHaveProperty('email')
  })

  it('blocks the save and asks for a full name when it is empty', async () => {
    render(<MemoryRouter><Profile /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    expect(await screen.findByText('Enter your full name.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('renders the security tab with the sign-out-all button', () => {
    render(<MemoryRouter><Profile /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /account settings/i }))
    expect(screen.getByRole('button', { name: /sign out all devices/i })).toBeInTheDocument()
  })

  it('renders the account tab with the ChangePassword component', () => {
    render(<MemoryRouter><Profile /></MemoryRouter>)
    expect(screen.getByText('ChangePassword')).toBeInTheDocument()
  })
})
