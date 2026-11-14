import { describe, it, expect } from 'vitest'
import { hasPermission } from '../permissions'

describe('hasPermission', () => {
  it('returns false for a null user', () => {
    expect(hasPermission(null, 'reports.view')).toBe(false)
  })
  it('returns true for any key when permissions is null (full admin)', () => {
    expect(hasPermission({ permissions: null }, 'anything')).toBe(true)
  })
  it('returns true only for listed keys when tagged', () => {
    expect(hasPermission({ permissions: ['reports.view'] }, 'reports.view')).toBe(true)
    expect(hasPermission({ permissions: ['reports.view'] }, 'settings.manage')).toBe(false)
  })
  it('returns false for empty permissions array', () => {
    expect(hasPermission({ permissions: [] }, 'reports.view')).toBe(false)
  })
})
