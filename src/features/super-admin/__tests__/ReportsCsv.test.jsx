import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  listAllJobs: vi.fn(),
  listAllApplications: vi.fn(),
  listUsers: vi.fn(),
  listCompanies: vi.fn(),
  listAllAccreditations: vi.fn(),
  exportReport: vi.fn(),
}))
vi.mock('../../../shared/services/documents', () => ({
  latestAccByCompany: () => ({}),
}))

import {
  listAllJobs, listAllApplications, listUsers, listCompanies,
  listAllAccreditations, exportReport,
} from '../../../shared/services/admin'
import Reports from '../Reports'

const apps = [{
  id: 'a1',
  seeker: { full_name: 'Ana', email: 'a@x.com' },
  job: { title: 'Cook', employers: { company_name: 'Acme' } },
  status: 'Applied',
  applied_at: '2026-01-05',
}]
const expectedCSV = '"Seeker","Email","Job","Company","Status","Applied At"\n"Ana","a@x.com","Cook","Acme","Applied","2026-01-05"'

let capturedBlob
let capturedName
beforeEach(() => {
  listAllJobs.mockResolvedValue([])
  listAllApplications.mockResolvedValue(apps)
  listUsers.mockResolvedValue([])
  listCompanies.mockResolvedValue([])
  listAllAccreditations.mockResolvedValue([])
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
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.readAsText(blob)
  })
}

describe('Reports CSV export', () => {
  it('Export CSV downloads identical bytes + filename', async () => {
    render(<Reports />)
    fireEvent.click(await screen.findByText('Export CSV'))
    await waitFor(() => expect(capturedBlob).toBeTruthy())
    expect(capturedName).toBe('applications-report.csv')
    expect(await readBlob(capturedBlob)).toBe(expectedCSV)
  })

  it('server export 400 falls back to client CSV', async () => {
    exportReport.mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }))
    render(<Reports />)
    fireEvent.click(await screen.findByText('Export applications'))
    await waitFor(() => expect(capturedBlob).toBeTruthy())
    expect(await readBlob(capturedBlob)).toBe(expectedCSV)
    expect(capturedName).toBe('applications-report.csv')
  })
})
