import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react'
import Logs from '../Logs'
import { listAuditLogs, listUsers } from '../../../shared/services/admin'

vi.mock('../../../shared/services/admin', () => ({
  listAuditLogs: vi.fn(),
  listUsers: vi.fn(),
}))

const LOGS = [
  { id: 'log-1', action: 'auth.login', actor_email: 'jane@acme.test', actor_name: 'Jane', created_at: '2026-01-05T10:00:00.000Z' },
  { id: 'log-2', action: 'job.create', actor_email: 'joe@acme.test', actor_name: 'Joe', created_at: '2026-01-06T12:30:00.000Z' },
]
const USERS = [{ id: 'u1', full_name: 'Jane Owner', email: 'jane@acme.test', role: 'employer', phone: '0917', status: 'active', city: 'Santa Maria' }]

describe('Audit log viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAuditLogs.mockResolvedValue(LOGS)
    listUsers.mockResolvedValue({ data: USERS, total: USERS.length, page: 1, pageSize: 25 })
  })

  it('shows the loading screen while fetching', () => {
    let resolveUsers
    listUsers.mockReturnValue(new Promise((res) => { resolveUsers = res }))
    render(<Logs />)
    expect(screen.getByText(/loading database/i)).toBeInTheDocument()
    act(() => resolveUsers({ data: [] }))
  })

  it('renders the log rows and record count', async () => {
    render(<Logs />)
    const table = await screen.findByRole('table')
    // Scope to the table: action names also appear as filter <option> entries.
    expect(within(table).getByText('auth.login')).toBeInTheDocument()
    expect(within(table).getByText('job.create')).toBeInTheDocument()
    expect(screen.getByText('2 records')).toBeInTheDocument()
  })

  it('opens the user profile modal when an actor email is clicked', async () => {
    render(<Logs />)
    fireEvent.click(await screen.findByRole('button', { name: 'jane@acme.test' }))

    const dialog = await screen.findByRole('dialog')
    // listUsers is queried for the clicked user's profile.
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith({ search: 'jane@acme.test' }))
    expect(within(dialog).getByText('Jane Owner')).toBeInTheDocument()
  })

  it('applies the Login History shortcut filter', async () => {
    render(<Logs />)
    await screen.findByRole('table')
    listAuditLogs.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /login history/i }))

    await waitFor(() =>
      expect(listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.' }))
    )
  })

  it('shows an error message when the logs fail to load', async () => {
    listAuditLogs.mockRejectedValue(new Error('logs down'))
    render(<Logs />)
    expect(await screen.findByText('logs down')).toBeInTheDocument()
  })

  it('asks for the 500-row max so the user filter is not capped at a server page', async () => {
    render(<Logs />)
    await screen.findByRole('table')
    // Without this the "Filter by user" dropdown was silently truncated to 25.
    expect(listUsers).toHaveBeenCalledWith({ pageSize: 500 })
  })

  it('lists accounts beyond the first server page in the user filter', async () => {
    const all = Array.from({ length: 30 }, (_, i) => {
      const n = String(i + 1).padStart(2, '0')
      return { id: `u-${n}`, full_name: `User ${n}`, email: `user${n}@acme.test`, role: 'employer', status: 'active' }
    })
    // Mirror the server cap: without { pageSize: 500 } the list stops at 25.
    listUsers.mockImplementation((params = {}) => {
      const cap = params.pageSize ?? 25
      return Promise.resolve({ data: all.slice(0, cap), total: all.length, page: 1, pageSize: cap })
    })
    render(<Logs />)
    const filter = await screen.findByLabelText('Filter by user')
    // The 30th account lives on server page 2 of the default pageSize.
    expect(within(filter).getByText('User 30')).toBeInTheDocument()
  })
})
