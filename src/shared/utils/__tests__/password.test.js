import { describe, it, expect } from 'vitest'
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_HINT,
  PASSWORD_RULES,
  passwordError,
} from '../password'

const COMPOSITION =
  'Password must include at least one letter, one number, and one symbol.'

describe('password policy', () => {
  it('exposes the shared constants', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8)
    expect(PASSWORD_MAX_LENGTH).toBe(72)
    expect(PASSWORD_HINT).toBe(
      'At least 8 characters, including one letter, one number, and one symbol.'
    )
  })

  it.each([
    ['empty', '', 'Password is required'],
    ['undefined', undefined, 'Password is required'],
    ['too short', 'pass1!', 'Password must be at least 8 characters'],
    ['too long', 'a'.repeat(73), 'Password must be at most 72 characters'],
    ['letters only', 'password', COMPOSITION],
    ['digits only', '12345678', COMPOSITION],
    ['symbols only', '!@#$%^&*', COMPOSITION],
    ['letters and digits, no symbol', 'password123', COMPOSITION],
    ['digits and symbol, no letter', '12345678!', COMPOSITION],
    ['letters and symbol, no digit', 'password!', COMPOSITION],
    ['whitespace does not count as a symbol', 'password 1', COMPOSITION],
    ['letter, number and symbol', 'Passw0rd!', ''],
    ['exactly 8 characters', 'abcdef1!', ''],
    ['exactly 72 characters', `${'a'.repeat(70)}1!`, ''],
  ])('%s', (_label, value, expected) => {
    expect(passwordError(value)).toBe(expected)
  })

  it('keeps PASSWORD_RULES aligned with passwordError', () => {
    expect(PASSWORD_RULES).toHaveLength(4)
    for (const value of ['password123!', 'Passw0rd!', 'password123', '!@#$%^&*', '']) {
      expect(PASSWORD_RULES.every((rule) => rule.test(value))).toBe(passwordError(value) === '')
    }
  })
})
