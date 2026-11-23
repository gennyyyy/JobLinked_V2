import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobsBrowser from '../JobsBrowser'
import { listJobs } from '@/shared/services/jobs'

vi.mock('@/shared/services/jobs', () => ({ listJobs: vi.fn() }))
vi.mock('@/shared/services/ai', () => ({ matchJobs: vi.fn() }))
vi.mock('@/shared/hooks/useAuth', () => ({ default: () => ({ user: null }) }))

const JOBS = [
  {
    id: 'j1',
    title: 'Administrative Assistant',
    status: 'published',
    field: 'Administrative & Office',
    location: 'Poblacion',
    employment_type: 'Full-time',
    salary_min: 18000,
    salary_max: 22000,
    created_at: '2026-10-18T00:00:00.000Z',
    employers: { company_name: 'Northfield Business Solutions', accreditation_status: 'approved' },
  },
  {
    id: 'j2',
    title: 'Junior Web Developer',
    status: 'published',
    field: 'Information Technology',
    location: 'Guyong',
    employment_type: 'Full-time',
    salary_min: 25000,
    salary_max: 35000,
    created_at: '2026-10-10T00:00:00.000Z',
    employers: { company_name: 'Hiraya Digital Studio', accreditation_status: 'approved' },
  },
  {
    id: 'j3',
    title: 'Warehouse Helper',
    status: 'published',
    field: 'Logistics & Delivery',
    location: 'Bagbaguin',
    employment_type: 'Full-time',
    salary_min: 14000,
    salary_max: 16000,
    created_at: '2026-10-05T00:00:00.000Z',
    employers: { company_name: 'Santa Maria Logistics', accreditation_status: 'approved' },
  },
]

function renderBrowser(props = {}) {
  return render(
    <MemoryRouter>
      <JobsBrowser jobHref={(id) => `/jobs/${id}`} {...props} />
    </MemoryRouter>,
  )
}

function cardTitles() {
  return [...document.querySelectorAll('.job-card [data-slot="card-title"]')].map((node) => node.textContent)
}

describe('JobsBrowser layout', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    listJobs.mockResolvedValue({ jobs: JOBS, total: JOBS.length })
  })

  it('keeps the search, matching, and every filter in the sidebar beside the results', async () => {
    renderBrowser()
    expect(await screen.findByText('Administrative Assistant')).toBeInTheDocument()

    const sidebar = screen.getByRole('complementary')
    expect(within(sidebar).getByLabelText('Search your recommendations')).toBeEnabled()
    expect(within(sidebar).getByRole('button', { name: 'Skills-based matching' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('heading', { level: 2, name: 'Narrow your search' })).toBeInTheDocument()
    for (const label of ['Barangay', 'Job field', 'Employment type', 'Monthly salary', 'Experience level']) {
      expect(within(sidebar).getByLabelText(label)).toBeEnabled()
    }
    expect(within(sidebar).getByRole('button', { name: /reset all filters/i })).toBeEnabled()

    // The results column sits outside the sidebar, and the old disclosure is gone.
    expect(sidebar.contains(document.querySelector('.job-card'))).toBe(false)
    expect(screen.queryByRole('region', { name: 'Refine results' })).toBeNull()
    expect(screen.queryByRole('button', { name: /refine results/i })).toBeNull()
  })

  it('narrows the results by the structured job field', async () => {
    renderBrowser()
    await screen.findByText('Administrative Assistant')

    fireEvent.change(screen.getByLabelText('Job field'), { target: { value: 'Information Technology' } })

    await waitFor(() => expect(cardTitles()).toEqual(['Junior Web Developer']))
    expect(screen.queryByText('Administrative Assistant')).toBeNull()
    expect(screen.getByText('1 matching vacancies')).toBeInTheDocument()
  })

  it('keeps the saved-jobs variant search-only, without a sidebar', async () => {
    renderBrowser({ saved: true })

    expect(screen.queryByRole('complementary')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Skills-based matching' })).toBeNull()
    expect(screen.queryByRole('heading', { name: /narrow your search/i })).toBeNull()
    expect(screen.getByLabelText('Search saved opportunities')).toBeInTheDocument()
  })
})
