import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CommunityStats from '../CommunityStats'

vi.mock('../../../shared/services/jobs', () => ({
  getPublicStats: vi.fn(),
}))

import { getPublicStats } from '../../../shared/services/jobs'

describe('CommunityStats', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('loads live counts and refreshes on its interval and when the page regains focus', async () => {
    vi.useFakeTimers()
    getPublicStats
      .mockResolvedValueOnce({ openJobs: 12, jobSeekers: 45, employers: 6, barangaysCovered: 4 })
      .mockResolvedValue({ openJobs: 14, jobSeekers: 48, employers: 7, barangaysCovered: 5 })

    render(<CommunityStats />)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('48')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(getPublicStats).toHaveBeenCalledTimes(2)

    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(getPublicStats).toHaveBeenCalledTimes(3)
  })

  it('reports refresh failures and retains the last successful counts', async () => {
    vi.useFakeTimers()
    getPublicStats
      .mockResolvedValueOnce({ openJobs: 12, jobSeekers: 45, employers: 6, barangaysCovered: 4 })
      .mockRejectedValueOnce(new Error('offline'))

    render(<CommunityStats />)
    await act(async () => { await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Live counts could not be refreshed.')
    expect(screen.getByRole('status')).toHaveTextContent('Showing the last available counts.')
  })
})
