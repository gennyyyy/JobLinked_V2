import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Profile from '../Profile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/account', () => ({ getPreferences: vi.fn(), updatePreferences: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({ updateProfile: vi.fn() }))
vi.mock('../../../shared/services/seekers', () => ({
  listEducation: vi.fn(),
  addEducation: vi.fn(),
  removeEducation: vi.fn(),
  listEmployment: vi.fn(),
}))
vi.mock('../../../shared/lib/resumeText', () => ({ extractResumeText: vi.fn() }))
vi.mock('../../../shared/services/reference', () => ({ getReferenceValues: vi.fn() }))
vi.mock('../../../shared/services/documents', () => ({
  listResumes: vi.fn(),
  uploadResume: vi.fn(),
  deleteResume: vi.fn(),
  validateFile: vi.fn(() => null),
  signedUrl: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { listEducation, listEmployment } from '../../../shared/services/seekers'
import { listResumes } from '../../../shared/services/documents'
import { getReferenceValues } from '../../../shared/services/reference'

const STORED = {
  id: 'u1',
  email: 'juana@example.com',
  full_name: 'Juana Santos',
  phone: '09171234567',
  headline: 'Cashier',
  barangay_district: 'Poblacion',
  street_address: '12 Mabini Street',
  skills: ['ms excel'],
}

const CURRENT = {
  id: 'emp-current',
  employer_name: 'Acme Retail',
  position: 'Store Supervisor',
  is_current: true,
  start_date: '2026-02-01',
  end_date: null,
}

const PAST = {
  id: 'emp-past',
  employer_name: 'Bulacan Depot',
  position: 'Warehouse Assistant',
  is_current: false,
  start_date: '2024-05-01',
  end_date: '2025-12-31',
}

async function openSkills() {
  render(<MemoryRouter><Profile /></MemoryRouter>)
  await screen.findByRole('button', { name: /save my profile/i })
  fireEvent.click(screen.getByRole('tab', { name: /skills/i }))
  return screen.findByRole('region', { name: 'Employment through JobLinked' })
}

describe('Profile employment through JobLinked', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listResumes.mockResolvedValue([])
    listEducation.mockResolvedValue([])
    getReferenceValues.mockResolvedValue([])
    useAuth.mockReturnValue({ user: STORED, refreshUser: vi.fn() })
  })

  it('lists current and past system employment, current first', async () => {
    // Server order is created_at desc; the client sorts current first.
    listEmployment.mockResolvedValue([PAST, CURRENT])

    const section = await openSkills()

    expect(await within(section).findByText('Acme Retail')).toBeInTheDocument()
    expect(within(section).getByText('Store Supervisor')).toBeInTheDocument()
    expect(within(section).getByText('Bulacan Depot')).toBeInTheDocument()
    expect(within(section).getByText('Warehouse Assistant')).toBeInTheDocument()

    const items = within(section).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Acme Retail')
    expect(items[1]).toHaveTextContent('Bulacan Depot')

    expect(within(section).getByText('Active')).toBeInTheDocument()
    expect(within(section).getByText('Separated')).toBeInTheDocument()
    expect(within(section).getByText(/– Present$/)).toBeInTheDocument()
  })

  it('shows the empty state when the seeker has no placements', async () => {
    listEmployment.mockResolvedValue([])

    const section = await openSkills()

    expect(await within(section).findByText('No system-recorded employment yet.')).toBeInTheDocument()
    expect(within(section).getByText(/When an employer confirms your hire through JobLinked/)).toBeInTheDocument()
  })
})
