import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Profile from '../Profile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({ updateProfile: vi.fn() }))
vi.mock('../../../shared/lib/resumeText', () => ({ extractResumeText: vi.fn() }))
vi.mock('../../../shared/services/documents', () => ({
  listResumes: vi.fn(),
  uploadResume: vi.fn(),
  deleteResume: vi.fn(),
  validateFile: vi.fn(() => null),
  signedUrl: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { listResumes, signedUrl } from '../../../shared/services/documents'

async function openProfile() {
  render(<MemoryRouter><Profile /></MemoryRouter>)
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

    const profileCard = screen.getByRole('tab', { name: /personal/i }).closest('[data-slot="card"]')
    expect(profileCard).toContainElement(screen.getByRole('tablist'))
    for (const name of [/personal/i, /address/i, /education/i, /my resumes/i, /account settings/i]) {
      expect(profileCard).toContainElement(screen.getByRole('tab', { name }))
    }

    for (const name of [
      /full name/i, /contact number/i, /professional headline/i, 'Profile picture',
    ]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByLabelText('Barangay')
    for (const name of ['Barangay', /street or local address/i]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    await screen.findByRole('combobox', { name: /level/i })
    expect(screen.getByRole('combobox', { name: /level/i })).toBeInTheDocument()
    for (const name of ['Work experience', 'Your skills']) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('tab', { name: /my resumes/i }))
    await screen.findByLabelText('Choose a resume to autofill')
    expect(screen.getByLabelText('Choose a resume to autofill')).toBeInTheDocument()
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

  it('announces that the resume "View" action opens in a new tab', async () => {
    listResumes.mockResolvedValue([
      { id: 'r1', file_path: 'u1/resume.pdf', file_name: 'resume.pdf', is_active: true, uploaded_at: '2026-01-01T00:00:00.000Z' },
    ])
    signedUrl.mockResolvedValue('blob:test')
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /my resumes/i }))
    // View is a button now: it fetches on click (no prefetch), then opens the
    // object URL in a new tab. The announcement must survive that change.
    const notice = await screen.findByText(/opens in new tab/i)
    expect(notice.closest('button')).not.toBeNull()
  })
})
