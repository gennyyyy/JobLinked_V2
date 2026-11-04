import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSavedJobIds, isJobSaved, toggleSavedJob, subscribeSavedJobs } from '../savedJobs'

describe('saved jobs store', () => {
  beforeEach(() => window.localStorage.clear())

  it('starts empty', () => {
    expect(getSavedJobIds()).toEqual([])
  })

  it('adds and removes an id', () => {
    expect(toggleSavedJob('job-1')).toEqual(['job-1'])
    expect(isJobSaved('job-1')).toBe(true)
    expect(toggleSavedJob('job-1')).toEqual([])
    expect(isJobSaved('job-1')).toBe(false)
  })

  it('notifies subscribers on change', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSavedJobs(listener)
    toggleSavedJob('job-2')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    toggleSavedJob('job-3')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
