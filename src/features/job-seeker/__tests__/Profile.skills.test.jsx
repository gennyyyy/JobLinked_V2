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
import { listEducation } from '../../../shared/services/seekers'
import { listResumes } from '../../../shared/services/documents'
import { extractResumeText } from '../../../shared/lib/resumeText'
import { getReferenceValues } from '../../../shared/services/reference'

const STORED = {
  id: 'u1',
  email: 'juana@example.com',
  full_name: 'Juana Santos',
  phone: '09171234567',
  headline: 'Cashier',
  barangay_district: 'Poblacion',
  street_address: '12 Mabini Street',
  experience_summary: 'Cashier, 2 years',
  field: 'Information Technology',
  skills: ['ms excel'],
}

const FIELDS = ['Construction', 'Information Technology']
const SKILLS = ['MS Excel', 'Teamwork', 'Welding']

async function openEducation() {
  render(<MemoryRouter><Profile /></MemoryRouter>)
  await screen.findByRole('button', { name: /save my profile/i })
  fireEvent.click(screen.getByRole('tab', { name: /education/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  listResumes.mockResolvedValue([])
  listEducation.mockResolvedValue([{
    id: 'edu1', level: 'College', school: 'Central College', field: 'Business', end_year: 2022,
  }])
  updateProfile.mockResolvedValue({})
  getReferenceValues.mockImplementation(async (category) => (category === 'job_field' ? FIELDS : SKILLS))
  useAuth.mockReturnValue({ user: STORED, refreshUser: vi.fn() })
})

describe('Profile field and skills pickers', () => {
  it('renders the controlled vocabularies and the saved canonical skill', async () => {
    await openEducation()

    expect(await screen.findByRole('checkbox', { name: 'MS Excel' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Teamwork' })).not.toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Underwater Basket Weaving' })).toBeNull()

    const field = screen.getByLabelText('Field')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Construction' })).toBeInTheDocument())
    expect(field).toHaveValue('Information Technology')
    expect(screen.getByRole('option', { name: 'Not set' })).toBeInTheDocument()
  })

  it('saves the picker values as canonical skill and field arrays', async () => {
    await openEducation()
    await screen.findByRole('checkbox', { name: 'Teamwork' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Teamwork' }))
    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'Construction' } })

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      field: 'Construction',
      skills: ['MS Excel', 'Teamwork'],
    }))
  })

  it('keeps the field optional and sends null when unset', async () => {
    useAuth.mockReturnValue({ user: { ...STORED, field: null }, refreshUser: vi.fn() })
    await openEducation()

    await screen.findByRole('checkbox', { name: 'MS Excel' })
    expect(screen.getByLabelText('Field')).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile.mock.calls[0][1]).toMatchObject({ field: null, skills: ['ms excel'] })
  })

  it('selects a listed autofilled skill and names the unlisted one instead of dropping it', async () => {
    useAuth.mockReturnValue({ user: { ...STORED, skills: ['MS Excel'] }, refreshUser: vi.fn() })
    extractResumeText.mockResolvedValue('Juana Santos\nSkills: Welding, Underwater Basket Weaving')
    await openEducation()

    fireEvent.click(screen.getByRole('tab', { name: /my resumes/i }))
    fireEvent.change(await screen.findByLabelText('Choose a resume to autofill'), {
      target: { files: [new File(['x'], 'resume.pdf', { type: 'application/pdf' })] },
    })
    await screen.findByRole('button', { name: 'Apply detected details' })
    fireEvent.click(await screen.findByRole('checkbox', { name: /resume autofill can make mistakes/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply detected details' }))

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    expect(await screen.findByRole('checkbox', { name: 'Welding' })).toBeChecked()
    expect(await screen.findByText(/Unrecognized skills: Underwater Basket Weaving/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile.mock.calls[0][1].skills).toEqual(['MS Excel', 'Welding'])
  })
})
