import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicJobDetail from '../PublicJobDetail'
import { getJob } from '../../../shared/services/jobs'

vi.mock('../../../shared/services/jobs', () => ({
  getJob: vi.fn(),
}))

function renderJob(jobData) {
  getJob.mockResolvedValue(jobData)
  render(
    <MemoryRouter initialEntries={['/jobs/job-1']}>
      <Routes>
        <Route path="/jobs/:jobId" element={<PublicJobDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicJobDetail apply intent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('stashes the job id when Log in to Apply is clicked', async () => {
    renderJob({ id: '42', title: 'Test Job' })
    await userEvent.click(await screen.findByRole('link', { name: /log in to apply/i }))
    expect(JSON.parse(localStorage.getItem('joblinked:applyIntent'))).toEqual({ id: '42', at: expect.any(Number) })
  })
})
