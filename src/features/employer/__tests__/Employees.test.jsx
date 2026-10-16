import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import Employees from '../Employees'
import { listByCompany, updateApplicationStatus } from '../../../shared/services/applications'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'employer-1' } }),
}))

vi.mock('../../../shared/services/applications', () => ({
  listByCompany: vi.fn(),
  updateApplicationStatus: vi.fn(),
}))

// SeekerProfileCard (imported by Employees) pulls the seeker/document services,
// which reach the Supabase client — stub them out.
vi.mock('../../../shared/services/seekers', () => ({
  listSeekerEducation: vi.fn(),
  listSeekerExperience: vi.fn(),
}))
vi.mock('../../../shared/services/documents', () => ({ signedUrl: vi.fn() }))

const ACCEPTED = {
  id: 'a1',
  status: 'Accepted',
  updated_at: '2026-02-01T00:00:00.000Z',
  seeker: { id: 's1', full_name: 'juan dela cruz', email: 'juan@x.test' },
  job: { title: 'Warehouse Associate' },
}
const TERMINATED = {
  id: 'a2',
  status: 'Terminated',
  updated_at: '2026-01-10T00:00:00.000Z',
  seeker: { id: 's2', full_name: 'maria santos', email: 'maria@x.test' },
  job: { title: 'Data Encoder' },
}
// A non-employee application that must be filtered out of the roster entirely.
const APPLIED = {
  id: 'a3',
  status: 'Applied',
  updated_at: '2026-01-05T00:00:00.000Z',
  seeker: { full_name: 'not an employee' },
  job: { title: 'Cashier' },
}

describe('Employees roster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateApplicationStatus.mockResolvedValue({ id: 'a1', status: 'Accepted' })
  })

  it('shows the loading screen while fetching employees', () => {
    let resolveList
    listByCompany.mockReturnValue(new Promise((res) => { resolveList = res }))
    render(<Employees />)
    expect(screen.getByText(/loading database/i)).toBeInTheDocument()
    act(() => resolveList([]))
  })

  it('renders only Accepted/Terminated applications as employees with metric counts', async () => {
    listByCompany.mockResolvedValue([ACCEPTED, TERMINATED, APPLIED])
    render(<Employees />)

    await screen.findByText('juan dela cruz')
    // The Applied application is filtered out.
    expect(screen.queryByText('not an employee')).not.toBeInTheDocument()

    expect(screen.getByTitle('Show all employees')).toHaveTextContent('2')
    expect(screen.getByTitle('Show active employees')).toHaveTextContent('1')
    expect(screen.getByTitle('Show terminated employees')).toHaveTextContent('1')
  })

  it('terminates an active employee via updateApplicationStatus', async () => {
    listByCompany.mockResolvedValue([ACCEPTED])
    render(<Employees />)
    fireEvent.click(await screen.findByTitle('Terminate employee'))

    await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledTimes(1))
    expect(updateApplicationStatus.mock.calls[0]).toEqual(['a1', 'Terminated'])
  })

  it('reactivates a terminated employee via updateApplicationStatus', async () => {
    listByCompany.mockResolvedValue([TERMINATED])
    render(<Employees />)
    fireEvent.click(await screen.findByTitle('Reactivate employee'))

    await waitFor(() => expect(updateApplicationStatus).toHaveBeenCalledTimes(1))
    expect(updateApplicationStatus.mock.calls[0]).toEqual(['a2', 'Accepted'])
  })

  it('filters the roster by employee name from the search box', async () => {
    listByCompany.mockResolvedValue([ACCEPTED, TERMINATED])
    render(<Employees />)
    await screen.findByText('juan dela cruz')

    fireEvent.change(screen.getByPlaceholderText(/search by employee name/i), {
      target: { value: 'maria' },
    })

    expect(screen.queryByText('juan dela cruz')).not.toBeInTheDocument()
    expect(screen.getByText('maria santos')).toBeInTheDocument()
  })

  it('filters the roster to a single status via the status select', async () => {
    listByCompany.mockResolvedValue([ACCEPTED, TERMINATED])
    render(<Employees />)
    const select = await screen.findByRole('combobox')

    fireEvent.change(select, { target: { value: 'terminated' } })

    expect(select).toHaveValue('terminated')
    expect(screen.queryByText('juan dela cruz')).not.toBeInTheDocument()
    expect(screen.getByText('maria santos')).toBeInTheDocument()
  })

  it('shows an error banner when the roster fails to load', async () => {
    listByCompany.mockRejectedValue(new Error('network down'))
    render(<Employees />)

    expect(await screen.findByText("Couldn't load employees")).toBeInTheDocument()
    expect(screen.getByText('network down')).toBeInTheDocument()
  })
})
