import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Profile from '../Profile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({ updateProfile: vi.fn() }))
vi.mock('../../../shared/lib/resumeText', () => ({ extractResumeText: vi.fn() }))
vi.mock('../../../shared/services/documents', () => ({
  listResumes: vi.fn(),
  uploadResume: vi.fn(),
  setActiveResume: vi.fn(),
  deleteResume: vi.fn(),
  validateFile: vi.fn(() => null),
  signedUrl: vi.fn(),
}))
vi.mock('../../../shared/services/seekers', () => ({
  listEducation: vi.fn(),
  addEducation: vi.fn(),
  removeEducation: vi.fn(),
  listExperience: vi.fn(),
  addExperience: vi.fn(),
  removeExperience: vi.fn(),
  listEmployment: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { extractResumeText } from '../../../shared/lib/resumeText'
import { listResumes, uploadResume, signedUrl } from '../../../shared/services/documents'
import { listEducation, addEducation, removeEducation, listExperience, listEmployment } from '../../../shared/services/seekers'

const TEXT = `Juan Dela Cruz
Email: juan.delacruz@example.com
Mobile: 09171234567
Birthdate: 1990-05-04
Address: Norzagaray-Santa Maria Road
City: Santa Maria
Province: Bulacan
Postal Code: 3022
BSIT PUP SANTA MARIA (2023 - Present)
Skills: Data Entry, Communication`

const RESUMES = [
  { id: 'r1', file_name: 'resume.pdf', file_path: 'resumes/u1/resume.pdf', uploaded_at: '2026-02-01T00:00:00Z', is_active: true },
]

async function openProfile() {
  const { container } = render(<Profile />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }))
  return container
}

function uploadFile(container, name = 'resume.pdf', type = 'application/pdf') {
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File(['x'], name, { type })] },
  })
}

