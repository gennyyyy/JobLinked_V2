import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobPosts from '../JobPosts'
import { getEmployer } from '../../../shared/services/auth'
import { listEmployerJobs, createJob, updateJob } from '../../../shared/services/jobs'
import { getReferenceValues } from '../../../shared/services/reference'

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

// Keep the pickers offline; the shared hook's module cache owns the promise.
vi.mock('../../../shared/services/reference', () => ({
  getReferenceValues: vi.fn(),
}))

const APPROVED_EMPLOYER = { id: 'emp-1', name: 'Santa Maria Trading', accreditation_status: 'approved' }
const FIELDS = ['Construction', 'Customer Service', 'Information Technology']
const SKILLS = [
  'Cashiering', 'Communication', 'Cooking', 'Customer Service', 'Data Entry', 'Driving',
  'Electrical Wiring', 'Food Preparation', 'Forklift Operation', 'Housekeeping', 'Inventory',
  'Masonry', 'MS Excel', 'Painting', 'Plumbing', 'Sales', 'Sewing', 'Teamwork', 'Welding',
  'Cleaning', 'Carpentry',
]

function renderJobPosts() {
  return render(
    <MemoryRouter>
      <JobPosts />
    </MemoryRouter>
  )
}

async function openCreateForm() {
  listEmployerJobs.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 25 })
  renderJobPosts()
  const openBtn = (await screen.findAllByRole('button', { name: /create a vacancy/i }))[0]
  await waitFor(() => expect(openBtn).toBeEnabled())
  fireEvent.click(openBtn)
}

async function openEditForm(job) {
  listEmployerJobs.mockResolvedValue({ data: [job], total: 1, page: 1, pageSize: 25 })
  renderJobPosts()
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${job.title}` }))
  await screen.findByRole('menu')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit posting' }))
}

async function fieldSelect() {
  const select = await screen.findByLabelText(/^field/i)
  await waitFor(() => expect(select).toBeEnabled())
  return select
}

// Type into the skills tag box and commit the chip the way a user would.
function skillsInput() {
  return screen.getByRole('combobox', { name: /skills required/i })
}

function typeSkill(text, key = 'Enter') {
  const input = skillsInput()
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key })
}

// Title, description, and barangay are the pre-existing required fields.
function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText(/Administrative Officer, Welder/), {
    target: { value: 'Welder' },
  })
  fireEvent.change(screen.getByPlaceholderText(/Outline key duties/), {
    target: { value: 'Weld metal parts.' },
  })
  fireEvent.click(screen.getByRole('button', { name: /select barangay/i }))
  fireEvent.click(screen.getByRole('option', { name: 'Bulac' }))
}

const JOB = {
  id: 'job-1',
  title: 'Customer Service Associate',
  office: 'Main Branch',
  field: 'Customer Service',
  skills: ['Cashiering', 'Customer Service'],
  description: 'Handle customer concerns.',
  requirements: '',
  salary_min: 15000,
  salary_max: 18000,
  employment_type: 'Full-time',
  work_arrangement: 'On-site',
  location: 'Poblacion',
  vacancies: 2,
  deadline: null,
  instructions: '',
  benefits: null,
  tags: ['Day Shift'],
  status: 'published',
}

describe('JobPostFormDialog field and skills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getEmployer.mockResolvedValue(APPROVED_EMPLOYER)
    getReferenceValues.mockImplementation((category) =>
      Promise.resolve(category === 'job_field' ? FIELDS : SKILLS)
    )
    createJob.mockResolvedValue({})
    updateJob.mockResolvedValue({})
  })

  it('saves the chosen field and skills in the create payload', async () => {
    await openCreateForm()
    fillRequiredFields()
    fireEvent.change(await fieldSelect(), { target: { value: 'Construction' } })
    typeSkill('MS Excel')
    typeSkill('Welding')

    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() =>
      expect(createJob).toHaveBeenCalledWith(
        'emp-1',
        expect.objectContaining({ field: 'Construction', skills: ['MS Excel', 'Welding'] })
      )
    )
  })

  it('keeps Highlights in tags and never in skills', async () => {
    await openCreateForm()
    fillRequiredFields()
    fireEvent.change(await fieldSelect(), { target: { value: 'Construction' } })

    expect(screen.getByText(/attributes shown on the job card/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Urgent Hiring' }))
    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }))

    await waitFor(() => expect(createJob).toHaveBeenCalled())
    const payload = createJob.mock.calls[0][1]
    expect(payload.tags).toEqual(['Urgent Hiring'])
    expect(payload.skills).toEqual([])
  })

  it('pre-fills field and skills when editing', async () => {
    await openEditForm(JOB)

    expect(await fieldSelect()).toHaveValue('Customer Service')
    expect(await screen.findByRole('button', { name: 'Remove Cashiering' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Customer Service' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Welding' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /save changes as draft/i }))

    await waitFor(() =>
      expect(updateJob).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({
          field: 'Customer Service',
          skills: ['Cashiering', 'Customer Service'],
        })
      )
    )
  })

  it('blocks a new posting without a Field and shows the message', async () => {
    await openCreateForm()
    fillRequiredFields()

    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/select the job field/i)
    expect(createJob).not.toHaveBeenCalled()

    fireEvent.change(await fieldSelect(), { target: { value: 'Information Technology' } })
    fireEvent.click(screen.getByRole('button', { name: /publish job/i }))

    await waitFor(() =>
      expect(createJob).toHaveBeenCalledWith(
        'emp-1',
        expect.objectContaining({ field: 'Information Technology' })
      )
    )
  })

  it('keeps a legacy posting editable with Field "Not set"', async () => {
    await openEditForm({ ...JOB, field: null, skills: [] })

    expect(await fieldSelect()).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: /save changes as draft/i }))

    await waitFor(() =>
      expect(updateJob).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ field: null, skills: [] })
      )
    )
  })

  it('shows the 20-skill limit and stops adding at the cap', async () => {
    await openCreateForm()

    expect(await screen.findByText(/up to 20/i)).toBeInTheDocument()

    for (const skill of SKILLS.slice(0, 20)) {
      typeSkill(skill)
      await screen.findByRole('button', { name: `Remove ${skill}` })
    }

    expect(screen.getAllByRole('button', { name: /^remove /i })).toHaveLength(20)

    typeSkill('Carpentry')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByText('Carpentry')).toBeNull()
  }, 15000)
})
