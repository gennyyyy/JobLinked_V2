import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Jobs from '../Jobs'
import { listJobs } from '../../../shared/services/jobs'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1', skills: [] } }),
}))

vi.mock('../../../shared/services/jobs', () => ({
  listJobs: vi.fn(),
}))

describe('Jobs loading state', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders job-card skeletons instead of a full-screen loader, with filters still visible', async () => {
    // Never resolves, so the fetch stays in-flight (loading) for the assertion.
    listJobs.mockReturnValue(new Promise(() => {}))

    const { container } = render(
      <MemoryRouter>
        <Jobs />
      </MemoryRouter>,
    )

    // A busy region with one polite status, and real skeleton cards inside it.
    expect(await screen.findByText(/loading jobs/i)).toBeInTheDocument()
    const busy = container.querySelector('[aria-busy="true"]')
    expect(busy).toBeInTheDocument()
    expect(busy.querySelectorAll('.surface').length).toBeGreaterThan(0)
    expect(screen.queryByText(/loading database/i)).not.toBeInTheDocument()
    // Jobs keeps its filters/search mounted instead of doing an early return.
    expect(screen.getByPlaceholderText(/search for a job title or company/i)).toBeInTheDocument()
  })
})
