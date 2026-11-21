import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmployerRegister from '../EmployerRegister'
import { api } from '../../../shared/lib/api'
import { authClientMock, resetAuthClient } from '../../../test/authClientMock'

// BA returns the created user; the service then parks the form profile.
const signedUp = (user = { id: 'user-1' }) => {
  authClientMock.signUp.email.mockResolvedValue({ data: { token: null, user }, error: null })
}
const parked = (i = 0) => api.post.mock.calls[i][1]
const sentCaptcha = (i = 0) =>
  authClientMock.signUp.email.mock.calls[i]?.[0]?.fetchOptions?.headers?.['x-captcha-response']

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
})

function renderPage() {
  return render(
    <MemoryRouter>
      <EmployerRegister />
    </MemoryRouter>
  )
}

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/company \/ trade name/i), { target: { value: 'Santa Maria Logistics Inc.' } })
  fireEvent.change(screen.getByLabelText(/company industry/i), { target: { value: 'IT' } })
  fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: 'Norzagaray-Santa Maria Road' } })
  fireEvent.change(screen.getByLabelText(/city \/ municipality/i), { target: { value: 'Santa Maria' } })
  fireEvent.change(screen.getByLabelText(/province/i), { target: { value: 'Bulacan' } })
  fireEvent.change(screen.getByLabelText(/company contact no/i), { target: { value: '440000000' } })
  fireEvent.change(screen.getByLabelText(/official company email/i), { target: { value: 'hr@company.com' } })
  fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'password123!' } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } })
  fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: 'Maria' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Reyes' } })
  fireEvent.change(screen.getByLabelText(/designation \/ position/i), { target: { value: 'HR Manager' } })
  fireEvent.change(screen.getByLabelText(/representative mobile/i), { target: { value: '09171234567' } })
  fireEvent.change(screen.getByLabelText(/representative email/i), { target: { value: 'maria@company.com' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /all the information i provided is true and correct/i }))
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /submit accreditation application/i }))
}

// The term gate ships disabled: open the notice, wait until the read state
// unlocks the checkbox, close the modal, then agree.
async function openTermsAndAgree() {
  fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
  const agree = screen.getByLabelText(/agree to the municipal data collection terms/i)
  await waitFor(() => expect(agree).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: /^close$/i }))
  fireEvent.click(agree)
}

describe('EmployerRegister address', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders open address fields with optional barangay and postal', () => {
    renderPage()
    expect(screen.getByLabelText(/barangay/i).tagName).toBe('SELECT')
    expect(screen.getByLabelText(/postal/i)).toHaveAttribute('inputMode', 'numeric')
    expect(screen.getByLabelText(/postal/i)).toHaveAttribute('maxLength', '4')
  })

  it('keeps the password field named for FormData while driving the checklist', () => {
    renderPage()
    const input = screen.getByLabelText(/^password/i, { selector: 'input' })
    expect(input).toHaveAttribute('name', 'password')
    fireEvent.change(input, { target: { value: 'password123!' } })
    expect(input).toHaveValue('password123!')
    expect(screen.getByRole('list', { name: /password requirements/i })).toHaveTextContent('Met: At least 8 characters')
  })

  it('submits a full Santa Maria address via signUp extra', async () => {
    signedUp({ id: 'employer-1' })
    renderPage()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
    fireEvent.change(screen.getByLabelText(/postal/i), { target: { value: '3022' } })
    // Term gate ships disabled until the notice is opened and read.
    await openTermsAndAgree()
    submit()

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked()).toMatchObject({ email: 'hr@company.com', role: 'employer' })
    expect(parked()).toMatchObject({
      street_address: 'norzagaray-santa maria road',
      barangay_district: 'pulong buhangin',
      city_municipality: 'santa maria',
      province_state: 'bulacan',
      postal_code: '3022',
      country: 'philippines',
    })
  })

  it('submits with blank barangay and postal', async () => {
    signedUp({ id: 'employer-1' })
    renderPage()
    fillRequired()
    await openTermsAndAgree()
    submit()

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked()).toMatchObject({
      barangay_district: null,
      city_municipality: 'santa maria',
      province_state: 'bulacan',
      postal_code: null,
    })
  })

  it('blocks a non-4-digit postal code', async () => {
    renderPage()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/postal/i), { target: { value: '302' } })
    submit()

    await waitFor(() => expect(screen.getByText(/postal code must be 4 digits/i)).toBeInTheDocument())
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('rejects a weak password and does not submit', async () => {
    renderPage()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'password' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password' } })
    // Term gate ships disabled until the modal is opened: open + agree first.
    fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
    fireEvent.click(screen.getByLabelText(/agree to the municipal data collection terms/i))
    submit()

    expect(await screen.findByText('Password must include at least one letter, one number, and one symbol.')).toBeInTheDocument()
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('requires city and province', async () => {
    renderPage()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/city \/ municipality/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/province/i), { target: { value: '' } })
    submit()

    await waitFor(() => expect(screen.getByText(/city \/ municipality is required/i)).toBeInTheDocument())
    expect(screen.getByText(/province is required/i)).toBeInTheDocument()
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('requires confirmation that the provided information is correct', async () => {
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('checkbox', { name: /all the information i provided is true and correct/i }))
    submit()

    await waitFor(() => expect(screen.getByText(/please confirm your information is true and correct/i)).toBeInTheDocument())
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })
})

describe('EmployerRegister captcha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    captcha.siteKey = 'site-key'
  })
  it('blocks registration until the challenge is solved', async () => {
    renderPage()
    fillRequired()
    await openTermsAndAgree()
    submit()

    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('sends the solved token and keeps the email-confirmation screen', async () => {
    signedUp({ id: 'employer-1' })
    renderPage()
    fillRequired()
    await openTermsAndAgree()
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    submit()

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(sentCaptcha()).toBe('captcha-token')
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(screen.getByText(/verification link to your company email/i)).toBeInTheDocument()
  })

  it('requires a fresh challenge after a failed registration', async () => {
    authClientMock.signUp.email.mockResolvedValueOnce({
      data: null,
      error: { message: 'Registration failed \u2014 please try again', status: 500 },
    })
    renderPage()
    fillRequired()
    await openTermsAndAgree()
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    submit()

    expect(await screen.findByText(/registration failed/i)).toBeInTheDocument()
    expect(authClientMock.signUp.email).toHaveBeenCalledTimes(1)
    expect(sentCaptcha()).toBe('captcha-token')

    // The token is single-use: a retry without a fresh challenge is blocked.
    submit()
    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(authClientMock.signUp.email).toHaveBeenCalledTimes(1)
  })
})