describe('Profile resume autofill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.ph', first_name: '', middle_name: '', last_name: '', phone: '' },
      refreshUser: vi.fn(),
    })
    listEducation.mockResolvedValue([])
    listExperience.mockResolvedValue([])
    listEmployment.mockResolvedValue([])
    listResumes.mockReset()
    listResumes.mockResolvedValueOnce([]).mockResolvedValue(RESUMES)
    uploadResume.mockResolvedValue('resumes/u1/resume.pdf')
    signedUrl.mockResolvedValue('blob:fake')
  })

  it('asks before applying the details it found in a PDF', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    const container = await openProfile()
    uploadFile(container)

    await screen.findByText(/apply them to your profile\?/i)
    expect(screen.getByText(/we found contact details, 2 skills and an education entry/i)).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Juan')).toBeNull()
    expect(screen.getByPlaceholderText('0917 123 4567')).toHaveValue('')
    expect(screen.queryByText('Data Entry')).toBeNull()
  })

  it('applies blank fields, skills and education on Confirm', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    addEducation.mockResolvedValue({ id: 'e1', level: 'College', school: 'PUP SANTA MARIA', field: 'BSIT', end_year: 2023 })
    const container = await openProfile()
    uploadFile(container)
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }))

    await screen.findByDisplayValue('Juan')
    expect(screen.getByDisplayValue('Dela Cruz')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1990-05-04')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Norzagaray-Santa Maria Road')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('0917 123 4567')).toHaveValue('+639171234567')
    expect(screen.getByText('Data Entry')).toBeInTheDocument()
    expect(screen.getByText('Communication')).toBeInTheDocument()
    expect(addEducation).toHaveBeenCalledWith({ level: 'College', school: 'PUP SANTA MARIA', field: 'BSIT', end_year: 2023 })
    expect(await screen.findByText(/pup santa maria/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save profile/i })).toBeInTheDocument()
  })

  it('changes nothing when the user declines', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    const container = await openProfile()
    uploadFile(container)
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))

    expect(await screen.findByText('resume.pdf')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Juan')).toBeNull()
    expect(screen.getByPlaceholderText('0917 123 4567')).toHaveValue('')
    expect(addEducation).not.toHaveBeenCalled()
    expect(uploadResume).toHaveBeenCalled()
  })

  it('never overwrites a field the user already typed', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    const container = await openProfile()
    fireEvent.change(screen.getByPlaceholderText('0917 123 4567'), { target: { value: '09990001111' } })
    uploadFile(container)
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }))

    await screen.findByDisplayValue('Juan')
    expect(screen.getByPlaceholderText('0917 123 4567')).toHaveValue('09990001111')
  })

  it('offers nothing for a .doc upload', async () => {
    const container = await openProfile()
    uploadFile(container, 'resume.doc', 'application/msword')

    await screen.findByText('resume.pdf')
    await waitFor(() => expect(uploadResume).toHaveBeenCalled())
    expect(extractResumeText).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull()
  })

  it('defaults the overwrite opt-in to unchecked', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    const container = await openProfile()
    uploadFile(container)

    await screen.findByRole('button', { name: 'Apply' })
    expect(screen.getByRole('checkbox', { name: /replace existing values/i })).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await screen.findByDisplayValue('Juan')
    expect(addEducation).toHaveBeenCalled()
  })

  it('replaces existing values, skills and education when overwrite is opted in', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    addEducation.mockResolvedValue({ id: 'e1', level: 'College', school: 'PUP SANTA MARIA', field: 'BSIT', end_year: 2023 })
    removeEducation.mockResolvedValue(undefined)
    listEducation.mockResolvedValue([{ id: 'old1', level: 'High School', school: 'OLD SCHOOL', field: null, end_year: 2015 }])
    useAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.ph', first_name: '', middle_name: '', last_name: '', phone: '', skills: ['Old Skill'] },
      refreshUser: vi.fn(),
    })
    const container = await openProfile()
    fireEvent.change(screen.getByPlaceholderText('0917 123 4567'), { target: { value: '09990001111' } })
    uploadFile(container)

    fireEvent.click(await screen.findByRole('checkbox', { name: /replace existing values/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await screen.findByDisplayValue('Juan')
    expect(screen.getByPlaceholderText('0917 123 4567')).toHaveValue('+639171234567')
    expect(screen.getByText('Data Entry')).toBeInTheDocument()
    expect(screen.queryByText('Old Skill')).toBeNull()
    await waitFor(() => expect(removeEducation).toHaveBeenCalledWith('old1'))
    expect(screen.queryByText(/old school/i)).toBeNull()
    expect(await screen.findByText(/pup santa maria/i)).toBeInTheDocument()
  })

  it('keeps the saved education rows when the insert fails', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    addEducation.mockRejectedValue(new Error('insert failed'))
    listEducation.mockResolvedValue([{ id: 'old1', level: 'High School', school: 'OLD SCHOOL', field: null, end_year: 2015 }])
    const container = await openProfile()
    uploadFile(container)

    fireEvent.click(await screen.findByRole('checkbox', { name: /replace existing values/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await screen.findByText(/insert failed/i)
    expect(removeEducation).not.toHaveBeenCalled()
    expect(screen.getByText(/old school/i)).toBeInTheDocument()
  })

  it('never deletes saved education when the resume yields none', async () => {
    extractResumeText.mockResolvedValue('Juan Dela Cruz\nMobile: 09171234567')
    listEducation.mockResolvedValue([{ id: 'old1', level: 'High School', school: 'OLD SCHOOL', field: null, end_year: 2015 }])
    const container = await openProfile()
    uploadFile(container)

    fireEvent.click(await screen.findByRole('checkbox', { name: /replace existing values/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await screen.findByDisplayValue('Juan')
    expect(removeEducation).not.toHaveBeenCalled()
    expect(screen.getByText(/old school/i)).toBeInTheDocument()
  })

  it('names how many saved education entries the overwrite deletes', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    listEducation.mockResolvedValue([
      { id: 'old1', level: 'High School', school: 'OLD SCHOOL', field: null, end_year: 2015 },
      { id: 'old2', level: 'College', school: 'OTHER SCHOOL', field: null, end_year: 2019 },
    ])
    const container = await openProfile()
    uploadFile(container)

    expect(await screen.findByText(/deletes your 2 saved education entries/i)).toBeInTheDocument()
  })

  it('shows the stored names as Title Case on load', async () => {
    useAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.ph', first_name: 'juan', middle_name: 'dela cruz', last_name: 'santos', suffix: 'jr.', phone: '' },
      refreshUser: vi.fn(),
    })
    await openProfile()

    expect(await screen.findByDisplayValue('Juan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Dela Cruz')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Santos')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jr.')).toBeInTheDocument()
  })

  it('leaves a name exactly as typed after load', async () => {
    useAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.ph', first_name: 'juan', middle_name: '', last_name: 'santos', phone: '' },
      refreshUser: vi.fn(),
    })
    await openProfile()

    const firstName = await screen.findByDisplayValue('Juan')
    fireEvent.change(firstName, { target: { value: 'juan' } })
    expect(firstName).toHaveValue('juan')
  })

  it('Title Cases a resume-derived name when the autofill is applied', async () => {
    extractResumeText.mockResolvedValue('JUAN DELA CRUZ\nMobile: 09171234567')
    const container = await openProfile()
    uploadFile(container)
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }))

    expect(await screen.findByDisplayValue('Juan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Dela Cruz')).toBeInTheDocument()
  })
})
