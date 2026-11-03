import { describe, it, expect } from 'vitest'
import { titleCase } from '../titleCase'

describe('titleCase', () => {
  it('capitalizes basic words', () => {
    expect(titleCase('juan dela cruz')).toBe('Juan Dela Cruz')
  })

  it('normalizes already-upper input', () => {
    expect(titleCase('SANTA MARIA')).toBe('Santa Maria')
  })

  it('handles hyphen and apostrophe', () => {
    expect(titleCase("maria-clara d'cruz")).toBe("Maria-Clara D'Cruz")
  })

  it('returns empty for null/undefined/empty', () => {
    expect(titleCase(null)).toBe('')
    expect(titleCase(undefined)).toBe('')
    expect(titleCase('')).toBe('')
  })

  it('keeps roman-numeral suffixes upper-case', () => {
    expect(titleCase('JOSE III')).toBe('Jose III')
    expect(titleCase('juan dela cruz ii')).toBe('Juan Dela Cruz II')
    expect(titleCase('pedro iv')).toBe('Pedro IV')
    expect(titleCase('ana viii')).toBe('Ana VIII')
  })
})
