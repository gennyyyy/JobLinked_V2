
import { vi } from 'vitest'
import { mockApi } from '../../../test/api-helper'

vi.mock('../../../shared/lib/api', () => ({ api: mockApi() }))

import { api } from '../../../shared/lib/api'
import { updateAccreditation, updateDocumentStatus, createAccreditation } from '../documents'

describe('updateAccreditation', () => {
  it('patches accreditation via api', async () => {
    api.patch.mockResolvedValue({ id: 'acc1', status: 'approved' })
    const result = await updateAccreditation('acc1', { status: 'approved' })
    expect(result.status).toBe('approved')
    expect(api.patch).toHaveBeenCalledWith('accreditations/acc1', { status: 'approved' })
  })
})

describe('updateDocumentStatus', () => {
  it('patches document status via api', async () => {
    api.patch.mockResolvedValue({ id: 'd1', status: 'verified' })
    const result = await updateDocumentStatus('d1', 'verified')
    expect(result.status).toBe('verified')
    expect(api.patch).toHaveBeenCalledWith('documents/d1', { status: 'verified', remarks: null })
  })

  it('passes remarks when provided', async () => {
    api.patch.mockResolvedValue({ id: 'd1', status: 'rejected' })
    await updateDocumentStatus('d1', 'rejected', 'Incomplete')
    expect(api.patch).toHaveBeenCalledWith('documents/d1', { status: 'rejected', remarks: 'Incomplete' })
  })
})

describe('createAccreditation', () => {
  it('creates accreditation via api.post', async () => {
    api.post.mockResolvedValue({ id: 'acc1', status: 'pending' })
    const result = await createAccreditation('c1')
    expect(result.status).toBe('pending')
    expect(api.post).toHaveBeenCalledWith('accreditations', { company_id: 'c1' })
  })
})
