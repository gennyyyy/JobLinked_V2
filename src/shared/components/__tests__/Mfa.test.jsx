import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MfaPanel from '../MfaPanel'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({
  listMfaFactors: vi.fn(),
  enrollMfa: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  unenrollMfa: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { listMfaFactors, enrollMfa, verifyMfaEnrollment, unenrollMfa } from '../../../shared/services/auth'

// BA's two-factor plugin answers a totpURI, not an image: the panel renders a
// QR from it and shows the secret for manual entry.
const TOTP_URI = 'otpauth://totp/JobLinked:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=JobLinked'
const enrollPayload = { method: 'totp', totpURI: TOTP_URI, backupCodes: ['code-one', 'code-two'] }

async function startEnroll() {
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'old12345' } })
  fireEvent.click(screen.getByRole('button', { name: /enable two-factor authentication/i }))
  await waitFor(() => expect(enrollMfa).toHaveBeenCalledWith('old12345'))
}

describe('Mfa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'super-admin', email: 'admin@example.com' } })
    listMfaFactors.mockResolvedValue([])
    enrollMfa.mockResolvedValue(enrollPayload)
    verifyMfaEnrollment.mockResolvedValue({ status: true })
    unenrollMfa.mockResolvedValue({ status: true })
  })

  it('not enrolled renders the password field and the enable button', async () => {
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enable two-factor authentication/i })).toBeInTheDocument()
  })

  it('enrolling shows the QR, the secret and the backup codes', async () => {
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    await startEnroll()

    expect(await screen.findByRole('img', { name: /qr code/i })).toBeInTheDocument()
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
    expect(screen.getByText('code-one')).toBeInTheDocument()
    expect(screen.getByText('code-two')).toBeInTheDocument()
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
  })

  it('copies the backup codes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    await startEnroll()

    fireEvent.click(await screen.findByRole('button', { name: /copy backup codes/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('code-one\ncode-two'))
    expect(await screen.findByText(/backup codes copied/i)).toBeInTheDocument()
  })

  it('verify success calls verifyMfaEnrollment and announces enabled', async () => {
    listMfaFactors
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 'totp', status: 'verified', friendly_name: 'Authenticator app' }])
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    await startEnroll()
    fireEvent.change(await screen.findByLabelText(/verification code/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))

    await waitFor(() => expect(verifyMfaEnrollment).toHaveBeenCalledWith('123456'))
    expect(await screen.findByText(/two-factor authentication enabled/i)).toBeInTheDocument()
    expect(await screen.findByText('Authenticator app')).toBeInTheDocument()
    // The codes were shown once: the verified state clears them.
    expect(screen.queryByText('code-one')).not.toBeInTheDocument()
  })

  it('refuses to start enrollment without the current password', async () => {
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /enable two-factor authentication/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/enter your current password/i)
    expect(enrollMfa).not.toHaveBeenCalled()
  })

  it('enrolled lists a factor and shows Disable', async () => {
    listMfaFactors.mockResolvedValue([{ id: 'totp', friendly_name: 'Authenticator', status: 'verified' }])
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    expect(screen.getByText('Authenticator')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^disable$/i })).toBeInTheDocument()
  })

  it('disable is password-gated and calls unenrollMfa with the password', async () => {
    listMfaFactors
      .mockResolvedValueOnce([{ id: 'totp', friendly_name: 'Authenticator', status: 'verified' }])
      .mockResolvedValue([])
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /^disable$/i }))
    fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: 'old12345' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm disable/i }))

    await waitFor(() => expect(unenrollMfa).toHaveBeenCalledWith('old12345'))
    expect(await screen.findByText(/two-factor authentication disabled/i)).toBeInTheDocument()
  })

  it('invalid code shows an error', async () => {
    verifyMfaEnrollment.mockRejectedValue(new Error('Invalid code'))
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    await startEnroll()
    fireEvent.change(await screen.findByLabelText(/verification code/i), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid code/i)
  })
})
