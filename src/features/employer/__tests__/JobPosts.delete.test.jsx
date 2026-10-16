import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobPosts from '../JobPosts'
import { getEmployer } from '../../../shared/services/auth'
import { listEmployerJobs, deleteJob } from '../../../shared/services/jobs'

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
    employment_type: 'Full-time',
    work_arrangement: 'On-site',
    location: 'Bulac',
    vacancies: 2,
    status: 'published',
    created_at: '2026-01-01T00:00:00.000Z',
    applicant_count: 3,
    ...overrides,
  }
}

async function renderJobPosts(posts) {
  getEmployer.mockResolvedValue(APPROVED_EMPLOYER)
  listEmployerJobs.mockResolvedValue({ data: posts, total: posts.length, page: 1, pageSize: 25 })
  deleteJob.mockResolvedValue({ deleted: true, applications: posts[0]?.applicant_count ?? 0 })
  render(
    <MemoryRouter>
      <JobPosts />
    </MemoryRouter>
  )
  return screen.findByRole('button', { name: /delete posting permanently/i })
}

describe('JobPosts delete action', () => {
  beforeEach(() => vi.clearAllMocks())

  it('confirms with the exact application count, then calls deleteJob with the job id', async () => {
    const deleteBtn = await renderJobPosts([job({ applicant_count: 3 })])

    fireEvent.click(deleteBtn)

    expect(
      await screen.findByText('This permanently deletes "Warehouse Associate" and its 3 application(s). This cannot be undone.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteJob).toHaveBeenCalledWith('job-1'))
  })

  it('omits the application count when there are none', async () => {
    const deleteBtn = await renderJobPosts([job({ applicant_count: 0 })])

    fireEvent.click(deleteBtn)

    expect(
      await screen.findByText('This permanently deletes "Warehouse Associate". This cannot be undone.')
    ).toBeInTheDocument()
    expect(screen.queryByText(/application\(s\)/)).not.toBeInTheDocument()
  })
})
