import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  logoUrl: vi.fn((id, version) => (id && version ? `https://example.com/logo/${id}.jpg?v=${version}` : 'https://example.com/logo.jpg')),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getEmployer, updateProfile } from '../../../shared/services/auth'
import { uploadLogo } from '../../../shared/services/images'

async function openProfile() {
  render(<MemoryRouter><CompanyProfile /></MemoryRouter>)
  await screen.findByLabelText(/^company name/i)
}

describe('CompanyProfile address fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', email: 'hr@company.ph' }, refreshUser: vi.fn() })
    updateProfile.mockResolvedValue({})
    uploadLogo.mockResolvedValue({})
  })

  it('loads the stored city, province, and postal code', async () => {
    getEmployer.mockResolvedValue({
      company_name: 'Santa Maria Trading',
      city_municipality: 'Santa Maria',
      province_state: 'Bulacan',
      postal_code: '3022',
    })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))

    expect(screen.getByLabelText('City / Municipality')).toHaveValue('Santa Maria')
    expect(screen.getByLabelText('Province / State')).toHaveValue('Bulacan')
    expect(screen.getByLabelText('Postal Code')).toHaveValue('3022')
  })

  it('saves the typed city, province, and postal code', async () => {
    getEmployer.mockResolvedValue({ company_name: 'Santa Maria Trading' })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))

    fireEvent.change(screen.getByLabelText('City / Municipality'), { target: { value: 'Angat' } })
    fireEvent.change(screen.getByLabelText('Province / State'), { target: { value: 'Bulacan' } })
    fireEvent.change(screen.getByLabelText('Postal Code'), { target: { value: '3012' } })
    fireEvent.click(screen.getByRole('button', { name: /save company profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      city_municipality: 'Angat',
      province_state: 'Bulacan',
      postal_code: '3012',
    }))
  })

  it('accepts a company logo upload from the company tab', async () => {
    getEmployer.mockResolvedValue({
      id: 'company-1',
      company_name: 'Santa Maria Trading',
      has_logo: false,
    })
    await openProfile()

    fireEvent.click(screen.getByRole('button', { name: /company logo settings/i }))
    fireEvent.click(screen.getByRole('button', { name: /add company logo/i }))

    const file = new File(['logo'], 'logo.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/upload company logo/i), { target: { files: [file] } })

    await waitFor(() => expect(uploadLogo).toHaveBeenCalledWith(file))
    expect(await screen.findByText('Logo saved.')).toBeInTheDocument()
  })

  it('shows the company acronym when no logo is saved', async () => {
    getEmployer.mockResolvedValue({
      company_name: 'Santa Maria Trading',
      has_logo: false,
    })
    await openProfile()

    expect(screen.getByText('SMT')).toBeInTheDocument()
  })

  it('integrates account settings into the company profile tabs', async () => {
    getEmployer.mockResolvedValue({
      company_name: 'Santa Maria Trading',
      has_logo: false,
    })
    await openProfile()

    expect(screen.getByText('Privacy comes first').closest('aside')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /account settings/i }))

    expect(await screen.findByText('Account overview')).toBeInTheDocument()
    expect(screen.getByText('hr@company.ph')).toBeInTheDocument()
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save company profile/i })).not.toBeInTheDocument()
    expect(document.querySelectorAll('form')).toHaveLength(1)
  })
})
