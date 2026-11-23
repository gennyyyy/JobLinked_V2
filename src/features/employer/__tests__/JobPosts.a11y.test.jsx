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
  return screen.findByText('No job posts match this view.')
}

async function openForm() {
  await renderJobPosts([])
  fireEvent.click((await screen.findAllByRole('button', { name: /create a vacancy/i }))[0])
  return screen.findByRole('heading', { name: /post a municipal vacancy/i })
}

// The row actions live behind a single overflow menu; it renders in a portal.
async function openRowMenu() {
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Warehouse Associate' }))
  return screen.findByRole('menu')
}

describe('JobPosts accessibility', () => {
  beforeEach(() => vi.clearAllMocks())

  it('labels every control in the job-post form', async () => {
    await openForm()
    for (const name of [
      /^job title/i, /department \/ office/i, /^employment type/i, /^work arrangement/i,
      /barangay location/i, /number of vacancies/i, /minimum salary/i, /maximum salary/i,
      /application deadline/i, /job description/i, /education requirement/i,
      /work experience/i, /application instructions/i, /^field/i,
    ]) {
      expect(screen.getByLabelText(name).tagName).toBeTruthy()
    }
    expect(screen.getByRole('combobox', { name: /skills required/i })).toBeInTheDocument()
  })

  it('names the chip groups for assistive technology', async () => {
    await openForm()
    expect(screen.getByRole('group', { name: /benefits & perks/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /^highlights/i })).toBeInTheDocument()
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

  // ADR-021 signs a signed-in user out on any public route, so row actions must
  // stay inside the employer portal: one overflow menu, no public job link.
  it('offers a single actions menu per row instead of separate row buttons', async () => {
    await renderJobPosts()

    expect(screen.getAllByRole('button', { name: 'Actions for Warehouse Associate' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^Edit Warehouse Associate$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'View Warehouse Associate' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'View Warehouse Associate' })).toBeNull()
    expect(document.querySelector('a[href="/jobs/job-1"]')).toBeNull()
  })

  it('lists edit, status, and delete actions for a published row', async () => {
    await renderJobPosts()
    await openRowMenu()

    expect(screen.getByRole('menuitem', { name: 'Edit posting' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Close posting' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete posting' })).toBeInTheDocument()
  })

  it('opens the edit form from the row menu', async () => {
    await renderJobPosts()
    await openRowMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit posting' }))
    expect(await screen.findByRole('heading', { name: 'Edit Job Vacancy' })).toBeInTheDocument()
  })

  it('opens the delete confirmation from the row menu', async () => {
    await renderJobPosts()
    await openRowMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete posting' }))
    expect(
      await screen.findByText('This permanently deletes "Warehouse Associate" and its 3 application(s). This cannot be undone.')
    ).toBeInTheDocument()
  })

  it('shows Publish posting for a draft row', async () => {
    await renderJobPosts([job({ status: 'draft' })])
    await openRowMenu()

    expect(screen.getByRole('menuitem', { name: 'Publish posting' })).toBeInTheDocument()
  })

  // The loader stops before listing jobs for an unaccredited employer, so the
  // guarded "Publish posting" item cannot render at all in that state.
  it('keeps the row menu away from an unaccredited employer', async () => {
    getEmployer.mockResolvedValue({ ...APPROVED_EMPLOYER, accreditation_status: 'pending' })
    listEmployerJobs.mockResolvedValue({ data: [job({ status: 'draft' })], total: 1, page: 1, pageSize: 25 })

    render(
      <MemoryRouter>
        <JobPosts />
      </MemoryRouter>
    )

    expect(await screen.findByText(/publishing is unavailable until PESO approves/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Actions for Warehouse Associate' })).toBeNull()
  })

  it('announces action errors in a live region', async () => {
    changeJobStatus.mockRejectedValue(new Error('Network down'))
    await renderJobPosts()
    await openRowMenu()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Close posting' }))
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

  it('labels the search control', async () => {
    await renderJobPosts()
    expect(screen.getByLabelText(/search job postings/i)).toBeInTheDocument()
  })
})
