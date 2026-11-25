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

import { listUsers, listRoles, listAuditLogs, resetUserPassword, forceSignOut, assignRole, assignCustomRole } from '../../../shared/services/admin'
import UserManagement from '../UserManagement'

const account = {
  id: 'u-1', full_name: 'Ada Lovelace', email: 'ada@cebu.ph', role: 'employer',
  status: 'active', created_at: '2026-02-02T00:00:00.000Z',
}

async function openActions() {
  listUsers.mockResolvedValue({ data: [account], total: 1, page: 1, pageSize: 25 })
  render(<UserManagement />)
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Ada Lovelace' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Manage access' }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  vi.clearAllMocks()
  listRoles.mockResolvedValue([])
  listAuditLogs.mockResolvedValue([])
  resetUserPassword.mockResolvedValue({ sent: true })
  forceSignOut.mockResolvedValue({ signedOut: true })
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  it('locks the reference User ID field in the access dialog', async () => {
    await openActions()

    expect(screen.getByLabelText('User ID')).toBeDisabled()
  })

  it('sends the typed reason with a system role change', async () => {
    assignRole.mockResolvedValue({ id: 'u-1', role: 'job-seeker' })
    await openActions()
    expect(screen.getByLabelText(/reason for change/i)).toHaveAttribute('maxlength', '500')

    fireEvent.change(screen.getByLabelText(/assigned system role/i), { target: { value: 'sys:job-seeker' } })
    fireEvent.change(screen.getByLabelText(/reason for change/i), { target: { value: '  Promoted after PESO review.  ' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /i confirm this role or permission change/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm access change/i }))

    await waitFor(() => expect(assignRole).toHaveBeenCalled())
    const [id, role, reason, changeId] = assignRole.mock.calls[0]
    expect([id, role, reason]).toEqual(['u-1', 'job-seeker', 'Promoted after PESO review.'])
    expect(changeId).toMatch(UUID_RE)
  })

  it('sends the typed reason with a custom-role assignment', async () => {
    listRoles.mockResolvedValue([{ id: 5, name: 'HR Officer', base_role: 'employer', permissions: [] }])
    assignCustomRole.mockResolvedValue({ id: 'u-1' })
    await openActions()

    fireEvent.change(screen.getByLabelText(/assigned system role/i), { target: { value: 'custom:5' } })
    fireEvent.change(screen.getByLabelText(/reason for change/i), { target: { value: 'Needs job-posting access.' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /i confirm this role or permission change/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm access change/i }))

    await waitFor(() => expect(assignCustomRole).toHaveBeenCalled())
    const [id, roleId, reason, changeId] = assignCustomRole.mock.calls[0]
    expect([id, roleId, reason]).toEqual(['u-1', 5, 'Needs job-posting access.'])
    expect(changeId).toMatch(UUID_RE)
    // The base role already matches the account, so no system role write rides along.
    expect(assignRole).not.toHaveBeenCalled()
  })

  it('shares one change_id across both writes and reloads the history', async () => {
    listRoles.mockResolvedValue([{ id: 5, name: 'HR Officer', base_role: 'job-seeker', permissions: [] }])
    assignRole.mockResolvedValue({ id: 'u-1', role: 'job-seeker' })
    assignCustomRole.mockResolvedValue({ id: 'u-1' })
    await openActions()
    expect(listAuditLogs).toHaveBeenCalledTimes(2)

    fireEvent.change(screen.getByLabelText(/assigned system role/i), { target: { value: 'custom:5' } })
    fireEvent.change(screen.getByLabelText(/reason for change/i), { target: { value: '  Needs job-posting access.  ' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /i confirm this role or permission change/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm access change/i }))

    await waitFor(() => expect(assignCustomRole).toHaveBeenCalled())
    const roleArgs = assignRole.mock.calls[0]
    const tagArgs = assignCustomRole.mock.calls[0]
    expect(roleArgs.slice(0, 3)).toEqual(['u-1', 'job-seeker', 'Needs job-posting access.'])
    expect(tagArgs.slice(0, 3)).toEqual(['u-1', 5, 'Needs job-posting access.'])
    expect(roleArgs[3]).toMatch(UUID_RE)
    expect(tagArgs[3]).toBe(roleArgs[3])
    // The access history is fetched again after a successful confirm.
    await waitFor(() => expect(listAuditLogs).toHaveBeenCalledTimes(4))
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
