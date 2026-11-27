import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Profile from '../Profile'
import { SANTA_MARIA_BARANGAYS } from '../../../shared/constants'

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
import { updateProfile } from '../../../shared/services/auth'
import { listEducation, listEmployment } from '../../../shared/services/seekers'
import { listResumes } from '../../../shared/services/documents'
import { getReferenceValues } from '../../../shared/services/reference'

const STORED = {
  id: 'u1',
  email: 'juana@example.com',
  full_name: 'Juana Santos',
  phone: '09171234567',
  headline: 'Cashier',
  birthdate: '1998-05-04',
  employment_status: 'Employed',
  barangay_district: 'Poblacion',
  street_address: '12 Mabini Street',
  city_municipality: 'Santa Maria',
  province_state: 'Bulacan',
  postal_code: '3022',
  experience_summary: 'Cashier, 2 years',
  field: 'Information Technology',
  skills: ['ms excel'],
}

const FIELDS = ['Construction', 'Information Technology']
const SKILLS = ['MS Excel', 'Teamwork', 'Welding']

async function openSkills() {
  render(<MemoryRouter><Profile /></MemoryRouter>)
  await screen.findByRole('button', { name: /save my profile/i })
  fireEvent.click(screen.getByRole('tab', { name: /skills/i }))
  await screen.findByRole('textbox', { name: 'Preferred Jobs' })
}

// Type into a tag box and commit the chip the way a user would.
function typeTag(label, text, key = 'Enter') {
  const input = screen.getByRole('textbox', { name: label })
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key })
}

beforeEach(() => {
  vi.clearAllMocks()
  listResumes.mockResolvedValue([])
  listEducation.mockResolvedValue([{
    id: 'edu1', level: 'College', school: 'Central College', field: 'Business', end_year: 2022,
  }])
  listEmployment.mockResolvedValue([])
  updateProfile.mockResolvedValue({})
  getReferenceValues.mockImplementation(async (category) => (category === 'job_field' ? FIELDS : SKILLS))
  useAuth.mockReturnValue({ user: STORED, refreshUser: vi.fn() })
})

describe('Profile preferred jobs and locations', () => {
  it('renders stored preferred jobs as chips and locations as checked barangays', async () => {
    useAuth.mockReturnValue({
      user: { ...STORED, preferred_position: 'Barista, Driver', preferred_location: 'Poblacion, Bocaue' },
      refreshUser: vi.fn(),
    })
    await openSkills()

    expect(screen.getByRole('button', { name: 'Remove Barista' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Driver' })).toBeInTheDocument()

    const group = screen.getByRole('group', { name: 'Preferred Locations' })
    expect(within(group).getAllByRole('checkbox')).toHaveLength(SANTA_MARIA_BARANGAYS.length + 1)
    expect(within(group).getByRole('checkbox', { name: 'Poblacion' })).toBeChecked()
    expect(within(group).getByRole('checkbox', { name: 'Bocaue' })).toBeChecked()
    expect(within(group).getByRole('checkbox', { name: 'Bagbaguin' })).not.toBeChecked()
  })

  it('saves checked barangays as a comma-separated string in list order', async () => {
    await openSkills()

    typeTag('Preferred Jobs', 'Barista')
    typeTag('Preferred Jobs', 'Driver')

    const group = screen.getByRole('group', { name: 'Preferred Locations' })
    fireEvent.click(within(group).getByRole('checkbox', { name: 'Santa Cruz' }))
    fireEvent.click(within(group).getByRole('checkbox', { name: 'Caysio' }))
    fireEvent.click(within(group).getByRole('checkbox', { name: 'Santa Cruz' }))
    fireEvent.click(within(group).getByRole('checkbox', { name: 'Poblacion' }))

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      preferred_position: 'Barista, Driver',
      preferred_location: 'Caysio, Poblacion',
    }))
  })

  it('sends null for both when left empty', async () => {
    await openSkills()

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile.mock.calls[0][1]).toMatchObject({
      preferred_position: null,
      preferred_location: null,
    })
  })
})
