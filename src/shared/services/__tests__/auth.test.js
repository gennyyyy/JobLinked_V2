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
import { signIn, getProfile, changePassword, resetPassword } from '../auth'

beforeEach(() => vi.clearAllMocks())

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