import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockApi } from '../../../test/api-helper'

vi.mock('../../../shared/lib/api', () => ({
  api: mockApi(),
  clearApiCache: vi.fn(),
  setApiIdentity: vi.fn(),
}))
vi.mock('../../../shared/lib/auth-client', async () => {
  const { authClientMock } = await import('../../../test/authClientMock')
  return { authClient: authClientMock }
})

import { api, clearApiCache, setApiIdentity } from '../../../shared/lib/api'
import { authClientMock, resetAuthClient } from '../../../test/authClientMock'
import {
  signIn, signUp, signOut, getProfile, changePassword, changeEmail, resetPassword,
  resetPasswordWithToken, verifyEmailToken, completeTwoFactor, updateProfile,
  listMfaFactors, enrollMfa, verifyMfaEnrollment, unenrollMfa, resendVerificationEmail,
} from '../auth'

beforeEach(() => {
  vi.clearAllMocks()
  resetAuthClient()
})

// api.js throws Error(message) with .status — mirror that shape.
const apiError = (status, message) => Object.assign(new Error(message), { status })
const signedIn = (user = { id: 'u1', email: 'test@test.com' }) =>
  authClientMock.getSession.mockResolvedValue({ data: { user } })
const profile = { id: 'u1', full_name: 'Test User', role: 'job-seeker' }

describe('updateProfile', () => {
  beforeEach(() => { api.get.mockReset(); api.patch.mockReset(); })

  it('returns the patched row', async () => {
    api.get.mockResolvedValueOnce({ id: 'u1', role: 'job-seeker' })
    api.patch.mockResolvedValueOnce({ id: 'u1', first_name: 'ana' })
    await expect(updateProfile('u1', { first_name: 'Ana' })).resolves.toEqual({ id: 'u1', first_name: 'ana' })
  })

  // An empty patch makes Object.entries(patch).every(...) vacuously true, so
  // the re-read used to confirm the failure as success.
  it('throws on an empty patch instead of reporting success', async () => {
    api.get.mockResolvedValueOnce({ id: 'u1', role: 'job-seeker' })
    api.patch.mockRejectedValueOnce(apiError(400, 'Nothing to update'))
    await expect(updateProfile('u1', {})).rejects.toThrow('Nothing to update')
    // no confirmation re-read is attempted
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  // A 4xx is a refusal the server made before writing; a matching re-read
  // must not turn it into success.
  it('throws on a rejected PATCH even when the re-read matches', async () => {
    api.get.mockResolvedValueOnce({ id: 'u1', role: 'job-seeker' })
    api.patch.mockRejectedValueOnce(apiError(409, 'Duplicate company email'))
    api.get.mockResolvedValueOnce({ id: 'u1', first_name: 'ana' })
    await expect(updateProfile('u1', { first_name: 'Ana' })).rejects.toThrow('Duplicate company email')
  })

  it('confirms success when the write landed but the response was lost', async () => {
    api.get.mockResolvedValueOnce({ id: 'u1', role: 'job-seeker' })
    api.patch.mockRejectedValueOnce(apiError(500, 'upstream died after commit'))
    api.get.mockResolvedValueOnce({ id: 'u1', first_name: 'ana' })
    await expect(updateProfile('u1', { first_name: 'Ana' })).resolves.toEqual({ id: 'u1', first_name: 'ana' })
  })
})

describe('signIn', () => {
  it('returns the session user merged with the profile', async () => {
    authClientMock.signIn.email.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    signedIn()
    api.get.mockResolvedValue(profile)

    const result = await signIn('test@test.com', 'password')

    expect(result).toMatchObject({ id: 'u1', email: 'test@test.com', role: 'job-seeker' })
    expect(authClientMock.signIn.email).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password' })
  })

  it('scopes the GET cache to the new identity before reading the profile', async () => {
    authClientMock.signIn.email.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    signedIn()
    api.get.mockResolvedValue(profile)

    await signIn('test@test.com', 'password')

    expect(setApiIdentity).toHaveBeenCalledWith('u1')
    expect(setApiIdentity.mock.invocationCallOrder[0])
      .toBeLessThan(api.get.mock.invocationCallOrder[0])
  })

  it('throws a generic error on invalid credentials (no account enumeration)', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password', status: 401 },
    })

    await expect(signIn('bad@test.com', 'wrong')).rejects.toThrow('Invalid email or password')
    expect(api.get).not.toHaveBeenCalled()
  })

  it('asks an unverified account to verify instead of signing in', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      data: null,
      error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified', status: 403 },
    })

    const error = await signIn('new@test.com', 'password').catch((e) => e)
    expect(error.message).toMatch(/verify your email/i)
    // The login screen keys its resend offer off this code.
    expect(error.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('maps a missing or rejected captcha token to a fresh-challenge message', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      data: null,
      error: { code: 'MISSING_RESPONSE', message: 'Missing CAPTCHA response', status: 400 },
    })

    await expect(signIn('test@test.com', 'password', 'stale')).rejects.toThrow(
      'Verification failed. Please complete the challenge again.',
    )
  })

  it('maps a rate limit to retryable wording', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      data: null,
      error: { message: 'Too many requests', status: 429 },
    })

    await expect(signIn('test@test.com', 'password')).rejects.toThrow(/wait a moment/i)
  })

  it('turns an unreachable API into a connection message', async () => {
    authClientMock.signIn.email.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(signIn('test@test.com', 'password')).rejects.toThrow(
      'We can\u2019t sign you in right now. Please check your connection and try again.',
    )
  })

  it('flags a missing profile for provisioning and never auto-provisions', async () => {
    authClientMock.signIn.email.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    signedIn()
    api.get.mockRejectedValue(apiError(403, 'Account not provisioned'))

    const error = await signIn('test@test.com', 'password').catch((e) => e)
    expect(error.needsProvision).toBe(true)
    expect(error.message).toBe('needs provision')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('treats a missing profile (404) the same way', async () => {
    authClientMock.signIn.email.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    signedIn()
    api.get.mockRejectedValue(apiError(404, 'Not found'))

    await expect(signIn('test@test.com', 'password')).rejects.toMatchObject({ needsProvision: true })
  })

  it('rejects a suspended account with the generic credentials error', async () => {
    authClientMock.signIn.email.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    signedIn()
    api.get.mockResolvedValue({ id: 'u1', status: 'suspended', role: 'job-seeker' })

    await expect(signIn('test@test.com', 'password')).rejects.toThrow('Invalid email or password')
  })

  it('returns twoFactorRedirect without fetching a profile', async () => {
    authClientMock.signIn.email.mockResolvedValue({
      data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] },
      error: null,
    })

    await expect(signIn('test@test.com', 'password')).resolves.toEqual({ twoFactorRedirect: true })
    expect(authClientMock.getSession).not.toHaveBeenCalled()
    expect(api.get).not.toHaveBeenCalled()
    expect(setApiIdentity).not.toHaveBeenCalled()
  })
})

