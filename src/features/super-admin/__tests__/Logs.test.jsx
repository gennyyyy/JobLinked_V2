import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import Logs from '../Logs'
import { listAuditLogs, listUsers } from '../../../shared/services/admin'

vi.mock('../../../shared/services/admin', () => ({ listAuditLogs: vi.fn(), listUsers: vi.fn() }))

const LOGS = [
  { id: 'log-1', action: 'auth.login', actor_name: 'Jane', entity: 'profiles', entity_id: 'p1', created_at: '2026-01-05T10:00:00.000Z' },
  { id: 'log-2', action: 'job.create', actor_name: 'Joe', entity: 'job_vacancies', entity_id: 'j1', created_at: '2026-01-06T12:30:00.000Z' },
]

const manyLogs = () => Array.from({ length: 9 }, (_, index) => ({
  id: `log-${index + 1}`,
  action: 'auth.login',
  actor_name: 'Jane',
  entity: 'profiles',
  entity_id: `p${index + 1}`,
  created_at: `2026-01-0${index + 1}T10:00:00.000Z`,
}))

describe('Audit log viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAuditLogs.mockResolvedValue(LOGS)
    listUsers.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 500 })
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

  it('loads the actor list and refetches server-side when an actor is chosen', async () => {
    listUsers.mockResolvedValue({ data: [{ id: 'u1', full_name: 'Jane' }], total: 1, page: 1, pageSize: 500 })
    render(<Logs />)
    await screen.findByRole('table')
    await screen.findByRole('option', { name: 'Jane' })

    fireEvent.change(screen.getByLabelText('Actor'), { target: { value: 'u1' } })

    await waitFor(() => expect(listAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'u1' })))
  })

  it('keeps the table usable when the actor list fails', async () => {
    listUsers.mockRejectedValue(new Error('users down'))
    render(<Logs />)
    await screen.findByRole('table')
    await act(async () => {})

    const select = screen.getByLabelText('Actor')
    expect(select.options).toHaveLength(1)
    expect(select.options[0].textContent).toBe('All actors')
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('sends the action filter after the debounce', async () => {
    render(<Logs />)
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'job.' } })

    await waitFor(
      () => expect(listAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'job.' })),
      { timeout: 1500 },
    )
  })

  it('sends the date range and clears it back to empty strings', async () => {
    render(<Logs />)
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-31' } })

    await waitFor(() => expect(listAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-01-01', to: '2026-01-31' })))

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } })

    await waitFor(() => expect(listAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ from: '' })))
  })

  it('resets the pager to page 1 when a filter changes', async () => {
    listAuditLogs.mockResolvedValue(manyLogs())
    listUsers.mockResolvedValue({ data: [{ id: 'u1', full_name: 'Jane' }], total: 1, page: 1, pageSize: 500 })
    render(<Logs />)
    await screen.findByRole('table')
    expect(screen.getByText('1–8 of 9 records')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText('9–9 of 9 records')).toBeInTheDocument()

    await screen.findByRole('option', { name: 'Jane' })
    fireEvent.change(screen.getByLabelText('Actor'), { target: { value: 'u1' } })

    await waitFor(() => expect(listAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'u1' })))
    expect(screen.getByText('1–8 of 9 records')).toBeInTheDocument()
  })
})
