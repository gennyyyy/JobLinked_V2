import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import Accreditation from '../Accreditation'
import { listAllAccreditations, listCompanies, updateUser, requestDocs } from '../../../shared/services/admin'
import { updateAccreditation, updateDocumentStatus, signedUrl, listCompanyDocuments } from '../../../shared/services/documents'

vi.mock('../../../shared/services/admin', () => ({
  listAllAccreditations: vi.fn(),
  listCompanies: vi.fn(),
  updateUser: vi.fn(),
  requestDocs: vi.fn(),
}))

vi.mock('../../../shared/services/documents', () => ({
  updateAccreditation: vi.fn(),
  updateDocumentStatus: vi.fn(),
  listCompanyDocuments: vi.fn(),
  signedUrl: vi.fn(),
  // Simple "latest per company" helper: the last accreditation row per company_id.
  latestAccByCompany: (accs = []) =>
    Object.fromEntries((accs || []).map((a) => [a.company_id, a])),
}))

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'admin-1', role: 'super-admin' } }),
}))

const PENDING = {
  id: 'acc-1',
  company_id: 'c1',
  status: 'pending',
  submitted_at: '2026-01-05T00:00:00.000Z',
  employers: { id: 'c1', company_name: 'acme corp', email: 'hr@acme.test' },
}
const COMPANY = {
  id: 'c1',
  company_name: 'acme corp',
  full_name: 'jane owner',
  email: 'hr@acme.test',
  status: 'active',
  accreditation_status: 'pending',
}

describe('Accreditation management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateAccreditation.mockResolvedValue({})
    updateUser.mockResolvedValue({})
    requestDocs.mockResolvedValue({})
    listAllAccreditations.mockResolvedValue({ data: [PENDING], total: 1, page: 1, pageSize: 100 })
    listCompanies.mockResolvedValue({ data: [COMPANY], total: 1, page: 1, pageSize: 25 })
  })

  it('shows the loading screen while fetching', () => {
    let resolveAccs
    listAllAccreditations.mockReturnValue(new Promise((res) => { resolveAccs = res }))
    render(<Accreditation />)
    expect(screen.getByText(/loading database/i)).toBeInTheDocument()
    act(() => resolveAccs({ data: [] }))
  })

  it('renders the pending queue and the registered employers table', async () => {
    render(<Accreditation />)
    expect(await screen.findByText('1 PENDING')).toBeInTheDocument()
    // The company name appears in both the pending queue and the employers table.
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'Accredit' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /registered employers \(1\)/i })).toBeInTheDocument()
  })

  it('accredits a pending employer via updateAccreditation', async () => {
    render(<Accreditation />)
    fireEvent.click(await screen.findByRole('button', { name: 'Accredit' }))

    await waitFor(() =>
      expect(updateAccreditation).toHaveBeenCalledWith('acc-1', {
        status: 'approved',
        remarks: 'Account verified and accredited.',
      })
    )
  })

  it('requires a rejection reason before rejecting', async () => {
    render(<Accreditation />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }))

    // Confirm with an empty note → error, no API call.
    fireEvent.click(screen.getByRole('button', { name: /confirm rejection/i }))
    expect(screen.getByText('Please enter a rejection reason.')).toBeInTheDocument()
    expect(updateAccreditation).not.toHaveBeenCalled()

    // Provide a note → rejects with that remark.
    fireEvent.change(screen.getByLabelText(/rejection reason/i), {
      target: { value: 'Incomplete documents' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm rejection/i }))
    await waitFor(() =>
      expect(updateAccreditation).toHaveBeenCalledWith('acc-1', {
        status: 'rejected',
        remarks: 'Incomplete documents',
      })
    )
  })

  it('requires a note before requesting documents', async () => {
    render(<Accreditation />)
    fireEvent.click(await screen.findByRole('button', { name: 'Request Documents' }))

    fireEvent.click(screen.getByRole('button', { name: /confirm request/i }))
    expect(screen.getByText('Please list the documents required.')).toBeInTheDocument()
    expect(requestDocs).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/documents required/i), {
      target: { value: 'Submit updated business permit' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm request/i }))
    await waitFor(() =>
      expect(requestDocs).toHaveBeenCalledWith('acc-1', 'Submit updated business permit')
    )
  })

  it('suspends an active employer via updateUser', async () => {
    render(<Accreditation />)
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('c1', { status: 'suspended' }))
    // Refreshes the company list after the toggle.
    expect(listCompanies).toHaveBeenCalledTimes(2)
  })

  it('shows an error message when loading fails', async () => {
    listAllAccreditations.mockRejectedValue(new Error('server error'))
    render(<Accreditation />)
    expect(await screen.findByText('server error')).toBeInTheDocument()
  })
})

