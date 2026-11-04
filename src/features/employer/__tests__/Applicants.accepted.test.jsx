import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Applicants from '../Applicants'
import { listByCompany } from '../../../shared/services/applications'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'employer-1' } }),
}))

vi.mock('../../../shared/services/applications', () => ({
  listByCompany: vi.fn(),
  updateApplicationStatus: vi.fn(),
  getApplicationHistory: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../../shared/services/seekers', () => ({
  listSeekerEducation: vi.fn(),
  listSeekerExperience: vi.fn(),
}))
vi.mock('../../../shared/services/documents', () => ({ signedUrl: vi.fn() }))

const ACCEPTED = {
  id: 'app-accepted',
  status: 'Accepted',
  applied_at: '2026-01-05T00:00:00.000Z',
  seeker: { id: 's1', full_name: 'maria santos', barangay_district: 'Poblacion' },
  job: { id: 'j1', title: 'Warehouse Associate' },
}

const TERMINATED = {
  id: 'app-terminated',
  status: 'Terminated',
  applied_at: '2026-01-06T00:00:00.000Z',
  seeker: { id: 's2', full_name: 'tim terminated', barangay_district: 'Bulac' },
  job: { id: 'j1', title: 'Warehouse Associate' },
}

const OTHER_JOB = {
  id: 'app-other',
  status: 'Applied',
  applied_at: '2026-01-07T00:00:00.000Z',
  seeker: { id: 's3', full_name: 'ana cruz', barangay_district: 'Bagbaguin' },
  job: { id: 'j2', title: 'Cashier' },
}

describe('Applicants list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listByCompany.mockResolvedValue([ACCEPTED, TERMINATED, OTHER_JOB])
  })

  it('lists every application, including terminated outcomes', async () => {
    render(<Applicants />)

    expect(await screen.findByText('Maria Santos')).toBeInTheDocument()
    expect(screen.getByText('Tim Terminated')).toBeInTheDocument()
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument()
    expect(screen.getByText('3 applications in this view')).toBeInTheDocument()
  })

  it('filters by recruitment status', async () => {
    render(<Applicants />)
    await screen.findByText('Maria Santos')

    fireEvent.change(screen.getAllByLabelText(/recruitment status/i)[0], { target: { value: 'Accepted' } })

    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.queryByText('Tim Terminated')).toBeNull()
    expect(screen.queryByText('Ana Cruz')).toBeNull()
  })

  it('filters by vacancy', async () => {
    render(<Applicants />)
    await screen.findByText('Ana Cruz')

    fireEvent.change(screen.getByLabelText(/your vacancy/i), { target: { value: 'j2' } })

    expect(screen.getByText('Ana Cruz')).toBeInTheDocument()
    expect(screen.queryByText('Maria Santos')).toBeNull()
  })
})
