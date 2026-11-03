import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import RoleManagement from '../RoleManagement'
import { listRoles, createRole, updateRole, deleteRole, listPermissions } from '../../../shared/services/admin'

vi.mock('../../../shared/services/admin', () => ({
  listRoles: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  listPermissions: vi.fn(),
}))

const ROLES = [
  { id: 'r1', name: 'HR Officer', description: 'Handles hiring', base_role: 'employer', permissions: ['users.view'] },
]
const PERMISSIONS = [
  { key: 'users.view', label: 'View Users' },
  { key: 'reports.view', label: 'View Reports' },
]

describe('RoleManagement custom role CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listRoles.mockResolvedValue(ROLES)
    listPermissions.mockResolvedValue(PERMISSIONS)
    createRole.mockResolvedValue({})
    updateRole.mockResolvedValue({})
    deleteRole.mockResolvedValue({})
  })

  it('renders the read-only system roles and the custom role with its permission', async () => {
    render(<RoleManagement />)
    expect(await screen.findByText('HR Officer')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Super Admin' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Employer' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Job Seeker' })).toBeInTheDocument()
    // The permission key is rendered using the server-provided label.
    expect(screen.getByText('View Users')).toBeInTheDocument()
  })

  it('opens the create form when New Role is clicked', async () => {
    render(<RoleManagement />)
    fireEvent.click(await screen.findByRole('button', { name: /new role/i }))

    expect(screen.getByLabelText(/role name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument()
  })

  it('rejects creation with an empty name and does not call createRole', async () => {
    render(<RoleManagement />)
    fireEvent.click(await screen.findByRole('button', { name: /new role/i }))
    fireEvent.click(screen.getByRole('button', { name: /create role/i }))

    expect(screen.getByText('Role name is required.')).toBeInTheDocument()
    expect(createRole).not.toHaveBeenCalled()
  })

  it('creates a custom role with the submitted payload', async () => {
    render(<RoleManagement />)
    fireEvent.click(await screen.findByRole('button', { name: /new role/i }))

    fireEvent.change(screen.getByLabelText(/role name/i), { target: { value: 'PESO Staff' } })
    fireEvent.change(screen.getByLabelText(/base portal/i), { target: { value: 'job-seeker' } })
    fireEvent.click(screen.getByRole('button', { name: /create role/i }))

    await waitFor(() =>
      expect(createRole).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'PESO Staff', base_role: 'job-seeker' })
      )
    )
  })

  it('deletes an existing custom role after confirmation', async () => {
    render(<RoleManagement />)
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/delete role "hr officer"\?/i)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(deleteRole).toHaveBeenCalledWith('r1'))
  })

  it('shows an error message when the roles fail to load', async () => {
    listRoles.mockRejectedValue(new Error('load failed'))
    render(<RoleManagement />)
    expect(await screen.findByText('load failed')).toBeInTheDocument()
  })
})
