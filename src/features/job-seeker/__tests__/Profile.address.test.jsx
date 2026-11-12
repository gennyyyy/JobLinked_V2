import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Profile from '../Profile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({ updateProfile: vi.fn() }))
vi.mock('../../../shared/services/seekers', () => ({
  listEducation: vi.fn(),
  addEducation: vi.fn(),
  removeEducation: vi.fn(),
}))
vi.mock('../../../shared/lib/resumeText', () => ({ extractResumeText: vi.fn() }))
vi.mock('../../../shared/services/documents', () => ({
  listResumes: vi.fn(),
  uploadResume: vi.fn(),
  deleteResume: vi.fn(),
  validateFile: vi.fn(() => null),
  signedUrl: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { updateProfile } from '../../../shared/services/auth'
import { listEducation, addEducation, removeEducation } from '../../../shared/services/seekers'
import { listResumes } from '../../../shared/services/documents'

const STORED = {
  id: 'u1',
  email: 'juana@example.com',
  full_name: 'Juana Santos',
  phone: '09171234567',
  headline: 'Cashier',
  barangay_district: 'Poblacion',
  street_address: '12 Mabini Street',
  education_summary: 'College',
  experience_summary: 'Cashier, 2 years',
  skills: ['Data Entry'],
}

async function openProfile(entry = '/job-seeker/profile') {
  render(<MemoryRouter initialEntries={[entry]}><Profile /></MemoryRouter>)
  await screen.findByRole('tab', { name: /personal/i })
}

describe('Profile fields and save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listResumes.mockResolvedValue([])
    listEducation.mockResolvedValue([{
      id: 'edu1',
      level: 'College',
      school: 'Central College',
      field: 'Business',
      end_year: 2022,
    }])
    addEducation.mockResolvedValue({})
    removeEducation.mockResolvedValue({})
    updateProfile.mockResolvedValue({})
    useAuth.mockReturnValue({ user: STORED, refreshUser: vi.fn() })
  })

  it('loads the stored profile into the form', async () => {
    await openProfile()

    expect(screen.getByLabelText(/full name/i)).toHaveValue('Juana Santos')
    expect(screen.getByLabelText(/contact number/i)).toHaveValue('09171234567')
    expect(screen.getByLabelText(/professional headline/i)).toHaveValue('Cashier')

    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByLabelText('Barangay')
    expect(screen.getByLabelText('Barangay')).toHaveValue('Poblacion')
    expect(screen.getByLabelText(/street or local address/i)).toHaveValue('12 Mabini Street')

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    expect(await screen.findByText('Completed — College')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /^education$/i })).not.toBeInTheDocument()
    expect(screen.getAllByText('College').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Cashier').length).toBeGreaterThan(0)
    expect(screen.getByText('2 years')).toBeInTheDocument()
    expect(screen.getAllByText('Data Entry').length).toBeGreaterThan(0)
  })

  it('saves the edited details', async () => {
    await openProfile()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Juana S. Santos' } })
    fireEvent.change(screen.getByLabelText(/professional headline/i), { target: { value: 'Head cashier' } })

    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByLabelText('Barangay')
    fireEvent.change(screen.getByLabelText('Barangay'), { target: { value: 'Bagbaguin' } })
    fireEvent.change(screen.getByLabelText(/street or local address/i), { target: { value: '48 Rizal Street' } })

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    await screen.findByLabelText('Your skills')
    fireEvent.change(screen.getByLabelText('Your skills'), { target: { value: 'Customer Service' } })
    fireEvent.keyDown(screen.getByLabelText('Your skills'), { key: 'Enter' })

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      full_name: 'Juana S. Santos',
      phone: '09171234567',
      headline: 'Head cashier',
      barangay_district: 'Bagbaguin',
      street_address: '48 Rizal Street',
      experience_summary: 'Cashier, 2 years',
      skills: ['Data Entry', 'Customer Service'],
    }))
    expect(updateProfile.mock.calls[0][1]).not.toHaveProperty('education_summary')
  })

  it('updates education status when education history is added and removed', async () => {
    listEducation.mockResolvedValue([])
    addEducation.mockResolvedValue({
      id: 'edu2',
      level: 'College',
      school: 'Metro College',
      field: null,
      end_year: 2025,
    })
    await openProfile()

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    expect(await screen.findByText('No education history added')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'College' } })
    fireEvent.change(screen.getByLabelText('School'), { target: { value: 'Metro College' } })
    fireEvent.change(screen.getByLabelText('Graduation year'), { target: { value: '2025' } })
    fireEvent.click(screen.getByRole('button', { name: /add education/i }))
    expect(await screen.findByText('Completed — College')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('No education history added')).toBeInTheDocument()
  })

  it('shows current study status from an ongoing education record', async () => {
    listEducation.mockResolvedValue([{
      id: 'edu3',
      level: 'Senior High School',
      school: 'Santa Maria High School',
      field: null,
      end_year: null,
    }])
    await openProfile()

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    expect(await screen.findByText('Currently studying — Senior High School')).toBeInTheDocument()
  })

  it('shows an error instead of treating failed education history as empty', async () => {
    listEducation.mockRejectedValue(new Error('Education records could not be loaded'))
    await openProfile()

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    expect(await screen.findByText('Education history unavailable')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Education records could not be loaded')
  })

  it('shows account settings in the profile tab without a separate profile save form', async () => {
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /account settings/i }))

    expect(await screen.findByText('Account overview')).toBeInTheDocument()
    expect(screen.getByText('Privacy comes first').closest('aside')).toBeInTheDocument()
    expect(screen.getByText('juana@example.com')).toBeInTheDocument()
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save my profile/i })).not.toBeInTheDocument()
    expect(document.querySelectorAll('form')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))
    expect(await screen.findByText('Your session notification preferences were saved.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('opens the account tab for account settings section links', async () => {
    await openProfile('/job-seeker/profile#account-overview')

    expect(await screen.findByText('Account overview')).toBeInTheDocument()
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
  })

  it('blocks the save and explains what is missing', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', email: 'a@b.ph' }, refreshUser: vi.fn() })
    listEducation.mockResolvedValue([])
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    await screen.findByText('No education history added')
    fireEvent.click(screen.getByRole('tab', { name: /personal/i }))

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    expect(await screen.findByText('Enter your full name.')).toBeInTheDocument()
    expect(screen.getByText('Add a short professional headline.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByText('Choose your barangay.')

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    await screen.findByText('Add at least one skill, separated by commas.')
    expect(screen.getByText('Add your education history.')).toBeInTheDocument()

    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('title-cases stored lowercase values in the edit inputs', async () => {
    useAuth.mockReturnValue({
      user: {
        ...STORED,
        full_name: 'juana santos',
        first_name: 'juana',
        last_name: 'santos',
        barangay_district: 'poblacion',
        street_address: '12 mabini street',
      },
      refreshUser: vi.fn(),
    })
    await openProfile()

    expect(screen.getByLabelText(/full name/i)).toHaveValue('Juana Santos')
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Juana')

    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByLabelText('Barangay')
    expect(screen.getByLabelText('Barangay')).toHaveValue('Poblacion')
    expect(screen.getByLabelText(/street or local address/i)).toHaveValue('12 Mabini Street')
  })
})
