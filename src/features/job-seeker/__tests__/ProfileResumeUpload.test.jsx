import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Profile from '../Profile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/hooks/useVocabulary', () => {
  const vocabulary = () => ({ values: ['Teamwork'], loading: false, error: '', reload: vi.fn() })
  return { default: vocabulary, useVocabulary: vocabulary }
})
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
import { listEducation } from '../../../shared/services/seekers'
import { listResumes, uploadResume, signedUrl } from '../../../shared/services/documents'
import { extractResumeText } from '../../../shared/lib/resumeText'

const SAVED = { id: 'r1', file_name: 'resume.pdf', file_path: 'resumes/u1/resume.pdf', uploaded_at: '2026-02-01T00:00:00Z', is_active: true }

// Everything validate() checks passes, so only the resume step can fail.
const VALID_USER = {
  id: 'u1',
  email: 'a@b.ph',
  full_name: 'Juana Santos',
  phone: '09171234567',
  headline: 'Cashier',
  barangay_district: 'Poblacion',
  street_address: '12 Mabini Street',
  skills: ['teamwork'],
}

async function openResumes() {
  render(<MemoryRouter><Profile /></MemoryRouter>)
  await screen.findByRole('button', { name: /save my profile/i })
  fireEvent.click(screen.getByRole('tab', { name: /my resumes/i }))
  await screen.findByText(/no resume added/i)
}

function selectResume() {
  fireEvent.change(screen.getByLabelText('Choose a Resume to Autofill'), {
    target: { files: [new File(['x'], 'resume.pdf', { type: 'application/pdf' })] },
  })
}

describe('Profile resume upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', email: 'a@b.ph' }, refreshUser: vi.fn() })
    listResumes.mockResolvedValue([])
    listEducation.mockResolvedValue([])
    uploadResume.mockResolvedValue('resumes/u1/resume.pdf')
    signedUrl.mockResolvedValue('blob:fake')
    extractResumeText.mockResolvedValue('')
  })

  it('stages the chosen resume without uploading, then uploads it on save', async () => {
    const user = userEvent.setup()
    listResumes.mockResolvedValueOnce([]).mockResolvedValue([SAVED])
    await openResumes()

    selectResume()

    expect(await screen.findByText(/selected resume\.pdf/i)).toBeInTheDocument()
    expect(uploadResume).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /save my profile/i }))

    await waitFor(() => expect(uploadResume).toHaveBeenCalledWith('u1', expect.any(File)))
    // The blocked save jumps to the first error tab (Personal), so reopen the
    // resumes tab to see the uploaded row.
    fireEvent.click(screen.getByRole('tab', { name: /my resumes/i }))
    expect(await screen.findByText('resume.pdf')).toBeInTheDocument()
  })

  it('shows the upload error and saves no profile when the upload fails', async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue({ user: VALID_USER, refreshUser: vi.fn() })
    listEducation.mockResolvedValue([{ id: 'edu1', level: 'College', school: 'Central College', field: 'Business', end_year: 2022 }])
    uploadResume.mockRejectedValue(new Error('Upload failed.'))
    await openResumes()

    selectResume()
    await user.click(screen.getByRole('button', { name: /save my profile/i }))

    expect(await screen.findByText('Upload failed.')).toBeInTheDocument()
    expect(uploadResume).toHaveBeenCalledTimes(1)
    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.queryByText('Profile saved.')).toBeNull()
  })
})
