import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../Dashboard'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({ getEmployer: vi.fn() }))
vi.mock('../../../shared/services/applications', () => ({
  getEmployerDashboard: vi.fn(),
  listByCompany: vi.fn(),
}))
vi.mock('../../../shared/services/jobs', () => ({ listEmployerJobs: vi.fn() }))

import useAuth from '../../../shared/hooks/useAuth'
import { getEmployer } from '../../../shared/services/auth'
import { getEmployerDashboard, listByCompany } from '../../../shared/services/applications'
import { listEmployerJobs } from '../../../shared/services/jobs'

const SUMMARY = {
  jobs: [
    { id: 'j1', title: 'Warehouse Associate', status: 'published' },
    { id: 'j2', title: 'Cashier', status: 'published' },
    { id: 'j3', title: 'Old Draft', status: 'draft' },
  ],
  stats: { total_candidates: 12, new_this_week: 4 },
  recent: [
    { id: 'a1', applied_at: '2026-10-01T00:00:00.000Z', seeker_full_name: 'juan dela cruz', job_title: 'Warehouse Associate' },
    { id: 'a2', applied_at: '2026-09-28T00:00:00.000Z', seeker_full_name: 'maria santos', job_title: 'Cashier' },
  ],
}

// StatCard renders value and label as sibling <p>s inside one text block.
const statValue = (label) => screen.getByText(label).previousElementSibling.textContent

async function renderDashboard(summary = SUMMARY) {
  getEmployerDashboard.mockResolvedValue(summary)
  render(<MemoryRouter><Dashboard /></MemoryRouter>)
  return screen.findByText('Active Listings')
}

describe('Employer Dashboard summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'employer-1' } })
    getEmployer.mockResolvedValue({ company_name: 'Santa Maria Trading' })
  })

  it('renders the four counters from the summary payload', async () => {
    await renderDashboard()
    expect(statValue('Active Listings')).toBe('2')
    expect(statValue('Total Jobs')).toBe('3')
    expect(statValue('Total Candidates')).toBe('12')
    expect(statValue('New This Week')).toBe('4')
    expect(screen.getByText('Overview for Santa Maria Trading')).toBeInTheDocument()
  })

  it('renders recent applicants from the snake_case summary fields', async () => {
    await renderDashboard()
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.getAllByText(/Applied for/)).toHaveLength(2)
    expect(screen.getByText('Warehouse Associate')).toBeInTheDocument()
    expect(screen.getByText('Cashier')).toBeInTheDocument()
  })

  it('shows the empty state when there are no recent applicants', async () => {
    await renderDashboard({ jobs: [], stats: {}, recent: [] })
    expect(screen.getByText(/No applicant submissions received yet/i)).toBeInTheDocument()
  })

  it('uses the summary endpoint instead of the full job + applicant lists', async () => {
    await renderDashboard()
    await waitFor(() => expect(getEmployerDashboard).toHaveBeenCalledTimes(1))
    expect(listByCompany).not.toHaveBeenCalled()
    expect(listEmployerJobs).not.toHaveBeenCalled()
  })
})
