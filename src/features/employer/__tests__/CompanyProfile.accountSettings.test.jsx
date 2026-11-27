import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CompanyProfile from '../CompanyProfile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({
  updateProfile: vi.fn(),
  getEmployer: vi.fn(),
  provision: vi.fn(),
  changePassword: vi.fn(),
}))
vi.mock('../../../shared/services/images', () => ({
  uploadLogo: vi.fn(),
  removeLogo: vi.fn(),
  logoUrl: vi.fn(() => null),
}))
vi.mock('../../../shared/services/account', () => ({
  getPreferences: vi.fn().mockResolvedValue({ application_updates: true, community_announcements: true }),
  updatePreferences: vi.fn(),
  exportAccount: vi.fn(),
  revokeAllSessions: vi.fn(),
  eraseAccount: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getEmployer } from '../../../shared/services/auth'

const COMPLETE_COMPANY = {
  company_name: 'Santa Maria Trading',
  industry: 'Manufacturing',
  company_email: 'hr@company.ph',
  phone: '+639171234567',
  street_address: '12 Mabini Street',
  barangay_district: 'Poblacion',
  city_municipality: 'Santa Maria',
  province_state: 'Bulacan',
  first_name: 'Maria',
  last_name: 'Reyes',
  representative_position: 'HR Manager',
  representative_phone: '+639181234567',
  representative_email: 'maria@company.ph',
}

describe('CompanyProfile account settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
      user: { id: 'u1', email: 'hr@company.ph', role: 'employer' },
      refreshUser: vi.fn().mockResolvedValue({}),
    })
    getEmployer.mockResolvedValue(COMPLETE_COMPANY)
  })

  it('shows the Sessions card and Two-factor panel on the account settings tab', async () => {
    render(<MemoryRouter><CompanyProfile /></MemoryRouter>)
    await screen.findByLabelText(/^company name/i)

    fireEvent.click(screen.getByRole('tab', { name: /account settings/i }))

    expect(await screen.findByText('Sessions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out all devices/i })).toBeInTheDocument()
    expect(screen.getByText('Two-factor authentication')).toBeInTheDocument()
  })
})
