import { describe, it, expect, beforeEach } from 'vitest'
import { stashApplyIntent, takeApplyIntent } from '../applyIntent'

beforeEach(() => localStorage.clear())

describe('applyIntent', () => {
  it('maps the stash to the seeker job path', () => {
    stashApplyIntent('42')
    expect(takeApplyIntent()).toBe('/job-seeker/jobs/42')
  })

  it('is one-shot: take clears the entry', () => {
    stashApplyIntent('42')
    takeApplyIntent()
    expect(takeApplyIntent()).toBeNull()
  })

  it('rejects unsafe or malformed ids', () => {
    stashApplyIntent('//evil.com')
    expect(takeApplyIntent()).toBeNull()
    stashApplyIntent('https://evil.com')
    expect(takeApplyIntent()).toBeNull()
    stashApplyIntent('../etc')
    expect(takeApplyIntent()).toBeNull()
  })

  it('expires entries older than 24 hours', () => {
    localStorage.setItem('joblinked:applyIntent', JSON.stringify({ id: '42', at: Date.now() - 25 * 60 * 60 * 1000 }))
    expect(takeApplyIntent()).toBeNull()
  })

  it('returns null on corrupt JSON', () => {
    localStorage.setItem('joblinked:applyIntent', 'not-json')
    expect(takeApplyIntent()).toBeNull()
  })
})
