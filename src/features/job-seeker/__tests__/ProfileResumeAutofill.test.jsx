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

import useAuth from '../../../shared/hooks/useAuth'
import { extractResumeText } from '../../../shared/lib/resumeText'
import { listResumes } from '../../../shared/services/documents'

const TEXT = `Juan Dela Cruz
Email: juan.delacruz@example.com
Mobile: 09171234567
Barangay: Poblacion
Address: Norzagaray-Santa Maria Road
BSIT PUP SANTA MARIA (2023 - Present)
Skills: Data Entry, Communication`

async function openProfile() {
  render(<Profile />)
  await screen.findByRole('button', { name: /save my profile/i })
  fireEvent.click(screen.getByRole('tab', { name: /my resumes/i }))
  await screen.findByLabelText('Choose a resume to autofill')
}

function selectResume() {
  fireEvent.change(screen.getByLabelText('Choose a resume to autofill'), {
    target: { files: [new File(['x'], 'resume.pdf', { type: 'application/pdf' })] },
  })
}

describe('Profile resume autofill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.ph', first_name: '', middle_name: '', last_name: '', phone: '' },
      refreshUser: vi.fn(),
    })
    listResumes.mockResolvedValue([])
  })

  it('previews the details it found without touching the form yet', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    await openProfile()
    selectResume()

    expect(await screen.findByText('Full name')).toBeInTheDocument()
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument()
    expect(screen.getByText(/fields detected/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /personal/i }))
    expect(screen.getByLabelText(/contact number/i)).toHaveValue('')
    expect(screen.getByLabelText(/full name/i)).toHaveValue('')
  })

  it('applies the detected details on confirm', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    await openProfile()
    selectResume()
    const reviewCheckbox = await screen.findByRole('checkbox', { name: /resume autofill can make mistakes/i })
    expect(reviewCheckbox).toBeRequired()
    expect(reviewCheckbox.closest('label').querySelector('[aria-hidden="true"]')).toHaveTextContent('*')
    fireEvent.click(await screen.findByRole('button', { name: 'Apply detected details' }))
    expect(await screen.findByText(/please confirm you will review the resume autofill information/i)).toBeInTheDocument()
    fireEvent.click(reviewCheckbox)
    fireEvent.click(await screen.findByRole('button', { name: 'Apply detected details' }))

    fireEvent.click(screen.getByRole('tab', { name: /personal/i }))
    expect(await screen.findByLabelText(/full name/i)).toHaveValue('Juan Dela Cruz')
    expect(screen.getByLabelText(/contact number/i)).toHaveValue('+639171234567')

    fireEvent.click(screen.getByRole('tab', { name: /address/i }))
    await screen.findByLabelText('Barangay')
    expect(screen.getByLabelText('Barangay')).toHaveValue('Poblacion')
    expect(screen.getByLabelText(/street or local address/i).value).toContain('Norzagaray-Santa Maria Road')

    fireEvent.click(screen.getByRole('tab', { name: /education/i }))
    await screen.findByRole('combobox', { name: /level/i })
    expect(screen.getByRole('combobox', { name: /level/i })).toHaveValue('College')
    expect(screen.getAllByText('Data Entry').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Communication').length).toBeGreaterThan(0)
  })

  it('explains when the resume has nothing it can read', async () => {
    extractResumeText.mockResolvedValue('')
    await openProfile()
    selectResume()

    expect(await screen.findByText(/no supported details detected/i)).toBeInTheDocument()
  })

  it('explains when the file itself cannot be read', async () => {
    extractResumeText.mockRejectedValue(new Error("Couldn't read this format - upload a PDF or DOCX to autofill."))
    await openProfile()
    selectResume()

    expect(await screen.findByText(/couldn't read this format/i)).toBeInTheDocument()
  })
})
