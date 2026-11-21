import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../auth-client', async () => {
  const { authClientMock } = await import('../../../test/authClientMock')
  return { authClient: authClientMock }
})

import { authClientMock, resetAuthClient } from '../../../test/authClientMock'
import { api, clearApiCache, setApiIdentity } from '../api'

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
const html = (status) => ({
  ok: false,
  status,
  statusText: status === 502 ? 'Bad Gateway' : `status ${status}`,
  json: () => Promise.reject(new SyntaxError('Unexpected token <')),
  text: () => Promise.resolve('<html><body>Bad Gateway</body></html>'),
})

beforeEach(() => {
  resetAuthClient()
  clearApiCache()
  setApiIdentity('anon')
  window.location.href = 'http://localhost/'
})

describe('cookie transport', () => {
  it('sends cookies and no Authorization header on reads', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await api.get('auth/me')
    const [, init] = globalThis.fetch.mock.calls[0]
    expect(init.credentials).toBe('include')
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('sends cookies and no Authorization header on writes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await api.post('auth/me', { name: 'x' })
    const [, init] = globalThis.fetch.mock.calls[0]
    expect(init.credentials).toBe('include')
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('blob() sends cookies and no Authorization header', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { file: true }))
    await api.blob('documents/x')
    const [, init] = globalThis.fetch.mock.calls[0]
    expect(init.credentials).toBe('include')
    expect(init.headers?.Authorization).toBeUndefined()
  })
})

describe('401 handling', () => {
  it('probes the session once and retries the same request', async () => {
    authClientMock.getSession.mockResolvedValue({ data: { user: { id: 'u1' } } })
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(err401())
      .mockResolvedValueOnce(json(200, { ok: true }))
    const result = await api.get('auth/me')
    expect(result).toEqual({ ok: true })
    expect(authClientMock.getSession).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch.mock.calls[1][1].credentials).toBe('include')
    expect(globalThis.fetch.mock.calls[1][1].headers.Authorization).toBeUndefined()
  })

  it('bounces to /login when the retry still 401s (no further retries)', async () => {
    authClientMock.getSession.mockResolvedValue({ data: { user: { id: 'u1' } } })
    globalThis.fetch = vi.fn().mockResolvedValue(err401())
    await expect(api.get('auth/me')).rejects.toMatchObject({ status: 401 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(authClientMock.getSession).toHaveBeenCalledTimes(1)
    expect(authClientMock.signOut).toHaveBeenCalledTimes(1)
    expect(window.location.href).toBe('/login')
  })

  it('never bounces a 401 when there is no session user', async () => {
    authClientMock.getSession.mockResolvedValue({ data: null })
    globalThis.fetch = vi.fn().mockResolvedValue(err401())
    await expect(api.get('auth/me')).rejects.toMatchObject({ status: 401 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(authClientMock.signOut).not.toHaveBeenCalled()
    expect(window.location.href).toBe('http://localhost/')
  })

  it('treats a failed session probe as signed out (no bounce)', async () => {
    authClientMock.getSession.mockRejectedValue(new Error('probe failed'))
    globalThis.fetch = vi.fn().mockResolvedValue(err401())
    await expect(api.get('auth/me')).rejects.toMatchObject({ status: 401 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(authClientMock.signOut).not.toHaveBeenCalled()
    expect(window.location.href).toBe('http://localhost/')
  })

  it('blob() retries once after the session probe', async () => {
    authClientMock.getSession.mockResolvedValue({ data: { user: { id: 'u1' } } })
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

  it('serves a second GET within the TTL from the cache', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await api.get('auth/me')
    await expect(api.get('auth/me')).resolves.toEqual({ ok: true })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('refetches once the 10 s TTL has passed', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    try {
      globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: true }))
      await api.get('auth/me')
      now.mockReturnValue(1_000_000 + 9_999)
      await api.get('auth/me')
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      now.mockReturnValue(1_000_000 + 10_001)
      await api.get('auth/me')
      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    } finally {
      now.mockRestore()
    }
  })

  it('never serves one identity\'s cached entry to another', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(json(200, { user: 'u1' }))
      .mockResolvedValueOnce(json(200, { user: 'u2' }))
      .mockResolvedValueOnce(json(200, { user: 'u1' }))
    setApiIdentity('u1')
    await expect(api.get('auth/me')).resolves.toEqual({ user: 'u1' })
    setApiIdentity('u2')
    await expect(api.get('auth/me')).resolves.toEqual({ user: 'u2' })
    // Returning to the first identity refetches: its old entry was cleared.
    setApiIdentity('u1')
    await expect(api.get('auth/me')).resolves.toEqual({ user: 'u1' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('clears the cache when the identity changes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: true }))
    setApiIdentity('u1')
    await api.get('auth/me')
    setApiIdentity('u2')
    await api.get('auth/me')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('does not cache error responses', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(json(429, { error: { code: 'RATE_LIMITED', message: 'slow down' } }))
      .mockResolvedValueOnce(json(500, { error: { message: 'boom' } }))
      .mockResolvedValueOnce(json(200, { ok: true }))
    await expect(api.get('auth/me')).rejects.toMatchObject({ status: 429 })
    await expect(api.get('auth/me')).rejects.toMatchObject({ status: 500 })
    await expect(api.get('auth/me')).resolves.toEqual({ ok: true })
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('clears the cache after a write', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await api.get('auth/me')
    await api.get('auth/me')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    await api.post('auth/me', { name: 'x' })
    await api.get('auth/me')
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('refetches after clearApiCache()', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(200, { ok: true }))
    await api.get('auth/me')
    clearApiCache()
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

describe('error messages', () => {
  it('yields a neutral user-facing message and a technical detail', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    try {
      await api.get('auth/me')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e.message).toBe('Can\u2019t reach the server right now \u2014 it may be restarting. Please try again in a moment.')
      expect(e.status).toBe(0)
      expect(e.detail).toMatch(/Cannot reach the API/)
    }
  })

  it('names the rate limit on a 429 RATE_LIMITED', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(429, {
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
    }))
    await expect(api.get('auth/me')).rejects.toMatchObject({
      message: 'Too many requests \u2014 please wait a moment.',
      status: 429,
    })
  })

  it('falls back to the server message for a 429 without the code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(429, { error: { message: 'Slow down.' } }))
    await expect(api.get('auth/me')).rejects.toMatchObject({ message: 'Slow down.', status: 429 })
  })

  it('reports a restarting service for a 502 HTML page', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(html(502))
    await expect(api.get('auth/me')).rejects.toMatchObject({
      message: 'The service is having trouble \u2014 please try again shortly.',
      status: 502,
    })
  })

  it('keeps the server message for a JSON 5xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(json(500, { error: { message: 'Database is down.' } }))
    await expect(api.get('auth/me')).rejects.toMatchObject({ message: 'Database is down.', status: 500 })
  })
})
