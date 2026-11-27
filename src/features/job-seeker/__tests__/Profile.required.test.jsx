import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
import { updateProfile } from '../../../shared/services/auth'
import { listEducation, listEmployment } from '../../../shared/services/seekers'
import { listResumes } from '../../../shared/services/documents'
import { getReferenceValues } from '../../../shared/services/reference'

// A profile that satisfies everything signup requires, so each test can remove
// exactly the field it exercises.
const STORED = {
  id: 'u1',
  email: 'juana@example.com',
  full_name: 'Juana Santos',
  phone: '09171234567',
  birthdate: '1998-05-04',
  employment_status: 'Employed',
  barangay_district: 'Poblacion',
  street_address: '12 Mabini Street',
  city_municipality: 'Santa Maria',
  province_state: 'Bulacan',
  postal_code: '3022',
  skills: ['Data Entry'],
}

async function openProfile() {
  render(<MemoryRouter><Profile /></MemoryRouter>)
  await screen.findByRole('tab', { name: /personal/i })
}

const save = () => fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

const hasMarker = (name) => screen.getByLabelText(name).labels[0]?.querySelector('span.text-destructive')?.textContent === '*'

describe('Profile required fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listResumes.mockResolvedValue([])
    listEducation.mockResolvedValue([{
      id: 'edu1', level: 'College', school: 'Central College', field: 'Business', end_year: 2022,
    }])
    listEmployment.mockResolvedValue([])
    updateProfile.mockResolvedValue({})
    getReferenceValues.mockResolvedValue(['Data Entry'])
    useAuth.mockReturnValue({ user: STORED, refreshUser: vi.fn() })
  })

  it('blocks the save and names the missing birthday and employment status', async () => {
    useAuth.mockReturnValue({
      user: { ...STORED, birthdate: null, employment_status: null },
      refreshUser: vi.fn(),
    })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByLabelText(/^Barangay/)
    save()

    expect(await screen.findByText('Enter your birthday.')).toBeInTheDocument()
    expect(screen.getByText('Choose your employment status.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: /personal/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('blocks the save on a malformed postal code and keeps the fixed city and province', async () => {
    useAuth.mockReturnValue({
      user: { ...STORED, city_municipality: null, province_state: null, postal_code: '302' },
      refreshUser: vi.fn(),
    })
    await openProfile()
    save()

    expect(await screen.findByText('Postal code must be 4 digits.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^City \/ Municipality/)).toHaveValue('Santa Maria')
    expect(screen.getByLabelText(/^Province \/ State/)).toHaveValue('Bulacan')
    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: /address/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('requires the last name when the split name fields are used', async () => {
    useAuth.mockReturnValue({
      user: { ...STORED, first_name: 'juana', last_name: 'santos' },
      refreshUser: vi.fn(),
    })
    await openProfile()

    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: '' } })
    save()

    expect(await screen.findByText('Enter your last name.')).toBeInTheDocument()
    expect(screen.queryByText('Enter your full name.')).not.toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('still saves a legacy profile that only has a full name', async () => {
    await openProfile()
    save()

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({ full_name: 'Juana Santos' }))
  })

  it('prefills nationality and blocks a blank one', async () => {
    useAuth.mockReturnValue({ user: STORED, refreshUser: vi.fn() })
    await openProfile()
    const nationality = screen.getByLabelText(/^Nationality/)
    expect(nationality.tagName).toBe('SELECT')
    expect(nationality).toHaveValue('Filipino')
    fireEvent.change(nationality, { target: { value: '' } })
    save()
    expect(await screen.findByText('Enter your nationality.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('marks required controls with a red asterisk and leaves optional ones unmarked', async () => {
    await openProfile()

    for (const name of [/^Full Name/, /^Contact Number/, /^First Name/, /^Last Name/, /^Birthday/, /^Nationality/, /^Employment Status/]) {
      expect(hasMarker(name), `required marker missing on ${name}`).toBe(true)
    }
    for (const name of [/^Middle Name/, /^Suffix/]) {
      expect(hasMarker(name), `unexpected marker on ${name}`).toBe(false)
    }

    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByLabelText(/^Barangay/)
    for (const name of [/^Barangay/, /^Street or Local Address/, /^City \/ Municipality/, /^Province \/ State/]) {
      expect(hasMarker(name), `required marker missing on ${name}`).toBe(true)
    }
    expect(hasMarker(/^Postal Code/), 'unexpected marker on Postal Code').toBe(false)

    fireEvent.click(screen.getByRole('tab', { name: /skills/i }))
    expect((await screen.findByText('Your Skills')).querySelector('span.text-destructive')).toHaveTextContent('*')
    expect(screen.getByText('Work Experience').querySelector('span.text-destructive')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    await screen.findByRole('combobox', { name: /^Level/ })
    for (const name of [/^Level/, /^School/, /^Graduation Year/]) {
      expect(hasMarker(name), `required marker missing on ${name}`).toBe(true)
    }
    expect(hasMarker(/^Field \/ Course/), 'unexpected marker on Field / Course').toBe(false)

    fireEvent.click(screen.getByRole('checkbox', { name: /currently studying here/i }))
    expect(hasMarker(/^Graduation Year/), 'Graduation Year still marked while studying').toBe(false)
  })
})
