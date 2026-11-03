import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  listUsers: vi.fn(),
  listAllAccreditations: vi.fn(),
  listRoles: vi.fn(),
  inviteUser: vi.fn(),
  updateUser: vi.fn(),
  assignRole: vi.fn(),
  assignCustomRole: vi.fn(),
}))

vi.mock('../../../shared/services/documents', () => ({
  latestAccByCompany: () => ({}),
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'admin-1', role: 'super-admin' } }),
}))

import { listUsers, listAllAccreditations, listRoles, assignRole } from '../../../shared/services/admin'
import UserManagement from '../UserManagement'

function user(overrides = {}) {
  return {
    id: 'u-1',
    full_name: 'Ada Lovelace',
    email: 'ada@cebu.ph',
    role: 'employer',
    status: 'active',
    created_at: '2026-02-02T00:00:00.000Z',
    ...overrides,
  }
}

async function renderUsers(users = [user()]) {
  listUsers.mockResolvedValue({ data: users, total: users.length, page: 1, pageSize: 25 })
  listAllAccreditations.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 100 })
  listRoles.mockResolvedValue([])
  render(<UserManagement />)
  return screen.findByRole('table')
}

describe('UserManagement accessibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('labels the search and role filter controls', async () => {
    await renderUsers()
    expect(screen.getByLabelText(/search users by name or email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filter by role/i)).toBeInTheDocument()
  })

  it('announces a failed load in a live region', async () => {
    listUsers.mockRejectedValue(new Error('Could not reach the user directory'))
    render(<UserManagement />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/user directory/i))
  })

  it('announces an action failure in a live region', async () => {
    assignRole.mockRejectedValue(new Error('Role change rejected'))
    await renderUsers()
    fireEvent.change(screen.getByLabelText(/role for ada lovelace/i), { target: { value: 'sys:job-seeker' } })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Role change rejected'))
  })

  it('closes the invite dialog on Escape', async () => {
    await renderUsers()
    fireEvent.click(screen.getByRole('button', { name: /add user/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
