import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmployerRegister from '../EmployerRegister'
import { signUp } from '../../../shared/services/auth'

vi.mock('../../../shared/services/auth', () => ({
  signUp: vi.fn(),
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
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText(/^first name/i), { target: { value: 'Maria' } })
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Reyes' } })
  fireEvent.change(screen.getByLabelText(/designation \/ position/i), { target: { value: 'HR Manager' } })
  fireEvent.change(screen.getByLabelText(/birthday/i), { target: { value: '1990-05-04' } })
  fireEvent.change(screen.getByLabelText(/representative mobile/i), { target: { value: '09171234567' } })
  fireEvent.change(screen.getByLabelText(/representative email/i), { target: { value: 'maria@company.com' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /all the information i provided is true and correct/i }))
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /submit accreditation application/i }))
}

describe('EmployerRegister address', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders open address fields with optional barangay and postal', () => {
    renderPage()
    expect(screen.getByLabelText(/barangay/i).tagName).toBe('SELECT')
    expect(screen.getByLabelText(/postal/i)).toHaveAttribute('inputMode', 'numeric')
    expect(screen.getByLabelText(/postal/i)).toHaveAttribute('maxLength', '4')
  })

  it('submits a full Santa Maria address via signUp extra', async () => {
    signUp.mockResolvedValue({ id: 'employer-1', emailConfirmationRequired: false })
    renderPage()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/barangay/i), { target: { value: 'Pulong Buhangin' } })
    fireEvent.change(screen.getByLabelText(/postal/i), { target: { value: '3022' } })
    // Term gate ships disabled until the modal is opened: open + agree first.
    fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
    fireEvent.click(screen.getByLabelText(/agree to the municipal data collection terms/i))
    submit()

    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(signUp.mock.calls[0][0]).toMatchObject({ email: 'hr@company.com', role: 'employer' })
    expect(signUp.mock.calls[0][0].extra).toMatchObject({
      streetAddress: 'Norzagaray-Santa Maria Road',
      barangayDistrict: 'Pulong Buhangin',
      cityMunicipality: 'Santa Maria',
      provinceState: 'Bulacan',
      postalCode: '3022',
      country: 'Philippines',
    })
  })

  it('submits with blank barangay and postal', async () => {
    signUp.mockResolvedValue({ id: 'employer-1', emailConfirmationRequired: false })
    renderPage()
    fillRequired()
    // Term gate ships disabled until the modal is opened: open + agree first.
    fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
    fireEvent.click(screen.getByLabelText(/agree to the municipal data collection terms/i))
    submit()

    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(signUp.mock.calls[0][0].extra).toMatchObject({
      barangayDistrict: '',
      cityMunicipality: 'Santa Maria',
      provinceState: 'Bulacan',
      postalCode: '',
    })
  })

  it('blocks a non-4-digit postal code', async () => {
    renderPage()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/postal/i), { target: { value: '302' } })
    submit()

    await waitFor(() => expect(screen.getByText(/postal code must be 4 digits/i)).toBeInTheDocument())
    expect(signUp).not.toHaveBeenCalled()
  })

  it('requires city and province', async () => {
    renderPage()
    fillRequired()
    fireEvent.change(screen.getByLabelText(/city \/ municipality/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/province/i), { target: { value: '' } })
    submit()

    await waitFor(() => expect(screen.getByText(/city \/ municipality is required/i)).toBeInTheDocument())
    expect(screen.getByText(/province is required/i)).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('requires confirmation that the provided information is correct', async () => {
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('checkbox', { name: /all the information i provided is true and correct/i }))
    submit()

    await waitFor(() => expect(screen.getByText(/please confirm your information is true and correct/i)).toBeInTheDocument())
    expect(signUp).not.toHaveBeenCalled()
  })
})

describe('EmployerRegister captcha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    captcha.siteKey = 'site-key'
  })

  function openTermsAndAgree() {
    // Term gate ships disabled until the modal is opened: open + agree first.
    fireEvent.click(screen.getByRole('button', { name: /view terms/i }))
    fireEvent.click(screen.getByLabelText(/agree to the municipal data collection terms/i))
  }

  it('blocks registration until the challenge is solved', async () => {
    renderPage()
    fillRequired()
    openTermsAndAgree()
    submit()

    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('sends the solved token and keeps the email-confirmation screen', async () => {
    signUp.mockResolvedValue({ id: 'employer-1', emailConfirmationRequired: true })
    renderPage()
    fillRequired()
    openTermsAndAgree()
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    submit()

    await waitFor(() => expect(signUp).toHaveBeenCalled())
    expect(signUp.mock.calls[0][0].captchaToken).toBe('captcha-token')
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(screen.getByText(/verification link to your company email/i)).toBeInTheDocument()
  })

  it('requires a fresh challenge after a failed registration', async () => {
    signUp.mockRejectedValueOnce(new Error('Registration failed — please try again'))
    renderPage()
    fillRequired()
    openTermsAndAgree()
    fireEvent.click(screen.getByRole('button', { name: /solve captcha/i }))
    submit()

    expect(await screen.findByText(/registration failed/i)).toBeInTheDocument()
    expect(signUp).toHaveBeenCalledTimes(1)
    expect(signUp.mock.calls[0][0].captchaToken).toBe('captcha-token')

    // The token is single-use: a retry without a fresh challenge is blocked.
    submit()
    expect(await screen.findByText('Please complete the verification challenge.')).toBeInTheDocument()
    expect(signUp).toHaveBeenCalledTimes(1)
  })
})
