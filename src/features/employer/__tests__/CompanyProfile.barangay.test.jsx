import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CompanyProfile from '../CompanyProfile'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/auth', () => ({
  updateProfile: vi.fn(),
  getEmployer: vi.fn(),
  provision: vi.fn(),
  changePassword: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getEmployer } from '../../../shared/services/auth'

async function openProfile() {
  render(<CompanyProfile />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Profile' }))
}

describe('CompanyProfile barangay field', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', email: 'hr@company.ph' }, refreshUser: vi.fn() })
  })

  it('shows an official stored barangay in the dropdown', async () => {
    getEmployer.mockResolvedValue({ company_name: 'Santa Maria Trading', barangay_district: 'Poblacion' })
    await openProfile()

    expect(screen.getByLabelText('Barangay / District')).toHaveValue('Poblacion')
  })

  it('keeps a legacy stored barangay that is not in the official list', async () => {
    getEmployer.mockResolvedValue({ company_name: 'Santa Maria Trading', barangay_district: 'Sto. Rosario' })
    await openProfile()

    expect(screen.getByLabelText('Barangay / District')).toHaveValue('Sto. Rosario')
    expect(screen.getByRole('option', { name: 'Sto. Rosario' })).toBeInTheDocument()
  })
})
