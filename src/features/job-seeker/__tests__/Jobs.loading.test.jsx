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

describe('Jobs inline loading state (U2/F1)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders a bounded inline spinner (not the full-screen loader) with filters still visible', async () => {
    // Never resolves, so the fetch stays in-flight (loading) for the assertion.
    listJobs.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <Jobs />
      </MemoryRouter>,
    )

    // Inline, bounded indicator — never the min-h-screen LoadingScreen mid-page.
    expect(await screen.findByText(/loading jobs/i)).toBeInTheDocument()
    expect(screen.queryByText(/loading database/i)).not.toBeInTheDocument()
    // Jobs keeps its filters/search mounted instead of doing an early return.
    expect(screen.getByPlaceholderText(/search by job title/i)).toBeInTheDocument()
  })
})
