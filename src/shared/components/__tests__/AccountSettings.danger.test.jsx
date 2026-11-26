import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DangerZonePanel from '../DangerZonePanel'
import AccountSettings from '../AccountSettings'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/account', () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  exportAccount: vi.fn(),
  deactivateAccount: vi.fn(),
  eraseAccount: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getPreferences, deactivateAccount, eraseAccount } from '../../../shared/services/account'

describe('AccountSettings danger zone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'job-seeker', email: 'seeker@example.com' } })
    getPreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    deactivateAccount.mockResolvedValue(undefined)
    eraseAccount.mockResolvedValue(undefined)
    window.confirm = vi.fn(() => true)
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/', assign: vi.fn() },
      writable: true,
      configurable: true,
    })
  })

  it('deactivates account and redirects to /login', async () => {
    render(<MemoryRouter><DangerZonePanel /></MemoryRouter>)

    expect(screen.getByText('Danger zone')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /deactivate account/i }))

    await waitFor(() => expect(deactivateAccount).toHaveBeenCalled())
    expect(window.location.assign).toHaveBeenCalledWith('/login')
  })

  it('requires DELETE before erasing, then redirects home', async () => {
    render(<MemoryRouter><DangerZonePanel /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /delete account permanently/i }))
    const confirm = screen.getByRole('button', { name: /delete account permanently/i })
    const input = screen.getByLabelText(/type delete to confirm/i)
    expect(confirm).toBeDisabled()

    fireEvent.change(input, { target: { value: 'delete' } })
    expect(confirm).toBeDisabled()

    fireEvent.change(input, { target: { value: 'DELETE' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(() => expect(eraseAccount).toHaveBeenCalledTimes(1))
    expect(window.location.assign).toHaveBeenCalledWith('/')
  })

  it('shows the server message when erasure fails', async () => {
    eraseAccount.mockRejectedValueOnce(new Error('Cannot erase this account'))
    render(<MemoryRouter><DangerZonePanel /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /delete account permanently/i }))
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: /delete account permanently/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot erase this account')
    expect(window.location.assign).not.toHaveBeenCalled()
  })

  it('does not offer erasure to staff accounts', () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'super-admin' } })
    render(<MemoryRouter><DangerZonePanel /></MemoryRouter>)

    expect(screen.getByRole('button', { name: /deactivate account/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete account permanently/i })).toBeNull()
  })

  it('renders the danger zone for a job-seeker account', async () => {
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)

    expect(await screen.findByText('Account overview')).toBeInTheDocument()
    expect(await screen.findByText('Danger zone')).toBeInTheDocument()
  })

  it('does not render the danger zone for a super-admin account', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'super-admin', email: 'admin@example.com' } })
    render(<MemoryRouter><AccountSettings /></MemoryRouter>)

    expect(await screen.findByText('Account overview')).toBeInTheDocument()
    expect(screen.queryByText('Danger zone')).toBeNull()
  })
})