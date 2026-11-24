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

async function openSkills() {
  render(<MemoryRouter><Profile /></MemoryRouter>)
  await screen.findByRole('button', { name: /save my profile/i })
  fireEvent.click(screen.getByRole('tab', { name: /skills/i }))
  // input[list] is a combobox once the datalist (and its vocabulary) loaded.
  await screen.findByRole('combobox', { name: /your skills/i })
}

// Type into the skills tag box and commit the chip the way a user would.
function typeSkill(text, key = 'Enter') {
  const input = screen.getByRole('combobox', { name: /your skills/i })
  fireEvent.change(input, { target: { value: text } })
  fireEvent.keyDown(input, { key })
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

describe('Profile field picker and skills tag box', () => {
  it('renders the job-field vocabulary and the saved skill as a removable chip', async () => {
    await openSkills()

    const field = screen.getByLabelText('Field')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Construction' })).toBeInTheDocument())
    expect(field).toHaveValue('Information Technology')
    expect(screen.getByRole('option', { name: 'Not set' })).toBeInTheDocument()

    // The stored lowercase value is shown and saved in the vocabulary's casing.
    expect(await screen.findByText('MS Excel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove MS Excel' })).toBeInTheDocument()
    // The old checkbox-chip grid is gone.
    expect(screen.queryByRole('checkbox', { name: 'Teamwork' })).toBeNull()
  })

  it('turns typed text into chips (Enter and comma) and saves canonical skills', async () => {
    await openSkills()
    await screen.findByText('MS Excel')

    typeSkill('teamwork')
    expect(await screen.findByText('Teamwork')).toBeInTheDocument()
    typeSkill('welding', ',')
    expect(await screen.findByText('Welding')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Welding' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'Construction' } })
    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      field: 'Construction',
      skills: ['MS Excel', 'Teamwork', 'Welding'],
    }))
  })

  it('keeps the field optional and sends null when unset', async () => {
    useAuth.mockReturnValue({ user: { ...STORED, field: null }, refreshUser: vi.fn() })
    await openSkills()

    await screen.findByText('MS Excel')
    expect(screen.getByLabelText('Field')).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile.mock.calls[0][1]).toMatchObject({ field: null, skills: ['MS Excel'] })
  })

  it('keeps an unlisted chip in the payload and shows no note', async () => {
    await openSkills()
    await screen.findByText('MS Excel')

    typeSkill('Underwater Basket Weaving')
    expect(screen.getByText('Underwater Basket Weaving')).toBeInTheDocument()
    expect(screen.queryByText(/Unrecognized skills/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile.mock.calls[0][1].skills).toEqual(['MS Excel', 'Underwater Basket Weaving'])
  })

  it('blocks saving without any skill', async () => {
    useAuth.mockReturnValue({ user: { ...STORED, skills: [] }, refreshUser: vi.fn() })
    await openSkills()

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    expect(await screen.findByText('Add at least one skill.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('saves a gibberish-only skill chip', async () => {
    useAuth.mockReturnValue({ user: { ...STORED, skills: [] }, refreshUser: vi.fn() })
    await openSkills()

    typeSkill('Underwater Basket Weaving')
    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile.mock.calls[0][1].skills).toEqual(['Underwater Basket Weaving'])
  })

  it('appends every autofilled skill as a chip', async () => {
    useAuth.mockReturnValue({ user: { ...STORED, skills: ['MS Excel'] }, refreshUser: vi.fn() })
    extractResumeText.mockResolvedValue('Juana Santos\nSkills: Welding, Underwater Basket Weaving')
    await openSkills()
    await screen.findByText('MS Excel')

    fireEvent.click(screen.getByRole('tab', { name: /my resumes/i }))
    fireEvent.change(await screen.findByLabelText('Choose a Resume to Autofill'), {
      target: { files: [new File(['x'], 'resume.pdf', { type: 'application/pdf' })] },
    })
    await screen.findByRole('button', { name: 'Apply detected details' })
    fireEvent.click(await screen.findByRole('checkbox', { name: /resume autofill can make mistakes/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply detected details' }))

    fireEvent.click(screen.getByRole('tab', { name: /skills/i }))
    expect(await screen.findByRole('button', { name: 'Remove Welding' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Underwater Basket Weaving' })).toBeInTheDocument()
    expect(screen.queryByText(/Unrecognized skills/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile.mock.calls[0][1].skills).toEqual(['MS Excel', 'Welding', 'Underwater Basket Weaving'])
  })
})
