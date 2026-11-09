import { describe, it, expect, vi, beforeEach } from 'vitest'

const turnstile = () => ({ render: vi.fn(() => 42), reset: vi.fn(), remove: vi.fn() })

beforeEach(() => {
  vi.resetModules()
  delete window.turnstile
  document.querySelectorAll('script[src*="turnstile"]').forEach((el) => el.remove())
})

describe('loadTurnstile', () => {
  it('injects the script once and resolves with window.turnstile after load', async () => {
    const { loadTurnstile } = await import('../turnstile')

    const first = loadTurnstile()
    const second = loadTurnstile()

    const scripts = document.querySelectorAll('script[src*="turnstile"]')
    expect(scripts).toHaveLength(1)

    const api = turnstile()
    window.turnstile = api
    scripts[0].dispatchEvent(new Event('load'))

    await expect(first).resolves.toBe(api)
    await expect(second).resolves.toBe(api)
  })

  it('rejects when the script fails to load', async () => {
    const { loadTurnstile } = await import('../turnstile')

    const pending = loadTurnstile()
    document.querySelector('script[src*="turnstile"]').dispatchEvent(new Event('error'))

    await expect(pending).rejects.toThrow(/failed to load/i)
  })
})

describe('turnstile helpers', () => {
  it('forwards the site key and callbacks to render and returns the widget id', async () => {
    const api = turnstile()
    window.turnstile = api
    const { renderTurnstile } = await import('../turnstile')

    const container = document.createElement('div')
    const onToken = vi.fn()
    const onExpire = vi.fn()
    const onError = vi.fn()

    expect(renderTurnstile(container, { sitekey: 'site-key', onToken, onExpire, onError })).toBe(42)
    expect(api.render).toHaveBeenCalledWith(container, {
      sitekey: 'site-key',
      theme: 'light',
      callback: onToken,
      'expired-callback': onExpire,
      'error-callback': onError,
    })
  })

  it('resets and removes by widget id', async () => {
    const api = turnstile()
    window.turnstile = api
    const { resetTurnstile, removeTurnstile } = await import('../turnstile')

    resetTurnstile(42)
    removeTurnstile(42)

    expect(api.reset).toHaveBeenCalledWith(42)
    expect(api.remove).toHaveBeenCalledWith(42)
  })
})
