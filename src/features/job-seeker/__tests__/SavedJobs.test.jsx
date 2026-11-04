import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SavedJobs from '../SavedJobs'
import { listJobs } from '@/shared/services/jobs'

vi.mock('@/shared/services/jobs', () => ({ listJobs: vi.fn() }))

const JOBS = [
  {
    id: 'j1', title: 'Administrative Assistant', employerName: 'Northfield Business Solutions',
    barangay: 'Poblacion', type: 'Full-time', salaryMin: 18000, salaryMax: 22000,
  },
  {
    id: 'j2', title: 'Junior Web Developer', employerName: 'Hiraya Digital Studio',
    barangay: 'Guyong', type: 'Full-time', salaryMin: 25000, salaryMax: 35000,
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

    fireEvent.click(screen.getByRole('button', { name: /remove administrative assistant from saved jobs/i }))
    await waitFor(() => expect(screen.getByText('No saved jobs yet.')).toBeInTheDocument())
  })

  it('shows the empty state when nothing is saved', async () => {
    renderSaved()
    expect(await screen.findByText('No saved jobs yet.')).toBeInTheDocument()
  })
})
