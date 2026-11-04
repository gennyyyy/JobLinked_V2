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

  it('keeps the header, matching panel, and search visible while the list loads', async () => {
    // Never resolves, so the fetch stays in-flight (loading) for the assertion.
    listJobs.mockReturnValue(new Promise(() => {}))

    const { container } = render(
      <MemoryRouter>
        <Jobs />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/loading jobs/i)).toBeInTheDocument()
    const busy = container.querySelector('[aria-busy="true"]')
    expect(busy).toBeInTheDocument()
    expect(busy.querySelectorAll('.surface').length).toBeGreaterThan(0)
    // The page chrome stays mounted instead of an early return.
    expect(screen.getByRole('heading', { name: /browse jobs/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Search your recommendations')).toBeInTheDocument()
    expect(screen.getByText('Standard matching · no AI')).toBeInTheDocument()
  })
})
