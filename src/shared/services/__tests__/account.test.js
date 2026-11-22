import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockApi } from '../../../test/api-helper'

vi.mock('../../../shared/lib/api', () => ({
  api: mockApi(),
  clearApiCache: vi.fn(),
}))
vi.mock('../../../shared/lib/auth-client', async () => {
  const { authClientMock } = await import('../../../test/authClientMock')
  return { authClient: authClientMock }
})

import { api, clearApiCache } from '../../../shared/lib/api'
import { authClientMock, resetAuthClient } from '../../../test/authClientMock'
import { revokeAllSessions, deactivateAccount } from '../account'

beforeEach(() => {
  vi.clearAllMocks()
  resetAuthClient()
})

describe('revokeAllSessions', () => {
  it('revokes on the server, signs the BA client out, clears the cache', async () => {
    api.post.mockResolvedValueOnce(undefined)

    await revokeAllSessions()

    expect(api.post).toHaveBeenCalledWith('account/sessions/revoke-all')
    expect(authClientMock.signOut).toHaveBeenCalledTimes(1)
    expect(clearApiCache).toHaveBeenCalledTimes(1)
  })

  it('still clears the cache when the client sign-out fails', async () => {
    api.post.mockResolvedValueOnce(undefined)
    authClientMock.signOut.mockRejectedValueOnce(new Error('offline'))

    await expect(revokeAllSessions()).resolves.toBeUndefined()

    expect(clearApiCache).toHaveBeenCalledTimes(1)
  })
})

describe('deactivateAccount', () => {
  it('deactivates on the server, signs the BA client out, clears the cache', async () => {
    api.post.mockResolvedValueOnce(undefined)

    await deactivateAccount()

    expect(api.post).toHaveBeenCalledWith('account/deactivate', { confirm: 'DEACTIVATE' })
    expect(authClientMock.signOut).toHaveBeenCalledTimes(1)
    expect(clearApiCache).toHaveBeenCalledTimes(1)
  })

  it('still clears the cache when the client sign-out fails', async () => {
    api.post.mockResolvedValueOnce(undefined)
    authClientMock.signOut.mockRejectedValueOnce(new Error('offline'))

    await expect(deactivateAccount()).resolves.toBeUndefined()

    expect(clearApiCache).toHaveBeenCalledTimes(1)
  })
})
