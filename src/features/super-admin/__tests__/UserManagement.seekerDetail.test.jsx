import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

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

// Opens the detail dialog from the seeker row's actions menu and waits for the four reads.
async function openDetail() {
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Ben Cruz' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'View details' }))
  await screen.findByRole('dialog')
  await waitFor(() => expect(listSeekerResumes).toHaveBeenCalledWith('u-2'))
}

async function openRowDetails(name) {
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'View details' }))
  return screen.findByRole('dialog')
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

describe('UserManagement seeker table columns', () => {
  it('shows barangay, employment status, and preferred position for seekers only', async () => {
    const detailedSeeker = {
      ...seeker,
      barangay_district: 'Barangay San Jose',
      employment_status: 'Underemployed',
      preferred_position: 'Welder',
    }
    // Employers carry their own barangay_district; it must not leak into the
    // seeker columns.
    const employerWithAddress = { ...employer, barangay_district: 'Poblacion' }
    await renderUsers([employerWithAddress, detailedSeeker])

    expect(screen.getByRole('columnheader', { name: 'Barangay / district' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Employment status' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Preferred position' })).toBeInTheDocument()
    expect(screen.getByText('Barangay San Jose')).toBeInTheDocument()
    expect(screen.getByText('Underemployed')).toBeInTheDocument()
    expect(screen.getByText('Welder')).toBeInTheDocument()
    expect(screen.queryByText('Poblacion')).toBeNull()
  })

  it('renders a dash for every empty seeker field', async () => {
    const blankSeeker = { ...seeker, id: 'u-3', full_name: 'Nora Diaz' }
    await renderUsers([blankSeeker])
    const row = screen.getByText('Nora Diaz').closest('tr')
    expect(within(row).getAllByText('—')).toHaveLength(3)
  })
})

describe('UserManagement seeker detail dialog', () => {
  it('gives every row one actions menu with View details', async () => {
    await renderUsers()
    const menus = screen.getAllByRole('button', { name: /^actions for /i })
    expect(menus).toHaveLength(2)
    fireEvent.click(menus[0])
    expect(await screen.findByRole('menuitem', { name: 'View details' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Manage access' })).toBeInTheDocument()
  })

  it('disables Manage access on your own row but keeps View details', async () => {
    const self = { ...employer, id: 'admin-1', full_name: 'Self Admin', role: 'super-admin' }
    await renderUsers([self])
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Self Admin' }))
    expect(await screen.findByRole('menuitem', { name: 'View details' })).toBeEnabled()
    expect(screen.getByRole('menuitem', { name: 'Manage access' })).toHaveAttribute('aria-disabled', 'true')
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

  it('shows employer account and company details without seeker calls', async () => {
    const employerRow = {
      ...employer,
      full_name: 'ada lovelace',
      company_name: 'acme corporation',
      industry: 'manufacturing',
      company_email: 'hr@acme.test',
      representative_position: 'HR Manager',
      representative_phone: '+639171234567',
      house_number_unit: '12',
      street_address: 'mabini street',
      barangay_district: 'poblacion',
      city_municipality: 'santa maria',
      accreditation_status: 'approved',
      description: 'Builds farm equipment.',
    }
    await renderUsers([employerRow])
    const dialog = await openRowDetails('Ada Lovelace')

    expect(within(dialog).getByRole('heading', { name: 'Employer profile — Ada Lovelace' })).toBeInTheDocument()
    expect(within(dialog).getByText('Acme Corporation')).toBeInTheDocument()
    expect(within(dialog).getByText('Manufacturing')).toBeInTheDocument()
    expect(within(dialog).getByText('Approved')).toBeInTheDocument()
    expect(within(dialog).getByText('12, Mabini Street, Poblacion, Santa Maria')).toBeInTheDocument()
    expect(within(dialog).getByText('HR Manager')).toBeInTheDocument()
    expect(listSeekerResumes).not.toHaveBeenCalled()
  })

  it('shows the assigned custom role for an administrator without seeker calls', async () => {
    listRoles.mockResolvedValue([{ id: 7, name: 'PESO Staff', base_role: 'super-admin' }])
    const adminRow = {
      id: 'u-7', full_name: 'grace hopper', email: 'grace@cebu.ph', role: 'super-admin',
      status: 'active', created_at: '2026-02-04T00:00:00.000Z', custom_role_id: 7,
    }
    await renderUsers([adminRow])
    const dialog = await openRowDetails('Grace Hopper')

    expect(within(dialog).getByRole('heading', { name: 'Administrator profile — Grace Hopper' })).toBeInTheDocument()
    expect(within(dialog).getByText('PESO Staff')).toBeInTheDocument()
    expect(within(dialog).queryByText('Resumes')).toBeNull()
    expect(listSeekerResumes).not.toHaveBeenCalled()
  })
})
