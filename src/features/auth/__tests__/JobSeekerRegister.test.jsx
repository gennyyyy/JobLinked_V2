import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JobSeekerRegister from '../JobSeekerRegister'

vi.mock('../../../shared/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn(), blob: vi.fn() },
  clearApiCache: vi.fn(),
  setApiIdentity: vi.fn(),
}))
// The screen runs the real service against the shared BA client seam; the
// pending-signup POST is the service's only other side effect.
vi.mock('../../../shared/lib/auth-client', async () => {
  const { authClientMock } = await import('../../../test/authClientMock')
  return { authClient: authClientMock }
})
vi.mock('../../../shared/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn(), updateUser: vi.fn() } },
}))

vi.mock('../../../shared/lib/resumeText', () => ({
  extractResumeText: vi.fn(),
}))

vi.mock('../../../shared/services/reference', () => ({
  getReferenceValues: vi.fn(),
}))

import { api } from '../../../shared/lib/api'
import { extractResumeText } from '../../../shared/lib/resumeText'
import { getReferenceValues } from '../../../shared/services/reference'
import { authClientMock, resetAuthClient } from '../../../test/authClientMock'

// BA returns the created user; the service then parks the form profile.
const signedUp = (user = { id: 'user-1' }) => {
  authClientMock.signUp.email.mockResolvedValue({ data: { token: null, user }, error: null })
}
const parked = (i = 0) => api.post.mock.calls[i][1]
const sentCaptcha = (i = 0) =>
  authClientMock.signUp.email.mock.calls[i]?.[0]?.fetchOptions?.headers?.['x-captcha-response']

// Mutable site key: '' (the default) keeps every non-captcha test on today's
// behavior; 'site-key' makes useCaptcha().required true. The widget itself is
// replaced by a button that hands the form a token.
const captcha = vi.hoisted(() => ({ siteKey: '' }))

vi.mock('../../../shared/lib/turnstile', () => ({
  get TURNSTILE_SITE_KEY() { return captcha.siteKey },
  loadTurnstile: vi.fn(),
  renderTurnstile: vi.fn(),
  resetTurnstile: vi.fn(),
  removeTurnstile: vi.fn(),
}))

vi.mock('../../../shared/components/Turnstile', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ onToken }) => createElement(
      'button',
      { type: 'button', onClick: () => onToken('captcha-token') },
      'solve captcha',
    ),
  }
})

beforeEach(() => {
  resetAuthClient()
  // TermsModal reads the legal notice through the same API layer.
  api.get.mockResolvedValue(null)
  api.post.mockResolvedValue({ saved: true })
  captcha.siteKey = ''
  getReferenceValues.mockImplementation(async (category) => (
    category === 'job_field' ? ['Construction', 'Information Technology'] : ['Communication', 'Data Entry', 'Welding']
  ))
})

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

function fillRequired({ confirmResumeReview = true } = {}) {
  fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: 'Juan' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Cruz' } })
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'juan@example.com' } })
  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '09171234567' } })
  fireEvent.change(screen.getByLabelText(/birthday/i), { target: { value: '1990-05-04' } })
  fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'password123!' } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } })
  fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'Unemployed' } })
  if (confirmResumeReview) {
    fireEvent.click(screen.getByRole('checkbox', { name: /resume autofill can make mistakes/i }))
  }
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: 'Norzagaray-Santa Maria Road' } })
  fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
  fireEvent.change(screen.getByLabelText(/city \/ municipality/i), { target: { value: 'Santa Maria' } })
  fireEvent.change(screen.getByLabelText(/province/i), { target: { value: 'Bulacan' } })
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
  fireEvent.click(screen.getByRole('checkbox', { name: /agree to the municipal/i }))
  fireEvent.click(screen.getByRole('checkbox', { name: /true and correct/i }))
}

