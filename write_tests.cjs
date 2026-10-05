const fs = require('fs');

// Helper to create api mock
const apiHelper = `
export function mockApi() {
  const api = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
    blob: vi.fn(),
  }
  return api
}
`;

// Write api helper
fs.writeFileSync('E:/code_ni_hans/peso_project/src/test/api-helper.js', apiHelper, 'utf8');

// Auth test
const authTest = `
import { vi } from 'vitest'
import { mockApi } from '../../../test/api-helper'

vi.mock('../../../shared/lib/api', () => ({ api: mockApi() }))
vi.mock('../../../shared/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(),
    storage: { from: vi.fn() },
    rpc: vi.fn(),
  },
}))

import { api } from '../../../shared/lib/api'
import { supabase } from '../../../shared/lib/supabase'
import { signIn, getProfile } from '../auth'

describe('signIn', () => {
  it('returns user with profile on successful login', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@test.com' } },
      error: null,
    })
    api.get.mockResolvedValue({ id: 'u1', full_name: 'Test User', role: 'job-seeker' })

    const result = await signIn('test@test.com', 'password')
    expect(result.id).toBe('u1')
    expect(result.role).toBe('job-seeker')
  })

  it('throws on invalid credentials', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    await expect(signIn('bad@test.com', 'wrong')).rejects.toThrow('Invalid login credentials')
  })

  it('throws when profile is not found', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@test.com' } },
      error: null,
    })
    api.get.mockRejectedValue({ status: 404 })

    await expect(signIn('test@test.com', 'password')).rejects.toThrow('Invalid email or password')
  })

  it('throws when account is suspended', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@test.com' } },
      error: null,
    })
    api.get.mockResolvedValue({ id: 'u1', status: 'suspended', role: 'job-seeker' })

    await expect(signIn('test@test.com', 'password')).rejects.toThrow('Invalid email or password')
  })
})

describe('getProfile', () => {
  it('returns profile from api', async () => {
    api.get.mockResolvedValue({ id: 'u1', full_name: 'Seeker', role: 'job-seeker' })
    const result = await getProfile('u1')
    expect(result.role).toBe('job-seeker')
  })

  it('returns null when profile not found (404)', async () => {
    api.get.mockRejectedValue({ status: 404 })
    const result = await getProfile('nonexistent')
    expect(result).toBeNull()
  })

  it('throws on other errors', async () => {
    api.get.mockRejectedValue({ status: 500, message: 'Server error' })
    await expect(getProfile('u1')).rejects.toThrow()
  })
})
`;
fs.writeFileSync('E:/code_ni_hans/peso_project/src/shared/services/__tests__/auth.test.js', authTest, 'utf8');

// Jobs test
const jobsTest = `
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
`;
fs.writeFileSync('E:/code_ni_hans/peso_project/src/shared/services/__tests__/jobs.test.js', jobsTest, 'utf8');

// Applications test
const applicationsTest = `
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
`;
fs.writeFileSync('E:/code_ni_hans/peso_project/src/shared/services/__tests__/applications.test.js', applicationsTest, 'utf8');

// Admin/Documents test
const adminTest = `
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
`;
fs.writeFileSync('E:/code_ni_hans/peso_project/src/shared/services/__tests__/admin.test.js', adminTest, 'utf8');

console.log('All test files written');