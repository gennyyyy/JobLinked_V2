import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({
  listUsers: vi.fn(),
  updateUser: vi.fn(),
  listRoles: vi.fn(),
  assignRole: vi.fn(),
  assignCustomRole: vi.fn(),
  inviteUser: vi.fn(),
  listAuditLogs: vi.fn(),
  listSeekerEducation: vi.fn(),
  listSeekerExperience: vi.fn(),
  listSeekerEmployment: vi.fn(),
  listSeekerResumes: vi.fn(),
}))

vi.mock('../../../shared/services/documents', () => ({
  latestAccByCompany: () => ({}),
  signedUrl: vi.fn(),
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'admin-1', role: 'super-admin' } }),
}))

import {
  listUsers, listRoles, listAuditLogs, listSeekerEducation, listSeekerExperience,
  listSeekerEmployment, listSeekerResumes,
} from '../../../shared/services/admin'
import { signedUrl } from '../../../shared/services/documents'
import UserManagement from '../UserManagement'

const employer = {
  id: 'u-1', full_name: 'Ada Lovelace', email: 'ada@cebu.ph', role: 'employer',
  status: 'active', created_at: '2026-02-02T00:00:00.000Z',
}
const seeker = {
  id: 'u-2', full_name: 'Ben Cruz', email: 'ben@cebu.ph', role: 'job-seeker',
  status: 'active', created_at: '2026-02-03T00:00:00.000Z',
}

async function renderUsers(rows = [employer, seeker]) {
  listUsers.mockResolvedValue({ data: rows, total: rows.length, page: 1, pageSize: 25 })
  render(<UserManagement />)
  return screen.findByRole('table')
}

// Opens the detail dialog from the seeker row and waits for the four reads.
async function openDetail() {
  fireEvent.click(await screen.findByRole('button', { name: /view profile details for ben cruz/i }))
  await screen.findByRole('dialog')
  await waitFor(() => expect(listSeekerResumes).toHaveBeenCalledWith('u-2'))
}

let openSpy

beforeEach(() => {
  vi.clearAllMocks()
  listRoles.mockResolvedValue([])
  listAuditLogs.mockResolvedValue([])
  listSeekerEducation.mockResolvedValue([])
  listSeekerExperience.mockResolvedValue([])
  listSeekerEmployment.mockResolvedValue([])
  listSeekerResumes.mockResolvedValue([])
  signedUrl.mockResolvedValue('blob:test')
  openSpy = vi.spyOn(window, 'open').mockReturnValue({ opener: null, location: {}, close: vi.fn() })
})

afterEach(() => vi.restoreAllMocks())

describe('UserManagement seeker detail dialog', () => {
  it('shows the View action only for job-seeker rows', async () => {
    await renderUsers()
    const views = screen.getAllByRole('button', { name: /^view/i })
    expect(views).toHaveLength(1)
    expect(views[0]).toHaveAccessibleName(/ben cruz/i)
    // The employer row still offers only Manage access.
    expect(screen.getAllByRole('button', { name: /manage access/i })).toHaveLength(2)
  })

  it('loads and renders education, experience, and employment per tab', async () => {
    listSeekerEducation.mockResolvedValue([
      { id: 1, seeker_id: 'u-2', level: 'College', school: 'PUP Santa Maria', field: 'BSIT', start_year: 2018, end_year: 2022 },
    ])
    listSeekerExperience.mockResolvedValue([
      { id: 1, seeker_id: 'u-2', company: 'Acme', position: 'Junior Developer', start_date: '2024-01-01', end_date: null, description: 'Built pages' },
    ])
    listSeekerEmployment.mockResolvedValue([
      { id: 'e-1', seeker_id: 'u-2', employer_name: 'Acme Corp', position: 'Junior Developer', start_date: '2024-01-01', end_date: null, is_current: true, created_at: '2024-02-01T00:00:00.000Z' },
    ])
    await renderUsers()
    await openDetail()

    // Background is the default tab.
    expect(listSeekerEducation).toHaveBeenCalledWith('u-2')
    expect(listSeekerExperience).toHaveBeenCalledWith('u-2')
    expect(listSeekerEmployment).toHaveBeenCalledWith('u-2')
    expect(await screen.findByText('PUP Santa Maria')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Experience' }))
    expect(await screen.findByText('Junior Developer')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.queryByText('PUP Santa Maria')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Employment' }))
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('shows the empty resume state when the seeker has none', async () => {
    await renderUsers()
    await openDetail()
    expect(await screen.findByText('No resume on file.')).toBeInTheDocument()
  })

  it('opens a resume through signedUrl with the stored file path', async () => {
    listSeekerResumes.mockResolvedValue([
      { id: 9, seeker_id: 'u-2', file_name: 'cv.pdf', file_path: 'resumes/u-2/cv.pdf', is_active: true, uploaded_at: '2026-05-01T00:00:00.000Z' },
    ])
    await renderUsers()
    await openDetail()

    expect(await screen.findByText('cv.pdf')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /view\s*cv\.pdf.*opens in new tab/i }))
    await waitFor(() => expect(signedUrl).toHaveBeenCalledWith('resumes', 'resumes/u-2/cv.pdf'))
    expect(openSpy).toHaveBeenCalledWith('', '_blank')
  })
})
