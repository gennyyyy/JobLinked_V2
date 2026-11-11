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

  it('keeps particles lowercase unless first word', () => {
    expect(titleCase('juan de la cruz')).toBe('Juan de la Cruz')
    expect(titleCase('maria van der berg')).toBe('Maria van der Berg')
    expect(titleCase('the duke')).toBe('The Duke')
  })

  it('keeps ordinal suffixes lowercase', () => {
    expect(titleCase('john smith the third')).toBe('John Smith the third')
    expect(titleCase('jane doe second')).toBe('Jane Doe second')
  })

  it('keeps roman numerals upper-case (existing)', () => {
    expect(titleCase('jose iii')).toBe('Jose III')
  })
})
