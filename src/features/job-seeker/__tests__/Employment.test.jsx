import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import Employment from '../Employment'
import { listEmployment } from '../../../shared/services/seekers'

vi.mock('../../../shared/hooks/useAuth', () => ({
  default: () => ({ user: { id: 'seeker-1' } }),
}))

vi.mock('../../../shared/services/seekers', () => ({
  listEmployment: vi.fn(),
}))

const CURRENT = {
  id: 'emp-1',
  employer_name: 'Acme Corp',
  position: 'Warehouse Associate',
  is_current: true,
  start_date: '2025-03-01',
  end_date: null,
}
const PAST = {
  id: 'emp-2',
  employer_name: 'Beta Foods',
  position: 'Cashier',
  is_current: false,
  start_date: '2023-01-01',
  end_date: '2024-06-30',
}

describe('Employment history', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the loading screen while fetching employment records', () => {
    let resolveList
    listEmployment.mockReturnValue(new Promise((res) => { resolveList = res }))
    render(<Employment />)
    expect(screen.getByText(/loading database/i)).toBeInTheDocument()
    act(() => resolveList([]))
  })

  it('renders employment records with their Current/Past status', async () => {
    listEmployment.mockResolvedValue([CURRENT, PAST])
    render(<Employment />)

    await screen.findByText('Acme Corp')
    expect(screen.getByText('Warehouse Associate')).toBeInTheDocument()
    expect(screen.getByText('Beta Foods')).toBeInTheDocument()
    // Each record card carries its own status badge. The filter tiles also
    // read "Current"/"Past", so scope the query to the record cards.
    expect(within(screen.getByText('Acme Corp').closest('section')).getByText('Current')).toBeInTheDocument()
    expect(within(screen.getByText('Beta Foods').closest('section')).getByText('Past')).toBeInTheDocument()
  })

  it('renders the empty state when there are no records', async () => {
    listEmployment.mockResolvedValue([])
    render(<Employment />)
    expect(await screen.findByText('No employment records yet.')).toBeInTheDocument()
  })

  it('filters to current employment when the Current tile is clicked', async () => {
    listEmployment.mockResolvedValue([CURRENT, PAST])
    render(<Employment />)
    await screen.findByText('Acme Corp')

    fireEvent.click(screen.getByTitle('Show current employment'))

    expect(screen.queryByText('Beta Foods')).not.toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  it('shows an error message when the records fail to load', async () => {
    listEmployment.mockRejectedValue(new Error('boom'))
    render(<Employment />)
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })
})