describe('completeTwoFactor', () => {
  it('verifies the code then resolves the session profile', async () => {
    authClientMock.twoFactor.verifyTotp.mockResolvedValue({ data: { token: 'x' }, error: null })
    signedIn({ id: 'u1', email: 'test@test.com' })
    authClientMock.getSession.mockResolvedValue({ data: { user: { id: 'u1', email: 'test@test.com' } } })
    api.get.mockResolvedValue(profile)

    await expect(completeTwoFactor('123456')).resolves.toMatchObject({ id: 'u1', role: 'job-seeker' })
    expect(authClientMock.twoFactor.verifyTotp).toHaveBeenCalledWith({ code: '123456' })
    expect(setApiIdentity).toHaveBeenCalledWith('u1')
  })

  it('maps an invalid code', async () => {
    authClientMock.twoFactor.verifyTotp.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_CODE', message: 'Invalid code', status: 401 },
    })

    await expect(completeTwoFactor('000000')).rejects.toThrow('Invalid code. Please try again.')
  })
})

describe('getProfile', () => {
  it('returns profile from api', async () => {
    api.get.mockResolvedValue({ id: 'u1', full_name: 'Seeker', role: 'job-seeker' })
    const result = await getProfile('u1')
    expect(result.role).toBe('job-seeker')
  })

  it('returns null when profile not found (404)', async () => {
    api.get.mockRejectedValue({ status: 404 })
    const result = await getProfile('nonexistent')
    expect(result).toBeNull()
  })

  it('throws on other errors', async () => {
    api.get.mockRejectedValue({ status: 500, message: 'Server error' })
    await expect(getProfile('u1')).rejects.toThrow()
  })
})

