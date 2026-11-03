import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockApi } from '../../../test/api-helper'

vi.mock('../../../shared/lib/api', () => ({ api: mockApi() }))
vi.mock('../../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      updateUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

import { api } from '../../../shared/lib/api'
import { supabase } from '../../../shared/lib/supabase'
import { signIn, signUp, getProfile, changePassword, resetPassword, updateProfile } from '../auth'

beforeEach(() => vi.clearAllMocks())

// api.js throws Error(message) with .status — mirror that shape.
const apiError = (status, message) => Object.assign(new Error(message), { status })

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
  it('returns user with profile on successful login', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@test.com' } },
      error: null,
    })
    api.get.mockResolvedValue({ id: 'u1', full_name: 'Test User', role: 'job-seeker' })

    const result = await signIn('test@test.com', 'password')
    expect(result.id).toBe('u1')
    expect(result.role).toBe('job-seeker')
  })

  it('throws on invalid credentials', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    await expect(signIn('bad@test.com', 'wrong')).rejects.toThrow('Invalid login credentials')
  })

  it('throws needs provision when profile is not found (404)', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@test.com' } },
      error: null,
    })
    api.get.mockRejectedValue({ status: 404 })

    await expect(signIn('test@test.com', 'password')).rejects.toThrow('needs provision')
  })

  it('throws when account is suspended', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@test.com' } },
      error: null,
    })
    api.get.mockResolvedValue({ id: 'u1', status: 'suspended', role: 'job-seeker' })

    await expect(signIn('test@test.com', 'password')).rejects.toThrow('Invalid email or password')
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

describe('signUp employment_status', () => {
  it('persists extra.employmentStatus into signup meta for the confirm-required path', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await signUp({ email: 's@test.com', password: 'pw123456', role: 'job-seeker', firstName: 'A', lastName: 'B', extra: { employmentStatus: 'Student' } })

    expect(supabase.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ data: expect.objectContaining({ employment_status: 'Student' }) }),
    }))
  })

  it('defaults employment_status to null when not given', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await signUp({ email: 's@test.com', password: 'pw123456', role: 'job-seeker', firstName: 'A', lastName: 'B' })

    expect(supabase.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ data: expect.objectContaining({ employment_status: null }) }),
    }))
  })
})

describe('changePassword', () => {
  it('verifies the current password then updates', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } } })
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null })

    await changePassword('old12345', 'new12345')

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'old12345' })
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'new12345' })
  })

  it('throws when the current password is wrong', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } } })
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'bad' } })

    await expect(changePassword('wrong', 'new12345')).rejects.toThrow('Current password is incorrect')
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  })
})

describe('resetPassword', () => {
  it('requests a reset email with redirect', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })

    await resetPassword('a@b.com')

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'a@b.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') }),
    )
  })

  it('throws on reset error', async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: 'nope' } })

    await expect(resetPassword('a@b.com')).rejects.toThrow('nope')
  })
})