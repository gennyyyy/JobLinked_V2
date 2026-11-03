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
import { updateProfile } from '../../../shared/services/auth'
import { listResumes } from '../../../shared/services/documents'
import { listEducation, listExperience, listEmployment } from '../../../shared/services/seekers'

const CITY = 'e.g. Santa Maria'
const PROVINCE = 'e.g. Bulacan'
const POSTAL = 'e.g. 3022'

async function openProfile() {
  render(<Profile />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }))
}

describe('Profile address fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listEducation.mockResolvedValue([])
    listExperience.mockResolvedValue([])
    listEmployment.mockResolvedValue([])
    listResumes.mockResolvedValue([])
    updateProfile.mockResolvedValue({})
    useAuth.mockReturnValue({
      user: {
        id: 'u1',
        email: 'a@b.ph',
        first_name: '',
        last_name: '',
        city_municipality: 'Santa Maria',
        province_state: 'Bulacan',
        postal_code: '3022',
      },
      refreshUser: vi.fn(),
    })
  })

  it('loads the stored city, province, and postal code', async () => {
    await openProfile()

    expect(screen.getByPlaceholderText(CITY)).toHaveValue('Santa Maria')
    expect(screen.getByPlaceholderText(PROVINCE)).toHaveValue('Bulacan')
    expect(screen.getByPlaceholderText(POSTAL)).toHaveValue('3022')
  })

  it('saves the typed city, province, and postal code', async () => {
    await openProfile()

    fireEvent.change(screen.getByPlaceholderText(CITY), { target: { value: 'Angat' } })
    fireEvent.change(screen.getByPlaceholderText(PROVINCE), { target: { value: 'Bulacan' } })
    fireEvent.change(screen.getByPlaceholderText(POSTAL), { target: { value: '3012' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      city_municipality: 'Angat',
      province_state: 'Bulacan',
      postal_code: '3012',
    }))
  })
})
