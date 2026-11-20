import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Jobs from '../Jobs'
import { listJobs } from '../../../shared/services/jobs'
import { matchJobs } from '../../../shared/services/ai'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1', skills: [] } }),
}))

vi.mock('../../../shared/services/jobs', () => ({
  listJobs: vi.fn(),
}))

vi.mock('../../../shared/services/ai', () => ({
  matchJobs: vi.fn(),
}))

describe('Jobs loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchJobs.mockResolvedValue({ mode: 'deterministic', ranking: [], reasons: [] })
  })

  it('keeps the header, matching panel, and a reachable search while the list loads', async () => {
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
    expect(screen.getByRole('region', { name: 'Job matching mode' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skills-based matching' })).toBeInTheDocument()
    // jsdom has no matchMedia, so refinement is collapsed until asked for.
    const refine = screen.getByRole('button', { name: /refine results/i })
    expect(refine).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(refine)

    expect(refine).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Search your recommendations')).toBeInTheDocument()
  })
})
