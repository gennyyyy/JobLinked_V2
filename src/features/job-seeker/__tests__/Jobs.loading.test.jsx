import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

  it('keeps the header, sidebar controls, and a reachable search while the list loads', async () => {
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
    const sidebar = screen.getByRole('complementary')
    expect(within(sidebar).getByLabelText('Search your recommendations')).toBeEnabled()
    expect(within(sidebar).getByRole('button', { name: 'Skills-based matching' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('heading', { name: /narrow your search/i })).toBeInTheDocument()
    expect(within(sidebar).getByLabelText('Barangay')).toBeEnabled()
    expect(within(sidebar).getByRole('button', { name: /reset all filters/i })).toBeEnabled()
  })
})
