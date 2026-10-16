import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobPosts from '../JobPosts'
import { getEmployer } from '../../../shared/services/auth'
import { listEmployerJobs, changeJobStatus } from '../../../shared/services/jobs'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'employer-user-1' } }),
}))

vi.mock('../../../shared/services/auth', () => ({
  getEmployer: vi.fn(),
}))

vi.mock('../../../shared/services/jobs', () => ({
  listEmployerJobs: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  changeJobStatus: vi.fn(),
  duplicateJob: vi.fn(),
  deleteJob: vi.fn(),
}))

const APPROVED_EMPLOYER = { id: 'emp-1', name: 'Santa Maria Trading', accreditation_status: 'approved' }

function job(overrides) {
  return {
    id: 'job-1',
    title: 'Warehouse Associate',
    office: 'Logistics',
    employment_type: 'Full-time',
    work_arrangement: 'On-site',
    location: 'Bulac',
    vacancies: 2,
    status: 'published',
    created_at: '2026-01-01T00:00:00.000Z',
    applicant_count: 3,
    salary_min: 18000,
    salary_max: 25000,
    description: 'Handle inbound stock.',
    requirements: 'Education: High School\nExperience: 2 years',
    benefits: '',
    tags: [],
    deadline: null,
    instructions: '',
    ...overrides,
  }
}

// Waits for the listing table to settle so the page's own load timer is done.
async function renderJobPosts(posts = [job()]) {
  getEmployer.mockResolvedValue(APPROVED_EMPLOYER)
  listEmployerJobs.mockResolvedValue({ data: posts, total: posts.length, page: 1, pageSize: 25 })
  render(
    <MemoryRouter>
      <JobPosts />
    </MemoryRouter>
  )
  if (posts.length) return screen.findByRole('button', { name: 'Warehouse Associate' })
  return screen.findByText('No job listings found')
}

async function openForm() {
  await renderJobPosts([])
  fireEvent.click(await screen.findByRole('button', { name: /post a vacancy/i }))
  return screen.findByRole('heading', { name: /post a municipal vacancy/i })
}

describe('JobPosts accessibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('labels every control in the job-post form', async () => {
    await openForm()
    for (const name of [
      /^job title/i, /department \/ office/i, /^employment type/i, /^work arrangement/i,
      /barangay location/i, /number of vacancies/i, /minimum salary/i, /maximum salary/i,
      /application deadline/i, /job description/i, /education requirement/i,
      /work experience/i, /application instructions/i,
    ]) {
      expect(screen.getByLabelText(name).tagName).toBeTruthy()
    }
  })

  it('names the chip groups for assistive technology', async () => {
    await openForm()
    expect(screen.getByRole('group', { name: /benefits & perks/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /^tags/i })).toBeInTheDocument()
    const chip = screen.getByRole('button', { name: '13th Month Pay' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens the job detail from the row title button, keyboard included', async () => {
    const titleButton = await renderJobPosts()
    expect(screen.queryByRole('dialog')).toBeNull()

    titleButton.focus()
    fireEvent.click(titleButton)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Warehouse Associate' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('announces action errors in a live region', async () => {
    changeJobStatus.mockRejectedValue(new Error('Network down'))
    await renderJobPosts()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network down'))
  })

  it('Escape on the form first asks about unsaved changes, then keeps editing', async () => {
    await openForm()
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Administrative Officer/i), { target: { value: 'Record Keeper' } })

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()

    // While the discard dialog is up it owns Escape; the form stays put.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText(/unsaved changes/i)).toBeNull()
    expect(screen.getByRole('heading', { name: /post a municipal vacancy/i })).toBeInTheDocument()
  })

  it('lets Escape dismiss the barangay dropdown before it will close the form', async () => {
    await openForm()
    fireEvent.click(screen.getByRole('button', { name: /barangay location/i }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByRole('heading', { name: /post a municipal vacancy/i })).toBeInTheDocument()
  })

  it('labels the search and sort controls', async () => {
    await renderJobPosts()
    expect(screen.getByLabelText(/search job postings/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^sort/i)).toBeInTheDocument()
  })
})
