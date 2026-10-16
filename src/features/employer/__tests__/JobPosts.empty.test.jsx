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

describe('JobPosts empty state (U5)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('routes a non-accredited employer to accreditation instead of a dead-end CTA', async () => {
    getEmployer.mockResolvedValue({ id: 'emp-1', accreditation_status: 'pending' })
    listEmployerJobs.mockResolvedValue({ data: [], total: [].length, page: 1, pageSize: 25 })

    render(
      <MemoryRouter>
        <JobPosts />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/must first be accredited by PESO/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view accreditation/i })).toHaveAttribute('href', '/employer/accreditation')
    // The old dead-end "+ Post a Vacancy" advice must not appear.
    expect(screen.queryByText(/Click '\+ Post a Vacancy'/)).not.toBeInTheDocument()
  })

  it('keeps the original create-advice for approved employers with no posts', async () => {
    getEmployer.mockResolvedValue({ id: 'emp-1', accreditation_status: 'approved' })
    listEmployerJobs.mockResolvedValue({ data: [], total: [].length, page: 1, pageSize: 25 })

    render(
      <MemoryRouter>
        <JobPosts />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/haven't posted any job vacancies yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/must first be accredited/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view accreditation/i })).not.toBeInTheDocument()
  })
})
