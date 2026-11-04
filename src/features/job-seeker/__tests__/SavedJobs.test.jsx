import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SavedJobs from '../SavedJobs'
import { listJobs } from '@/shared/services/jobs'

vi.mock('@/shared/services/jobs', () => ({ listJobs: vi.fn() }))

vi.mock('@/shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1', role: 'job-seeker', skills: [] } }),
}))

const JOBS = [
  {
    id: 'j1',
    title: 'Administrative Assistant',
    status: 'published',
    created_at: '2026-10-18T00:00:00.000Z',
    location: 'Poblacion',
    employment_type: 'Full-time',
    salary_min: 18000,
    salary_max: 22000,
    employers: { company_name: 'Northfield Business Solutions', accreditation_status: 'approved' },
  },
  {
    id: 'j2',
    title: 'Junior Web Developer',
    status: 'published',
    created_at: '2026-10-10T00:00:00.000Z',
    location: 'Guyong',
    employment_type: 'Full-time',
    salary_min: 25000,
    salary_max: 35000,
    employers: { company_name: 'Hiraya Digital Studio', accreditation_status: 'approved' },
  },
]

function renderSaved() {
  return render(<MemoryRouter><SavedJobs /></MemoryRouter>)
}

describe('SavedJobs', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    listJobs.mockResolvedValue({ jobs: JOBS, total: JOBS.length })
  })

  it('lists only saved jobs and removes one in place', async () => {
    window.localStorage.setItem('joblinked.savedJobs', JSON.stringify(['j1']))
    renderSaved()

    expect(await screen.findByText('Administrative Assistant')).toBeInTheDocument()
    expect(screen.queryByText('Junior Web Developer')).not.toBeInTheDocument()
    expect(screen.getByText('1 saved opportunities')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /unsave administrative assistant/i }))
    await waitFor(() => expect(screen.getByText('Make room for your next chapter.')).toBeInTheDocument())
  })

  it('shows the reference empty state when nothing is saved', async () => {
    renderSaved()
    expect(await screen.findByText('Make room for your next chapter.')).toBeInTheDocument()
    expect(screen.getByText('0 saved opportunities')).toBeInTheDocument()
  })
})