describe('signUp', () => {
  const signUpPayload = (extra = {}) => ({
    email: 's@test.com', password: 'pw123456', role: 'job-seeker',
    firstName: 'A', lastName: 'B', ...extra,
  })
  const created = () => authClientMock.signUp.email.mockResolvedValue({
    data: { token: null, user: { id: 'u1', email: 's@test.com' } },
    error: null,
  })

  it('creates the BA account with the full name and the callback URL', async () => {
    created()

    await signUp(signUpPayload({ firstName: 'Ana', middleName: 'B', lastName: 'Cruz', suffix: 'Jr.' }))

    expect(authClientMock.signUp.email).toHaveBeenCalledWith(expect.objectContaining({
      email: 's@test.com',
      password: 'pw123456',
      name: 'Ana B Cruz Jr.',
      callbackURL: `${window.location.origin}/auth/callback`,
    }))
  })

  it('parks the form profile for provision after verification', async () => {
    created()
    api.post.mockResolvedValue({ saved: true })

    await signUp(signUpPayload({ extra: { phone: '09171234567', cityMunicipality: 'Santa Maria' } }))

    expect(api.post).toHaveBeenCalledWith('auth/pending-signup', expect.objectContaining({
      userId: 'u1',
      email: 's@test.com',
      role: 'job-seeker',
      first_name: 'a',
      last_name: 'b',
      city_municipality: 'santa maria',
      phone: '09171234567',
    }))
  })

  it('returns a confirmation-required account and never provisions or signs in', async () => {
    created()
    api.post.mockResolvedValue({ saved: true })

    const result = await signUp(signUpPayload())

    expect(result).toMatchObject({
      id: 'u1', email: 's@test.com', role: 'job-seeker', emailConfirmationRequired: true,
    })
    expect(api.post).toHaveBeenCalledTimes(1) // pending-signup only
    expect(api.post).not.toHaveBeenCalledWith('auth/provision', expect.anything())
  })

  it('still registers when the pending write fails (the account exists)', async () => {
    created()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    api.post.mockRejectedValue(apiError(400, 'No unverified account matches this id and email'))

    const result = await signUp(signUpPayload())

    expect(result.emailConfirmationRequired).toBe(true)
    expect(warn).toHaveBeenCalledWith('pending signup profile was not stored', { status: 400 })
    warn.mockRestore()
  })

  it('persists extra.employmentStatus into the parked profile', async () => {
    created()
    api.post.mockResolvedValue({ saved: true })

    await signUp(signUpPayload({ extra: { employmentStatus: 'Student' } }))

    expect(api.post.mock.calls[0][1]).toMatchObject({ employment_status: 'Student' })
  })

  it('defaults employment_status to null when not given', async () => {
    created()
    api.post.mockResolvedValue({ saved: true })

    await signUp(signUpPayload())

    expect(api.post.mock.calls[0][1]).toMatchObject({ employment_status: null })
  })

  it('passes skills through without lowercasing (the server stores canonical casing)', async () => {
    created()
    api.post.mockResolvedValue({ saved: true })

    await signUp(signUpPayload({
      extra: { skills: ['MS Excel', ' data entry '], field: 'Information Technology' },
    }))

    expect(api.post.mock.calls[0][1]).toMatchObject({
      skills: ['MS Excel', 'data entry'], field: 'Information Technology',
    })
  })

  it('rejects a role outside the self-signup allow-list', async () => {
    await expect(signUp(signUpPayload({ role: 'super-admin' }))).rejects.toThrow('Invalid role')
    expect(authClientMock.signUp.email).not.toHaveBeenCalled()
  })

  it('surfaces a duplicate/invalid sign-up error from BA', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      data: null,
      error: { code: 'USER_ALREADY_EXISTS', message: 'User already exists', status: 422 },
    })

    await expect(signUp(signUpPayload())).rejects.toThrow('User already exists')
  })
})

describe('resendVerificationEmail', () => {
  it('sends to the given address with the callback URL', async () => {
    await resendVerificationEmail('new@test.com')

    expect(authClientMock.sendVerificationEmail).toHaveBeenCalledWith({
      email: 'new@test.com',
      callbackURL: `${window.location.origin}/auth/callback`,
    })
  })

  it('maps the server rate limit to retryable wording', async () => {
    authClientMock.sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { message: 'Too many requests', status: 429 },
    })

    await expect(resendVerificationEmail('new@test.com')).rejects.toThrow(/wait a moment/i)
  })

  it('throws on a returned error', async () => {
    authClientMock.sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL', message: 'Invalid email', status: 400 },
    })

    await expect(resendVerificationEmail('new@test.com')).rejects.toThrow('Invalid email')
  })
})

