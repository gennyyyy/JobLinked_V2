import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobPosts from '../JobPosts'
import { getEmployer } from '../../../shared/services/auth'
import { listEmployerJobs } from '../../../shared/services/jobs'

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

const emptyPage = { data: [], total: 0, page: 1, pageSize: 25 }

describe('JobPosts empty state (U5)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('warns a non-accredited employer and links to the accreditation page', async () => {
    getEmployer.mockResolvedValue({ id: 'emp-1', accreditation_status: 'pending' })
    listEmployerJobs.mockResolvedValue(emptyPage)

    render(
      <MemoryRouter>
        <JobPosts />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/publishing is unavailable until PESO approves your accreditation/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /review requirements and feedback/i })).toHaveAttribute('href', '/employer/accreditation')
    expect(screen.getByText('Your next opening starts here.')).toBeInTheDocument()
  })

  it('keeps the create advice for approved employers with no posts', async () => {
    getEmployer.mockResolvedValue({ id: 'emp-1', accreditation_status: 'approved' })
    listEmployerJobs.mockResolvedValue(emptyPage)

    render(
      <MemoryRouter>
        <JobPosts />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Your next opening starts here.')).toBeInTheDocument()
    expect(screen.queryByText(/publishing is unavailable/i)).not.toBeInTheDocument()
    expect((screen.getAllByRole('button', { name: /create a vacancy/i })).length).toBeGreaterThan(0)
  })
})
