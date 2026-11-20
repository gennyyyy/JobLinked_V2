import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/shared/lib/api', () => ({ api: { get: vi.fn() } }))

describe('reference service', () => {
  let api
  let getReferenceValues

  beforeEach(async () => {
    vi.resetModules()
    api = (await import('@/shared/lib/api')).api
    getReferenceValues = (await import('@/shared/services/reference')).getReferenceValues
    vi.clearAllMocks()
  })

  it('unwraps values from the endpoint', async () => {
    api.get.mockResolvedValue({ values: ['MS Excel', 'Welding'] })

    await expect(getReferenceValues('skill')).resolves.toEqual(['MS Excel', 'Welding'])
    expect(api.get).toHaveBeenCalledWith('reference/skill')
  })

  it('caches per category so a second call makes no extra request', async () => {
    api.get.mockResolvedValue({ values: ['Construction'] })

    await expect(getReferenceValues('job_field')).resolves.toEqual(['Construction'])
    await expect(getReferenceValues('job_field')).resolves.toEqual(['Construction'])

    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('fetches each category separately', async () => {
    api.get.mockResolvedValue({ values: [] })

    await getReferenceValues('skill')
    await getReferenceValues('job_field')

    expect(api.get).toHaveBeenCalledTimes(2)
    expect(api.get).toHaveBeenNthCalledWith(1, 'reference/skill')
    expect(api.get).toHaveBeenNthCalledWith(2, 'reference/job_field')
  })

  it('propagates a failed read and does not cache the failure', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'))
    await expect(getReferenceValues('skill')).rejects.toThrow('offline')

    api.get.mockResolvedValueOnce({ values: ['MS Excel'] })
    await expect(getReferenceValues('skill')).resolves.toEqual(['MS Excel'])
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})