describe('signOut', () => {
  it('clears the local cache and identity then revokes the session', async () => {
    await signOut()

    expect(clearApiCache).toHaveBeenCalled()
    expect(setApiIdentity).toHaveBeenCalledWith('anon')
    expect(authClientMock.signOut).toHaveBeenCalled()
  })

  it('still clears locally when the revoke fails', async () => {
    authClientMock.signOut.mockRejectedValue(new Error('offline'))

    await expect(signOut()).resolves.toBeUndefined()
    expect(clearApiCache).toHaveBeenCalled()
  })
})

describe('changePassword', () => {
  it('changes the password with the current one and revokes other sessions', async () => {
    await changePassword('old12345', 'new12345!')

    expect(authClientMock.changePassword).toHaveBeenCalledWith({
      currentPassword: 'old12345',
      newPassword: 'new12345!',
      revokeOtherSessions: true,
    })
  })

  it('maps a wrong current password to one honest message', async () => {
    authClientMock.changePassword.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_PASSWORD', message: 'Invalid password', status: 400 },
    })

    await expect(changePassword('wrong', 'new12345!')).rejects.toThrow('Current password is incorrect.')
  })

  it('does not pre-validate the new password (the component owns the policy)', async () => {
    await changePassword('old12345', 'short')

    expect(authClientMock.changePassword).toHaveBeenCalledWith(expect.objectContaining({ newPassword: 'short' }))
  })

  it('surfaces any other failure untouched', async () => {
    authClientMock.changePassword.mockResolvedValue({
      data: null,
      error: { code: 'SESSION_EXPIRED', message: 'Session expired', status: 401 },
    })

    await expect(changePassword('old12345', 'new12345!')).rejects.toThrow('Session expired')
  })
})

describe('changeEmail', () => {
  it('re-authenticates with verify-password before asking BA to change the address', async () => {
    api.post.mockResolvedValue({ valid: true })

    await changeEmail('new@test.com', 'old12345')

    expect(api.post).toHaveBeenCalledWith('auth/verify-password', { password: 'old12345' })
    expect(authClientMock.changeEmail).toHaveBeenCalledWith({
      newEmail: 'new@test.com',
      callbackURL: `${window.location.origin}/auth/callback`,
    })
    expect(api.post.mock.invocationCallOrder[0])
      .toBeLessThan(authClientMock.changeEmail.mock.invocationCallOrder[0])
  })

  it('stops before BA when the current password is wrong', async () => {
    api.post.mockRejectedValue(Object.assign(new Error('Current password is incorrect'), {
      status: 401,
      error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
    }))

    await expect(changeEmail('new@test.com', 'wrong')).rejects.toThrow('Current password is incorrect.')
    expect(authClientMock.changeEmail).not.toHaveBeenCalled()
  })

  it('surfaces a BA refusal', async () => {
    api.post.mockResolvedValue({ valid: true })
    authClientMock.changeEmail.mockResolvedValue({
      data: null,
      error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email already exists', status: 422 },
    })

    await expect(changeEmail('new@test.com', 'old12345')).rejects.toThrow('Email already exists')
  })
})

describe('MFA', () => {
  it('reports the authenticator factor when the session user has 2FA enabled', async () => {
    authClientMock.getSession.mockResolvedValue({ data: { user: { id: 'u1', twoFactorEnabled: true } } })

    await expect(listMfaFactors()).resolves.toEqual([
      { id: 'totp', status: 'verified', friendly_name: 'Authenticator app' },
    ])
  })

  it('reports no factors when 2FA is off', async () => {
    authClientMock.getSession.mockResolvedValue({ data: { user: { id: 'u1', twoFactorEnabled: false } } })

    await expect(listMfaFactors()).resolves.toEqual([])
  })

  it('enables TOTP with the password and returns the URI and backup codes', async () => {
    authClientMock.twoFactor.enable.mockResolvedValue({
      data: { method: 'totp', totpURI: 'otpauth://totp/x?secret=ABC', backupCodes: ['a', 'b'] },
      error: null,
    })

    await expect(enrollMfa('old12345')).resolves.toEqual({
      method: 'totp',
      totpURI: 'otpauth://totp/x?secret=ABC',
      backupCodes: ['a', 'b'],
    })
    expect(authClientMock.twoFactor.enable).toHaveBeenCalledWith({ password: 'old12345' })
  })

  it('verifies the enrollment code then refreshes the session', async () => {
    await verifyMfaEnrollment('123456')

    expect(authClientMock.twoFactor.verifyTotp).toHaveBeenCalledWith({ code: '123456' })
    expect(authClientMock.getSession).toHaveBeenCalled()
  })

  it('maps an invalid enrollment code', async () => {
    authClientMock.twoFactor.verifyTotp.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_CODE', message: 'Invalid code', status: 401 },
    })

    await expect(verifyMfaEnrollment('000000')).rejects.toThrow('Invalid code. Please try again.')
  })

  it('disables 2FA with the password then refreshes the session', async () => {
    await unenrollMfa('old12345')

    expect(authClientMock.twoFactor.disable).toHaveBeenCalledWith({ password: 'old12345' })
    expect(authClientMock.getSession).toHaveBeenCalled()
  })

  it('maps a wrong password on disable', async () => {
    authClientMock.twoFactor.disable.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_PASSWORD', message: 'Invalid password', status: 400 },
    })

    await expect(unenrollMfa('wrong')).rejects.toThrow('Current password is incorrect.')
  })
})

