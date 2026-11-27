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
  logoUrl: vi.fn(() => null),
}))

import useAuth from '../../../shared/hooks/useAuth'
import { getEmployer, updateProfile } from '../../../shared/services/auth'

// A profile that satisfies everything employer registration requires.
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

const hasMarker = (name) => screen.getByLabelText(name).labels[0]
  ?.querySelector('span.text-destructive')?.textContent === '*'
const save = () => fireEvent.click(screen.getByRole('button', { name: /save company profile/i }))

describe('CompanyProfile required fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'u1', email: 'hr@company.ph' }, refreshUser: vi.fn().mockResolvedValue({}) })
    updateProfile.mockResolvedValue({})
  })

  it('marks every registration-required control and leaves the optional ones unmarked', async () => {
    getEmployer.mockResolvedValue(COMPLETE_COMPANY)
    await openProfile()

    for (const name of [/^Company Name/, /^Industry/]) {
      expect(hasMarker(name), `required marker missing on ${name}`).toBe(true)
    }
    for (const name of [/^About the Company/, /^Website/]) {
      expect(hasMarker(name), `unexpected marker on ${name}`).toBe(false)
    }

    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))
    for (const name of [
      /^Recruitment Contact Email/, /^Business Phone/, /^Street Address/,
      /^Barangay \/ District/, /^City \/ Municipality/, /^Province \/ State/,
    ]) {
      expect(hasMarker(name), `required marker missing on ${name}`).toBe(true)
    }
    for (const name of [
      /^House \/ Building \/ Unit No\./, /^Subdivision \/ Village \/ Building/, /^Postal Code/,
    ]) {
      expect(hasMarker(name), `unexpected marker on ${name}`).toBe(false)
    }

    fireEvent.click(screen.getByRole('tab', { name: /^representative$/i }))
    for (const name of [
      /^First Name/, /^Last Name/, /^Designation \/ Position/,
      /^Representative Mobile/, /^Representative Email/,
    ]) {
      expect(hasMarker(name), `required marker missing on ${name}`).toBe(true)
    }
    for (const name of [/^Middle Name/, /^Suffix/]) {
      expect(hasMarker(name), `unexpected marker on ${name}`).toBe(false)
    }
  })

  it('blocks a minimal profile, shows the errors, and opens the owning tab', async () => {
    getEmployer.mockResolvedValue({ company_name: 'Santa Maria Trading' })
    await openProfile()
    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))

    save()

    expect(await screen.findByText('Industry is required')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: /^company$/i })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: /contact & location/i }))
    expect(screen.getByText('Company email is required')).toBeInTheDocument()
    expect(screen.getByText('Contact number is required')).toBeInTheDocument()
    expect(screen.getByText('Street address is required')).toBeInTheDocument()
    expect(screen.getByText('Barangay / District is required')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /^representative$/i }))
    expect(screen.getByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Last name is required')).toBeInTheDocument()
    expect(screen.getByText('Position is required')).toBeInTheDocument()
    expect(screen.getByText('Representative email is required')).toBeInTheDocument()
    expect(screen.getByText('Representative mobile is required')).toBeInTheDocument()
  })

  it('saves a profile that meets the registration requirements', async () => {
    getEmployer.mockResolvedValue(COMPLETE_COMPANY)
    await openProfile()

    save()

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith('u1', expect.objectContaining({
      company_name: 'Santa Maria Trading',
      industry: 'Manufacturing',
      company_email: 'hr@company.ph',
      phone: '+639171234567',
      representative_email: 'maria@company.ph',
      representative_phone: '+639181234567',
    }))
  })
})
