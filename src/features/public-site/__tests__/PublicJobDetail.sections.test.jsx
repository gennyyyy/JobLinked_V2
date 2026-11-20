import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicJobDetail from '../PublicJobDetail'
import { getJob } from '../../../shared/services/jobs'

vi.mock('../../../shared/services/jobs', () => ({
  getJob: vi.fn(),
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
  render(
    <MemoryRouter initialEntries={['/jobs/job-1']}>
      <Routes>
        <Route path="/jobs/:jobId" element={<PublicJobDetail />} />
      </Routes>
    </MemoryRouter>,
  )
  return screen.findByRole('heading', { level: 1, name: 'Barangay Health Worker' })
}

describe('PublicJobDetail display separation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows field and work arrangement as their own detail rows', async () => {
    await renderDetail(job({ field: 'Healthcare', work_arrangement: 'On-site' }))

    expect(screen.getByText('Field')).toBeInTheDocument()
    expect(screen.getByText('Healthcare')).toBeInTheDocument()
    expect(screen.getByText('Work arrangement')).toBeInTheDocument()
    expect(screen.getByText('On-site')).toBeInTheDocument()
  })

  it('groups skills and highlights under their own headings', async () => {
    await renderDetail(job({ skills: ['Communication', 'First Aid'], tags: ['Urgent Hiring', 'Day Shift'] }))

    const skillsSection = screen.getByRole('heading', { name: 'Skills required' }).closest('section')
    expect(screen.getByText('Communication')).toBeInTheDocument()
    expect(screen.getByText('First Aid')).toBeInTheDocument()

    const highlightsSection = screen.getByRole('heading', { name: 'Job highlights' }).closest('section')
    expect(screen.getByText('Urgent Hiring')).toBeInTheDocument()
    expect(screen.getByText('Day Shift')).toBeInTheDocument()

    // Nothing from the other group leaks in, and no arrangement tag exists here.
    expect(skillsSection.textContent).not.toContain('Urgent Hiring')
    expect(highlightsSection.textContent).not.toContain('Communication')
  })

  it('omits the empty groups for a legacy vacancy', async () => {
    await renderDetail(job({ deadline: null }))

    expect(screen.queryByText('Field')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Skills required' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Job highlights' })).toBeNull()
    expect(screen.getByText('Work arrangement')).toBeInTheDocument()
  })
})
