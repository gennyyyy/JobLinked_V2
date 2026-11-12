import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Profile from '../Profile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({ updateProfile: vi.fn() }))
vi.mock('../../../shared/services/documents', () => ({
  listResumes: vi.fn(),
  uploadResume: vi.fn(),
  setActiveResume: vi.fn(),
  deleteResume: vi.fn(),
  validateFile: vi.fn(() => null),
  signedUrl: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { listResumes, deleteResume, signedUrl } from '../../../shared/services/documents'

const RESUMES = [
  { id: 'r-active', file_name: 'active.pdf', file_path: 'resumes/u1/active.pdf', uploaded_at: '2026-02-01T00:00:00Z', is_active: true },
  { id: 'r-old', file_name: 'old.pdf', file_path: 'resumes/u1/old.pdf', uploaded_at: '2026-01-01T00:00:00Z', is_active: false },
]

describe('Profile resume delete', () => {
  it('deletes the resume whose Delete button was clicked, not the active one', async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue({ user: { id: 'u1', email: 'a@b.ph' }, refreshUser: vi.fn() })
    listResumes.mockResolvedValue(RESUMES)
    signedUrl.mockResolvedValue('blob:fake')
    deleteResume.mockResolvedValue({ deleted: true })

    render(<MemoryRouter><Profile /></MemoryRouter>)
    await screen.findByRole('button', { name: /save my profile/i })
    await user.click(screen.getByRole('tab', { name: /my resumes/i }))
    await screen.findByText('old.pdf')

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[1])
    await screen.findByText(/delete this resume/i)
    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' })
    await user.click(confirmButtons[confirmButtons.length - 1])

    expect(deleteResume).toHaveBeenCalledWith('r-old', 'resumes/u1/old.pdf')
    expect(screen.queryByText('old.pdf')).toBeNull()
  })
})
