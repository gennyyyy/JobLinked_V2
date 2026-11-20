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

// jsdom ships no matchMedia; the component reads it once at mount and the
// tests decide the starting state.
function setViewport(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

function renderBrowser(props = {}) {
  return render(
    <MemoryRouter>
      <JobsBrowser jobHref={(id) => `/jobs/${id}`} {...props} />
    </MemoryRouter>,
  )
}

function refineToggle() {
  return screen.getByRole('button', { name: /refine results/i })
}

function refinePanel() {
  return document.getElementById(refineToggle().getAttribute('aria-controls'))
}

function cardTitles() {
  return [...document.querySelectorAll('.job-card [data-slot="card-title"]')].map((node) => node.textContent)
}

describe('JobsBrowser layout', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    listJobs.mockResolvedValue({ jobs: JOBS, total: JOBS.length })
    setViewport(false)
  })

  it('renders the skills-based matching panel before the results', async () => {
    renderBrowser()

    const matching = screen.getByRole('region', { name: 'Job matching mode' })
    const toggle = refineToggle()
    await screen.findByText('Administrative Assistant')
    const firstCard = document.querySelector('.job-card')

    expect(matching.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(matching.compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /narrow your search/i })).toBeNull()
  })

  it('starts with refinement collapsed below 1024px', async () => {
    renderBrowser()
    await screen.findByText('Administrative Assistant')

    const toggle = refineToggle()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Refine results' })).toBeNull()
    expect(refinePanel()).not.toBeVisible()
  })

  it('starts with refinement open at 1024px and above', async () => {
    setViewport(true)
    renderBrowser()
    await screen.findByText('Administrative Assistant')

    const toggle = refineToggle()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('region', { name: 'Refine results' })
    expect(panel).toBeVisible()

    // Every search and filter control is present, labelled, and enabled.
    expect(within(panel).getByLabelText('Search your recommendations')).toBeEnabled()
    for (const label of ['Barangay', 'Job field', 'Employment type', 'Monthly salary', 'Experience level']) {
      expect(within(panel).getByLabelText(label)).toBeEnabled()
    }
    expect(within(panel).getByRole('button', { name: /reset all filters/i })).toBeEnabled()
  })

  it('toggles the refinement panel open and closed', async () => {
    renderBrowser()
    await screen.findByText('Administrative Assistant')

    fireEvent.click(refineToggle())
    expect(refineToggle()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Refine results' })).toBeVisible()
    expect(screen.getByLabelText('Search your recommendations')).toBeVisible()

    fireEvent.click(refineToggle())
    expect(refineToggle()).toHaveAttribute('aria-expanded', 'false')
    expect(refinePanel()).not.toBeVisible()
    expect(screen.queryByRole('region', { name: 'Refine results' })).toBeNull()
  })

  it('narrows the results by the structured job field', async () => {
    renderBrowser()
    await screen.findByText('Administrative Assistant')

    fireEvent.click(refineToggle())
    fireEvent.change(screen.getByLabelText('Job field'), { target: { value: 'Information Technology' } })

    await waitFor(() => expect(cardTitles()).toEqual(['Junior Web Developer']))
    expect(screen.queryByText('Administrative Assistant')).toBeNull()
    expect(screen.getByText('1 matching vacancies')).toBeInTheDocument()
  })

  it('keeps the saved-jobs variant search-only, without a matching panel', async () => {
    setViewport(true)
    renderBrowser({ saved: true })

    expect(await screen.findByRole('heading', { level: 1, name: 'Keep good opportunities close.' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Job matching mode' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Skills-based matching' })).toBeNull()
    expect(screen.queryByRole('button', { name: /refine results/i })).toBeNull()
    expect(screen.getByLabelText('Search saved opportunities')).toBeInTheDocument()
  })
})
