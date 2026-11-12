import { describe, it, expect } from 'vitest'
import { searchWorkspace } from '../workspaceSearch'

describe('searchWorkspace', () => {
  it('finds a settings section with its page subtitle and hash href', () => {
    expect(searchWorkspace('password', 'job-seeker')[0]).toEqual({
      title: 'Password settings',
      subtitle: 'in My profile',
      href: '/job-seeker/profile#password-settings',
    })
  })

  it('links account settings sections through the job seeker profile', () => {
    expect(searchWorkspace('account overview', 'job-seeker')[0]).toEqual({
      title: 'Account overview',
      subtitle: 'in My profile',
      href: '/job-seeker/profile#account-overview',
    })
  })

  it('scopes results to the signed-in role', () => {
    expect(searchWorkspace('password', 'employer').map((r) => r.href)).toEqual(['/employer/company#password-settings'])
    expect(searchWorkspace('user management', 'job-seeker')).toEqual([])
  })

  it('returns nothing for a blank query', () => {
    expect(searchWorkspace('', 'job-seeker')).toEqual([])
    expect(searchWorkspace('   ', 'job-seeker')).toEqual([])
  })

  it('matches section keywords', () => {
    expect(searchWorkspace('resume', 'job-seeker').map((r) => r.title)).toContain('My resumes')
  })

  it('ranks an exact title match first', () => {
    expect(searchWorkspace('experience', 'job-seeker')[0].title).toBe('Experience')
  })
})
