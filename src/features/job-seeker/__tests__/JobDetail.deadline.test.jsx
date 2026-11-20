import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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

  it('does not offer resume upload on the job detail page', async () => {
    await renderDetail(job({ deadline: null }))
    expect(screen.queryByLabelText(/upload new resume/i)).not.toBeInTheDocument()
  })

  it('shows field, skills, and highlights under their own labelled rows and sections', async () => {
    await renderDetail(job({
      field: 'Healthcare',
      work_arrangement: 'On-site',
      skills: ['Communication', 'First Aid'],
      tags: ['Urgent Hiring'],
    }))

    const fieldRow = screen.getByText('Field').closest('div')
    expect(within(fieldRow).getByText('Healthcare')).toBeInTheDocument()

    const skillsSection = screen.getByRole('heading', { name: 'Skills required' }).closest('section')
    expect(within(skillsSection).getByText('Communication')).toBeInTheDocument()
    expect(within(skillsSection).getByText('First Aid')).toBeInTheDocument()

    const highlightsSection = screen.getByRole('heading', { name: 'Job highlights' }).closest('section')
    expect(within(highlightsSection).getByText('Urgent Hiring')).toBeInTheDocument()
    // The arrangement is a detail row, not a skill or a highlight.
    expect(within(skillsSection).queryByText('On-site')).toBeNull()
    expect(within(highlightsSection).queryByText('On-site')).toBeNull()
    expect(within(screen.getByText('Work arrangement').closest('div')).getByText('On-site')).toBeInTheDocument()
  })

  it('omits the field, skills, and highlight sections for a legacy vacancy', async () => {
    await renderDetail(job())

    expect(screen.queryByText('Field')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Skills required' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Job highlights' })).toBeNull()
    expect(screen.getByText('Work arrangement')).toBeInTheDocument()
  })
})
