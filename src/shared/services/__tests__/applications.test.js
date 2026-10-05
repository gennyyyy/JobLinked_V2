
import { vi } from 'vitest'
import { mockApi } from '../../../test/api-helper'

vi.mock('../../../shared/lib/api', () => ({ api: mockApi() }))

import { api } from '../../../shared/lib/api'
import { applyToJob, updateApplicationStatus, listBySeeker } from '../applications'

describe('applyToJob', () => {
  it('successfully applies to a job', async () => {
    api.post.mockResolvedValue({ id: 'a1', job_id: 'j1', status: 'Pending' })
    const result = await applyToJob('j1', 's1', 'r1')
    expect(result.id).toBe('a1')
    expect(result.status).toBe('Pending')
    expect(api.post).toHaveBeenCalledWith('applications', { job_id: 'j1', resume_id: 'r1' })
  })

  it('handles null resume', async () => {
    api.post.mockResolvedValue({ id: 'a1', job_id: 'j1', status: 'Pending' })
    await applyToJob('j1', 's1')
    expect(api.post).toHaveBeenCalledWith('applications', { job_id: 'j1', resume_id: null })
  })
})

describe('updateApplicationStatus', () => {
  it('updates status via api.post', async () => {
    api.post.mockResolvedValue({ id: 'a1', status: 'Accepted' })
    const result = await updateApplicationStatus('a1', 'Accepted')
    expect(result.status).toBe('Accepted')
    expect(api.post).toHaveBeenCalledWith('applications/a1/status', expect.objectContaining({ status: 'Accepted' }))
  })

  it('passes optional fields', async () => {
    api.post.mockResolvedValue({ id: 'a1', status: 'Interview' })
    await updateApplicationStatus('a1', 'Interview', { remarks: 'Good', interviewAt: '2025-01-01' })
    expect(api.post).toHaveBeenCalledWith('applications/a1/status', expect.objectContaining({ status: 'Interview', remarks: 'Good' }))
  })
})

describe('listBySeeker', () => {
  it('fetches my applications', async () => {
    api.get.mockResolvedValue([{ id: 'a1', job: { title: 'Dev' } }])
    const result = await listBySeeker('s1')
    expect(result).toHaveLength(1)
    expect(api.get).toHaveBeenCalledWith('applications/mine')
  })
})
