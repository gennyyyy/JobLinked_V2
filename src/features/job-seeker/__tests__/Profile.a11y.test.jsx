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
import { listEducation, listExperience, listEmployment } from '../../../shared/services/seekers'
import { listResumes, signedUrl } from '../../../shared/services/documents'

async function openEditForm() {
  const editButton = await screen.findByRole('button', { name: 'Edit Profile' })
  fireEvent.click(editButton)
  return screen.findByRole('button', { name: 'Save Profile' })
}

describe('Profile accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
      user: {
        id: 'u1',
        email: 'a@b.ph',
        first_name: 'Juana',
        last_name: 'Santos',
        city_municipality: 'Santa Maria',
        province_state: 'Bulacan',
        postal_code: '3022',
      },
      refreshUser: vi.fn(),
    })
    listEducation.mockResolvedValue([])
    listExperience.mockResolvedValue([])
    listEmployment.mockResolvedValue([])
    listResumes.mockResolvedValue([])
  })

  it('pairs every edit-form label with its control', async () => {
    render(<Profile />)
    await openEditForm()

    for (const name of [
      'First Name', /Middle Name/, 'Last Name', /Suffix/, 'Contact Mobile', 'Date of Birth',
      'Block', 'Lot', 'Street Address', /Subdivision/, /City \/ Municipality/,
      /Province \/ State/, 'Postal Code', 'Barangay / District', 'Employment Status',
      /Skills & Competencies/, /Preferred Jobs/, /Preferred Locations/, 'Start Date', /End Date/,
    ]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
  })

  it('names the placeholder-only experience and education inputs', async () => {
    render(<Profile />)
    await openEditForm()

    for (const name of [/company name/i, /job title/i, /description of responsibilities/i]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
    for (const name of [/education level/i, /school name/i, /course \/ field of study/i, /graduation year/i]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
  })

  it('renders the avatar initials with a compliant token', async () => {
    const { container } = render(<Profile />)
    await screen.findByRole('button', { name: 'Edit Profile' })
    const avatar = container.querySelector('.text-dark-blue')
    expect(avatar).toBeInTheDocument()
    expect(avatar.className).not.toContain('text-gray-400')
    expect(avatar).toHaveTextContent('JS')
  })

  it('shows no alert and no status region until something actually fails or loads', async () => {
    render(<Profile />)
    await openEditForm()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('exposes profile completion as a labelled progressbar with ARIA values', async () => {
    render(<Profile />)
    await screen.findByRole('button', { name: 'Edit Profile' })
    const bar = screen.getByRole('progressbar', { name: /profile completion/i })
    expect(bar).toHaveAttribute('aria-valuenow', '17')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-valuetext', '17% complete')
  })

  it('announces that the resume "View" link opens in a new tab', async () => {
    listResumes.mockResolvedValue([
      { id: 'r1', file_path: 'u1/resume.pdf', file_name: 'resume.pdf', is_active: true, uploaded_at: '2026-01-01T00:00:00.000Z' },
    ])
    signedUrl.mockResolvedValue('blob:test')
    render(<Profile />)
    await screen.findByRole('button', { name: 'Edit Profile' })
    const notice = await screen.findByText(/opens in new tab/i)
    const link = notice.closest('a')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
