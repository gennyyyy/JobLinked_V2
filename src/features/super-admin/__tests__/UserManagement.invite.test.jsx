import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  listUsers: async () => ({ data: [], total: 0, page: 1, pageSize: 25 }),
  listAllAccreditations: async () => ({ data: [], total: 0, page: 1, pageSize: 100 }),
  listRoles: async () => [{ id: 7, name: 'HR Officer', base_role: 'employer' }],
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

import { inviteUser } from '../../../shared/services/admin'
import UserManagement from '../UserManagement'

beforeEach(() => {
  inviteUser.mockReset()
  inviteUser.mockResolvedValue({ invited: true, email: 'x@y.z', role: 'employer' })
})

describe('UserManagement add-user invite', () => {
  it('reveals the invite form when Add user is clicked', async () => {
    render(<UserManagement />)
    fireEvent.click(await screen.findByRole('button', { name: /add user/i }))
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })

  it('shows Company name for employer and hides it for job-seeker', async () => {
    render(<UserManagement />)
    fireEvent.click(await screen.findByRole('button', { name: /add user/i }))

    const roleSelect = screen.getByLabelText('Role')
    fireEvent.change(roleSelect, { target: { value: 'employer' } })
    expect(screen.getByLabelText(/company name/i)).toBeTruthy()

    fireEvent.change(roleSelect, { target: { value: 'job-seeker' } })
    expect(screen.queryByLabelText(/company name/i)).toBeNull()
  })

  it('submits an employer invite with the expected payload', async () => {
    render(<UserManagement />)
    fireEvent.click(await screen.findByRole('button', { name: /add user/i }))

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'employer' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'hr@acme.test' } })
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lovelace' } })
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme' } })
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }))

    expect(inviteUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'hr@acme.test', role: 'employer', company_name: 'Acme' })
    )
  })

  it('sends custom_role_id plus the custom role base_role', async () => {
    render(<UserManagement />)
    fireEvent.click(await screen.findByRole('button', { name: /add user/i }))

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'custom:7' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'hr@acme.test' } })
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Lovelace' } })
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Acme' } })
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }))

    expect(inviteUser).toHaveBeenCalledWith(
      expect.objectContaining({ custom_role_id: 7, role: 'employer' })
    )
  })
})
