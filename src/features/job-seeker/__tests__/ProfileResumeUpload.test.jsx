import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import { listResumes, uploadResume, signedUrl } from '../../../shared/services/documents'
import { extractResumeText } from '../../../shared/lib/resumeText'

describe('Profile resume upload', () => {
  it('uploads the chosen resume and lists it', async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue({ user: { id: 'u1', email: 'a@b.ph' }, refreshUser: vi.fn() })
    listResumes
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 'r1', file_name: 'resume.pdf', file_path: 'resumes/u1/resume.pdf', uploaded_at: '2026-02-01T00:00:00Z', is_active: true }])
    uploadResume.mockResolvedValue('resumes/u1/resume.pdf')
    signedUrl.mockResolvedValue('blob:fake')
    extractResumeText.mockResolvedValue('')

    render(<Profile />)
    await screen.findByRole('button', { name: /save my profile/i })
    await user.click(screen.getByRole('tab', { name: /my resumes/i }))
    await screen.findByText(/start with your story/i)

    fireEvent.change(screen.getByLabelText('Choose a resume to autofill'), {
      target: { files: [new File(['x'], 'resume.pdf', { type: 'application/pdf' })] },
    })
    await user.click(screen.getByRole('button', { name: 'Add resume' }))

    await waitFor(() => expect(uploadResume).toHaveBeenCalledWith('u1', expect.any(File)))
    expect(await screen.findByText('resume.pdf')).toBeInTheDocument()
  })
})
