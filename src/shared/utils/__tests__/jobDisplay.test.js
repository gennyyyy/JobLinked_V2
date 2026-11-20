import { describe, it, expect } from 'vitest'
import { categoryLabel, matchJob, preferenceScore } from '../jobDisplay'

const job = (overrides = {}) => ({
  id: 'j1',
  title: 'Warehouse Helper',
  description: '',
  requirements: '',
  tags: [],
  skills: [],
  ...overrides,
})

describe('categoryLabel', () => {
  it('prefers the structured field over tags', () => {
    expect(categoryLabel(job({ field: 'Logistics & Delivery', tags: ['Urgent Hiring'] }))).toBe('Logistics & Delivery')
  })

  it('falls back to office then employment type, never tags', () => {
    expect(categoryLabel(job({ office: 'Santa Maria', employment_type: 'Full-time', tags: ['Day Shift'] }))).toBe('Santa Maria')
    expect(categoryLabel(job({ employment_type: 'Part-time', tags: ['Urgent Hiring'] }))).toBe('Part-time')
    expect(categoryLabel(job({ tags: ['Urgent Hiring'] }))).toBe('')
  })
})

describe('matchJob', () => {
  it('measures seeker skills against the vacancy skills, case-insensitively', () => {
    const vacancy = job({ skills: ['MS Excel', 'Driving', 'Data Entry'] })

    expect(matchJob(vacancy, { skills: ['ms excel', 'DRIVING', 'Communication'] }))
      .toEqual({ score: 67, matched: ['MS Excel', 'Driving'], total: 3 })
  })

  it('ignores tags when the vacancy lists skills', () => {
    const vacancy = job({ skills: ['Welding'], tags: ['Driving'] })

    expect(matchJob(vacancy, { skills: ['Driving'] })).toEqual({ score: 0, matched: [], total: 1 })
  })

  it('falls back to the posting text for legacy vacancies without skills', () => {
    const legacy = job({ title: 'Company Driver', tags: ['Urgent Hiring'] })

    expect(matchJob(legacy, { skills: ['driver', 'Welding'] }))
      .toEqual({ score: 50, matched: ['driver'], total: 2 })
  })

  it('scores zero instead of NaN when neither side lists skills', () => {
    expect(matchJob(job(), { skills: [] })).toEqual({ score: 0, matched: [], total: 0 })
  })
})

describe('preferenceScore', () => {
  it('matches the structured field', () => {
    expect(preferenceScore(job({ field: 'Healthcare' }), 'healthcare work')).toBe(1)
  })

  it('matches structured skills', () => {
    expect(preferenceScore(job({ title: 'Helper', skills: ['Forklift Operation'] }), 'forklift')).toBe(1)
  })
})
