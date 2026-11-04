import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../Dashboard'

vi.mock('../../../shared/hooks/useAuth', () => ({ default: vi.fn() }))
vi.mock('../../../shared/services/applications', () => ({ listBySeeker: vi.fn() }))
vi.mock('../../../shared/services/jobs', () => ({ listJobs: vi.fn() }))
vi.mock('../../../shared/services/notifications', () => ({ listNotifications: vi.fn() }))

import useAuth from '../../../shared/hooks/useAuth'
import { listBySeeker } from '../../../shared/services/applications'
import { listJobs } from '../../../shared/services/jobs'
import { listNotifications } from '../../../shared/services/notifications'

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

const APPLICATIONS = [
  { id: 'a1', job_id: 'j9', status: 'Accepted', applied_at: daysAgo(1), job: { title: 'Warehouse Associate', employers: { company_name: 'santa maria trading' } } },
  { id: 'a2', job_id: 'j8', status: 'Rejected', applied_at: daysAgo(2), job: { title: 'Cashier', employers: { company_name: 'sm groceries' } } },
  { id: 'a3', job_id: 'j7', status: 'Pending', applied_at: daysAgo(3), job: { title: 'Driver', employers: { company_name: 'sm logistics' } } },
  { id: 'a4', job_id: 'j6', status: 'Accepted', applied_at: daysAgo(30), job: { title: 'Helper', employers: { company_name: 'sm hardware' } } },
]

const JOBS = [{ id: 'j1', title: 'Truck Driver', location: 'Santa Maria', employers: { company_name: 'sm logistics' } }]

const statValue = (label) => screen.getAllByText(label).map((el) => el.closest('.surface')).find(Boolean).querySelector('p').textContent

async function renderDashboard() {
  render(<MemoryRouter><Dashboard /></MemoryRouter>)
  return screen.findByText('Applications sent')
}

describe('Job-seeker Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 'seeker-1', full_name: 'juan dela cruz' } })
    listBySeeker.mockResolvedValue(APPLICATIONS)
    listJobs.mockResolvedValue({ jobs: JOBS })
    listNotifications.mockResolvedValue([])
  })

  it('renders the four tiles with their counts', async () => {
    await renderDashboard()
    expect(statValue('Applications sent')).toBe('4')
    expect(statValue('Saved opportunities')).toBe('0')
    expect(statValue('Upcoming interviews')).toBe('0')
  })

  it('greets the user by first name', async () => {
    await renderDashboard()
    expect(screen.getByText(/good to see you, juan/i)).toBeInTheDocument()
  })

  it('shows the profile completion percentage for a partial profile', async () => {
    useAuth.mockReturnValue({
      user: { id: 'seeker-1', first_name: 'Juan', last_name: 'Dela Cruz', phone: '09171234567', skills: ['Driving'] },
    })
    await renderDashboard()
    expect(screen.getAllByText('40%').length).toBeGreaterThan(0)
  })

  it('shows an alert when applications fail to load', async () => {
    listBySeeker.mockRejectedValue(new Error('Network down'))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
  })
})
