import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Applications from '../Applications'
import { listBySeeker } from '../../../shared/services/applications'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1' } }),
}))

vi.mock('../../../shared/services/applications', () => ({
  listBySeeker: vi.fn(),
  getApplicationHistory: vi.fn().mockResolvedValue([
    { status: 'Applied', changed_at: '2026-01-15T00:00:00.000Z', remarks: null },
    { status: 'Under Review', changed_at: '2026-01-20T00:00:00.000Z', remarks: null },
  ]),
}))

function makeApplication(overrides = {}) {
  return {
    id: 'app-1',
    status: 'Applied',
    applied_at: '2026-01-15T00:00:00.000Z',
    job_id: 'job-1',
    interview_at: null,
    interview_instructions: null,
    employer_notes: null,
    job: { id: 'job-1', title: 'Barangay Health Worker', employers: { company_name: 'Santa Maria Health Office' } },
    ...overrides,
  }
}

async function renderList(applications) {
  listBySeeker.mockResolvedValue(applications)
  render(
    <MemoryRouter>
      <Applications />
    </MemoryRouter>
  )
  return screen.findByText('Barangay Health Worker')
}

describe('Job seeker applications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the reference table with the submitted date and status', async () => {
    await renderList([makeApplication()])

    const table = screen.getByRole('table')
    expect(within(table).getByText('Barangay Health Worker')).toBeInTheDocument()
    expect(within(table).getByText('Santa Maria Health Office')).toBeInTheDocument()
    expect(within(table).getByText('Applied')).toBeInTheDocument()
  })

  it('filters by application status', async () => {
    await renderList([
      makeApplication(),
      makeApplication({ id: 'app-2', status: 'Rejected', job: { id: 'job-2', title: 'Cashier', employers: { company_name: 'Beta Foods' } } }),
    ])

    fireEvent.change(screen.getByLabelText(/application status/i), { target: { value: 'Rejected' } })

    expect(screen.queryByText('Barangay Health Worker')).not.toBeInTheDocument()
    expect(screen.getByText('Cashier')).toBeInTheDocument()
  })

  it('opens the tracked journey with the interview details', async () => {
    await renderList([makeApplication({
      status: 'Interview',
      interview_at: '2026-02-01T09:00:00.000Z',
      interview_instructions: 'PESO Office, Ground Floor',
      employer_notes: 'Bring your portfolio.',
    })])

    fireEvent.click(screen.getByRole('button', { name: /track application/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/interview scheduled/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/PESO Office, Ground Floor/)).toBeInTheDocument()
    expect(within(dialog).getByText('Bring your portfolio.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Application status history')).toBeInTheDocument()
  })

  it('shows the empty state when there are no applications', async () => {
    listBySeeker.mockResolvedValue([])
    render(
      <MemoryRouter>
        <Applications />
      </MemoryRouter>
    )
    expect(await screen.findByText('A fresh start is a good start.')).toBeInTheDocument()
  })
})
