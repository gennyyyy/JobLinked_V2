import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BrowseJobs from '../BrowseJobs'
import { listJobs } from '../../services/jobs'

vi.mock('../../services/jobs', () => ({
  listJobs: vi.fn(),
}))

function job(overrides = {}) {
  return {
    id: 'job-1',
    title: 'Barangay Health Worker',
    description: 'Assist residents with health programs.',
    requirements: 'Nursing degree\nBLS certified\nNight shifts',
    location: 'Poblacion',
    employment_type: 'Full-time',
    work_arrangement: 'On-site',
    salary_min: 12000,
    salary_max: 15000,
    created_at: '2026-10-14T14:01:47',
    vacancies: 1,
    employers: { company_name: 'Santa Maria Health Office' },
    ...overrides,
  }
}

function renderBrowseJobs(props = {}) {
  return render(
    <MemoryRouter>
      <BrowseJobs jobHref={(id) => `/jobs/${id}`} {...props} />
    </MemoryRouter>,
  )
}

// Comma-terminated input commits the tag, same as pressing Enter.
function typeSkill(value) {
  const input = screen.getByLabelText('Skills')
  fireEvent.change(input, { target: { value: `${value},` } })
}

describe('BrowseJobs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the API rows and links each title to jobHref(id)', async () => {
    listJobs.mockResolvedValue({ jobs: [job()], total: 1 })

    renderBrowseJobs()

    const link = await screen.findByRole('link', { name: 'Barangay Health Worker' })
    expect(link).toHaveAttribute('href', '/jobs/job-1')
    expect(screen.getByText('Displaying 1 out of 1 jobs:')).toBeInTheDocument()
    // Bulleted requirements, capped at 3 lines.
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('link', { name: 'See more' })).toHaveAttribute('href', '/jobs/job-1')
  })

  it('adds a skill chip and never exceeds the 3-chip cap', async () => {
    listJobs.mockResolvedValue({ jobs: [], total: 0 })

    renderBrowseJobs()

    typeSkill('Welding')
    typeSkill('Cooking')
    typeSkill('Driving')
    typeSkill('Plumbing')

    expect(screen.getByLabelText('Remove Welding')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove Cooking')).toBeInTheDocument()
    expect(screen.getByLabelText('Remove Driving')).toBeInTheDocument()
    expect(screen.queryByLabelText('Remove Plumbing')).toBeNull()
  })

  it('seeds initial skills and re-fetches with them on Refine Search Results', async () => {
    listJobs.mockResolvedValue({ jobs: [], total: 0 })

    renderBrowseJobs({ initialSkills: ['Welding', 'Cooking', 'Driving', 'Plumbing'] })

    await waitFor(() => expect(listJobs).toHaveBeenCalledWith(expect.objectContaining({ skills: 'Welding, Cooking, Driving' })))

    fireEvent.click(screen.getByRole('button', { name: 'Refine Search Results' }))

    await waitFor(() => expect(listJobs).toHaveBeenLastCalledWith(expect.objectContaining({ skills: 'Welding, Cooking, Driving', page: 1 })))
  })

  it('re-fetches from the search bar and offers a filter reset when nothing matches', async () => {
    listJobs.mockResolvedValue({ jobs: [], total: 0 })

    renderBrowseJobs()

    fireEvent.change(screen.getByPlaceholderText(/search for a job title or company/i), { target: { value: 'nurse' } })
    fireEvent.change(screen.getByPlaceholderText('Location'), { target: { value: 'Poblacion' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => expect(listJobs).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'nurse', location: 'Poblacion', page: 1 })))
    expect(await screen.findByText(/no jobs match your search/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument()
  })
})
