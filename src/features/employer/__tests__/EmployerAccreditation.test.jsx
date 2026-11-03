import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import EmployerAccreditation from '../EmployerAccreditation'
import { getEmployer } from '../../../shared/services/auth'
import {
  listAccreditations,
  createAccreditation,
  listCompanyDocuments,
} from '../../../shared/services/documents'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: vi.fn(() => ({ user: { id: 'employer-1' }, refreshUser: vi.fn() })),
}))

vi.mock('../../../shared/services/auth', () => ({
  getEmployer: vi.fn(),
}))

vi.mock('../../../shared/services/documents', () => ({
  listAccreditations: vi.fn(),
  createAccreditation: vi.fn(),
  listCompanyDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  validateFile: vi.fn(),
  signedUrl: vi.fn(),
}))

import useAuth from '../../../shared/hooks/useAuth'

const COMPANY = { id: 'comp-1', company_name: 'Acme Corp' }

describe('EmployerAccreditation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'employer-1' }, refreshUser: vi.fn() })
    listCompanyDocuments.mockResolvedValue([])
  })

  it('shows the loading screen while fetching accreditation data', () => {
    let resolveEmployer
    getEmployer.mockReturnValue(new Promise((res) => { resolveEmployer = res }))
    render(<EmployerAccreditation />)
    expect(screen.getByText(/loading database/i)).toBeInTheDocument()
    act(() => resolveEmployer(COMPANY))
  })

  it('renders the start prompt when no application has been submitted', async () => {
    getEmployer.mockResolvedValue(COMPANY)
    listAccreditations.mockResolvedValue([])
    render(<EmployerAccreditation />)

    expect(await screen.findByText('Start Your Accreditation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /begin accreditation application/i })).toBeInTheDocument()
  })

  it('submits the application and refreshes auth context on Begin', async () => {
    const refreshUser = vi.fn().mockResolvedValue()
    useAuth.mockReturnValue({ user: { id: 'employer-1' }, refreshUser })
    getEmployer.mockResolvedValue(COMPANY)
    listAccreditations.mockResolvedValue([])
    createAccreditation.mockResolvedValue({ id: 'acc-1', status: 'pending', company_id: 'comp-1', submitted_at: '2026-01-05T00:00:00.000Z' })
    render(<EmployerAccreditation />)

    fireEvent.click(await screen.findByRole('button', { name: /begin accreditation application/i }))

    await waitFor(() => expect(createAccreditation).toHaveBeenCalledWith('comp-1'))
    expect(refreshUser).toHaveBeenCalledWith({ id: 'employer-1' })
  })

  it('shows the pending-review banner and document tabs for a pending application', async () => {
    getEmployer.mockResolvedValue(COMPANY)
    listAccreditations.mockResolvedValue([
      { id: 'acc-1', status: 'pending', company_id: 'comp-1', submitted_at: '2026-01-05T00:00:00.000Z' },
    ])
    render(<EmployerAccreditation />)

    expect(await screen.findByText(/under review by peso/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /required documents/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /history \(1\)/i })).toBeInTheDocument()
  })

  it('shows the rejection banner with remarks for a rejected application', async () => {
    getEmployer.mockResolvedValue(COMPANY)
    listAccreditations.mockResolvedValue([
      { id: 'acc-1', status: 'rejected', company_id: 'comp-1', submitted_at: '2026-01-05T00:00:00.000Z', remarks: 'Missing permits.' },
    ])
    render(<EmployerAccreditation />)

    expect(await screen.findByText(/your accreditation was rejected\. missing permits\./i)).toBeInTheDocument()
  })

  it('shows an error message when the accreditation fails to load', async () => {
    getEmployer.mockRejectedValue(new Error('unknown employer'))
    render(<EmployerAccreditation />)
    expect(await screen.findByText('unknown employer')).toBeInTheDocument()
  })
})
