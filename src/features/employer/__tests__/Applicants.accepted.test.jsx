import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

const ACCEPTED = {
  id: 'app-accepted',
  status: 'Accepted',
  applied_at: '2026-01-05T00:00:00.000Z',
  seeker: { id: 's1', full_name: 'maria santos' },
  job: { title: 'Warehouse Associate' },
}

const TERMINATED = {
  id: 'app-terminated',
  status: 'Terminated',
  applied_at: '2026-01-06T00:00:00.000Z',
  seeker: { id: 's2', full_name: 'tim terminated' },
  job: { title: 'Warehouse Associate' },
}

describe('Applicants — Accepted rows and metric', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listByCompany.mockResolvedValue([ACCEPTED, TERMINATED])
    updateApplicationStatus.mockResolvedValue({ id: 'app-accepted', status: 'Accepted' })
  })

  it('shows the Accepted metric card with a count of 1', async () => {
    render(<Applicants />)

    expect(await screen.findByRole('button', { name: '1 Accepted' })).toBeInTheDocument()
  })

  it('filters the table to the accepted candidate when the card is clicked', async () => {
    render(<Applicants />)

    fireEvent.click(await screen.findByRole('button', { name: '1 Accepted' }))

    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
  })

  it('never renders the Terminated application in the table', async () => {
    render(<Applicants />)

    await screen.findByRole('button', { name: '1 Accepted' })

    expect(screen.queryByText('Tim Terminated')).not.toBeInTheDocument()
  })
})
