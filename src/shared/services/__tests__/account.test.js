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
import { revokeAllSessions, exportAccount, eraseAccount } from '../account'

beforeEach(() => {
  vi.clearAllMocks()
  resetAuthClient()
  URL.createObjectURL = vi.fn(() => 'blob:joblinked-export')
  URL.revokeObjectURL = vi.fn()
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

describe('exportAccount', () => {
  it('downloads the JSON envelope as joblinked-export.json', async () => {
    api.get.mockResolvedValueOnce({ role: 'job-seeker', profile: { first_name: 'Ana' } })
    const clicked = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.push(this)
    })

    await exportAccount()

    expect(api.get).toHaveBeenCalledWith('account/export')
    const blob = URL.createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('application/json')
    const text = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsText(blob)
    })
    expect(JSON.parse(text)).toEqual({ role: 'job-seeker', profile: { first_name: 'Ana' } })
    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('joblinked-export.json')
    expect(clicked[0].href).toBe('blob:joblinked-export')
    expect(document.body.contains(clicked[0])).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:joblinked-export')
    click.mockRestore()
  })
})

describe('eraseAccount', () => {
  it('sends the confirmation body, signs the BA client out, clears the cache', async () => {
    api.del.mockResolvedValueOnce({ erased: true, role: 'job-seeker' })

    await eraseAccount()

    expect(api.del).toHaveBeenCalledWith('account', { confirm: 'ERASE' })
    expect(authClientMock.signOut).toHaveBeenCalledTimes(1)
    expect(clearApiCache).toHaveBeenCalledTimes(1)
  })

  it('still clears the cache when the client sign-out fails', async () => {
    api.del.mockResolvedValueOnce({ erased: true })
    authClientMock.signOut.mockRejectedValueOnce(new Error('offline'))

    await expect(eraseAccount()).resolves.toBeUndefined()

    expect(clearApiCache).toHaveBeenCalledTimes(1)
  })
})
