import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../Dashboard'
import { getStats, listAllAccreditations } from '../../../shared/services/admin'

vi.mock('../../../shared/services/admin', () => ({
  getStats: vi.fn(),
  listAllAccreditations: vi.fn(),
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
  ],
  total: 2, page: 1, pageSize: 100,
}

const statValue = (label) => screen.getByText(label).previousElementSibling.textContent

async function renderDashboard(stats = STATS, accs = ACCS) {
  getStats.mockResolvedValue(stats)
  listAllAccreditations.mockResolvedValue(accs)
  render(<MemoryRouter><Dashboard /></MemoryRouter>)
  return waitFor(() => expect(screen.getByText('Job Seekers')).toBeInTheDocument())
}

describe('Super-admin Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all 10 stat labels with API values', async () => {
    await renderDashboard()
    expect(statValue('Job Seekers')).toBe('10')
    expect(statValue('Pending Accreditation')).toBe('2')
    expect(statValue('Employers')).toBe('3')
    expect(statValue('Job Posts')).toBe('4')
    expect(statValue('Applications')).toBe('5')
    expect(statValue('Companies')).toBe('6')
    expect(statValue('Accredited')).toBe('7')
    expect(statValue('Pending Jobs')).toBe('8')
    expect(statValue('Accepted')).toBe('9')
    expect(statValue('Placed')).toBe('11')
  })

  it('renders recent applications with company name and status pill', async () => {
    await renderDashboard()
    expect(screen.getByText('acme corp')).toBeInTheDocument()
    expect(screen.getByText('beta inc')).toBeInTheDocument()
    expect(screen.getByText('approved')).toBeInTheDocument()
    expect(screen.getByText('rejected')).toBeInTheDocument()
  })

  it('shows an alert when getStats rejects', async () => {
    getStats.mockRejectedValue(new Error('boom'))
    listAllAccreditations.mockResolvedValue(ACCS)
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('omits the Placed card when placedApplicants is missing', async () => {
    const rest = { ...STATS }
    delete rest.placedApplicants
    await renderDashboard(rest)
    expect(screen.queryByText('Placed')).not.toBeInTheDocument()
  })
})