import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import Accreditation from '../Accreditation'
import { listAllAccreditations } from '../../../shared/services/admin'
import { updateAccreditation, updateDocumentStatus, signedUrl, listCompanyDocuments } from '../../../shared/services/documents'

vi.mock('../../../shared/services/admin', () => ({
  listAllAccreditations: vi.fn(),
}))

vi.mock('../../../shared/services/documents', () => ({
  updateAccreditation: vi.fn(),
  updateDocumentStatus: vi.fn(),
  listCompanyDocuments: vi.fn(),
  signedUrl: vi.fn(),
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'admin-1', role: 'super-admin' } }),
}))

const PENDING = {
  id: 'acc-1',
  company_id: 'c1',
  status: 'pending',
  submitted_at: '2026-01-05T00:00:00.000Z',
  employers: {
    id: 'c1',
    company_name: 'acme corp',
    industry: 'retail',
    barangay_district: 'poblacion',
    phone: '09170000000',
    company_email: 'hr@acme.test',
  },
}

function mockList(rows = [PENDING]) {
  listAllAccreditations.mockResolvedValue({ data: rows, total: rows.length, page: 1, pageSize: 500 })
}

async function openReview() {
  render(<Accreditation />)
  fireEvent.click(await screen.findByRole('button', { name: /review acme corp/i }))
}

describe('Accreditation management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateAccreditation.mockResolvedValue({})
    updateDocumentStatus.mockResolvedValue({})
    listCompanyDocuments.mockResolvedValue([])
    mockList()
  })

  it('shows a layout skeleton while fetching', () => {
    let resolveAccs
    listAllAccreditations.mockReturnValue(new Promise((res) => { resolveAccs = res }))
    render(<Accreditation />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading page/i)
    act(() => resolveAccs({ data: [] }))
  })

  it('renders the accreditation table', async () => {
    render(<Accreditation />)
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getAllByText('Pending Review').length).toBeGreaterThan(0)
    expect(screen.getByText(/poblacion · retail/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /review acme corp/i })).toBeInTheDocument()
  })

  it('accredits a pending employer via updateAccreditation', async () => {
    await openReview()
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() =>
      expect(updateAccreditation).toHaveBeenCalledWith('acc-1', {
        status: 'approved',
        remarks: 'Account verified and accredited.',
      })
    )
  })

  it('requires a rejection reason before rejecting', async () => {
    await openReview()
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))

    expect(screen.getByText(/give a clear reason of at least 10 characters/i)).toBeInTheDocument()
    expect(updateAccreditation).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/review feedback/i), { target: { value: 'Incomplete documents' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() =>
      expect(updateAccreditation).toHaveBeenCalledWith('acc-1', {
        status: 'rejected',
        remarks: 'Incomplete documents',
      })
    )
  })

  it('requires a note before requesting documents', async () => {
    await openReview()
    fireEvent.click(screen.getByRole('button', { name: /request documents/i }))

    expect(screen.getByText(/give a clear reason of at least 10 characters/i)).toBeInTheDocument()
    expect(updateAccreditation).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/review feedback/i), { target: { value: 'Submit updated business permit' } })
    fireEvent.click(screen.getByRole('button', { name: /request documents/i }))
    await waitFor(() =>
      expect(updateAccreditation).toHaveBeenCalledWith('acc-1', {
        status: 'resubmission',
        remarks: 'Submit updated business permit',
      })
    )
  })

  it('shows an error message when loading fails', async () => {
    listAllAccreditations.mockRejectedValue(new Error('server error'))
    render(<Accreditation />)
    expect(await screen.findByText('server error')).toBeInTheDocument()
  })

  it('surfaces the error inside the review dialog when approving fails', async () => {
    updateAccreditation.mockRejectedValue(new Error('approve boom'))
    await openReview()
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('approve boom')
  })

  it('surfaces an error inside the documents section when a status change fails', async () => {
    updateDocumentStatus.mockRejectedValue(new Error('doc boom'))
    listCompanyDocuments.mockResolvedValue([
      { id: 'doc-1', doc_type: 'Business Permit', file_path: 'c1/permit.pdf', file_name: 'permit.pdf', status: 'pending' },
    ])
    await openReview()
    fireEvent.click(await screen.findByRole('button', { name: 'Verify' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('doc boom')
  })

  it('surfaces an error inside the documents section when the signed URL fails', async () => {
    signedUrl.mockRejectedValue(new Error('signed boom'))
    listCompanyDocuments.mockResolvedValue([
      { id: 'doc-1', doc_type: 'Business Permit', file_path: 'c1/permit.pdf', file_name: 'permit.pdf', status: 'pending' },
    ])
    await openReview()
    fireEvent.click(await screen.findByRole('button', { name: 'View' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('signed boom')
  })
})
