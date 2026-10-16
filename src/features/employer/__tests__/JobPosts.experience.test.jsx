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
  requirements: 'Experience: 2 years\nAt least 1 year relevant work experience',
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

async function openEditForm(job = JOB) {
  listEmployerJobs.mockResolvedValue({ data: [job], total: [job].length, page: 1, pageSize: 25 })
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

const experienceSelect = () => screen.getByLabelText(/work experience required/i)
const customInput = () => screen.getByLabelText(/number of years of experience required/i)

describe('JobPosts work experience select', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends the no-experience line when "No experience required" is selected', async () => {
    await openCreateForm()
    await fillRequiredCreateFields()

    fireEvent.change(experienceSelect(), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() => expect(createJob).toHaveBeenCalled())
    expect(createJob.mock.calls[0][1].requirements).toBe('Experience: No experience required')
  })

  it('sends the chosen preset in the saved requirements', async () => {
    await openCreateForm()
    await fillRequiredCreateFields()

    fireEvent.change(experienceSelect(), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() => expect(createJob).toHaveBeenCalled())
    expect(createJob.mock.calls[0][1].requirements).toBe('Experience: 2 years')
  })

  it('reveals the number input for Custom… and sends the typed years', async () => {
    await openCreateForm()
    await fillRequiredCreateFields()

    expect(screen.queryByLabelText(/number of years of experience required/i)).toBeNull()
    fireEvent.change(experienceSelect(), { target: { value: 'custom' } })
    fireEvent.change(customInput(), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() => expect(createJob).toHaveBeenCalled())
    expect(createJob.mock.calls[0][1].requirements).toBe('Experience: 7 years')
  })

  it('opens a job with a non-preset experience on Custom… with the value filled in', async () => {
    await openEditForm({ ...JOB, requirements: 'Experience: 4 years\nAt least 1 year relevant work experience' })

    expect(experienceSelect()).toHaveValue('custom')
    expect(customInput()).toHaveValue(4)
  })

  it('preselects a preset experience and does not duplicate the line', async () => {
    await openEditForm()

    expect(experienceSelect()).toHaveValue('2')
    fireEvent.click(screen.getByRole('button', { name: /save changes as draft/i }))

    await waitFor(() => expect(updateJob).toHaveBeenCalled())
    expect(updateJob.mock.calls[0][1].requirements).toBe(
      'Experience: 2 years\nAt least 1 year relevant work experience'
    )
  })

  it('preserves other lines in every case', async () => {
    await openEditForm()

    fireEvent.change(experienceSelect(), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes as draft/i }))

    await waitFor(() => expect(updateJob).toHaveBeenCalled())
    expect(updateJob.mock.calls[0][1].requirements).toBe(
      'Experience: 5 years\nAt least 1 year relevant work experience'
    )
  })
})
