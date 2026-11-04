import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

vi.mock('../../../shared/services/admin', () => ({ listAllApplications: vi.fn() }))
vi.mock('../../../shared/services/applications', () => ({ getApplicationHistory: vi.fn() }))

import { listAllApplications } from '../../../shared/services/admin'
import { getApplicationHistory } from '../../../shared/services/applications'
import Applications from '../Applications'

const row = (id, overrides = {}) => ({
  id,
  status: 'Applied',
  applied_at: '2026-01-05T00:00:00.000Z',
  referred_by: null,
  seeker: { full_name: 'ada lovelace', barangay_district: 'Poblacion' },
  job: { title: 'Cook', employers: { company_name: 'acme corp' } },
  ...overrides,
})

describe('Application monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAllApplications.mockResolvedValue({ data: [row('a1')], total: 1, page: 1, pageSize: 500 })
    getApplicationHistory.mockResolvedValue([
      { status: 'Applied', changed_at: '2026-01-05T00:00:00.000Z', remarks: null },
      { status: 'Placed', changed_at: '2026-02-01T00:00:00.000Z', remarks: 'Started on the 1st.' },
    ])
  })

  it('renders candidates, barangay, and the referral state', async () => {
    render(<Applications />)
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Poblacion' })).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Not referred')).toBeInTheDocument()
    expect(screen.getByText('Cook')).toBeInTheDocument()
  })

  it('filters by status, barangay, and referral marker', async () => {
    listAllApplications.mockResolvedValue({
      data: [
        row('a1'),
        row('a2', { status: 'Placed', referred_by: 'staff-1', seeker: { full_name: 'ben hale', barangay_district: 'Bagbaguin' } }),
      ],
      total: 2,
      page: 1,
      pageSize: 500,
    })
    render(<Applications />)
    await screen.findByText('Ada Lovelace')

    fireEvent.change(screen.getByLabelText(/recruitment status/i), { target: { value: 'Placed' } })
    expect(screen.queryByText('Ada Lovelace')).toBeNull()
    expect(screen.getByText('Ben Hale')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/recruitment status/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/candidate barangay/i), { target: { value: 'Poblacion' } })
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByText('Ben Hale')).toBeNull()

    fireEvent.change(screen.getByLabelText(/candidate barangay/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/referral marker/i), { target: { value: 'Referred' } })
    expect(screen.queryByText('Ada Lovelace')).toBeNull()
    expect(screen.getByText('Ben Hale')).toBeInTheDocument()
  })

  it('opens the recorded status history for an application', async () => {
    render(<Applications />)
    fireEvent.click(await screen.findByRole('button', { name: /view application history for ada lovelace/i }))

    expect(await screen.findByText('Started on the 1st.')).toBeInTheDocument()
    expect(getApplicationHistory).toHaveBeenCalledWith('a1')
    expect(screen.getByLabelText('Application status history')).toBeInTheDocument()
  })
})