describe('resetPassword', () => {
  it('requests a reset email with the /reset-password redirect', async () => {
    await resetPassword('a@b.com')

    expect(authClientMock.requestPasswordReset).toHaveBeenCalledWith({
      email: 'a@b.com',
      redirectTo: `${window.location.origin}/reset-password`,
    })
  })

  it('sends the captcha token as the x-captcha-response header', async () => {
    await resetPassword('a@b.com', 'captcha-token')

    expect(authClientMock.requestPasswordReset).toHaveBeenCalledWith({
      email: 'a@b.com',
      redirectTo: `${window.location.origin}/reset-password`,
      fetchOptions: { headers: { 'x-captcha-response': 'captcha-token' } },
    })
  })

  it('throws on a reset error', async () => {
    authClientMock.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { message: 'nope', status: 400 },
    })

    await expect(resetPassword('a@b.com')).rejects.toThrow('nope')
  })

  it('maps the captcha challenge error', async () => {
    authClientMock.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { code: 'MISSING_RESPONSE', message: 'Missing CAPTCHA response', status: 400 },
    })

    await expect(resetPassword('a@b.com', 'stale')).rejects.toThrow(
      'Verification failed. Please complete the challenge again.',
    )
  })
})

describe('resetPasswordWithToken', () => {
  it('submits the emailed token with the new password', async () => {
    await resetPasswordWithToken('password123!', 'tok_1')

    expect(authClientMock.resetPassword).toHaveBeenCalledWith({ newPassword: 'password123!', token: 'tok_1' })
  })

  it('maps an expired token to a request-a-new-link message', async () => {
    authClientMock.resetPassword.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_TOKEN', message: 'Invalid token', status: 400 },
    })

    await expect(resetPasswordWithToken('password123!', 'gone')).rejects.toThrow(
      'This link is invalid or expired. Request a new one.',
    )
  })
})

describe('verifyEmailToken', () => {
  it('verifies through the GET query shape BA expects', async () => {
    await verifyEmailToken('tok_email')

    expect(authClientMock.verifyEmail).toHaveBeenCalledWith({ query: { token: 'tok_email' } })
  })
})

describe('captcha tokens on sign-in/sign-up', () => {
  it('forwards the token as a header on sign-in', async () => {
    authClientMock.signIn.email.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    signedIn()
    api.get.mockResolvedValue(profile)

    await signIn('test@test.com', 'password', 'captcha-token')

    expect(authClientMock.signIn.email).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password',
      fetchOptions: { headers: { 'x-captcha-response': 'captcha-token' } },
    })
  })

  it('omits the header entirely on sign-in when no token is given', async () => {
    authClientMock.signIn.email.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    signedIn()
    api.get.mockResolvedValue(profile)

    await signIn('test@test.com', 'password')

    expect('fetchOptions' in authClientMock.signIn.email.mock.calls[0][0]).toBe(false)
  })

  it('forwards the token as a header on sign-up', async () => {
    authClientMock.signUp.email.mockResolvedValue({
      data: { token: null, user: { id: 'u1' } },
      error: null,
    })
    api.post.mockResolvedValue({ saved: true })

    await signUp({
      email: 's@test.com', password: 'pw123456', role: 'job-seeker',
      firstName: 'A', lastName: 'B', captchaToken: 'captcha-token',
    })

    expect(authClientMock.signUp.email).toHaveBeenCalledWith(expect.objectContaining({
      fetchOptions: { headers: { 'x-captcha-response': 'captcha-token' } },
    }))
  })
})
