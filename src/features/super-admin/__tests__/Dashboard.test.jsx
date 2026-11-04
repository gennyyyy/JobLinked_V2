import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../Dashboard'
import { getStats, listAllAccreditations, listAllApplications, listAuditLogs } from '../../../shared/services/admin'

vi.mock('../../../shared/services/admin', () => ({
  getStats: vi.fn(),
  listAllAccreditations: vi.fn(),
  listAllApplications: vi.fn(),
  listAuditLogs: vi.fn(),
}))

const STATS = {
  seekers: 10,
  pendingAccreditations: 2,
  employers: 3,
  jobs: 4,
  applications: 5,
  companies: 6,
  accreditedEmployers: 7,
  pendingJobs: 8,
  acceptedApplicants: 9,
  placedApplicants: 11,
}

const ACCS = {
  data: [
    { id: 'a1', status: 'approved', submitted_at: '2026-10-01T00:00:00.000Z', employers: { company_name: 'acme corp', barangay_district: 'zone 1' } },
    { id: 'a2', status: 'rejected', submitted_at: '2026-09-28T00:00:00.000Z', employers: { company_name: 'beta inc', barangay_district: 'zone 2' } },
    { id: 'a3', status: 'pending', submitted_at: '2026-10-16T00:00:00.000Z', employers: { company_name: 'gamma llc', barangay_district: 'zone 3' } },
  ],
  total: 3, page: 1, pageSize: 100,
}

const statValue = (label) => {
  const el = screen.getAllByText(label)[0]
  const card = el.closest('.surface') || el.closest('.rounded-xl')
  return card.querySelector('p').textContent
}

async function renderDashboard(stats = STATS, accs = ACCS) {
  getStats.mockResolvedValue(stats)
  listAllAccreditations.mockResolvedValue(accs)
  listAllApplications.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 500 })
  listAuditLogs.mockResolvedValue([])
  render(<MemoryRouter><Dashboard /></MemoryRouter>)
  return waitFor(() => expect(screen.getByText('Registered job seekers')).toBeInTheDocument())
}

describe('Super-admin Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the stat cards with API values', async () => {
    await renderDashboard()
    expect(statValue('Registered job seekers')).toBe('10')
    expect(statValue('Local employers')).toBe('3')
    expect(statValue('Pending accreditations')).toBe('2')
    expect(statValue('Active vacancies')).toBe('4')
    expect(statValue('applications')).toBe('5')
    expect(statValue('Recorded referrals')).toBe('0')
    expect(statValue('placements')).toBe('11')
  })

  it('renders recent applications with company name and status pill', async () => {
    await renderDashboard()
    expect(screen.getByText('Gamma Llc')).toBeInTheDocument()
    expect(screen.getByText('Pending Review')).toBeInTheDocument()
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument()
  })

  it('shows an alert when getStats rejects', async () => {
    getStats.mockRejectedValue(new Error('boom'))
    listAllAccreditations.mockResolvedValue(ACCS)
    listAllApplications.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 500 })
    listAuditLogs.mockResolvedValue([])
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('omits the Placements card when placedApplicants is missing', async () => {
    const rest = { ...STATS }
    delete rest.placedApplicants
    await renderDashboard(rest)
    expect(screen.queryByText('placements', { selector: 'p' })).not.toBeInTheDocument()
  })
})
