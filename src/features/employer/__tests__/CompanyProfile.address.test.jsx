import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CompanyProfile from '../CompanyProfile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({
  updateProfile: vi.fn(),
  getEmployer: vi.fn(),
  provision: vi.fn(),
  changePassword: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getEmployer, updateProfile } from '../../../shared/services/auth'

async function openProfile() {
  render(<CompanyProfile />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }))
}

describe('CompanyProfile address fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', email: 'hr@company.ph' }, refreshUser: vi.fn() })
    updateProfile.mockResolvedValue({})
  })

  it('loads the stored city, province, and postal code', async () => {
    getEmployer.mockResolvedValue({
      company_name: 'Santa Maria Trading',
      city_municipality: 'Santa Maria',
      province_state: 'Bulacan',
      postal_code: '3022',
    })
    await openProfile()

    expect(screen.getByLabelText('City / Municipality')).toHaveValue('Santa Maria')
    expect(screen.getByLabelText('Province / State')).toHaveValue('Bulacan')
    expect(screen.getByLabelText('Postal Code')).toHaveValue('3022')
  })

  it('saves the typed city, province, and postal code', async () => {
    getEmployer.mockResolvedValue({ company_name: 'Santa Maria Trading' })
    await openProfile()

    fireEvent.change(screen.getByLabelText('City / Municipality'), { target: { value: 'Angat' } })
    fireEvent.change(screen.getByLabelText('Province / State'), { target: { value: 'Bulacan' } })
    fireEvent.change(screen.getByLabelText('Postal Code'), { target: { value: '3012' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Profile' }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      city_municipality: 'Angat',
      province_state: 'Bulacan',
      postal_code: '3012',
    }))
  })
})
