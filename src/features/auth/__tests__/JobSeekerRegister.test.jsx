import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobSeekerRegister from '../JobSeekerRegister'
import { signUp } from '../../../shared/services/auth'
import { addEducation } from '../../../shared/services/seekers'
import { extractResumeText } from '../../../shared/lib/resumeText'

vi.mock('../../../shared/services/auth', () => ({
  signUp: vi.fn(),
}))

vi.mock('../../../shared/services/documents', () => ({
  validateFile: vi.fn(() => null),
  uploadResume: vi.fn(),
}))

vi.mock('../../../shared/services/seekers', () => ({
  addEducation: vi.fn(),
}))

vi.mock('../../../shared/lib/resumeText', () => ({
  extractResumeText: vi.fn(),
}))

const TEXT = `Juan Dela Cruz
Email: juan.delacruz@example.com
Mobile: 09171234567
Address: Norzagaray-Santa Maria Road
City: Santa Maria
Province: Bulacan
Postal Code: 3022`

const SKILLED = `${TEXT}
Birthdate: 1990-05-04
Skills: Data Entry, Communication`

function renderPage() {
  return render(
    <MemoryRouter>
      <JobSeekerRegister />
    </MemoryRouter>
  )
}

function pickFile(name = 'resume.pdf', type = 'application/pdf') {
  const input = screen.getByLabelText(/autofill from resume/i)
  fireEvent.change(input, { target: { files: [new File(['x'], name, { type })] } })
  return input
}

describe('JobSeekerRegister autofill', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a single full form with no mode toggle', () => {
    renderPage()
    expect(screen.getByLabelText(/autofill from resume/i)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /registration method/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/city \/ municipality/i)).toBeInTheDocument()
  })

  it('fills inputs from a PDF but leaves them editable', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    renderPage()
    pickFile()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/filled 8 fields/i))
    expect(screen.getByLabelText(/^first name/i)).toHaveValue('Juan')
    expect(screen.getByLabelText(/email address/i)).toHaveValue('juan.delacruz@example.com')

    const first = screen.getByLabelText(/^first name/i)
    fireEvent.change(first, { target: { value: 'Jose' } })
    expect(first).toHaveValue('Jose')
  })

  it('leaves boxes untouched for unsupported formats', async () => {
    renderPage()
    pickFile('photo.png', 'image/png')

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/couldn't read this format/i))
    expect(extractResumeText).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/^first name/i)).toHaveValue('')
  })

  it('wires autofilled skills into the tag box and reports the count', async () => {
    extractResumeText.mockResolvedValue(SKILLED)
    renderPage()
    pickFile()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/filled 10 fields.*2 skills found/i))
    expect(screen.getByText('Data Entry')).toBeInTheDocument()
    expect(screen.getByText('Communication')).toBeInTheDocument()
  })

  it('keeps hand-typed email and typed skills when autofilling', async () => {
    extractResumeText.mockResolvedValue(SKILLED)
    renderPage()

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'me@typed.com' } })
    const tagInput = screen.getByLabelText(/type a skill and press enter/i)
    fireEvent.change(tagInput, { target: { value: 'Typed Skill,' } })

    pickFile()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/skills found/i))

    expect(screen.getByLabelText(/email address/i)).toHaveValue('me@typed.com')
    expect(screen.getByText('Typed Skill')).toBeInTheDocument()
    expect(screen.getByText('Data Entry')).toBeInTheDocument()
    expect(screen.getByText('Communication')).toBeInTheDocument()
  })

  it('sends edited skills as an array via signUp extra', async () => {
    extractResumeText.mockResolvedValue(SKILLED)
    signUp.mockResolvedValue({ id: 'seeker-1', emailConfirmationRequired: false })
    renderPage()
    pickFile()
    await waitFor(() => expect(screen.getByText('Data Entry')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(signUp.mock.calls[0][0].extra).toMatchObject({ skills: ['Data Entry', 'Communication'] })
  })

  it('prefills the education row from the resume but keeps it out of signUp', async () => {
    extractResumeText.mockResolvedValue(`${SKILLED}\nCORNELIA M. DE JESUS MEMORIAL\nSCHOOL (GRADE 1 - 6)\nBSIT PUP SANTA MARIA (2023 - Present)`)
    signUp.mockResolvedValue({ id: 'seeker-1', emailConfirmationRequired: false })
    renderPage()
    pickFile()

    await waitFor(() => expect(screen.getByLabelText(/education level/i)).toHaveValue('College'))
    fireEvent.change(screen.getByPlaceholderText('School name'), { target: { value: 'PUP Santa Maria' } })
    expect(screen.getByPlaceholderText('School name')).toHaveValue('PUP Santa Maria')
    expect(screen.getByPlaceholderText('Course / field')).toHaveValue('BSIT')

    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(JSON.stringify(signUp.mock.calls[0][0])).not.toContain('PUP Santa Maria')
    expect(addEducation).not.toHaveBeenCalled()
  })

  it('renders inert education history placeholders matching Profile', () => {
    renderPage()
    expect(screen.getByText('Education History')).toBeInTheDocument()
    const level = screen.getByLabelText(/education level/i)
    expect(level).toBeInTheDocument()
    expect(level.tagName).toBe('SELECT')
    expect(level).not.toHaveAttribute('name')
    for (const opt of ['Elementary', 'High School', 'Senior High School', 'Vocational', 'College', 'Post-Graduate']) {
      expect(screen.getByRole('option', { name: opt })).toBeInTheDocument()
    }
    expect(screen.getByPlaceholderText('School name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Course / field')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Year')).toBeInTheDocument()
    for (const el of [screen.getByPlaceholderText('School name'), screen.getByPlaceholderText('Course / field'), screen.getByPlaceholderText('Year')]) {
      expect(el).not.toHaveAttribute('name')
    }
  })

  it('ignores education placeholders on submit', async () => {
    extractResumeText.mockResolvedValue(SKILLED)
    signUp.mockResolvedValue({ id: 'seeker-1', emailConfirmationRequired: false })
    renderPage()
    pickFile()
    await waitFor(() => expect(screen.getByText('Data Entry')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/education level/i), { target: { value: 'College' } })
    fireEvent.change(screen.getByPlaceholderText('School name'), { target: { value: 'Bulacan State' } })
    fireEvent.change(screen.getByPlaceholderText('Course / field'), { target: { value: 'IT' } })
    fireEvent.change(screen.getByPlaceholderText('Year'), { target: { value: '2020' } })
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(signUp).toHaveBeenCalled())
    const payload = JSON.stringify(signUp.mock.calls[0][0])
    for (const key of ['eduLevel', 'eduSchool', 'eduField', 'eduYear', 'education', 'level', 'school', 'field', 'end_year', 'Bulacan State']) {
      expect(payload).not.toContain(key)
    }
    expect(addEducation).not.toHaveBeenCalled()
  })
})
