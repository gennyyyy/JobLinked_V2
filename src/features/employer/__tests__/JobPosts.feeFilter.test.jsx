import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobPosts from '../JobPosts'
import { getEmployer } from '../../../shared/services/auth'
import { listEmployerJobs, createJob } from '../../../shared/services/jobs'
import { getFeeTerms } from '../../../shared/services/feeFilter'

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

vi.mock('../../../shared/services/feeFilter', () => ({
  getFeeTerms: vi.fn(),
}))

const APPROVED_EMPLOYER = { id: 'emp-1', name: 'Santa Maria Trading', accreditation_status: 'approved' }

function job(overrides = {}) {
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

async function openCreateForm() {
  getEmployer.mockResolvedValue(APPROVED_EMPLOYER)
  listEmployerJobs.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 25 })
  getFeeTerms.mockResolvedValue({ block: [], hold: [] })
  render(
    <MemoryRouter>
      <JobPosts />
    </MemoryRouter>
  )
  const openBtn = (await screen.findAllByRole('button', { name: /create a vacancy/i }))[0]
  await waitFor(() => expect(openBtn).toBeEnabled())
  fireEvent.click(openBtn)
  await screen.findByRole('heading', { name: /post a municipal vacancy/i })
}

async function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText(/Administrative Officer/), { target: { value: 'Welder' } })
  fireEvent.change(screen.getByPlaceholderText(/Outline key duties/), { target: { value: 'Weld metal parts.' } })
  fireEvent.click(screen.getByRole('button', { name: /select barangay/i }))
  fireEvent.click(screen.getByRole('option', { name: 'Bulac' }))
}

describe('JobPosts fee filter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the server message on a 422 FEE_POLICY_BLOCKED response', async () => {
    createJob.mockRejectedValue({
      status: 422,
      error: { code: 'FEE_POLICY_BLOCKED', message: 'Job post blocked by PESO fee policy: registration fee' },
    })
    await openCreateForm()
    await fillRequiredFields()
    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Job post blocked by PESO fee policy: registration fee')
    )
  })

  it('shows the PESO review success message when a published post is held', async () => {
    createJob.mockResolvedValue({ id: 'job-2', status: 'pending' })
    await openCreateForm()
    await fillRequiredFields()
    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Submitted for PESO review')
    )
  })

  it('renders the Pending review badge for a pending job', async () => {
    getEmployer.mockResolvedValue(APPROVED_EMPLOYER)
    listEmployerJobs.mockResolvedValue({ data: [job({ status: 'pending' })], total: 1, page: 1, pageSize: 25 })
    getFeeTerms.mockResolvedValue({ block: [], hold: [] })
    render(
      <MemoryRouter>
        <JobPosts />
      </MemoryRouter>
    )
    const titleBtn = await screen.findByRole('button', { name: 'Warehouse Associate' })
    const row = titleBtn.closest('tr')
    expect(within(row).getByText('Pending review')).toBeInTheDocument()
  })
})
