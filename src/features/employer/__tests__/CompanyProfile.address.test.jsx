import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
import { uploadLogo, removeLogo } from '../../../shared/services/images'

// A profile that satisfies everything registration requires, so each test can
// break exactly the field it exercises.
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

async function openProfile() {
  render(<MemoryRouter><CompanyProfile /></MemoryRouter>)
  await screen.findByLabelText(/^company name/i)
}

describe('CompanyProfile address fields', () => {
  let refreshUser
  beforeEach(() => {
    vi.clearAllMocks()
    refreshUser = vi.fn().mockResolvedValue({})
    useAuth.mockReturnValue({ user: { id: 'u1', email: 'hr@company.ph' }, refreshUser })
    updateProfile.mockResolvedValue({})
    uploadLogo.mockResolvedValue({})
    removeLogo.mockResolvedValue({})
  })

  it('loads the fixed city and province and the stored postal code', async () => {
    // A legacy row may hold any Bulacan LGU; the edit form always shows the fixed scope.
    getEmployer.mockResolvedValue({
      ...COMPLETE_COMPANY,
      city_municipality: 'Angat',
      province_state: 'Bulacan',
      postal_code: '3022',
    })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))

    expect(screen.getByLabelText(/^City \/ Municipality/)).toHaveValue('Santa Maria')
    expect(screen.getByLabelText(/^Province \/ State/)).toHaveValue('Bulacan')
    expect(screen.getByLabelText('Postal Code')).toBeDisabled()
    expect(screen.getByLabelText('Postal Code')).toHaveValue('3022')
  })

  it('saves the fixed city and province with the postal code', async () => {
    getEmployer.mockResolvedValue(COMPLETE_COMPANY)
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))

    fireEvent.click(screen.getByRole('button', { name: /save company profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      city_municipality: 'Santa Maria',
      province_state: 'Bulacan',
      postal_code: '3022',
    }))
  })

  it('renders city and province as disabled fixed selects', async () => {
    getEmployer.mockResolvedValue(COMPLETE_COMPANY)
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))

    const city = screen.getByLabelText(/^City \/ Municipality/)
    const province = screen.getByLabelText(/^Province \/ State/)
    expect(city.tagName).toBe('SELECT')
    expect(province.tagName).toBe('SELECT')
    expect(city).toBeDisabled()
    expect(province).toBeDisabled()
    expect(city).toHaveValue('Santa Maria')
    expect(province).toHaveValue('Bulacan')
    expect(within(city).getAllByRole('option')).toHaveLength(1)
    expect(within(province).getAllByRole('option')).toHaveLength(1)
    expect(within(city).getByRole('option', { name: 'Santa Maria' })).toBeInTheDocument()
    expect(within(province).getByRole('option', { name: 'Bulacan' })).toBeInTheDocument()
  })

  it('shows the fixed city and province for an out-of-list stored address', async () => {
    getEmployer.mockResolvedValue({
      ...COMPLETE_COMPANY,
      city_municipality: 'Quezon City',
      province_state: 'Metro Manila',
    })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))

    expect(screen.getByLabelText(/^City \/ Municipality/)).toHaveValue('Santa Maria')
    expect(screen.getByLabelText(/^Province \/ State/)).toHaveValue('Bulacan')
    expect(screen.queryByRole('option', { name: 'Select city / municipality' })).not.toBeInTheDocument()
  })

  it('blocks the save when the business phone is invalid', async () => {
    getEmployer.mockResolvedValue({ ...COMPLETE_COMPANY, phone: '' })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))

    fireEvent.change(screen.getByLabelText(/business phone/i), { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: /save company profile/i }))

    expect(await screen.findByText('Enter a valid Philippine contact number (e.g. 917 123 4567).')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('blocks the save when the representative mobile is invalid', async () => {
    getEmployer.mockResolvedValue({ ...COMPLETE_COMPANY, representative_phone: '' })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /^representative$/i }))

    fireEvent.change(screen.getByLabelText(/^Representative Mobile/), { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: /save company profile/i }))

    expect(await screen.findByText('Enter a valid Philippine contact number (e.g. 917 123 4567).')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('saves a spaced business phone in +63 form', async () => {
    getEmployer.mockResolvedValue({ ...COMPLETE_COMPANY, phone: '' })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))

    fireEvent.change(screen.getByLabelText(/business phone/i), { target: { value: '0917 123 4567' } })
    fireEvent.click(screen.getByRole('button', { name: /save company profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({ phone: '+639171234567' }))
    expect(screen.getByLabelText(/business phone/i)).toHaveValue('917 123 4567')
  })

  it('validates the business phone on blur before saving', async () => {
    getEmployer.mockResolvedValue(COMPLETE_COMPANY)
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))

    const phone = screen.getByLabelText(/business phone/i)
    // The fixed prefix is outside the editable input.
    expect(within(phone.closest('[data-slot="input-group"]')).getByText('+63')).toBeVisible()
    expect(phone).toHaveValue('917 123 4567')

    fireEvent.change(phone, { target: { value: '12345' } })
    fireEvent.blur(phone)

    expect(await screen.findByText('Enter a valid Philippine contact number (e.g. 917 123 4567).')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()

    fireEvent.change(phone, { target: { value: '917 123 4567' } })
    expect(screen.queryByText('Enter a valid Philippine contact number (e.g. 917 123 4567).')).not.toBeInTheDocument()
    expect(phone).toHaveValue('917 123 4567')
  })

  it('blocks the save and asks for both phone numbers when they are blank', async () => {
    getEmployer.mockResolvedValue({ ...COMPLETE_COMPANY, phone: '', representative_phone: '' })
    await openProfile()

    fireEvent.click(screen.getByRole('button', { name: /save company profile/i }))

    expect(await screen.findByText('Contact number is required')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
    // The failed save opens the contact tab where the phone error lives.
    expect(screen.getByRole('tab', { name: /contact & location/i })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: /^representative$/i }))
    expect(screen.getByText('Representative mobile is required')).toBeInTheDocument()
  })

  it('keeps the representative mobile separate from the business phone', async () => {
    getEmployer.mockResolvedValue({ ...COMPLETE_COMPANY, phone: '+63440000000' })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /^representative$/i }))

    const mobile = screen.getByLabelText(/^Representative Mobile/)
    expect(mobile).toHaveAttribute('type', 'tel')
    expect(mobile).toHaveValue('918 123 4567')

    fireEvent.change(mobile, { target: { value: '+639189998888' } })
    fireEvent.click(screen.getByRole('button', { name: /save company profile/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      representative_phone: '+639189998888',
      phone: '+63440000000',
    }))
  })

  it('does not render a login email field on the representative tab', async () => {
    getEmployer.mockResolvedValue({ ...COMPLETE_COMPANY, email: 'hr@company.ph' })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /^representative$/i }))

    expect(screen.getByLabelText(/^Representative Mobile/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/login email/i)).not.toBeInTheDocument()
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
    // The header reads has_logo from the auth user, so the upload refreshes it.
    expect(refreshUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }))
  })

  it('refreshes the auth user after a logo removal', async () => {
    getEmployer.mockResolvedValue({
      id: 'company-1',
      company_name: 'Santa Maria Trading',
      has_logo: true,
      logo_updated_at: '2026-01-01T00:00:00.000Z',
    })
    await openProfile()

    fireEvent.click(screen.getByRole('button', { name: /company logo settings/i }))
    fireEvent.click(screen.getByRole('button', { name: /remove company logo/i }))

    await waitFor(() => expect(removeLogo).toHaveBeenCalled())
    expect(await screen.findByText('Logo removed.')).toBeInTheDocument()
    expect(refreshUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }))
  })

  it('shows the company acronym when no logo is saved', async () => {
    getEmployer.mockResolvedValue({
      company_name: 'Santa Maria Trading',
      has_logo: false,
    })
    await openProfile()

    expect(screen.getByText('SMT')).toBeInTheDocument()
  })

  it('ignores a file:// legacy logo path and shows the acronym', async () => {
    getEmployer.mockResolvedValue({
      company_name: 'Santa Maria Trading',
      has_logo: false,
      logo_path: 'file:///C:/Users/me/logo.png',
    })
    await openProfile()

    expect(screen.queryByRole('img', { name: /company logo/i })).not.toBeInTheDocument()
    expect(screen.getByText('SMT')).toBeInTheDocument()
  })

  it('still renders an absolute https legacy logo path', async () => {
    getEmployer.mockResolvedValue({
      company_name: 'Santa Maria Trading',
      has_logo: false,
      logo_path: 'https://cdn.example.com/logo.png',
    })
    await openProfile()

    expect(screen.getByRole('img', { name: /company logo/i }))
      .toHaveAttribute('src', 'https://cdn.example.com/logo.png')
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
