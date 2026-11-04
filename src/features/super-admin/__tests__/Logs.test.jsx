import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import Logs from '../Logs'
import { listAuditLogs } from '../../../shared/services/admin'

vi.mock('../../../shared/services/admin', () => ({ listAuditLogs: vi.fn() }))

const LOGS = [
  { id: 'log-1', action: 'auth.login', actor_name: 'Jane', entity: 'profiles', entity_id: 'p1', created_at: '2026-01-05T10:00:00.000Z' },
  { id: 'log-2', action: 'job.create', actor_name: 'Joe', entity: 'job_vacancies', entity_id: 'j1', created_at: '2026-01-06T12:30:00.000Z' },
]

describe('Audit log viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAuditLogs.mockResolvedValue(LOGS)
  })

  it('shows a layout skeleton while fetching', () => {
    let resolveLogs
    listAuditLogs.mockReturnValue(new Promise((res) => { resolveLogs = res }))
    render(<Logs />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading page/i)
    act(() => resolveLogs([]))
  })

  it('renders the newest activity first and counts the records', async () => {
    render(<Logs />)
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1).map((row) => row.textContent)
    expect(rows[0]).toContain('job.create')
    expect(rows[1]).toContain('auth.login')
    expect(screen.getByText('1–2 of 2 records')).toBeInTheDocument()
  })

  it('filters by actor, action, or record', async () => {
    render(<Logs />)
    await screen.findByRole('table')

    fireEvent.change(screen.getByPlaceholderText(/search actor, action, or record/i), { target: { value: 'jane' } })
    expect(within(screen.getByRole('table')).queryByText('job.create')).toBeNull()
    expect(within(screen.getByRole('table')).getByText('auth.login')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/search actor, action, or record/i), { target: { value: 'job_vacancies' } })
    expect(within(screen.getByRole('table')).getByText('job.create')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).queryByText('auth.login')).toBeNull()
  })

  it('exports the filtered log as CSV', async () => {
    let blob
    URL.createObjectURL = vi.fn((value) => { blob = value; return 'blob:mock' })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<Logs />)
    await screen.findByRole('table')
    fireEvent.click(screen.getByRole('button', { name: /export log/i }))

    await waitFor(() => expect(blob).toBeTruthy())
    const text = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsText(blob)
    })
    expect(text).toContain('"DEMO timestamp","Actor","Action","Record"')
    expect(text).toContain('"job.create"')
  })

  it('shows an error message when the logs fail to load', async () => {
    listAuditLogs.mockRejectedValue(new Error('logs down'))
    render(<Logs />)
    expect(await screen.findByText('logs down')).toBeInTheDocument()
  })
})
