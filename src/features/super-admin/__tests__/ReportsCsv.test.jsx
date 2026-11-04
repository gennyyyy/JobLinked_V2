import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  listAllJobs: vi.fn(),
  listAllApplications: vi.fn(),
  listUsers: vi.fn(),
}))

import { listAllJobs, listAllApplications, listUsers } from '../../../shared/services/admin'
import Reports from '../Reports'

const JOBS = [
  { id: 'j1', title: 'Cook', status: 'published', location: 'Poblacion', employment_type: 'Full-time', vacancies: 2, created_at: '2026-01-02' },
  { id: 'j2', title: 'Baker', status: 'draft', location: 'Poblacion', employment_type: 'Full-time', vacancies: 1, created_at: '2026-01-03' },
]
const APPS = [
  { id: 'a1', status: 'Placed', applied_at: '2026-01-05', referred_by: null, seeker: { full_name: 'Ana', barangay_district: 'Poblacion' }, job: { title: 'Cook' } },
  { id: 'a2', status: 'Pending', applied_at: '2026-01-06', referred_by: 'staff-1', seeker: { full_name: 'Ben', barangay_district: 'Poblacion' }, job: { title: 'Cook' } },
]
const USERS = [{ id: 'u1', role: 'job-seeker', barangay_district: 'Poblacion' }]

let capturedBlob
let capturedName

beforeEach(() => {
  vi.clearAllMocks()
  listAllJobs.mockResolvedValue({ data: JOBS, total: JOBS.length, page: 1, pageSize: 500 })
  listAllApplications.mockResolvedValue({ data: APPS, total: APPS.length, page: 1, pageSize: 500 })
  listUsers.mockResolvedValue({ data: USERS, total: USERS.length, page: 1, pageSize: 500 })
  capturedBlob = null
  capturedName = null
  URL.createObjectURL = vi.fn((blob) => { capturedBlob = blob; return 'blob:mock' })
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    capturedName = this.download
  })
})

function readBlob(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsText(blob)
  })
}

async function renderReport() {
  render(<Reports />)
  await screen.findByText('Insights that keep people at the center.')
  fireEvent.change(screen.getByLabelText(/report period: from/i), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText(/report period: to/i), { target: { value: '2026-12-31' } })
}

describe('Reports', () => {
  it('renders the reference report cards and 24-barangay table', async () => {
    await renderReport()
    const statValue = (label) => screen.getAllByText(label).map((el) => el.closest('.surface')).find(Boolean).querySelector('p').textContent
    expect(statValue('Published vacancy records')).toBe('1')
    expect(statValue('applications')).toBe('2')
    expect(statValue('Recorded referrals')).toBe('1')
    expect(statValue('placements')).toBe('1')
    expect(screen.getByText('Across all 24 barangays')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Poblacion' })).toBeInTheDocument()
  })

  it('exports the barangay report as a client CSV', async () => {
    await renderReport()
    fireEvent.click(screen.getByRole('button', { name: /download csv/i }))
    await waitFor(() => expect(capturedBlob).toBeTruthy())
    const csv = await readBlob(capturedBlob)
    expect(csv).toContain('"DEMO DATA — Barangay"')
    expect(csv).toContain('"Poblacion","1","1","2","1","2026-01-01","2026-12-31"')
    expect(capturedName).toBe('joblinked-DEMO-barangay-report-2026-01-01-to-2026-12-31.csv')
  })

  it('shows an error when the report data fails to load', async () => {
    listAllJobs.mockRejectedValue(new Error('report boom'))
    render(<Reports />)
    expect(await screen.findByText('report boom')).toBeInTheDocument()
  })
})
