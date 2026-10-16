import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
import { listResumes } from '../../../shared/services/documents'
import { listEducation, listExperience, listEmployment } from '../../../shared/services/seekers'

async function openProfile() {
  render(<Profile />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }))
}

describe('Profile barangay field', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listEducation.mockResolvedValue([])
    listExperience.mockResolvedValue([])
    listEmployment.mockResolvedValue([])
    listResumes.mockResolvedValue([])
  })

  function storedBarangay(value) {
    useAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.ph', first_name: '', last_name: '', phone: '', barangay_district: value },
      refreshUser: vi.fn(),
    })
  }

  it('shows an official stored barangay in the dropdown', async () => {
    storedBarangay('Poblacion')
    await openProfile()

    expect(screen.getByLabelText('Barangay / District')).toHaveValue('Poblacion')
  })

  it('keeps a legacy stored barangay that is not in the official list', async () => {
    storedBarangay('Sto. Rosario')
    await openProfile()

    expect(screen.getByLabelText('Barangay / District')).toHaveValue('Sto. Rosario')
    expect(screen.getByRole('option', { name: 'Sto. Rosario' })).toBeInTheDocument()
  })
})