describe('Accreditation mutation error handling (S4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateAccreditation.mockResolvedValue({})
    updateUser.mockResolvedValue({})
    requestDocs.mockResolvedValue({})
    listAllAccreditations.mockResolvedValue({ data: [PENDING], total: 1, page: 1, pageSize: 100 })
    listCompanies.mockResolvedValue({ data: [COMPANY], total: 1, page: 1, pageSize: 25 })
  })

  it('surfaces the error banner when accrediting fails', async () => {
    updateAccreditation.mockRejectedValue(new Error('accredit boom'))
    render(<Accreditation />)
    fireEvent.click(await screen.findByRole('button', { name: 'Accredit' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('accredit boom')
    // The page itself stays rendered — the failure did not tear down the queue.
    expect(screen.getByRole('button', { name: 'Accredit' })).toBeInTheDocument()
  })

  it('surfaces the error banner when rejecting fails', async () => {
    updateAccreditation.mockRejectedValue(new Error('reject boom'))
    render(<Accreditation />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }))
    fireEvent.change(screen.getByLabelText(/rejection reason/i), { target: { value: 'Incomplete' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm rejection/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('reject boom')
  })

  it('surfaces the error banner when suspending an employer fails', async () => {
    updateUser.mockRejectedValue(new Error('suspend boom'))
    render(<Accreditation />)
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('suspend boom')
  })

  it('surfaces the error banner when revoking an accreditation fails', async () => {
    // Revoke only renders for a company whose latest accreditation is approved.
    listAllAccreditations.mockResolvedValue({ data: [{ ...PENDING, status: 'approved' }], total: 1, page: 1, pageSize: 100 })
    listCompanies.mockResolvedValue({ data: [{ ...COMPANY, accreditation_status: 'approved' }], total: 1, page: 1, pageSize: 25 })
    updateAccreditation.mockRejectedValue(new Error('revoke boom'))
    render(<Accreditation />)
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke Accreditation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('revoke boom')
  })

  it('surfaces an error inside the documents modal when a status change fails', async () => {
    updateDocumentStatus.mockRejectedValue(new Error('doc boom'))
    listCompanyDocuments.mockResolvedValue([
      { id: 'doc-1', doc_type: 'Business Permit', file_path: 'c1/permit.pdf', file_name: 'permit.pdf', status: 'pending' },
    ])
    render(<Accreditation />)
    fireEvent.click(await screen.findByRole('button', { name: 'View Documents' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Verify' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('doc boom')
  })

  it('surfaces an error inside the documents modal when the signed URL fails', async () => {
    signedUrl.mockRejectedValue(new Error('signed boom'))
    listCompanyDocuments.mockResolvedValue([
      { id: 'doc-1', doc_type: 'Business Permit', file_path: 'c1/permit.pdf', file_name: 'permit.pdf', status: 'pending' },
    ])
    render(<Accreditation />)
    fireEvent.click(await screen.findByRole('button', { name: 'View Documents' }))
    fireEvent.click(await screen.findByRole('button', { name: 'View' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('signed boom')
  })
})
