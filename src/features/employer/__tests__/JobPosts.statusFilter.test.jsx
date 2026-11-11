import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

const PAGE = [
  { id: 'j1', title: 'Welder', status: 'published', created_at: '2026-01-01', applicant_count: 0 },
  { id: 'j2', title: 'Cashier', status: 'draft', created_at: '2026-01-02', applicant_count: 0 },
]

describe('JobPosts status filter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refetches with the selected posting status', async () => {
    getEmployer.mockResolvedValue({ id: 'emp-1', accreditation_status: 'approved' })
    listEmployerJobs.mockResolvedValue({ data: PAGE, total: PAGE.length, page: 1, pageSize: 25 })

    render(
      <MemoryRouter>
        <JobPosts />
      </MemoryRouter>,
    )

    await screen.findByRole('button', { name: 'Welder' })
    expect(listEmployerJobs).toHaveBeenLastCalledWith('emp-1', { page: 1, pageSize: 500, status: null })

    fireEvent.change(screen.getByLabelText(/posting status/i), { target: { value: 'draft' } })

    await waitFor(() =>
      expect(listEmployerJobs).toHaveBeenLastCalledWith('emp-1', { page: 1, pageSize: 500, status: 'draft' }),
    )
  })
})
