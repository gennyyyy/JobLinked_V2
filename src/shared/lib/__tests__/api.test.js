import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

import { supabase } from '../supabase'
import { api } from '../api'
import { signOut } from '../../services/auth'

vi.stubEnv('VITE_API_URL', 'http://localhost:4000')
Object.defineProperty(window, 'location', {
  value: { href: 'http://localhost/' },
  writable: true,
  configurable: true,
})

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: `status ${status}`,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
  blob: () => Promise.resolve(new Blob([JSON.stringify(body)])),
})
const err401 = () => json(401, { error: { message: 'expired' } })

beforeEach(() => {
  vi.clearAllMocks()
  window.location.href = 'http://localhost/'
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'old' } } })
  supabase.auth.refreshSession.mockResolvedValue({ data: { session: { access_token: 'fresh' } }, error: null })
  supabase.auth.signOut.mockResolvedValue({ error: null })
})

describe('401 handling', () => {
  it('refreshes once and retries with the fresh token', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(err401())
      .mockResolvedValueOnce(json(200, { ok: true }))
    const result = await api.get('auth/me')
    expect(result).toEqual({ ok: true })
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh')
  })

  it('bounces to /portals when the retry still 401s (no further retries)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(err401())
    await expect(api.get('auth/me')).rejects.toMatchObject({ status: 401 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(window.location.href).toBe('/portals')
  })

  it('bounces when refresh itself throws', async () => {
    supabase.auth.refreshSession.mockRejectedValue(new Error('refresh failed'))
    globalThis.fetch = vi.fn().mockResolvedValue(err401())
    await expect(api.get('auth/me')).rejects.toMatchObject({ status: 401 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(window.location.href).toBe('/portals')
  })

  it('never bounces public (tokenless) calls on 401', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    globalThis.fetch = vi.fn().mockResolvedValue(err401())
    await expect(api.get('auth/me')).rejects.toMatchObject({ status: 401 })
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(window.location.href).toBe('http://localhost/')
  })

  it('blob() retries once after refresh', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(err401())
      .mockResolvedValueOnce(json(200, { file: true }))
    const result = await api.blob('documents/x')
    expect(result).toBeInstanceOf(Blob)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
})

describe('signOut', () => {
  it('resolves even when the server revoke fails', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: { message: 'revoked', status: 403 } })
    await expect(signOut()).resolves.toBeUndefined()
  })
})
