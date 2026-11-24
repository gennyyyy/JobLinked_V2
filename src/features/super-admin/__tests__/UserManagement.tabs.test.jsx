import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  listUsers: vi.fn(),
  listRoles: vi.fn(),
  listPermissions: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  listAuditLogs: vi.fn(),
  updateUser: vi.fn(),
  assignRole: vi.fn(),
  assignCustomRole: vi.fn(),
  inviteUser: vi.fn(),
  resetUserPassword: vi.fn(),
  forceSignOut: vi.fn(),
  listSeekerEducation: vi.fn(),
  listSeekerExperience: vi.fn(),
  listSeekerEmployment: vi.fn(),
  listSeekerResumes: vi.fn(),
}))

vi.mock('../../../shared/services/documents', () => ({ signedUrl: vi.fn() }))
vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))

import useAuth from '../../../shared/hooks/useAuth'
import { listUsers, listRoles, listPermissions, listAuditLogs, createRole } from '../../../shared/services/admin'
import UserManagement from '../UserManagement'

const USER = {
  id: 'u-1', full_name: 'Ada Lovelace', email: 'ada@cebu.ph', role: 'employer',
  status: 'active', created_at: '2026-02-02T00:00:00.000Z',
}
const ROLES = [
  { id: 'r1', name: 'HR Officer', description: 'Handles hiring', base_role: 'employer', permissions: ['users.view'] },
]
const PERMISSIONS = [{ key: 'users.view', label: 'View Users' }]

const asAdmin = (permissions) => useAuth.mockReturnValue({
  user: { id: 'admin-1', role: 'super-admin', permissions },
})

beforeEach(() => {
  vi.clearAllMocks()
  listUsers.mockResolvedValue({ data: [USER], total: 1, page: 1, pageSize: 25 })
  listRoles.mockResolvedValue(ROLES)
  listPermissions.mockResolvedValue(PERMISSIONS)
  listAuditLogs.mockResolvedValue([])
  createRole.mockResolvedValue({})
})

describe('UserManagement Users + Roles tabs', () => {
  it('gives a full administrator both tabs with Users active', async () => {
    asAdmin(null)
    render(<UserManagement />)

    expect(await screen.findByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Roles' })).toBeInTheDocument()
    expect(screen.getByText('User accounts')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Full name' })).toBeInTheDocument()
  })

  it('holds the full role management content and the access history on the Roles tab', async () => {
    asAdmin(null)
    render(<UserManagement />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Roles' }))

    // System role cards, permission matrix, and custom roles.
    expect(await screen.findByRole('heading', { name: 'PESO Admin' })).toBeInTheDocument()
    expect(screen.getByText('Roles & permissions')).toBeInTheDocument()
    expect(screen.getByText('HR Officer')).toBeInTheDocument()
    expect(screen.getByText('Manage Job Postings')).toBeInTheDocument()
    // The user directory is not mounted on this tab.
    expect(screen.queryByRole('columnheader', { name: 'Full name' })).toBeNull()
    // logs.view is held by a full administrator.
    expect(screen.getByText(/role and access change history/i)).toBeInTheDocument()
  })

  it('keeps a users.manage bundle on the Users tab only', async () => {
    asAdmin(['users.manage'])
    render(<UserManagement />)

    expect(await screen.findByRole('tab', { name: 'Users' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Roles' })).toBeNull()
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument()
    await waitFor(() => expect(listUsers).toHaveBeenCalled())
  })

  it('opens a roles.manage bundle on Roles and never calls the user directory', async () => {
    asAdmin(['roles.manage'])
    render(<UserManagement />)

    expect(await screen.findByRole('tab', { name: 'Roles' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Users' })).toBeNull()
    expect(screen.queryByRole('button', { name: /add user/i })).toBeNull()
    expect(await screen.findByRole('heading', { name: 'PESO Admin' })).toBeInTheDocument()
    // No logs.view in this bundle, so the history panel is absent too.
    expect(screen.queryByText(/role and access change history/i)).toBeNull()
    expect(listUsers).not.toHaveBeenCalled()
    expect(listAuditLogs).not.toHaveBeenCalled()
  })

  it('shows a no-access notice when the bundle holds neither key', () => {
    asAdmin([])
    render(<UserManagement />)

    expect(screen.getByRole('heading', { name: 'User Management' })).toBeInTheDocument()
    expect(screen.getByText(/grants neither user nor role management/i)).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(listUsers).not.toHaveBeenCalled()
    expect(listRoles).not.toHaveBeenCalled()
  })

  it('refreshes the Users tab custom-role options after a role is created in Roles', async () => {
    asAdmin(null)
    render(<UserManagement />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Roles' }))
    await screen.findByRole('heading', { name: 'PESO Admin' })

    listRoles.mockResolvedValue([
      ...ROLES,
      { id: 'r2', name: 'PESO Staff', description: '', base_role: 'super-admin', permissions: [] },
    ])
    fireEvent.click(screen.getByRole('button', { name: /new role/i }))
    fireEvent.change(await screen.findByLabelText(/role name/i), { target: { value: 'PESO Staff' } })
    fireEvent.click(screen.getByRole('button', { name: /create role/i }))
    expect(await screen.findByRole('heading', { name: 'PESO Staff' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Users' }))
    fireEvent.click(await screen.findByRole('button', { name: /add user/i }))
    expect(await screen.findByRole('option', { name: 'PESO Staff' })).toBeInTheDocument()
  })
})
