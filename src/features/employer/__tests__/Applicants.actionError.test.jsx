import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Applicants from '../Applicants'
import { listByCompany, updateApplicationStatus } from '../../../shared/services/applications'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'employer-1' } }),
}))

vi.mock('../../../shared/services/applications', () => ({
  listByCompany: vi.fn(),
  updateApplicationStatus: vi.fn(),
}))

// SeekerProfileCard (imported by Applicants) pulls the seeker/document services,
// which reach the Supabase client — stub them out.
vi.mock('../../../shared/services/seekers', () => ({
  listSeekerEducation: vi.fn(),
  listSeekerExperience: vi.fn(),
}))
vi.mock('../../../shared/services/documents', () => ({ signedUrl: vi.fn() }))

const APPLICANT = {
  id: 'app-1',
  status: 'Under Review',
  applied_at: '2026-01-05T00:00:00.000Z',
  seeker: { id: 's1', full_name: 'juan dela cruz' },
  job: { title: 'Warehouse Associate' },
}
const OTHER = { ...APPLICANT, id: 'app-2', seeker: { id: 's2', full_name: 'maria clara' }, job: { title: 'Cashier' } }

describe('Applicants — per-action error state (S5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listByCompany.mockResolvedValue([APPLICANT, OTHER])
  })

  it('keeps the list rendered when one status change fails', async () => {
    // app-1's reject fails, app-2's succeeds.
    updateApplicationStatus.mockImplementation((id) =>
      id === 'app-1' ? Promise.reject(new Error('status boom')) : Promise.resolve({ id, status: 'Rejected' })
    )
    render(<Applicants />)

    fireEvent.click((await screen.findAllByTitle('Reject candidate'))[0])
    // Error is scoped to the failing applicant…
    expect(await screen.findByRole('alert')).toHaveTextContent('status boom')
    // …the list is not replaced by the error card…
    expect(screen.getByText('Warehouse Associate')).toBeInTheDocument()
    expect(screen.queryByText(/couldn't load applicants/i)).not.toBeInTheDocument()
    // …and actions on the other applicant still work.
    const rejectButtons = screen.getAllByTitle('Reject candidate')
    fireEvent.click(rejectButtons[1])
    await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledWith('app-2', 'Rejected', {}))
    expect(screen.getByText('Cashier')).toBeInTheDocument()
  })

  it('clears the error for an applicant after a successful retry', async () => {
    updateApplicationStatus.mockRejectedValueOnce(new Error('status boom'))
    render(<Applicants />)
    fireEvent.click((await screen.findAllByTitle('Reject candidate'))[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('status boom')

    updateApplicationStatus.mockResolvedValueOnce({ id: 'app-1', status: 'Rejected' })
    fireEvent.click(screen.getAllByTitle('Reject candidate')[0])
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByText('Warehouse Associate')).toBeInTheDocument()
  })
})
