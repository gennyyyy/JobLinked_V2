import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Jobs from '../Jobs'
import { listJobs } from '../../../shared/services/jobs'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1', skills: ['Communication'] } }),
}))

vi.mock('../../../shared/services/jobs', () => ({
  listJobs: vi.fn(),
}))

function job(overrides = {}) {
  return {
    id: 'job-1',
    title: 'Barangay Health Worker',
    status: 'published',
    location: 'Poblacion',
    employment_type: 'Full-time',
    work_arrangement: 'On-site',
    vacancies: 2,
    deadline: '2099-12-31',
    created_at: '2026-10-14T00:00:00.000Z',
    requirements: 'Experience: 1 year\nCommunication',
    employers: { company_name: 'Santa Maria Health Office', accreditation_status: 'approved' },
    ...overrides,
  }
}

async function renderJobs() {
  render(
    <MemoryRouter>
      <Jobs />
    </MemoryRouter>
  )
  return screen.findByRole('heading', { name: /browse jobs/i })
}

describe('Jobs accessibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('labels the recommendation search field', async () => {
    listJobs.mockResolvedValue({ jobs: [job()], total: 1 })
    await renderJobs()
    expect(screen.getByLabelText('Search your recommendations')).toBeInTheDocument()
  })

  it('announces a failed load in a live region', async () => {
    listJobs.mockRejectedValue(new Error('Job board unreachable'))
    await renderJobs()
    await screen.findByText('Job board unreachable')
    const alerts = screen.getAllByRole('alert')
    expect(alerts.some((alert) => alert.textContent.includes('Job board unreachable'))).toBe(true)
  })

  it('shows the reference match notice and the vacancy count', async () => {
    listJobs.mockResolvedValue({ jobs: [job()], total: 1 })
    await renderJobs()
    expect(screen.getByText('A match you can understand')).toBeInTheDocument()
    expect(await screen.findByText('1 matching vacancies')).toBeInTheDocument()
  })

  it('filters the grid by the search field', async () => {
    listJobs.mockResolvedValue({
      jobs: [job(), job({ id: 'job-2', title: 'Cashier' })],
      total: 2,
    })
    await renderJobs()

    fireEvent.change(screen.getByLabelText('Search your recommendations'), { target: { value: 'cashier' } })

    expect(screen.queryByText('Barangay Health Worker')).not.toBeInTheDocument()
    expect(screen.getByText('Cashier')).toBeInTheDocument()
  })

  it('filters the grid from the sidebar filters', async () => {
    listJobs.mockResolvedValue({
      jobs: [
        job({ id: 'job-1', location: 'Poblacion', requirements: 'Experience: 1 year\nCommunication' }),
        job({ id: 'job-2', title: 'Cashier', location: 'Bagbaguin', requirements: 'Experience: 4 years\nCustomer Service' }),
      ],
      total: 2,
    })
    await renderJobs()

    fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: 'Bagbaguin' } })

    expect(screen.queryByText('Barangay Health Worker')).not.toBeInTheDocument()
    expect(screen.getByText('Cashier')).toBeInTheDocument()
  })

  it('clears every sidebar filter and the search with Reset all filters', async () => {
    listJobs.mockResolvedValue({
      jobs: [
        job({ id: 'job-1', location: 'Poblacion', requirements: 'Experience: 1 year\nCommunication' }),
        job({ id: 'job-2', title: 'Cashier', location: 'Bagbaguin', requirements: 'Experience: 4 years\nCustomer Service' }),
      ],
      total: 2,
    })
    await renderJobs()

    fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: 'Bagbaguin' } })
    fireEvent.change(screen.getByLabelText('Search your recommendations'), { target: { value: 'cashier' } })
    expect(screen.queryByText('Barangay Health Worker')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /reset all filters/i }))

    expect(screen.getByText('Barangay Health Worker')).toBeInTheDocument()
    expect(screen.getByText('Cashier')).toBeInTheDocument()
    expect(screen.getByLabelText('Barangay')).toHaveValue('')
    expect(screen.getByLabelText('Search your recommendations')).toHaveValue('')
  })
})
