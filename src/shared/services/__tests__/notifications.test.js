import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), del: vi.fn() } }))

import { api } from '../../lib/api'
import { listNotifications, markRead, markAllRead, deleteNotification } from '../notifications'
import { NOTIFICATIONS_CHANGED } from '../../utils/notificationEvents'

describe('notification service change events', () => {
  let spy

  beforeEach(() => {
    vi.clearAllMocks()
    spy = vi.fn()
    window.addEventListener(NOTIFICATIONS_CHANGED, spy)
  })

  afterEach(() => {
    window.removeEventListener(NOTIFICATIONS_CHANGED, spy)
  })

  it('listNotifications does not dispatch a change event', async () => {
    api.get.mockResolvedValue([])
    await listNotifications('u1')
    expect(spy).not.toHaveBeenCalled()
  })

  it('markRead dispatches exactly one change event on success', async () => {
    api.post.mockResolvedValue({ ok: true })
    await markRead('n1')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('markAllRead dispatches exactly one change event on success', async () => {
    api.post.mockResolvedValue({ ok: true })
    await markAllRead('u1')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('deleteNotification dispatches exactly one change event on success', async () => {
    api.del.mockResolvedValue({ deleted: true })
    await deleteNotification('n1')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('markRead rejects without dispatching when api.post fails', async () => {
    api.post.mockRejectedValue(new Error('boom'))
    await expect(markRead('n1')).rejects.toThrow('boom')
    expect(spy).not.toHaveBeenCalled()
  })

  it('markAllRead rejects without dispatching when api.post fails', async () => {
    api.post.mockRejectedValue(new Error('boom'))
    await expect(markAllRead('u1')).rejects.toThrow('boom')
    expect(spy).not.toHaveBeenCalled()
  })

  it('deleteNotification rejects without dispatching when api.del fails', async () => {
    api.del.mockRejectedValue(new Error('boom'))
    await expect(deleteNotification('n1')).rejects.toThrow('boom')
    expect(spy).not.toHaveBeenCalled()
  })
})
