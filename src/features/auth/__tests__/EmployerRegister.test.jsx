import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
  fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
  fireEvent.change(screen.getByLabelText(/company contact no/i), { target: { value: '440000000' } })
  fireEvent.change(screen.getByLabelText(/official company email/i), { target: { value: 'hr@company.com' } })
  fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'password123!' } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123!' } })
  fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
  fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: 'Maria' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Reyes' } })
  fireEvent.change(screen.getByLabelText(/designation \/ position/i), { target: { value: 'HR Manager' } })
  fireEvent.change(screen.getByLabelText(/representative mobile/i), { target: { value: '09171234567' } })
  fireEvent.change(screen.getByLabelText(/representative email/i), { target: { value: 'maria@company.com' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /all the information i provided is true and correct/i }))
}

function triggerSubmit() {
  fireEvent.click(screen.getByRole('button', { name: /submit accreditation application/i }))
}

// Only the confirmation dialog's confirm action creates the account.
async function submit() {
  triggerSubmit()
  expect(await screen.findByRole('dialog', { name: /confirm accreditation submission/i })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /confirm & submit application/i }))
}

// The term gate ships disabled: open the notice, wait until the read state
// unlocks the checkbox, then close and accept to check it.
async function openTermsAndAgree() {
  fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
  const agree = screen.getByLabelText(/agree to the municipal data collection terms/i)
  await waitFor(() => expect(agree).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: /close & accept/i }))
  expect(agree).toBeChecked()
}

describe('EmployerRegister address', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the barangay select and the locked postal field', () => {
    renderPage()
    expect(screen.getByLabelText(/barangay/i).tagName).toBe('SELECT')
    expect(screen.getByLabelText(/postal/i)).toBeDisabled()
    expect(screen.getByLabelText(/postal/i)).toHaveValue('3022')
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
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    // Term gate ships disabled until the notice is opened and read.
    await openTermsAndAgree()
    await submit()

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked()).toMatchObject({ email: 'hr@company.com', role: 'employer' })
    expect(parked()).toMatchObject({
      street_address: 'norzagaray-santa maria road',
      barangay_district: 'pulong buhangin',
      city_municipality: 'santa maria',
      province_state: 'bulacan',
      postal_code: '3022',
      country: 'philippines',
      phone: '+63440000000',
      representative_phone: '+639171234567',
    })
  })

  it('groups the representative mobile while parking the digits without spaces', async () => {
    signedUp({ id: 'employer-1' })
    renderPage()
    fillRequired()

    expect(screen.getByLabelText(/representative mobile/i)).toHaveValue('917 123 4567')

    await openTermsAndAgree()
    await submit()

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked().representative_phone).toBe('+639171234567')
    expect(parked().representative_phone).not.toMatch(/\s/)
  })

  it('parks terms_accepted once the terms gate is passed', async () => {
    signedUp({ id: 'employer-1' })
    renderPage()
    fillRequired()
    await openTermsAndAgree()
    await submit()

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(parked()).toMatchObject({ role: 'employer', terms_accepted: true })
  })

  it('rejects a weak password and does not submit', async () => {
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: 'password' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    expect(await screen.findByText('Password must include at least one letter, one number, and one symbol.')).toBeInTheDocument()
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('locks province and city to Bulacan / Santa Maria', () => {
    renderPage()
    const province = screen.getByLabelText(/province/i)
    const city = screen.getByLabelText(/city \/ municipality/i)
    expect(province).toBeDisabled()
    expect(city).toBeDisabled()
    expect(province).toHaveValue('Bulacan')
    expect(city).toHaveValue('Santa Maria')
  })

  it('requires confirmation that the provided information is correct', async () => {
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('checkbox', { name: /all the information i provided is true and correct/i }))
    triggerSubmit()

    await waitFor(() => expect(screen.getByText(/please confirm your information is true and correct/i)).toBeInTheDocument())
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })
})

describe('EmployerRegister final step actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hides Next on the final step and keeps Submit Accreditation Application', () => {
    renderPage()
    fillRequired()

    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit accreditation application/i })).toBeInTheDocument()
  })
})

describe('EmployerRegister confirmation dialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('explains the employer next steps before anything is submitted', async () => {
    signedUp({ id: 'employer-1' })
    renderPage()
    fillRequired()
    await openTermsAndAgree()
    triggerSubmit()

    const dialog = await screen.findByRole('dialog', { name: /confirm accreditation submission/i })
    expect(within(dialog).getByRole('heading', { name: 'Confirm accreditation submission' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: /what happens after you submit/i })).toBeInTheDocument()
    expect(within(dialog).getByText(/once verified, peso reviews your accreditation — usually within 3 business days/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/not peso accreditation/i)).toBeInTheDocument()
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('does not create the account when the user keeps editing', async () => {
    signedUp({ id: 'employer-1' })
    renderPage()
    fillRequired()
    await openTermsAndAgree()
    triggerSubmit()

    const dialog = await screen.findByRole('dialog', { name: /confirm accreditation submission/i })
    fireEvent.click(within(dialog).getByRole('button', { name: /keep editing/i }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /confirm accreditation submission/i })).not.toBeInTheDocument())
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
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
    triggerSubmit()

    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('sends the solved token and keeps the email-confirmation screen', async () => {
    signedUp({ id: 'employer-1' })
    renderPage()
    fillRequired()
    await openTermsAndAgree()
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    await submit()

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(sentCaptcha()).toBe('captcha-token')
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(screen.getByText(/verification link to your company email/i)).toBeInTheDocument()

    // The screen receives the registered email and resends to it.
    fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }))
    await waitFor(() => expect(authClientMock.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'hr@company.com' }),
    ))
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
    await submit()

    expect(await screen.findByText(/registration failed/i)).toBeInTheDocument()
    expect(authClientMock.signUp.email).toHaveBeenCalledTimes(1)
    expect(sentCaptcha()).toBe('captcha-token')

    // The token is single-use: a retry without a fresh challenge is blocked.
    fireEvent.click(screen.getByRole('button', { name: /keep editing/i }))
    triggerSubmit()
    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(authClientMock.signUp.email).toHaveBeenCalledTimes(1)
  })
})
