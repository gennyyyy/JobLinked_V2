import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
import { getPreferences, updatePreferences } from '../../../shared/services/account'
import { updateProfile } from '../../../shared/services/auth'
import { listEducation, addEducation, removeEducation, listEmployment } from '../../../shared/services/seekers'
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
    getPreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    updatePreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    listEducation.mockResolvedValue([{
      id: 'edu1',
      level: 'College',
      school: 'Central College',
      field: 'Business',
      end_year: 2022,
    }])
    addEducation.mockResolvedValue({})
    removeEducation.mockResolvedValue({})
    listEmployment.mockResolvedValue([])
    updateProfile.mockResolvedValue({})
    getReferenceValues.mockImplementation(async (category) => (
      category === 'job_field' ? ['Construction', 'Information Technology'] : ['Data Entry', 'Customer Service']
    ))
    useAuth.mockReturnValue({ user: STORED, refreshUser: vi.fn() })
  })

  it('loads the stored profile into the form', async () => {
    await openProfile()

    expect(screen.getByLabelText(/full name/i)).toHaveValue('Juana Santos')
    expect(screen.getByLabelText(/contact number/i)).toHaveValue('917 123 4567')
    expect(screen.getByLabelText(/professional headline/i)).toHaveValue('Cashier')

    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByLabelText(/^Barangay/)
    expect(screen.getByLabelText(/^Barangay/)).toHaveValue('Poblacion')
    expect(screen.getByLabelText(/street or local address/i)).toHaveValue('12 Mabini Street')

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    expect(await screen.findByText('Completed — College')).toBeInTheDocument()
    expect(screen.getByText('Business · Graduated 2022')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /^education$/i })).not.toBeInTheDocument()
    expect(screen.getAllByText('College').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('tab', { name: /skills/i }))
    await screen.findByLabelText('Work Experience')
    expect(screen.getAllByText('Cashier').length).toBeGreaterThan(0)
    expect(screen.getByText('2 years')).toBeInTheDocument()
    expect(screen.getAllByText('Data Entry').length).toBeGreaterThan(0)
  })

  it('saves the edited details', async () => {
    await openProfile()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Juana S. Santos' } })
    fireEvent.change(screen.getByLabelText(/professional headline/i), { target: { value: 'Head cashier' } })

    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByLabelText(/^Barangay/)
    fireEvent.change(screen.getByLabelText(/^Barangay/), { target: { value: 'Bagbaguin' } })
    fireEvent.change(screen.getByLabelText(/street or local address/i), { target: { value: '48 Rizal Street' } })

    fireEvent.click(screen.getByRole('tab', { name: /skills/i }))
    const skillsInput = await screen.findByRole('combobox', { name: /your skills/i })
    // The autocomplete list appears once the skill vocabulary has loaded.
    await waitFor(() => expect(skillsInput).toHaveAttribute('list'))
    fireEvent.change(skillsInput, { target: { value: 'Customer Service' } })
    fireEvent.keyDown(skillsInput, { key: 'Enter' })
    expect(await screen.findByRole('button', { name: 'Remove Customer Service' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      full_name: 'Juana S. Santos',
      phone: '+639171234567',
      headline: 'Head cashier',
      barangay_district: 'Bagbaguin',
      street_address: '48 Rizal Street',
      experience_summary: 'Cashier, 2 years',
      skills: ['Data Entry', 'Customer Service'],
    }))
    expect(updateProfile.mock.calls[0][1]).not.toHaveProperty('education_summary')
    expect(await screen.findByText('Changes saved')).toBeInTheDocument()
  })

  it('shows the success toast before the save request resolves', async () => {
    let resolveSave
    updateProfile.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve }))
    await openProfile()

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    // Optimistic: the toast is up while updateProfile is still pending.
    expect(await screen.findByText('Changes saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()

    resolveSave({})
    expect(await screen.findByRole('button', { name: /save my profile/i })).toBeEnabled()
    expect(screen.getByText('Changes saved')).toBeInTheDocument()
  })

  it('shows an error toast and the inline error when the save fails', async () => {
    updateProfile.mockRejectedValue(new Error('Profile could not be saved'))
    await openProfile()

    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    expect(await screen.findByText('Changes not saved')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Profile could not be saved')
  })

  it('saves a cleared professional headline as empty', async () => {
    await openProfile()

    fireEvent.change(screen.getByLabelText(/professional headline/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({ headline: '' }))
  })

  it('blocks the save and explains an invalid contact number', async () => {
    await openProfile()

    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    expect(await screen.findByText('Enter a valid Philippine contact number.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('saves a spaced contact number in +63 form', async () => {
    await openProfile()

    fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '0917 123 4567' } })
    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({ phone: '+639171234567' }))
    expect(screen.getByLabelText(/contact number/i)).toHaveValue('917 123 4567')
  })

  it('validates the contact number on blur before saving', async () => {
    await openProfile()
    const phone = screen.getByLabelText(/contact number/i)
    // The fixed prefix is outside the editable input.
    expect(within(phone.closest('[data-slot="input-group"]')).getByText('+63')).toBeVisible()
    expect(phone).toHaveValue('917 123 4567')

    fireEvent.change(phone, { target: { value: '12345' } })
    fireEvent.blur(phone)

    expect(await screen.findByText('Enter a valid Philippine contact number.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()

    fireEvent.change(phone, { target: { value: '0917 123 4567' } })
    expect(screen.queryByText('Enter a valid Philippine contact number.')).not.toBeInTheDocument()
    expect(phone).toHaveValue('917 123 4567')
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

    fireEvent.change(screen.getByLabelText(/^Level/), { target: { value: 'College' } })
    fireEvent.change(screen.getByLabelText(/^School/), { target: { value: 'Metro College' } })
    fireEvent.change(screen.getByLabelText(/^Graduation Year/), { target: { value: '2025' } })
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

    fireEvent.click(screen.getByRole('switch', { name: /community announcements/i }))
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))
    expect(await screen.findByText('Your notification preferences were saved.')).toBeInTheDocument()
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

    // A failed save jumps to the tab that owns the first error.
    expect(await screen.findByText('Enter your full name.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByText('Choose your barangay.')

    fireEvent.click(screen.getByRole('tab', { name: /skills/i }))
    await screen.findByText('Add at least one skill.')

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    await screen.findByText('Add your education history.')

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
    await screen.findByLabelText(/^Barangay/)
    expect(screen.getByLabelText(/^Barangay/)).toHaveValue('Poblacion')
    expect(screen.getByLabelText(/street or local address/i)).toHaveValue('12 Mabini Street')
  })

  it('renders city and province as dropdowns with the Bulacan options', async () => {
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /address/i }))

    const city = screen.getByLabelText(/^City \/ Municipality/)
    const province = screen.getByLabelText(/^Province \/ State/)
    expect(city.tagName).toBe('SELECT')
    expect(province.tagName).toBe('SELECT')
    expect(within(city).getByRole('option', { name: 'Angat' })).toBeInTheDocument()
    expect(within(city).getByRole('option', { name: 'Santa Maria' })).toBeInTheDocument()
    expect(within(province).getByRole('option', { name: 'Bulacan' })).toBeInTheDocument()
  })

  it('loads listed stored city and province into the dropdowns', async () => {
    useAuth.mockReturnValue({
      user: { ...STORED, city_municipality: 'santa maria', province_state: 'bulacan' },
      refreshUser: vi.fn(),
    })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /address/i }))

    expect(screen.getByLabelText(/^City \/ Municipality/)).toHaveValue('Santa Maria')
    expect(screen.getByLabelText(/^Province \/ State/)).toHaveValue('Bulacan')
  })

  it('loads an out-of-list city and province as blanks and blocks the save', async () => {
    useAuth.mockReturnValue({
      user: { ...STORED, city_municipality: 'Quezon City', province_state: 'Metro Manila' },
      refreshUser: vi.fn(),
    })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /address/i }))

    expect(screen.getByLabelText(/^City \/ Municipality/)).toHaveValue('')
    expect(screen.getByLabelText(/^Province \/ State/)).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Select city / municipality' })).toBeInTheDocument()

    // Both are required now, so an out-of-list address cannot be saved blank.
    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))
    expect(await screen.findByText('Choose your city / municipality.')).toBeInTheDocument()
    expect(screen.getByText('Choose your province.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('saves the picked city and province', async () => {
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /address/i }))

    fireEvent.change(screen.getByLabelText(/^City \/ Municipality/), { target: { value: 'Angat' } })
    fireEvent.change(screen.getByLabelText(/^Province \/ State/), { target: { value: 'Bulacan' } })
    fireEvent.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      city_municipality: 'Angat',
      province_state: 'Bulacan',
    }))
  })
})
