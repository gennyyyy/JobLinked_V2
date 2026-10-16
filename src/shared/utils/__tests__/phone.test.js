import { describe, it, expect } from 'vitest'
import { normalizePhone, isValidPhone, toLocalDigits, withPrefix } from '../phone'

describe('phone', () => {
  it('normalizes 09… / 63… / spaced input to strict +63', () => {
    expect(normalizePhone('09171234567')).toBe('+639171234567')
    expect(normalizePhone('+63 917 123 4567')).toBe('+639171234567')
    expect(normalizePhone('639171234567')).toBe('+639171234567')
    expect(normalizePhone('(044) 000-0000')).toBe('+63440000000')
  })

  it('rejects non-PH input', () => {
    expect(isValidPhone('12345')).toBe(false)
    expect(isValidPhone('')).toBe(false)
    expect(isValidPhone('+639171234567')).toBe(true)
  })

  it('strips a pasted prefix down to local digits', () => {
    expect(toLocalDigits('+63 917 123 4567')).toBe('9171234567')
    expect(toLocalDigits('09171234567')).toBe('9171234567')
    expect(toLocalDigits('9171234567')).toBe('9171234567')
    expect(toLocalDigits('')).toBe('')
    expect(withPrefix('9171234567')).toBe('+639171234567')
    expect(withPrefix('')).toBe('')
  })
})
