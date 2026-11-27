import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Profile from '../Profile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/account', () => ({
  getPreferences: vi.fn().mockResolvedValue({ application_updates: true, community_announcements: true }),
  updatePreferences: vi.fn(),
  exportAccount: vi.fn(),
  revokeAllSessions: vi.fn(),
  eraseAccount: vi.fn(),
}))
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
import { listEducation, listEmployment } from '../../../shared/services/seekers'
import { listResumes } from '../../../shared/services/documents'
import { getReferenceValues } from '../../../shared/services/reference'

const STORED = {
  id: 'u1',
  email: 'juana@example.com',
  role: 'job-seeker',
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

describe('Profile account settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listResumes.mockResolvedValue([])
    listEducation.mockResolvedValue([])
    listEmployment.mockResolvedValue([])
    getReferenceValues.mockResolvedValue(['Data Entry'])
    useAuth.mockReturnValue({ user: STORED, refreshUser: vi.fn() })
  })

  it('shows the Sessions card and Two-factor panel on the account settings tab', async () => {
    render(<MemoryRouter><Profile /></MemoryRouter>)
    await screen.findByRole('tab', { name: /personal/i })

    fireEvent.click(screen.getByRole('tab', { name: /account settings/i }))

    expect(await screen.findByText('Sessions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out all devices/i })).toBeInTheDocument()
    expect(screen.getByText('Two-factor authentication')).toBeInTheDocument()
  })
})
