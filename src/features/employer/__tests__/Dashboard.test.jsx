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

const statValue = (label) => screen.getAllByText(label).map((el) => el.closest('.surface')).find(Boolean).querySelector('p').textContent

async function renderDashboard(summary = SUMMARY) {
  getEmployerDashboard.mockResolvedValue(summary)
  render(<MemoryRouter><Dashboard /></MemoryRouter>)
  return screen.findByText('Active listings')
}

describe('Employer Dashboard summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'employer-1', first_name: 'Maria' } })
    getEmployer.mockResolvedValue({ company_name: 'Santa Maria Trading' })
  })

  it('renders the four counters from the summary payload', async () => {
    await renderDashboard()
    expect(statValue('Active listings')).toBe('2')
    expect(statValue('Total vacancies')).toBe('3')
    expect(statValue('Total applicants')).toBe('12')
    expect(statValue('New this week')).toBe('4')
    expect(screen.getByText(/Santa Maria Trading/)).toBeInTheDocument()
  })

  it('greets the employer by first name', async () => {
    await renderDashboard()
    expect(screen.getByText(/welcome back, maria/i)).toBeInTheDocument()
  })

  it('renders recent applicants from the snake_case summary fields', async () => {
    await renderDashboard()
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.getByText(/Applied for Warehouse Associate/i)).toBeInTheDocument()
    expect(screen.getByText(/Applied for Cashier/i)).toBeInTheDocument()
  })

  it('shows the empty state when there are no recent applicants', async () => {
    await renderDashboard({ jobs: [], stats: {}, recent: [] })
    expect(screen.getByText(/Your next teammate is out there/i)).toBeInTheDocument()
  })

  it('uses the summary endpoint instead of the full job + applicant lists', async () => {
    await renderDashboard()
    await waitFor(() => expect(getEmployerDashboard).toHaveBeenCalledTimes(1))
    expect(listByCompany).not.toHaveBeenCalled()
    expect(listEmployerJobs).not.toHaveBeenCalled()
  })
})