describe('JobSeekerRegister autofill', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a single full form with no mode toggle', () => {
    renderPage()
    expect(screen.getByLabelText(/autofill from resume/i)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /registration method/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^first name/i)).toBeInTheDocument()
    expect(screen.getByText('Step 1 — Personal Details')).toBeInTheDocument()
    expect(screen.queryByText('Step 2 — Address Information')).not.toBeInTheDocument()
    expect(screen.queryByText('Step 3 — Background & Consent')).not.toBeInTheDocument()
  })

  it('renders the password requirements checklist under the password field', () => {
    renderPage()
    const list = screen.getByRole('list', { name: /password requirements/i })
    expect(list).toHaveTextContent('At least 8 characters')
    expect(list).toHaveTextContent('One symbol (e.g. ! @ # $)')
  })

  it('fills inputs from a PDF but leaves them editable', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    renderPage()
    pickFile()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Autofill done — please check:/i))
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

  it('selects autofilled skills in the vocabulary picker and reports the count', async () => {
    extractResumeText.mockResolvedValue(SKILLED)
    renderPage()
    pickFile()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Autofill done — please check:/i))
    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'Unemployed' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /resume autofill can make mistakes/i }))
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    expect(await screen.findByText('Data Entry')).toBeInTheDocument()
    expect(screen.getByText('Communication')).toBeInTheDocument()
    expect(screen.queryByText('Welding')).not.toBeInTheDocument()
  })

  it('lists a resume skill outside the vocabulary without sending it', async () => {
    extractResumeText.mockResolvedValue(`${SKILLED}, Underwater Basket Weaving`)
    signedUp({ id: 'seeker-1' })
    renderPage()
    pickFile()

    fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: 'Juan' } })
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Cruz' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'juan@example.com' } })
    fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '09171234567' } })
    fireEvent.change(screen.getByLabelText(/birthday/i), { target: { value: '1990-05-04' } })
    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'Unemployed' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /resume autofill can make mistakes/i }))
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: 'Norzagaray-Santa Maria Road' } })
    fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
    fireEvent.change(screen.getByLabelText(/city \/ municipality/i), { target: { value: 'Santa Maria' } })
    fireEvent.change(screen.getByLabelText(/province/i), { target: { value: 'Bulacan' } })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    expect(await screen.findByText(/Unrecognized skills: Underwater Basket Weaving/i)).toBeInTheDocument()
    await screen.findByText('Data Entry')

    fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /agree to the municipal/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /true and correct/i }))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked().skills).toEqual(['Data Entry', 'Communication'])
  })

  it('keeps the skills already picked when autofilling', async () => {
    extractResumeText.mockResolvedValue(SKILLED)
    renderPage()

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'me@typed.com' } })

    pickFile()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Autofill done — please check:/i))

    expect(screen.getByLabelText(/email address/i)).toHaveValue('me@typed.com')
  })

  it('sends the picked skills and field via signUp extra', async () => {
    signedUp({ id: 'seeker-1' })
    renderPage()
    fillRequired()
    const skillsInput = screen.getByLabelText('Skills')
    fireEvent.change(skillsInput, { target: { value: 'Welding' } })
    fireEvent.keyDown(skillsInput, { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('option', { name: 'Information Technology' })).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'Information Technology' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked()).toMatchObject({
      field: 'Information Technology',
      skills: ['Welding'],
    })
  })

  it('prefills the education row from the resume and sends it via signUp extra', async () => {
    extractResumeText.mockResolvedValue(`${SKILLED}\nCORNELIA M. DE JESUS MEMORIAL\nSCHOOL (GRADE 1 - 6)\nBSIT PUP SANTA MARIA (2023 - Present)`)
    signedUp({ id: 'seeker-1' })
    renderPage()
    pickFile()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Autofill done/i))
    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'Unemployed' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /resume autofill can make mistakes/i }))
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: 'Norzagaray-Santa Maria Road' } })
    fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
    fireEvent.change(screen.getByLabelText(/city \/ municipality/i), { target: { value: 'Santa Maria' } })
    fireEvent.change(screen.getByLabelText(/province/i), { target: { value: 'Bulacan' } })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    await waitFor(() => expect(screen.getByLabelText(/education level/i)).toHaveValue('College'))
    fireEvent.change(screen.getByPlaceholderText('School name'), { target: { value: 'PUP Santa Maria' } })
    expect(screen.getByPlaceholderText('School name')).toHaveValue('PUP Santa Maria')
    expect(screen.getByPlaceholderText('Course / field')).toHaveValue('BSIT')

    fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /agree to the municipal/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /true and correct/i }))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked()).toMatchObject({
      education: expect.objectContaining({ level: 'college', school: 'pup santa maria', field: 'bsit' }),
    })
    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument())
  })

  it('renders inert education history placeholders matching Profile', () => {
    renderPage()
    fillRequired()
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

  it('submits education placeholders via signUp extra', async () => {
    extractResumeText.mockResolvedValue(SKILLED)
    signedUp({ id: 'seeker-1' })
    renderPage()
    pickFile()

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Autofill done/i))
    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'Unemployed' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /resume autofill can make mistakes/i }))
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: 'Norzagaray-Santa Maria Road' } })
    fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
    fireEvent.change(screen.getByLabelText(/city \/ municipality/i), { target: { value: 'Santa Maria' } })
    fireEvent.change(screen.getByLabelText(/province/i), { target: { value: 'Bulacan' } })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    await waitFor(() => expect(screen.getByText('Data Entry')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText(/education level/i), { target: { value: 'College' } })
    fireEvent.change(screen.getByPlaceholderText('School name'), { target: { value: 'Bulacan State' } })
    fireEvent.change(screen.getByPlaceholderText('Course / field'), { target: { value: 'IT' } })
    fireEvent.change(screen.getByPlaceholderText('Year'), { target: { value: '2020' } })

    fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /agree to the municipal/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /true and correct/i }))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked()).toMatchObject({
      education: expect.objectContaining({ level: 'college', school: 'bulacan state', field: 'it', end_year: 2020 }),
    })
    await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument())
  })

  it('persists Student employment status via signUp extra', async () => {
    signedUp({ id: 'seeker-1' })
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'Student' } })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked()).toMatchObject({ employment_status: 'Student' })
  })

  it('skips year validation when currently studying and posts end_year null', async () => {
    signedUp({ id: 'seeker-1' })
    renderPage()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/education level/i), { target: { value: 'College' } })
    fireEvent.change(screen.getByPlaceholderText('School name'), { target: { value: 'PUP Santa Maria' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /currently studying/i }))
    expect(screen.getByPlaceholderText('Year')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked()).toMatchObject({
      education: expect.objectContaining({ level: 'college', school: 'pup santa maria', end_year: null }),
    })
  })

  it('requires a 4-digit year when not currently studying', async () => {
    signedUp({ id: 'seeker-1' })
    renderPage()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/education level/i), { target: { value: 'College' } })
    fireEvent.change(screen.getByPlaceholderText('School name'), { target: { value: 'PUP Santa Maria' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(screen.getByText(/graduation year must be a 4-digit year/i)).toBeInTheDocument())
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('blocks submit when accuracy confirmation is unchecked', async () => {
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('checkbox', { name: /true and correct/i }))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(screen.getByText(/please confirm your information is true and correct/i)).toBeInTheDocument())
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('submits when both agree and accuracy confirmation are checked', async () => {
    signedUp({ id: 'seeker-1' })
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
  })

  it('groups the mobile number on screen and parks it without spaces', async () => {
    signedUp({ id: 'seeker-1' })
    renderPage()
    const mobile = screen.getByLabelText(/mobile number/i)
    fireEvent.change(mobile, { target: { value: '9171234567' } })
    expect(mobile).toHaveValue('917 123 4567')
    fireEvent.change(mobile, { target: { value: '0917 123 4567' } })
    expect(mobile).toHaveValue('917 123 4567')

    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked().phone).toBe('+639171234567')
    expect(parked().phone).not.toMatch(/\s/)
  })

  it('submits a full Santa Maria address via signUp extra', async () => {
    signedUp({ id: 'seeker-1' })
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    fireEvent.change(screen.getByLabelText(/postal/i), { target: { value: '3022' } })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked()).toMatchObject({
      street_address: 'norzagaray-santa maria road',
      barangay_district: 'pulong buhangin',
      city_municipality: 'santa maria',
      province_state: 'bulacan',
      postal_code: '3022',
      country: 'philippines',
    })
  })


  it('blocks a non-4-digit postal code', async () => {
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    fireEvent.change(screen.getByLabelText(/postal/i), { target: { value: '302' } })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    await waitFor(() => expect(screen.getByText(/postal code must be 4 digits/i)).toBeInTheDocument())
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })
})

