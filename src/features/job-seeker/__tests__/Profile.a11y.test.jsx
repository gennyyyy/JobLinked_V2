import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

import useAuth from '../../../shared/hooks/useAuth'
import { listResumes, signedUrl } from '../../../shared/services/documents'

async function openProfile() {
  render(<Profile />)
  return screen.findByRole('button', { name: /save my profile/i })
}

describe('Profile accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.ph', first_name: 'Juana', last_name: 'Santos' },
      refreshUser: vi.fn(),
    })
    listResumes.mockResolvedValue([])
  })

  it('pairs every form label with its control', async () => {
    await openProfile()

    for (const name of [
      /full name/i, /contact number/i, /professional headline/i, 'Barangay',
      /street or local address/i, 'Education or training', 'Work experience', 'Your skills',
      'Choose a resume', 'Profile picture',
    ]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
  })

  it('shows no validation message until the form is submitted', async () => {
    await openProfile()
    expect(screen.queryByText('Enter your full name.')).toBeNull()
    expect(screen.queryByText(/couldn't read this format/i)).toBeNull()
  })

  it('keeps the save hint in a status region', async () => {
    await openProfile()
    expect(screen.getAllByRole('status').some((node) => node.textContent === 'Changes are saved to your JobLinked account.')).toBe(true)
  })

  it('reports profile completion as text', async () => {
    await openProfile()
    expect(screen.getByText(/13% complete/i)).toBeInTheDocument()
  })

  it('announces that the resume "View" link opens in a new tab', async () => {
    listResumes.mockResolvedValue([
      { id: 'r1', file_path: 'u1/resume.pdf', file_name: 'resume.pdf', is_active: true, uploaded_at: '2026-01-01T00:00:00.000Z' },
    ])
    signedUrl.mockResolvedValue('blob:test')
    await openProfile()
    const notice = await screen.findByText(/opens in new tab/i)
    expect(notice.closest('a')).toHaveAttribute('target', '_blank')
  })
})
