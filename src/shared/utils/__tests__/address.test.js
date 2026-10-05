import { describe, it, expect } from 'vitest'
import { formatFullAddress } from '../address'

describe('formatFullAddress', () => {
  it('formats a complete address', () => {
    const addr = {
      house_number_unit: '123',
      street_address: 'Main St',
      subdivision_building: 'Building A',
      barangay_district: 'Brgy 1',
      city_municipality: 'Santa Maria',
      province_state: 'Bulacan',
      postal_code: '3022',
      country: 'Philippines',
    }
    expect(formatFullAddress(addr)).toBe('123, Main St, Building A, Brgy 1, Santa Maria, Bulacan, 3022, Philippines')
  })

  it('skips missing fields', () => {
    const addr = {
      street_address: 'Main St',
      city_municipality: 'Santa Maria',
      country: 'Philippines',
    }
    expect(formatFullAddress(addr)).toBe('Main St, Santa Maria, Philippines')
  })

  it('returns empty string for empty object', () => {
    expect(formatFullAddress({})).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatFullAddress(undefined)).toBe('')
  })

  it('handles address with no country', () => {
    const addr = {
      city_municipality: 'Santa Maria',
      province_state: 'Bulacan',
    }
    expect(formatFullAddress(addr)).toBe('Santa Maria, Bulacan')
  })
})