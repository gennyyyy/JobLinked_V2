import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({ listEmployees: vi.fn() }))
vi.mock('../../../shared/services/applications', () => ({ getApplicationHistory: vi.fn() }))

import { listEmployees } from '../../../shared/services/admin'
import { getApplicationHistory } from '../../../shared/services/applications'
import Employment from '../Employment'

const record = (id, overrides = {}) => ({
  id,
  status: 'Accepted',
  applied_at: '2026-01-05T00:00:00.000Z',
  updated_at: '2026-01-20T00:00:00.000Z',
  seeker: { full_name: 'ada lovelace', email: 'ada@x.test', barangay_district: 'Poblacion' },
  job: { title: 'Cook', employment_type: 'Full-time', employers: { company_name: 'acme corp' } },
  employment: { start_date: '2026-02-01', end_date: null, is_current: true, created_at: '2026-01-20T00:00:00.000Z' },
  ...overrides,
})

describe('Employment oversight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listEmployees.mockResolvedValue([record('a1')])
    getApplicationHistory.mockResolvedValue([{ status: 'Accepted', changed_at: '2026-01-20T00:00:00.000Z', remarks: null }])
  })

  it('renders employee rows and counts the oversight stats', async () => {
    render(<Employment />)
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Full-time', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('Resigned or separated')).toBeInTheDocument()
    expect(screen.getByText('Currently active employees')).toBeInTheDocument()
  })

  it('filters by status and employment type', async () => {
    listEmployees.mockResolvedValue([
      record('a1'),
      record('a2', { status: 'Terminated', job: { title: 'Baker', employment_type: 'Part-time', employers: { company_name: 'beta co' } }, seeker: { full_name: 'ben hale', barangay_district: 'Bagbaguin' } }),
    ])
    render(<Employment />)
    await screen.findByText('Ada Lovelace')

    fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: 'Terminated' } })
    expect(screen.queryByText('Ada Lovelace')).toBeNull()
    expect(screen.getByText('Ben Hale')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/employment status/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/employment type/i), { target: { value: 'Full-time' } })
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByText('Ben Hale')).toBeNull()
  })

  it('opens the employee profile with recorded history', async () => {
    render(<Employment />)
    fireEvent.click(await screen.findByRole('button', { name: /view record for ada lovelace/i }))
    expect(await screen.findByText('Employee profile')).toBeInTheDocument()
    expect(await screen.findByLabelText('Application status history')).toBeInTheDocument()
    expect(getApplicationHistory).toHaveBeenCalledWith('a1')
  })
})