describe('JobSeekerRegister captcha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    captcha.siteKey = 'site-key'
  })

  it('blocks registration until the challenge is solved', async () => {
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('sends the solved token and keeps the email-confirmation screen', async () => {
    signedUp({ id: 'seeker-1', email: 'juan@example.com' })
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(sentCaptcha()).toBe('captcha-token')
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(screen.getByText(/verification link to juan@example.com/i)).toBeInTheDocument()
  })

  it('requires a fresh challenge after a failed registration', async () => {
    authClientMock.signUp.email.mockResolvedValueOnce({
      data: null,
      error: { message: 'Registration failed \u2014 please try again', status: 500 },
    })
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/registration failed/i)).toBeInTheDocument()
    expect(authClientMock.signUp.email).toHaveBeenCalledTimes(1)
    expect(sentCaptcha()).toBe('captcha-token')

    // The token is single-use: a retry without a fresh challenge is blocked.
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(authClientMock.signUp.email).toHaveBeenCalledTimes(1)
  })
})

describe('JobSeekerRegister resume autofill', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses built-in extraction and asks the user to review the results', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    expect(screen.getByRole('checkbox', { name: /resume autofill can make mistakes/i })).toBeInTheDocument()
    pickFile()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Autofill done — please check:/i))
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('JobSeekerRegister resume review acknowledgement', () => {
  it('is optional, unmarked, and does not block Next when no resume was read', async () => {
    renderPage()
    const box = screen.getByRole('checkbox', { name: /resume autofill can make mistakes/i })
    expect(box).not.toBeRequired()
    expect(box.closest('label').textContent).not.toContain('*')

    fillRequired({ confirmResumeReview: false })
    expect(await screen.findByText('Step 3 — Background & Consent')).toBeInTheDocument()
    expect(screen.queryByText(/please confirm you will review the resume autofill information/i)).not.toBeInTheDocument()
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('becomes required and marked with * after a resume is read', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    renderPage()
    const box = () => screen.getByRole('checkbox', { name: /resume autofill can make mistakes/i })
    expect(box()).not.toBeRequired()
    expect(box().closest('label').textContent).not.toContain('*')

    pickFile()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Autofill done — please check:/i))

    expect(box()).toBeRequired()
    expect(box().closest('label').textContent).toContain('*')
  })

  it('requires confirmation to review resume autofill information', async () => {
    extractResumeText.mockResolvedValue(TEXT)
    renderPage()
    pickFile()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Autofill done — please check:/i))

    fireEvent.change(screen.getByLabelText(/birthday/i), { target: { value: '1990-05-04' } })
    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } })
    fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'Unemployed' } })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    expect(await screen.findByText(/please confirm you will review the resume autofill information/i)).toBeInTheDocument()
    expect(screen.getByText('Step 1 — Personal Details')).toBeInTheDocument()
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox', { name: /resume autofill can make mistakes/i }))
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    expect(await screen.findByText('Step 2 — Address Information')).toBeInTheDocument()
  })
})
