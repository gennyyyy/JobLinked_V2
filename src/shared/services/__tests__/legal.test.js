import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PRIVACY_NOTICE } from '@/shared/content/legal'

vi.mock('@/shared/lib/api', () => ({ api: { get: vi.fn(), patch: vi.fn() } }))

describe('legal service', () => {
  let api
  let getLegal
  let updateLegal

  beforeEach(async () => {
    vi.resetModules()
    const apiMod = await import('@/shared/lib/api')
    api = apiMod.api
    const svc = await import('@/shared/services/legal')
    getLegal = svc.getLegal
    updateLegal = svc.updateLegal
    vi.clearAllMocks()
  })

  it('returns the API body on success', async () => {
    api.get.mockResolvedValue({ body: 'api body' })
    await expect(getLegal('privacy')).resolves.toBe('api body')
    expect(api.get).toHaveBeenCalledWith('legal/privacy')
  })

  it('returns the bundled fallback on API failure', async () => {
    api.get.mockRejectedValue(new Error('boom'))
    await expect(getLegal('privacy')).resolves.toBe(PRIVACY_NOTICE)
  })

  it('returns fallback when the body is empty', async () => {
    api.get.mockResolvedValue({ body: '   ' })
    await expect(getLegal('privacy')).resolves.toBe(PRIVACY_NOTICE)
  })

  it('reuses one request across calls', async () => {
    api.get.mockResolvedValue({ body: 'api body' })
    const a = getLegal('privacy')
    const b = getLegal('privacy')
    await Promise.all([a, b])
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('updateLegal patches the admin endpoint', async () => {
    api.patch.mockResolvedValue({ body: 'new body' })
    await updateLegal('privacy', 'new body')
    expect(api.patch).toHaveBeenCalledWith('admin/legal/privacy', { body: 'new body' })
  })
})