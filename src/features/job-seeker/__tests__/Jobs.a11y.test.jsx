import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Jobs from '../Jobs'
import { listJobs } from '../../../shared/services/jobs'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1', skills: [] } }),
}))

vi.mock('../../../shared/services/jobs', () => ({
  listJobs: vi.fn(),
}))

function job(overrides = {}) {
  return {
    id: 'job-1',
    title: 'Barangay Health Worker',
    location: 'Poblacion',
    employment_type: 'Full-time',
    work_arrangement: 'On-site',
    vacancies: 2,
    employers: { company_name: 'Santa Maria Health Office' },
    ...overrides,
  }
}

async function renderJobs() {
  render(
    <MemoryRouter>
      <Jobs />
    </MemoryRouter>
  )
  return screen.findByRole('heading', { name: /browse verified openings/i })
}

describe('Jobs accessibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('labels the header search field', async () => {
    listJobs.mockResolvedValue({ jobs: [job()], total: 1 })
    await renderJobs()
    expect(screen.getByLabelText('Search jobs by title')).toBeInTheDocument()
  })

  it('announces a failed load in a live region', async () => {
    listJobs.mockRejectedValue(new Error('Job board unreachable'))
    await renderJobs()
    await screen.findByText('Job board unreachable')
    expect(screen.getByRole('alert')).toHaveTextContent('Job board unreachable')
  })

  it('closes the filters dialog on Escape', async () => {
    listJobs.mockResolvedValue({ jobs: [job()], total: 1 })
    await renderJobs()
    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
