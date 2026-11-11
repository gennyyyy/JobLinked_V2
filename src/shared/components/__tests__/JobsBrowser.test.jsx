import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobsBrowser from '../JobsBrowser'
import { listJobs } from '@/shared/services/jobs'

vi.mock('@/shared/services/jobs', () => ({ listJobs: vi.fn() }))
vi.mock('@/shared/services/ai', () => ({ matchJobs: vi.fn() }))

// Public visitor: signed out, so cards carry no save control.
vi.mock('@/shared/hooks/useAuth', () => ({ default: () => ({ user: null }) }))

const TITLE = 'Find openings in Santa Maria'
const DESCRIPTION = 'Explore verified job postings from accredited Santa Maria employers. Apply directly through the municipal portal.'

const JOBS = [
  {
    id: 'job-1',
    title: 'Barangay Health Worker',
    status: 'published',
    location: 'Poblacion',
    employment_type: 'Full-time',
    salary_min: 12000,
    salary_max: 15000,
    created_at: '2026-10-14T00:00:00.000Z',
    employers: { company_name: 'Santa Maria Health Office', accreditation_status: 'approved' },
  },
  {
    id: 'job-2',
    title: 'Junior Web Developer',
    status: 'published',
    location: 'Guyong',
    employment_type: 'Part-time',
    salary_min: 25000,
    salary_max: 35000,
    created_at: '2026-10-10T00:00:00.000Z',
    employers: { company_name: 'Hiraya Digital Studio', accreditation_status: 'approved' },
  },
]

function renderBrowser() {
  return render(
    <MemoryRouter>
      <JobsBrowser
        jobHref={(id) => `/jobs/${id}`}
        title={TITLE}
        description={DESCRIPTION}
      />
    </MemoryRouter>,
  )
}

describe('JobsBrowser (public mode)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    listJobs.mockResolvedValue({ jobs: JOBS, total: JOBS.length })
  })

  it('renders the passed heading and links each job to jobHref(id)', async () => {
    renderBrowser()

    const link = await screen.findByRole('link', { name: 'Barangay Health Worker' })
    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument()
    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/jobs/job-1')
    const card = within(link.closest('.job-card'))
    expect(card.getByText(/₱12,000/)).toBeInTheDocument()
    expect(card.getByText('Poblacion')).toBeInTheDocument()
    // The type shows in the metadata line and again as the category badge.
    expect(card.getAllByText('Full-time').length).toBeGreaterThan(0)
  })

  it('filters the cards from the search input', async () => {
    renderBrowser()
    await screen.findByText('Barangay Health Worker')

    fireEvent.change(screen.getByLabelText('Search your recommendations'), { target: { value: 'developer' } })

    await waitFor(() => expect(screen.queryByText('Barangay Health Worker')).toBeNull())
    expect(screen.getByText('Junior Web Developer')).toBeInTheDocument()
  })

  it('filters the cards from the Barangay select', async () => {
    renderBrowser()
    await screen.findByText('Barangay Health Worker')

    fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: 'Guyong' } })

    await waitFor(() => expect(screen.queryByText('Barangay Health Worker')).toBeNull())
    expect(screen.getByText('Junior Web Developer')).toBeInTheDocument()
  })

  it('shows the empty state instead of crashing on a malformed payload', async () => {
    listJobs.mockResolvedValue({})

    renderBrowser()

    expect(await screen.findByText('No matching opportunities in this view.')).toBeInTheDocument()
    expect(screen.getByText('0 matching vacancies')).toBeInTheDocument()
  })
})
