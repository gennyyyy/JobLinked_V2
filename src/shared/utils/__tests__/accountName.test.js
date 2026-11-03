import { describe, it, expect } from 'vitest'
import { displayName, initialsOf } from '../accountName'

describe('accountName', () => {
  it('first+last', () => {
    const user = { full_name: 'jane owner' }
    expect(displayName(user, 'Employer')).toBe('jane owner')
    expect(initialsOf(user, 'Employer')).toBe('JO')
  })

  it('single word', () => {
    const user = { name: 'Madonna' }
    expect(initialsOf(user, 'X')).toBe('M')
  })

  it('email-only', () => {
    const user = { email: 'anon@acme.test' }
    expect(displayName(user, 'Job Seeker')).toBe('anon@acme.test')
    expect(initialsOf(user, 'Job Seeker')).toBe('A')
  })

  it('falls back to first_name/last_name initials', () => {
    const user = { first_name: 'Ada', last_name: 'Lovelace' }
    expect(initialsOf(user, 'X')).toBe('AL')
  })
})