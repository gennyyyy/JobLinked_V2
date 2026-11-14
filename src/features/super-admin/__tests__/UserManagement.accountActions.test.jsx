import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  listUsers: vi.fn(),
  updateUser: vi.fn(),
  listRoles: vi.fn(),
  inviteUser: vi.fn(),
  resetUserPassword: vi.fn(),
  forceSignOut: vi.fn(),
  assignRole: vi.fn(),
  assignCustomRole: vi.fn(),
  listAuditLogs: vi.fn(),
  listSeekerEducation: vi.fn(),
  listSeekerExperience: vi.fn(),
  listSeekerEmployment: vi.fn(),
  listSeekerResumes: vi.fn(),
}))

vi.mock('../../../shared/services/documents', () => ({
  latestAccByCompany: () => ({}),
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'admin-1', role: 'super-admin' } }),
}))

import { listUsers, listRoles, listAuditLogs, resetUserPassword, forceSignOut } from '../../../shared/services/admin'
import UserManagement from '../UserManagement'

const account = {
  id: 'u-1', full_name: 'Ada Lovelace', email: 'ada@cebu.ph', role: 'employer',
  status: 'active', created_at: '2026-02-02T00:00:00.000Z',
}

async function openActions() {
  listUsers.mockResolvedValue({ data: [account], total: 1, page: 1, pageSize: 25 })
  render(<UserManagement />)
  fireEvent.click(await screen.findByRole('button', { name: /manage access/i }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  vi.clearAllMocks()
  listRoles.mockResolvedValue([])
  listAuditLogs.mockResolvedValue([])
  resetUserPassword.mockResolvedValue({ sent: true })
  forceSignOut.mockResolvedValue({ signedOut: true })
})

describe('UserManagement account actions', () => {
  it('sends a password reset only after the confirmation step', async () => {
    await openActions()

    fireEvent.click(screen.getByRole('button', { name: 'Send password reset' }))
    expect(resetUserPassword).not.toHaveBeenCalled()
    expect(screen.getByText(/send a password reset email to this account\?/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm password reset' }))
    await waitFor(() => expect(resetUserPassword).toHaveBeenCalledWith('u-1'))
    expect(await screen.findByRole('status')).toHaveTextContent(/password reset email sent/i)
  })

  it('disables the confirmation while the reset is in flight', async () => {
    let finish
    resetUserPassword.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    await openActions()

    fireEvent.click(screen.getByRole('button', { name: 'Send password reset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm password reset' }))
    expect(await screen.findByRole('button', { name: /working/i })).toBeDisabled()

    finish({ sent: true })
    expect(await screen.findByRole('status')).toHaveTextContent(/password reset email sent/i)
  })

  it('signs out all sessions after confirmation', async () => {
    await openActions()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out all sessions' }))
    expect(forceSignOut).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sign-out' }))
    await waitFor(() => expect(forceSignOut).toHaveBeenCalledWith('u-1'))
    expect(await screen.findByRole('status')).toHaveTextContent(/all sessions signed out/i)
  })

  it('announces a failed account action inline', async () => {
    resetUserPassword.mockRejectedValue(new Error('Reset limit reached'))
    await openActions()

    fireEvent.click(screen.getByRole('button', { name: 'Send password reset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm password reset' }))
    await waitFor(() => expect(
      screen.getAllByRole('alert').some((alert) => alert.textContent.includes('Reset limit reached')),
    ).toBe(true))
  })
})
