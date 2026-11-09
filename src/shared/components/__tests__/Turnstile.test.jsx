import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Turnstile from '../Turnstile'

// Mutable site key so the same file can cover both "configured" and "unset".
const mock = vi.hoisted(() => ({ siteKey: 'site-key' }))

vi.mock('../../../shared/lib/turnstile', () => ({
  get TURNSTILE_SITE_KEY() { return mock.siteKey },
  loadTurnstile: vi.fn(() => Promise.resolve({})),
  renderTurnstile: vi.fn(() => 7),
  resetTurnstile: vi.fn(),
  removeTurnstile: vi.fn(),
}))

import { loadTurnstile, renderTurnstile, resetTurnstile, removeTurnstile } from '../../../shared/lib/turnstile'

beforeEach(() => {
  vi.clearAllMocks()
  mock.siteKey = 'site-key'
})

describe('Turnstile', () => {
  it('renders nothing and never loads the script when no site key is set', () => {
    mock.siteKey = ''
    const { container } = render(<Turnstile onToken={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
    expect(loadTurnstile).not.toHaveBeenCalled()
    expect(renderTurnstile).not.toHaveBeenCalled()
  })

  it('loads and renders once, forwarding tokens, expiry, reset, and removal', async () => {
    const onToken = vi.fn()
    const { rerender, unmount } = render(<Turnstile onToken={onToken} resetKey={0} />)

    await waitFor(() => expect(renderTurnstile).toHaveBeenCalledTimes(1))
    expect(loadTurnstile).toHaveBeenCalledTimes(1)
    expect(renderTurnstile.mock.calls[0][1]).toMatchObject({ sitekey: 'site-key' })

    // renderTurnstile (lib) translates onToken/onExpire to Cloudflare's
    // callback/expired-callback names internally — the component passes the
    // React-side handlers.
    const options = renderTurnstile.mock.calls[0][1]
    options.onToken('captcha-token')
    expect(onToken).toHaveBeenCalledWith('captcha-token')

    options.onExpire()
    expect(onToken).toHaveBeenLastCalledWith('')

    rerender(<Turnstile onToken={onToken} resetKey={1} />)
    await waitFor(() => expect(resetTurnstile).toHaveBeenCalledWith(7))

    unmount()
    expect(removeTurnstile).toHaveBeenCalledWith(7)
  })

  it('explains a blocked script and mounts no widget', async () => {
    loadTurnstile.mockRejectedValueOnce(new Error('blocked'))
    render(<Turnstile onToken={vi.fn()} />)

    expect(await screen.findByText(/verification could not load/i)).toBeInTheDocument()
    expect(renderTurnstile).not.toHaveBeenCalled()
  })
})
