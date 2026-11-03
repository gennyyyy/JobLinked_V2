
import { vi } from 'vitest'
import { mockApi } from '../../../test/api-helper'

vi.mock('../../../shared/lib/api', () => ({ api: mockApi() }))

import { api } from '../../../shared/lib/api'
import { changeJobStatus, duplicateJob, listJobs, createJob } from '../jobs'

describe('changeJobStatus', () => {
  it('calls api.post with status and remarks', async () => {
    api.post.mockResolvedValue({ id: 'j1', status: 'published' })
    const result = await changeJobStatus('j1', 'published')
    expect(result.status).toBe('published')
    expect(api.post).toHaveBeenCalledWith('jobs/j1/status', { status: 'published', remarks: null })
  })

  it('passes remarks when provided', async () => {
    api.post.mockResolvedValue({ id: 'j1', status: 'closed' })
    await changeJobStatus('j1', 'closed', 'No longer hiring')
    expect(api.post).toHaveBeenCalledWith('jobs/j1/status', { status: 'closed', remarks: 'No longer hiring' })
  })
})

describe('duplicateJob', () => {
  it('calls api.post to duplicate endpoint', async () => {
    api.post.mockResolvedValue({ id: 'j2', title: 'Dev (Copy)', status: 'draft' })
    const result = await duplicateJob('j1')
    expect(result.title).toBe('Dev (Copy)')
    expect(api.post).toHaveBeenCalledWith('jobs/j1/duplicate')
  })
})

describe('listJobs', () => {
  it('calls api.get with search params', async () => {
    api.get.mockResolvedValue([{ id: 'j1', title: 'Dev' }])
    const result = await listJobs({ search: 'dev', page: 1 })
    expect(result).toHaveLength(1)
    expect(api.get).toHaveBeenCalledWith('jobs', expect.objectContaining({ search: 'dev', page: 1 }))
  })
})

describe('createJob', () => {
  it('calls api.post with job data', async () => {
    api.post.mockResolvedValue({ id: 'j1', title: 'Dev' })
    const result = await createJob('c1', { title: 'Dev' })
    expect(result.id).toBe('j1')
    expect(api.post).toHaveBeenCalledWith('jobs', { title: 'Dev' })
  })
})
