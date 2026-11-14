import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MfaPanel from '../MfaPanel'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/account', () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}))
vi.mock('../../../shared/services/auth', () => ({
  changeEmail: vi.fn(),
  listMfaFactors: vi.fn(),
  enrollMfa: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  unenrollMfa: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getPreferences, updatePreferences } from '../../../shared/services/account'
import { listMfaFactors, enrollMfa, verifyMfaEnrollment } from '../../../shared/services/auth'

const enrollPayload = { id: 'factor-1', totp: { qr_code: 'data:image/png;base64,abc', secret: 'SECRET123', uri: 'otpauth://totp/x' } }

describe('Mfa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'super-admin', email: 'admin@example.com' } })
    getPreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    updatePreferences.mockResolvedValue({ application_updates: true, community_announcements: true })
    listMfaFactors.mockResolvedValue([])
    enrollMfa.mockResolvedValue(enrollPayload)
    verifyMfaEnrollment.mockResolvedValue({})
  })

  it('not enrolled renders the enable button', async () => {
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /enable two-factor authentication/i })).toBeInTheDocument()
  })

  it('enrolling shows the QR image and a code input', async () => {
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /enable two-factor authentication/i }))
    await waitFor(() => expect(enrollMfa).toHaveBeenCalled())
    const img = await screen.findByAltText(/qr/i)
    expect(img.getAttribute('src')).toMatch(/^data:/)
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
  })

  it('verify success calls verifyMfaEnrollment and announces enabled', async () => {
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /enable two-factor authentication/i }))
    await waitFor(() => expect(enrollMfa).toHaveBeenCalled())
    const input = await screen.findByLabelText(/verification code/i)
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() => expect(verifyMfaEnrollment).toHaveBeenCalledWith('factor-1', '123456'))
    expect(await screen.findByText(/two-factor authentication enabled/i)).toBeInTheDocument()
  })

  it('enrolled lists a factor and shows Disable', async () => {
    listMfaFactors.mockResolvedValue([{ id: 'factor-1', friendly_name: 'Authenticator', status: 'verified' }])
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    expect(screen.getByText('Authenticator')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /disable/i })).toBeInTheDocument()
  })

  it('invalid code shows an error', async () => {
    verifyMfaEnrollment.mockRejectedValue(new Error('Invalid code'))
    render(<MemoryRouter><MfaPanel /></MemoryRouter>)
    await waitFor(() => expect(listMfaFactors).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /enable two-factor authentication/i }))
    await waitFor(() => expect(enrollMfa).toHaveBeenCalled())
    const input = await screen.findByLabelText(/verification code/i)
    fireEvent.change(input, { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /verify/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid code/i)
  })
})