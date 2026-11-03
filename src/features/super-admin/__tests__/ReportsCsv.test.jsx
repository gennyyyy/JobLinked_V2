import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  listAllJobs: vi.fn(),
  listAllApplications: vi.fn(),
  listUsers: vi.fn(),
}))

import {
  listAllJobs, listAllApplications, listUsers,
} from '../../../shared/services/admin'
import Reports from '../Reports'

const apps = [{
  id: 'a1',
  seeker: { full_name: 'Ana' },
  job: { title: 'Cook', employers: { company_name: 'Acme' } },
  status: 'Placed',
  applied_at: '2026-01-05',
}]
const expectedCSV = '"Applicant","Vacancy","Employer","Placed date"\n"Ana","Cook","Acme","2026-01-05"'

let capturedBlob
let capturedName
beforeEach(() => {
  listAllJobs.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 25 })
  listAllApplications.mockResolvedValue({ data: apps, total: apps.length, page: 1, pageSize: 25 })
  listUsers.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 25 })
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
  it('exports the placement report as client CSV', async () => {
    render(<Reports />)
    fireEvent.click(await screen.findByText('Placement Summary'))
    fireEvent.click(screen.getByText('Download CSV'))
    await waitFor(() => expect(capturedBlob).toBeTruthy())
    expect(await readBlob(capturedBlob)).toBe(expectedCSV)
    expect(capturedName).toBe('placement-report.csv')
  })

  it('shows an empty-state message when there are no placed applicants', async () => {
    listAllApplications.mockResolvedValue({ data: [{ ...apps[0], status: 'Applied' }], total: 1, page: 1, pageSize: 25 })
    render(<Reports />)
    fireEvent.click(await screen.findByText('Placement Summary'))
    expect(await screen.findByText('No records in this period')).toBeTruthy()
  })

  it('counts open vacancies (status=published) and distinct posting companies', async () => {
    const jobs = [
      { id: 'j1', title: 'Cook', status: 'published', company_id: 'co-a', location: 'Poblacion', employers: { company_name: 'Acme' }, created_at: '2026-01-02' },
      { id: 'j2', title: 'Baker', status: 'published', company_id: 'co-a', location: 'Poblacion', employers: { company_name: 'Acme' }, created_at: '2026-01-03' },
      { id: 'j3', title: 'Driver', status: 'published', company_id: 'co-b', location: 'Generoso', employers: { company_name: 'Beta Co' }, created_at: '2026-01-04' },
      { id: 'j4', title: 'Unlisted draft', status: 'draft', company_id: 'co-c', location: 'Poblacion', employers: { company_name: 'Ceta' }, created_at: '2026-01-05' },
    ]
    listAllJobs.mockResolvedValue({ data: jobs, total: jobs.length, page: 1, pageSize: 25 })

    render(<Reports />)
    fireEvent.click(await screen.findByText('Vacancy Solicitation'))

    // "Open" maps to the real 'published' enum value (there is no 'open'), = 3.
    expect(screen.getByText('Open vacancies').previousElementSibling.textContent).toBe('3')
    // Distinct job→employer FK column (company_id), across every vacancy = 3.
    expect(screen.getByText('Employers posting').previousElementSibling.textContent).toBe('3')
  })
})
