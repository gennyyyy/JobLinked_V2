import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

function statCard(label) {
  const labelEl = screen.getByText(label)
  return labelEl.parentElement.querySelector('p').textContent
}

async function renderJobs() {
  render(
    <MemoryRouter>
      <Jobs />
    </MemoryRouter>
  )
  return screen.findByRole('heading', { name: /browse verified openings/i })
}

describe('Jobs dashboard figures', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports the API total, plus page-scoped counts that say so', async () => {
    listJobs.mockResolvedValue({
      jobs: [
        job({ id: 'job-1', location: 'Poblacion', employment_type: 'Full-time' }),
        job({ id: 'job-2', location: 'Poblacion', employment_type: 'Full-time' }),
        job({ id: 'job-3', location: 'Bulac', employment_type: 'Part-time' }),
      ],
      total: 42,
      page: 1,
      pageSize: 10,
    })

    await renderJobs()

    // Server total, not the 10 rows on screen.
    expect(statCard('Openings')).toBe('42')
    expect(screen.getByText('42 active positions available in Santa Maria')).toBeInTheDocument()
    // Honest, scoped copies instead of the static-barangay / page totals.
    expect(statCard('Barangays on This Page')).toBe('2')
    expect(statCard('Full-time on This Page')).toBe('2')
  })
})
