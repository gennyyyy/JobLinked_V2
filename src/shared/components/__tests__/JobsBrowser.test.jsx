import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobsBrowser from '../JobsBrowser'
import { listJobs } from '@/shared/services/jobs'

vi.mock('@/shared/services/jobs', () => ({ listJobs: vi.fn() }))
vi.mock('@/shared/services/ai', () => ({ matchJobs: vi.fn() }))

// Public visitor: signed out, so cards carry no save control.
vi.mock('@/shared/hooks/useAuth', () => ({ default: () => ({ user: null }) }))

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

  it('links each job to jobHref(id)', async () => {
    renderBrowser()

    const link = await screen.findByRole('link', { name: 'Barangay Health Worker' })
    expect(link).toHaveAttribute('href', '/jobs/job-1')
    const card = within(link.closest('.job-card'))
    expect(card.getByText(/₱12,000/)).toBeInTheDocument()
    expect(card.getByText('Poblacion')).toBeInTheDocument()
    // The type shows in the metadata line and again as the legacy field badge
    // (these fixtures predate structured fields).
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

  it('offers only structured fields and leaves legacy rows under All fields', async () => {
    listJobs.mockResolvedValue({
      jobs: [
        { ...JOBS[0], field: 'Healthcare' },
        { ...JOBS[1], field: 'Information Technology' },
        { ...JOBS[0], id: 'job-3', title: 'Warehouse Helper', field: null, tags: ['Urgent Hiring'] },
      ],
      total: 3,
    })
    renderBrowser()
    await screen.findByText('Barangay Health Worker')

    const fieldSelect = screen.getByLabelText('Job field')
    const options = within(fieldSelect).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['All fields', 'Healthcare', 'Information Technology'])

    fireEvent.change(fieldSelect, { target: { value: 'Healthcare' } })

    await waitFor(() => expect(screen.queryByText('Junior Web Developer')).toBeNull())
    expect(screen.queryByText('Warehouse Helper')).toBeNull()
    expect(screen.getByText('Barangay Health Worker')).toBeInTheDocument()
    expect(screen.getByText('1 matching vacancies')).toBeInTheDocument()
  })

  it('loads every page when the API reports more jobs than one request returns', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...JOBS[0],
      id: `job-page-1-${index}`,
      title: `Paged Vacancy ${index + 1}`,
      created_at: '2026-10-01T00:00:00.000Z',
    }))
    const secondPage = [{ ...JOBS[1], id: 'job-page-2-1', created_at: '2026-09-30T00:00:00.000Z' }]
    listJobs
      .mockResolvedValueOnce({ jobs: firstPage, total: 101 })
      .mockResolvedValueOnce({ jobs: secondPage, total: 101 })

    renderBrowser()

    expect(await screen.findByText('101 matching vacancies')).toBeInTheDocument()
    expect(screen.getByText('1–15 of 101 jobs')).toBeInTheDocument()
    // The pager centers across the whole page, so it sits after the two-column
    // row (sidebar + results), never inside either.
    const results = document.querySelector('.job-card').closest('.min-w-0.flex-1')
    const pager = screen.getByText(/of 101 jobs/).parentElement
    expect(results.contains(pager)).toBe(false)
    expect(pager.closest('aside')).toBeNull()
    expect(listJobs).toHaveBeenCalledTimes(2)
    expect(listJobs).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 100, order: 'created_at.desc' })
    expect(listJobs).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 100, order: 'created_at.desc' })
  })

  it('shows the empty state instead of crashing on a malformed payload', async () => {
    listJobs.mockResolvedValue({})

    renderBrowser()

    expect(await screen.findByText('No jobs match this search.')).toBeInTheDocument()
    expect(screen.getByText('0 matching vacancies')).toBeInTheDocument()
  })
})
