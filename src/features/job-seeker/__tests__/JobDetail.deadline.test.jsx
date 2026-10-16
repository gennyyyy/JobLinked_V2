import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import JobDetail from '../JobDetail'
import { getJob } from '../../../shared/services/jobs'
import { listBySeeker, applyToJob } from '../../../shared/services/applications'
import { listResumes } from '../../../shared/services/documents'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1' } }),
}))

vi.mock('../../../shared/services/jobs', () => ({
  getJob: vi.fn(),
}))

vi.mock('../../../shared/services/applications', () => ({
  listBySeeker: vi.fn(),
  applyToJob: vi.fn(),
}))

vi.mock('../../../shared/services/documents', () => ({
  listResumes: vi.fn(),
  uploadResume: vi.fn(),
  validateFile: vi.fn(),
}))

function job(overrides = {}) {
  return {
    id: 'job-1',
    title: 'Barangay Health Worker',
    location: 'Poblacion',
    employment_type: 'Full-time',
    description: 'Serve the community.',
    ...overrides,
  }
}

async function renderDetail(jobData) {
  getJob.mockResolvedValue(jobData)
  listBySeeker.mockResolvedValue([])
  listResumes.mockResolvedValue([])
  render(
    <MemoryRouter initialEntries={['/job-seeker/jobs/job-1']}>
      <Routes>
        <Route path="/job-seeker/jobs/:jobId" element={<JobDetail />} />
      </Routes>
    </MemoryRouter>
  )
  return screen.findByRole('button', { name: /submit application/i })
}

describe('JobDetail deadline handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows Verified Open and an enabled Apply button while the deadline is still ahead', async () => {
    const apply = await renderDetail(job({ deadline: '2099-12-31' }))

    expect(screen.getByText('Verified Open')).toBeInTheDocument()
    expect(apply).not.toBeDisabled()
  })

  it('treats the deadline day itself as still open', async () => {
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const apply = await renderDetail(job({ deadline: todayLocal }))

    expect(screen.getByText('Verified Open')).toBeInTheDocument()
    expect(apply).not.toBeDisabled()
  })

  it('shows Closed and disables Apply once the deadline has passed', async () => {
    const apply = await renderDetail(job({ deadline: '2020-01-15' }))

    expect(screen.getByText(/closed — application deadline passed/i)).toBeInTheDocument()
    expect(screen.queryByText('Verified Open')).not.toBeInTheDocument()
    expect(apply).toBeDisabled()
    expect(screen.getByText(/applications are closed/i)).toBeInTheDocument()

    fireEvent.click(apply)
    expect(applyToJob).not.toHaveBeenCalled()
  })

  it('never reports Closed when the job has no deadline', async () => {
    await renderDetail(job({ deadline: null }))
    expect(screen.getByText('Verified Open')).toBeInTheDocument()
  })
})
