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

import { listUsers, listAllAccreditations, listRoles } from '../../../shared/services/admin'
import UserManagement from '../UserManagement'

// The server's C2 envelope: { data, total, page, pageSize }.
const envelope = (page) => ({
  data: Array.from({ length: 25 }, (_, i) => ({
    id: `u-${page}-${i}`,
    full_name: `Page ${page} user ${i}`,
    email: `u${page}${i}@x.test`,
    role: 'job-seeker',
    status: 'active',
    created_at: '2026-02-02T00:00:00.000Z',
  })),
  total: 60,
  page,
  pageSize: 25,
})

describe('UserManagement pagination (C2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAllAccreditations.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 100 })
    listRoles.mockResolvedValue([])
    listUsers.mockImplementation(({ page: p = 1 }) => Promise.resolve(envelope(p)))
  })

  it('renders the envelope data and pages forward through the total', async () => {
    render(<UserManagement />)
    expect(await screen.findByRole('table')).toBeInTheDocument()

    // Page 1 rows only — the envelope's data, never the whole user table.
    expect(screen.getByText('Page 1 User 0')).toBeInTheDocument()
    expect(screen.queryByText('Page 2 User 0')).toBeNull()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(listUsers).toHaveBeenCalledWith({ page: 2 }))
    expect(await screen.findByText('Page 2 User 0')).toBeInTheDocument()
    expect(screen.queryByText('Page 1 User 0')).toBeNull()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
  })

  it('refetches the current page after a role assignment', async () => {
    render(<UserManagement />)
    const select = await screen.findByLabelText(/role for page 1 user 0/i)
    fireEvent.change(select, { target: { value: 'sys:employer' } })
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith({ page: 1 }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('finds a page-2 user by name through a server-side search', async () => {
    // 26 accounts; "Zephyrina" is the 26th → only on the second server page,
    // so a client filter over page 1 could never surface her.
    const all = Array.from({ length: 26 }, (_, i) => ({
      id: `u-${i}`,
      full_name: i === 25 ? 'Zephyrina Quimby' : `User ${i}`,
      email: `u${i}@x.test`,
      role: 'job-seeker',
      status: 'active',
      created_at: '2026-02-02T00:00:00.000Z',
    }))
    listUsers.mockImplementation((params = {}) => {
      const term = (params.search || '').toLowerCase()
      const hits = term
        ? all.filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(term))
        : all.slice(0, 25)
      return Promise.resolve({ data: hits, total: hits.length, page: params.page || 1, pageSize: 25 })
    })

    render(<UserManagement />)
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('Zephyrina Quimby')).toBeNull()

    fireEvent.change(screen.getByLabelText(/search users by name or email/i), { target: { value: 'Zephyrina' } })

    // Filtering is wired into the service call (server-side, debounced)…
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({ search: 'Zephyrina' })))
    // …and the page-2 account now renders in the table.
    expect(await screen.findByText('Zephyrina Quimby')).toBeInTheDocument()
  })
})
