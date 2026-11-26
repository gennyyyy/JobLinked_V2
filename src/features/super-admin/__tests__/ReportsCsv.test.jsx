import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  listAllJobs: vi.fn(),
  listAllApplications: vi.fn(),
  listUsers: vi.fn(),
}))
vi.mock('../../../shared/services/applications', () => ({ getApplicationHistory: vi.fn() }))

import { listAllJobs, listAllApplications, listUsers } from '../../../shared/services/admin'
import Reports from '../Reports'
import Applications from '../Applications'

const JOBS = [
  { id: 'j1', title: 'Cook', status: 'published', location: 'Poblacion', employment_type: 'Full-time', vacancies: 2, created_at: '2026-01-02' },
  { id: 'j2', title: 'Baker', status: 'draft', location: 'Poblacion', employment_type: 'Full-time', vacancies: 1, created_at: '2026-01-03' },
]
const APPS = [
  { id: 'a1', status: 'Placed', applied_at: '2026-01-05', seeker: { full_name: 'Ana', barangay_district: 'Poblacion' }, job: { title: 'Cook' } },
  { id: 'a2', status: 'Pending', applied_at: '2026-01-06', seeker: { full_name: 'Ben', barangay_district: 'Poblacion' }, job: { title: 'Cook' } },
]
const USERS = [{ id: 'u1', role: 'job-seeker', barangay_district: 'Poblacion' }]

const UTF8_BOM = [0xef, 0xbb, 0xbf]

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

// readAsText strips a leading BOM, so assert the raw bytes instead: they are
// what Excel reads to detect UTF-8.
function readBlobBytes(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(Array.from(new Uint8Array(reader.result)))
    reader.readAsArrayBuffer(blob)
  })
}

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

  it('starts the barangay CSV with a UTF-8 BOM and an unchanged header row', async () => {
    await renderReport()
    fireEvent.click(screen.getByRole('button', { name: /download csv/i }))
    await waitFor(() => expect(capturedBlob).toBeTruthy())
    const bytes = await readBlobBytes(capturedBlob)
    expect(bytes.slice(0, 3)).toEqual(UTF8_BOM)
    const csv = await readBlob(capturedBlob)
    expect(csv.split('\n')[0]).toBe(
      '"DEMO DATA — Barangay","Registered residents (all time)","Currently published vacancies posted in period","Applications submitted in period","Current hired outcomes from those applications","Period start","Period end"',
    )
  })

  it('shows an error when the report data fails to load', async () => {
    listAllJobs.mockRejectedValue(new Error('report boom'))
    render(<Reports />)
    expect(await screen.findByText('report boom')).toBeInTheDocument()
  })
})

describe('Applications CSV export', () => {
  it('starts the applications CSV with a UTF-8 BOM and keeps the header row', async () => {
    listAllApplications.mockResolvedValue({
      data: [{
        id: 'a1',
        status: 'Placed',
        applied_at: '2026-01-05T00:00:00.000Z',
        seeker: { full_name: 'Ana', barangay_district: 'Poblacion' },
        job: { title: 'Cook', employers: { company_name: 'Café Niña' } },
      }],
      total: 1,
      page: 1,
      pageSize: 500,
    })
    render(<Applications />)
    fireEvent.click(await screen.findByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(capturedBlob).toBeTruthy())

    expect((await readBlobBytes(capturedBlob)).slice(0, 3)).toEqual(UTF8_BOM)

    const csv = await readBlob(capturedBlob)
    expect(csv.split('\n')[0]).toBe(
      '"Application ID","Job title","Employer","Barangay","Submitted","Current status","Placement"',
    )
    expect(csv).toContain('"a1","Cook","Café Niña","Poblacion","2026-01-05","Placed","Yes"')
    expect(capturedName).toBe('joblinked-DEMO-applications.csv')
  })
})
