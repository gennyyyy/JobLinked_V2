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

  it('bounces to /login when the retry still 401s (no further retries)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(err401())
    await expect(api.get('auth/me')).rejects.toMatchObject({ status: 401 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(window.location.href).toBe('/login')
  })

  it('bounces when refresh itself throws', async () => {
    supabase.auth.refreshSession.mockRejectedValue(new Error('refresh failed'))
    globalThis.fetch = vi.fn().mockResolvedValue(err401())
    await expect(api.get('auth/me')).rejects.toMatchObject({ status: 401 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(window.location.href).toBe('/login')
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

describe('in-flight GET dedupe', () => {
  it('shares one request between concurrent identical GETs', async () => {
    let release
    globalThis.fetch = vi.fn().mockReturnValue(new Promise((resolve) => {
      release = () => resolve(json(200, { ok: true }))
    }))
    const first = api.get('auth/me')
    const second = api.get('auth/me')
    release()
    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }])
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('starts a fresh request once the previous one has settled', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await api.get('auth/me')
    await api.get('auth/me')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps different query strings apart', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await Promise.all([api.get('jobs', { page: 1 }), api.get('jobs', { page: 2 })])
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('does not dedupe writes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await Promise.all([api.post('notifications/read-all'), api.post('notifications/read-all')])
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
})

describe('signOut', () => {
  it('resolves even when the server revoke fails', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: { message: 'revoked', status: 403 } })
    await expect(signOut()).resolves.toBeUndefined()
  })
})

describe('network failure', () => {
  it('yields a neutral user-facing message and a technical detail', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    try {
      await api.get('auth/me')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e.message).not.toMatch(/localhost|npm:|server running/i)
      expect(e.message).toMatch(/couldn.t load this right now/i)
      expect(e.status).toBe(0)
      expect(e.detail).toMatch(/Cannot reach the API/)
    }
  })
})
