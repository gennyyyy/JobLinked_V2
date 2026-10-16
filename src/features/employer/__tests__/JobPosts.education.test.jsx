import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobPosts from '../JobPosts'
import { getEmployer } from '../../../shared/services/auth'
import { listEmployerJobs, createJob, updateJob } from '../../../shared/services/jobs'

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
}))

const APPROVED_EMPLOYER = { id: 'emp-1', name: 'Santa Maria Trading', accreditation_status: 'approved' }

const JOB = {
  id: 'job-1',
  title: 'Administrative Officer',
  office: 'Mayor\u2019s Office',
  description: 'Handle records and permits.',
  requirements: 'Education: High School Graduate\nAt least 2 years relevant work experience',
  salary_min: 15000,
  salary_max: 20000,
  employment_type: 'Full-time',
  work_arrangement: 'On-site',
  location: 'Poblacion',
  vacancies: 1,
  deadline: null,
  instructions: '',
  benefits: null,
  tags: [],
  status: 'published',
}

function renderJobPosts() {
  getEmployer.mockResolvedValue(APPROVED_EMPLOYER)
  return render(
    <MemoryRouter>
      <JobPosts />
    </MemoryRouter>
  )
}

async function openCreateForm() {
  listEmployerJobs.mockResolvedValue({ data: [], total: [].length, page: 1, pageSize: 25 })
  renderJobPosts()
  const openBtn = await screen.findByRole('button', { name: /post a vacancy/i })
  await waitFor(() => expect(openBtn).toBeEnabled())
  fireEvent.click(openBtn)
}

async function openEditForm() {
  listEmployerJobs.mockResolvedValue({ data: [JOB], total: [JOB].length, page: 1, pageSize: 25 })
  renderJobPosts()
  const editBtn = await screen.findByTitle('Edit Job')
  fireEvent.click(editBtn)
}

// The create flow requires title, description, and barangay location before it will save.
async function fillRequiredCreateFields() {
  fireEvent.change(await screen.findByPlaceholderText(/Administrative Officer, Welder/), {
    target: { value: 'Welder' },
  })
  fireEvent.change(screen.getByPlaceholderText(/Outline key duties/), {
    target: { value: 'Weld metal parts.' },
  })
  fireEvent.click(screen.getByRole('button', { name: /select barangay/i }))
  fireEvent.click(await screen.findByRole('option', { name: 'Poblacion' }))
}

const educationSelect = () => screen.getByLabelText(/education requirement/i)

describe('JobPosts education requirement dropdown', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends the chosen level in the saved requirements', async () => {
    await openCreateForm()
    await fillRequiredCreateFields()

    fireEvent.change(educationSelect(), { target: { value: 'College Graduate' } })
    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() => expect(createJob).toHaveBeenCalled())
    expect(createJob.mock.calls[0][1].requirements).toBe('Education: College Graduate')
  })

  it('reflects the stored education line when editing a job', async () => {
    await openEditForm()

    expect(educationSelect()).toHaveValue('High School Graduate')
  })

  it('changing the level preserves other lines and does not duplicate the education line', async () => {
    await openEditForm()

    fireEvent.change(educationSelect(), { target: { value: 'College Graduate' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes as draft/i }))

    await waitFor(() => expect(updateJob).toHaveBeenCalled())
    expect(updateJob.mock.calls[0][1].requirements).toBe(
      'Education: College Graduate\nAt least 2 years relevant work experience'
    )
  })
})
